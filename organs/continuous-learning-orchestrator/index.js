/**
 * Continuous Learning Orchestrator — policy and planning foundation.
 * It deliberately does not fetch the internet, run on a timer, edit files,
 * invoke other organs, or deploy changes. A trusted scheduler/connector can
 * call these APIs later through reviewed, declared contracts.
 */
const MAX_ITEMS = 100;
const MAX_TEXT = 1000;
const MAX_SOURCES = 20;
const SOURCE_SCHEMES = new Set(["https:"]);
const ALLOWED_STATES = new Set(["planned", "researching", "needs-review", "blocked", "complete"]);
const ALLOWED_ACTIONS = new Set(["research", "test", "document", "propose-change", "request-permission"]);
const ALLOWED_DOMAINS = new Set([
  "ai-models", "software-security", "developer-tools", "research",
  "accessibility", "language", "voice", "image", "video", "quran-research",
  "user-experience", "reliability"
]);

function textValue(value, label, max = MAX_TEXT) {
  if (typeof value !== "string") throw new TypeError(label + " must be a string");
  const v = value.trim();
  if (!v || v.length > max) throw new RangeError(label + " must contain 1-" + max + " characters");
  return v;
}
function safeUrl(value) {
  const raw = textValue(value, "source URL", 2048);
  let url;
  try { url = new URL(raw); } catch { throw new TypeError("source URL must be an absolute HTTPS URL"); }
  if (!SOURCE_SCHEMES.has(url.protocol) || url.username || url.password) {
    throw new TypeError("only HTTPS sources without embedded credentials are allowed");
  }
  return url.toString();
}
function safeId(value, label = "id") {
  const id = textValue(value, label, 100).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new TypeError(label + " must be lowercase kebab-case");
  return id;
}
function dateValue(value, label) {
  const parsed = new Date(value);
  if (typeof value !== "string" || !Number.isFinite(parsed.getTime())) throw new TypeError(label + " must be an ISO date");
  return parsed.toISOString();
}

export function createLearningCycle(options = {}) {
  const id = safeId(options.id ?? "learning-cycle");
  const goal = textValue(options.goal ?? "Identify one verifiable improvement opportunity", "goal");
  const domains = [...new Set(options.domains ?? ["ai-models", "software-security"])];
  if (!Array.isArray(options.domains ?? ["ai-models", "software-security"]) ||
      domains.some((d) => !ALLOWED_DOMAINS.has(d))) {
    throw new TypeError("domains must be from the approved learning domain list");
  }
  const createdAt = dateValue(options.createdAt ?? new Date().toISOString(), "createdAt");
  const maxEvidence = options.maxEvidence ?? MAX_SOURCES;
  if (!Number.isInteger(maxEvidence) || maxEvidence < 1 || maxEvidence > MAX_SOURCES) {
    throw new RangeError("maxEvidence must be between 1 and " + MAX_SOURCES);
  }
  const state = { id, goal, domains, createdAt, maxEvidence, evidence: [], gaps: [], proposals: [], status: "planned" };
  return Object.freeze({
    getCycleReport() {
      return JSON.parse(JSON.stringify(state));
    },
    setStatus(next) {
      if (!ALLOWED_STATES.has(next)) throw new TypeError("unsupported cycle status");
      if (state.status === "complete" && next !== "complete") throw new Error("completed cycles are immutable");
      state.status = next;
      return next;
    },
    recordEvidence(input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("evidence must be an object");
      if (state.evidence.length >= state.maxEvidence) throw new RangeError("cycle evidence limit reached");
      const domain = input.domain;
      if (!ALLOWED_DOMAINS.has(domain) || !state.domains.includes(domain)) throw new TypeError("evidence domain is not allowed for this cycle");
      const item = Object.freeze({
        url: safeUrl(input.url),
        title: textValue(input.title, "title", 200),
        summary: textValue(input.summary, "summary", 1200),
        domain,
        publishedAt: input.publishedAt ? dateValue(input.publishedAt, "publishedAt") : null,
        retrievedAt: dateValue(input.retrievedAt ?? new Date().toISOString(), "retrievedAt"),
        reliability: input.reliability ?? "unassessed"
      });
      if (!["high", "medium", "low", "unassessed"].includes(item.reliability)) throw new TypeError("invalid reliability rating");
      state.evidence.push(item);
      return { accepted: true, evidenceCount: state.evidence.length };
    },
    assessGap(input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("gap must be an object");
      if (state.gaps.length >= MAX_ITEMS) throw new RangeError("gap limit reached");
      const item = Object.freeze({
        id: safeId(input.id, "gap id"),
        description: textValue(input.description, "gap description"),
        impact: ["low", "medium", "high", "critical"].includes(input.impact) ? input.impact : "medium",
        evidenceRefs: Array.isArray(input.evidenceRefs) ? [...new Set(input.evidenceRefs.map((n) => {
          if (!Number.isInteger(n) || n < 0 || n >= state.evidence.length) throw new RangeError("evidenceRefs must reference existing evidence indexes");
          return n;
        }))] : [],
        blocker: input.blocker ? textValue(input.blocker, "blocker", 300) : null,
        nextStep: textValue(input.nextStep, "nextStep", 300)
      });
      state.gaps.push(item);
      return { accepted: true, gapCount: state.gaps.length };
    },
    proposeImprovement(input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("proposal must be an object");
      if (state.proposals.length >= MAX_ITEMS) throw new RangeError("proposal limit reached");
      const action = input.action;
      if (!ALLOWED_ACTIONS.has(action)) throw new TypeError("unsupported improvement action");
      const proposal = Object.freeze({
        id: safeId(input.id, "proposal id"),
        action,
        description: textValue(input.description, "proposal description"),
        rationale: textValue(input.rationale, "proposal rationale"),
        requiresUserApproval: action === "propose-change" || action === "request-permission" ? true : input.requiresUserApproval !== false,
        liveMutationAllowed: false,
        externalAccessAllowed: false,
        createdAt: dateValue(input.createdAt ?? new Date().toISOString(), "createdAt")
      });
      state.proposals.push(proposal);
      return { accepted: true, proposal: { ...proposal } };
    }
  });
}

export const learningPolicy = Object.freeze({
  backgroundWork: "scheduler-required",
  networkAccess: "allowlisted-https-connector-required",
  sourceReview: "required",
  crossOrganAccess: "declared-contract-only",
  liveMutation: "forbidden",
  secretAccess: "forbidden",
  paidProviderUse: "explicit-user-consent-required",
  deployment: "reviewed-pr-only",
  unverifiedKnowledge: "must-be-labelled",
  cycleLimits: Object.freeze({ maxEvidence: MAX_SOURCES, maxItems: MAX_ITEMS }),
  allowedDomains: Object.freeze([...ALLOWED_DOMAINS]),
  allowedActions: Object.freeze([...ALLOWED_ACTIONS])
});
