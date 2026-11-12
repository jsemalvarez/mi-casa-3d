import type { ThreeEvent } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Punto3 } from '../data/tipos';
import { nivelAlto, useCasaResuelta, useElectrica, useEstado } from '../estado';
import type { ElectricaResuelta, ModuloResuelto, PuntoResuelto, TramoResuelto } from '../modelo/electrica';
import { mate } from './materiales';
import { Line } from './drei';
import { manito, tocado } from './tocar';

export const NEGRO = '#1b1c1e';
const TECLA = '#f2b84b';
const COMBINACION = '#e8833a';
/** Cuánto se separa una caja de la pared (m): su profundidad. */
const PROF_CAJA = 0.035;

/** Orientación con el eje Z local a lo largo de `a`→`b` y el Y local hacia `normal`. */
function orientar(dir: THREE.Vector3, normal: THREE.Vector3) {
  const z = dir.clone().normalize();
  const y = normal.clone().sub(z.clone().multiplyScalar(normal.dot(z))).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** Orientación de algo apoyado en una pared: Z local hacia afuera de la pared, Y hacia arriba. */
export function deFrente(normal: Punto3) {
  const n = new THREE.Vector3(...normal);
  if (Math.abs(n.y) > 0.9) return new THREE.Quaternion(); // en el techo
  const z = new THREE.Vector3(n.x, 0, n.z).normalize();
  const y = new THREE.Vector3(0, 1, 0);
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/** Canal, cajas y tablero (los artefactos de luz están en `Luces`). En planta, filtra por piso (planta baja u oficina). */
export function Electrica() {
  const visible = useEstado((s) => s.electrica);
  const modo = useEstado((s) => s.modo);
  const verOficina = useEstado((s) => s.verOficina);
  const { casa } = useCasaResuelta();
  const e = useElectrica();
  if (!visible) return null;
  const plano = modo === 'planta';
  const nivel = nivelAlto(casa);
  // En planta se ve un piso por vez: arriba (con "Oficina") o abajo.
  const mostrar = (y0: number, y1: number) => {
    if (!plano || nivel <= 0) return true;
    return verOficina ? y1 >= nivel - 0.01 : y0 < nivel - 0.01;
  };
  return (
    <group name="electrica">
      {e.linea && mostrar(0, 0) && <LineaPrincipal3D linea={e.linea} plano={plano} />}
      {e.tramos
        .filter((t) => mostrar(Math.min(t.a[1], t.b[1]), Math.max(t.a[1], t.b[1])))
        .map((t, k) => (plano ? <CanalPlanta key={k} t={t} /> : <Canal key={k} t={t} />))}
      {!plano &&
        e.pasamuros
          .filter((d) => mostrar(d.pos[1], d.pos[1]))
          .map((d, k) => <Pasamuro key={k} pos={d.pos} normal={d.normal} />)}
      {e.derivaciones
        .filter((d) => mostrar(d.pos[1], d.pos[1]))
        .map((d, k) => (
          <Derivacion key={k} pos={d.pos} normal={d.normal} />
        ))}
      {e.puntos
        .filter((p) => p.clase !== 'luz' && mostrar(p.pos[1], p.pos[1]))
        .map((p) => (
          <Punto key={p.id} p={p} plano={plano} nivel={nivel} />
        ))}
    </group>
  );
}

function Canal({ t }: { t: TramoResuelto }) {
  const { pos, quat, largo } = useMemo(() => {
    const a = new THREE.Vector3(...t.a);
    const b = new THREE.Vector3(...t.b);
    const dir = b.clone().sub(a);
    const n = new THREE.Vector3(...t.normal);
    // Apenas más largo, para que las esquinas no queden abiertas.
    const largo = dir.length() + t.medida.ancho;
    const pos = a
      .clone()
      .add(b)
      .multiplyScalar(0.5)
      .addScaledVector(n, t.medida.alto / 2 + 0.002);
    return { pos, quat: orientar(dir, n), largo };
  }, [t]);
  return (
    <mesh position={pos} quaternion={quat} material={mate(NEGRO)} castShadow userData={{ canal: t.medida.nombre }}>
      <boxGeometry args={[t.medida.ancho, t.medida.alto, largo]} />
    </mesh>
  );
}

/** Color del canal en planta (el negro real se confunde con el corte de las paredes). */
const CANAL_PLANTA = '#ff7a3d';

/**
 * En planta: una franja de color pegada a la pared (o por el techo), del ancho del canal visto desde
 * arriba más un poco para que se lea. Las bajadas verticales no se ven: las marcan las fichas.
 */
function CanalPlanta({ t }: { t: TramoResuelto }) {
  const datos = useMemo(() => {
    const a = new THREE.Vector3(t.a[0], 0, t.a[2]);
    const b = new THREE.Vector3(t.b[0], 0, t.b[2]);
    const dir = b.clone().sub(a);
    if (dir.length() < 0.01) return null;
    const ancho = Math.max(0.03, t.medida.alto * 2);
    const n = new THREE.Vector3(t.normal[0], 0, t.normal[2]);
    const desplazo = n.lengthSq() > 0.5 ? n.normalize().multiplyScalar(ancho / 2) : new THREE.Vector3();
    const y = Math.max(t.a[1], t.b[1]);
    const pos = a.clone().add(b).multiplyScalar(0.5).add(desplazo).setY(y);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
    return { pos, quat, largo: dir.length() + ancho, ancho };
  }, [t]);
  if (!datos) return null;
  return (
    <mesh position={datos.pos} quaternion={datos.quat} material={mate(CANAL_PLANTA)}>
      <boxGeometry args={[datos.largo, 0.01, datos.ancho]} />
    </mesh>
  );
}

/** Color de la línea principal (del medidor al tablero). */
const COLOR_LINEA = '#d9472b';

/**
 * Medidor (sobre un pilar, esquemático) y recorrido de la línea principal hasta el tablero.
 * Si va enterrada, se dibuja con trazos a ras del piso.
 */
function LineaPrincipal3D({ linea, plano }: { linea: NonNullable<ElectricaResuelta['linea']>; plano: boolean }) {
  const [x, y, z] = linea.medidor;
  return (
    <group name="linea-principal">
      <mesh position={[x, (y + 0.35) / 2, z]} material={mate('#b9b3a8')} castShadow>
        <boxGeometry args={[0.3, y + 0.35, 0.3]} />
      </mesh>
      <mesh position={[x, y, z + 0.19]} material={mate('#e9eaec')}>
        <boxGeometry args={[0.26, 0.4, 0.08]} />
      </mesh>
      <Line
        points={linea.puntos}
        color={COLOR_LINEA}
        lineWidth={plano ? 2.5 : 2}
        dashed={linea.enterrada}
        dashSize={0.25}
        gapSize={0.15}
      />
    </group>
  );
}

/** Donde el canal llega a la pared y el cable la atraviesa: un pasamuro (aro negro) en el agujero. */
function Pasamuro({ pos, normal }: { pos: Punto3; normal: Punto3 }) {
  const n = new THREE.Vector3(...normal);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  const p = new THREE.Vector3(...pos).addScaledVector(n, 0.006);
  return (
    <group position={p} quaternion={q}>
      <mesh material={mate(NEGRO)}>
        <cylinderGeometry args={[0.024, 0.024, 0.012, 20]} />
      </mesh>
      <mesh position={[0, 0.0065, 0]} material={mate('#5b6066')}>
        <cylinderGeometry args={[0.011, 0.011, 0.002, 16]} />
      </mesh>
    </group>
  );
}

function Derivacion({ pos, normal }: { pos: Punto3; normal: Punto3 }) {
  const n = new THREE.Vector3(...normal);
  const p = new THREE.Vector3(...pos).addScaledVector(n, 0.025);
  return (
    <mesh position={p} quaternion={deFrente(normal)} material={mate(NEGRO)}>
      <boxGeometry args={[0.1, 0.1, 0.05]} />
    </mesh>
  );
}

function Punto({ p, plano, nivel }: { p: PuntoResuelto; plano: boolean; nivel: number }) {
  if (p.clase === 'tablero') return <Tablero p={p} />;
  if (p.clase === 'caja') return <Caja p={p} plano={plano} nivel={nivel} />;
  return null;
}

function Tablero({ p }: { p: PuntoResuelto }) {
  const prof = 0.1;
  const n = new THREE.Vector3(...p.normal);
  const pos = new THREE.Vector3(...p.pos).addScaledVector(n, prof / 2);
  return (
    <group position={pos} quaternion={deFrente(p.normal)} userData={{ electrica: p.id }}>
      <mesh material={mate('#e3e5e7')} castShadow>
        <boxGeometry args={[p.ancho ?? 0.3, p.alto ?? 0.3, prof]} />
      </mesh>
      {/* Visor de las térmicas */}
      <mesh position={[0, 0.02, prof / 2 + 0.002]} material={mate('#6f7880')}>
        <boxGeometry args={[(p.ancho ?? 0.3) * 0.8, 0.06, 0.004]} />
      </mesh>
    </group>
  );
}

/** Caja exterior negra con sus módulos de frente (tomas blancos con el color del circuito, teclas). */
function Caja({ p, plano, nivel }: { p: PuntoResuelto; plano: boolean; nivel: number }) {
  const n = new THREE.Vector3(...p.normal);
  const pos = new THREE.Vector3(...p.pos).addScaledVector(n, PROF_CAJA / 2);
  const bastidores = Math.max(1, Math.ceil(p.modulos.length / 3));
  const ancho = 0.075 * bastidores;
  const alto = 0.12;
  const modAlto = 0.03;
  const alternarLuces = useEstado((s) => s.alternarLuces);
  return (
    <group userData={{ electrica: p.id }}>
      <group position={pos} quaternion={deFrente(p.normal)}>
        <mesh material={mate(NEGRO)} castShadow>
          <boxGeometry args={[ancho, alto, PROF_CAJA]} />
        </mesh>
        {p.modulos.map((m, k) => {
          const col = Math.floor(k / 3);
          const fila = k % 3;
          const x = -ancho / 2 + 0.0375 + col * 0.075;
          const y = (1 - fila) * (modAlto + 0.004);
          const cara = m.tipo === 'tecla' ? TECLA : m.tipo === 'combinacion' ? COMBINACION : '#f4f4f2';
          return (
            <group key={k} position={[x, y, PROF_CAJA / 2 + 0.002]} {...(m.luces ? tocarTecla(m, alternarLuces) : {})}>
              <mesh material={mate(cara)}>
                <boxGeometry args={[0.045, modAlto, 0.004]} />
              </mesh>
              {(m.tipo === 'toma' || m.tipo === 'toma-exterior') && (
                <mesh position={[0, 0, 0.003]} material={mate(m.color)}>
                  <boxGeometry args={[0.02, 0.012, 0.003]} />
                </mesh>
              )}
            </group>
          );
        })}
      </group>
      {/* En planta, una ficha de color hacia adentro del ambiente para leer el plano. */}
      {plano && <FichaPlanta p={p} nivel={nivel} />}
    </group>
  );
}

/** Altura de las fichas: por encima del corte de la planta (1,20) para que no las tapen los muebles. */
const ALTO_FICHA = 1.3;

function FichaPlanta({ p, nivel }: { p: PuntoResuelto; nivel: number }) {
  const piso = nivel > 0 && p.pos[1] >= nivel - 0.01 ? nivel : 0;
  const tieneTecla = p.modulos.some((m) => m.tipo === 'tecla' || m.tipo === 'combinacion');
  const toma = p.modulos.find((m) => m.tipo === 'toma' || m.tipo === 'toma-exterior');
  const colores = [...(tieneTecla ? [TECLA] : []), ...(toma ? [toma.color] : [])];
  const n = new THREE.Vector3(p.normal[0], 0, p.normal[2]).normalize();
  const t = new THREE.Vector3(-n.z, 0, n.x);
  return (
    <>
      {colores.map((c, k) => {
        const pos = new THREE.Vector3(p.pos[0], piso + ALTO_FICHA, p.pos[2])
          .addScaledVector(n, 0.11)
          .addScaledVector(t, (k - (colores.length - 1) / 2) * 0.13);
        return (
          <mesh key={k} position={pos} material={mate(c)}>
            {k === 0 && tieneTecla ? <boxGeometry args={[0.1, 0.01, 0.1]} /> : <cylinderGeometry args={[0.055, 0.055, 0.01, 20]} />}
          </mesh>
        );
      })}
    </>
  );
}

/** Tocar una tecla prende o apaga sus luces (las de una combinación, desde cualquiera de las dos cajas). */
function tocarTecla(m: ModuloResuelto, alternar: (ids: string[]) => void) {
  return {
    ...manito,
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (!tocado(e)) return;
      e.stopPropagation();
      alternar(m.luces ?? []);
    },
  };
}
