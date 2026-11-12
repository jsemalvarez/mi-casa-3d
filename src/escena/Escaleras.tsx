import { useMemo } from 'react';
import * as THREE from 'three';
import type { Escalera, TramoEscalera } from '../data/tipos';
import { useCasaResuelta } from '../estado';
import { len, norm, sub } from '../modelo/geometria';
import { mate } from './materiales';

/** Escaleras: escalones abiertos, dos zancas, baranda y descansos. */
export function Escaleras({ corte }: { corte: number }) {
  const { casa } = useCasaResuelta();
  return (
    <group name="escaleras">
      {casa.escaleras.map((esc) => (
        <Escalera3D key={esc.id} esc={esc} corte={corte} />
      ))}
    </group>
  );
}

function Escalera3D({ esc, corte }: { esc: Escalera; corte: number }) {
  // Lo que queda por encima del corte (en planta) se ve translúcido.
  const mat = (y: number) => mate(esc.color, { opacidad: y > corte ? 0.3 : 1 });
  return (
    <group userData={{ escalera: esc.id }}>
      {esc.tramos.map((t, k) => (
        <Tramo3D key={k} t={t} mat={mat} />
      ))}
      {(esc.descansos ?? []).map((d, k) => (
        <Descanso3D key={`d${k}`} poligono={d.poligono} altura={d.altura} mat={mat} />
      ))}
    </group>
  );
}

function Tramo3D({ t, mat }: { t: TramoEscalera; mat: (y: number) => ReturnType<typeof mate> }) {
  const d = useMemo(() => {
    const v = sub(t.hasta, t.desde);
    const largo = len(v);
    const dir = norm(v);
    const subida = t.alturaHasta - t.alturaDesde;
    const n = Math.max(2, t.escalones);
    const huella = largo / (n - 1); // n alzadas, n − 1 huellas
    const alzada = subida / n;
    const pendiente = Math.atan2(subida, largo);
    const largoZanca = Math.hypot(largo, subida);
    return { largo, dir, subida, n, huella, alzada, pendiente, largoZanca, angulo: Math.atan2(-dir[1], dir[0]) };
  }, [t]);

  const h0 = t.alturaDesde;
  const medio = h0 + d.subida / 2;
  const ladosBaranda = t.baranda === 'ambos' ? [-1, 1] : t.baranda === 'der' ? [1] : t.baranda === 'izq' ? [-1] : [];

  return (
    // Local: X a lo largo del tramo (subiendo), Z hacia la derecha mirando hacia arriba.
    <group position={[t.desde[0], 0, t.desde[1]]} rotation={[0, d.angulo, 0]}>
      {Array.from({ length: d.n - 1 }, (_, k) => {
        const y = h0 + (k + 1) * d.alzada;
        return (
          <mesh key={k} position={[(k + 0.5) * d.huella, y - 0.018, 0]} material={mat(y)} castShadow receiveShadow>
            <boxGeometry args={[d.huella + 0.03, 0.036, t.ancho - 0.1]} />
          </mesh>
        );
      })}
      {/* Zancas */}
      {[-1, 1].map((s) => (
        <mesh
          key={`z${s}`}
          position={[d.largo / 2, medio, (s * (t.ancho - 0.05)) / 2]}
          rotation={[0, 0, d.pendiente]}
          material={mat(medio)}
          castShadow
        >
          <boxGeometry args={[d.largoZanca, 0.2, 0.05]} />
        </mesh>
      ))}
      {/* Baranda: pasamanos paralelo a la pendiente y parantes */}
      {ladosBaranda.map((s) => {
        const z = (s * t.ancho) / 2;
        const parantes = Math.max(2, Math.round(d.largo / 0.3) + 1);
        return (
          <group key={`b${s}`}>
            <mesh position={[d.largo / 2, medio + 0.9, z]} rotation={[0, 0, d.pendiente]} material={mat(medio + 0.9)} castShadow>
              <boxGeometry args={[Math.hypot(d.largo, d.subida), 0.045, 0.045]} />
            </mesh>
            {Array.from({ length: parantes }, (_, k) => {
              const u = (d.largo * k) / (parantes - 1);
              const base = h0 + (u / d.largo) * d.subida;
              return (
                <mesh key={k} position={[u, base + 0.45, z]} material={mat(base + 0.45)} castShadow>
                  <boxGeometry args={[0.04, 0.9, 0.04]} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

function Descanso3D({
  poligono,
  altura,
  mat,
}: {
  poligono: [number, number][];
  altura: number;
  mat: (y: number) => ReturnType<typeof mate>;
}) {
  const geo = useMemo(() => {
    const forma = new THREE.Shape(poligono.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(forma, { depth: 0.05, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [poligono]);
  return (
    <>
      <mesh geometry={geo} position-y={altura - 0.05} material={mat(altura)} castShadow receiveShadow />
      {poligono.map(([x, z], k) => (
        <mesh key={k} position={[x, altura / 2, z]} material={mat(altura / 2)} castShadow>
          <boxGeometry args={[0.06, altura, 0.06]} />
        </mesh>
      ))}
    </>
  );
}
