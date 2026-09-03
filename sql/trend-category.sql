-- Identical schema in each of the 10 category databases.
-- Applied by scripts/provision-trend-dbs.mjs after CREATE DATABASE.

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  ingested_at TIMESTAMPTZ NOT NULL,
  plugged TEXT,
  topic_count INT NOT NULL,
  source_updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS words (
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  label TEXT NOT NULL,
  velocity TEXT NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  divergence DOUBLE PRECISION NOT NULL,
  receipt_count INT NOT NULL,
  first_platform TEXT,
  first_at TIMESTAMPTZ,
  driver_weight DOUBLE PRECISION,
  PRIMARY KEY (snapshot_id, topic_id)
);

CREATE INDEX IF NOT EXISTS words_topic_idx ON words (topic_id, snapshot_id);

CREATE TABLE IF NOT EXISTS sentiments (
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  lean TEXT NOT NULL,
  pos INT NOT NULL,
  neg INT NOT NULL,
  risk INT NOT NULL,
  n INT NOT NULL,
  thin BOOLEAN NOT NULL,
  PRIMARY KEY (snapshot_id, topic_id)
);

CREATE TABLE IF NOT EXISTS artifacts (
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  mentions INT NOT NULL,
  platforms TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (snapshot_id, topic_id, kind, value)
);

CREATE TABLE IF NOT EXISTS receipts (
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  platform TEXT NOT NULL,
  score INT NOT NULL,
  created_at TIMESTAMPTZ,
  source_api TEXT,
  tool TEXT,
  collected_at TIMESTAMPTZ,
  PRIMARY KEY (snapshot_id, topic_id, url)
);
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS source_api TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS tool TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  leaf_id TEXT NOT NULL,
  leaf_kind TEXT NOT NULL,
  outlook TEXT NOT NULL,
  sentiment_lean TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  analysis TEXT NOT NULL,
  evidence TEXT NOT NULL,
  thin BOOLEAN NOT NULL,
  predicted_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS predictions_leaf_idx ON predictions (leaf_id, predicted_at DESC);
