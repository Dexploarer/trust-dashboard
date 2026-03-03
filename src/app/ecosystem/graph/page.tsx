import type { Metadata } from "next";
import graphData from "@/data/ecosystem-graph.json";
import type { EcosystemGraphData } from "@/lib/ecosystem-graph-types";
import { LAYER_COLORS } from "@/lib/ecosystem-graph-types";
import EcosystemGraphLoader from "@/components/ecosystem-graph-loader";

export const metadata: Metadata = {
  title: "Ecosystem Graph · Trust Dashboard",
  description:
    "Interactive force-directed graph of the elizaOS ecosystem — repos, contributors, and their relationships.",
};

export default function GraphPage() {
  const data = graphData as unknown as EcosystemGraphData;

  // Quick stats for the header bar
  const layerCounts = data.nodes.reduce<Record<number, number>>((acc, n) => {
    acc[n.layer] = (acc[n.layer] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Ecosystem Graph</h1>
        <p className="text-sm text-muted-foreground">
          {data.nodeCount} repos · {data.linkCount} relationships · generated{" "}
          {new Date(data.generatedAt).toLocaleDateString()}
        </p>
      </header>

      {/* Layer distribution */}
      <section className="flex flex-wrap gap-2">
        {Object.entries(layerCounts).map(([layer, count]) => (
          <span
            key={layer}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-mono"
            style={{
              borderColor: `${LAYER_COLORS[Number(layer) as keyof typeof LAYER_COLORS]}44`,
              color: LAYER_COLORS[Number(layer) as keyof typeof LAYER_COLORS],
              background: `${LAYER_COLORS[Number(layer) as keyof typeof LAYER_COLORS]}0f`,
            }}
          >
            L{layer}: {count} repos
          </span>
        ))}
      </section>

      {/* Graph — loaded via client wrapper to allow ssr:false */}
      <EcosystemGraphLoader data={data} />

      {/* Hint */}
      <p className="text-xs text-center text-muted-foreground">
        Drag to move nodes · scroll to zoom · pan background to reposition · click a repo to expand top contributors
      </p>
    </div>
  );
}
