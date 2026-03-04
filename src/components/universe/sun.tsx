"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";
import type { RepoGraphNode } from "@/lib/ecosystem-graph-types";

interface Props {
  node: RepoGraphNode;
  onClick: () => void;
}

export function Sun({ node, onClick }: Props) {
  void node;
  const coreRef = useRef<THREE.Mesh>(null);
  const corona1Ref = useRef<THREE.Mesh>(null);
  const corona2Ref = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // Gentle pulse
    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 0.9) * 0.022 + Math.sin(t * 1.7) * 0.01;
      coreRef.current.scale.setScalar(pulse);
    }

    // Slowly rotate corona layers in opposite directions
    if (corona1Ref.current) {
      corona1Ref.current.rotation.y += delta * 0.06;
      corona1Ref.current.rotation.z += delta * 0.03;
    }
    if (corona2Ref.current) {
      corona2Ref.current.rotation.y -= delta * 0.04;
      corona2Ref.current.rotation.x += delta * 0.025;
    }
  });

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* ── Core ── */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[3.5, 64, 64]} />
        <MeshDistortMaterial
          color="#FFF8DC"
          emissive="#FFD700"
          emissiveIntensity={3.5}
          roughness={0.08}
          metalness={0}
          distort={0.28}
          speed={3.5}
        />
      </mesh>

      {/* ── Inner corona ── */}
      <mesh ref={corona1Ref} scale={[1.35, 1.35, 1.35]}>
        <sphereGeometry args={[3.5, 32, 32]} />
        <meshBasicMaterial
          color="#FF8C00"
          transparent
          opacity={0.22}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* ── Mid corona ── */}
      <mesh ref={corona2Ref} scale={[1.8, 1.8, 1.8]}>
        <sphereGeometry args={[3.5, 24, 24]} />
        <meshBasicMaterial
          color="#FFD700"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* ── Outer glow ── */}
      <mesh scale={[2.6, 2.6, 2.6]}>
        <sphereGeometry args={[3.5, 16, 16]} />
        <meshBasicMaterial
          color="#FFA500"
          transparent
          opacity={0.045}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* ── Far haze ── */}
      <mesh scale={[4.0, 4.0, 4.0]}>
        <sphereGeometry args={[3.5, 12, 12]} />
        <meshBasicMaterial
          color="#FF6600"
          transparent
          opacity={0.018}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
