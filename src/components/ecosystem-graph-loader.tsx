"use client";

/**
 * Client wrapper that dynamically loads EcosystemGraph (canvas/SVG only).
 * Must be a client component to use dynamic() with ssr: false.
 */
import dynamic from "next/dynamic";
import type { EcosystemGraphData } from "@/lib/ecosystem-graph-types";

const EcosystemGraph = dynamic(
  () => import("@/components/ecosystem-graph"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[700px] items-center justify-center rounded-2xl border border-border bg-card">
        <span className="text-sm text-muted-foreground animate-pulse">Loading graph…</span>
      </div>
    ),
  },
);

export default function EcosystemGraphLoader({ data }: { data: EcosystemGraphData }) {
  return <EcosystemGraph data={data} />;
}
