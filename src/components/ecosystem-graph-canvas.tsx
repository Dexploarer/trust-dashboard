"use client";

/**
 * Client-side wrapper that lazy-loads the graph implementation.
 * react-force-graph-2d uses canvas + window APIs incompatible with SSR,
 * so we use next/dynamic with ssr: false.
 */

import dynamic from "next/dynamic";
import type { EcosystemGraphData } from "@/lib/ecosystem-graph-types";

const EcosystemGraphImpl = dynamic(
  () => import("./ecosystem-graph-impl").then((m) => m.EcosystemGraphImpl),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm"
        style={{ height: "100%" }}
      >
        <span>Loading graph…</span>
      </div>
    ),
  },
);

interface Props {
  data: EcosystemGraphData;
  width: number;
  height: number;
}

export function EcosystemGraphCanvas({ data, width, height }: Props) {
  return <EcosystemGraphImpl data={data} width={width} height={height} />;
}
