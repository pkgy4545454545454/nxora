import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const STATE_CFG = {
  idle: { spin: 0.12, pulse: 0.04, glow: 1.0, ring: 0.15 },
  listening: { spin: 0.25, pulse: 0.12, glow: 1.6, ring: 0.5 },
  thinking: { spin: 0.9, pulse: 0.08, glow: 1.3, ring: 1.1 },
  executing: { spin: 0.6, pulse: 0.1, glow: 1.4, ring: 0.9 },
  speaking: { spin: 0.3, pulse: 0.22, glow: 1.9, ring: 0.7 },
  error: { spin: 0.2, pulse: 0.3, glow: 1.2, ring: 0.4 },
};

function headPoints(count) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const blue = new THREE.Color("#22aaff");
  const red = new THREE.Color("#ff3b52");
  for (let i = 0; i < count; i++) {
    // sample on an ellipsoid (head shape)
    const u = Math.random();
    const v = Math.random();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    let x = Math.sin(phi) * Math.cos(theta);
    let y = Math.cos(phi);
    let z = Math.sin(phi) * Math.sin(theta);
    // head proportions
    x *= 1.0;
    y *= 1.32;
    z *= 0.92;
    // jaw taper (narrow the bottom-front)
    if (y < -0.2) x *= 0.82 + 0.18 * (y + 1);
    // push a bit of noise for organic feel
    const n = 0.03;
    x += (Math.random() - 0.5) * n;
    y += (Math.random() - 0.5) * n;
    z += (Math.random() - 0.5) * n;
    pos[i * 3] = x;
    pos[i * 3 + 1] = y + 0.1;
    pos[i * 3 + 2] = z;
    const c = x < 0 ? blue : red;
    const shade = 0.55 + 0.45 * Math.random();
    col[i * 3] = c.r * shade;
    col[i * 3 + 1] = c.g * shade;
    col[i * 3 + 2] = c.b * shade;
  }
  return { pos, col };
}

function Head({ stateName }) {
  const ref = useRef();
  const matRef = useRef();
  const count = 6500;
  const { pos, col } = useMemo(() => headPoints(count), []);
  const basePos = useMemo(() => pos.slice(), [pos]);
  const cfg = STATE_CFG[stateName] || STATE_CFG.idle;

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * cfg.spin;
    const t = state.clock.elapsedTime;
    const arr = ref.current.geometry.attributes.position.array;
    const amp = cfg.pulse;
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const wobble = 1 + amp * Math.sin(t * 2.2 + basePos[ix + 1] * 4 + i * 0.05);
      arr[ix] = basePos[ix] * wobble;
      arr[ix + 1] = basePos[ix + 1] * wobble;
      arr[ix + 2] = basePos[ix + 2] * wobble;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    if (matRef.current) matRef.current.opacity = 0.85;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={pos} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={col} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={0.022}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function Eye({ x, color, glow }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      const s = 1 + 0.12 * Math.sin(state.clock.elapsedTime * 3);
      ref.current.scale.setScalar(0.09 * s * glow);
    }
  });
  return (
    <mesh position={[x, 0.28, 0.85]} ref={ref}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

function Rings({ speed, glow }) {
  const g = useRef();
  useFrame((state, delta) => {
    if (g.current) g.current.rotation.z += delta * speed;
  });
  return (
    <group ref={g} rotation={[Math.PI / 2.1, 0, 0]}>
      {[1.55, 1.75, 1.95].map((r, i) => (
        <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
          <torusGeometry args={[r, 0.005, 8, 90]} />
          <meshBasicMaterial color={i % 2 ? "#ff3b52" : "#22aaff"} transparent opacity={0.4 * glow} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function Avatar3D({ state = "idle" }) {
  const cfg = STATE_CFG[state] || STATE_CFG.idle;
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Canvas camera={{ position: [0, 0, 4.2], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.4} />
        <Head stateName={state} />
        <Eye x={-0.34} color="#3bd3ff" glow={cfg.glow} />
        <Eye x={0.34} color="#ff4d63" glow={cfg.glow} />
        <Rings speed={cfg.ring} glow={cfg.glow} />
      </Canvas>
    </div>
  );
}
