import { useMemo } from 'react';
import type { Abertura, HojaBatiente, HojaGranero, HojaPlegable } from '../data/tipos';
import { useCasaResuelta } from '../estado';
import { Edges, Line } from './drei';
import { mate, vidrio } from './materiales';

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
  const hoja = ab.tipo === 'puerta' ? ab.hoja : undefined;

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
          {(() => {
            const y0 = ant + (ant > 0 ? MARCO : 0.06);
            const y1 = Math.min(tope - MARCO, corte);
            if (y1 <= y0) return null;
            return (
              <mesh position={[uc, (y0 + y1) / 2, 0]} material={matVidrio} renderOrder={2}>
                <boxGeometry args={[ab.ancho - 2 * MARCO, y1 - y0, 0.01]} />
              </mesh>
            );
          })()}
          {Array.from({ length: hojas - 1 }, (_, k) => {
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
      {hoja && hoja.tipo !== 'plegable' && hoja.tipo !== 'granero' && (
        <HojaBatiente3D ab={ab} hoja={hoja} espesor={espesor} corte={corte} plano={plano} />
      )}
    </group>
  );
}

/** Puerta de abrir: hoja abierta a 90° y, en planta, el arco de apertura. */
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
    const ang = Math.PI / 2; // abierta a 90°
    const dir: [number, number] = [sentido * Math.cos(ang), lado * Math.sin(ang)];
    const centro: [number, number] = [bisagra[0] + (dir[0] * largo) / 2, bisagra[1] + (dir[1] * largo) / 2];
    const rot = Math.atan2(-dir[1], dir[0]);
    const arco: V3[] = [];
    for (let k = 0; k <= 24; k++) {
      const a = (ang * k) / 24;
      arco.push([bisagra[0] + sentido * Math.cos(a) * largo, 0.02, bisagra[1] + lado * Math.sin(a) * largo]);
    }
    return { largo, centro, rot, arco };
  }, [ab, hoja, espesor]);
  const alto = Math.min(ab.alto - 0.02, corte);
  return (
    <>
      <mesh
        position={[d.centro[0], alto / 2, d.centro[1]]}
        rotation={[0, d.rot, 0]}
        material={mate(ab.color ?? casa.colores.puerta)}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[d.largo, alto, ESP_HOJA]} />
        <Edges color={COLOR_CONTORNO} lineWidth={1} />
      </mesh>
      {plano && <Line points={d.arco} color={COLOR_PLANO} lineWidth={1.2} />}
    </>
  );
}

/** Puerta plegadiza (acordeón), abierta: los paneles quedan juntos contra un costado del marco. */
function HojaPlegable3D({ ab, hoja, corte }: { ab: Abertura; hoja: HojaPlegable; corte: number }) {
  const { casa } = useCasaResuelta();
  const paneles = useMemo(() => {
    const n = Math.max(3, Math.round(ab.ancho / 0.1));
    const anchoPanel = (ab.ancho - 0.04) / n;
    const plegado = (75 * Math.PI) / 180; // ángulo de cada panel respecto de la pared
    const du = anchoPanel * Math.cos(plegado);
    const dv = anchoPanel * Math.sin(plegado);
    const sentido = hoja.juntaHacia === 'a' ? 1 : -1;
    const inicio = hoja.juntaHacia === 'a' ? ab.desde + 0.02 : ab.desde + ab.ancho - 0.02;
    const lista: { centro: [number, number]; rot: number }[] = [];
    for (let k = 0; k < n; k++) {
      const a: [number, number] = [inicio + sentido * k * du, k % 2 === 0 ? -dv / 2 : dv / 2];
      const b: [number, number] = [inicio + sentido * (k + 1) * du, k % 2 === 0 ? dv / 2 : -dv / 2];
      lista.push({ centro: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], rot: Math.atan2(-(b[1] - a[1]), b[0] - a[0]) });
    }
    return { lista, anchoPanel };
  }, [ab, hoja]);
  const alto = Math.min(ab.alto - 0.03, corte);
  const material = mate(ab.color ?? casa.colores.puerta);
  return (
    <>
      {paneles.lista.map((p, k) => (
        <mesh key={k} position={[p.centro[0], alto / 2 + 0.01, p.centro[1]]} rotation={[0, p.rot, 0]} material={material} castShadow>
          <boxGeometry args={[paneles.anchoPanel, alto, 0.012]} />
          <Edges color={COLOR_CONTORNO} lineWidth={1} />
        </mesh>
      ))}
    </>
  );
}

/** Puerta granero, abierta: la hoja queda corrida sobre la pared, colgada de su riel. */
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
  return (
    <>
      <mesh position={[(h0 + h1) / 2, 0.01 + altoHoja / 2, v]} material={mate(ab.color ?? casa.colores.puerta)} castShadow receiveShadow>
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
