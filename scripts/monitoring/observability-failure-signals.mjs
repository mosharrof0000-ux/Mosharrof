export async function getFailureSignals(run, { owner, repo, token, api }) {
  try {
    const payload = await api(`/actions/runs/${run.id}/jobs?per_page=100`);
    const failedJobs = (payload.jobs || []).filter((job) => job.conclusion === "failure").slice(0, 2);
    const signals = [];
    for (const job of failedJobs) {
      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/jobs/${job.id}/logs`, {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "mosharrof-read-only-observability"
          },
          redirect: "follow",
          signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const log = await response.text();
        const matched = log.split(/\r\n|\n|\r/).filter((line) =>
          /##\[error\]|::error::|Error:|fatal:|exit code [1-9]|failed with exit code|not configured|permission denied|unauthorized|timed out/i.test(line)
        ).slice(-8).map((line) =>
          line.replace(/(Bearer\s+)[^\s]+/gi, "$1[REDACTED]")
              .replace(/(GEMINI_API_KEY|API_KEY|TOKEN|SECRET)=([^\s]+)/gi, "$1=[REDACTED]")
              .slice(-500)
        );
        signals.push({ run_id: run.id, run_name: run.name, job: job.name, job_url: job.html_url,
          status: "LOG_INSPECTED", error_signals: matched.length ? matched : ["No standard error marker found; inspect full job log." ] });
      } catch (error) {
        signals.push({ run_id: run.id, run_name: run.name, job: job.name, job_url: job.html_url,
          status: "LOG_UNAVAILABLE", error_signals: [String(error)] });
      }
    }
    return signals;
  } catch (error) {
    return [{ run_id: run.id, run_name: run.name, status: "JOB_LOOKUP_FAILED", error_signals: [String(error)] }];
  }
}
