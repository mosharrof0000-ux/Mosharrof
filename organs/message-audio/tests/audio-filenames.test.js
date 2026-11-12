import test from "node:test";
import assert from "node:assert/strict";
import { addMp3Metadata, createAudioTitle, sanitizeAudioFilenameTitle } from "../components/audio-metadata.js";

test("uses the full short message as the title and safe Bengali filename", () => {
  assert.equal(createAudioTitle("আপনি কেমন আছেন?"), "আপনি কেমন আছেন?");
  assert.equal(sanitizeAudioFilenameTitle("আপনি কেমন আছেন?"), "আপনি_কেমন_আছেন");
});

test("uses the first meaningful sentence or a bounded excerpt for long messages", () => {
  assert.equal(createAudioTitle("প্রথম বাক্যটি এখানে। " + "দ্বিতীয় বাক্যটি অনেক বড় এবং এতে আরও অনেক কথা বলা হয়েছে যাতে মোট লেখাটি বাহাত্তর অক্ষরের সীমা ছাড়িয়ে যায়।"), "প্রথম বাক্যটি এখানে।");
  assert.ok(Array.from(createAudioTitle("বাংলা শব্দ ".repeat(30))).length <= 72);
});

test("embeds UTF-8 Title and MOSHARROF Artist metadata in MP3 audio", async () => {
  const tagged = await addMp3Metadata(new Blob(["abc"], { type: "audio/mpeg" }), "আপনি কেমন আছেন?");
  const bytes = new Uint8Array(await tagged.arrayBuffer());
  assert.equal(String.fromCharCode(...bytes.subarray(0, 3)), "ID3");
  const metadata = new TextDecoder().decode(bytes);
  assert.ok(metadata.includes("আপনি কেমন আছেন?"));
  assert.ok(metadata.includes("MOSHARROF"));
  assert.equal(tagged.type, "audio/mpeg");
});

test("does not alter non-MP3 formats", async () => {
  const original = new Blob(["wav"], { type: "audio/wav" });
  const result = await addMp3Metadata(original, "পরীক্ষা");
  assert.equal(result, original);
});

test("removes filename-reserved characters without damaging Bengali text", () => {
  assert.equal(sanitizeAudioFilenameTitle("আপনি/কেমন:আছেন?"), "আপনি_কেমন_আছেন");
});
