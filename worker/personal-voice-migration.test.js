import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../supabase/migrations/20261113000000_personal_voice.sql", import.meta.url), "utf8");

test("personal voice migration creates a private encrypted sample bucket with owner RLS", () => {
  assert.match(sql, /insert into storage\.buckets[\s\S]*?public\s*=\s*false/i);
  assert.match(sql, /personal voice sample owner read[\s\S]*?bucket_id\s*=\s*'personal-voice-samples'[\s\S]*?auth\.uid\(\)/i);
  assert.match(sql, /personal voice sample owner insert[\s\S]*?auth\.uid\(\)/i);
  assert.match(sql, /personal voice sample owner delete[\s\S]*?auth\.uid\(\)/i);
});

test("profile and catalog serials use one non-cycling database sequence", () => {
  assert.match(sql, /create sequence if not exists public\.personal_voice_serial_seq start 1 increment 1 no cycle/i);
  assert.equal((sql.match(/execute function public\.personal_voice_assign_serial\(\)/g) || []).length, 2);
  assert.match(sql, /voice_serial bigint not null unique/i);
});

test("synthesis quota is enforced by an authenticated atomic RPC", () => {
  assert.match(sql, /personal_voice_consume_synthesis_quota/);
  assert.match(sql, /request_count < 10/);
  assert.match(sql, /grant execute on function public\.personal_voice_consume_synthesis_quota\(\) to authenticated/i);
});

test("model training consent defaults off and is independent from voice use", () => {
  assert.match(sql, /consent_model_training boolean not null default false/i);
  assert.match(sql, /consent_voice_use boolean not null default false/i);
  assert.match(sql, /consent_sample_storage boolean not null default false/i);
});

test("default profile references cannot cross owner boundaries", () => {
  assert.match(sql, /personal_voice_preferences_default_profile_owner_fk/);
  assert.match(sql, /foreign key \(owner_id, default_profile_id\)[\s\S]*?references public\.personal_voice_profiles\(owner_id, id\)/i);
  assert.match(sql, /sample_object_key like owner_id::text \|\| '\/%'/i);
});

test("replacement samples retain a retryable owner-scoped previous object pointer", () => {
  assert.match(sql, /previous_sample_object_key text/);
  assert.match(sql, /previous_sample_object_key is null or previous_sample_object_key like owner_id::text/);
  assert.match(sql, /previous_sample_object_key is null or consent_sample_storage or status = 'revoked'/);
});

test("reference transcripts are stored only as bounded ciphertext", () => {
  assert.match(sql, /reference_text_ciphertext text/);
  assert.match(sql, /char_length\(reference_text_ciphertext\) <= 4096/);
  assert.doesNotMatch(sql, /reference_text text check/);
});

test("active profiles require voice-use and sample-storage consent", () => {
  assert.match(sql, /status <> 'active' or \(sample_object_key is not null and consent_voice_use and consent_sample_storage\)/i);
  assert.match(sql, /sample_object_key is not null or \(reference_text_ciphertext is null and sample_mime_type is null and sample_bytes is null\)/i);
});
