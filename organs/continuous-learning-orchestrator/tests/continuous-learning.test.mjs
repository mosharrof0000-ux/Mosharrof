import test from "node:test";
import assert from "node:assert/strict";
import { createLearningCycle, learningPolicy } from "../index.js";

test("creates a bounded learning cycle in approved domains", () => {
  const cycle = createLearningCycle({ id: "ai-update-review", goal: "Review new AI model capabilities", domains: ["ai-models", "software-security"] });
  assert.equal(cycle.getCycleReport().status, "planned");
  assert.equal(cycle.getCycleReport().domains.length, 2);
  assert.equal(learningPolicy.liveMutation, "forbidden");
});

test("rejects unknown domains, unsafe IDs, and excessive evidence caps", () => {
  assert.throws(() => createLearningCycle({ domains: ["all-the-internet"] }), /approved learning domain/);
  assert.throws(() => createLearningCycle({ id: "../main" }), /kebab-case/);
  assert.throws(() => createLearningCycle({ maxEvidence: 21 }), /between 1 and 20/);
});

test("accepts only HTTPS URLs without embedded credentials", () => {
  const cycle = createLearningCycle({ domains: ["ai-models"] });
  const base = { title: "Model release", summary: "A release note", domain: "ai-models" };
  assert.throws(() => cycle.recordEvidence({ ...base, url: "http://example.com" }), /only HTTPS/);
  assert.throws(() => cycle.recordEvidence({ ...base, url: "https://user:pass@example.com" }), /embedded credentials/);
  assert.throws(() => cycle.recordEvidence({ ...base, url: "javascript:alert(1)" }), /only HTTPS/);
  assert.equal(cycle.recordEvidence({ ...base, url: "https://example.com/release", reliability: "high" }).accepted, true);
});

test("evidence must belong to an approved cycle domain", () => {
  const cycle = createLearningCycle({ domains: ["ai-models"] });
  assert.throws(() => cycle.recordEvidence({ title: "x", summary: "y", domain: "video", url: "https://example.com" }), /not allowed/);
});

test("gaps can reference only existing evidence indexes", () => {
  const cycle = createLearningCycle({ domains: ["research"] });
  assert.throws(() => cycle.assessGap({ id: "gap-one", description: "Need sources", nextStep: "Search sources", evidenceRefs: [0] }), /existing evidence indexes/);
  cycle.recordEvidence({ title: "Paper", summary: "Published study", domain: "research", url: "https://example.com/paper" });
  assert.equal(cycle.assessGap({ id: "gap-one", description: "Need second source", nextStep: "Find independent confirmation", evidenceRefs: [0] }).accepted, true);
});

test("improvement proposals cannot authorize Live mutation or unrestricted access", () => {
  const cycle = createLearningCycle({ domains: ["software-security"] });
  const result = cycle.proposeImprovement({ id: "add-test", action: "propose-change", description: "Add a regression test", rationale: "A gap was found", requiresUserApproval: false });
  assert.equal(result.proposal.requiresUserApproval, true);
  assert.equal(result.proposal.liveMutationAllowed, false);
  assert.equal(result.proposal.externalAccessAllowed, false);
  assert.throws(() => cycle.proposeImprovement({ id: "unsafe", action: "deploy-live", description: "Deploy", rationale: "Fast" }), /unsupported/);
});

test("cycle caps evidence and prevents reopening completed cycles", () => {
  const cycle = createLearningCycle({ domains: ["ai-models"], maxEvidence: 1 });
  cycle.recordEvidence({ title: "One", summary: "First", domain: "ai-models", url: "https://example.com/one" });
  assert.throws(() => cycle.recordEvidence({ title: "Two", summary: "Second", domain: "ai-models", url: "https://example.com/two" }), /limit reached/);
  cycle.setStatus("complete");
  assert.throws(() => cycle.setStatus("researching"), /immutable/);
});

test("reports are copies and policy forbids secret access and auto-deployment", () => {
  const cycle = createLearningCycle({ domains: ["ai-models"] });
  const report = cycle.getCycleReport();
  report.domains.push("video");
  assert.equal(cycle.getCycleReport().domains.includes("video"), false);
  assert.equal(learningPolicy.secretAccess, "forbidden");
  assert.equal(learningPolicy.deployment, "reviewed-pr-only");
});
