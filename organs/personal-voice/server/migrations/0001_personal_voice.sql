PRAGMA foreign_keys = ON;

-- SQLite/D1 migration for owner-private personal voices.
-- AUTOINCREMENT prevents deleted profile IDs/serials from being reissued.
CREATE TABLE IF NOT EXISTS personal_voice_serials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS personal_voice_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL,
  serial_id INTEGER NOT NULL UNIQUE REFERENCES personal_voice_serials(id),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
  language TEXT NOT NULL DEFAULT 'bn-BD',
  provider_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','active','revoked','deleted')),
  consent_voice_use INTEGER NOT NULL DEFAULT 0 CHECK(consent_voice_use IN (0,1)),
  consent_sample_storage INTEGER NOT NULL DEFAULT 0 CHECK(consent_sample_storage IN (0,1)),
  consent_model_training INTEGER NOT NULL DEFAULT 0 CHECK(consent_model_training IN (0,1)),
  sample_object_key TEXT,
  sample_mime_type TEXT,
  sample_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT,
  UNIQUE(owner_id, id)
);

CREATE INDEX IF NOT EXISTS personal_voice_profiles_owner_status
  ON personal_voice_profiles(owner_id, status, id);

CREATE TABLE IF NOT EXISTS personal_voice_preferences (
  owner_id TEXT PRIMARY KEY,
  default_profile_id INTEGER,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(owner_id, default_profile_id)
    REFERENCES personal_voice_profiles(owner_id, id)
);

-- Catalog metadata is intentionally separate from private user profiles.
CREATE TABLE IF NOT EXISTS personal_voice_catalog (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  language TEXT NOT NULL,
  style TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  provider_voice_id TEXT NOT NULL,
  preview_url TEXT,
  license_status TEXT NOT NULL CHECK(license_status IN ('verified','restricted','unknown')),
  consent_status TEXT NOT NULL CHECK(consent_status IN ('documented','required','unknown')),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1))
);

CREATE TRIGGER IF NOT EXISTS personal_voice_profiles_no_serial_change
BEFORE UPDATE OF serial_id ON personal_voice_profiles
BEGIN
  SELECT RAISE(ABORT, 'voice_serial_immutable');
END;

CREATE TRIGGER IF NOT EXISTS personal_voice_profiles_no_owner_change
BEFORE UPDATE OF owner_id ON personal_voice_profiles
BEGIN
  SELECT RAISE(ABORT, 'voice_profile_owner_immutable');
END;
