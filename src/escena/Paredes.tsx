import { useMemo } from 'react';
import { colorCara, type ParedResuelta } from '../modelo/geometria';
import { useCasaResuelta } from '../estado';
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
      {p.aberturas.map((ab) => (
        <Abertura3D key={ab.id} ab={ab} espesor={p.espesor} corte={corte} plano={plano} />
      ))}
    </group>
  );
}
