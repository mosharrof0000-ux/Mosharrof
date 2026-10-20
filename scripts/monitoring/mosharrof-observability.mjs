import { mkdir, writeFile } from "node:fs/promises";

const owner = process.env.GITHUB_REPOSITORY_OWNER || "mosharrof0000-ux";
const repo = (process.env.GITHUB_REPOSITORY || `${owner}/Mosharrof`).split("/")[1];
const token = process.env.GITHUB_TOKEN;
const liveUrl = process.env.MOSHARROF_LIVE_URL || "https://mosharrof0000-ux.github.io/Mosharrof/";
if (!token) throw new Error("GITHUB_TOKEN is required");
const base = `https://api.github.com/repos/${owner}/${repo}`;
const staleAfterMinutes = Number(process.env.STALE_AFTER_MINUTES || 45);
const now = Date.now();

async function api(path) {
  const response = await fetch(`${base}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "mosharrof-read-only-observability"
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status} for ${path}: ${await response.text()}`);
  return response.json();
}
const ageMinutes = (iso) => Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
const pages = async (path, maxPages = 10) => {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await api(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
};
const mapRun = (run) => ({
  id: run.id, name: run.name, status: run.status, conclusion: run.conclusion ?? null,
  branch: run.head_branch, event: run.event, sha: run.head_sha,
  created_at: run.created_at, updated_at: run.updated_at,
  age_since_update_minutes: ageMinutes(run.updated_at),
  possibly_stalled: run.status !== "completed" && ageMinutes(run.updated_at) >= staleAfterMinutes,
  url: run.html_url
});
const isFailed = (run) => run.status === "completed" &&
  ["failure", "timed_out", "action_required", "startup_failure"].includes(run.conclusion);
const isAndroidQA = (run) => /android.*(real chat|webview)|webview.*real chat/i.test(run.name);
const isPages = (run) => /deploy mosharrof pages|pages.*deploy/i.test(run.name);
const isMonitor = (run) => /read-only observability/i.test(run.name);

async function getRunJobs(runId) {
  try {
    const payload = await api(`/actions/runs/${runId}/jobs?per_page=100`);
    return (payload.jobs || []).map((job) => ({
      id: job.id, name: job.name, status: job.status, conclusion: job.conclusion ?? null,
      started_at: job.started_at, completed_at: job.completed_at ?? null, url: job.html_url,
      steps: (job.steps || []).filter((step) => step.status !== "completed" || step.conclusion !== "success")
        .map((step) => ({ name: step.name, status: step.status, conclusion: step.conclusion ?? null }))
    }));
  } catch (error) {
    return [{ name: "Job detail lookup failed", status: "unknown", error: String(error) }];
  }
}

async function liveHealth() {
  const started = Date.now();
  try {
    const response = await fetch(liveUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: { "User-Agent": "MOSHARROF-ReadOnly-Monitor/1.0" }
    });
    const html = await response.text();
    const hasBrand = /MOSHARROF AI/i.test(html);
    return {
      url: liveUrl, http_status: response.status, ok: response.ok && hasBrand,
      status: !response.ok ? "FAIL" : hasBrand ? "PASS_BASIC_HTTP_AND_BRAND" : "DEGRADED_BRAND_MARKER_MISSING",
      brand_marker_found: hasBrand, elapsed_ms: Date.now() - started,
      note: "HTTP and brand-marker smoke check only; not a functional chat, API-provider, or Android-device test."
    };
  } catch (error) {
    return {
      url: liveUrl, http_status: null, ok: false, status: "UNKNOWN_OR_UNREACHABLE",
      elapsed_ms: Date.now() - started, error: String(error),
      note: "A network failure from this runner does not alone prove the site is down."
    };
  }
}

const [pullRequests, issues, runsPayload, live] = await Promise.all([
  pages("/pulls?state=open"),
  pages("/issues?state=open"),
  api("/actions/runs?per_page=100"),
  liveHealth()
]);
const rawRuns = runsPayload.workflow_runs || [];
const runs = rawRuns.map(mapRun);
const activeRuns = runs.filter((run) => run.status !== "completed");
const failedRuns = runs.filter(isFailed);
const cancelledRuns = runs.filter((run) => run.status === "completed" && run.conclusion === "cancelled");
const skippedRuns = runs.filter((run) => run.status === "completed" && run.conclusion === "skipped");
const latestBy = (predicate) => runs.find(predicate) || null;
const latestAndroid = latestBy(isAndroidQA);
const latestMonitor = latestBy(isMonitor);
const latestMainPages = latestBy((run) => isPages(run) && run.branch === "main" && run.event === "push");
const selectedForJobs = [...new Map(
  [...activeRuns, ...runs.filter((run) => isAndroidQA(rawRuns.find((r) => r.id === run.id) || {})).slice(0, 3),
   ...runs.filter((run) => isMonitor(rawRuns.find((r) => r.id === run.id) || {})).slice(0, 2)]
    .map((run) => [run.id, run])
).values()].slice(0, 25);

let cursor = 0;
const jobDetails = {};
await Promise.all(Array.from({ length: Math.min(6, selectedForJobs.length) }, async () => {
  while (cursor < selectedForJobs.length) {
    const run = selectedForJobs[cursor++];
    jobDetails[run.id] = await getRunJobs(run.id);
  }
}));

const openPrs = pullRequests.map((pr) => ({
  number: pr.number, title: pr.title, draft: pr.draft, branch: pr.head.ref,
  head_sha: pr.head.sha, base: pr.base.ref, updated_at: pr.updated_at,
  url: pr.html_url, mergeable: pr.mergeable ?? null
}));
const openIssues = issues.filter((issue) => !issue.pull_request).map((issue) => ({
  number: issue.number, title: issue.title, labels: (issue.labels || []).map((label) => label.name),
  updated_at: issue.updated_at, url: issue.html_url
}));
const report = {
  generated_at: new Date().toISOString(),
  repository: `${owner}/${repo}`,
  overall_status: failedRuns.length || live.status === "FAIL" ? "DEGRADED" :
    activeRuns.some((run) => run.possibly_stalled) || !live.ok ? "ATTENTION_REQUIRED" : "SNAPSHOT_OK",
  coverage: {
    github_open_pull_requests: "observed",
    github_open_issues: "observed",
    github_actions_recent_100_runs: "observed",
    active_run_job_steps: "observed_for_selected_runs",
    live_pages_http_brand_smoke: live.status,
    chatgpt_internal_task_automation_execution: "NOT_ACCESSIBLE_FROM_GITHUB_WORKFLOW",
    cloudflare_worker_runtime_and_provider_quality: "NOT_CHECKED_NO_CONFIGURED_HEALTH_ENDPOINT",
    physical_android_device: "NOT_ACCESSIBLE_FROM_GITHUB_RUNNER",
    functional_real_chat: "requires_dedicated_android_webview_real_chat_qa_and_evidence"
  },
  thresholds: { stale_after_minutes: staleAfterMinutes, recent_actions_limit: 100, issue_scan_limit: 1000 },
  counts: {
    open_pull_requests: openPrs.length,
    open_issues: openIssues.length,
    recent_actions_runs: runs.length,
    active_runs: activeRuns.length,
    possibly_stalled_runs: activeRuns.filter((run) => run.possibly_stalled).length,
    recent_failed_runs: failedRuns.length,
    recent_cancelled_runs: cancelledRuns.length,
    recent_skipped_runs: skippedRuns.length
  },
  live_pages: live,
  key_run_status: {
    latest_android_real_chat_qa: latestAndroid,
    latest_observability_run: latestMonitor,
    latest_main_push_pages_workflow: latestMainPages
  },
  active_runs: activeRuns,
  failed_runs: failedRuns,
  cancelled_runs: cancelledRuns,
  skipped_runs: skippedRuns,
  selected_job_details: jobDetails,
  open_pull_requests: openPrs,
  open_issues: openIssues,
  recent_runs: runs,
  limitations: [
    "Read-only: never reruns jobs, merges PRs, deploys, or writes to main.",
    "A stale-looking run is flagged for inspection, not automatically declared dead.",
    "Only the 100 most recent Actions runs are included; API pagination can be extended if needed.",
    "ChatGPT task-automation execution state is not exposed to this GitHub workflow. Its enabled/last-run metadata must be checked through the separate Automations connection.",
    "The live-site probe checks HTTP response and a brand marker only, not functional chat.",
    "Cloudflare Worker/provider health and physical Android-device behavior are not claimed without dedicated endpoint/device evidence.",
    "CI success is not proof that installed-APK real chat passed."
  ]
};
await mkdir("observability-output", { recursive: true });
await writeFile("observability-output/snapshot.json", JSON.stringify(report, null, 2) + "\n");

const runLine = (run) => `- [${run.status === "completed" ? (run.conclusion || "completed").toUpperCase() : run.possibly_stalled ? "CHECK STALE" : run.status.toUpperCase()}] ${run.name} — branch ${run.branch}; last update ${run.age_since_update_minutes}m ago; ${run.url}`;
const lines = [
  "# MOSHARROF Automation & Work Observability Snapshot", "",
  `- Generated (UTC): ${report.generated_at}`,
  `- Repository: ${report.repository}`,
  `- Overall snapshot status: **${report.overall_status}**`,
  `- Open PRs / issues: ${openPrs.length} / ${openIssues.length}`,
  `- Recent runs: ${runs.length}; active: ${activeRuns.length}; possibly stalled: ${report.counts.possibly_stalled_runs}`,
  `- Recent failed / cancelled / skipped: ${failedRuns.length} / ${cancelledRuns.length} / ${skippedRuns.length}`, "",
  "## Live Pages basic health", "",
  `- Status: ${live.status}; HTTP ${live.http_status ?? "unknown"}; brand marker: ${live.brand_marker_found ?? "unknown"}; ${live.url}`,
  `- Scope: ${live.note}`, "",
  "## Critical task lanes", "",
  `- Latest Android Real Chat QA: ${latestAndroid ? `${latestAndroid.status}/${latestAndroid.conclusion || "no conclusion"} — ${latestAndroid.url}` : "NOT FOUND in recent 100 runs"}`,
  `- Latest monitor run: ${latestMonitor ? `${latestMonitor.status}/${latestMonitor.conclusion || "no conclusion"} — ${latestMonitor.url}` : "NOT FOUND in recent 100 runs"}`,
  `- Latest main push Pages workflow: ${latestMainPages ? `${latestMainPages.status}/${latestMainPages.conclusion || "no conclusion"} — ${latestMainPages.url}` : "NOT FOUND in recent 100 runs"}`, "",
  "## Active / possibly stalled runs", "",
  ...(activeRuns.length ? activeRuns.map(runLine) : ["- No active runs among the 100 most recent runs."]), "",
  "## Recent failures", "",
  ...(failedRuns.length ? failedRuns.map(runLine) : ["- No failures among the 100 most recent runs."]), "",
  "## Cancelled runs", "",
  ...(cancelledRuns.length ? cancelledRuns.slice(0, 20).map(runLine) : ["- No cancellations among the 100 most recent runs."]), "",
  "## Skipped runs", "",
  ...(skippedRuns.length ? skippedRuns.slice(0, 20).map(runLine) : ["- No skipped runs among the 100 most recent runs."]), "",
  "## Coverage gaps (explicit)", "",
  "- ChatGPT internal task automations: not readable from this GitHub workflow; query the separate Automations connection.",
  "- Cloudflare Worker/provider runtime: not checked until an approved health endpoint is configured.",
  "- Physical Android phone: not accessible from GitHub-hosted runner.",
  "- Real chat: verify dedicated Android WebView Real Chat QA run plus its evidence artifact; cancelled/skipped is not pass.", "",
  "## Open pull requests", "",
  ...openPrs.map((pr) => `- #${pr.number} ${pr.draft ? "(draft)" : ""} ${pr.title} — ${pr.branch} @ ${pr.head_sha.slice(0, 12)} — ${pr.url}`), "",
  "## Open issues (first 1000)", "",
  ...openIssues.map((issue) => `- #${issue.number} ${issue.title} [${issue.labels.join(", ")}] — ${issue.url}`), "",
  "## Safety rules", "",
  "- This monitor is read-only: it does not rerun, merge, deploy, or write to main.",
  `- Runs without updates for ${staleAfterMinutes} minutes are flagged for inspection; age alone is not proof of a hang.`,
  "- HTTP/brand smoke is not functional chat verification.",
  "- Missing source/evidence is reported as NOT CHECKED / NOT TESTED, never as success."
];
await writeFile("observability-output/snapshot.md", lines.join("\n") + "\n");
console.log(JSON.stringify({
  generated_at: report.generated_at, overall_status: report.overall_status, counts: report.counts,
  live_pages: live, key_run_status: report.key_run_status,
  failed_runs: failedRuns.map(({id,name,conclusion,url}) => ({id,name,conclusion,url})),
  possibly_stalled: activeRuns.filter((run) => run.possibly_stalled).map(({id,name,status,age_since_update_minutes,url}) => ({id,name,status,age_since_update_minutes,url}))
}, null, 2));
