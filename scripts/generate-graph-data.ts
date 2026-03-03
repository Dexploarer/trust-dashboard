#!/usr/bin/env bun
/**
 * Generates src/data/ecosystem-graph.json
 *
 * Run modes:
 *   bun run scripts/generate-graph-data.ts          -- static mode (no API)
 *   GITHUB_TOKEN=ghp_... bun run scripts/generate-graph-data.ts -- full mode
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeRepoScore, repoElizaEffectDensity } from "../src/lib/repo-scoring";
import type {
  RepoGraphNode,
  GraphLink,
  EcosystemGraphData,
  RepoLayer,
  RepoCategory,
  LinkType,
} from "../src/lib/ecosystem-graph-types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN = process.env.GITHUB_TOKEN;

// ─── Static Repo Classifications ──────────────────────────────────────────────

interface RepoDef {
  slug: string;
  fullName: string;
  description: string;
  stars: number;
  forks: number;
  language: string | null;
  updatedAt: string;
  layer: RepoLayer;
  category: RepoCategory;
  eps: number;
  hasCoreDepend: boolean;
  isInRegistry: boolean;
}

const REPO_DEFS: RepoDef[] = [
  // Layer 0
  { slug:"eliza",              fullName:"elizaOS/eliza",              description:"Autonomous agents for everyone",                                    stars:17676,forks:5445, language:"TypeScript",updatedAt:"2026-03-03T00:00:00Z",layer:0,category:"core",       eps:100,hasCoreDepend:false,isInRegistry:false },
  // Layer 1
  { slug:"characterfile",      fullName:"elizaOS/characterfile",      description:"A simple file format for character data",                           stars:386,  forks:145,  language:"JavaScript", updatedAt:"2026-02-26T00:00:00Z",layer:1,category:"spec",       eps:81, hasCoreDepend:false,isInRegistry:false },
  { slug:"plugin-specification",fullName:"elizaOS/plugin-specification",description:"Plugin specification for the elizaOS ecosystem",                  stars:1,    forks:2,    language:"TypeScript", updatedAt:"2025-05-30T00:00:00Z",layer:1,category:"spec",       eps:72, hasCoreDepend:false,isInRegistry:false },
  // Layer 2
  { slug:"agentbrowser",       fullName:"elizaOS/agentbrowser",       description:"A browser for your agent.",                                         stars:24,   forks:11,   language:"TypeScript", updatedAt:"2026-03-02T00:00:00Z",layer:2,category:"tool",       eps:74, hasCoreDepend:true, isInRegistry:true  },
  { slug:"eliza-starter",      fullName:"elizaOS/eliza-starter",      description:"Starter template for building elizaOS agents",                      stars:371,  forks:579,  language:"TypeScript", updatedAt:"2026-02-23T00:00:00Z",layer:2,category:"starter",    eps:73, hasCoreDepend:true, isInRegistry:false },
  { slug:"spartan",            fullName:"elizaOS/spartan",            description:"Your quant — autonomous trading agent",                             stars:83,   forks:33,   language:"TypeScript", updatedAt:"2026-03-02T00:00:00Z",layer:2,category:"agent",      eps:73, hasCoreDepend:true, isInRegistry:false },
  { slug:"mcp-gateway",        fullName:"elizaOS/mcp-gateway",        description:"Model Context Protocol gateway for elizaOS agents",                 stars:12,   forks:6,    language:"TypeScript", updatedAt:"2026-02-12T00:00:00Z",layer:2,category:"integration",eps:73, hasCoreDepend:true, isInRegistry:true  },
  { slug:"the-org",            fullName:"elizaOS/the-org",            description:"Agents for organizations — multi-agent orchestration",               stars:52,   forks:21,   language:"TypeScript", updatedAt:"2026-02-14T00:00:00Z",layer:2,category:"agent",      eps:72, hasCoreDepend:true, isInRegistry:false },
  { slug:"SWEagent",           fullName:"elizaOS/SWEagent",           description:"Autonomous software engineering agent built in TypeScript",          stars:22,   forks:5,    language:"TypeScript", updatedAt:"2026-03-01T00:00:00Z",layer:2,category:"agent",      eps:70, hasCoreDepend:true, isInRegistry:false },
  { slug:"registry",           fullName:"elizaOS/registry",           description:"elizaOS Plugin Registry — 150+ community plugins",                  stars:20,   forks:28,   language:"TypeScript", updatedAt:"2026-03-02T00:00:00Z",layer:2,category:"official",   eps:69, hasCoreDepend:false,isInRegistry:false },
  { slug:"knowledge",          fullName:"elizaOS/knowledge",          description:"Ecosystem news, GitHub updates, RAG knowledge base",                 stars:65,   forks:20,   language:null,         updatedAt:"2026-03-03T00:00:00Z",layer:2,category:"official",   eps:64, hasCoreDepend:false,isInRegistry:false },
  { slug:"discord-summarizer", fullName:"elizaOS/discord-summarizer", description:"Use LLMs to summarize discord channels",                            stars:90,   forks:19,   language:"Python",     updatedAt:"2026-02-27T00:00:00Z",layer:2,category:"tool",       eps:63, hasCoreDepend:false,isInRegistry:false },
  { slug:"elizaos.github.io",  fullName:"elizaOS/elizaos.github.io",  description:"Leaderboard of Eliza Contributors",                                 stars:102,  forks:48,   language:"TypeScript", updatedAt:"2026-02-24T00:00:00Z",layer:2,category:"official",   eps:63, hasCoreDepend:false,isInRegistry:false },
  // Layer 3
  { slug:"openclaw-adapter",   fullName:"elizaOS/openclaw-adapter",   description:"Run Eliza plugins inside OpenClaw",                                 stars:37,   forks:7,    language:"TypeScript", updatedAt:"2026-02-23T00:00:00Z",layer:3,category:"integration",eps:57, hasCoreDepend:true, isInRegistry:true  },
  { slug:"eliza-nextjs-starter",fullName:"elizaOS/eliza-nextjs-starter",description:"Eliza v2 Document Chat Demo Built on Next.js",                   stars:32,   forks:22,   language:"TypeScript", updatedAt:"2026-02-14T00:00:00Z",layer:3,category:"starter",    eps:53, hasCoreDepend:true, isInRegistry:false },
  { slug:"eliza-plugin-starter",fullName:"elizaOS/eliza-plugin-starter",description:"A starter plugin repo for the Solana hackathon",                 stars:38,   forks:47,   language:"TypeScript", updatedAt:"2026-01-25T00:00:00Z",layer:3,category:"starter",    eps:53, hasCoreDepend:true, isInRegistry:false },
  { slug:"LiveVideoChat",      fullName:"elizaOS/LiveVideoChat",      description:"Live video chat agent powered by elizaOS",                          stars:75,   forks:28,   language:"TypeScript", updatedAt:"2026-01-21T00:00:00Z",layer:3,category:"agent",      eps:53, hasCoreDepend:true, isInRegistry:false },
  { slug:"prr",                fullName:"elizaOS/prr",                description:"sits on your PR and won't get up until it's ready",                stars:5,    forks:1,    language:"TypeScript", updatedAt:"2026-02-28T00:00:00Z",layer:3,category:"tool",       eps:53, hasCoreDepend:true, isInRegistry:false },
  { slug:"autonomous-starter", fullName:"elizaOS/autonomous-starter", description:"Starter project for an autonomous agent built on Eliza",            stars:26,   forks:5,    language:"TypeScript", updatedAt:"2026-01-27T00:00:00Z",layer:3,category:"starter",    eps:52, hasCoreDepend:true, isInRegistry:false },
  { slug:"agentmemory",        fullName:"elizaOS/agentmemory",        description:"Easy-to-use agent memory, powered by chromadb and postgres",        stars:231,  forks:60,   language:"Python",     updatedAt:"2026-02-15T00:00:00Z",layer:3,category:"tool",       eps:50, hasCoreDepend:false,isInRegistry:false },
  { slug:"agentloop",          fullName:"elizaOS/agentloop",          description:"A simple, lightweight loop for your agent",                         stars:14,   forks:8,    language:"Python",     updatedAt:"2026-01-27T00:00:00Z",layer:3,category:"tool",       eps:45, hasCoreDepend:false,isInRegistry:false },
  { slug:"agentlogger",        fullName:"elizaOS/agentlogger",        description:"Simple, colorful terminal logs and logfiles",                       stars:10,   forks:7,    language:"Python",     updatedAt:"2026-01-27T00:00:00Z",layer:3,category:"tool",       eps:45, hasCoreDepend:false,isInRegistry:false },
  { slug:"agentagenda",        fullName:"elizaOS/agentagenda",        description:"A task manager for your agent",                                     stars:22,   forks:8,    language:"Python",     updatedAt:"2026-01-27T00:00:00Z",layer:3,category:"tool",       eps:45, hasCoreDepend:false,isInRegistry:false },
  { slug:"easycompletion",     fullName:"elizaOS/easycompletion",     description:"Easy OpenAI text completion and function calling",                  stars:18,   forks:10,   language:"Python",     updatedAt:"2025-11-19T00:00:00Z",layer:3,category:"tool",       eps:42, hasCoreDepend:false,isInRegistry:false },
  { slug:"agentshell",         fullName:"elizaOS/agentshell",         description:"A shell for your agent",                                            stars:17,   forks:9,    language:"Python",     updatedAt:"2025-10-06T00:00:00Z",layer:3,category:"tool",       eps:41, hasCoreDepend:false,isInRegistry:false },
  { slug:"agentcomms",         fullName:"elizaOS/agentcomms",         description:"Connectors for your agent",                                         stars:18,   forks:10,   language:"Python",     updatedAt:"2025-04-04T00:00:00Z",layer:3,category:"tool",       eps:41, hasCoreDepend:false,isInRegistry:false },
  // Layer 4
  { slug:"otaku",              fullName:"elizaOS/otaku",              description:"Autonomous DeFi trading and research agent",                        stars:27,   forks:17,   language:"TypeScript", updatedAt:"2026-02-26T00:00:00Z",layer:4,category:"agent",      eps:38, hasCoreDepend:true, isInRegistry:false },
  { slug:"otc-agent",          fullName:"elizaOS/otc-agent",          description:"OTC trading agent built on elizaOS",                                stars:8,    forks:2,    language:"TypeScript", updatedAt:"2026-03-02T00:00:00Z",layer:4,category:"agent",      eps:38, hasCoreDepend:true, isInRegistry:false },
  { slug:"elizas-world",       fullName:"elizaOS/elizas-world",       description:"Witness the swarm awaken",                                          stars:37,   forks:22,   language:"TypeScript", updatedAt:"2025-12-07T00:00:00Z",layer:4,category:"agent",      eps:37, hasCoreDepend:true, isInRegistry:false },
  { slug:"eliza-3d-hyperfy-starter",fullName:"elizaOS/eliza-3d-hyperfy-starter",description:"Eliza 3D agent project with Hyperfy plugin",             stars:41,   forks:13,   language:"TypeScript", updatedAt:"2025-12-20T00:00:00Z",layer:4,category:"starter",    eps:34, hasCoreDepend:true, isInRegistry:false },
  { slug:"awesome-eliza",      fullName:"elizaOS/awesome-eliza",      description:"A curated list of awesome things related to eliza framework",       stars:93,   forks:20,   language:null,         updatedAt:"2026-02-10T00:00:00Z",layer:4,category:"community",  eps:30, hasCoreDepend:false,isInRegistry:false },
  { slug:"elizas-list",        fullName:"elizaOS/elizas-list",        description:"Add Your Project to ElizasList!",                                   stars:8,    forks:5,    language:null,         updatedAt:"2026-01-27T00:00:00Z",layer:4,category:"community",  eps:29, hasCoreDepend:false,isInRegistry:false },
  { slug:"plugins-automation", fullName:"elizaOS/plugins-automation", description:"Automation scripts to manage the 150+ plugins",                     stars:7,    forks:2,    language:"TypeScript", updatedAt:"2026-01-25T00:00:00Z",layer:4,category:"tool",       eps:29, hasCoreDepend:false,isInRegistry:false },
  { slug:"aum-tracker",        fullName:"elizaOS/aum-tracker",        description:"Assets Under Management tracker for elizaOS ecosystem",             stars:12,   forks:3,    language:"TypeScript", updatedAt:"2025-12-16T00:00:00Z",layer:4,category:"tool",       eps:28, hasCoreDepend:false,isInRegistry:false },
  { slug:"workgroups",         fullName:"elizaOS/workgroups",         description:"Dedicated to workgroups helping accelerate the Eliza ecosystem",    stars:10,   forks:5,    language:null,         updatedAt:"2026-01-27T00:00:00Z",layer:4,category:"community",  eps:28, hasCoreDepend:false,isInRegistry:false },
  { slug:"examples",           fullName:"elizaOS/examples",           description:"Examples of how to use elizaOS",                                    stars:4,    forks:0,    language:"TypeScript", updatedAt:"2026-02-25T00:00:00Z",layer:4,category:"community",  eps:27, hasCoreDepend:false,isInRegistry:false },
  { slug:"classified",         fullName:"elizaOS/classified",         description:"Nothing to see here",                                               stars:22,   forks:12,   language:"TypeScript", updatedAt:"2026-01-30T00:00:00Z",layer:4,category:"community",  eps:26, hasCoreDepend:false,isInRegistry:false },
  { slug:"benchmarks",         fullName:"elizaOS/benchmarks",         description:"Benchmark suite for elizaOS agents",                                stars:5,    forks:0,    language:"TypeScript", updatedAt:"2026-02-10T00:00:00Z",layer:4,category:"tool",       eps:26, hasCoreDepend:false,isInRegistry:false },
  { slug:"trust_scoreboard",   fullName:"elizaOS/trust_scoreboard",   description:"Trust scoreboard for the elizaOS community",                        stars:11,   forks:9,    language:"TypeScript", updatedAt:"2025-08-07T00:00:00Z",layer:4,category:"tool",       eps:25, hasCoreDepend:false,isInRegistry:false },
  // Layer 5
  { slug:"website",            fullName:"elizaOS/website",            description:"elizaOS marketing website",                                         stars:18,   forks:19,   language:"TypeScript", updatedAt:"2026-02-22T00:00:00Z",layer:5,category:"peripheral", eps:15, hasCoreDepend:false,isInRegistry:false },
  { slug:"brandkit",           fullName:"elizaOS/brandkit",           description:"Assets, logos, and designs for the elizaOS brand",                  stars:19,   forks:7,    language:null,         updatedAt:"2026-01-25T00:00:00Z",layer:5,category:"peripheral", eps:15, hasCoreDepend:false,isInRegistry:false },
  { slug:"x402.elizaos.ai",   fullName:"elizaOS/x402.elizaos.ai",   description:"Dynamic x402 routing with intelligent content negotiation",          stars:2,    forks:3,    language:"TypeScript", updatedAt:"2026-02-02T00:00:00Z",layer:5,category:"integration",eps:15, hasCoreDepend:false,isInRegistry:false },
  { slug:"characters",         fullName:"elizaOS/characters",         description:"Some character files you can use with elizaOS",                     stars:45,   forks:35,   language:null,         updatedAt:"2026-01-14T00:00:00Z",layer:5,category:"peripheral", eps:13, hasCoreDepend:false,isInRegistry:false },
  { slug:"docs",               fullName:"elizaOS/docs",               description:"elizaOS documentation",                                            stars:4,    forks:4,    language:null,         updatedAt:"2026-01-25T00:00:00Z",layer:5,category:"peripheral", eps:12, hasCoreDepend:false,isInRegistry:false },
  { slug:"LJSpeechTools",      fullName:"elizaOS/LJSpeechTools",      description:"Tools for making LJSpeech datasets",                               stars:26,   forks:12,   language:"Python",     updatedAt:"2026-01-13T00:00:00Z",layer:5,category:"tool",       eps:12, hasCoreDepend:false,isInRegistry:false },
  { slug:"eliza-2004scape",    fullName:"elizaOS/eliza-2004scape",    description:"Eliza plays Runescape",                                            stars:0,    forks:0,    language:"JavaScript", updatedAt:"2026-02-07T00:00:00Z",layer:5,category:"community",  eps:12, hasCoreDepend:false,isInRegistry:false },
  { slug:"roadmap",            fullName:"elizaOS/roadmap",            description:"elizaOS project roadmap",                                          stars:15,   forks:1,    language:null,         updatedAt:"2026-01-14T00:00:00Z",layer:5,category:"peripheral", eps:10, hasCoreDepend:false,isInRegistry:false },
  { slug:"hats",               fullName:"elizaOS/hats",               description:"Hats Protocol integration",                                        stars:3,    forks:1,    language:"TypeScript", updatedAt:"2025-04-04T00:00:00Z",layer:5,category:"integration",eps:10, hasCoreDepend:false,isInRegistry:false },
  { slug:"hat",                fullName:"elizaOS/hat",                description:"Add a cool hat to your image",                                     stars:3,    forks:1,    language:"Python",     updatedAt:"2025-12-07T00:00:00Z",layer:5,category:"peripheral", eps:11, hasCoreDepend:false,isInRegistry:false },
  { slug:"discrub-ext",        fullName:"elizaOS/discrub-ext",        description:"Message manipulation and export tool for Discord",                  stars:3,    forks:3,    language:"JavaScript", updatedAt:"2025-04-04T00:00:00Z",layer:5,category:"tool",       eps:11, hasCoreDepend:false,isInRegistry:false },
  { slug:"autofun-idl",        fullName:"elizaOS/autofun-idl",        description:"IDLs for auto.fun",                                                stars:4,    forks:3,    language:"TypeScript", updatedAt:"2025-05-05T00:00:00Z",layer:5,category:"peripheral", eps:11, hasCoreDepend:false,isInRegistry:false },
  { slug:"mobile",             fullName:"elizaOS/mobile",             description:"ElizaOS Cloud app with privy react native starter",                stars:1,    forks:0,    language:"TypeScript", updatedAt:"2025-12-09T00:00:00Z",layer:5,category:"peripheral", eps:9,  hasCoreDepend:false,isInRegistry:false },
  { slug:"sandbox-template-cloud",fullName:"elizaOS/sandbox-template-cloud",description:"Template repo for Eliza Cloud Apps built in Sandbox",       stars:3,    forks:0,    language:"TypeScript", updatedAt:"2025-12-12T00:00:00Z",layer:5,category:"starter",    eps:9,  hasCoreDepend:false,isInRegistry:false },
  { slug:".cursor",            fullName:"elizaOS/.cursor",            description:"Cursor rules and config for ElizaOS development",                  stars:13,   forks:2,    language:null,         updatedAt:"2025-10-05T00:00:00Z",layer:5,category:"peripheral", eps:9,  hasCoreDepend:false,isInRegistry:false },
  { slug:"character-migrator", fullName:"elizaOS/character-migrator", description:"Migrate character files between elizaOS versions",                 stars:1,    forks:0,    language:"TypeScript", updatedAt:"2025-11-27T00:00:00Z",layer:5,category:"tool",       eps:9,  hasCoreDepend:false,isInRegistry:false },
  { slug:"eliza-avatars",      fullName:"elizaOS/eliza-avatars",      description:"Avatar assets for elizaOS agents",                                 stars:0,    forks:1,    language:null,         updatedAt:"2025-08-04T00:00:00Z",layer:5,category:"peripheral", eps:8,  hasCoreDepend:false,isInRegistry:false },
  { slug:"vercel-api",         fullName:"elizaOS/vercel-api",         description:"Next.js Vercel API routes for elizaOS integrations",               stars:1,    forks:0,    language:"TypeScript", updatedAt:"2025-06-11T00:00:00Z",layer:5,category:"peripheral", eps:8,  hasCoreDepend:false,isInRegistry:false },
];

// ─── Link Definitions ─────────────────────────────────────────────────────────

function buildLinks(repos: RepoDef[]): GraphLink[] {
  const links: GraphLink[] = [];
  const coreId = "elizaOS/eliza";
  const registryId = "elizaOS/registry";
  const starterBaseId = "elizaOS/eliza-starter";

  // Sibling groups
  const toolFamilySlugs = new Set(["agentloop","agentlogger","agentshell","agentcomms","agentagenda","easycompletion","agentbrowser","agentmemory"]);
  const tradingAgentSlugs = new Set(["spartan","otaku","otc-agent"]);

  for (const repo of repos) {
    const id = repo.fullName;
    if (id === coreId) continue;

    // Spec / foundational → core
    if (repo.layer === 1) {
      links.push({ source: id, target: coreId, type: "foundation", weight: 0.9 });
    }

    // @elizaos/core dependency → core
    if (repo.hasCoreDepend && repo.layer > 1) {
      links.push({ source: id, target: coreId, type: "dependency", weight: 0.6 });
    }

    // Registry listing → registry node
    if (repo.isInRegistry && id !== registryId) {
      links.push({ source: id, target: registryId, type: "registry", weight: 0.4 });
    }

    // Tool family siblings → connect to agentbrowser as hub
    if (toolFamilySlugs.has(repo.slug) && repo.slug !== "agentbrowser") {
      links.push({ source: id, target: "elizaOS/agentbrowser", type: "tool-family", weight: 0.3 });
    }

    // Trading agents → spartan as hub
    if (tradingAgentSlugs.has(repo.slug) && repo.slug !== "spartan") {
      links.push({ source: id, target: "elizaOS/spartan", type: "tool-family", weight: 0.35 });
    }

    // Starter chain: all starters → eliza-starter as parent
    if (repo.category === "starter" && repo.slug !== "eliza-starter" && repo.layer >= 3) {
      links.push({ source: id, target: starterBaseId, type: "starter-chain", weight: 0.3 });
    }
  }

  return links;
}

// ─── GitHub API (optional) ────────────────────────────────────────────────────

async function fetchContributors(fullName: string, maxPages = 2): Promise<string[]> {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "milady-trust-dashboard",
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  };
  const usernames: string[] = [];
  for (let page = 1; page <= maxPages; page++) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${fullName}/contributors?per_page=10&page=${page}`,
        { headers },
      );
      if (!res.ok) break;
      const data = (await res.json()) as Array<{ login: string; contributions: number }>;
      usernames.push(...data.map((c) => c.login));
      if (data.length < 10) break;
      await new Promise((r) => setTimeout(r, 150));
    } catch {
      break;
    }
  }
  return usernames;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const mode = TOKEN ? "full (GitHub API)" : "static (no API)";
  console.log(`Generating ecosystem graph in ${mode} mode…`);

  // Build elizaEffect lookup from combined-leaderboard.json (if available)
  const elizaEffectByUser = new Map<string, number>();
  try {
    const raw = await import("../src/data/combined-leaderboard.json", { assert: { type: "json" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const effect = (raw as any)?.elizaEffectLeaderboard?.entries ?? [];
    for (const entry of effect) {
      if (entry.username && typeof entry.elizaEffect === "number") {
        elizaEffectByUser.set(entry.username.toLowerCase(), entry.elizaEffect);
      }
    }
    console.log(`  Loaded ${elizaEffectByUser.size} elizaEffect scores`);
  } catch {
    console.log("  No combined-leaderboard.json found — elizaEffectDensity = 0");
  }

  const nodes: RepoGraphNode[] = [];

  for (const def of REPO_DEFS) {
    let topContributors: RepoGraphNode["topContributors"] = [];
    let elizaEffectDensity = 0;

    if (TOKEN) {
      const contributors = await fetchContributors(def.fullName);
      elizaEffectDensity = repoElizaEffectDensity(contributors, elizaEffectByUser);
      topContributors = contributors.slice(0, 6).map((username) => ({
        id: `@${username}`,
        username,
        prCount: 0, // contributor count; real PR count needs per-repo issue API
        trustScore: null,
        elizaEffect: elizaEffectByUser.get(username.toLowerCase()) ?? null,
        parentRepoId: def.fullName,
      }));
      await new Promise((r) => setTimeout(r, 200));
    }

    const repoScore = computeRepoScore({
      eps: def.eps,
      stars: def.stars,
      forks: def.forks,
      updatedAt: def.updatedAt,
      layer: def.layer,
      elizaEffectDensity,
    });

    nodes.push({
      id: def.fullName,
      slug: def.slug,
      label: def.slug.replace(/^\./, ""),
      fullName: def.fullName,
      description: def.description,
      url: `https://github.com/${def.fullName}`,
      stars: def.stars,
      forks: def.forks,
      language: def.language,
      updatedAt: def.updatedAt,
      layer: def.layer,
      category: def.category,
      eps: def.eps,
      hasCoreDepend: def.hasCoreDepend,
      isInRegistry: def.isInRegistry,
      repoScore,
      topContributors,
    });

    console.log(`  ✓ ${def.slug.padEnd(28)} EPS ${String(def.eps).padStart(3)}  score ${repoScore.overall}`);
  }

  const links = buildLinks(REPO_DEFS);

  const output: EcosystemGraphData = {
    generatedAt: new Date().toISOString(),
    nodeCount: nodes.length,
    linkCount: links.length,
    nodes,
    links,
  };

  const outPath = join(__dirname, "../src/data/ecosystem-graph.json");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ ${nodes.length} nodes, ${links.length} links → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
