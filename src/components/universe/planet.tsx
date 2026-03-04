"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Html } from "@react-three/drei";
import * as THREE from "three";
import type { RepoGraphNode } from "@/lib/ecosystem-graph-types";
import {
  getPlanetProfile,
  planetSize,
  computeOrbit,
} from "@/lib/planet-profiles";

interface Props {
  node: RepoGraphNode;
  layerIndex: number;
  totalInLayer: number;
  isSelected: boolean;
  onClick: () => void;
}

/** Compute full 3D orbit position from orbital elements + time. */
function orbitPosition(
  t: number,
  radius: number,
  speed: number,
  inclination: number,
  ascNode: number,
  initialAngle: number,
): [number, number, number] {
  const M = t * speed + initialAngle;
  const x_orb = Math.cos(M) * radius;
  const y_orb = Math.sin(M) * radius;

  const ci = Math.cos(inclination);
  const si = Math.sin(inclination);
  const cn = Math.cos(ascNode);
  const sn = Math.sin(ascNode);

  return [
    x_orb * cn - y_orb * ci * sn,
    y_orb * si,
    x_orb * sn + y_orb * ci * cn,
  ];
}

export function Planet({
  node,
  layerIndex,
  totalInLayer,
  isSelected,
  onClick,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const planetRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const profile = useMemo(() => getPlanetProfile(node), [node]);
  const size = useMemo(() => planetSize(node), [node]);
  const orbit = useMemo(
    () => computeOrbit(node.layer, layerIndex, totalInLayer),
    [node.layer, layerIndex, totalInLayer],
  );

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    // Orbital motion
    const [x, y, z] = orbitPosition(
      t,
      orbit.radius,
      orbit.speed,
      orbit.inclination,
      orbit.ascNode,
      orbit.initialAngle,
    );
    groupRef.current.position.set(x, y, z);

    // Axial rotation
    if (planetRef.current) {
      planetRef.current.rotation.y += delta * profile.rotationSpeed;
    }

    // Selection glow pulse
    if (glowRef.current && isSelected) {
      const pulse =
        1 + Math.sin(t * 3.5) * 0.06 + Math.sin(t * 6.2) * 0.025;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  const showLabel = size > 0.55 || node.layer <= 2 || isSelected;

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* ── Planet body ── */}
      <mesh ref={planetRef} rotation-z={profile.axialTilt}>
        <sphereGeometry args={[size, 64, 64]} />
        {profile.isGas ? (
          <MeshDistortMaterial
            color={profile.color}
            emissive={profile.emissive}
            emissiveIntensity={profile.emissiveIntensity}
            roughness={profile.roughness}
            metalness={profile.metalness}
            distort={profile.distortScale}
            speed={profile.distortSpeed}
          />
        ) : (
          <meshStandardMaterial
            color={profile.color}
            emissive={profile.emissive}
            emissiveIntensity={profile.emissiveIntensity}
            roughness={profile.roughness}
            metalness={profile.metalness}
          />
        )}
      </mesh>

      {/* ── Atmosphere ── */}
      {profile.atmosphereOpacity > 0 && (
        <mesh
          scale={[
            profile.atmosphereScale,
            profile.atmosphereScale,
            profile.atmosphereScale,
          ]}
        >
          <sphereGeometry args={[size, 32, 32]} />
          <meshBasicMaterial
            color={profile.atmosphereColor}
            transparent
            opacity={profile.atmosphereOpacity}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* ── Ring system ── */}
      {profile.hasRings && (
        <mesh rotation-x={Math.PI / 2 + 0.28}>
          <ringGeometry args={[size * 1.55, size * 2.6, 80]} />
          <meshBasicMaterial
            color={profile.ringColor}
            transparent
            opacity={profile.ringOpacity}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* ── Selection indicator ── */}
      {isSelected && (
        <>
          {/* Pulsing selection ring */}
          <mesh ref={glowRef} rotation-x={Math.PI / 2}>
            <ringGeometry args={[size * 1.42, size * 1.55, 80]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.85}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          {/* Outer glow halo */}
          <mesh scale={[1.45, 1.45, 1.45]}>
            <sphereGeometry args={[size, 24, 24]} />
            <meshBasicMaterial
              color={profile.emissive || profile.color}
              transparent
              opacity={0.12}
              side={THREE.BackSide}
              depthWrite={false}
            />
          </mesh>
        </>
      )}

      {/* ── Label ── */}
      {showLabel && (
        <Html
          position={[0, size * (profile.hasRings ? 2.8 : 1.6) + 0.2, 0]}
          center
          style={{ pointerEvents: "none" }}
        >
          <span
            style={{
              color: isSelected ? "#ffffff" : "rgba(255,255,255,0.55)",
              fontSize: isSelected ? "11px" : "10px",
              fontFamily: "monospace",
              whiteSpace: "nowrap",
              textShadow: "0 0 8px rgba(0,0,0,0.9), 0 0 16px rgba(0,0,0,0.6)",
              fontWeight: isSelected ? "600" : "400",
              transition: "all 0.2s",
            }}
          >
            {node.label}
          </span>
        </Html>
      )}
    </group>
  );
}
