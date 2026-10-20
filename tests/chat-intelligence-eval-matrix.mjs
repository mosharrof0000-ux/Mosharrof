import assert from "node:assert/strict";

/**
 * MOSHARROF AI — supplemental 10-lane evaluation contract.
 * This validates the evaluation matrix itself, not live-model answer quality.
 * Every behavioral case still requires a model-backed run and/or human review.
 */
const lanes = [
  { id: "intent", title: "Question intent", cases: ["intent-ambiguous", "intent-clarify"] },
  { id: "continuity", title: "Conversation continuity", cases: ["continuity-relevant-context", "continuity-current-request-wins"] },
  { id: "bengali", title: "Bengali clarity and spelling", cases: ["bengali-natural-answer", "bengali-spelling"] },
  { id: "multistep", title: "Multi-step completion", cases: ["multistep-order", "multistep-partial-status"] },
  { id: "code-diagnostics", title: "Code diagnosis", cases: ["code-root-cause", "code-regression-test"] },
  { id: "source-quality", title: "Evidence and source quality", cases: ["source-unverified-current-fact", "source-no-fabricated-citation"] },
  { id: "visual-understanding", title: "Image and screenshot understanding", cases: ["visual-visible-evidence-only", "visual-unclear-image"] },
  { id: "progress-memory", title: "Progress-state memory", cases: ["progress-running-vs-complete", "progress-no-persistent-memory-claim"] },
  { id: "correction", title: "Correction after failure", cases: ["correction-acknowledge-evidence", "correction-rerun-check"] },
  { id: "quality-score", title: "Dimension-level quality scoring", cases: ["score-independent-dimensions", "score-no-unrun-benchmark-claim"] }
];

const rubric = {
  levels: [0, 1, 2],
  labels: {
    0: "fail-or-unsupported",
    1: "partial-or-uncertain",
    2: "meets-evidence-backed-criteria"
  },
  dimensions: ["correctness", "instruction_following", "bengali_clarity", "evidence", "status_honesty", "context"]
};

assert.equal(lanes.length, 10, "exactly ten supplemental lanes must be present");
assert.deepEqual(new Set(lanes.map(lane => lane.id)).size, lanes.length, "lane IDs must be unique");
const allCases = lanes.flatMap(lane => lane.cases);
assert.equal(new Set(allCases).size, allCases.length, "evaluation case IDs must be unique");
for (const lane of lanes) {
  assert.ok(lane.title.trim().length > 0, `lane ${lane.id} needs a title`);
  assert.ok(lane.cases.length >= 2, `lane ${lane.id} needs at least two cases`);
  for (const caseId of lane.cases) {
    assert.match(caseId, new RegExp(`^${lane.id === "code-diagnostics" ? "code" : lane.id === "source-quality" ? "source" : lane.id === "visual-understanding" ? "visual" : lane.id === "progress-memory" ? "progress" : lane.id === "quality-score" ? "score" : lane.id}-`), `case ${caseId} must map to lane ${lane.id}`);
  }
}
assert.deepEqual(rubric.levels, [0, 1, 2]);
assert.equal(Object.keys(rubric.labels).length, rubric.levels.length);
assert.ok(rubric.dimensions.length >= 5);
assert.ok(rubric.dimensions.includes("evidence"));
assert.ok(rubric.dimensions.includes("status_honesty"));

console.log(`PASS: supplemental eval matrix has ${lanes.length} lanes, ${allCases.length} unique cases, and ${rubric.dimensions.length} independent scoring dimensions.`);
console.log("LIMIT: this checks evaluation-matrix integrity only; live model behavior, real provider quality, and physical-device behavior remain untested by this script.");
