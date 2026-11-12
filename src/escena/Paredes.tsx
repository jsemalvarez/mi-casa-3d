import { useMemo } from 'react';
import * as THREE from 'three';
import type { Punto2 } from '../data/tipos';
import { colorCara, type ParedResuelta } from '../modelo/geometria';
import { recortar } from '../modelo/techos';
import { useCasaResuelta } from '../estado';
import { extruir } from './extruir';
import { mate } from './materiales';
import { Abertura3D } from './Aberturas';

/** Todas las paredes, con sus aberturas. `corte` = altura máxima a dibujar. */
export function Paredes({ corte, plano }: { corte: number; plano: boolean }) {
  const { paredes } = useCasaResuelta();
  return (
    <group name="paredes">
      {paredes.map((p) => (
        <Pared3D key={p.pared.id} p={p} corte={corte} plano={plano} />
      ))}
    </group>
  );
}

function Pared3D({ p, corte, plano }: { p: ParedResuelta; corte: number; plano: boolean }) {
  const { casa } = useCasaResuelta();
  const tope = Math.min(p.alto, corte);
  const mats = useMemo(() => {
    const revoque = mate(casa.colores.paredInterior);
    return {
      izq: mate(colorCara(casa, p, 'izq')),
      der: mate(colorCara(casa, p, 'der')),
      revoque,
      corte: mate(casa.colores.corte),
    };
  }, [casa, p]);

  return (
    // Sistema local de la pared: X a lo largo (de a hacia b), Y arriba, Z hacia la derecha.
    <group position={[p.a[0], 0, p.a[1]]} rotation={[0, p.angulo, 0]}>
      {p.piezas.map((pz, k) => {
        const y0 = pz.y0;
        const y1 = Math.min(pz.y1, tope);
        if (y1 - y0 < 0.001) return null;
        const esTope = y1 >= tope - 0.001;
        // Orden de caras de BoxGeometry: +X, −X, +Y, −Y, +Z (der), −Z (izq)
        const materiales = [
          mats.revoque,
          mats.revoque,
          esTope ? mats.corte : mats.revoque,
          mats.revoque,
          mats.der,
          mats.izq,
        ];
        return (
          <mesh
            key={k}
            position={[(pz.u0 + pz.u1) / 2, (y0 + y1) / 2, 0]}
            material={materiales}
            castShadow
            receiveShadow
            userData={{ pared: p.pared.id }}
          >
            <boxGeometry args={[pz.u1 - pz.u0, y1 - y0, p.espesor]} />
          </mesh>
        );
      })}
      {p.remate && corte > p.alto && (
        <Remate poli={p.remate} espesor={p.espesor} corte={corte} materiales={[mats.izq, mats.der, mats.corte]} id={p.pared.id} />
      )}
      {p.aberturas.map((ab) => (
        <Abertura3D key={ab.id} ab={ab} espesor={p.espesor} corte={corte} plano={plano} />
      ))}
    </group>
  );
}

/** Hastial: la pared sube hasta el techo inclinado (cortado a la altura de la vista). */
function Remate({
  poli,
  espesor,
  corte,
  materiales,
  id,
}: {
  poli: Punto2[];
  espesor: number;
  corte: number;
  materiales: THREE.Material[];
  id: string;
}) {
  const geo = useMemo(() => {
    const recortado = Number.isFinite(corte) ? recortar(poli, ([, y]) => corte - y) : poli;
    if (recortado.length < 3) return null;
    const g = extruir(new THREE.Shape(recortado.map(([u, y]) => new THREE.Vector2(u, y))), espesor);
    g.translate(0, 0, -espesor / 2);
    return g;
  }, [poli, espesor, corte]);
  if (!geo) return null;
  // Tapa de z = 0 → cara izquierda (−Z local); la otra → derecha; costados → color de corte.
  return <mesh geometry={geo} material={materiales} castShadow receiveShadow userData={{ pared: id }} />;
}
