import { Canvas, useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';

type Props = { tone: string; reducedMotion: boolean };

function PaymentCard({ reducedMotion }: Props) {
  const floating = useRef<THREE.Group>(null);
  useFrame(({ clock, pointer }) => {
    if (!floating.current || reducedMotion) return;
    const t = clock.elapsedTime;
    floating.current.rotation.y = -0.23 + Math.sin(t * 0.38) * 0.11 + pointer.x * 0.08;
    floating.current.rotation.x = 0.1 + Math.sin(t * 0.32) * 0.045 - pointer.y * 0.04;
    floating.current.rotation.z = -0.11 + Math.sin(t * 0.26) * 0.028;
    floating.current.position.y = Math.sin(t * 0.75) * 0.065;
  });

  return (
    <group ref={floating} rotation={[0.1, -0.23, -0.11]}>
      <mesh position={[0.16, -0.22, -0.2]} rotation={[0, 0, -0.09]}>
        <planeGeometry args={[3.45, 2.25]} />
        <meshBasicMaterial color="#d5ff3f" transparent opacity={0.11} depthWrite={false} />
      </mesh>
      <RoundedBox args={[3.6, 2.27, 0.13]} radius={0.16} smoothness={8}>
        <meshPhysicalMaterial color="#153F37" metalness={0.38} roughness={0.18} transmission={0.13} thickness={0.9} clearcoat={1} clearcoatRoughness={0.1} />
      </RoundedBox>
      <RoundedBox args={[3.49, 2.16, 0.014]} radius={0.14} smoothness={8} position={[0, 0, 0.073]}>
        <meshPhysicalMaterial color="#4D8E78" transparent opacity={0.5} metalness={0.4} roughness={0.22} clearcoat={1} />
      </RoundedBox>
      <mesh position={[0, 0, 0.082]} rotation={[0, 0, -0.3]}>
        <planeGeometry args={[3.65, 0.55]} />
        <meshBasicMaterial color="#ff572f" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <mesh position={[0.42, -0.18, 0.087]} rotation={[0, 0, 0.3]}>
        <planeGeometry args={[3.2, 0.24]} />
        <meshBasicMaterial color="#B8F2D2" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh position={[-1.07, 0.13, 0.106]}>
        <boxGeometry args={[0.51, 0.4, 0.026]} />
        <meshStandardMaterial color="#d8b98e" metalness={0.86} roughness={0.21} />
      </mesh>
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[-1.07 + x, 0.13, 0.124]}>
          <boxGeometry args={[0.025, 0.36, 0.008]} />
          <meshBasicMaterial color="#8d734b" />
        </mesh>
      ))}
      <mesh position={[-1.07, 0.13, 0.131]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.016, 0.5, 0.008]} />
        <meshBasicMaterial color="#a28b65" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[1.2 + i * 0.075, 0.3, 0.108]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.13 + i * 0.095, 0.012, 8, 38, Math.PI * 0.8]} />
          <meshBasicMaterial color="#e4f9ff" transparent opacity={0.9 - i * 0.16} />
        </mesh>
      ))}
      <Html transform position={[0, 0, 0.15]} distanceFactor={1.5} occlude={false} style={{ pointerEvents: 'none' }}>
        <div style={{ width: 345, height: 209, color: '#faffed', fontFamily: 'Arial, sans-serif', position: 'relative', userSelect: 'none', textShadow: '0 2px 10px #15112b66' }}>
          <div style={{ position: 'absolute', left: 26, top: 19, fontSize: 25, letterSpacing: 6, fontWeight: 800 }}>VYRA</div>
          <div style={{ position: 'absolute', right: 23, top: 25, fontSize: 9, letterSpacing: 2, opacity: 0.8 }}>PAYMENT / CONCEPT</div>
          <div style={{ position: 'absolute', left: 26, bottom: 49, fontSize: 29, letterSpacing: 3, fontWeight: 600 }}>{'\u20B9'} <span style={{ fontSize: 20, letterSpacing: 2 }}>â€¢â€¢â€¢â€¢  4826</span></div>
          <div style={{ position: 'absolute', left: 26, bottom: 21, fontSize: 10, letterSpacing: 2, opacity: 0.9 }}>THE FUTURE IS FLUID</div>
          <div style={{ position: 'absolute', right: 22, bottom: 20, fontSize: 9, letterSpacing: 2, opacity: 0.8 }}>DEMO ONLY</div>
        </div>
      </Html>
    </group>
  );
}

export default function MoneyCore({ tone, reducedMotion }: Props) {
  return (
    <div className="core-canvas" role="img" aria-label="Interactive three-dimensional VYRA virtual payment card" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas dpr={[1, 1.6]} camera={{ position: [0, 0, 5.3], fov: 42 }} gl={{ alpha: true, antialias: true }} fallback={<div style={{ padding: 24 }}>VYRA virtual payment card</div>}>
        <ambientLight intensity={1.8} />
        <directionalLight position={[2, 4, 6]} intensity={3.2} color="#F6E8CD" />
        <pointLight position={[-3, -1, 3]} intensity={18} color="#B8F2D2" />
        <pointLight position={[3, 2, -1]} intensity={25} color={tone} />
        <PaymentCard tone={tone} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
