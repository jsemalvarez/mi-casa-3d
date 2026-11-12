import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Abertura, HojaBatiente, HojaCorrediza, HojaDoble, HojaGranero, HojaPlegable } from '../data/tipos';
import { useCasaResuelta, useEstado } from '../estado';
import { Edges, Line } from './drei';
import { mate, vidrio } from './materiales';
import { manito, tocado } from './tocar';

const MARCO = 0.05; // ancho del perfil del marco
const ESP_HOJA = 0.04; // espesor de la hoja de puerta
const COLOR_RIEL = '#2f3337';
const COLOR_PLANO = '#5d646d';
/** Contorno de las hojas: sin él, una puerta blanca contra una pared blanca no se ve. */
const COLOR_CONTORNO = '#7d8389';

type V3 = [number, number, number];

/**
 * Una abertura dibujada en el sistema local de su pared
 * (X = u a lo largo, Y arriba, Z = v hacia el lado derecho mirando de a → b).
 */
export function Abertura3D({
  ab,
  espesor,
  corte,
  plano,
}: {
  ab: Abertura;
  espesor: number;
  corte: number;
  plano: boolean;
}) {
  const { casa } = useCasaResuelta();
  const c = casa.colores;
  const ant = ab.antepecho ?? 0;
  const u0 = ab.desde;
  const u1 = ab.desde + ab.ancho;
  const uc = (u0 + u1) / 2;
  const tope = ant + ab.alto;
  const yMax = Math.min(tope, corte); // hasta dónde se ve
  const prof = Math.min(espesor, 0.09);
  const visible = yMax > ant + 0.001;

  const matMarco = mate(c.marco);
  const matVidrio = vidrio(c.vidrio);
  const hojas = Math.max(1, Math.min(4, ab.hojas ?? 2));
  const hoja = ab.tipo === 'puerta' || ab.tipo === 'puerta-balcon' ? ab.hoja : undefined;
  const corrediza = hoja?.tipo === 'corrediza';

  return (
    <group userData={{ abertura: ab.id }}>
      {/* Umbral bajo puertas y vanos, para que el piso sea continuo */}
      {ant < 0.001 && (
        <mesh position={[uc, 0.003, 0]} material={mate(c.umbral)} receiveShadow>
          <boxGeometry args={[ab.ancho, 0.006, espesor]} />
        </mesh>
      )}

      {/* Marco */}
      {ab.tipo !== 'vano' && visible && (
        <>
          <mesh position={[u0 + MARCO / 2, (ant + yMax) / 2, 0]} material={matMarco} castShadow>
            <boxGeometry args={[MARCO, yMax - ant, prof]} />
          </mesh>
          <mesh position={[u1 - MARCO / 2, (ant + yMax) / 2, 0]} material={matMarco} castShadow>
            <boxGeometry args={[MARCO, yMax - ant, prof]} />
          </mesh>
          {tope <= corte && (
            <mesh position={[uc, tope - MARCO / 2, 0]} material={matMarco} castShadow>
              <boxGeometry args={[ab.ancho, MARCO, prof]} />
            </mesh>
          )}
          {ant > 0 && (
            <mesh position={[uc, ant + MARCO / 2, 0]} material={matMarco}>
              <boxGeometry args={[ab.ancho, MARCO, prof]} />
            </mesh>
          )}
        </>
      )}

      {/* Vidrio y parantes de ventanas y puertas balcón */}
      {(ab.tipo === 'ventana' || ab.tipo === 'puerta-balcon') && visible && (
        <>
          {!corrediza && (() => {
            const y0 = ant + (ant > 0 ? MARCO : 0.06);
            const y1 = Math.min(tope - MARCO, corte);
            if (y1 <= y0) return null;
            return (
              <mesh position={[uc, (y0 + y1) / 2, 0]} material={matVidrio} renderOrder={2}>
                <boxGeometry args={[ab.ancho - 2 * MARCO, y1 - y0, 0.01]} />
              </mesh>
            );
          })()}
          {!corrediza && Array.from({ length: hojas - 1 }, (_, k) => {
            const u = u0 + ((k + 1) * ab.ancho) / hojas;
            return (
              <mesh key={k} position={[u, (ant + yMax) / 2, 0]} material={matMarco} castShadow>
                <boxGeometry args={[MARCO * 0.8, yMax - ant, prof * 0.8]} />
              </mesh>
            );
          })}
          {ab.tipo === 'puerta-balcon' && (
            <mesh position={[uc, 0.03, 0]} material={matMarco}>
              <boxGeometry args={[ab.ancho, 0.06, prof]} />
            </mesh>
          )}
        </>
      )}

      {/* Hoja de la puerta, según cómo abre */}
      {hoja && hoja.tipo === 'plegable' && <HojaPlegable3D ab={ab} hoja={hoja} corte={corte} />}
      {hoja && hoja.tipo === 'granero' && (
        <HojaGranero3D ab={ab} hoja={hoja} espesor={espesor} corte={corte} plano={plano} />
      )}
      {hoja && hoja.tipo === 'doble' && <HojaDoble3D ab={ab} hoja={hoja} espesor={espesor} corte={corte} plano={plano} />}
      {hoja && hoja.tipo === 'corrediza' && <HojaCorrediza3D ab={ab} hoja={hoja} corte={corte} />}
      {hoja && (hoja.tipo === undefined || hoja.tipo === 'batiente') && (
        <HojaBatiente3D ab={ab} hoja={hoja} espesor={espesor} corte={corte} plano={plano} />
      )}
    </group>
  );
}

/**
 * Apertura animada de una puerta (1 abierta, 0 cerrada). `aplicar` se llama en cada cuadro
 * mientras se mueve, para acomodar las mallas sin volver a dibujar con React.
 */
function useApertura(id: string, aplicar: (t: number) => void) {
  const abierta = useEstado((s) => !s.puertasCerradas[id]);
  const t = useRef(abierta ? 1 : 0);
  useFrame((_, dt) => {
    const meta = abierta ? 1 : 0;
    if (t.current === meta) return;
    t.current = THREE.MathUtils.damp(t.current, meta, 5, Math.min(dt, 0.05));
    if (Math.abs(t.current - meta) < 0.002) t.current = meta;
    aplicar(t.current);
  });
  return t;
}

/** Tocar la hoja abre o cierra esa puerta. */
function useTocarPuerta(id: string) {
  const alternar = useEstado((s) => s.alternarPuerta);
  return {
    ...manito,
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (!tocado(e)) return;
      e.stopPropagation();
      alternar(id);
    },
  };
}

/** Puerta de abrir: gira sobre las bisagras de 0° (cerrada) a 90°. En planta, el arco de apertura. */
function HojaBatiente3D({
  ab,
  hoja,
  espesor,
  corte,
  plano,
}: {
  ab: Abertura;
  hoja: HojaBatiente;
  espesor: number;
  corte: number;
  plano: boolean;
}) {
  const { casa } = useCasaResuelta();
  const d = useMemo(() => {
    const u0 = ab.desde;
    const u1 = ab.desde + ab.ancho;
    const lado = hoja.abreHacia === 'der' ? 1 : -1;
    const sentido = hoja.bisagra === 'a' ? 1 : -1;
    const largo = ab.ancho - 0.06;
    const bisagra: [number, number] = [hoja.bisagra === 'a' ? u0 + 0.03 : u1 - 0.03, (lado * espesor) / 2];
    // Giro alrededor de Y que lleva el eje X local de la hoja a su dirección, según cuánto abre.
    const giro = (t: number) => {
      const a = (t * Math.PI) / 2;
      return Math.atan2(-lado * Math.sin(a), sentido * Math.cos(a));
    };
    const arco: V3[] = [];
    for (let k = 0; k <= 24; k++) {
      const a = (Math.PI / 2) * (k / 24);
      arco.push([bisagra[0] + sentido * Math.cos(a) * largo, 0.02, bisagra[1] + lado * Math.sin(a) * largo]);
    }
    // Cerrada, la hoja queda apenas metida en el espesor de la pared.
    return { largo, bisagra, giro, arco, metida: (-lado * sentido * ESP_HOJA) / 2 };
  }, [ab, hoja, espesor]);
  const eje = useRef<THREE.Group>(null);
  const t = useApertura(ab.id, (t) => eje.current?.rotation.set(0, d.giro(t), 0));
  const tocar = useTocarPuerta(ab.id);
  const alto = Math.min(ab.alto - 0.02, corte);
  return (
    <>
      <group ref={eje} position={[d.bisagra[0], 0, d.bisagra[1]]} rotation={[0, d.giro(t.current), 0]}>
        <mesh
          position={[d.largo / 2, alto / 2, d.metida]}
          material={mate(ab.color ?? casa.colores.puerta)}
          castShadow
          receiveShadow
          {...tocar}
        >
          <boxGeometry args={[d.largo, alto, ESP_HOJA]} />
          <Edges color={COLOR_CONTORNO} lineWidth={1} />
        </mesh>
      </group>
      {plano && <Line points={d.arco} color={COLOR_PLANO} lineWidth={1.2} />}
    </>
  );
}

/**
 * Puerta plegadiza (acordeón). Abierta, los paneles quedan juntos contra un costado del marco;
 * cerrada, casi planos a lo ancho del vano.
 */
function HojaPlegable3D({ ab, hoja, corte }: { ab: Abertura; hoja: HojaPlegable; corte: number }) {
  const { casa } = useCasaResuelta();
  const d = useMemo(() => {
    const n = Math.max(3, Math.round(ab.ancho / 0.1));
    const anchoPanel = (ab.ancho - 0.04) / n;
    const sentido = hoja.juntaHacia === 'a' ? 1 : -1;
    const inicio = hoja.juntaHacia === 'a' ? ab.desde + 0.02 : ab.desde + ab.ancho - 0.02;
    /** Paneles con un ángulo de plegado (respecto de la pared) que va de 8° cerrada a 75° abierta. */
    const paneles = (t: number) => {
      const plegado = ((8 + 67 * t) * Math.PI) / 180;
      const du = anchoPanel * Math.cos(plegado);
      const dv = anchoPanel * Math.sin(plegado);
      return Array.from({ length: n }, (_, k) => {
        const a: [number, number] = [inicio + sentido * k * du, k % 2 === 0 ? -dv / 2 : dv / 2];
        const b: [number, number] = [inicio + sentido * (k + 1) * du, k % 2 === 0 ? dv / 2 : -dv / 2];
        const centro: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        return { centro, rot: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) };
      });
    };
    return { anchoPanel, paneles };
  }, [ab, hoja]);
  const mallas = useRef<(THREE.Mesh | null)[]>([]);
  const alto = Math.min(ab.alto - 0.03, corte);
  const t = useApertura(ab.id, (t) => {
    d.paneles(t).forEach((p, k) => {
      const m = mallas.current[k];
      if (!m) return;
      m.position.set(p.centro[0], alto / 2 + 0.01, p.centro[1]);
      m.rotation.set(0, p.rot, 0);
    });
  });
  const tocar = useTocarPuerta(ab.id);
  const material = mate(ab.color ?? casa.colores.puerta);
  return (
    <group {...tocar}>
      {d.paneles(t.current).map((p, k) => (
        <mesh
          key={k}
          ref={(m) => {
            mallas.current[k] = m;
          }}
          position={[p.centro[0], alto / 2 + 0.01, p.centro[1]]}
          rotation={[0, p.rot, 0]}
          material={material}
          castShadow
        >
          <boxGeometry args={[d.anchoPanel, alto, 0.012]} />
          <Edges color={COLOR_CONTORNO} lineWidth={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Puerta granero: la hoja corre por fuera de la pared, colgada de su riel, y tapa el vano al cerrar. */
function HojaGranero3D({
  ab,
  hoja,
  espesor,
  corte,
  plano,
}: {
  ab: Abertura;
  hoja: HojaGranero;
  espesor: number;
  corte: number;
  plano: boolean;
}) {
  const { casa } = useCasaResuelta();
  const lado = hoja.lado === 'der' ? 1 : -1;
  const largo = ab.ancho + 0.1; // la hoja pasa 5 cm de cada lado del vano
  const v = lado * (espesor / 2 + 0.035);
  const [h0, h1] =
    hoja.correHacia === 'a' ? [ab.desde + 0.05 - largo, ab.desde + 0.05] : [ab.desde + ab.ancho - 0.05, ab.desde + ab.ancho - 0.05 + largo];
  const cerrada: [number, number] = [ab.desde - 0.05, ab.desde + ab.ancho + 0.05];
  const riel: [number, number] = [Math.min(h0, cerrada[0]) - 0.03, Math.max(h1, cerrada[1]) + 0.03];
  const altoHoja = Math.min(ab.alto + 0.05, corte) - 0.01;
  const yRiel = ab.alto + 0.12;
  const vPlano = lado * (espesor / 2 + 0.035);
  const centro = (t: number) => THREE.MathUtils.lerp((cerrada[0] + cerrada[1]) / 2, (h0 + h1) / 2, t);
  const malla = useRef<THREE.Mesh>(null);
  const t = useApertura(ab.id, (t) => malla.current?.position.setX(centro(t)));
  const tocar = useTocarPuerta(ab.id);
  return (
    <>
      <mesh
        ref={malla}
        position={[centro(t.current), 0.01 + altoHoja / 2, v]}
        material={mate(ab.color ?? casa.colores.puerta)}
        castShadow
        receiveShadow
        {...tocar}
      >
        <boxGeometry args={[largo, altoHoja, 0.035]} />
        <Edges color={COLOR_CONTORNO} lineWidth={1} />
      </mesh>
      {yRiel <= corte && (
        <mesh position={[(riel[0] + riel[1]) / 2, yRiel, lado * (espesor / 2 + 0.02)]} material={mate(COLOR_RIEL)} castShadow>
          <boxGeometry args={[riel[1] - riel[0], 0.04, 0.03]} />
        </mesh>
      )}
      {/* En planta: dónde queda la hoja cerrada (línea de trazos) */}
      {plano && (
        <Line
          points={[
            [cerrada[0], 0.02, vPlano],
            [cerrada[1], 0.02, vPlano],
          ]}
          color={COLOR_PLANO}
          lineWidth={1.2}
          dashed
          dashSize={0.06}
          gapSize={0.05}
        />
      )}
    </>
  );
}

/** Portón de dos hojas: dos puertas de abrir, una desde cada costado, que se abren juntas. */
function HojaDoble3D({
  ab,
  hoja,
  espesor,
  corte,
  plano,
}: {
  ab: Abertura;
  hoja: HojaDoble;
  espesor: number;
  corte: number;
  plano: boolean;
}) {
  const mitades = useMemo(() => {
    const mitad = ab.ancho / 2;
    return [
      { ab: { ...ab, ancho: mitad }, hoja: { bisagra: 'a', abreHacia: hoja.abreHacia } as HojaBatiente },
      { ab: { ...ab, desde: ab.desde + mitad, ancho: mitad }, hoja: { bisagra: 'b', abreHacia: hoja.abreHacia } as HojaBatiente },
    ];
  }, [ab, hoja]);
  return (
    <>
      {mitades.map((m, k) => (
        <HojaBatiente3D key={k} ab={m.ab} hoja={m.hoja} espesor={espesor} corte={corte} plano={plano} />
      ))}
    </>
  );
}

/** Perfil de las hojas corredizas (m). */
const PERFIL = 0.045;

/**
 * Puerta balcón corrediza: dos hojas vidriadas en dos rieles. La fija no se mueve; la otra corre
 * por delante hasta quedar encima de la fija.
 */
function HojaCorrediza3D({ ab, hoja, corte }: { ab: Abertura; hoja: HojaCorrediza; corte: number }) {
  const { casa } = useCasaResuelta();
  const u0 = ab.desde + MARCO;
  const u1 = ab.desde + ab.ancho - MARCO;
  const ancho = (u1 - u0) / 2 + 0.02; // se solapan 4 cm en el medio
  const fijaA = hoja.fija === 'a';
  const uFija = fijaA ? u0 + ancho / 2 : u1 - ancho / 2;
  const uCerrada = fijaA ? u1 - ancho / 2 : u0 + ancho / 2;
  const uAbierta = uFija + (fijaA ? 0.05 : -0.05);
  const pos = (t: number) => THREE.MathUtils.lerp(uCerrada, uAbierta, t);
  const movil = useRef<THREE.Group>(null);
  const t = useApertura(ab.id, (t) => movil.current?.position.setX(pos(t)));
  const tocar = useTocarPuerta(ab.id);
  const y0 = 0.06;
  const y1 = Math.min(ab.alto - MARCO, corte);
  if (y1 <= y0 + 2 * PERFIL) return null;
  const props = { ancho, y0, y1, marco: mate(casa.colores.marco), vidrio: vidrio(casa.colores.vidrio) };
  return (
    <group {...tocar}>
      <group position={[uFija, 0, -0.022]}>
        <HojaVidriada {...props} />
      </group>
      <group ref={movil} position={[pos(t.current), 0, 0.022]}>
        <HojaVidriada {...props} />
      </group>
    </group>
  );
}

function HojaVidriada({
  ancho,
  y0,
  y1,
  marco,
  vidrio: matVidrio,
}: {
  ancho: number;
  y0: number;
  y1: number;
  marco: THREE.Material;
  vidrio: THREE.Material;
}) {
  const alto = y1 - y0;
  const yc = (y0 + y1) / 2;
  const fondo = 0.035;
  return (
    <>
      <mesh position={[-ancho / 2 + PERFIL / 2, yc, 0]} material={marco} castShadow>
        <boxGeometry args={[PERFIL, alto, fondo]} />
      </mesh>
      <mesh position={[ancho / 2 - PERFIL / 2, yc, 0]} material={marco} castShadow>
        <boxGeometry args={[PERFIL, alto, fondo]} />
      </mesh>
      <mesh position={[0, y0 + PERFIL / 2, 0]} material={marco}>
        <boxGeometry args={[ancho - 2 * PERFIL, PERFIL, fondo]} />
      </mesh>
      <mesh position={[0, y1 - PERFIL / 2, 0]} material={marco}>
        <boxGeometry args={[ancho - 2 * PERFIL, PERFIL, fondo]} />
      </mesh>
      <mesh position={[0, yc, 0]} material={matVidrio} renderOrder={2}>
        <boxGeometry args={[ancho - 2 * PERFIL, alto - 2 * PERFIL, 0.008]} />
      </mesh>
    </>
  );
}
