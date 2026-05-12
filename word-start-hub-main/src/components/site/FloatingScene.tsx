import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import { useRef, Suspense } from "react";
import * as THREE from "three";

function AnimatedSphere({ color, position, speed = 1, distort = 0.4, size = 1 }: {
  color: string;
  position: [number, number, number];
  speed?: number;
  distort?: number;
  size?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * speed * 0.3) * 0.2;
      meshRef.current.rotation.y = state.clock.elapsedTime * speed * 0.15;
    }
  });

  return (
    <Float speed={speed} rotationIntensity={0.4} floatIntensity={0.8}>
      <mesh ref={meshRef} position={position} scale={size}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshDistortMaterial
          color={color}
          roughness={0.1}
          metalness={0.8}
          distort={distort}
          speed={speed * 2}
          transparent
          opacity={0.7}
        />
      </mesh>
    </Float>
  );
}

function FloatingTorus({ color, position, size = 0.6 }: {
  color: string;
  position: [number, number, number];
  size?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.3;
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.5;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.6} floatIntensity={1}>
      <mesh ref={meshRef} position={position} scale={size}>
        <torusGeometry args={[1, 0.3, 16, 32]} />
        <meshStandardMaterial
          color={color}
          roughness={0.15}
          metalness={0.9}
          transparent
          opacity={0.5}
        />
      </mesh>
    </Float>
  );
}

export default function FloatingScene({ isDark }: { isDark: boolean }) {
  const primary = isDark ? "#34d399" : "#059669";
  const accent = isDark ? "#22d3ee" : "#0891b2";

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={isDark ? 0.8 : 0.6} />
          <pointLight position={[-3, 2, 4]} intensity={0.5} color={primary} />

          <AnimatedSphere color={primary} position={[2.5, 1, 0]} speed={0.8} distort={0.3} size={0.8} />
          <AnimatedSphere color={accent} position={[-2.5, -0.5, -1]} speed={1.2} distort={0.5} size={0.6} />
          <FloatingTorus color={primary} position={[-1.5, 1.5, -0.5]} size={0.4} />
          <FloatingTorus color={accent} position={[1.5, -1.5, 0.5]} size={0.3} />
        </Suspense>
      </Canvas>
    </div>
  );
}
