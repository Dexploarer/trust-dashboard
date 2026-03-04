"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Stars, OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import type { EcosystemGraphData, RepoGraphNode } from "@/lib/ecosystem-graph-types";
import { Sun } from "./sun";
import { Planet } from "./planet";
import { InfoPanel } from "./info-panel";

interface Props {
  data: EcosystemGraphData;
}

export function UniverseScene({ data: { nodes } }: Props) {
  const [selected, setSelected] = useState<RepoGraphNode | null>(null);
  const controlsRef = useRef(null);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const sun = nodes.find((n) => n.layer === 0)!;
  const planets = nodes.filter((n) => n.layer > 0);

  // Pre-group by layer so each planet knows its index within its layer
  const byLayer = new Map<number, RepoGraphNode[]>();
  for (const n of planets) {
    if (!byLayer.has(n.layer)) byLayer.set(n.layer, []);
    byLayer.get(n.layer)!.push(n);
  }

  return (
    <>
      <Canvas
        camera={{ position: [0, 65, 138], fov: 48, near: 0.1, far: 2500 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.82,
        }}
        style={{ position: "absolute", inset: 0 }}
        onPointerMissed={() => setSelected(null)}
      >
        {/* ── Background ── */}
        <color attach="background" args={["#000008"]} />

        {/* ── Lighting ── */}
        {/* Very dim ambient so far-side of planets isn't pitch-black */}
        <ambientLight intensity={0.04} />
        {/* Main sun-point-light */}
        <pointLight
          position={[0, 0, 0]}
          intensity={9}
          color="#FFF8DC"
          distance={350}
          decay={1.4}
        />

        {/* ── Stars ── */}
        <Stars
          radius={600}
          depth={80}
          count={12000}
          factor={3.5}
          saturation={0}
          fade
          speed={0.4}
        />

        {/* ── Sun ── */}
        <Sun node={sun} onClick={() => setSelected(sun)} />

        {/* ── Planets ── */}
        {planets.map((node) => {
          const layerNodes = byLayer.get(node.layer) ?? [];
          const layerIndex = layerNodes.indexOf(node);
          return (
            <Planet
              key={node.id}
              node={node}
              layerIndex={layerIndex}
              totalInLayer={layerNodes.length}
              isSelected={selected?.id === node.id}
              onClick={() => setSelected(node)}
            />
          );
        })}

        {/* ── Camera controls ── */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.045}
          minDistance={6}
          maxDistance={280}
          enablePan
          panSpeed={0.8}
          rotateSpeed={0.5}
          zoomSpeed={0.9}
        />

        {/* ── Post-processing: bloom for glowing sun + emissive planets ── */}
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.12}
            luminanceSmoothing={0.85}
            intensity={1.4}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>

      {/* ── Selected planet info panel ── */}
      {selected && (
        <InfoPanel node={selected} onClose={() => setSelected(null)} />
      )}

      {/* ── HUD controls hint ── */}
      <div className="absolute bottom-5 right-5 text-right pointer-events-none select-none">
        <p className="text-[10px] font-mono text-white/25 leading-relaxed">
          Left-drag · orbit &nbsp;|&nbsp; Right-drag · pan &nbsp;|&nbsp; Scroll · zoom
          <br />
          Click a planet · inspect &nbsp;|&nbsp; ESC · close
        </p>
      </div>

      {/* ── Title ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none select-none text-center">
        <h1 className="text-[11px] font-mono tracking-[0.25em] uppercase text-white/30">
          elizaOS · Universe
        </h1>
        <p className="text-[9px] font-mono text-white/15 mt-0.5">
          {nodes.length} repositories · 3D
        </p>
      </div>

      {/* ── Back link ── */}
      <a
        href="/trust-dashboard/ecosystem"
        className="absolute top-4 left-5 flex items-center gap-1.5 text-[10px] font-mono text-white/25 hover:text-white/60 transition-colors"
      >
        ← ecosystem
      </a>
    </>
  );
}
