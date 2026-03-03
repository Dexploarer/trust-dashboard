/**
 * Type definitions for the elizaOS ecosystem repository graph.
 * Nodes = repositories, Links = relationships between repos.
 * Sub-nodes (contributors) are added dynamically on click.
 *
 * SQL schema equivalent is documented below each interface.
 */

// ─── Layer / Category ────────────────────────────────────────────────────────

export type RepoLayer = 0 | 1 | 2 | 3 | 4 | 5;

export type RepoCategory =
  | "core"
  | "spec"
  | "official"
  | "starter"
  | "tool"
  | "agent"
  | "integration"
  | "community"
  | "peripheral";

export type LinkType =
  | "dependency"   // imports @elizaos/core
  | "foundation"   // layer-1 spec → core
  | "registry"     // listed in official plugin registry
  | "tool-family"  // sibling tools built by the same team (agentXxx libs)
  | "starter-chain"; // starter forks/extends another starter

// ─── Repo-level Scoring ───────────────────────────────────────────────────────
/**
 * SQL:
 * CREATE TABLE repo_scores (
 *   id              SERIAL PRIMARY KEY,
 *   repo_id         TEXT    NOT NULL REFERENCES repos(slug),
 *   scored_at       TIMESTAMPTZ DEFAULT NOW(),
 *   activity_score      FLOAT NOT NULL,   -- 0-100: recency × PR velocity
 *   contributor_health  FLOAT NOT NULL,   -- 0-100: active contributor spread
 *   adoption_score      FLOAT NOT NULL,   -- 0-100: stars/forks growth
 *   eliza_effect_density FLOAT NOT NULL,  -- 0-100: avg elizaEffect of contributors
 *   overall             FLOAT NOT NULL    -- composite of the four factors
 * );
 */
export interface RepoScore {
  activityScore: number;        // 0–100  recency + PR velocity
  contributorHealth: number;    // 0–100  active contributors, spread
  adoptionScore: number;        // 0–100  stars/forks growth (log-scaled)
  elizaEffectDensity: number;   // 0–100  avg elizaEffect of this repo's contributors
  overall: number;              // weighted composite
}

// ─── Contributor Sub-node ─────────────────────────────────────────────────────
/**
 * SQL:
 * CREATE TABLE repo_contributors (
 *   repo_slug    TEXT  NOT NULL REFERENCES repos(slug),
 *   username     TEXT  NOT NULL,
 *   pr_count     INT   NOT NULL DEFAULT 0,
 *   trust_score  FLOAT,
 *   eliza_effect FLOAT,
 *   PRIMARY KEY (repo_slug, username)
 * );
 */
export interface ContributorSubNode {
  id: string;           // "@username" — prefixed to avoid ID clash with repo nodes
  username: string;
  prCount: number;
  trustScore: number | null;
  elizaEffect: number | null;
  // The repo this sub-node belongs to (used to collapse when parent is clicked again)
  parentRepoId: string;
}

// ─── Graph Node ───────────────────────────────────────────────────────────────
/**
 * SQL:
 * CREATE TABLE repos (
 *   slug         TEXT  PRIMARY KEY,
 *   full_name    TEXT  NOT NULL,
 *   description  TEXT,
 *   url          TEXT  NOT NULL,
 *   stars        INT   NOT NULL DEFAULT 0,
 *   forks        INT   NOT NULL DEFAULT 0,
 *   language     TEXT,
 *   layer        SMALLINT NOT NULL CHECK (layer BETWEEN 0 AND 5),
 *   category     TEXT  NOT NULL,
 *   eps          FLOAT NOT NULL,
 *   has_core_depend BOOLEAN DEFAULT FALSE,
 *   is_in_registry  BOOLEAN DEFAULT FALSE,
 *   updated_at   TIMESTAMPTZ,
 *   created_at   TIMESTAMPTZ
 * );
 */
export interface RepoGraphNode {
  // Core identity
  id: string;           // "elizaOS/eliza"
  slug: string;         // "eliza"
  label: string;        // short display name
  fullName: string;
  description: string;
  url: string;

  // GitHub metrics
  stars: number;
  forks: number;
  language: string | null;
  updatedAt: string;

  // Classification
  layer: RepoLayer;
  category: RepoCategory;
  eps: number;          // Ecosystem Proximity Score [0,100]

  // Integration flags
  hasCoreDepend: boolean;
  isInRegistry: boolean;

  // Scoring
  repoScore: RepoScore;

  // Top contributors (loaded for sub-node expansion; max 6)
  topContributors: ContributorSubNode[];

  // Force-graph runtime fields (mutated by the simulation)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;  // pinned X (set after drag)
  fy?: number | null;  // pinned Y
}

export type GraphNode = RepoGraphNode | ContributorSubNode;

// ─── Graph Link ───────────────────────────────────────────────────────────────
/**
 * SQL:
 * CREATE TABLE repo_links (
 *   id       SERIAL PRIMARY KEY,
 *   source   TEXT  NOT NULL REFERENCES repos(slug),
 *   target   TEXT  NOT NULL REFERENCES repos(slug),
 *   type     TEXT  NOT NULL,
 *   weight   FLOAT NOT NULL DEFAULT 0.5,
 *   UNIQUE (source, target, type)
 * );
 */
export interface GraphLink {
  source: string;    // repo id (elizaOS/eliza)
  target: string;    // repo id
  type: LinkType;
  weight: number;    // 0–1 → visual thickness
}

// Contributor sub-node links (created at runtime when a node is expanded)
export interface ContributorLink {
  source: string;    // "@username"
  target: string;    // "elizaOS/eliza"
  type: "contributor";
  weight: number;
}

export type AnyLink = GraphLink | ContributorLink;

// ─── Root Graph Data ──────────────────────────────────────────────────────────
/**
 * The shape of src/data/ecosystem-graph.json
 */
export interface EcosystemGraphData {
  generatedAt: string;
  nodeCount: number;
  linkCount: number;
  nodes: RepoGraphNode[];
  links: GraphLink[];
}

// ─── Colour Maps (runtime constants) ─────────────────────────────────────────

export const LAYER_COLORS: Record<RepoLayer, string> = {
  0: "#F59E0B",   // core   — gold
  1: "#A855F7",   // spec   — purple
  2: "#3B82F6",   // official — blue
  3: "#06B6D4",   // tools  — cyan
  4: "#22C55E",   // community — green
  5: "#6B7280",   // peripheral — gray
};

export const CATEGORY_COLORS: Record<RepoCategory, string> = {
  core:        "#F59E0B",
  spec:        "#A855F7",
  official:    "#3B82F6",
  starter:     "#60A5FA",
  tool:        "#06B6D4",
  agent:       "#22C55E",
  integration: "#F97316",
  community:   "#EC4899",
  peripheral:  "#6B7280",
};

export const LINK_COLORS: Record<LinkType | "contributor", string> = {
  dependency:    "#3B82F6",
  foundation:    "#A855F7",
  registry:      "#F97316",
  "tool-family": "#06B6D4",
  "starter-chain":"#60A5FA",
  contributor:   "#6B7280",
};

export const LAYER_LABELS: Record<RepoLayer, string> = {
  0: "Core",
  1: "Foundational",
  2: "Official",
  3: "Tools",
  4: "Community",
  5: "Peripheral",
};
