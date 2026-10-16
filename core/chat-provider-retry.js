/** Retry a streamed chat request until an answer or a non-retryable client result is returned. */
export async function runChatUntilAnswer(run, report, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  let retry = 0, waitMs = 1000;
  while (true) {
    let result;
    try {
      result = await run(event => { if (report) report(event); });
    } catch {
      result = { status: 502, data: { error: "chat_stream_failed", message: "Transient chat failure; retrying." } };
    }
    if (result.status < 500) return result;
    retry++;
    if (report) report({ stage: "failed", provider: "সব AI সার্ভার", model: "সব ব্যর্থ; পুনরায় চেষ্টা " + retry });
    await sleep(waitMs);
    waitMs = Math.min(30000, waitMs * 2);
  }
}

export async function withChatProviderTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + "_timeout")), ms); })]);
  } finally { if (timer) clearTimeout(timer); }
}
