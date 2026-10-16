/** Add an explicit long-form output target without changing normal reply limits. */
export function appendOutputLengthRequirement(contextText, requestedWords) {
  let context = String(contextText || "").trim();
  const words = Math.max(0, Math.min(20000, Number(requestedWords) || 0));
  if (words) context += "\n\nOUTPUT LENGTH REQUIREMENT: Aim for approximately " + words + " words. Continue fully with coherent structure; do not summarize early or claim completion if cut off.";
  return context;
}
