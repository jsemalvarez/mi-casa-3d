import { useMemo } from 'react';
import * as THREE from 'three';
import type { Punto2 } from '../data/tipos';
import { useCasaResuelta } from '../estado';
import { agrandar, type TechoResuelto } from '../modelo/techos';
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
  const { casa, techos } = useCasaResuelta();
  return (
    <group name="techos">
      {casa.ambientes
        .filter((a) => !a.exterior && !a.techo && (a.alturaTecho ?? casa.alturaTecho) <= corte)
        .map((a) => (
          <Techo
            key={a.id}
            poli={a.poligono}
            color={a.colorTecho ?? casa.colores.techo}
            y={a.alturaTecho ?? casa.alturaTecho}
            sombra={hacenSombra}
          />
        ))}
      {techos.map((t) => {
        const amb = casa.ambientes.find((a) => a.id === t.ambiente);
        return (
          <TechoInclinado
            key={t.ambiente}
            t={t}
            color={amb?.colorTecho ?? casa.colores.techo}
            corte={corte}
            sombra={hacenSombra}
          />
        );
      })}
    </group>
  );
}

/** No se dibuja: solo hace sombra (de los dos lados). */
const SOLO_SOMBRA = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide });

/**
 * Techo inclinado visto desde adentro: las tablas de cada faldón, la viga de la cumbrera y las
 * vigas chicas. Si queda por encima del corte (planta, paredes bajas) solo se ven las vigas, translúcidas.
 */
function TechoInclinado({ t, color, corte, sombra }: { t: TechoResuelto; color: string; corte: number; sombra: boolean }) {
  const { techo } = t;
  const arribaDelCorte = techo.alturaCumbrera > corte;
  // Doble cara: en las vistas de pared las vigas quedan cortadas y así se ve su sección.
  const estilo = { opacidad: arribaDelCorte ? 0.35 : 1, lado: THREE.DoubleSide };
  const sombraVigas = sombra && !arribaDelCorte;

  const faldones = useMemo(
    () =>
      t.faldones.map((f) => {
        // Las tablas se meten 5 cm en las paredes (sin eso el sol se filtra por la junta). Del lado
        // de la cumbrera, lo que sobra queda por encima del otro faldón y no se ve.
        const poli = agrandar(f.poligono, 0.05);
        const forma = new THREE.Shape(poli.map(([x, z]) => new THREE.Vector2(x, -z)));
        const geo = new THREE.ShapeGeometry(forma);
        geo.rotateX(-Math.PI / 2);
        // Se levanta cada vértice hasta el plano inclinado del faldón (prolongado fuera del ambiente).
        const pos = geo.attributes.position;
        for (let k = 0; k < pos.count; k++) {
          const avance = (pos.getX(k) - t.a[0]) * f.baja[0] + (pos.getZ(k) - t.a[1]) * f.baja[1];
          pos.setY(k, techo.alturaCumbrera - f.pendiente * avance);
        }
        geo.computeVertexNormals();
        return geo;
      }),
    [t, techo.alturaCumbrera],
  );

  const viga = techo.viga;
  const chicas = techo.vigasChicas;
  const anguloCumbrera = Math.atan2(-t.dir[1], t.dir[0]);
  const medio: Punto2 = [t.a[0] + (t.dir[0] * t.largo) / 2, t.a[1] + (t.dir[1] * t.largo) / 2];

  // Vigas chicas repartidas parejas a lo largo de la cumbrera: la primera y la última contra las
  // paredes, o todas separadas con media distancia hasta cada pared.
  const posiciones = chicas
    ? Array.from({ length: chicas.porLado }, (_, k) =>
        chicas.extremos === 'separadas' || chicas.porLado === 1
          ? ((k + 0.5) * t.largo) / chicas.porLado
          : chicas.ancho / 2 + (k * (t.largo - chicas.ancho)) / (chicas.porLado - 1),
      )
    : [];

  return (
    <group userData={{ techo: t.ambiente }}>
      {!arribaDelCorte &&
        faldones.map((geo, k) => (
          // Se ve solo desde abajo: desde arriba (vista 3D) queda abierto, como los techos planos.
          <mesh key={k} geometry={geo} material={mate(color, { lado: THREE.BackSide })} castShadow={sombra} receiveShadow />
        ))}
      {!arribaDelCorte &&
        sombra &&
        faldones.map((geo, k) => (
          // Espesor del techo, solo para la sombra: con las tablas solas el sol se cuela pegado a
          // ellas y deja una raya de luz arriba de las paredes que dan al sol.
          <mesh key={`s${k}`} geometry={geo} position-y={0.08} material={SOLO_SOMBRA} castShadow />
        ))}
      {viga && (
        <mesh
          position={[medio[0], techo.alturaCumbrera - viga.alto / 2, medio[1]]}
          rotation={[0, anguloCumbrera, 0]}
          material={mate(viga.color, estilo)}
          castShadow={sombraVigas}
          receiveShadow
        >
          {/* 2 mm más corta en cada punta: así su cabeza no se pisa con la cara de la pared. */}
          <boxGeometry args={[t.largo - 0.004, viga.alto, viga.ancho]} />
        </mesh>
      )}
      {chicas &&
        t.faldones.flatMap((f, j) => {
          const inclinacion = Math.atan(f.pendiente);
          const [cos, sin] = [Math.cos(inclinacion), Math.sin(inclinacion)];
          // A lo largo de la pendiente: desde el costado de la viga grande hasta meterse en la pared.
          const s0 = (viga ? viga.ancho / 2 : 0) / cos;
          const s1 = (f.ancho + chicas.alto * sin) / cos;
          return posiciones.map((u, k) => (
            <group
              key={`${j}-${k}`}
              position={[t.a[0] + t.dir[0] * u, techo.alturaCumbrera, t.a[1] + t.dir[1] * u]}
              // Primero se inclina (giro en Z local) y después se orienta hacia donde baja (giro en Y).
              rotation={[0, Math.atan2(-f.baja[1], f.baja[0]), -inclinacion]}
            >
              <mesh
                position={[(s0 + s1) / 2, -chicas.alto / 2, 0]}
                material={mate(chicas.color, estilo)}
                castShadow={sombraVigas}
                receiveShadow
              >
                <boxGeometry args={[s1 - s0, chicas.alto, chicas.ancho]} />
              </mesh>
            </group>
          ));
        })}
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
