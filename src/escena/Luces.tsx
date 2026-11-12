import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { instalacion } from '../data/electrica';
import type { Casa, Luz as DatoLuz, Punto3, TipoLuz } from '../data/tipos';
import { nivelAlto, useCasaResuelta, useElectrica, useEstado } from '../estado';
import type { PuntoResuelto } from '../modelo/electrica';
import { caja } from '../modelo/geometria';
import { alturaMaximaTecho } from '../modelo/techos';
import { deFrente, NEGRO } from './Electrica';
import { Line } from './drei';
import { mate } from './materiales';
import { manito, tocado } from './tocar';
import { cargarZonas, type ZonaLuz } from './zonasLuz';

/** Blanco cálido (unos 3000 K). */
const COLOR_LUZ = '#ffd9ab';

/**
 * Intensidad de cada lámpara, en las unidades de three.js (candelas). Están ajustadas a ojo
 * para que se parezca a una lámpara LED común de 9 a 12 W; no sirven para calcular lux.
 */
const INTENSIDAD: Record<TipoLuz, number> = {
  colgante: 5,
  plafon: 6,
  aplique: 2,
  'aplique-exterior': 2.5,
  'tira-led': 0.7, // por cada foco de la tira
  guirnalda: 0.8, // por cada tramo
};
/** Luz pareja que suma la lámpara en todo su ambiente (rebote en paredes, piso y techo). */
const REBOTE_INTERIOR = 0.04;
const REBOTE_EXTERIOR = 0.01;

const matApagada = new THREE.MeshStandardMaterial({ color: '#ece9e1', roughness: 0.55 });
const matPrendida = new THREE.MeshStandardMaterial({
  color: '#fff5df',
  emissive: '#ffcf86',
  emissiveIntensity: 2.2,
  roughness: 0.55,
});

/** Una fuente de luz de three.js: luz puntual (para todos lados) o foco (hacia `hacia`). */
interface Fuente {
  pos: Punto3;
  /** Solo focos: hacia dónde apunta, relativo a `pos`. */
  hacia?: Punto3;
  angulo?: number;
  penumbra?: number;
  intensidad: number;
}

/** Luces y artefactos de la casa. Tocar un artefacto (o su tecla) lo prende o lo apaga. */
export function Luces() {
  const e = useElectrica();
  const { casa } = useCasaResuelta();
  const prendidas = useEstado((s) => s.lucesPrendidas);
  const modo = useEstado((s) => s.modo);
  const verOficina = useEstado((s) => s.verOficina);
  const escena = useThree((s) => s.scene);
  const lista = useMemo(() => {
    const datos = new Map(instalacion.luces.map((l) => [l.id, l]));
    return e.puntos
      .filter((p) => p.clase === 'luz')
      .map((p) => {
        const zona = zonaDe(p, datos.get(p.id), casa);
        return { p, fuentes: fuentesDe(p).map((f) => ({ ...f, zona })) };
      });
  }, [e, casa]);
  // Las zonas se cargan en el orden de las luces de la escena, antes de cada cuadro.
  useFrame(() => cargarZonas(escena));

  // En planta se ven los artefactos de un piso por vez (como el canal); la luz sale igual.
  const nivel = nivelAlto(casa);
  const seVe = (y: number) => modo !== 'planta' || nivel <= 0 || (verOficina ? y >= nivel - 0.01 : y < nivel - 0.01);
  return (
    <group name="luces">
      {lista.map(({ p, fuentes }) => (
        <group key={p.id}>
          {fuentes.map((f, k) => (
            <FuenteLuz key={k} f={f} zona={f.zona} prendida={!!prendidas[p.id]} />
          ))}
          {seVe(p.pos[1]) && <Artefacto p={p} prendida={!!prendidas[p.id]} />}
        </group>
      ))}
    </group>
  );
}

/**
 * Las fuentes siempre están montadas (con intensidad 0 si la luz está apagada): si se agregaran o
 * sacaran, three.js recompilaría todos los materiales.
 */
function FuenteLuz({ f, zona, prendida }: { f: Fuente; zona: ZonaLuz; prendida: boolean }) {
  const foco = useRef<THREE.SpotLight>(null);
  useLayoutEffect(() => {
    const l = foco.current;
    if (!l || !f.hacia) return;
    // El objetivo cuelga del foco: se mueve con él y three.js lo actualiza solo.
    l.add(l.target);
    l.target.position.set(...f.hacia);
  }, [f.hacia]);
  const intensidad = prendida ? f.intensidad : 0;
  if (f.hacia) {
    return (
      <spotLight
        ref={foco}
        position={f.pos}
        color={COLOR_LUZ}
        intensity={intensidad}
        angle={f.angulo ?? 1}
        penumbra={f.penumbra ?? 0.5}
        decay={2}
        distance={0}
        userData={{ zona }}
      />
    );
  }
  return <pointLight position={f.pos} color={COLOR_LUZ} intensity={intensidad} decay={2} distance={0} userData={{ zona }} />;
}

/** Dónde sale la luz de cada artefacto. */
function fuentesDe(p: PuntoResuelto): Fuente[] {
  const [x, y, z] = p.pos;
  const n = new THREE.Vector3(...p.normal);
  const enFrente = (d: number, bajar = 0): Punto3 => [x + n.x * d, y - bajar, z + n.z * d];
  const I = INTENSIDAD[p.tipoLuz ?? 'plafon'];
  switch (p.tipoLuz) {
    case 'colgante': {
      // Foco hacia abajo desde la lámpara: la pantalla no deja subir la luz.
      const bajo = (p.cuelga ?? 0.6) + 0.1;
      return [{ pos: [x, y - bajo, z], hacia: [0, -1, 0], angulo: 1.2, penumbra: 0.6, intensidad: I }];
    }
    case 'plafon':
      return [{ pos: [x, y - 0.1, z], intensidad: I }];
    case 'aplique':
      return [{ pos: enFrente(0.14), intensidad: I }];
    case 'aplique-exterior':
      // Tipo tortuga con la luz hacia abajo: alumbra la pared y el piso de afuera.
      return [{ pos: enFrente(0.07, 0.1), hacia: [n.x * 0.35, -1, n.z * 0.35], angulo: 0.95, penumbra: 0.9, intensidad: I }];
    case 'guirnalda': {
      // Una luz puntual en lo más bajo de cada tramo.
      const g = p.ganchos ?? [];
      const c = p.cuelga ?? 0.3;
      return g.slice(1).map((b, k) => {
        const a = g[k];
        return { pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - c - 0.05, (a[2] + b[2]) / 2] as Punto3, intensidad: I };
      });
    }
    case 'tira-led': {
      // Varios focos a lo largo de la tira, hacia la mesada.
      const largo = p.largo ?? 1;
      const cant = Math.max(1, Math.round(largo / 0.6));
      const t = new THREE.Vector3(-n.z, 0, n.x);
      return Array.from({ length: cant }, (_, k) => {
        const d = (k + 0.5 - cant / 2) * (largo / cant);
        const pos: Punto3 = [x + n.x * 0.05 + t.x * d, y - 0.03, z + n.z * 0.05 + t.z * d];
        return { pos, hacia: [n.x * 0.35, -1, n.z * 0.35] as Punto3, angulo: 1.3, penumbra: 1, intensidad: I };
      });
    }
    default:
      return [{ pos: [x, y - 0.1, z], intensidad: I }];
  }
}

const E = 0.03;

/**
 * Caja donde alumbra una lámpara: su ambiente (de piso a techo), la oficina si está arriba, el
 * ambiente de afuera donde cae (patio, frente, pasillo) o un pedazo de vereda. Las de pared no
 * alumbran detrás de su pared. Ver `zonasLuz.ts`.
 */
function zonaDe(p: PuntoResuelto, dato: DatoLuz | undefined, casa: Casa): ZonaLuz {
  const [x, y, z] = p.pos;
  const dentro = (b: ReturnType<typeof caja>, m: number) => x >= b.x0 - m && x <= b.x1 + m && z >= b.z0 - m && z <= b.z1 + m;
  const propio = casa.ambientes.find((a) => a.id === dato?.ambiente);
  const amb =
    propio && dentro(caja(propio.poligono), E) ? propio : casa.ambientes.find((a) => a.exterior && dentro(caja(a.poligono), 0.08));
  let zona: ZonaLuz;
  if (amb) {
    const b = caja(amb.poligono);
    let y0 = -0.1;
    let y1 = amb.exterior ? 9 : alturaMaximaTecho(amb, casa.alturaTecho) + 0.4;
    if (!amb.exterior) {
      const arriba = casa.entrepisos.find((en) => en.id === dato?.entrepiso);
      const debajo = casa.entrepisos.find((en) => y < en.nivel && dentro(caja(en.poligono), -E));
      if (arriba) y0 = arriba.nivel - 0.03;
      else if (debajo) y1 = debajo.nivel - 0.05; // abajo del entrepiso: no alumbra arriba de su piso
    }
    zona = {
      min: [b.x0 - E, y0, b.z0 - E],
      max: [b.x1 + E, y1, b.z1 + E],
      rebote: amb.exterior ? REBOTE_EXTERIOR : REBOTE_INTERIOR,
    };
  } else {
    // En una fachada sin ambiente: un pedazo de vereda delante de la pared.
    zona = { min: [x - 12, -0.1, z - 12], max: [x + 12, 9, z + 12], rebote: REBOTE_EXTERIOR };
  }
  // Las de pared: solo delante de su pared.
  const [nx, ny, nz] = p.normal;
  if (Math.abs(ny) < 0.5) {
    if (Math.abs(nx) >= Math.abs(nz)) {
      if (nx < 0) zona.max[0] = Math.min(zona.max[0], x + E);
      else zona.min[0] = Math.max(zona.min[0], x - E);
    } else if (nz < 0) zona.max[2] = Math.min(zona.max[2], z + E);
    else zona.min[2] = Math.max(zona.min[2], z - E);
  }
  return zona;
}

/** El artefacto que se ve: colgante, plafón, aplique o tira de LED. */
function Artefacto({ p, prendida }: { p: PuntoResuelto; prendida: boolean }) {
  const alternar = useEstado((s) => s.alternarLuces);
  const tocar = {
    ...manito,
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (!tocado(e)) return;
      e.stopPropagation();
      alternar([p.id]);
    },
  };
  const luz = prendida ? matPrendida : matApagada;
  const pos = new THREE.Vector3(...p.pos);
  switch (p.tipoLuz) {
    case 'colgante': {
      const cuelga = p.cuelga ?? 0.6;
      return (
        <group position={pos} userData={{ electrica: p.id }} {...tocar}>
          <mesh position={[0, -0.02, 0]} material={mate(NEGRO)}>
            <cylinderGeometry args={[0.05, 0.05, 0.04, 20]} />
          </mesh>
          <mesh position={[0, -cuelga / 2, 0]} material={mate(NEGRO)}>
            <cylinderGeometry args={[0.004, 0.004, cuelga, 6]} />
          </mesh>
          <mesh position={[0, -cuelga - 0.07, 0]} material={mate('#2b2d30', { lado: THREE.DoubleSide })} castShadow>
            <coneGeometry args={[0.16, 0.15, 28, 1, true]} />
          </mesh>
          <mesh position={[0, -cuelga - 0.1, 0]} material={luz}>
            <sphereGeometry args={[0.045, 16, 12]} />
          </mesh>
        </group>
      );
    }
    case 'plafon':
      return (
        <group position={pos} userData={{ electrica: p.id }} {...tocar}>
          <mesh position={[0, -0.025, 0]} material={luz}>
            <cylinderGeometry args={[0.16, 0.16, 0.05, 32]} />
          </mesh>
        </group>
      );
    case 'guirnalda':
      return <Guirnalda p={p} luz={luz} tocar={tocar} />;
    case 'tira-led': {
      const n = new THREE.Vector3(...p.normal);
      const c = pos.clone().addScaledVector(n, 0.03);
      return (
        <mesh position={c} quaternion={deFrente(p.normal)} material={luz} userData={{ electrica: p.id }} {...tocar}>
          <boxGeometry args={[p.largo ?? 1, 0.012, 0.02]} />
        </mesh>
      );
    }
    default: {
      // Apliques (interiores y exteriores)
      const exterior = p.tipoLuz === 'aplique-exterior';
      const prof = exterior ? 0.1 : 0.08;
      const n = new THREE.Vector3(...p.normal);
      const c = pos.clone().addScaledVector(n, prof / 2);
      return (
        <group position={c} quaternion={deFrente(p.normal)} userData={{ electrica: p.id }} {...tocar}>
          <mesh material={mate(exterior ? '#3a3d41' : NEGRO)} castShadow>
            <boxGeometry args={[0.1, exterior ? 0.16 : 0.12, prof]} />
          </mesh>
          <mesh position={[0, exterior ? -0.08 : 0, exterior ? 0 : prof / 2 + 0.003]} material={luz}>
            <boxGeometry args={exterior ? [0.08, 0.01, prof * 0.8] : [0.07, 0.08, 0.006]} />
          </mesh>
        </group>
      );
    }
  }
}

/** Separación entre las lámparas de la guirnalda (m). */
const PASO_LAMPARAS = 0.5;

/**
 * Guirnalda: cable que cuelga entre los ganchos (baja `cuelga` en el medio de cada tramo), con
 * lámparas cada 50 cm, y la caja estanca donde se conecta.
 */
function Guirnalda({
  p,
  luz,
  tocar,
}: {
  p: PuntoResuelto;
  luz: THREE.Material;
  tocar: typeof manito & { onClick: (e: ThreeEvent<MouseEvent>) => void };
}) {
  const d = useMemo(() => {
    const g = (p.ganchos ?? []).map((q) => new THREE.Vector3(...q));
    const c = p.cuelga ?? 0.3;
    const cable: Punto3[] = [];
    const lamparas: THREE.Vector3[] = [];
    // El primer tramo arranca en la caja.
    if (g.length) cable.push(p.pos);
    for (let k = 0; k < g.length - 1; k++) {
      const a = g[k];
      const b = g[k + 1];
      const largo = a.distanceTo(b);
      const punto = (t: number) => a.clone().lerp(b, t).setY(THREE.MathUtils.lerp(a.y, b.y, t) - 4 * c * t * (1 - t));
      const pasos = Math.max(8, Math.ceil(largo / 0.1));
      for (let j = 0; j <= pasos; j++) cable.push(punto(j / pasos).toArray() as Punto3);
      const n = Math.max(1, Math.round(largo / PASO_LAMPARAS));
      for (let j = 0; j < n; j++) lamparas.push(punto((j + 0.5) / n));
    }
    return { g, cable, lamparas };
  }, [p]);
  const n = new THREE.Vector3(...p.normal);
  return (
    <group userData={{ electrica: p.id }} {...tocar}>
      {/* Caja estanca donde se conecta */}
      <mesh position={new THREE.Vector3(...p.pos).addScaledVector(n, 0.03)} quaternion={deFrente(p.normal)} material={mate(NEGRO)}>
        <boxGeometry args={[0.09, 0.09, 0.06]} />
      </mesh>
      {d.g.map((q, k) => (
        <mesh key={k} position={q} material={mate(NEGRO)}>
          <sphereGeometry args={[0.015, 8, 6]} />
        </mesh>
      ))}
      {d.cable.length > 1 && <Line points={d.cable} color={NEGRO} lineWidth={1.5} />}
      {d.lamparas.map((q, k) => (
        <group key={k} position={q}>
          <mesh position={[0, -0.02, 0]} material={mate(NEGRO)}>
            <cylinderGeometry args={[0.012, 0.012, 0.03, 8]} />
          </mesh>
          <mesh position={[0, -0.06, 0]} material={luz}>
            <sphereGeometry args={[0.026, 12, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
