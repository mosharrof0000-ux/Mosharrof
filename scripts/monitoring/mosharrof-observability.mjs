import { mkdir, writeFile } from "node:fs/promises";

const owner = process.env.GITHUB_REPOSITORY_OWNER || "mosharrof0000-ux";
const repo = (process.env.GITHUB_REPOSITORY || `${owner}/Mosharrof`).split("/")[1];
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is required");
const base = `https://api.github.com/repos/${owner}/${repo}`;

async function api(path) {
  const response = await fetch(`${base}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "mosharrof-read-only-observability"
    }
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status} for ${path}: ${await response.text()}`);
  return response.json();
}

const pullRequests = [];
for (let page = 1; page <= 10; page++) {
  const batch = await api(`/pulls?state=open&per_page=100&page=${page}`);
  pullRequests.push(...batch);
  if (batch.length < 100) break;
}
const runsPayload = await api("/actions/runs?per_page=30");
const runs = runsPayload.workflow_runs || [];
const now = Date.now();
const ageMinutes = (iso) => Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
const activeRuns = runs.filter((run) => run.status !== "completed").map((run) => ({
  id: run.id, name: run.name, status: run.status, conclusion: run.conclusion ?? null,
  branch: run.head_branch, sha: run.head_sha, created_at: run.created_at,
  updated_at: run.updated_at, age_since_update_minutes: ageMinutes(run.updated_at),
  possibly_stalled: ageMinutes(run.updated_at) >= 45,
  url: run.html_url
}));
const recentRuns = runs.map((run) => ({
  id: run.id, name: run.name, status: run.status, conclusion: run.conclusion ?? null,
  branch: run.head_branch, sha: run.head_sha, created_at: run.created_at,
  updated_at: run.updated_at, url: run.html_url
}));
const openPrs = pullRequests.map((pr) => ({
  number: pr.number, title: pr.title, draft: pr.draft, branch: pr.head.ref,
  head_sha: pr.head.sha, base: pr.base.ref, updated_at: pr.updated_at,
  url: pr.html_url, mergeable: pr.mergeable ?? null
}));
const report = {
  generated_at: new Date().toISOString(),
  repository: `${owner}/${repo}`,
  scope: "Read-only snapshot of GitHub open PRs and recent Actions runs. Does not inspect ChatGPT automations, deployed runtime, or a physical phone.",
  counts: {
    open_pull_requests: openPrs.length,
    active_recent_workflow_runs: activeRuns.length,
    recent_failed_runs: recentRuns.filter((r) => r.status === "completed" && ["failure", "timed_out", "action_required"].includes(r.conclusion)).length,
    recent_cancelled_runs: recentRuns.filter((r) => r.status === "completed" && r.conclusion === "cancelled").length,
    recent_skipped_runs: recentRuns.filter((r) => r.status === "completed" && r.conclusion === "skipped").length
  },
  active_runs: activeRuns,
  open_pull_requests: openPrs,
  recent_runs: recentRuns
};
await mkdir("observability-output", { recursive: true });
await writeFile("observability-output/snapshot.json", JSON.stringify(report, null, 2) + "\n");
const lines = [
  "# MOSHARROF Read-only Observability Snapshot",
  "",
  `- Generated (UTC): ${report.generated_at}`,
  `- Repository: ${report.repository}`,
  `- Open PRs: ${report.counts.open_pull_requests}`,
  `- Active recent Actions runs: ${report.counts.active_recent_workflow_runs}`,
  `- Recent failed runs: ${report.counts.recent_failed_runs}`,
  `- Recent cancelled runs: ${report.counts.recent_cancelled_runs}`,
  `- Recent skipped runs: ${report.counts.recent_skipped_runs}`,
  "",
  "## Active / possibly stalled runs",
  "",
  ...(activeRuns.length ? activeRuns.map((r) =>
    `- ${r.possibly_stalled ? "[CHECK: no update ≥45m]" : "[ACTIVE]"} ${r.name} — ${r.status}; last update ${r.age_since_update_minutes}m ago; ${r.url}`
  ) : ["- No active runs among the 30 most recent runs."]),
  "",
  "## Open pull requests",
  "",
  ...openPrs.map((p) => `- #${p.number} ${p.draft ? "(draft)" : ""} ${p.title} — ${p.branch} @ ${p.head_sha.slice(0, 12)} — ${p.url}`),
  "",
  "## Limits",
  "",
  "- Read-only snapshot; no reruns, merges, deployments, or repository writes.",
  "- A run without updates for 45 minutes is only flagged for inspection, not declared dead.",
  "- Only the 30 most recent Actions runs are included.",
  "- This does not see ChatGPT task-automation execution state, deployed-site behavior, or physical-device interaction.",
  "- Green CI is not proof of successful Live chat or installed-APK real-chat behavior."
];
await writeFile("observability-output/snapshot.md", lines.join("\n") + "\n");
console.log(JSON.stringify({ generated_at: report.generated_at, counts: report.counts, active_runs: activeRuns.map(({name,status,age_since_update_minutes,possibly_stalled,url})=>({name,status,age_since_update_minutes,possibly_stalled,url})) }, null, 2));
