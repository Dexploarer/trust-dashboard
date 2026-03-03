-- ============================================================
-- Trust Dashboard — Ecosystem Graph Database Schema
-- PostgreSQL 15+
-- ============================================================
--
-- This schema is the future backend for the ecosystem graph.
-- Currently the dashboard is static (JSON committed to git).
-- These tables define the normalized form of that data.
-- ============================================================

-- ─── Extensions ─────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- fast LIKE / similarity search

-- ─── Repositories ────────────────────────────────────────────

CREATE TABLE repos (
  -- Identity
  slug         TEXT        PRIMARY KEY,                  -- e.g. "eliza"
  full_name    TEXT        NOT NULL UNIQUE,              -- e.g. "elizaOS/eliza"
  description  TEXT,
  url          TEXT        NOT NULL,

  -- GitHub metrics (refreshed periodically)
  stars        INT         NOT NULL DEFAULT 0,
  forks        INT         NOT NULL DEFAULT 0,
  open_issues  INT         NOT NULL DEFAULT 0,
  language     TEXT,
  default_branch TEXT      NOT NULL DEFAULT 'main',
  updated_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ,

  -- Ecosystem classification
  layer        SMALLINT    NOT NULL CHECK (layer BETWEEN 0 AND 5),
  category     TEXT        NOT NULL CHECK (category IN (
                             'core','spec','official','starter',
                             'tool','agent','integration','community','peripheral'
                           )),

  -- Proximity score [0,100]
  eps          FLOAT       NOT NULL DEFAULT 0,

  -- Integration flags
  has_core_depend BOOLEAN  NOT NULL DEFAULT FALSE,
  is_in_registry  BOOLEAN  NOT NULL DEFAULT FALSE,

  -- Fork lineage
  forked_from  TEXT        REFERENCES repos(slug),

  -- Metadata
  topics       TEXT[]      NOT NULL DEFAULT '{}',

  CONSTRAINT repos_slug_format CHECK (slug ~ '^[a-zA-Z0-9._-]+$')
);

CREATE INDEX repos_layer_idx     ON repos (layer);
CREATE INDEX repos_category_idx  ON repos (category);
CREATE INDEX repos_eps_idx       ON repos (eps DESC);
CREATE INDEX repos_stars_idx     ON repos (stars DESC);
CREATE INDEX repos_updated_idx   ON repos (updated_at DESC);

-- ─── EPS Breakdown ───────────────────────────────────────────

CREATE TABLE eps_breakdown (
  repo_slug         TEXT        PRIMARY KEY REFERENCES repos(slug) ON DELETE CASCADE,
  layer_base        FLOAT       NOT NULL,
  activity_score    FLOAT       NOT NULL,
  integration_bonus FLOAT       NOT NULL,
  recency_bonus     FLOAT       NOT NULL,
  relationship_bonus FLOAT      NOT NULL,
  total             FLOAT       NOT NULL,
  scored_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Repository Scores ───────────────────────────────────────
-- Time-series table — one row per scoring run.

CREATE TABLE repo_scores (
  id                  BIGSERIAL   PRIMARY KEY,
  repo_slug           TEXT        NOT NULL REFERENCES repos(slug) ON DELETE CASCADE,
  scored_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Component scores [0,100]
  activity_score      FLOAT       NOT NULL,   -- recency × PR velocity proxy
  contributor_health  FLOAT       NOT NULL,   -- fork:star ratio + volume
  adoption_score      FLOAT       NOT NULL,   -- log-scaled stars + forks
  eliza_effect_density FLOAT      NOT NULL,   -- avg elizaEffect of top contributors

  -- Composite (weighted sum)
  overall             FLOAT       NOT NULL,

  -- Weights used at scoring time (stored for auditability)
  weight_activity     FLOAT       NOT NULL DEFAULT 0.30,
  weight_health       FLOAT       NOT NULL DEFAULT 0.25,
  weight_adoption     FLOAT       NOT NULL DEFAULT 0.25,
  weight_eliza_effect FLOAT       NOT NULL DEFAULT 0.20
);

CREATE INDEX repo_scores_repo_idx ON repo_scores (repo_slug, scored_at DESC);

-- Latest score view
CREATE VIEW repo_scores_latest AS
  SELECT DISTINCT ON (repo_slug) *
  FROM   repo_scores
  ORDER  BY repo_slug, scored_at DESC;

-- ─── Repository Links (edges) ─────────────────────────────────

CREATE TABLE repo_links (
  id       BIGSERIAL   PRIMARY KEY,
  source   TEXT        NOT NULL REFERENCES repos(slug) ON DELETE CASCADE,
  target   TEXT        NOT NULL REFERENCES repos(slug) ON DELETE CASCADE,
  type     TEXT        NOT NULL CHECK (type IN (
                         'dependency','foundation','registry',
                         'tool-family','starter-chain'
                       )),
  weight   FLOAT       NOT NULL DEFAULT 0.5 CHECK (weight BETWEEN 0 AND 1),
  UNIQUE (source, target, type)
);

CREATE INDEX repo_links_source_idx ON repo_links (source);
CREATE INDEX repo_links_target_idx ON repo_links (target);
CREATE INDEX repo_links_type_idx   ON repo_links (type);

-- ─── Contributors ─────────────────────────────────────────────

CREATE TABLE contributors (
  username         TEXT        PRIMARY KEY,          -- GitHub login, lowercase
  avatar_url       TEXT,
  -- Milady-side data
  trust_score      FLOAT,                            -- NULL if not a Milady contributor
  milady_rank      INT,
  milady_tier      TEXT,
  -- Eliza-side data
  eliza_lifetime   FLOAT,
  eliza_rank       INT,
  eliza_percentile FLOAT,
  -- Cross-network composite
  eliza_effect     FLOAT,                            -- 0-100 composite score
  ecosystem_factor FLOAT,                            -- 0-1 raw ecosystem contribution
  -- Metadata
  last_seen_at     TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX contributors_trust_idx  ON contributors (trust_score DESC NULLS LAST);
CREATE INDEX contributors_effect_idx ON contributors (eliza_effect DESC NULLS LAST);

-- ─── Repo ↔ Contributor mapping ───────────────────────────────

CREATE TABLE repo_contributors (
  repo_slug    TEXT    NOT NULL REFERENCES repos(slug) ON DELETE CASCADE,
  username     TEXT    NOT NULL REFERENCES contributors(username) ON DELETE CASCADE,
  pr_count     INT     NOT NULL DEFAULT 0,
  commit_count INT     NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  PRIMARY KEY (repo_slug, username)
);

CREATE INDEX repo_contributors_user_idx ON repo_contributors (username);
CREATE INDEX repo_contributors_prs_idx  ON repo_contributors (repo_slug, pr_count DESC);

-- ─── ElizaEffect Leaderboard snapshot ────────────────────────
-- Denormalised cache updated every 30 minutes by the generation script.

CREATE TABLE eliza_effect_leaderboard (
  id               BIGSERIAL   PRIMARY KEY,
  snapshot_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  username         TEXT        NOT NULL REFERENCES contributors(username),
  rank             INT         NOT NULL,
  eliza_effect     FLOAT       NOT NULL,
  milady_norm      FLOAT,
  eliza_percentile FLOAT,
  ecosystem_norm   FLOAT
);

CREATE INDEX eel_snapshot_idx ON eliza_effect_leaderboard (snapshot_at DESC);
CREATE INDEX eel_rank_idx     ON eliza_effect_leaderboard (snapshot_at DESC, rank ASC);

-- Latest snapshot view
CREATE VIEW eliza_effect_latest AS
  SELECT eel.*
  FROM   eliza_effect_leaderboard eel
  INNER JOIN (
    SELECT MAX(snapshot_at) AS max_at
    FROM   eliza_effect_leaderboard
  ) t ON eel.snapshot_at = t.max_at
  ORDER  BY eel.rank;

-- ─── Tracked Repos config ─────────────────────────────────────

CREATE TABLE tracked_repos (
  owner                    TEXT    NOT NULL,
  repo                     TEXT    NOT NULL,
  label                    TEXT    NOT NULL,
  include_in_ecosystem_factor BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (owner, repo)
);

-- ─── Helper functions ─────────────────────────────────────────

-- Upsert a contributor (idempotent, safe for concurrent runs)
CREATE OR REPLACE FUNCTION upsert_contributor(
  p_username     TEXT,
  p_avatar_url   TEXT,
  p_trust_score  FLOAT,
  p_eliza_effect FLOAT,
  p_eliza_rank   INT
) RETURNS VOID AS $$
  INSERT INTO contributors (username, avatar_url, trust_score, eliza_effect, eliza_rank)
  VALUES (p_username, p_avatar_url, p_trust_score, p_eliza_effect, p_eliza_rank)
  ON CONFLICT (username) DO UPDATE SET
    avatar_url   = EXCLUDED.avatar_url,
    trust_score  = EXCLUDED.trust_score,
    eliza_effect = EXCLUDED.eliza_effect,
    eliza_rank   = EXCLUDED.eliza_rank,
    updated_at   = NOW();
$$ LANGUAGE sql;

-- ─── Row-level security stubs ─────────────────────────────────
-- Enable once service-role vs anon roles are configured.

-- ALTER TABLE repos ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY repos_read_all ON repos FOR SELECT USING (true);
