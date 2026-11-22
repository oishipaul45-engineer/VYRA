import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import "./VaultCapsule.css";

type Props = {
  saved: number;
  goal: number;
  reducedMotion: boolean;
  label: string;
};

function VaultObject({
  progress,
  reducedMotion,
}: {
  progress: number;
  reducedMotion: boolean;
}) {
  const sculpture = useRef<THREE.Group>(null);
  const particles = useRef<THREE.Group>(null);

  const completed = progress >= 1;

  const pieces = useMemo(() => {
    return Array.from({ length: 36 }, (_, index) => {
      const angle = index * 2.399963;
      const ring = 0.16 + (index % 4) * 0.115;

      return {
        id: index,
        position: [
          Math.cos(angle) * ring,
          -0.78 + Math.floor(index / 4) * 0.19,
          Math.sin(angle) * ring,
        ] as [number, number, number],
        size: 0.09 + (index % 3) * 0.018,
        color: ["#45E6D0", "#FF633E", "#FF78B9", "#B9A4E8"][
          index % 4
        ],
      };
    });
  }, []);

  const visibleCount = Math.min(
    pieces.length,
    Math.max(0, Math.ceil(progress * pieces.length))
  );

  useFrame(({ clock, pointer }, delta) => {
    if (reducedMotion) return;

    const time = clock.elapsedTime;

    if (sculpture.current) {
      sculpture.current.rotation.y = THREE.MathUtils.damp(
        sculpture.current.rotation.y,
        pointer.x * 0.25 + Math.sin(time * 0.25) * 0.18,
        2,
        delta
      );

      sculpture.current.rotation.x = THREE.MathUtils.damp(
        sculpture.current.rotation.x,
        -0.12 - pointer.y * 0.12,
        2,
        delta
      );

      sculpture.current.position.y = Math.sin(time * 0.85) * 0.065;
    }

    if (particles.current) {
      particles.current.rotation.y += delta * (completed ? 0.4 : 0.14);
      particles.current.position.y = Math.sin(time * 1.25) * 0.045;
    }
  });

  return (
    <group ref={sculpture} rotation={[-0.12, 0, 0]}>
      {/* Architectural glass chamber */}
      <mesh>
        <cylinderGeometry args={[0.7, 0.7, 2.02, 48, 1, true]} />
        <meshPhysicalMaterial
          color={completed ? "#BDFBEF" : "#B9DDF4"}
          transparent
          opacity={0.22}
          roughness={0.08}
          metalness={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
          clearcoat={1}
        />
      </mesh>

      {/* Metallic base */}
      <mesh position={[0, -1.04, 0]}>
        <cylinderGeometry args={[0.76, 0.76, 0.16, 48]} />
        <meshStandardMaterial
          color="#FF633E"
          metalness={0.75}
          roughness={0.22}
        />
      </mesh>

      {/* Metallic lid */}
      <mesh position={[0, 1.04, 0]}>
        <cylinderGeometry args={[0.76, 0.76, 0.16, 48]} />
        <meshStandardMaterial
          color={completed ? "#45E6D0" : "#F7B2E2"}
          metalness={0.8}
          roughness={0.18}
        />
      </mesh>

      {/* Illuminated chamber rings */}
      {[-0.94, 0, 0.94].map((y) => (
        <mesh
          key={y}
          position={[0, y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.71, 0.026, 10, 64]} />
          <meshStandardMaterial
            color={completed ? "#45E6D0" : "#FF78B9"}
            emissive={completed ? "#45E6D0" : "#FF633E"}
            emissiveIntensity={completed ? 1.4 : 0.35}
            metalness={0.65}
            roughness={0.2}
          />
        </mesh>
      ))}

      {/* Savings pieces appear as progress increases */}
      <group ref={particles}>
        {pieces.slice(0, visibleCount).map((piece) => (
          <mesh
            key={piece.id}
            position={piece.position}
            rotation={[
              piece.id * 0.2,
              piece.id * 0.37,
              piece.id * 0.13,
            ]}
          >
            <icosahedronGeometry args={[piece.size, 0]} />
            <meshStandardMaterial
              color={piece.color}
              metalness={0.72}
              roughness={0.18}
              emissive={piece.color}
              emissiveIntensity={completed ? 0.5 : 0.12}
            />
          </mesh>
        ))}
      </group>

      {/* Completion crown */}
      {completed && (
        <mesh
          position={[0, 1.2, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.91, 0.035, 12, 72]} />
          <meshStandardMaterial
            color="#45E6D0"
            emissive="#45E6D0"
            emissiveIntensity={1.4}
          />
        </mesh>
      )}
    </group>
  );
}

export default function VaultCapsule({
  saved,
  goal,
  reducedMotion,
  label,
}: Props) {
  const progress =
    goal > 0
      ? Math.min(1, Math.max(0, saved / goal))
      : 0;

  const percent = Math.round(progress * 100);
  const complete = percent >= 100;

  return (
    <div
      className={`vyra-vault-3d ${complete ? "is-complete" : ""}`}
      aria-label={`${label}: ${percent}% of savings target reached`}
    >
      <div className="vyra-vault-ambient" aria-hidden="true" />

      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 4.7], fov: 39 }}
        gl={{ alpha: true, antialias: true }}
        frameloop={reducedMotion ? "demand" : "always"}
        fallback={
          <div className="vyra-vault-fallback">
            {percent}% SAVED
          </div>
        }
      >
        <ambientLight intensity={1.5} />
        <hemisphereLight args={[0xE2FFFF, 0x312139, 1.7]} />

        <directionalLight
          position={[3, 4, 5]}
          intensity={3}
          color="#FFF0DE"
        />

        <pointLight
          position={[-2, 1, 2]}
          color="#45E6D0"
          intensity={22}
          distance={8}
        />

        <pointLight
          position={[2, -1, 2]}
          color="#FF78B9"
          intensity={19}
          distance={8}
        />

        <VaultObject
          progress={progress}
          reducedMotion={reducedMotion}
        />
      </Canvas>

      <div className="vyra-vault-overlay">
        <span>VYRA / LIVING VAULT</span>
        <strong>{complete ? "GOAL REACHED" : `${percent}% FILLED`}</strong>
      </div>
    </div>
  );
}