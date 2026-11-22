import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import './KineticV.css';

type Props = { reducedMotion: boolean };

function Sculpture({ reducedMotion }: Props) {
  const root = useRef<THREE.Group>(null);
  const ribbon = useRef<THREE.Group>(null);

  // A real extruded V: custom geometry rather than a stock torus or sphere.
  const vGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-1.15, 1.02);
    shape.lineTo(-0.65, 1.02);
    shape.lineTo(0, -0.38);
    shape.lineTo(0.65, 1.02);
    shape.lineTo(1.15, 1.02);
    shape.lineTo(0.27, -1.04);
    shape.lineTo(-0.27, -1.04);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.30,
      bevelEnabled: true,
      bevelThickness: 0.075,
      bevelSize: 0.055,
      bevelSegments: 5,
      steps: 1,
      curveSegments: 12,
    });
    geo.center();
    return geo;
  }, []);

  // Two handcrafted spatial paths coil around the letter like liquid metal.
  const paths = useMemo(() => {
    const a: THREE.Vector3[] = [];
    const b: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      a.push(new THREE.Vector3(
        Math.cos(t) * (1.16 + 0.11 * Math.sin(t * 2)),
        Math.sin(t) * 0.79,
        0.32 + Math.sin(t * 2.3) * 0.46,
      ));
      b.push(new THREE.Vector3(
        Math.cos(t + 1.55) * 1.11,
        Math.sin(t + 1.55) * 0.88,
        -0.18 + Math.cos(t * 2.1) * 0.47,
      ));
    }
    return [
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(a, true, 'catmullrom', 0.4), 180, 0.085, 12, true),
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(b, true, 'catmullrom', 0.4), 180, 0.038, 10, true),
    ];
  }, []);

  useFrame(({ clock, pointer }, delta) => {
    if (!root.current || !ribbon.current || reducedMotion) return;
    const t = clock.elapsedTime;
    root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, pointer.x * 0.28 + Math.sin(t * 0.31) * 0.16, 2.0, delta);
    root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, -pointer.y * 0.14 - 0.13, 2.0, delta);
    root.current.rotation.z = Math.sin(t * 0.34) * 0.045;
    root.current.position.y = Math.sin(t * 0.68) * 0.075;
    ribbon.current.rotation.y = t * 0.14;
    ribbon.current.rotation.z = Math.sin(t * 0.37) * 0.06;
  });

  return (
    <group ref={root} rotation={[-0.13, 0, -0.03]}>
      <mesh geometry={vGeometry} rotation={[0, -0.11, 0]}>
        <meshPhysicalMaterial color="#FF633E" metalness={0.76} roughness={0.19} clearcoat={1} clearcoatRoughness={0.12} />
      </mesh>
      <group ref={ribbon}>
        <mesh geometry={paths[0]}>
          <meshPhysicalMaterial color="#45E6D0" metalness={0.82} roughness={0.14} clearcoat={1} />
        </mesh>
        <mesh geometry={paths[1]}>
          <meshPhysicalMaterial color="#F7B2E2" metalness={0.62} roughness={0.18} clearcoat={1} />
        </mesh>
        <mesh position={[1.1, 0.14, 0.37]}>
          <sphereGeometry args={[0.14, 24, 24]} />
          <meshPhysicalMaterial color="#FFF5E6" metalness={0.85} roughness={0.12} />
        </mesh>
      </group>
      <mesh position={[0, 0, -0.85]} rotation={[0.15, 0, 0.22]}>
        <torusGeometry args={[1.38, 0.012, 8, 128]} />
        <meshBasicMaterial color="#F4DFFF" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

export default function KineticV({ reducedMotion }: Props) {
  return (
    <div className="vyra-kinetic" role="img" aria-label="Interactive three-dimensional metallic V sculpture surrounded by liquid aqua ribbons">
      <div className="vyra-kinetic-glow" aria-hidden="true" />
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 5.9], fov: 43 }} gl={{ alpha: true, antialias: true }} fallback={<div className="vyra-kinetic-fallback">V / MONEY IN MOTION</div>}>
        <ambientLight intensity={1.5} />
        <hemisphereLight args={[0xD6FFF9, 0x35213E, 2.1]} />
        <directionalLight position={[3, 5, 6]} color="#FFF0E1" intensity={3} />
        <pointLight position={[-3, 1, 2]} color="#45E6D0" intensity={42} distance={10} />
        <pointLight position={[3, -2, 3]} color="#FF7F9E" intensity={35} distance={10} />
        <Sculpture reducedMotion={reducedMotion} />
      </Canvas>
      <span className="vyra-kinetic-caption">V / THE MOTION ENGINE</span>
      <span className="vyra-kinetic-index">001 â€” SCULPTURE</span>
    </div>
  );
}