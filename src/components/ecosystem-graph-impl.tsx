"use client";

/**
 * Ecosystem Graph — implementation component.
 * Loaded dynamically (ssr: false) via ecosystem-graph-canvas.tsx.
 *
 * Features:
 *  - Force-directed layout with react-force-graph-2d
 *  - Nodes sized by EPS, colored by layer
 *  - Click to expand: reveals top contributors as sub-nodes
 *  - Sticky drag: pin / double-click to release
 *  - Layer filter, link-type filter, search highlight
 *  - Hover tooltip
 */

import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  LAYER_LABELS,
  LINK_COLORS,
  CATEGORY_COLORS,
} from "@/lib/ecosystem-graph-types";
import type { EcosystemGraphData } from "@/lib/ecosystem-graph-types";

// ─── helpers ────────────────────────────────────────────────────────────────

type AnyNode = RepoGraphNode | ContributorSubNode;

function isRepoNode(n: AnyNode): n is RepoGraphNode {
  return "layer" in n;
}

function nodeRadius(n: AnyNode): number {
  if (!isRepoNode(n)) return 5;
  // Layer 0 (core) → large; others log-scaled by stars
  if (n.layer === 0) return 26;
  const base = 4 + Math.sqrt(Math.max(0, n.stars)) * 0.012;
  return Math.min(22, Math.max(5, base));
}

function nodeColor(n: AnyNode): string {
  if (!isRepoNode(n)) return "#6B7280";
  return LAYER_COLORS[n.layer];
}

// ─── component ──────────────────────────────────────────────────────────────

interface Props {
  data: EcosystemGraphData;
  width: number;
  height: number;
}

export function EcosystemGraphImpl({ data, width, height }: Props) {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);

  // Layers currently shown (all by default)
  const [visibleLayers, setVisibleLayers] = useState<Set<RepoLayer>>(
    new Set([0, 1, 2, 3, 4, 5]),
  );
  // Link types currently shown
  const [visibleLinkTypes, setVisibleLinkTypes] = useState<Set<LinkType | "contributor">>(
    new Set(["dependency", "foundation", "registry", "tool-family", "starter-chain"]),
  );
  // Expanded repo IDs (contributor sub-nodes shown)
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set());
  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    node: AnyNode;
  } | null>(null);
  // Search query
  const [search, setSearch] = useState("");

  // ── derived graph data ───────────────────────────────────────────────────

  const { nodes, links } = useMemo(() => {
    const baseRepoNodes = data.nodes.filter((n) => visibleLayers.has(n.layer));

    // Sub-nodes for expanded repos
    const subNodes: ContributorSubNode[] = [];
    for (const repoId of expandedRepos) {
      const repo = data.nodes.find((n) => n.id === repoId);
      if (!repo) continue;
      for (const c of repo.topContributors) {
        subNodes.push(c);
      }
    }

    const nodes: AnyNode[] = [...baseRepoNodes, ...subNodes];

    // Repo-to-repo links (filtered by visible layers and link types)
    const repoNodeIds = new Set(baseRepoNodes.map((n) => n.id));
    const repoLinks: GraphLink[] = data.links.filter(
      (l) =>
        repoNodeIds.has(l.source as string) &&
        repoNodeIds.has(l.target as string) &&
        visibleLinkTypes.has(l.type),
    );

    // Contributor sub-node links
    const contribLinks: ContributorLink[] = subNodes.map((c) => ({
      source: c.id,
      target: c.parentRepoId,
      type: "contributor" as const,
      weight: 0.3,
    }));

    const links: AnyLink[] = [...repoLinks, ...contribLinks];

    return { nodes, links };
  }, [data, visibleLayers, visibleLinkTypes, expandedRepos]);

  // ── callbacks ────────────────────────────────────────────────────────────

  const handleNodeClick = useCallback((node: AnyNode) => {
    if (!isRepoNode(node)) return;
    const id = node.id;
    setExpandedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleNodeDragEnd = useCallback((node: AnyNode) => {
    // Pin the node where it was dropped
    if (isRepoNode(node)) {
      node.fx = node.x;
      node.fy = node.y;
    }
  }, []);

  const handleNodeDoubleClick = useCallback((node: AnyNode) => {
    // Unpin the node
    if (isRepoNode(node)) {
      node.fx = null;
      node.fy = null;
    }
  }, []);

  const handleNodeHover = useCallback(
    (node: AnyNode | null, prevNode: AnyNode | null) => {
      void prevNode;
      if (!node) {
        setTooltip(null);
        return;
      }
      // Position tooltip relative to canvas — force-graph gives canvas coords
      // We'll show it as an overlay using node screen position
      setTooltip({ x: 0, y: 0, node });
    },
    [],
  );

  const paintNode = useCallback(
    (node: AnyNode, ctx: CanvasRenderingContext2D) => {
      const r = nodeRadius(node);
      const x = (node as RepoGraphNode).x ?? 0;
      const y = (node as RepoGraphNode).y ?? 0;
      const color = nodeColor(node);
      const searchMatch =
        search.length > 1 &&
        isRepoNode(node) &&
        node.label.toLowerCase().includes(search.toLowerCase());

      // Outer glow if searched
      if (searchMatch) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
      }

      // Fill circle
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isRepoNode(node) ? color + "cc" : color + "88";
      ctx.fill();

      // Stroke
      ctx.lineWidth = isRepoNode(node) && expandedRepos.has(node.id) ? 2.5 : 1;
      ctx.strokeStyle = color;
      ctx.stroke();

      // Label for layer 0-2 nodes or when searched
      if (isRepoNode(node) && (node.layer <= 2 || searchMatch)) {
        ctx.font = `${node.layer === 0 ? 9 : 7}px 'Inter', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fafafa";
        ctx.fillText(node.label, x, y);
      }
    },
    [expandedRepos, search],
  );

  const paintLink = useCallback((link: AnyLink, ctx: CanvasRenderingContext2D) => {
    const type = link.type as LinkType | "contributor";
    const color = LINK_COLORS[type] ?? "#6B7280";
    const weight = link.weight ?? 0.5;
    const source = link.source as unknown as AnyNode;
    const target = link.target as unknown as AnyNode;
    if (!source || !target) return;
    const sx = (source as RepoGraphNode).x ?? 0;
    const sy = (source as RepoGraphNode).y ?? 0;
    const tx = (target as RepoGraphNode).x ?? 0;
    const ty = (target as RepoGraphNode).y ?? 0;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = color + (type === "contributor" ? "66" : "99");
    ctx.lineWidth = Math.max(0.5, weight * 2);
    ctx.stroke();
  }, []);

  // Zoom to fit on mount
  useEffect(() => {
    if (fgRef.current) {
      setTimeout(() => {
        fgRef.current?.zoomToFit(600, 60);
      }, 800);
    }
  }, []);

  // ── layer toggle ─────────────────────────────────────────────────────────

  const toggleLayer = (layer: RepoLayer) => {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) {
        if (next.size > 1) next.delete(layer); // keep at least one
      } else {
        next.add(layer);
      }
      return next;
    });
  };

  const toggleLinkType = (type: LinkType | "contributor") => {
    setVisibleLinkTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const LINK_TYPE_LABELS: Record<LinkType, string> = {
    dependency:      "Dependency",
    foundation:      "Foundation",
    registry:        "Registry",
    "tool-family":   "Tool family",
    "starter-chain": "Starters",
  };

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative" style={{ width, height }}>
      {/* Controls overlay */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 max-w-xs">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search repos…"
          className="w-48 rounded-lg border border-border bg-card/90 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent backdrop-blur"
        />

        {/* Layer toggles */}
        <div className="flex flex-wrap gap-1">
          {(Object.keys(LAYER_LABELS) as unknown as RepoLayer[]).map((layer) => {
            const l = Number(layer) as RepoLayer;
            const active = visibleLayers.has(l);
            return (
              <button
                key={l}
                type="button"
                onClick={() => toggleLayer(l)}
                className="rounded-full px-2 py-0.5 text-xs font-mono transition-opacity"
                style={{
                  background: active ? LAYER_COLORS[l] + "33" : "transparent",
                  border: `1px solid ${active ? LAYER_COLORS[l] : "#3f3f46"}`,
                  color: active ? LAYER_COLORS[l] : "#71717a",
                  opacity: active ? 1 : 0.5,
                }}
              >
                L{l}
              </button>
            );
          })}
        </div>

        {/* Link type toggles */}
        <div className="flex flex-wrap gap-1">
          {(Object.keys(LINK_TYPE_LABELS) as LinkType[]).map((type) => {
            const active = visibleLinkTypes.has(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleLinkType(type)}
                className="rounded-full px-2 py-0.5 text-xs transition-opacity"
                style={{
                  background: active ? LINK_COLORS[type] + "22" : "transparent",
                  border: `1px solid ${active ? LINK_COLORS[type] : "#3f3f46"}`,
                  color: active ? LINK_COLORS[type] : "#71717a",
                }}
              >
                {LINK_TYPE_LABELS[type]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats overlay */}
      <div className="absolute bottom-3 left-3 z-10 text-xs text-muted-foreground font-mono space-y-0.5">
        <div>{nodes.filter(isRepoNode).length} repos · {links.length} edges</div>
        <div className="text-[10px] opacity-70">
          Click to expand contributors · drag to pin · dbl-click to unpin
        </div>
      </div>

      {/* Tooltip */}
      {tooltip?.node && (
        <div
          className="absolute z-20 pointer-events-none rounded-xl border border-border bg-card/95 backdrop-blur px-3 py-2 text-xs shadow-xl max-w-[240px]"
          style={{ bottom: 60, right: 16 }}
        >
          {isRepoNode(tooltip.node) ? (
            <>
              <div className="font-semibold text-foreground">{tooltip.node.fullName}</div>
              {tooltip.node.description && (
                <div className="mt-0.5 text-muted-foreground leading-tight">
                  {tooltip.node.description.slice(0, 100)}
                  {tooltip.node.description.length > 100 ? "…" : ""}
                </div>
              )}
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                <span style={{ color: LAYER_COLORS[tooltip.node.layer] }}>
                  L{tooltip.node.layer} · EPS {tooltip.node.eps}
                </span>
                <span>★ {tooltip.node.stars.toLocaleString()}</span>
                <span>⑂ {tooltip.node.forks.toLocaleString()}</span>
              </div>
              <div className="mt-1 text-muted-foreground">
                Score: {tooltip.node.repoScore.overall} · Activity: {tooltip.node.repoScore.activityScore}
              </div>
              {tooltip.node.topContributors.length > 0 && (
                <div className="mt-1 text-muted-foreground">
                  {expandedRepos.has(tooltip.node.id) ? "Click to collapse" : "Click to expand contributors"}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="font-semibold text-foreground">@{(tooltip.node as ContributorSubNode).username}</div>
              {(tooltip.node as ContributorSubNode).trustScore !== null && (
                <div className="mt-0.5 text-muted-foreground">
                  Trust: {(tooltip.node as ContributorSubNode).trustScore}
                </div>
              )}
              {(tooltip.node as ContributorSubNode).elizaEffect !== null && (
                <div className="text-muted-foreground">
                  Eliza Effect: {(tooltip.node as ContributorSubNode).elizaEffect}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Graph canvas */}
      <ForceGraph2D
        ref={fgRef}
        graphData={{ nodes: nodes as never[], links: links as never[] }}
        width={width}
        height={height}
        backgroundColor="#09090b"
        nodeRelSize={1}
        nodeVal={(n) => nodeRadius(n as unknown as AnyNode) ** 2}
        nodeCanvasObject={(n, ctx) => paintNode(n as unknown as AnyNode, ctx)}
        nodeCanvasObjectMode={() => "replace"}
        linkCanvasObject={(l, ctx) => paintLink(l as unknown as AnyLink, ctx)}
        linkCanvasObjectMode={() => "replace"}
        onNodeClick={(n) => handleNodeClick(n as unknown as AnyNode)}
        onNodeDragEnd={(n) => handleNodeDragEnd(n as unknown as AnyNode)}
        onNodeHover={(n, prev) =>
          handleNodeHover(
            n as unknown as AnyNode | null,
            prev as unknown as AnyNode | null,
          )
        }
        d3VelocityDecay={0.3}
        d3AlphaDecay={0.02}
        warmupTicks={100}
        cooldownTicks={200}
        enableNodeDrag
        enableZoomInteraction
        enablePanInteraction
        minZoom={0.1}
        maxZoom={8}
        onNodeRightClick={(n) => handleNodeDoubleClick(n as unknown as AnyNode)}
      />
    </div>
  );
}
