"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Stars, OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import type { EcosystemGraphData, RepoGraphNode } from "@/lib/ecosystem-graph-types";
import { Sun } from "./sun";
import { Planet } from "./planet";
import { HudOverlay } from "./hud-overlay";

interface Props {
  data: EcosystemGraphData;
}

export function UniverseScene({ data }: Props) {
  const { nodes } = data;
  const [selected, setSelected] = useState<RepoGraphNode | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<Set<number>>(
    new Set([0, 1, 2, 3, 4, 5]),
  );
  const controlsRef = useRef(null);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleLayer = useCallback((layer: number) => {
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      // Keep at least one layer visible
      if (next.has(layer) && next.size > 1) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  }, []);

  const sun = nodes.find((n) => n.layer === 0)!;
  const planets = nodes.filter((n) => n.layer > 0);

  // Pre-group by layer for stable orbital index assignment (do NOT filter here —
  // each planet needs its true layerIndex so orbits don't jump when layers are toggled)
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
        <ambientLight intensity={0.04} />
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

        {/* ── Sun (layer 0) ── */}
        {visibleLayers.has(0) && (
          <Sun node={sun} onClick={() => setSelected(sun)} />
        )}

        {/* ── Planets ── */}
        {planets.map((node) => {
          if (!visibleLayers.has(node.layer)) return null;
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

        {/* ── Post-processing ── */}
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.12}
            luminanceSmoothing={0.85}
            intensity={1.4}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>

      {/* ── Gaming HUD overlay ── */}
      <HudOverlay
        data={data}
        selected={selected}
        onClose={() => setSelected(null)}
        visibleLayers={visibleLayers}
        onLayerToggle={toggleLayer}
      />
    </>
  );
}
