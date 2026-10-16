export function buildPersonalizedUserPrompt(text, targetWords, body, buildPrompt, formatMemory, formatStyle) {
  const lengthText = targetWords
    ? text + "\n\nOUTPUT LENGTH REQUIREMENT: Aim for approximately " + targetWords + " words. Continue the requested story or text in full, with coherent structure and no premature summary. Do not claim the target was met if output is cut off."
    : text;
  const memory = formatMemory(body.memory_context);
  const style = formatStyle(body.memory_response_style);
  return buildPrompt(lengthText + (memory ? "\n\n" + memory : "") + (style ? "\n\n" + style : ""));
}
