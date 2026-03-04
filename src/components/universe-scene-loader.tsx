"use client";

/**
 * Dynamically loads the Three.js universe scene (ssr: false required —
 * Three.js needs browser APIs: WebGL, canvas, requestAnimationFrame).
 */

import dynamic from "next/dynamic";
import type { EcosystemGraphData } from "@/lib/ecosystem-graph-types";

const UniverseScene = dynamic(
  () => import("./universe/scene").then((m) => m.UniverseScene),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000008",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "rgba(255,215,0,0.5)",
            fontFamily: "monospace",
            fontSize: "11px",
            letterSpacing: "0.2em",
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          INITIALIZING UNIVERSE…
        </span>
      </div>
    ),
  },
);

export function UniverseSceneLoader({ data }: { data: EcosystemGraphData }) {
  return <UniverseScene data={data} />;
}
