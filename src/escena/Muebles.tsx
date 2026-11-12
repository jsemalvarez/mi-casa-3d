import { useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Mueble } from '../data/tipos';
import { useCasaResuelta } from '../estado';
import { Edges } from './drei';
import { mate, vidrio } from './materiales';

const OSCURO = '#2c2f33';
const GRIS = '#9aa1a6';
const CONTORNO = '#7d8389';

/** Todos los muebles. Los que quedan por encima del corte (alacenas en planta) van translúcidos. */
export function Muebles({ corte }: { corte: number }) {
  const { casa } = useCasaResuelta();
  return (
    <group name="muebles">
      {casa.muebles.map((m) => (
        <Mueble3D key={m.id} m={m} corte={corte} />
      ))}
    </group>
  );
}

function Mueble3D({ m, corte }: { m: Mueble; corte: number }) {
  const elev = m.elevacion ?? 0;
  const translucido = elev >= corte;
  const color = m.color ?? '#d8d3ca';
  const mat = (c: string) => mate(c, { opacidad: translucido ? 0.3 : 1 });
  return (
    // Sistema local: X = ancho, Z = profundidad (frente hacia +Z), Y arriba desde la base.
    <group position={[m.centro[0], elev, m.centro[1]]} rotation={[0, (-(m.giro ?? 0) * Math.PI) / 180, 0]} userData={{ mueble: m.id }}>
      {forma(m, color, mat, corte - elev)}
    </group>
  );
}

type Mat = (c: string) => ReturnType<typeof mate>;

/** Caja con la base en y = y0. */
function Caja({
  t,
  y0 = 0,
  x = 0,
  z = 0,
  material,
  sombra = true,
}: {
  t: [number, number, number];
  y0?: number;
  x?: number;
  z?: number;
  material: ReturnType<typeof mate>;
  sombra?: boolean;
}) {
  return (
    <mesh position={[x, y0 + t[1] / 2, z]} material={material} castShadow={sombra} receiveShadow>
      <boxGeometry args={t} />
      {/* Contorno: sin él, un mueble blanco contra una pared blanca no se distingue. */}
      {Math.min(...t) > 0.015 && !material.transparent && <Edges color={CONTORNO} lineWidth={1} />}
    </mesh>
  );
}

/** Óvalo (cilindro escalado) con la base en y = y0. */
function Ovalo({
  ancho,
  prof,
  alto,
  y0 = 0,
  z = 0,
  material,
}: {
  ancho: number;
  prof: number;
  alto: number;
  y0?: number;
  z?: number;
  material: ReturnType<typeof mate>;
}) {
  return (
    <mesh position={[0, y0 + alto / 2, z]} scale={[ancho, alto, prof]} material={material} castShadow receiveShadow>
      <cylinderGeometry args={[0.5, 0.5, 1, 28]} />
      {!material.transparent && <Edges color={CONTORNO} lineWidth={1} threshold={40} />}
    </mesh>
  );
}

/**
 * Puertas (`vertical`) o cajones dibujados sobre el frente, de y = 0 a `alto`: líneas de división
 * y manijas. Alcanza para reconocer el mueble sin modelarlo.
 */
function Frente({
  mat,
  ancho,
  alto,
  frente,
  divisiones,
  vertical = false,
}: {
  mat: Mat;
  ancho: number;
  alto: number;
  frente: number;
  divisiones: number;
  vertical?: boolean;
}) {
  const n = Math.max(1, Math.round(divisiones));
  const linea = mat(CONTORNO);
  const manija = mat(GRIS);
  if (vertical) {
    const paso = ancho / n;
    const largo = Math.min(0.18, alto * 0.25);
    const yManija = Math.min(alto - 0.15, 1.0) - largo / 2;
    return (
      <>
        {Array.from({ length: n - 1 }, (_, k) => (
          <Caja key={k} t={[0.008, alto - 0.04, 0.006]} y0={0.02} x={-ancho / 2 + (k + 1) * paso} z={frente} material={linea} sombra={false} />
        ))}
        {Array.from({ length: n }, (_, k) => {
          // Manijas del lado donde se juntan las puertas.
          const x0 = -ancho / 2 + k * paso;
          const x = n === 1 || k % 2 === 0 ? x0 + paso - 0.06 : x0 + 0.06;
          return <Caja key={`m${k}`} t={[0.015, largo, 0.02]} y0={yManija} x={x} z={frente + 0.01} material={manija} sombra={false} />;
        })}
      </>
    );
  }
  const zocalo = 0.05;
  const paso = (alto - zocalo) / n;
  return (
    <>
      {Array.from({ length: n }, (_, k) => (
        <group key={k}>
          <Caja t={[ancho - 0.04, 0.008, 0.006]} y0={zocalo + k * paso} z={frente} material={linea} sombra={false} />
          <Caja t={[Math.min(0.12, ancho * 0.25), 0.015, 0.02]} y0={zocalo + (k + 0.6) * paso} z={frente + 0.01} material={manija} sombra={false} />
        </group>
      ))}
    </>
  );
}

const MADERA_CLARA = '#c99a63';

/**
 * Mesa "pizza": tapa redonda de vidrio (diámetro = `ancho`) sobre una base de madera de cuatro
 * patas en las diagonales, con una cruz arriba y otra abajo. `colorTapa` = la madera.
 */
function MesaPizza({ m, color, mat }: { m: Mueble; color: string; mat: Mat }) {
  const { ancho: a, alto: h } = m;
  const madera = mat(m.colorTapa ?? MADERA_CLARA);
  const vidrioTapa = 0.012;
  const r = a * 0.25; // radio de las patas
  const lado = 0.045;
  const alturaPata = h - vidrioTapa - 0.04;
  return (
    <>
      <mesh position={[0, h - vidrioTapa / 2, 0]} material={vidrio(color)} renderOrder={2}>
        <cylinderGeometry args={[a / 2, a / 2, vidrioTapa, 48]} />
      </mesh>
      {[45, 135, 225, 315].map((g) => {
        const t = (g * Math.PI) / 180;
        return <Caja key={g} t={[lado, alturaPata, lado]} x={r * Math.cos(t)} z={r * Math.sin(t)} material={madera} />;
      })}
      {[45, 135].map((g) => (
        <group key={g} rotation={[0, (-g * Math.PI) / 180, 0]}>
          <Caja t={[2 * r + lado, 0.04, 0.035]} material={madera} />
          <Caja t={[2 * r + lado, 0.04, 0.035]} y0={alturaPata} material={madera} />
        </group>
      ))}
    </>
  );
}

/**
 * Silla de mesa pizza: un cuarto de círculo con el vértice adelante (hacia el centro de la mesa) y
 * el respaldo curvo atrás. `profundidad` = radio; `ancho` = cuerda (define la abertura del gajo).
 * `color` = tapizado, `colorTapa` = patas.
 */
function SillaPizza({ m, color, mat }: { m: Mueble; color: string; mat: Mat }) {
  const { ancho: a, profundidad: radio, alto: h } = m;
  const yAsiento = 0.38;
  const geo = useMemo(() => {
    const medio = Math.asin(Math.min(1, a / 2 / radio));
    // Gajo en el plano de la Shape: +Y = hacia atrás de la silla, vértice en el origen.
    const gajo = (r0: number, r1: number, alto: number) => {
      const s = new THREE.Shape();
      const [t0, t1] = [Math.PI / 2 - medio, Math.PI / 2 + medio];
      s.absarc(0, 0, r1, t0, t1, false);
      s.absarc(0, 0, r0, t1, t0, true);
      return new THREE.ExtrudeGeometry(s, { depth: alto, bevelEnabled: false, curveSegments: 20 });
    };
    const patas: [number, number][] = [
      [0.15, -0.35],
      [0.15, 0.35],
      [radio - 0.09, -(medio - 0.12)],
      [radio - 0.09, medio - 0.12],
    ].map(([r, t]) => [r * Math.sin(t), radio / 2 - r * Math.cos(t)]);
    return {
      asiento: gajo(0.05, radio - 0.02, 0.08),
      respaldo: gajo(radio - 0.07, radio, h - yAsiento),
      patas,
    };
  }, [a, radio, h]);
  // La Shape se acuesta: su +Y pasa a −Z (atrás) y la extrusión sube. El vértice va adelante.
  const acostar: [number, number, number] = [-Math.PI / 2, 0, 0];
  const tapizado = mat(color);
  return (
    <>
      <mesh geometry={geo.asiento} position={[0, yAsiento, radio / 2]} rotation={acostar} material={tapizado} castShadow receiveShadow>
        <Edges color={CONTORNO} lineWidth={1} threshold={30} />
      </mesh>
      <mesh geometry={geo.respaldo} position={[0, yAsiento, radio / 2]} rotation={acostar} material={tapizado} castShadow receiveShadow>
        <Edges color={CONTORNO} lineWidth={1} threshold={30} />
      </mesh>
      {geo.patas.map(([x, z], k) => (
        <Caja key={k} t={[0.035, yAsiento, 0.035]} x={x} z={z} material={mat(m.colorTapa ?? MADERA_CLARA)} />
      ))}
    </>
  );
}

function forma(m: Mueble, color: string, mat: Mat, altoVisible: number): ReactNode {
  const { ancho: a, profundidad: p, alto: h } = m;
  const frente = p / 2; // z de la cara del frente
  switch (m.tipo) {
    case 'mesada': {
      const tapa = 0.04;
      return (
        <>
          {m.abajo !== 'abierto' && <Caja t={[a, h - tapa, p - 0.03]} z={-0.015} material={mat(color)} />}
          <Caja t={[a, tapa, p]} y0={h - tapa} material={mat(m.colorTapa ?? '#cfc8bc')} />
          {(m.piletas ?? []).map((pl, k) => (
            <group key={k} position={[pl.desplazamiento, h, 0]}>
              <Caja t={[pl.ancho, 0.006, pl.profundidad]} material={mat('#f4f4f2')} sombra={false} />
              <Caja t={[pl.ancho - 0.05, 0.008, pl.profundidad - 0.05]} material={mat('#aeb5b9')} sombra={false} />
              {/* canilla */}
              <Caja t={[0.03, 0.22, 0.03]} z={-pl.profundidad / 2 - 0.04} material={mat(GRIS)} />
            </group>
          ))}
        </>
      );
    }
    case 'inodoro':
      return (
        <>
          <Ovalo ancho={a} prof={p - 0.17} alto={0.4} z={0.085} material={mat(color)} />
          <Caja t={[a, h - 0.38, 0.17]} y0={0.38} z={-p / 2 + 0.085} material={mat(color)} />
        </>
      );
    case 'bidet':
      return <Ovalo ancho={a} prof={p} alto={h} material={mat(color)} />;
    case 'ducha': {
      // Plato y, contra la pared de atrás, el brazo con la flor (si entra bajo el corte).
      const yFlor = 2.0;
      return (
        <>
          <Caja t={[a, h, p]} material={mat(color)} sombra={false} />
          <mesh position={[0, h + 0.002, 0]} material={mat(GRIS)}>
            <cylinderGeometry args={[0.035, 0.035, 0.004, 16]} />
          </mesh>
          {yFlor <= altoVisible && (
            <>
              <Caja t={[0.025, 0.025, 0.3]} y0={yFlor} z={-p / 2 + 0.15} material={mat(GRIS)} />
              <mesh position={[0, yFlor - 0.01, -p / 2 + 0.3]} material={mat(GRIS)}>
                <cylinderGeometry args={[0.1, 0.1, 0.02, 24]} />
              </mesh>
            </>
          )}
        </>
      );
    }
    case 'heladera':
      return (
        <>
          <Caja t={[a, h, p]} material={mat(color)} />
          {/* separación freezer / heladera y manijas */}
          <Caja t={[a - 0.02, 0.012, 0.006]} y0={h * 0.68} z={frente} material={mat(GRIS)} sombra={false} />
          <Caja t={[0.03, 0.25, 0.03]} y0={h * 0.72} x={a / 2 - 0.08} z={frente + 0.015} material={mat(GRIS)} />
          <Caja t={[0.03, 0.4, 0.03]} y0={h * 0.38} x={a / 2 - 0.08} z={frente + 0.015} material={mat(GRIS)} />
        </>
      );
    case 'cocina':
      return (
        <>
          <Caja t={[a, h, p]} material={mat(color)} />
          {/* puerta del horno y hornallas */}
          <Caja t={[a - 0.12, h * 0.42, 0.01]} y0={0.12} z={frente} material={mat(OSCURO)} sombra={false} />
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([sx, sz], k) => (
            <mesh key={k} position={[(sx * a) / 4.5, h + 0.008, (sz * p) / 4.5]} material={mat(OSCURO)}>
              <cylinderGeometry args={[0.06, 0.06, 0.016, 16]} />
            </mesh>
          ))}
        </>
      );
    case 'lavarropas':
      return (
        <>
          <Caja t={[a, h, p]} material={mat(color)} />
          <mesh position={[0, h * 0.45, frente + 0.006]} rotation={[Math.PI / 2, 0, 0]} material={mat(OSCURO)}>
            <cylinderGeometry args={[a * 0.3, a * 0.3, 0.012, 32]} />
          </mesh>
        </>
      );
    case 'microondas':
      return (
        <>
          <Caja t={[a, h, p]} material={mat(color)} />
          <Caja t={[a * 0.6, h * 0.65, 0.008]} y0={h * 0.17} x={-a * 0.12} z={frente} material={mat(OSCURO)} sombra={false} />
        </>
      );
    case 'mesa':
      return (
        <>
          <mesh position={[0, h - 0.015, 0]} material={vidrio(color)} renderOrder={2}>
            <boxGeometry args={[a, 0.03, p]} />
          </mesh>
          <mesh position={[0, (h - 0.03) / 2, 0]} material={mat(GRIS)} castShadow>
            <cylinderGeometry args={[0.06, 0.18, h - 0.03, 20]} />
          </mesh>
        </>
      );
    case 'silla':
      return (
        <>
          <Caja t={[a, 0.08, p]} y0={0.4} material={mat(color)} />
          <Caja t={[a, h - 0.48, 0.06]} y0={0.48} z={-p / 2 + 0.03} material={mat(color)} />
          <Caja t={[0.05, 0.4, 0.05]} material={mat(GRIS)} />
        </>
      );
    case 'cama': {
      // Si es más profunda que ancha, es una cama con la cabecera en la espalda: lleva almohadas.
      const almohadas = p > a ? (a >= 1.2 ? 2 : 1) : 0;
      const anchoAlmohada = (a - 0.15) / Math.max(1, almohadas) - 0.05;
      return (
        <>
          <Caja t={[a, 0.25, p]} material={mat('#d9cfbf')} />
          <Caja t={[a - 0.04, h - 0.25, p - 0.04]} y0={0.25} material={mat(color)} />
          {Array.from({ length: almohadas }, (_, k) => (
            <Caja
              key={k}
              t={[anchoAlmohada, 0.1, 0.4]}
              y0={h}
              x={-a / 2 + 0.1 + anchoAlmohada / 2 + k * (anchoAlmohada + 0.05)}
              z={-p / 2 + 0.28}
              material={mat('#f1eee8')}
            />
          ))}
        </>
      );
    }
    case 'cucheta': {
      // Dos camas encimadas: marco de `color`, colchones de `colorTapa`. La escalera va del lado izquierdo.
      const marco = mat(color);
      const colchon = mat(m.colorTapa ?? '#e9e4da');
      const yArriba = h - 0.45; // base de la cama de arriba
      const [ai, pi] = [a - 0.06, p - 0.04];
      const xEscalera = -a / 2 + 0.3;
      const peldanos: number[] = [];
      for (let y = 0.45; y < yArriba; y += 0.3) peldanos.push(y);
      return (
        <>
          {/* cabecera y piecera */}
          {[-1, 1].map((s) => (
            <Caja key={s} t={[0.03, h, p]} x={(s * (a - 0.03)) / 2} material={marco} />
          ))}
          {/* cama de abajo, con cajón */}
          <Caja t={[ai, 0.28, pi]} material={marco} />
          <Caja t={[ai - 0.02, 0.17, pi - 0.04]} y0={0.28} material={colchon} />
          {/* cama de arriba y su baranda (deja el paso de la escalera) */}
          <Caja t={[ai, 0.08, pi]} y0={yArriba} material={marco} />
          <Caja t={[ai - 0.02, 0.17, pi - 0.04]} y0={yArriba + 0.08} material={colchon} />
          <Caja t={[ai - 0.5, 0.2, 0.025]} y0={yArriba + 0.25} x={0.25} z={frente - 0.0125} material={marco} />
          {/* escalera */}
          {[-0.15, 0.15].map((dx) => (
            <Caja key={dx} t={[0.025, yArriba + 0.25, 0.025]} x={xEscalera + dx} z={frente + 0.02} material={mat(GRIS)} />
          ))}
          {peldanos.map((y) => (
            <Caja key={y} t={[0.3, 0.02, 0.02]} y0={y} x={xEscalera} z={frente + 0.02} material={mat(GRIS)} />
          ))}
        </>
      );
    }
    case 'biblioteca': {
      // Estantes abiertos al frente cada ~35 cm; con `abajo: 'cerrado'` la parte de abajo tiene puertas.
      const t = 0.02;
      const cerrado = m.abajo === 'cerrado' ? Math.min(0.75, h * 0.4) : 0;
      const huecos = Math.max(1, Math.round((h - cerrado) / 0.35));
      const paso = (h - cerrado - t) / huecos;
      return (
        <>
          <Caja t={[a, h, t]} z={-p / 2 + t / 2} material={mat(color)} />
          {[-1, 1].map((s) => (
            <Caja key={s} t={[t, h, p]} x={(s * (a - t)) / 2} material={mat(color)} />
          ))}
          {Array.from({ length: huecos + 1 }, (_, k) => (
            <Caja key={k} t={[a - 2 * t, t, p - t]} y0={cerrado + k * paso} z={t / 2} material={mat(color)} />
          ))}
          {cerrado > 0 && (
            <>
              <Caja t={[a - 2 * t, cerrado, p - t]} z={t / 2} material={mat(color)} />
              <Frente mat={mat} ancho={a} alto={cerrado} frente={frente} divisiones={2} vertical />
            </>
          )}
        </>
      );
    }
    case 'perchero': {
      // Barral con la ropa colgada (bloque de `colorTapa`) y un estante abajo.
      const barra = mat(OSCURO);
      const ropa = Math.min(1.0, h - 0.35);
      return (
        <>
          {[-1, 1].map((s) => (
            <group key={s}>
              <Caja t={[0.03, h, 0.03]} x={(s * (a - 0.03)) / 2} material={barra} />
              <Caja t={[0.03, 0.03, p]} x={(s * (a - 0.03)) / 2} material={barra} />
            </group>
          ))}
          <Caja t={[a, 0.03, 0.03]} y0={h - 0.05} material={barra} />
          <Caja t={[a - 0.06, 0.03, p - 0.05]} y0={0.15} material={mat(color)} />
          <Caja t={[a - 0.12, ropa, p * 0.9]} y0={h - 0.06 - ropa} material={mat(m.colorTapa ?? '#7b7f86')} />
        </>
      );
    }
    case 'placard':
      return (
        <>
          <Caja t={[a, h, p]} material={mat(color)} />
          <Frente mat={mat} ancho={a} alto={h} frente={frente} divisiones={m.divisiones ?? 2} vertical />
        </>
      );
    case 'comoda':
      return (
        <>
          <Caja t={[a, h, p]} material={mat(color)} />
          <Frente mat={mat} ancho={a} alto={h} frente={frente} divisiones={m.divisiones ?? 4} />
        </>
      );
    case 'mesa-pizza':
      return <MesaPizza m={m} color={color} mat={mat} />;
    case 'silla-pizza':
      return <SillaPizza m={m} color={color} mat={mat} />;
    case 'campana':
      // Campana / extractor: el cuerpo y el filtro oscuro abajo.
      return (
        <>
          <Caja t={[a, h, p]} material={mat(color)} />
          <Caja t={[a - 0.06, 0.004, p - 0.06]} y0={-0.006} material={mat(OSCURO)} sombra={false} />
        </>
      );
    case 'estantes': {
      // Tablas sueltas contra la pared (sin laterales), repartidas de y = 0 hasta `alto`.
      const n = Math.max(1, Math.round(m.divisiones ?? 3));
      const t = 0.02;
      const paso = n > 1 ? (h - t) / (n - 1) : 0;
      return (
        <>
          {Array.from({ length: n }, (_, k) => (
            <Caja key={k} t={[a, t, p]} y0={k * paso} material={mat(color)} />
          ))}
        </>
      );
    }
    case 'sillon':
      return (
        <>
          <Caja t={[a - 0.3, 0.42, p - 0.18]} x={0} z={0.09} material={mat(color)} />
          <Caja t={[a, h, 0.18]} z={-p / 2 + 0.09} material={mat(color)} />
          {[-1, 1].map((s) => (
            <Caja key={s} t={[0.15, 0.6, p - 0.18]} x={(s * (a - 0.15)) / 2} z={0.09} material={mat(color)} />
          ))}
        </>
      );
    case 'escritorio':
      return (
        <>
          <Caja t={[a, 0.04, p]} y0={h - 0.04} material={mat(color)} />
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([sx, sz], k) => (
            <Caja key={k} t={[0.05, h - 0.04, 0.05]} x={(sx * (a - 0.1)) / 2} z={(sz * (p - 0.1)) / 2} material={mat(OSCURO)} />
          ))}
        </>
      );
    case 'tv':
      return <Caja t={[a, h, p]} material={mat('#1d1f22')} />;
    default:
      return <Caja t={[a, h, p]} material={mat(color)} />;
  }
}
