import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import './FlowGalaxy.css';

type Category = [string, number];
type Props = {
  groups: Category[];
  selection: string;
  onSelect: (category: string) => void;
  reducedMotion: boolean;
  formatMoney: (amount: number) => string;
};

export const flowColors = ['#45E6D0', '#FF633E', '#FF78B9', '#B9A4E8', '#FFCF76', '#8EA6FF', '#A6F0BE', '#F9A77C'];

function Planet({ position, radius, color, active, dimmed, onClick }: {
  position: [number, number, number];
  radius: number;
  color: string;
  active: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  return (
    <group position={position}>
      <mesh onClick={(event) => { event.stopPropagation(); onClick(); }}>
        <icosahedronGeometry args={[radius, 2]} />
        <meshPhysicalMaterial
          color={color}
          metalness={0.65}
          roughness={0.18}
          clearcoat={1}
          emissive={color}
          emissiveIntensity={active ? 0.42 : 0.13}
          transparent
          opacity={dimmed ? 0.32 : 1}
        />
      </mesh>
      <mesh rotation={[Math.PI * 0.36, 0.2, 0]}>
        <torusGeometry args={[radius * 1.42, active ? 0.036 : 0.018, 8, 72]} />
        <meshBasicMaterial color={color} transparent opacity={dimmed ? 0.15 : active ? 0.95 : 0.55} />
      </mesh>
      {active && (
        <mesh>
          <sphereGeometry args={[radius * 1.55, 24, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.075} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function Universe({ groups, selection, onSelect, reducedMotion }: Omit<Props, 'formatMoney'>) {
  const root = useRef<THREE.Group>(null);
  const planets = useRef<THREE.Group>(null);
  const maxAmount = Math.max(1, ...groups.map(([, value]) => value));

  const orbits = useMemo(() => [1.05, 1.65, 2.24].map((radius) => radius), []);
  const positions = useMemo(() => groups.slice(0, 8).map(([, value], index) => {
    const angle = index * 2.399963 + 0.55;
    const orbit = 1.04 + (index % 3) * 0.57;
    return {
      position: [Math.cos(angle) * orbit, Math.sin(angle) * orbit * 0.47, Math.sin(angle * 1.7) * 0.65] as [number, number, number],
      radius: 0.16 + Math.sqrt(value / maxAmount) * 0.28,
    };
  }), [groups, maxAmount]);

  useFrame(({ clock, pointer }, delta) => {
    if (reducedMotion) return;
    const t = clock.elapsedTime;
    if (root.current) {
      root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, pointer.x * 0.13 + Math.sin(t * 0.11) * 0.13, 1.5, delta);
      root.current.rotation.x = THREE.MathUtils.damp(root.current.rotation.x, -0.18 - pointer.y * 0.09, 1.5, delta);
    }
    if (planets.current) planets.current.rotation.y = Math.sin(t * 0.16) * 0.12;
  });

  return (
    <group ref={root} rotation={[-0.18, 0, 0]}>
      <mesh>
        <icosahedronGeometry args={[0.49, 3]} />
        <meshPhysicalMaterial color="#FF633E" metalness={0.72} roughness={0.2} clearcoat={1} emissive="#FF633E" emissiveIntensity={0.18} />
      </mesh>
      <mesh rotation={[Math.PI / 2.7, 0, 0]}>
        <torusGeometry args={[0.67, 0.022, 8, 96]} />
        <meshBasicMaterial color="#45E6D0" transparent opacity={0.95} />
      </mesh>
      {orbits.map((radius, index) => (
        <mesh key={radius} rotation={[1.03 + index * 0.18, index * 0.16, 0]}>
          <torusGeometry args={[radius, 0.006, 5, 144]} />
          <meshBasicMaterial color={flowColors[index]} transparent opacity={0.32} />
        </mesh>
      ))}
      <group ref={planets}>
        {groups.slice(0, 8).map(([name], index) => (
          <Planet
            key={name}
            position={positions[index].position}
            radius={positions[index].radius}
            color={flowColors[index % flowColors.length]}
            active={selection === name}
            dimmed={selection !== 'All' && selection !== name}
            onClick={() => onSelect(name)}
          />
        ))}
      </group>
      <pointLight position={[0, 0, 1]} color="#FF633E" intensity={17} distance={6} />
    </group>
  );
}

export default function FlowGalaxy({ groups, selection, onSelect, reducedMotion, formatMoney }: Props) {
  return (
    <div className="vyra-flow-galaxy" aria-label="Interactive three-dimensional spending galaxy">
      <div className="vyra-flow-galaxy-glow" aria-hidden="true" />
      <Canvas
        camera={{ position: [0, 0, 6.9], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
        frameloop={reducedMotion ? 'demand' : 'always'}
        fallback={<div className="vyra-flow-fallback">V / FLOW</div>}
      >
        <ambientLight intensity={1.65} />
        <hemisphereLight args={[0xCCFFFF, 0x2C1B40, 1.8]} />
        <directionalLight position={[3, 4, 5]} intensity={2.5} color="#FFF1E4" />
        <Universe groups={groups} selection={selection} onSelect={onSelect} reducedMotion={reducedMotion} />
      </Canvas>
      <div className="vyra-flow-caption"><span>V / TRANSACTION GALAXY</span><span>{groups.length} CONSTELLATIONS</span></div>
      <div className="vyra-flow-chiplist" aria-label="Select a spending category">
        {groups.map(([name, amount], index) => (
          <button
            key={name}
            type="button"
            className={selection === name ? 'selected' : ''}
            onClick={() => onSelect(name)}
            aria-pressed={selection === name}
            title={`${name}: ${formatMoney(amount)}`}
          >
            <i style={{ background: flowColors[index % flowColors.length] }} />
            {name}
          </button>
        ))}
        {groups.length === 0 && <span className="vyra-flow-empty">Your first outgoing demo payment will create a constellation.</span>}
      </div>
    </div>
  );
}