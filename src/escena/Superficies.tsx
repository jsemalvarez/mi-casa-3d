import { useMemo } from 'react';
import * as THREE from 'three';
import type { Punto2 } from '../data/tipos';
import { useCasaResuelta } from '../estado';
import { mate } from './materiales';

/** Geometría plana horizontal (normal hacia +Y) a partir de un polígono en planta. */
function usePoligonoHorizontal(poli: Punto2[]) {
  return useMemo(() => {
    const forma = new THREE.Shape(poli.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geo = new THREE.ShapeGeometry(forma);
    geo.rotateX(-Math.PI / 2); // (x, −z) en XY → (x, z) en XZ, normal hacia arriba
    return geo;
  }, [poli]);
}

function Piso({ poli, color, y }: { poli: Punto2[]; color: string; y: number }) {
  const geo = usePoligonoHorizontal(poli);
  return <mesh geometry={geo} position-y={y} material={mate(color)} receiveShadow />;
}

function Techo({ poli, color, y, sombra }: { poli: Punto2[]; color: string; y: number; sombra: boolean }) {
  const geo = usePoligonoHorizontal(poli);
  // Se ve solo desde abajo: desde arriba (vista 3D/planta) queda invisible.
  return (
    <mesh
      geometry={geo}
      position-y={y}
      material={mate(color, { lado: THREE.BackSide })}
      castShadow={sombra}
      receiveShadow
    />
  );
}

export function Pisos() {
  const { casa } = useCasaResuelta();
  return (
    <group name="pisos">
      {casa.ambientes.map((a) => (
        <Piso key={a.id} poli={a.poligono} color={a.piso.color} y={a.exterior ? -0.004 : 0} />
      ))}
    </group>
  );
}

export function Techos({ corte, hacenSombra }: { corte: number; hacenSombra: boolean }) {
  const { casa } = useCasaResuelta();
  return (
    <group name="techos">
      {casa.ambientes
        .filter((a) => !a.exterior && (a.alturaTecho ?? casa.alturaTecho) <= corte)
        .map((a) => (
          <Techo
            key={a.id}
            poli={a.poligono}
            color={a.colorTecho ?? casa.colores.techo}
            y={a.alturaTecho ?? casa.alturaTecho}
            sombra={hacenSombra}
          />
        ))}
    </group>
  );
}

export function Terreno() {
  const { casa, limites } = useCasaResuelta();
  const cx = (limites.x0 + limites.x1) / 2;
  const cz = (limites.z0 + limites.z1) / 2;
  return (
    <mesh rotation-x={-Math.PI / 2} position={[cx, -0.01, cz]} receiveShadow>
      <planeGeometry args={[120, 120]} />
      <meshStandardMaterial color={casa.colores.terreno} roughness={1} />
    </mesh>
  );
}
