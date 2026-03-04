import type { Metadata } from "next";
import graphData from "@/data/ecosystem-graph.json";
import type { EcosystemGraphData } from "@/lib/ecosystem-graph-types";
import { UniverseSceneLoader } from "@/components/universe-scene-loader";

export const metadata: Metadata = {
  title: "elizaOS Universe",
  description:
    "Interactive 3D solar system of the elizaOS repository ecosystem — 57 repos as orbiting planets.",
};

export default function GraphPage() {
  const data = graphData as EcosystemGraphData;

  return (
    // Fixed overlay covers the full viewport including the site nav
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "#000008",
        overflow: "hidden",
      }}
    >
      <UniverseSceneLoader data={data} />
    </div>
  );
}
