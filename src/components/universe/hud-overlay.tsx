"use client";

/**
 * Universe HUD Overlay — gaming dashboard laid over the 3D canvas.
 *
 * Layout (all position:absolute, canvas shows through):
 *   TopBar     — full width, 38px
 *   LeftPanel  — 230px wide, below top bar
 *   RightPanel — 252px wide, below top bar
 *   BottomBar  — full width, 46px
 *   Minimap    — 160×160 floating above bottom-right
 *   Ticker     — 22px strip above bottom bar
 */

import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import { ExternalLink, X, ChevronRight } from "lucide-react";
import type {
  EcosystemGraphData,
  RepoGraphNode,
} from "@/lib/ecosystem-graph-types";
import { LAYER_COLORS, LAYER_LABELS, CATEGORY_COLORS } from "@/lib/ecosystem-graph-types";
import { computeOrbit, getPlanetProfile } from "@/lib/planet-profiles";

// ── Palette ───────────────────────────────────────────────────────────────────
const C  = "#00DEFF";   // cyan primary
const Cg = "#00FF88";   // green / positive
const Ca = "#FFB800";   // amber / warning
const Cr = "#FF4466";   // red / alert
const BG = "rgba(0, 5, 16, 0.88)";
const BD = "rgba(0, 222, 255, 0.15)";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AggStats {
  totalStars: number;
  totalForks: number;
  avgEPS: number;
  layerCounts: Record<number, number>;
  layerAvgEPS: Record<number, number>;
  categoryCounts: Record<string, number>;
  topByEPS: RepoGraphNode[];
  topByStars: RepoGraphNode[];
  registryCount: number;
  coreDepCount: number;
  langCounts: Record<string, number>;
}

interface HudProps {
  data: EcosystemGraphData;
  selected: RepoGraphNode | null;
  onClose: () => void;
  visibleLayers: Set<number>;
  onLayerToggle: (layer: number) => void;
}

// ── Compute aggregate stats ───────────────────────────────────────────────────
function computeStats(data: EcosystemGraphData): AggStats {
  const nodes = data.nodes;
  const totalStars = nodes.reduce((s, n) => s + n.stars, 0);
  const totalForks = nodes.reduce((s, n) => s + n.forks, 0);
  const avgEPS = Math.round(nodes.reduce((s, n) => s + n.eps, 0) / nodes.length);
  const layerCounts: Record<number, number> = {};
  const layerEPS: Record<number, number[]> = {};
  const categoryCounts: Record<string, number> = {};
  const langCounts: Record<string, number> = {};
  for (const n of nodes) {
    layerCounts[n.layer] = (layerCounts[n.layer] ?? 0) + 1;
    if (!layerEPS[n.layer]) layerEPS[n.layer] = [];
    layerEPS[n.layer].push(n.eps);
    categoryCounts[n.category] = (categoryCounts[n.category] ?? 0) + 1;
    if (n.language) langCounts[n.language] = (langCounts[n.language] ?? 0) + 1;
  }
  const layerAvgEPS: Record<number, number> = {};
  for (const [k, arr] of Object.entries(layerEPS)) {
    layerAvgEPS[Number(k)] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }
  const sorted = [...nodes].sort((a, b) => b.eps - a.eps);
  return {
    totalStars,
    totalForks,
    avgEPS,
    layerCounts,
    layerAvgEPS,
    categoryCounts,
    topByEPS: sorted.slice(0, 10),
    topByStars: [...nodes].sort((a, b) => b.stars - a.stars).slice(0, 6),
    registryCount: nodes.filter((n) => n.isInRegistry).length,
    coreDepCount: nodes.filter((n) => n.hasCoreDepend).length,
    langCounts,
  };
}

// ── Shared micro-components ───────────────────────────────────────────────────

function PanelCorners() {
  const corners = [
    { top: -1, left:  -1, borderTop: `2px solid ${C}`, borderLeft:  `2px solid ${C}` },
    { top: -1, right: -1, borderTop: `2px solid ${C}`, borderRight: `2px solid ${C}` },
    { bottom: -1, left:  -1, borderBottom: `2px solid ${C}`, borderLeft:  `2px solid ${C}` },
    { bottom: -1, right: -1, borderBottom: `2px solid ${C}`, borderRight: `2px solid ${C}` },
  ];
  return (
    <>
      {corners.map((style, i) => (
        <div
          key={i}
          style={{ position: "absolute", width: 10, height: 10, zIndex: 10, ...style }}
        />
      ))}
    </>
  );
}

function PanelHeader({ title, accent }: { title: string; accent?: string }) {
  return (
    <div
      style={{
        padding: "5px 10px",
        borderBottom: `1px solid rgba(0,222,255,0.1)`,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span style={{ color: accent ?? C, fontSize: 8, fontFamily: "monospace", letterSpacing: "0.22em", fontWeight: 700 }}>
        {title}
      </span>
      <div style={{ flex: 1, height: "1px", background: `linear-gradient(to right, ${accent ?? C}44, transparent)` }} />
    </div>
  );
}

function HBar({ value, max, color, height = 3 }: { value: number; max: number; color: string; height?: number }) {
  return (
    <div style={{ flex: 1, height, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
      <div
        style={{
          height: "100%",
          width: `${Math.min(100, (value / max) * 100)}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 2,
          boxShadow: `0 0 6px ${color}66`,
          animation: "hud-progress 0.8s ease-out",
        }}
      />
    </div>
  );
}

function StatusDot({ active = true, color = Cg }: { active?: boolean; color?: string }) {
  return (
    <div
      style={{
        width: 6, height: 6, borderRadius: "50%",
        background: active ? color : "#333",
        boxShadow: active ? `0 0 8px ${color}` : "none",
        animation: active ? "hud-pulse 2s ease-in-out infinite" : "none",
      }}
    />
  );
}

// ── Top Bar ───────────────────────────────────────────────────────────────────
function TopBar({ data, stats }: { data: EcosystemGraphData; stats: AggStats }) {
  const [clock, setClock] = useState(() => new Date().toUTCString().slice(17, 25));
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toUTCString().slice(17, 25)), 1000);
    return () => clearInterval(t);
  }, []);

  const freshness = Math.max(
    0,
    Math.floor((Date.now() - new Date(data.generatedAt).getTime()) / 60000),
  );

  return (
    <div
      style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 38, zIndex: 30,
        background: "rgba(0,4,14,0.92)",
        borderBottom: `1px solid ${BD}`,
        backdropFilter: "blur(20px)",
        display: "flex", alignItems: "center",
        padding: "0 12px",
        gap: 2,
        animation: "hud-flicker 8s ease-in-out infinite",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 16 }}>
        <div style={{ width: 18, height: 18, borderRadius: "50%", background: "radial-gradient(circle at 40% 40%, #FFF8DC, #FF8C00)", boxShadow: `0 0 12px ${Ca}` }} />
        <span style={{ color: C, fontSize: 10, fontFamily: "monospace", letterSpacing: "0.25em", fontWeight: 700 }}>
          elizaOS<span style={{ color: Ca }}>·</span>UNIVERSE
        </span>
      </div>

      <Divider />

      <TopStat label="REPOS" value={String(data.nodeCount)} />
      <TopStat label="STARS" value={`${(stats.totalStars / 1000).toFixed(1)}K`} color={Ca} />
      <TopStat label="FORKS" value={`${(stats.totalForks / 1000).toFixed(1)}K`} />
      <TopStat label="AVG EPS" value={String(stats.avgEPS)} color={Cg} />
      <TopStat label="EDGES" value={String(data.linkCount)} />

      <Divider />

      <TopStat label="REGISTRY" value={String(stats.registryCount)} color={C} />
      <TopStat label="CORE DEPS" value={String(stats.coreDepCount)} />

      <div style={{ flex: 1 }} />

      {/* Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginRight: 12 }}>
        <StatusDot color={Cg} />
        <span style={{ color: Cg, fontSize: 8, fontFamily: "monospace", letterSpacing: "0.15em" }}>LIVE</span>
      </div>

      <Divider />

      <TopStat label="DATA" value={`${freshness}m ago`} color={freshness < 60 ? Cg : Ca} />

      <Divider />

      <span style={{ color: C, fontSize: 9, fontFamily: "monospace", letterSpacing: "0.12em", minWidth: 60 }}>
        {clock} <span style={{ color: "rgba(0,222,255,0.4)" }}>UTC</span>
      </span>

      <Divider />

      <a
        href="/trust-dashboard/ecosystem"
        style={{
          color: "rgba(0,222,255,0.35)",
          fontSize: 8,
          fontFamily: "monospace",
          letterSpacing: "0.15em",
          textDecoration: "none",
          padding: "0 6px",
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = C; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,222,255,0.35)"; }}
      >
        ← ECOSYSTEM
      </a>
    </div>
  );
}

function TopStat({ label, value, color = "rgba(0,222,255,0.7)" }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 10px" }}>
      <span style={{ color: "rgba(0,222,255,0.35)", fontSize: 7, fontFamily: "monospace", letterSpacing: "0.1em" }}>{label}</span>
      <span style={{ color, fontSize: 10, fontFamily: "monospace", fontWeight: 700, lineHeight: 1.2 }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 20, background: "rgba(0,222,255,0.12)", margin: "0 2px" }} />;
}

// ── Radar ─────────────────────────────────────────────────────────────────────
function Radar({ data, stats }: { data: EcosystemGraphData; stats: AggStats }) {
  const SIZE = 110;
  const CX = SIZE / 2;

  const maxR = 58;
  // Scale orbital radii [13,25,40,57,74] → [15,25,34,44,54] to fit
  const scaledR = [15, 25, 33, 42, 52];

  // Compute live planet positions
  const nodesByLayer = useMemo(() => {
    const map = new Map<number, RepoGraphNode[]>();
    for (const n of data.nodes.filter((n) => n.layer > 0)) {
      if (!map.has(n.layer)) map.set(n.layer, []);
      map.get(n.layer)!.push(n);
    }
    return map;
  }, [data]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 200);
    return () => clearInterval(t);
  }, []);

  const now = Date.now() / 1000;

  const planets = useMemo(() => {
    const result: Array<{ x: number; y: number; color: string; size: number; node: RepoGraphNode }> = [];
    for (const [, layerNodes] of nodesByLayer) {
      layerNodes.forEach((node, i) => {
        const orbit = computeOrbit(node.layer, i, layerNodes.length);
        const M = now * orbit.speed + orbit.initialAngle;
        const r = scaledR[node.layer - 1] ?? 52;
        const x = CX + Math.cos(M) * r;
        const y = CX + Math.sin(M) * r * 0.62; // project: squish y for top-down perspective
        const profile = getPlanetProfile(node);
        const size = node.layer <= 1 ? 3 : node.layer <= 3 ? 2 : 1.2;
        result.push({ x, y, color: profile.color, size, node });
      });
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesByLayer, tick]);
  void stats;

  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE, margin: "8px auto" }}>
      {/* Radar rings */}
      <svg width={SIZE} height={SIZE} style={{ position: "absolute", inset: 0 }}>
        <circle cx={CX} cy={CX} r={maxR} fill="rgba(0,222,255,0.03)" stroke="rgba(0,222,255,0.18)" strokeWidth={0.5} />
        {scaledR.map((r, i) => (
          <circle key={i} cx={CX} cy={CX} r={r} fill="none"
            stroke={`${LAYER_COLORS[i + 1 as keyof typeof LAYER_COLORS]}44`} strokeWidth={0.5} strokeDasharray="2 3" />
        ))}
        {/* Cross hairs */}
        <line x1={CX} y1={4} x2={CX} y2={SIZE - 4} stroke="rgba(0,222,255,0.08)" strokeWidth={0.5} />
        <line x1={4} y1={CX} x2={SIZE - 4} y2={CX} stroke="rgba(0,222,255,0.08)" strokeWidth={0.5} />
        {/* Planet dots */}
        {planets.map(({ x, y, color, size, node }) => (
          <circle key={node.id} cx={x} cy={y} r={size} fill={color} opacity={0.85}>
            <title>{node.label}</title>
          </circle>
        ))}
        {/* Sun */}
        <circle cx={CX} cy={CX} r={4.5} fill="#FFD700" />
        <circle cx={CX} cy={CX} r={7} fill="none" stroke="#FFD70055" strokeWidth={1} />
      </svg>
      {/* Conic sweep */}
      <div
        style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `conic-gradient(from 0deg, ${C}18 0deg, transparent 55deg)`,
          animation: "hud-spin 5s linear infinite",
        }}
      />
      {/* Label */}
      <div style={{ position: "absolute", bottom: -14, left: 0, right: 0, textAlign: "center" }}>
        <span style={{ color: "rgba(0,222,255,0.3)", fontSize: 7, fontFamily: "monospace", letterSpacing: "0.18em" }}>ORBITAL SCAN</span>
      </div>
    </div>
  );
}

// ── Left Panel ────────────────────────────────────────────────────────────────
function LeftPanel({ data, stats }: { data: EcosystemGraphData; stats: AggStats }) {
  const maxCount = Math.max(...Object.values(stats.layerCounts));

  return (
    <div
      style={{
        position: "absolute", top: 38, bottom: 68, left: 0, width: 230,
        zIndex: 20,
        background: BG,
        borderRight: `1px solid ${BD}`,
        backdropFilter: "blur(20px)",
        display: "flex", flexDirection: "column",
        animation: "hud-slide-in-left 0.4s ease-out",
      }}
    >
      <PanelCorners />
      <PanelHeader title="NETWORK SCAN" />

      {/* Radar */}
      <Radar data={data} stats={stats} />

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0 4px" }}>
        {/* Layer distribution */}
        <SectionLabel>LAYER DISTRIBUTION</SectionLabel>
        <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          {[0, 1, 2, 3, 4, 5].map((layer) => {
            const count = stats.layerCounts[layer] ?? 0;
            const avgEPS = stats.layerAvgEPS[layer] ?? 0;
            const color = LAYER_COLORS[layer as keyof typeof LAYER_COLORS];
            return (
              <div key={layer} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ color, fontSize: 7, fontFamily: "monospace", fontWeight: 700, width: 16, flexShrink: 0 }}>L{layer}</span>
                <span style={{ color: "rgba(0,222,255,0.35)", fontSize: 7, fontFamily: "monospace", width: 54, flexShrink: 0, whiteSpace: "nowrap" }}>
                  {(LAYER_LABELS[layer as keyof typeof LAYER_LABELS] ?? "").slice(0, 7).toUpperCase()}
                </span>
                <HBar value={count} max={maxCount} color={color} height={3} />
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 7, fontFamily: "monospace", width: 12, textAlign: "right", flexShrink: 0 }}>{count}</span>
                <span style={{ color, fontSize: 7, fontFamily: "monospace", width: 22, textAlign: "right", flexShrink: 0 }}>{avgEPS}</span>
              </div>
            );
          })}
        </div>

        {/* Top repos by EPS */}
        <SectionLabel style={{ marginTop: 10 }}>TOP REPOS · EPS</SectionLabel>
        <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {stats.topByEPS.slice(0, 8).map((node, i) => {
            const color = LAYER_COLORS[node.layer as keyof typeof LAYER_COLORS];
            return (
              <div key={node.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: "rgba(0,222,255,0.25)", fontSize: 7, fontFamily: "monospace", width: 14, flexShrink: 0 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 7, fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {node.slug}
                </span>
                <HBar value={node.eps} max={100} color={color} height={2} />
                <span style={{ color, fontSize: 7, fontFamily: "monospace", width: 22, textAlign: "right", flexShrink: 0 }}>{node.eps}</span>
              </div>
            );
          })}
        </div>

        {/* Language breakdown */}
        <SectionLabel style={{ marginTop: 10 }}>LANGUAGES</SectionLabel>
        <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          {Object.entries(stats.langCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([lang, count]) => {
              const colors: Record<string, string> = { TypeScript: "#3178C6", JavaScript: "#F7DF1E", Python: "#3572A5" };
              const color = colors[lang] ?? C;
              return (
                <div key={lang} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ color, fontSize: 7, fontFamily: "monospace", width: 74, flexShrink: 0 }}>{lang.toUpperCase()}</span>
                  <HBar value={count} max={34} color={color} height={3} />
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 7, fontFamily: "monospace", width: 14, textAlign: "right", flexShrink: 0 }}>{count}</span>
                </div>
              );
            })}
        </div>

        {/* Top by stars */}
        <SectionLabel style={{ marginTop: 10 }}>TOP BY STARS ★</SectionLabel>
        <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {stats.topByStars.map((node) => (
            <div key={node.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: Ca, fontSize: 7, fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {node.slug}
              </span>
              <HBar value={node.stars} max={stats.topByStars[0].stars} color={Ca} height={2} />
              <span style={{ color: Ca, fontSize: 7, fontFamily: "monospace", width: 34, textAlign: "right", flexShrink: 0 }}>
                {node.stars >= 1000 ? `${(node.stars / 1000).toFixed(1)}K` : node.stars}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Right Panel ───────────────────────────────────────────────────────────────
function RightPanel({
  data,
  stats,
  selected,
  onClose,
}: {
  data: EcosystemGraphData;
  stats: AggStats;
  selected: RepoGraphNode | null;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute", top: 38, bottom: 68, right: 0, width: 252,
        zIndex: 20,
        background: BG,
        borderLeft: `1px solid ${BD}`,
        backdropFilter: "blur(20px)",
        display: "flex", flexDirection: "column",
        animation: "hud-slide-in-right 0.4s ease-out",
      }}
    >
      <PanelCorners />

      {selected ? (
        <PlanetDetail node={selected} data={data} onClose={onClose} />
      ) : (
        <EcosystemOverview stats={stats} data={data} />
      )}
    </div>
  );
}

function EcosystemOverview({ stats, data }: { stats: AggStats; data: EcosystemGraphData }) {
  const catMax = Math.max(...Object.values(stats.categoryCounts));
  const catColors = CATEGORY_COLORS as Record<string, string>;

  // EPS histogram (10 buckets 0–100)
  const epsBuckets = new Array(10).fill(0);
  for (const n of data.nodes) epsBuckets[Math.min(9, Math.floor(n.eps / 10))]++;
  const bucketMax = Math.max(...epsBuckets);

  return (
    <>
      <PanelHeader title="ECOSYSTEM STATUS" accent={Cg} />

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0 4px" }}>
        {/* Big stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "0 10px 8px" }}>
          <BigStat label="TOTAL STARS" value={`${(stats.totalStars / 1000).toFixed(2)}K`} color={Ca} />
          <BigStat label="TOTAL FORKS" value={(stats.totalForks).toLocaleString()} color={C} />
          <BigStat label="AVG EPS" value={String(stats.avgEPS)} color={Cg} />
          <BigStat label="REPOS" value={String(data.nodeCount)} color={C} />
        </div>

        {/* EPS distribution histogram */}
        <SectionLabel>EPS DISTRIBUTION</SectionLabel>
        <div style={{ padding: "0 10px", display: "flex", alignItems: "flex-end", gap: 3, height: 44 }}>
          {epsBuckets.map((count, i) => {
            const pct = (count / bucketMax) * 100;
            const hue = Math.round(i * 12);
            const color = `hsl(${180 + hue},90%,55%)`;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                <div
                  style={{
                    width: "100%", height: `${pct}%`, minHeight: count > 0 ? 2 : 0,
                    background: color, borderRadius: 1,
                    boxShadow: `0 0 4px ${color}88`,
                    animation: "hud-progress 0.6s ease-out",
                  }}
                />
                <span style={{ color: "rgba(0,222,255,0.2)", fontSize: 6, fontFamily: "monospace" }}>{i * 10}</span>
              </div>
            );
          })}
        </div>

        {/* Category breakdown */}
        <SectionLabel style={{ marginTop: 8 }}>CATEGORY BREAKDOWN</SectionLabel>
        <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 3 }}>
          {Object.entries(stats.categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, count]) => {
              const color = catColors[cat] ?? C;
              return (
                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, boxShadow: `0 0 5px ${color}`, flexShrink: 0 }} />
                  <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 7, fontFamily: "monospace", width: 62, flexShrink: 0, textTransform: "uppercase" }}>{cat}</span>
                  <HBar value={count} max={catMax} color={color} height={3} />
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 7, fontFamily: "monospace", width: 14, textAlign: "right", flexShrink: 0 }}>{count}</span>
                </div>
              );
            })}
        </div>

        {/* Plugin registry */}
        <SectionLabel style={{ marginTop: 8 }}>PLUGIN REGISTRY</SectionLabel>
        <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          <RegistryRow label="OFFICIAL REGISTRY" count={stats.registryCount} total={data.nodeCount} color={Cg} />
          <RegistryRow label="CORE DEPENDENT" count={stats.coreDepCount} total={data.nodeCount} color={Ca} />
          <RegistryRow label="COMMUNITY" count={stats.categoryCounts["community"] ?? 0} total={data.nodeCount} color={C} />
          <RegistryRow label="PERIPHERAL" count={stats.categoryCounts["peripheral"] ?? 0} total={data.nodeCount} color="rgba(107,114,128,0.8)" />
        </div>

        {/* System health */}
        <SectionLabel style={{ marginTop: 8 }}>SYSTEM HEALTH</SectionLabel>
        <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          <HealthRow label="NETWORK INTEGRITY" value={89} color={Cg} />
          <HealthRow label="REGISTRY COVERAGE" value={Math.round((stats.registryCount / data.nodeCount) * 100 * 15)} color={Ca} />
          <HealthRow label="CORE STABILITY" value={97} color={Cg} />
          <HealthRow label="COMMUNITY GROWTH" value={74} color={C} />
        </div>
      </div>
    </>
  );
}

function PlanetDetail({ node, data, onClose }: { node: RepoGraphNode; data: EcosystemGraphData; onClose: () => void }) {
  const layerColor = LAYER_COLORS[node.layer as keyof typeof LAYER_COLORS];
  const profile = useMemo(() => getPlanetProfile(node), [node]);

  // Find related repos (same layer, up to 3)
  const related = useMemo(
    () => data.nodes.filter((n) => n.layer === node.layer && n.id !== node.id).slice(0, 4),
    [data, node],
  );

  return (
    <>
      <PanelHeader title="PLANET SCAN" accent={layerColor} />

      <div style={{ flex: 1, overflowY: "auto", padding: "0 0 8px" }}>
        {/* Planet identity */}
        <div style={{ padding: "10px 10px 8px", borderBottom: `1px solid rgba(0,222,255,0.08)` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: "#fff", fontSize: 11, fontFamily: "monospace", fontWeight: 700, lineHeight: 1.2 }}>
                {node.slug}
              </div>
              <div style={{ color: "rgba(0,222,255,0.45)", fontSize: 7, fontFamily: "monospace", marginTop: 2 }}>
                {node.fullName}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ color: "rgba(0,222,255,0.3)", background: "none", border: "none", cursor: "pointer", padding: 2 }}
            >
              <X size={10} />
            </button>
          </div>

          {/* Layer + category */}
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <Badge color={layerColor}>L{node.layer} · {(LAYER_LABELS[node.layer as keyof typeof LAYER_LABELS] ?? "").toUpperCase()}</Badge>
            <Badge color={CATEGORY_COLORS[node.category as keyof typeof CATEGORY_COLORS] ?? C}>
              {node.category.toUpperCase()}
            </Badge>
          </div>

          {/* Planet color swatch */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${profile.color}ff, ${profile.emissive}88)`, boxShadow: `0 0 10px ${profile.color}66` }} />
            <div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 7, fontFamily: "monospace" }}>SURFACE</div>
              <div style={{ color: profile.color, fontSize: 8, fontFamily: "monospace" }}>{profile.color}</div>
            </div>
            {profile.hasRings && (
              <div style={{ marginLeft: "auto" }}>
                <Badge color={profile.ringColor}>RINGED</Badge>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {node.description && (
          <div style={{ padding: "6px 10px", borderBottom: `1px solid rgba(0,222,255,0.08)` }}>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 7.5, fontFamily: "monospace", lineHeight: 1.6, margin: 0 }}>
              {node.description}
            </p>
          </div>
        )}

        {/* Score breakdown */}
        <SectionLabel style={{ marginTop: 8 }}>SCORE MATRIX</SectionLabel>
        <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 5 }}>
          <ScoreRow label="EPS" value={node.eps} max={100} color={layerColor} />
          <ScoreRow label="ACTIVITY" value={node.repoScore.activityScore} max={100} color={Cg} />
          <ScoreRow label="HEALTH" value={node.repoScore.contributorHealth} max={100} color={C} />
          <ScoreRow label="ADOPTION" value={node.repoScore.adoptionScore} max={100} color={Ca} />
          <ScoreRow label="ELIZA FX" value={node.repoScore.elizaEffectDensity} max={100} color="#A855F7" />
          <ScoreRow label="OVERALL" value={node.repoScore.overall} max={100} color="#FFFFFF" />
        </div>

        {/* GitHub metrics */}
        <SectionLabel style={{ marginTop: 8 }}>TELEMETRY</SectionLabel>
        <div style={{ padding: "0 10px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <MetricCell label="STARS" value={node.stars >= 1000 ? `${(node.stars / 1000).toFixed(1)}K` : String(node.stars)} color={Ca} />
          <MetricCell label="FORKS" value={String(node.forks)} color={C} />
          <MetricCell label="LAYER" value={`L${node.layer}`} color={layerColor} />
        </div>

        {/* Integration flags */}
        <div style={{ padding: "6px 10px", display: "flex", gap: 6 }}>
          <FlagChip active={node.isInRegistry} label="REGISTRY" color={Cg} />
          <FlagChip active={node.hasCoreDepend} label="CORE DEP" color={Ca} />
          <FlagChip active={profile.isGas} label="GAS GIANT" color="#A855F7" />
          <FlagChip active={profile.hasRings} label="RINGED" color={C} />
        </div>

        {/* Related repos */}
        <SectionLabel style={{ marginTop: 4 }}>SAME ORBIT · L{node.layer}</SectionLabel>
        <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {related.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <ChevronRight size={7} style={{ color: "rgba(0,222,255,0.3)", flexShrink: 0 }} />
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 7, fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.slug}
              </span>
              <span style={{ color: LAYER_COLORS[r.layer as keyof typeof LAYER_COLORS], fontSize: 7, fontFamily: "monospace" }}>
                {r.eps}
              </span>
            </div>
          ))}
        </div>

        {/* GitHub link */}
        <div style={{ padding: "10px 10px 0" }}>
          <a
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 10px",
              background: `rgba(0,222,255,0.06)`,
              border: `1px solid rgba(0,222,255,0.2)`,
              borderRadius: 4,
              color: C, fontSize: 8, fontFamily: "monospace", letterSpacing: "0.12em",
              textDecoration: "none",
              transition: "background 0.15s",
            }}
          >
            <ExternalLink size={9} />
            VIEW ON GITHUB
          </a>
        </div>
      </div>
    </>
  );
}

// ── Bottom Bar ─────────────────────────────────────────────────────────────────
function BottomBar({
  data,
  stats,
  visibleLayers,
  onLayerToggle,
}: {
  data: EcosystemGraphData;
  stats: AggStats;
  visibleLayers: Set<number>;
  onLayerToggle: (layer: number) => void;
}) {
  return (
    <div
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 46,
        zIndex: 20,
        background: "rgba(0,4,14,0.92)",
        borderTop: `1px solid ${BD}`,
        backdropFilter: "blur(20px)",
        display: "flex", alignItems: "center",
        padding: "0 12px", gap: 8,
      }}
    >
      {/* Layer toggles */}
      <span style={{ color: "rgba(0,222,255,0.3)", fontSize: 7, fontFamily: "monospace", letterSpacing: "0.15em", flexShrink: 0 }}>
        LAYERS
      </span>
      {[0, 1, 2, 3, 4, 5].map((layer) => {
        const active = visibleLayers.has(layer);
        const color = LAYER_COLORS[layer as keyof typeof LAYER_COLORS];
        const count = data.nodes.filter((n) => n.layer === layer).length;
        return (
          <button
            key={layer}
            onClick={() => onLayerToggle(layer)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "3px 8px",
              background: active ? `${color}18` : "rgba(255,255,255,0.03)",
              border: `1px solid ${active ? color : "rgba(255,255,255,0.08)"}`,
              borderRadius: 4, cursor: "pointer",
              boxShadow: active ? `0 0 8px ${color}44` : "none",
              transition: "all 0.15s",
            }}
          >
            <span style={{ color: active ? color : "rgba(255,255,255,0.2)", fontSize: 9, fontFamily: "monospace", fontWeight: 700 }}>
              L{layer}
            </span>
            <span style={{ color: active ? `${color}88` : "rgba(255,255,255,0.12)", fontSize: 6.5, fontFamily: "monospace" }}>
              {count}
            </span>
          </button>
        );
      })}

      <div style={{ width: 1, height: 24, background: BD, margin: "0 2px" }} />

      {/* Quick stats */}
      <BottomStat label="NODES" value={data.nodeCount} />
      <BottomStat label="★" value={`${(stats.totalStars / 1000).toFixed(1)}K`} color={Ca} />
      <BottomStat label="EDGES" value={data.linkCount} />

      <div style={{ flex: 1 }} />

      {/* Keyboard hints */}
      <div style={{ display: "flex", gap: 10 }}>
        {[
          ["LMB DRAG", "orbit"],
          ["RMB DRAG", "pan"],
          ["SCROLL", "zoom"],
          ["CLICK", "inspect"],
          ["ESC", "close"],
        ].map(([key, action]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <kbd style={{ background: "rgba(0,222,255,0.08)", border: `1px solid rgba(0,222,255,0.2)`, borderRadius: 2, padding: "1px 4px", color: C, fontSize: 6.5, fontFamily: "monospace" }}>
              {key}
            </kbd>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 6.5, fontFamily: "monospace" }}>{action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scrolling data ticker ─────────────────────────────────────────────────────
function DataTicker({ data }: { data: EcosystemGraphData }) {
  const items = useMemo(() => {
    const sorted = [...data.nodes].sort((a, b) => b.eps - a.eps);
    const txt = sorted.map((n) => `${n.fullName} · ★${n.stars.toLocaleString()} · EPS:${n.eps} · ${n.category.toUpperCase()}`).join("   ·   ");
    return txt + "   ·   " + txt; // duplicate for seamless loop
  }, [data]);

  return (
    <div
      style={{
        position: "absolute", bottom: 46, left: 0, right: 0, height: 20,
        zIndex: 20,
        background: "rgba(0,4,14,0.72)",
        borderTop: `1px solid rgba(0,222,255,0.08)`,
        overflow: "hidden",
        display: "flex", alignItems: "center",
      }}
    >
      <div style={{ flexShrink: 0, padding: "0 8px", borderRight: `1px solid ${BD}` }}>
        <StatusDot color={C} />
      </div>
      <div style={{ overflow: "hidden", flex: 1, display: "flex", alignItems: "center" }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 0,
            whiteSpace: "nowrap",
            animation: "hud-ticker 80s linear infinite",
          }}
        >
          <span style={{ color: "rgba(0,222,255,0.4)", fontSize: 7, fontFamily: "monospace", letterSpacing: "0.1em", paddingLeft: 12 }}>
            {items}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Small helper components ───────────────────────────────────────────────────

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: "4px 10px 3px", ...style }}>
      <span style={{ color: "rgba(0,222,255,0.28)", fontSize: 7, fontFamily: "monospace", letterSpacing: "0.18em", textTransform: "uppercase" }}>
        {children}
      </span>
      <div style={{ height: "1px", background: "rgba(0,222,255,0.07)", marginTop: 2 }} />
    </div>
  );
}

function ScoreRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 7, fontFamily: "monospace", width: 52, flexShrink: 0 }}>{label}</span>
      <HBar value={value} max={max} color={color} height={4} />
      <span style={{ color, fontSize: 8, fontFamily: "monospace", fontWeight: 700, width: 24, textAlign: "right", flexShrink: 0 }}>{value}</span>
    </div>
  );
}

function BigStat({ label, value, color = C }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "rgba(0,222,255,0.04)", border: "1px solid rgba(0,222,255,0.1)", borderRadius: 4, padding: "6px 8px" }}>
      <div style={{ color: "rgba(0,222,255,0.3)", fontSize: 6.5, fontFamily: "monospace", letterSpacing: "0.12em" }}>{label}</div>
      <div style={{ color, fontSize: 13, fontFamily: "monospace", fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function MetricCell({ label, value, color = C }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 3, padding: "4px 6px", textAlign: "center" }}>
      <div style={{ color: "rgba(0,222,255,0.25)", fontSize: 6, fontFamily: "monospace", letterSpacing: "0.1em" }}>{label}</div>
      <div style={{ color, fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function RegistryRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <StatusDot color={count > 0 ? color : "#333"} active={count > 0} />
      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 7, fontFamily: "monospace", flex: 1 }}>{label}</span>
      <HBar value={count} max={total} color={color} height={2} />
      <span style={{ color, fontSize: 7, fontFamily: "monospace", width: 14, textAlign: "right", flexShrink: 0 }}>{count}</span>
    </div>
  );
}

function HealthRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 7, fontFamily: "monospace", width: 100, flexShrink: 0 }}>{label}</span>
      <HBar value={value} max={100} color={color} height={3} />
      <span style={{ color, fontSize: 7, fontFamily: "monospace", width: 22, textAlign: "right", flexShrink: 0 }}>{value}%</span>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      padding: "1px 5px", borderRadius: 2,
      background: `${color}18`,
      border: `1px solid ${color}44`,
      color, fontSize: 6.5, fontFamily: "monospace", letterSpacing: "0.1em",
    }}>
      {children}
    </span>
  );
}

function FlagChip({ active, label, color }: { active: boolean; label: string; color: string }) {
  return (
    <div style={{
      padding: "2px 5px", borderRadius: 3,
      background: active ? `${color}14` : "rgba(255,255,255,0.03)",
      border: `1px solid ${active ? color + "44" : "rgba(255,255,255,0.06)"}`,
      display: "flex", alignItems: "center", gap: 3,
    }}>
      <div style={{ width: 4, height: 4, borderRadius: "50%", background: active ? color : "#333", boxShadow: active ? `0 0 5px ${color}` : "none" }} />
      <span style={{ color: active ? color : "rgba(255,255,255,0.2)", fontSize: 6, fontFamily: "monospace" }}>{label}</span>
    </div>
  );
}

function BottomStat({ label, value, color = "rgba(0,222,255,0.6)" }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <span style={{ color: "rgba(0,222,255,0.25)", fontSize: 6.5, fontFamily: "monospace", letterSpacing: "0.1em" }}>{label}</span>
      <span style={{ color, fontSize: 10, fontFamily: "monospace", fontWeight: 700, lineHeight: 1.2 }}>{value}</span>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function HudOverlay({
  data,
  selected,
  onClose,
  visibleLayers,
  onLayerToggle,
}: HudProps) {
  const stats = useMemo(() => computeStats(data), [data]);

  return (
    <>
      <TopBar data={data} stats={stats} />
      <LeftPanel data={data} stats={stats} />
      <RightPanel data={data} stats={stats} selected={selected} onClose={onClose} />
      <BottomBar data={data} stats={stats} visibleLayers={visibleLayers} onLayerToggle={onLayerToggle} />
      <DataTicker data={data} />
    </>
  );
}
