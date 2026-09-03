-- Watchlist lives on hawkxai_all. One demo owner until real auth.
CREATE TABLE IF NOT EXISTS watchlist (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL DEFAULT 'demo',
  label TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS watchlist_owner_idx ON watchlist (owner);

-- Public × POI overlap snapshots (one row per matched receipt).
CREATE TABLE IF NOT EXISTS poi_overlap (
  entity_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  host TEXT NOT NULL DEFAULT '',
  official BOOLEAN NOT NULL DEFAULT false,
  collected_at TIMESTAMPTZ,
  PRIMARY KEY (entity_id, snapshot_id, url)
);
CREATE INDEX IF NOT EXISTS poi_overlap_entity_idx ON poi_overlap (entity_id);

-- Latest L1/L2 scores per entity.
CREATE TABLE IF NOT EXISTS poi_scores (
  entity_id TEXT PRIMARY KEY,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  receipt_count INT NOT NULL,
  official_count INT NOT NULL,
  occupied_count INT NOT NULL,
  organic REAL NOT NULL,
  occupancy REAL NOT NULL,
  outlook TEXT NOT NULL,
  confidence REAL NOT NULL,
  thin BOOLEAN NOT NULL,
  delta INT NOT NULL DEFAULT 0,
  baseline_ratio REAL NOT NULL DEFAULT 0,
  snapshot_count INT NOT NULL DEFAULT 0,
  rank_score REAL NOT NULL DEFAULT 0,
  window_counts INT[] NOT NULL DEFAULT '{}'
);
ALTER TABLE poi_scores ADD COLUMN IF NOT EXISTS window_counts INT[] NOT NULL DEFAULT '{}';
ALTER TABLE poi_overlap ADD COLUMN IF NOT EXISTS qr_payload TEXT;
CREATE TABLE IF NOT EXISTS poi_labels (
  entity_id TEXT NOT NULL,
  url TEXT NOT NULL,
  tag TEXT NOT NULL CHECK (tag IN ('official','occupied','ignore')),
  PRIMARY KEY (entity_id, url)
);
CREATE TABLE IF NOT EXISTS poi_labels (
  entity_id TEXT NOT NULL,
  url TEXT NOT NULL,
  tag TEXT NOT NULL CHECK (tag IN ('official','occupied','ignore')),
  PRIMARY KEY (entity_id, url)
);
CREATE TABLE IF NOT EXISTS poi_models (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  samples INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Starred trend prints + measured snapshots. Survives a cold start when TREND_DB_* is set.
CREATE TABLE IF NOT EXISTS tape_watch (
  owner TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Durable Insights roots: Wikipedia first revision, patents, Wikidata inception.
CREATE TABLE IF NOT EXISTS insight_roots (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  sense TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS insight_roots_query_idx ON insight_roots (query);

