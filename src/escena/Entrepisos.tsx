import { useMemo } from 'react';
import * as THREE from 'three';
import type { Entrepiso, Punto2 } from '../data/tipos';
import { useCasaResuelta } from '../estado';
import { mate } from './materiales';

export function Entrepisos({ corte }: { corte: number }) {
  const { casa } = useCasaResuelta();
  return (
    <group name="entrepisos">
      {casa.entrepisos.map((en) => (
        <Entrepiso3D key={en.id} en={en} corte={corte} />
      ))}
    </group>
  );
}

function Entrepiso3D({ en, corte }: { en: Entrepiso; corte: number }) {
  // Si está por encima del corte (planta / paredes bajas), se dibuja translúcido.
  const arribaDelCorte = en.nivel > corte;
  const material = mate(en.color, { opacidad: arribaDelCorte ? 0.35 : 1 });

  const losa = useMemo(() => {
    const forma = new THREE.Shape(en.poligono.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geo = new THREE.ExtrudeGeometry(forma, { depth: en.espesor, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2); // la extrusión queda hacia +Y
    return geo;
  }, [en.poligono, en.espesor]);

  // La baranda (o los listones) se corta a la altura de corte de la vista.
  const altoBaranda = Math.min(en.altoBaranda ?? 0.9, corte - en.nivel);
  const separacion = en.separacionBaranda ?? 0.14;
  const balaustres = useMemo(() => {
    const lista: Punto2[] = [];
    for (const tramo of en.barandas ?? []) {
      for (let k = 0; k < tramo.length - 1; k++) {
        const [x0, z0] = tramo[k];
        const [x1, z1] = tramo[k + 1];
        const l = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.max(1, Math.round(l / separacion));
        for (let j = 0; j <= n; j++) lista.push([x0 + ((x1 - x0) * j) / n, z0 + ((z1 - z0) * j) / n]);
      }
    }
    return lista;
  }, [en.barandas, separacion]);

  const vigas = en.vigas;
  const materialVigas = mate(vigas?.color ?? en.color, { opacidad: arribaDelCorte ? 0.35 : 1 });

  return (
    <group userData={{ entrepiso: en.id }}>
      <mesh geometry={losa} position-y={en.nivel - en.espesor} material={material} castShadow={!arribaDelCorte} receiveShadow />
      {vigas?.ejes.map(([[x0, z0], [x1, z1]], k) => (
        <mesh
          key={`v${k}`}
          position={[(x0 + x1) / 2, en.nivel - en.espesor - vigas.alto / 2, (z0 + z1) / 2]}
          rotation={[0, Math.atan2(-(z1 - z0), x1 - x0), 0]}
          material={materialVigas}
          castShadow={!arribaDelCorte}
          receiveShadow
        >
          <boxGeometry args={[Math.hypot(x1 - x0, z1 - z0), vigas.alto, vigas.ancho]} />
        </mesh>
      ))}
      {(en.postes ?? []).map(([x, z], k) => (
        <mesh key={k} position={[x, Math.min(en.nivel, corte) / 2, z]} material={mate(en.color)} castShadow>
          <boxGeometry args={[0.08, Math.min(en.nivel, corte), 0.08]} />
        </mesh>
      ))}
      {!arribaDelCorte && altoBaranda > 0.05 && (
        <>
          {(en.barandas ?? []).flatMap((tramo, t) =>
            tramo.slice(0, -1).map(([x0, z0], k) => {
              const [x1, z1] = tramo[k + 1];
              const l = Math.hypot(x1 - x0, z1 - z0);
              return (
                <mesh
                  key={`${t}-${k}`}
                  position={[(x0 + x1) / 2, en.nivel + altoBaranda, (z0 + z1) / 2]}
                  rotation={[0, Math.atan2(-(z1 - z0), x1 - x0), 0]}
                  material={mate(en.color)}
                  castShadow
                >
                  <boxGeometry args={[l + 0.05, 0.05, 0.05]} />
                </mesh>
              );
            }),
          )}
          {balaustres.map(([x, z], k) => (
            <mesh key={`b${k}`} position={[x, en.nivel + altoBaranda / 2, z]} material={mate(en.color)} castShadow>
              <boxGeometry args={[0.03, altoBaranda, 0.03]} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}
