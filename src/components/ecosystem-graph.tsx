"use client";

/**
 * EcosystemGraph — interactive force-directed SVG graph.
 *
 * No external graph library.  Uses a custom spring + repulsion simulation
 * running in requestAnimationFrame.  Drag, pan, zoom via SVG transforms.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type {
  RepoGraphNode,
  ContributorSubNode,
  GraphLink,
  ContributorLink,
  AnyLink,
  RepoLayer,
  LinkType,
} from "@/lib/ecosystem-graph-types";
import {
  LAYER_COLORS,
  CATEGORY_COLORS,
  LINK_COLORS,
  LAYER_LABELS,
} from "@/lib/ecosystem-graph-types";
import type { EcosystemGraphData } from "@/lib/ecosystem-graph-types";

// ─── Simulation types ────────────────────────────────────────────────────────

interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;  // null = unfixed
  fy: number | null;
  r: number;          // visual radius
  isContributor: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 900;
const H = 700;
const CX = W / 2;
const CY = H / 2;
const ALPHA_MIN = 0.002;
const ALPHA_DECAY = 0.012;
const VELOCITY_DECAY = 0.6;
const REPULSION_STRENGTH = 3000;
const LINK_STRENGTH = 0.12;
const CENTER_STRENGTH = 0.03;
const TICKS_PER_FRAME = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nodeRadius(stars: number, layer: RepoLayer): number {
  if (layer === 0) return 30;
  const base = Math.max(6, Math.min(20, Math.sqrt(stars + 1) * 0.9));
  return base;
}

function initialPosition(index: number, total: number, layer: RepoLayer): [number, number] {
  const ringR = [0, 120, 200, 280, 340, 400][layer] ?? 280;
  if (layer === 0) return [CX, CY];
  const angle = (2 * Math.PI * index) / Math.max(1, total) + (layer * 0.4);
  return [
    CX + ringR * Math.cos(angle) + (Math.random() - 0.5) * 30,
    CY + ringR * Math.sin(angle) + (Math.random() - 0.5) * 30,
  ];
}

function contributorOrbitPos(parentX: number, parentY: number, index: number, total: number): [number, number] {
  const r = 55;
  const angle = (2 * Math.PI * index) / Math.max(1, total);
  return [parentX + r * Math.cos(angle), parentY + r * Math.sin(angle)];
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  data: EcosystemGraphData;
}

export default function EcosystemGraph({ data }: Props) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<RepoLayer | null>(null);

  // ── Simulation refs ────────────────────────────────────────────────────────
  const simNodesRef = useRef<Map<string, SimNode>>(new Map());
  const rafRef = useRef<number>(0);
  const alphaRef = useRef(0.8);
  const tickRef = useRef(0);

  // ── Pan / zoom state ───────────────────────────────────────────────────────
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  // ── Drag state ─────────────────────────────────────────────────────────────
  const draggingRef = useRef<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);

  // ── Render trigger ─────────────────────────────────────────────────────────
  const [tick, setTick] = useState(0);
  const forceTick = useCallback(() => setTick((t) => t + 1), []);

  // ── Build node/link sets ───────────────────────────────────────────────────
  const visibleNodes = useMemo<RepoGraphNode[]>(() => {
    if (selectedLayer === null) return data.nodes;
    return data.nodes.filter((n) => n.layer === selectedLayer);
  }, [data.nodes, selectedLayer]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const contributorSubNodes = useMemo<ContributorSubNode[]>(() => {
    const result: ContributorSubNode[] = [];
    for (const nodeId of expandedNodes) {
      if (!visibleNodeIds.has(nodeId)) continue;
      const repo = data.nodes.find((n) => n.id === nodeId);
      if (!repo) continue;
      result.push(...repo.topContributors);
    }
    return result;
  }, [expandedNodes, visibleNodeIds, data.nodes]);

  const visibleLinks = useMemo<AnyLink[]>(() => {
    const repoLinks = data.links.filter(
      (l) => visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target),
    );
    const contribLinks: ContributorLink[] = contributorSubNodes.map((c) => ({
      source: c.id,
      target: c.parentRepoId,
      type: "contributor" as const,
      weight: 0.15,
    }));
    return [...repoLinks, ...contribLinks];
  }, [data.links, visibleNodeIds, contributorSubNodes]);

  // ── Initialise / update sim nodes ─────────────────────────────────────────
  useEffect(() => {
    const byLayer = new Map<RepoLayer, number>();
    for (const n of visibleNodes) byLayer.set(n.layer, (byLayer.get(n.layer) ?? 0) + 1);
    const layerCounters = new Map<RepoLayer, number>();

    for (const repo of visibleNodes) {
      if (simNodesRef.current.has(repo.id)) continue;
      const total = byLayer.get(repo.layer) ?? 1;
      const idx = layerCounters.get(repo.layer) ?? 0;
      layerCounters.set(repo.layer, idx + 1);
      const [x, y] = initialPosition(idx, total, repo.layer);
      simNodesRef.current.set(repo.id, {
        id: repo.id,
        x, y, vx: 0, vy: 0,
        fx: repo.layer === 0 ? CX : null,
        fy: repo.layer === 0 ? CY : null,
        r: nodeRadius(repo.stars, repo.layer),
        isContributor: false,
      });
    }

    // Add contributor sub-nodes
    for (const c of contributorSubNodes) {
      if (simNodesRef.current.has(c.id)) continue;
      const parent = simNodesRef.current.get(c.parentRepoId);
      const siblings = contributorSubNodes.filter((x) => x.parentRepoId === c.parentRepoId);
      const idx = siblings.indexOf(c);
      const [x, y] = parent
        ? contributorOrbitPos(parent.x, parent.y, idx, siblings.length)
        : [CX + Math.random() * 40 - 20, CY + Math.random() * 40 - 20];
      simNodesRef.current.set(c.id, {
        id: c.id,
        x, y, vx: 0, vy: 0, fx: null, fy: null,
        r: 8,
        isContributor: true,
      });
    }

    // Remove nodes no longer visible
    for (const key of simNodesRef.current.keys()) {
      const isRepo = visibleNodeIds.has(key);
      const isContrib = contributorSubNodes.some((c) => c.id === key);
      if (!isRepo && !isContrib) simNodesRef.current.delete(key);
    }

    // Re-heat
    alphaRef.current = Math.max(alphaRef.current, 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes, contributorSubNodes]);

  // ── Force simulation loop ─────────────────────────────────────────────────
  useEffect(() => {
    function runTick() {
      if (alphaRef.current < ALPHA_MIN) {
        forceTick();
        rafRef.current = requestAnimationFrame(runTick);
        return;
      }

      const nodes = Array.from(simNodesRef.current.values());
      const alpha = alphaRef.current;

      for (let t = 0; t < TICKS_PER_FRAME; t++) {
        // Center force
        for (const n of nodes) {
          if (n.fx !== null) continue;
          n.vx += (CX - n.x) * CENTER_STRENGTH * alpha;
          n.vy += (CY - n.y) * CENTER_STRENGTH * alpha;
        }

        // Repulsion (Barnes-Hut approximation — just N² for now, N≤70)
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i]!;
            const b = nodes[j]!;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist2 = dx * dx + dy * dy + 0.01;
            const dist = Math.sqrt(dist2);
            const force = (REPULSION_STRENGTH / dist2) * alpha;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (a.fx === null) { a.vx -= fx; a.vy -= fy; }
            if (b.fx === null) { b.vx += fx; b.vy += fy; }
          }
        }

        // Link spring force
        for (const link of visibleLinks) {
          const s = simNodesRef.current.get(link.source);
          const t = simNodesRef.current.get(link.target);
          if (!s || !t) continue;
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
          const targetLen = 80 + (s.r + t.r);
          const stretch = (dist - targetLen) / dist;
          const strength = LINK_STRENGTH * link.weight * alpha;
          const fx = dx * stretch * strength;
          const fy = dy * stretch * strength;
          if (s.fx === null) { s.vx += fx; s.vy += fy; }
          if (t.fx === null) { t.vx -= fx; t.vy -= fy; }
        }

        // Integrate + boundary
        for (const n of nodes) {
          if (n.fx !== null) { n.x = n.fx; n.y = n.fy!; continue; }
          n.vx *= VELOCITY_DECAY;
          n.vy *= VELOCITY_DECAY;
          n.x = Math.max(n.r, Math.min(W - n.r, n.x + n.vx));
          n.y = Math.max(n.r, Math.min(H - n.r, n.y + n.vy));
        }
      }

      alphaRef.current *= (1 - ALPHA_DECAY);
      tickRef.current++;
      forceTick();
      rafRef.current = requestAnimationFrame(runTick);
    }

    rafRef.current = requestAnimationFrame(runTick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleLinks]);

  // ── Pointer events (drag node vs pan background) ───────────────────────────
  const svgRef = useRef<SVGSVGElement>(null);

  function toSvgPoint(clientX: number, clientY: number): [number, number] {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return [clientX, clientY];
    const rx = (clientX - rect.left) / viewTransform.scale - viewTransform.x / viewTransform.scale;
    const ry = (clientY - rect.top)  / viewTransform.scale - viewTransform.y / viewTransform.scale;
    return [rx, ry];
  }

  function handlePointerDown(e: React.PointerEvent<SVGElement>, nodeId: string) {
    e.stopPropagation();
    draggingRef.current = nodeId;
    didDragRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    (e.target as SVGElement).setPointerCapture(e.pointerId);
    alphaRef.current = Math.max(alphaRef.current, 0.3);
  }

  function handlePointerMoveDrag(e: React.PointerEvent<SVGElement>) {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) didDragRef.current = true;
    const [sx, sy] = toSvgPoint(e.clientX, e.clientY);
    const n = simNodesRef.current.get(draggingRef.current);
    if (n) { n.fx = sx; n.fy = sy; n.x = sx; n.y = sy; }
  }

  function handlePointerUpDrag(e: React.PointerEvent<SVGElement>, nodeId: string) {
    const wasDrag = didDragRef.current;
    draggingRef.current = null;
    didDragRef.current = false;
    if (!wasDrag) {
      // It was a click — toggle expand (only for repo nodes)
      if (!nodeId.startsWith("@")) {
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          if (next.has(nodeId)) next.delete(nodeId);
          else next.add(nodeId);
          return next;
        });
      }
    } else {
      // After drag, pin the node
      const n = simNodesRef.current.get(nodeId);
      if (n && nodeId !== "elizaOS/eliza") {
        // unpin after releasing so it can settle
        n.fx = null; n.fy = null;
      }
      alphaRef.current = Math.max(alphaRef.current, 0.2);
    }
    e.stopPropagation();
  }

  // Background pan
  function handleBgPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX, y: e.clientY, tx: viewTransform.x, ty: viewTransform.y };
    (e.target as SVGElement).setPointerCapture(e.pointerId);
  }

  function handleBgPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!isPanningRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setViewTransform((v) => ({ ...v, x: panStartRef.current.tx + dx, y: panStartRef.current.ty + dy }));
  }

  function handleBgPointerUp() {
    isPanningRef.current = false;
  }

  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setViewTransform((v) => {
      const newScale = Math.max(0.3, Math.min(3, v.scale * factor));
      return { ...v, scale: newScale };
    });
  }

  // ── Tooltip data ───────────────────────────────────────────────────────────
  const hoveredRepo = useMemo(
    () => data.nodes.find((n) => n.id === hoveredId),
    [data.nodes, hoveredId],
  );
  const hoveredContrib = useMemo(
    () => contributorSubNodes.find((c) => c.id === hoveredId),
    [contributorSubNodes, hoveredId],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  // Suppress 'tick' dependency — it exists only to drive re-renders
  void tick;

  const transform = `translate(${viewTransform.x},${viewTransform.y}) scale(${viewTransform.scale})`;

  const allSimNodes = Array.from(simNodesRef.current.values());

  const layerKeys = [0, 1, 2, 3, 4, 5] as RepoLayer[];

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Filter layer:</span>
        <button
          type="button"
          onClick={() => setSelectedLayer(null)}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            selectedLayer === null
              ? "border-accent bg-accent/10 text-accent"
              : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
        {layerKeys.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setSelectedLayer(selectedLayer === l ? null : l)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedLayer === l
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
            }`}
            style={selectedLayer === l ? { borderColor: LAYER_COLORS[l], color: LAYER_COLORS[l] } : {}}
          >
            L{l} {LAYER_LABELS[l]}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {visibleNodes.length} repos · {visibleLinks.length} links · click node to expand contributors
        </span>
      </div>

      {/* SVG graph */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card" style={{ height: H }}>
        <svg
          ref={svgRef}
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="cursor-grab active:cursor-grabbing select-none"
          onPointerDown={handleBgPointerDown}
          onPointerMove={(e) => { handleBgPointerMove(e); handlePointerMoveDrag(e as unknown as React.PointerEvent<SVGElement>); }}
          onPointerUp={handleBgPointerUp}
          onWheel={handleWheel}
        >
          <defs>
            <radialGradient id="bg-grad" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#0f0f14" />
              <stop offset="100%" stopColor="#08080c" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background */}
          <rect x={0} y={0} width={W} height={H} fill="url(#bg-grad)" />

          <g transform={transform}>
            {/* Links */}
            {visibleLinks.map((link, i) => {
              const s = simNodesRef.current.get(link.source);
              const t = simNodesRef.current.get(link.target);
              if (!s || !t) return null;
              const color = LINK_COLORS[link.type as keyof typeof LINK_COLORS] ?? "#6B7280";
              const opacity = link.type === "contributor" ? 0.25 : 0.4;
              const strokeWidth = link.type === "contributor" ? 0.8 : Math.max(0.5, (link.weight as number) * 2.5);
              const dashed = link.type === "contributor" || link.type === "starter-chain";
              return (
                <line
                  key={`link-${i}`}
                  x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  strokeDasharray={dashed ? "3 4" : undefined}
                />
              );
            })}

            {/* Repo nodes */}
            {visibleNodes.map((repo) => {
              const n = simNodesRef.current.get(repo.id);
              if (!n) return null;
              const isExpanded = expandedNodes.has(repo.id);
              const isHovered = hoveredId === repo.id;
              const color = LAYER_COLORS[repo.layer];
              const catColor = CATEGORY_COLORS[repo.category];
              const dimmed = selectedLayer !== null && repo.layer !== selectedLayer;
              return (
                <g
                  key={repo.id}
                  transform={`translate(${n.x},${n.y})`}
                  style={{ cursor: "pointer" }}
                  onPointerDown={(e) => handlePointerDown(e, repo.id)}
                  onPointerUp={(e) => handlePointerUpDrag(e, repo.id)}
                  onPointerEnter={() => setHoveredId(repo.id)}
                  onPointerLeave={() => setHoveredId(null)}
                >
                  {/* Glow ring when hovered or expanded */}
                  {(isHovered || isExpanded) && (
                    <circle
                      r={n.r + 6}
                      fill="none"
                      stroke={color}
                      strokeWidth={2}
                      strokeOpacity={0.4}
                      filter="url(#glow)"
                    />
                  )}
                  {/* Main circle */}
                  <circle
                    r={n.r}
                    fill={`color-mix(in srgb, ${catColor} 20%, #1a1a24)`}
                    stroke={color}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    strokeOpacity={dimmed ? 0.25 : 1}
                    fillOpacity={dimmed ? 0.3 : 1}
                  />
                  {/* EPS arc indicator */}
                  {repo.layer > 0 && (() => {
                    const fraction = repo.eps / 100;
                    const circumference = 2 * Math.PI * n.r;
                    return (
                      <circle
                        r={n.r}
                        fill="none"
                        stroke={catColor}
                        strokeWidth={2.5}
                        strokeOpacity={dimmed ? 0.1 : 0.7}
                        strokeDasharray={`${circumference * fraction} ${circumference * (1 - fraction)}`}
                        strokeDashoffset={circumference * 0.25}
                        style={{ transform: "rotate(-90deg)" }}
                      />
                    );
                  })()}
                  {/* Label for larger nodes */}
                  {n.r >= 12 && (
                    <text
                      textAnchor="middle"
                      dy={n.r + 12}
                      fontSize={repo.layer === 0 ? 11 : 9}
                      fill={color}
                      fillOpacity={dimmed ? 0.3 : 0.9}
                      style={{ pointerEvents: "none", fontFamily: "monospace" }}
                    >
                      {repo.slug.length > 14 ? repo.slug.slice(0, 13) + "…" : repo.slug}
                    </text>
                  )}
                  {/* Expand indicator */}
                  {isExpanded && (
                    <circle r={4} cx={n.r - 3} cy={-(n.r - 3)} fill={color} fillOpacity={0.8} />
                  )}
                </g>
              );
            })}

            {/* Contributor sub-nodes */}
            {contributorSubNodes.map((c) => {
              const n = simNodesRef.current.get(c.id);
              if (!n) return null;
              const isHovered = hoveredId === c.id;
              const color = c.elizaEffect != null
                ? `hsl(${120 + c.elizaEffect * 1.2}, 60%, 55%)`
                : "#6B7280";
              return (
                <g
                  key={c.id}
                  transform={`translate(${n.x},${n.y})`}
                  style={{ cursor: "default" }}
                  onPointerEnter={() => setHoveredId(c.id)}
                  onPointerLeave={() => setHoveredId(null)}
                >
                  <circle
                    r={n.r}
                    fill={`color-mix(in srgb, ${color} 30%, #1a1a24)`}
                    stroke={color}
                    strokeWidth={isHovered ? 2 : 1}
                    strokeOpacity={0.8}
                  />
                  {isHovered && (
                    <text
                      textAnchor="middle"
                      dy={n.r + 10}
                      fontSize={8}
                      fill="#aaa"
                      style={{ pointerEvents: "none", fontFamily: "monospace" }}
                    >
                      {c.username}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Tooltip */}
        {(hoveredRepo || hoveredContrib) && (
          <div
            className="pointer-events-none absolute bottom-4 right-4 max-w-[260px] rounded-xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-sm"
          >
            {hoveredRepo && (
              <>
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: LAYER_COLORS[hoveredRepo.layer] }}
                  />
                  <span className="text-xs font-mono text-muted-foreground">
                    L{hoveredRepo.layer} · {hoveredRepo.category}
                  </span>
                </div>
                <p className="text-sm font-semibold leading-tight">{hoveredRepo.slug}</p>
                {hoveredRepo.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{hoveredRepo.description}</p>
                )}
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-mono">
                  <span className="text-muted-foreground">EPS</span>
                  <span style={{ color: LAYER_COLORS[hoveredRepo.layer] }}>{hoveredRepo.eps}</span>
                  <span className="text-muted-foreground">Stars</span>
                  <span>{hoveredRepo.stars.toLocaleString()}</span>
                  <span className="text-muted-foreground">Score</span>
                  <span>{hoveredRepo.repoScore.overall}</span>
                  <span className="text-muted-foreground">Forks</span>
                  <span>{hoveredRepo.forks.toLocaleString()}</span>
                </div>
                {hoveredRepo.topContributors.length > 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {hoveredRepo.topContributors.length} contributors · click to expand
                  </p>
                )}
                {hoveredRepo.topContributors.length === 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground italic">
                    Run with GITHUB_TOKEN to load contributors
                  </p>
                )}
              </>
            )}
            {hoveredContrib && (
              <>
                <p className="text-sm font-semibold">@{hoveredContrib.username}</p>
                <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-mono">
                  {hoveredContrib.trustScore != null && (
                    <>
                      <span className="text-muted-foreground">Trust</span>
                      <span>{hoveredContrib.trustScore.toFixed(1)}</span>
                    </>
                  )}
                  {hoveredContrib.elizaEffect != null && (
                    <>
                      <span className="text-muted-foreground">Eliza Effect</span>
                      <span>{hoveredContrib.elizaEffect.toFixed(1)}</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="pointer-events-none absolute bottom-4 left-4 flex flex-col gap-1.5">
          {(["dependency", "foundation", "registry", "tool-family", "starter-chain"] as LinkType[]).map((lt) => (
            <div key={lt} className="flex items-center gap-1.5">
              <svg width={24} height={6}>
                <line
                  x1={0} y1={3} x2={24} y2={3}
                  stroke={LINK_COLORS[lt]}
                  strokeWidth={lt === "foundation" ? 2 : 1.5}
                  strokeOpacity={0.8}
                  strokeDasharray={lt === "starter-chain" ? "3 4" : undefined}
                />
              </svg>
              <span className="text-[10px] font-mono text-muted-foreground">{lt}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Repo score summary cards (top 6 by overall score) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[...visibleNodes]
          .sort((a, b) => b.repoScore.overall - a.repoScore.overall)
          .slice(0, 6)
          .map((repo) => (
            <div
              key={repo.id}
              className="rounded-xl border border-border bg-card p-3 text-xs"
              style={{ borderColor: `${LAYER_COLORS[repo.layer]}44` }}
            >
              <div className="font-mono font-semibold truncate text-[11px]" style={{ color: LAYER_COLORS[repo.layer] }}>
                {repo.slug}
              </div>
              <div className="mt-1.5 flex justify-between text-muted-foreground">
                <span>Score</span>
                <span className="font-mono font-bold text-foreground">{repo.repoScore.overall}</span>
              </div>
              <div className="mt-0.5 flex justify-between text-muted-foreground">
                <span>Activity</span>
                <span className="font-mono">{repo.repoScore.activityScore}</span>
              </div>
              <div className="mt-0.5 flex justify-between text-muted-foreground">
                <span>Adoption</span>
                <span className="font-mono">{repo.repoScore.adoptionScore}</span>
              </div>
              <div className="mt-0.5 flex justify-between text-muted-foreground">
                <span>Health</span>
                <span className="font-mono">{repo.repoScore.contributorHealth}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
