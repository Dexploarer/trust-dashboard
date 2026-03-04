/**
 * Visual profiles for the 3D universe — one per repo slug.
 * Each profile defines the material appearance and orbital mechanics
 * of a planet in the elizaOS solar system.
 */

import type { RepoGraphNode } from "./ecosystem-graph-types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanetProfile {
  // Surface material
  color: string;
  emissive: string;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
  // Atmosphere (outer glow sphere)
  atmosphereColor: string;
  atmosphereOpacity: number;
  atmosphereScale: number; // 1.08 = 8% larger than planet
  // Ring system
  hasRings: boolean;
  ringColor: string;
  ringOpacity: number;
  // Motion
  rotationSpeed: number; // axial spin rad/s
  axialTilt: number; // radians
  // Material variant: gas giants use MeshDistortMaterial
  isGas: boolean;
  distortScale: number;
  distortSpeed: number;
}

export interface OrbitData {
  radius: number;
  speed: number; // rad/s
  inclination: number; // angle from ecliptic (radians)
  ascNode: number; // longitude of ascending node (radians)
  initialAngle: number; // starting mean anomaly
}

// ─── Orbit computation ────────────────────────────────────────────────────────

const BASE_RADII = [0, 13, 25, 40, 57, 74];
const BASE_SPEEDS = [0, 0.009, 0.0055, 0.0032, 0.0018, 0.0011];
const MAX_INCLINATIONS = [0, 0.14, 0.26, 0.4, 0.54, 0.68];

export function computeOrbit(
  layer: number,
  index: number,
  total: number,
): OrbitData {
  const baseR = BASE_RADII[layer] ?? 74;
  // Stagger radii within band to avoid crowding
  const radius = baseR + (index % 4) * 2.8 + Math.floor(index / 4) * 1.5;
  // Slight speed variation per planet (inner moves a bit faster)
  const speed = (BASE_SPEEDS[layer] ?? 0.001) * (1 + (index % 3) * 0.07);
  // Deterministic inclination using alternating sign + magnitude
  const maxInc = MAX_INCLINATIONS[layer] ?? 0.68;
  const sign = index % 2 === 0 ? 1 : -1;
  const inclination = sign * ((index % 5) / 5) * maxInc;
  // Golden-angle distribution of ascending nodes — spreads orbits in 3D
  const ascNode = (index * 137.508 * (Math.PI / 180)) % (Math.PI * 2);
  // Evenly distribute starting angles
  const initialAngle = (index / total) * Math.PI * 2;
  return { radius, speed, inclination, ascNode, initialAngle };
}

// ─── Profile base ─────────────────────────────────────────────────────────────

const BASE_PROFILE: PlanetProfile = {
  color: "#3B82F6",
  emissive: "#000000",
  emissiveIntensity: 0,
  roughness: 0.8,
  metalness: 0,
  atmosphereColor: "#3B82F6",
  atmosphereOpacity: 0.15,
  atmosphereScale: 1.08,
  hasRings: false,
  ringColor: "#888888",
  ringOpacity: 0.5,
  rotationSpeed: 0.2,
  axialTilt: 0.4,
  isGas: false,
  distortScale: 0,
  distortSpeed: 0,
};

// ─── Per-slug profiles (keyed by repo slug, not full name) ─────────────────

const SLUG_PROFILES: Record<string, Partial<PlanetProfile>> = {
  // ── L1 · Inner rocky planets ────────────────────────────────────────────
  characterfile: {
    // Character/personality → Earth-like, lush, alive with story
    color: "#2D6A4F",
    emissive: "#1B4332",
    emissiveIntensity: 0.12,
    roughness: 0.85,
    metalness: 0,
    atmosphereColor: "#52B788",
    atmosphereOpacity: 0.38,
    atmosphereScale: 1.11,
    rotationSpeed: 0.25,
    axialTilt: 0.41,
  },
  "plugin-specification": {
    // Technical spec → Blueprint world, metallic, grid-like precision
    color: "#1E3A5F",
    emissive: "#0047CC",
    emissiveIntensity: 0.4,
    roughness: 0.12,
    metalness: 0.78,
    atmosphereColor: "#0080FF",
    atmosphereOpacity: 0.42,
    atmosphereScale: 1.09,
    hasRings: true,
    ringColor: "#3B82F6",
    ringOpacity: 0.35,
    rotationSpeed: 0.14,
    axialTilt: 0.1,
  },

  // ── L2 · Official zone ───────────────────────────────────────────────────
  spartan: {
    // Warrior agent → Mars-red, battle-scarred, volcanic
    color: "#7F1D1D",
    emissive: "#B91C1C",
    emissiveIntensity: 0.5,
    roughness: 0.95,
    metalness: 0,
    atmosphereColor: "#EF4444",
    atmosphereOpacity: 0.32,
    atmosphereScale: 1.07,
    rotationSpeed: 0.36,
    axialTilt: 0.44,
  },
  agentbrowser: {
    // Web browser → Teal ocean world, smooth, navigable
    color: "#0E7490",
    emissive: "#0891B2",
    emissiveIntensity: 0.22,
    roughness: 0.04,
    metalness: 0.12,
    atmosphereColor: "#67E8F9",
    atmosphereOpacity: 0.52,
    atmosphereScale: 1.14,
    rotationSpeed: 0.3,
    axialTilt: 0.28,
  },
  "eliza-starter": {
    // Starter → Young proto-planet, still forming, volcanic orange
    color: "#C2410C",
    emissive: "#EA580C",
    emissiveIntensity: 0.58,
    roughness: 0.95,
    metalness: 0,
    atmosphereColor: "#FB923C",
    atmosphereOpacity: 0.46,
    atmosphereScale: 1.11,
    rotationSpeed: 0.4,
    axialTilt: 0.52,
  },
  "mcp-gateway": {
    // Gateway/portal → Purple swirling vortex, inter-dimensional
    color: "#4C1D95",
    emissive: "#7C3AED",
    emissiveIntensity: 0.75,
    roughness: 0.1,
    metalness: 0.2,
    atmosphereColor: "#A78BFA",
    atmosphereOpacity: 0.62,
    atmosphereScale: 1.18,
    hasRings: true,
    ringColor: "#8B5CF6",
    ringOpacity: 0.45,
    isGas: true,
    distortScale: 0.28,
    distortSpeed: 3,
    rotationSpeed: 0.22,
    axialTilt: 0.82,
  },
  "the-org": {
    // Organization → Corporate Saturn, structured rings, gray authority
    color: "#1F2937",
    emissive: "#4B5563",
    emissiveIntensity: 0.1,
    roughness: 0.28,
    metalness: 0.55,
    atmosphereColor: "#9CA3AF",
    atmosphereOpacity: 0.2,
    atmosphereScale: 1.08,
    hasRings: true,
    ringColor: "#6B7280",
    ringOpacity: 0.65,
    isGas: true,
    distortScale: 0.1,
    distortSpeed: 1,
    rotationSpeed: 0.14,
    axialTilt: 0.46,
  },
  SWEagent: {
    // Software engineering → Terminal green, code matrix, metallic
    color: "#052E16",
    emissive: "#16A34A",
    emissiveIntensity: 0.7,
    roughness: 0.32,
    metalness: 0.68,
    atmosphereColor: "#4ADE80",
    atmosphereOpacity: 0.52,
    atmosphereScale: 1.11,
    rotationSpeed: 0.26,
    axialTilt: 0.18,
  },
  registry: {
    // Plugin registry → Orange marketplace hub, ringed (satellites/plugins)
    color: "#9A3412",
    emissive: "#EA580C",
    emissiveIntensity: 0.38,
    roughness: 0.58,
    metalness: 0.22,
    atmosphereColor: "#FB923C",
    atmosphereOpacity: 0.32,
    atmosphereScale: 1.1,
    hasRings: true,
    ringColor: "#F97316",
    ringOpacity: 0.52,
    rotationSpeed: 0.2,
    axialTilt: 0.34,
  },
  knowledge: {
    // Knowledge base → Warm amber library world, dense and scholarly
    color: "#78350F",
    emissive: "#B45309",
    emissiveIntensity: 0.28,
    roughness: 0.82,
    metalness: 0.05,
    atmosphereColor: "#FCD34D",
    atmosphereOpacity: 0.26,
    atmosphereScale: 1.09,
    rotationSpeed: 0.18,
    axialTilt: 0.56,
  },
  "discord-summarizer": {
    // Discord → Blurple gas giant, social storm bands
    color: "#3730A3",
    emissive: "#5865F2",
    emissiveIntensity: 0.52,
    roughness: 0.1,
    metalness: 0.04,
    atmosphereColor: "#818CF8",
    atmosphereOpacity: 0.58,
    atmosphereScale: 1.14,
    isGas: true,
    distortScale: 0.22,
    distortSpeed: 2.2,
    rotationSpeed: 0.3,
    axialTilt: 0.18,
  },
  "elizaos.github.io": {
    // Website → Clean white/slate minimal, polished chrome
    color: "#8EA8C3",
    emissive: "#CBD5E1",
    emissiveIntensity: 0.18,
    roughness: 0.04,
    metalness: 0.38,
    atmosphereColor: "#F1F5F9",
    atmosphereOpacity: 0.26,
    atmosphereScale: 1.08,
    rotationSpeed: 0.22,
    axialTilt: 0.02,
  },

  // ── L3 · Tools & agents ────────────────────────────────────────────────
  agentmemory: {
    // Memory → Deep indigo, vast and profound, neural glow
    color: "#1E1B4B",
    emissive: "#4338CA",
    emissiveIntensity: 0.58,
    roughness: 0.28,
    metalness: 0.42,
    atmosphereColor: "#818CF8",
    atmosphereOpacity: 0.52,
    atmosphereScale: 1.14,
    rotationSpeed: 0.2,
    axialTilt: 0.62,
  },
  "eliza-nextjs-starter": {
    // Next.js → Sleek black/chrome tech planet, white trim glow
    color: "#111111",
    emissive: "#E2E8F0",
    emissiveIntensity: 0.22,
    roughness: 0.04,
    metalness: 0.88,
    atmosphereColor: "#F8FAFC",
    atmosphereOpacity: 0.32,
    atmosphereScale: 1.09,
    rotationSpeed: 0.3,
    axialTilt: 0.08,
  },
  LiveVideoChat: {
    // Live video/broadcast → Pulsing red recording world
    color: "#7F1D1D",
    emissive: "#DC2626",
    emissiveIntensity: 0.78,
    roughness: 0.48,
    metalness: 0.1,
    atmosphereColor: "#FCA5A5",
    atmosphereOpacity: 0.52,
    atmosphereScale: 1.12,
    rotationSpeed: 0.42,
    axialTilt: 0.32,
  },
  "autonomous-starter": {
    // Autonomous agents → Self-directed cyan world, AI-blue
    color: "#164E63",
    emissive: "#0E7490",
    emissiveIntensity: 0.42,
    roughness: 0.48,
    metalness: 0.22,
    atmosphereColor: "#67E8F9",
    atmosphereOpacity: 0.42,
    atmosphereScale: 1.11,
    rotationSpeed: 0.28,
    axialTilt: 0.46,
  },
  agentloop: {
    // Loop/iteration → Spinning blue, infinite cycle energy
    color: "#0C4A6E",
    emissive: "#0369A1",
    emissiveIntensity: 0.42,
    roughness: 0.38,
    metalness: 0.52,
    atmosphereColor: "#38BDF8",
    atmosphereOpacity: 0.38,
    atmosphereScale: 1.09,
    rotationSpeed: 0.45,
    axialTilt: 0.25,
  },
  agentlogger: {
    // Logger → Dark blue data-stream world
    color: "#075985",
    emissive: "#0284C7",
    emissiveIntensity: 0.38,
    roughness: 0.44,
    metalness: 0.46,
    atmosphereColor: "#38BDF8",
    atmosphereOpacity: 0.32,
    atmosphereScale: 1.08,
    rotationSpeed: 0.28,
    axialTilt: 0.3,
  },
  agentagenda: {
    // Agenda/scheduler → Royal blue, organized, structured
    color: "#1D4ED8",
    emissive: "#3B82F6",
    emissiveIntensity: 0.32,
    roughness: 0.5,
    metalness: 0.3,
    atmosphereColor: "#93C5FD",
    atmosphereOpacity: 0.3,
    atmosphereScale: 1.08,
    rotationSpeed: 0.24,
    axialTilt: 0.4,
  },
  agentshell: {
    // Shell/terminal → Dark metallic with green terminal glow
    color: "#1A1A2E",
    emissive: "#10B981",
    emissiveIntensity: 0.55,
    roughness: 0.62,
    metalness: 0.72,
    atmosphereColor: "#34D399",
    atmosphereOpacity: 0.42,
    atmosphereScale: 1.1,
    rotationSpeed: 0.34,
    axialTilt: 0.18,
  },
  agentcomms: {
    // Communications → Sky-blue signal world, broadcasting
    color: "#0F3460",
    emissive: "#0EA5E9",
    emissiveIntensity: 0.42,
    roughness: 0.38,
    metalness: 0.52,
    atmosphereColor: "#7DD3FC",
    atmosphereOpacity: 0.38,
    atmosphereScale: 1.09,
    rotationSpeed: 0.3,
    axialTilt: 0.36,
  },
  easycompletion: {
    // Completion → Green lush, easy growth, organic
    color: "#14532D",
    emissive: "#22C55E",
    emissiveIntensity: 0.32,
    roughness: 0.62,
    metalness: 0.18,
    atmosphereColor: "#86EFAC",
    atmosphereOpacity: 0.3,
    atmosphereScale: 1.08,
    rotationSpeed: 0.22,
    axialTilt: 0.14,
  },
  "openclaw-adapter": {
    // Adapter/bridge → Teal-olive, connector world
    color: "#134E4A",
    emissive: "#0F766E",
    emissiveIntensity: 0.32,
    roughness: 0.72,
    metalness: 0.26,
    atmosphereColor: "#5EEAD4",
    atmosphereOpacity: 0.3,
    atmosphereScale: 1.08,
    rotationSpeed: 0.2,
    axialTilt: 0.62,
  },
  prr: {
    // Pull-request reviewer → Amber review world
    color: "#713F12",
    emissive: "#D97706",
    emissiveIntensity: 0.35,
    roughness: 0.75,
    metalness: 0.1,
    atmosphereColor: "#FDE68A",
    atmosphereOpacity: 0.28,
    atmosphereScale: 1.07,
    rotationSpeed: 0.25,
    axialTilt: 0.3,
  },
  "eliza-plugin-starter": {
    // Plugin starter → Cyan-teal, gateway to plugin ecosystem
    color: "#0F766E",
    emissive: "#14B8A6",
    emissiveIntensity: 0.35,
    roughness: 0.65,
    metalness: 0.2,
    atmosphereColor: "#5EEAD4",
    atmosphereOpacity: 0.35,
    atmosphereScale: 1.09,
    rotationSpeed: 0.28,
    axialTilt: 0.45,
  },

  // ── L4 · Community ──────────────────────────────────────────────────────
  "elizas-world": {
    // Eliza's world → Vibrant pink fantasy world
    color: "#831843",
    emissive: "#EC4899",
    emissiveIntensity: 0.52,
    roughness: 0.48,
    metalness: 0.1,
    atmosphereColor: "#F9A8D4",
    atmosphereOpacity: 0.48,
    atmosphereScale: 1.12,
    rotationSpeed: 0.42,
    axialTilt: 0.72,
  },
  "eliza-3d-hyperfy-starter": {
    // 3D/Hyperfy → Neon purple game world, most vibrant L4 planet
    color: "#1A1A2E",
    emissive: "#9333EA",
    emissiveIntensity: 0.78,
    roughness: 0.18,
    metalness: 0.5,
    atmosphereColor: "#C084FC",
    atmosphereOpacity: 0.65,
    atmosphereScale: 1.18,
    isGas: true,
    distortScale: 0.38,
    distortSpeed: 4.5,
    rotationSpeed: 0.52,
    axialTilt: 0.95,
  },
  "awesome-eliza": {
    // Awesome list → Indigo knowledge collection
    color: "#1E1B4B",
    emissive: "#6D28D9",
    emissiveIntensity: 0.32,
    roughness: 0.7,
    metalness: 0.1,
    atmosphereColor: "#A78BFA",
    atmosphereOpacity: 0.32,
    atmosphereScale: 1.09,
    rotationSpeed: 0.26,
    axialTilt: 0.42,
  },
  otaku: {
    // Otaku/anime → Pink-coral, cultural flavor
    color: "#9D174D",
    emissive: "#EC4899",
    emissiveIntensity: 0.4,
    roughness: 0.6,
    metalness: 0.05,
    atmosphereColor: "#FBCFE8",
    atmosphereOpacity: 0.38,
    atmosphereScale: 1.1,
    rotationSpeed: 0.35,
    axialTilt: 0.6,
  },
};

// ─── Layer fallback defaults ─────────────────────────────────────────────────

const LAYER_FALLBACKS: Record<number, Partial<PlanetProfile>> = {
  1: {
    color: "#7E22CE",
    emissive: "#9333EA",
    emissiveIntensity: 0.2,
    roughness: 0.8,
    metalness: 0.1,
    atmosphereColor: "#A855F7",
    atmosphereOpacity: 0.25,
    atmosphereScale: 1.08,
  },
  2: {
    color: "#1D4ED8",
    emissive: "#3B82F6",
    emissiveIntensity: 0.15,
    roughness: 0.7,
    metalness: 0.1,
    atmosphereColor: "#60A5FA",
    atmosphereOpacity: 0.2,
    atmosphereScale: 1.07,
  },
  3: {
    color: "#0E7490",
    emissive: "#06B6D4",
    emissiveIntensity: 0.2,
    roughness: 0.65,
    metalness: 0.15,
    atmosphereColor: "#67E8F9",
    atmosphereOpacity: 0.2,
    atmosphereScale: 1.06,
  },
  4: {
    color: "#166534",
    emissive: "#22C55E",
    emissiveIntensity: 0.1,
    roughness: 0.85,
    metalness: 0,
    atmosphereColor: "#86EFAC",
    atmosphereOpacity: 0.1,
    atmosphereScale: 1.05,
  },
  5: {
    color: "#374151",
    emissive: "#4B5563",
    emissiveIntensity: 0,
    roughness: 0.96,
    metalness: 0,
    atmosphereColor: "#6B7280",
    atmosphereOpacity: 0,
    atmosphereScale: 1.03,
  },
};

// ─── Public API ──────────────────────────────────────────────────────────────

export function getPlanetProfile(node: RepoGraphNode): PlanetProfile {
  const slugProfile = SLUG_PROFILES[node.slug] ?? {};
  const layerFallback = LAYER_FALLBACKS[node.layer] ?? {};
  return { ...BASE_PROFILE, ...layerFallback, ...slugProfile };
}

/** Size of the planet sphere (radius). Log-scaled by stars. */
export function planetSize(node: RepoGraphNode): number {
  if (node.layer === 5) return Math.max(0.12, Math.min(0.3, 0.12 + Math.sqrt(node.stars) / 120));
  if (node.layer === 4) return Math.max(0.3, Math.min(0.6, 0.3 + Math.sqrt(node.stars) / 160));
  return Math.max(0.5, Math.min(1.4, 0.5 + Math.sqrt(node.stars) / 155));
}
