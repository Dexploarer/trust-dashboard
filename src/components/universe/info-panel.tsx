"use client";

import { X, Star, GitFork, ExternalLink, Layers } from "lucide-react";
import type { RepoGraphNode } from "@/lib/ecosystem-graph-types";
import { LAYER_COLORS, LAYER_LABELS } from "@/lib/ecosystem-graph-types";

interface Props {
  node: RepoGraphNode;
  onClose: () => void;
}

export function InfoPanel({ node, onClose }: Props) {
  const layerColor = LAYER_COLORS[node.layer];

  return (
    <div
      className="absolute bottom-6 left-6 w-[300px] rounded-2xl border border-white/10 bg-black/75 backdrop-blur-xl p-5 space-y-4 z-20 animate-in fade-in slide-in-from-bottom-4 duration-200"
      style={{ boxShadow: `0 0 40px ${layerColor}22, 0 8px 32px rgba(0,0,0,0.8)` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white leading-tight truncate">
            {node.fullName}
          </h2>
          <div
            className="mt-0.5 flex items-center gap-1.5 text-xs font-mono"
            style={{ color: layerColor }}
          >
            <Layers className="h-2.5 w-2.5 flex-shrink-0" />
            L{node.layer} · {LAYER_LABELS[node.layer]} · EPS {node.eps}
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-white/35 hover:text-white/80 transition-colors rounded-md p-0.5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Description */}
      {node.description && (
        <p className="text-xs text-white/55 leading-relaxed line-clamp-3">
          {node.description}
        </p>
      )}

      {/* GitHub metrics */}
      <div className="flex gap-5 text-xs text-white/45">
        <span className="flex items-center gap-1">
          <Star className="h-3 w-3" />
          {node.stars.toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <GitFork className="h-3 w-3" />
          {node.forks.toLocaleString()}
        </span>
        {node.language && (
          <span className="text-white/35">{node.language}</span>
        )}
      </div>

      {/* Score breakdown */}
      <div className="space-y-1.5">
        <ScoreRow
          label="Activity"
          value={node.repoScore.activityScore}
          color={layerColor}
        />
        <ScoreRow
          label="Health"
          value={node.repoScore.contributorHealth}
          color={layerColor}
        />
        <ScoreRow
          label="Adoption"
          value={node.repoScore.adoptionScore}
          color={layerColor}
        />
        <ScoreRow
          label="Eliza Effect"
          value={node.repoScore.elizaEffectDensity}
          color={layerColor}
        />
      </div>

      {/* Overall score */}
      <div
        className="rounded-xl px-3 py-2 text-center text-xs font-mono border"
        style={{
          background: `${layerColor}18`,
          borderColor: `${layerColor}44`,
          color: layerColor,
        }}
      >
        Overall Score: <span className="font-semibold text-sm">{node.repoScore.overall}</span>
      </div>

      {/* GitHub link */}
      <a
        href={node.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors"
      >
        <ExternalLink className="h-3 w-3" />
        View on GitHub
      </a>
    </div>
  );
}

function ScoreRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-white/35 w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-white/8">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
          }}
        />
      </div>
      <span className="text-white/45 font-mono w-7 text-right">{value}</span>
    </div>
  );
}
