/**
 * Instalación eléctrica a la vista (sin React ni three.js): ubica cada caja y cada luz, arma la red
 * de cable canal (los recorridos de los datos + las bajadas y los tramos de techo que se generan
 * solos), decide por dónde va cada cable de cada circuito y calcula los materiales.
 *
 * Cómo se tienden los cables:
 * - Cada circuito sale del tablero y va por el camino más corto de la red a cada caja.
 * - Luces: la fase va a las teclas, el neutro y la tierra a las luces, y de cada tecla sale un
 *   retorno a sus luces. Las combinaciones llevan dos "viajeros" entre las dos llaves.
 * - Donde el canal se abre en una T sin caja, los cables no se pueden empalmar adentro del canal:
 *   si la rama es corta (una bajada) los cables bajan a la caja y vuelven a subir (se cuentan dos
 *   veces); si es larga, se pone una caja de paso en la T.
 */
import type {
  Ambiente,
  CajaElectrica,
  Casa,
  EnPared,
  Instalacion,
  Luz,
  MedidaCanal,
  Punto2,
  Punto3,
  TipoLuz,
} from '../data/tipos';
import { derechaDe, fmt, izquierdaDe, puntoEnPoligono, type CasaResuelta, type Lado, type ParedResuelta } from './geometria';
import type { TechoResuelto } from './techos';

/** Tolerancia para "está sobre" (m). */
const TOL = 0.015;
/** Dos puntos a menos de esto son el mismo nodo de la red (m). */
const UNIR = 0.005;
/** Ramas de hasta este largo se hacen bajando y subiendo el cable (sin caja de paso). */
const LAZO_MAXIMO = 3;
/** Cable de más por conductor en cada caja, para conectar (m). */
const PUNTA_POR_CAJA = 0.3;
/** Desperdicio de cable y de canal. */
const DESPERDICIO = 1.1;
/** Largo de cada tira de cable canal (m). */
const LARGO_TIRA = 2;
/** Una fijación (tornillo y tarugo) cada tanto (m). */
const PASO_FIJACION = 0.5;

/** Sección exterior aproximada de un cable unipolar (IRAM NM 247-3) por sección de cobre (mm²). */
const AREA_CABLE: Record<number, number> = { 1: 6.2, 1.5: 7.1, 2.5: 10.2, 4: 13.9, 6: 19.6, 10: 30 };
const areaCable = (s: number) => AREA_CABLE[s] ?? Math.PI * (Math.sqrt(s / Math.PI) + 0.8) ** 2;

export type Funcion = 'fase' | 'neutro' | 'retorno' | 'tierra';
const COLOR_FUNCION: Record<Funcion, string> = {
  fase: 'marrón',
  neutro: 'celeste',
  retorno: 'negro',
  tierra: 'verde y amarillo',
};
const NOMBRE_FUNCION: Record<Funcion, string> = {
  fase: 'fase',
  neutro: 'neutro',
  retorno: 'retornos y combinación',
  tierra: 'tierra',
};

// ── Vectores 3D ──────────────────────────────────────────────────────────────
const resta = (a: Punto3, b: Punto3): Punto3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const largo3 = (a: Punto3) => Math.hypot(a[0], a[1], a[2]);
const unitario3 = (a: Punto3): Punto3 => {
  const l = largo3(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const plano = (p: Punto3): Punto2 => [p[0], p[2]];
const dist2 = (p: Punto2, q: Punto2) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** Punto de un segmento en planta más cercano a `p`, con su parámetro (0..1). */
function proyectar(p: Punto2, a: Punto2, b: Punto2) {
  const ab: Punto2 = [b[0] - a[0], b[1] - a[1]];
  const l2 = ab[0] * ab[0] + ab[1] * ab[1];
  const t = l2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / l2));
  const q: Punto2 = [a[0] + ab[0] * t, a[1] + ab[1] * t];
  return { q, t, d: dist2(p, q) };
}

/** Distancia de `p` al segmento a–b en 3D y parámetro del punto más cercano. */
function proyectar3(p: Punto3, a: Punto3, b: Punto3) {
  const ab = resta(b, a);
  const l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  const t = l2 < 1e-12 ? 0 : ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / l2;
  const tc = Math.max(0, Math.min(1, t));
  const q: Punto3 = [a[0] + ab[0] * tc, a[1] + ab[1] * tc, a[2] + ab[2] * tc];
  return { t, d: largo3(resta(p, q)) };
}

// ── Caras de pared ───────────────────────────────────────────────────────────
interface Cara {
  pared: ParedResuelta;
  lado: Lado;
  /** Normal en planta, de la pared hacia este lado. */
  normal: Punto2;
  /** Punto `a` de la pared llevado a esta cara. */
  origen: Punto2;
  u0: number;
  u1: number;
  ambiente: string | null;
}

function armarCaras(r: CasaResuelta): Cara[] {
  const lista: Cara[] = [];
  for (const p of r.paredes) {
    for (const lado of ['izq', 'der'] as Lado[]) {
      const normal = lado === 'izq' ? izquierdaDe(p.dir) : derechaDe(p.dir);
      lista.push({
        pared: p,
        lado,
        normal,
        origen: [p.a[0] + (normal[0] * p.espesor) / 2, p.a[1] + (normal[1] * p.espesor) / 2],
        u0: -p.extInicio,
        u1: p.largo + p.extFin,
        ambiente: lado === 'izq' ? p.izq : p.der,
      });
    }
  }
  return lista;
}

/** Parámetro sobre la cara si el punto está apoyado en ella, o null. */
function sobreCara(c: Cara, q: Punto2): number | null {
  const rel: Punto2 = [q[0] - c.origen[0], q[1] - c.origen[1]];
  const d = rel[0] * c.normal[0] + rel[1] * c.normal[1];
  if (Math.abs(d) > TOL) return null;
  const u = rel[0] * c.pared.dir[0] + rel[1] * c.pared.dir[1];
  return u >= c.u0 - TOL && u <= c.u1 + TOL ? u : null;
}

// ── Tipos resueltos ──────────────────────────────────────────────────────────
export type ClasePunto = 'caja' | 'luz' | 'tablero';

export interface ModuloResuelto {
  tipo: 'toma' | 'toma-exterior' | 'tecla' | 'combinacion';
  color: string;
  /** Teclas: las luces que prende. */
  luces?: string[];
}

export interface PuntoResuelto {
  id: string;
  nombre: string;
  clase: ClasePunto;
  tipoLuz?: TipoLuz;
  /** Centro de la caja o boca. */
  pos: Punto3;
  /** Hacia dónde mira (sale de la pared o baja del techo). */
  normal: Punto3;
  /** Ambiente donde se ve (para los resúmenes). */
  ambiente: string;
  modulos: ModuloResuelto[];
  color: string;
  /** Tablero: medidas. Tiras de LED: largo. Colgantes: cuánto cuelga. */
  ancho?: number;
  alto?: number;
  largo?: number;
  cuelga?: number;
  /** Guirnaldas: ganchos en 3D, a la altura de la caja. */
  ganchos?: Punto3[];
  /** Vista de pared donde se lo ve de frente (para ir desde los pendientes). */
  vista?: string;
}

export interface TramoResuelto {
  a: Punto3;
  b: Punto3;
  medida: MedidaCanal;
  /** Hacia dónde sale de la superficie donde está apoyado. */
  normal: Punto3;
  /** Sección de cables que lleva (mm²) y cuántos conductores. */
  ocupado: number;
  conductores: number;
}

export interface ItemComputo {
  categoria: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  detalle?: string;
  /** Cantidad que todavía no se puede calcular. */
  aDefinir?: boolean;
}

export interface ResumenCircuito {
  id: string;
  nombre: string;
  tipo: string;
  seccion: number;
  termica: number;
  color: string;
  bocas: number;
  detalleBocas: string;
  metrosCable: number;
}

export interface ResumenAmbiente {
  nombre: string;
  luces: number;
  teclas: number;
  tomas: number;
}

export interface ElectricaResuelta {
  puntos: PuntoResuelto[];
  tramos: TramoResuelto[];
  /** Cajas de paso que agrega el cálculo en las T donde hay que empalmar. */
  derivaciones: { pos: Punto3; normal: Punto3 }[];
  /** Agujeros en las paredes donde el canal termina y el cable pasa al otro lado (uno por cara). */
  pasamuros: { pos: Punto3; normal: Punto3 }[];
  computo: ItemComputo[];
  circuitos: ResumenCircuito[];
  ambientes: ResumenAmbiente[];
  /** Largo total de canal (m). */
  metrosCanal: number;
  /** Línea principal: medidor y recorrido del cable hasta el tablero (en 3D). */
  linea?: { medidor: Punto3; puntos: Punto3[]; enterrada: boolean };
  advertencias: string[];
}

// ── Red de canal ─────────────────────────────────────────────────────────────
interface Arista {
  a: number;
  b: number;
  largo: number;
  /** Cruza una pared: es un agujero, no lleva canal. */
  pasaje: boolean;
  /** Va por adentro del tablero: tampoco lleva canal. */
  interno: boolean;
}

type ClaseTramo = 'canal' | 'pasaje' | 'interno';

class Red {
  nodos: Punto3[] = [];
  aristas: Arista[] = [];
  incidentes: number[][] = [];

  nodo(p: Punto3) {
    const k = this.nodos.findIndex((n) => largo3(resta(n, p)) < UNIR);
    if (k >= 0) return k;
    this.nodos.push(p);
    this.incidentes.push([]);
    return this.nodos.length - 1;
  }

  otro(e: number, n: number) {
    const ar = this.aristas[e];
    return ar.a === n ? ar.b : ar.a;
  }
}

/** Arma la red a partir de polilíneas, cortando los tramos donde otro recorrido los toca. */
function armarRed(polilineas: Punto3[][], clasificar: (a: Punto3, b: Punto3) => ClaseTramo): Red {
  const red = new Red();
  const vertices = polilineas.flat();
  const vistos = new Set<string>();
  for (const pl of polilineas) {
    for (const p of pl) red.nodo(p);
    for (let k = 0; k < pl.length - 1; k++) {
      const [a, b] = [pl[k], pl[k + 1]];
      if (largo3(resta(b, a)) < UNIR) continue;
      // Cortes: vértices de cualquier recorrido que caen en el medio de este tramo.
      const ts = [0, 1];
      for (const v of vertices) {
        const { t, d } = proyectar3(v, a, b);
        if (d < UNIR && t > 1e-4 && t < 1 - 1e-4) ts.push(t);
      }
      ts.sort((p, q) => p - q);
      for (let j = 0; j < ts.length - 1; j++) {
        if (ts[j + 1] - ts[j] < 1e-6) continue;
        const pa: Punto3 = [a[0] + (b[0] - a[0]) * ts[j], a[1] + (b[1] - a[1]) * ts[j], a[2] + (b[2] - a[2]) * ts[j]];
        const pb: Punto3 = [
          a[0] + (b[0] - a[0]) * ts[j + 1],
          a[1] + (b[1] - a[1]) * ts[j + 1],
          a[2] + (b[2] - a[2]) * ts[j + 1],
        ];
        const na = red.nodo(pa);
        const nb = red.nodo(pb);
        if (na === nb) continue;
        const clave = na < nb ? `${na}-${nb}` : `${nb}-${na}`;
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        const clase = clasificar(pa, pb);
        red.aristas.push({
          a: na,
          b: nb,
          largo: largo3(resta(red.nodos[nb], red.nodos[na])),
          pasaje: clase === 'pasaje',
          interno: clase === 'interno',
        });
        const e = red.aristas.length - 1;
        red.incidentes[na].push(e);
        red.incidentes[nb].push(e);
      }
    }
  }
  return red;
}

/** Árbol de caminos más cortos desde `raiz` (Dijkstra). */
function arbol(red: Red, raiz: number) {
  const n = red.nodos.length;
  const dist = new Array<number>(n).fill(Infinity);
  const padre = new Array<number>(n).fill(-1);
  const aristaPadre = new Array<number>(n).fill(-1);
  const hecho = new Array<boolean>(n).fill(false);
  dist[raiz] = 0;
  for (;;) {
    let u = -1;
    for (let k = 0; k < n; k++) if (!hecho[k] && dist[k] < Infinity && (u < 0 || dist[k] < dist[u])) u = k;
    if (u < 0) break;
    hecho[u] = true;
    for (const e of red.incidentes[u]) {
      const v = red.otro(e, u);
      const d = dist[u] + red.aristas[e].largo;
      if (d < dist[v] - 1e-9) {
        dist[v] = d;
        padre[v] = u;
        aristaPadre[v] = e;
      }
    }
  }
  /** Aristas del camino entre dos nodos, por el árbol. */
  const camino = (x: number, y: number): number[] => {
    const subirDesde = (k: number) => {
      const lista: number[] = [];
      while (k !== raiz && k >= 0) lista.push(k), (k = padre[k]);
      lista.push(raiz);
      return lista;
    };
    const ax = subirDesde(x);
    const enAx = new Map(ax.map((k, i) => [k, i]));
    const aristas: number[] = [];
    let k = y;
    while (!enAx.has(k) && k >= 0) {
      aristas.push(aristaPadre[k]);
      k = padre[k];
    }
    const lca = k;
    for (const m of ax) {
      if (m === lca) break;
      aristas.push(aristaPadre[m]);
    }
    return aristas;
  };
  return { dist, camino };
}

/** Cuántas veces pasa un cable por cada arista para llegar de `raiz` a todos los `destinos`. */
interface Tendido {
  veces: Map<number, number>;
  derivaciones: Set<number>;
  cajas: number;
}

function tender(
  red: Red,
  camino: (x: number, y: number) => number[],
  raiz: number,
  destinos: number[],
  cajasDePaso: Set<number>,
): Tendido {
  const usadas = new Set<number>();
  for (const d of destinos) for (const e of camino(raiz, d)) usadas.add(e);
  const destinosSet = new Set(destinos);
  const veces = new Map<number, number>();
  const derivaciones = new Set<number>();
  const largoRama = new Map<number, number>();
  const largoDesde = (e: number, desde: number): number => {
    const hijo = red.otro(e, desde);
    const clave = e * 2 + (red.aristas[e].a === desde ? 0 : 1);
    if (largoRama.has(clave)) return largoRama.get(clave)!;
    let l = red.aristas[e].largo;
    for (const f of red.incidentes[hijo]) if (f !== e && usadas.has(f)) l += largoDesde(f, hijo);
    largoRama.set(clave, l);
    return l;
  };
  const sumar = (e: number, v: number) => veces.set(e, (veces.get(e) ?? 0) + v);
  /**
   * `tramo` = aristas desde la última caja (o el tablero) hasta `n`. En una T sin caja, cada rama
   * que no es la más larga se resuelve de la forma más barata posible:
   * - bajando y subiendo el cable (si la rama es corta: se cuenta dos veces),
   * - con otro cable desde la última caja (si está cerca: se repite el tramo hasta ahí),
   * - o, si no queda otra, con una caja de paso en la T.
   */
  const recorrer = (n: number, llegada: number, mult: number, tramo: number[], largoTramo: number) => {
    const esCaja = destinosSet.has(n) || n === raiz || cajasDePaso.has(n);
    if (esCaja) {
      tramo = [];
      largoTramo = 0;
    }
    const hijos = red.incidentes[n].filter((e) => e !== llegada && usadas.has(e));
    let multiplos = hijos.map(() => mult);
    if (!esCaja && hijos.length > 1) {
      const largos = hijos.map((e) => largoDesde(e, n));
      const mayor = largos.indexOf(Math.max(...largos));
      const otros = hijos.map((_, i) => i).filter((i) => i !== mayor);
      const sinSalida = otros.some((i) => largos[i] > LAZO_MAXIMO && largoTramo > LAZO_MAXIMO);
      if (sinSalida) {
        derivaciones.add(n);
        tramo = [];
        largoTramo = 0;
      } else {
        for (const i of otros) {
          const lazo = largos[i] <= LAZO_MAXIMO;
          const otroCable = largoTramo <= LAZO_MAXIMO;
          if (lazo && (!otroCable || largos[i] <= largoTramo)) multiplos[i] = mult * 2;
          else for (const e of tramo) sumar(e, mult);
        }
      }
    }
    hijos.forEach((e, i) => {
      sumar(e, multiplos[i]);
      recorrer(red.otro(e, n), e, multiplos[i], [...tramo, e], largoTramo + red.aristas[e].largo);
    });
  };
  recorrer(raiz, -1, 1, [], 0);
  return { veces, derivaciones, cajas: destinosSet.size + 1 };
}

// ── Resolución ───────────────────────────────────────────────────────────────
interface Ubicado {
  pos: Punto3;
  normal: Punto2;
  /** Punto en la cara del ambiente (de donde baja o sube el canal), en planta. */
  interior: Punto2;
  cara: Cara;
  pared: ParedResuelta;
  lado: Lado;
}

export function resolverInstalacion(inst: Instalacion, r: CasaResuelta): ElectricaResuelta {
  const casa = r.casa;
  const adv: string[] = [];
  const caras = armarCaras(r);
  const ambientes = new Map(casa.ambientes.map((a) => [a.id, a]));
  const techos = new Map(r.techos.map((t) => [t.ambiente, t]));
  const circuitos = new Map(inst.circuitos.map((c) => [c.id, c]));
  const nombreAmb = (id: string | null) => (id ? (ambientes.get(id)?.nombre ?? id) : 'Exterior');

  // ── Alturas de techo ──
  const techoEn = (amb: Ambiente | undefined, p: Punto2, entrepiso?: string) => {
    let y = amb ? alturaTecho(amb, techos.get(amb.id), casa, p) : casa.alturaTecho;
    if (!entrepiso) {
      for (const e of casa.entrepisos) if (puntoEnPoligono(p, e.poligono)) y = Math.min(y, e.nivel - e.espesor);
    }
    return y;
  };
  const pisoEn = (entrepiso?: string) => casa.entrepisos.find((e) => e.id === entrepiso)?.nivel ?? 0;

  // ── Puntos sobre las paredes ──
  const ubicar = (ep: EnPared, quien: string): Ubicado | null => {
    const p = r.paredes.find((w) => w.pared.id === ep.pared);
    if (!p) {
      adv.push(`${quien}: la pared "${ep.pared}" no existe.`);
      return null;
    }
    const lado: Lado | null = p.izq === ep.ambiente ? 'izq' : p.der === ep.ambiente ? 'der' : null;
    if (!lado) {
      adv.push(`${quien}: la pared "${ep.pared}" no da a "${ep.ambiente}".`);
      return null;
    }
    const cara = caras.find((c) => c.pared === p && c.lado === lado)!;
    const enX = Math.abs(p.dir[0]) >= Math.abs(p.dir[1]);
    const u = enX ? (ep.en - p.a[0]) / p.dir[0] : (ep.en - p.a[1]) / p.dir[1];
    if (u < cara.u0 - TOL || u > cara.u1 + TOL) adv.push(`${quien}: queda fuera de la pared "${ep.pared}".`);
    const eje: Punto2 = [p.a[0] + p.dir[0] * u, p.a[1] + p.dir[1] * u];
    const n = cara.normal;
    const interior: Punto2 = [eje[0] + (n[0] * p.espesor) / 2, eje[1] + (n[1] * p.espesor) / 2];
    const y = pisoEn(ep.entrepiso) + ep.altura;
    if (ep.atraviesa) {
      const afuera: Punto2 = [eje[0] - (n[0] * p.espesor) / 2, eje[1] - (n[1] * p.espesor) / 2];
      return { pos: [afuera[0], y, afuera[1]], normal: [-n[0], -n[1]], interior, cara, pared: p, lado };
    }
    return { pos: [interior[0], y, interior[1]], normal: n, interior, cara, pared: p, lado };
  };
  const vistaDe = (u: Ubicado, atraviesa?: boolean) => {
    const lado = atraviesa ? (u.lado === 'izq' ? 'der' : 'izq') : u.lado;
    return lado === 'izq' ? u.pared.vistaIzq : u.pared.vistaDer;
  };

  // ── Tramos horizontales de los recorridos (donde se enganchan cajas y luces) ──
  const esPasaje = (a: Punto3, b: Punto3) => {
    if (Math.abs(a[1] - b[1]) > 1e-3) return false;
    const m: Punto2 = [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2];
    return r.paredes.some((p) => {
      const ini: Punto2 = [p.a[0] - p.dir[0] * p.extInicio, p.a[1] - p.dir[1] * p.extInicio];
      const fin: Punto2 = [p.a[0] + p.dir[0] * (p.largo + p.extFin), p.a[1] + p.dir[1] * (p.largo + p.extFin)];
      const { d, t } = proyectar(m, ini, fin);
      return t > 0 && t < 1 && d < p.espesor / 2 - 0.01;
    });
  };
  interface Horizontal {
    a: Punto3;
    b: Punto3;
    y: number;
    cara: Cara | null;
    recorrido: string;
  }
  /**
   * Cara de pared sobre la que va un tramo (null si va por el techo o cruza una pared). Un tramo
   * largo puede pasar por varias paredes en línea: alcanza con que su medio esté sobre una cara y
   * que siga su línea.
   */
  const caraDeTramo = (a: Punto3, b: Punto3): Cara | null => {
    const pa = plano(a);
    const pb = plano(b);
    const medio: Punto2 = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
    const l = dist2(pa, pb);
    const enLinea = (c: Cara, q: Punto2) =>
      Math.abs((q[0] - c.origen[0]) * c.normal[0] + (q[1] - c.origen[1]) * c.normal[1]) <= TOL;
    return (
      caras.find((c) => {
        if (sobreCara(c, medio) === null) return false;
        if (l < 1e-4) return true;
        const d: Punto2 = [(pb[0] - pa[0]) / l, (pb[1] - pa[1]) / l];
        return Math.abs(d[0] * c.pared.dir[0] + d[1] * c.pared.dir[1]) > 0.99 && enLinea(c, pa) && enLinea(c, pb);
      }) ?? null
    );
  };
  const horizontales: Horizontal[] = [];
  for (const rc of inst.canales) {
    for (let k = 0; k < rc.puntos.length - 1; k++) {
      const [a, b] = [rc.puntos[k], rc.puntos[k + 1]];
      if (Math.abs(a[1] - b[1]) > 1e-3 || dist2(plano(a), plano(b)) < 1e-4 || esPasaje(a, b)) continue;
      horizontales.push({ a, b, y: a[1], cara: caraDeTramo(a, b), recorrido: rc.id });
    }
  }

  /** Canal que pasa por encima o por debajo de un punto de una cara, dentro de su ambiente. */
  const canalSobre = (q: Punto2, rango: [number, number], y: number) => {
    let mejor: Horizontal | null = null;
    for (const h of horizontales) {
      if (h.y < rango[0] - 1e-3 || h.y > rango[1] + 1e-3) continue;
      if (proyectar(q, plano(h.a), plano(h.b)).d > TOL) continue;
      if (!mejor || Math.abs(h.y - y) < Math.abs(mejor.y - y)) mejor = h;
    }
    return mejor;
  };
  /** Rango de alturas del espacio de un ambiente en un punto (entre piso y techo). */
  const espacio = (ambId: string, q: Punto2, entrepiso?: string): [number, number] => [
    pisoEn(entrepiso),
    techoEn(ambientes.get(ambId), q, entrepiso),
  ];
  const haciaAdentro = (u: Ubicado): Punto2 => [u.interior[0] + u.cara.normal[0] * 0.02, u.interior[1] + u.cara.normal[1] * 0.02];

  const puntos: PuntoResuelto[] = [];
  const conexiones: { id: string; pts: Punto3[] }[] = [];
  /** Tramos que van por adentro del tablero (de su centro a cada salida de canal). */
  const internos: [Punto3, Punto3][] = [];
  /** Nodo (posición) de cada punto en la red. */
  const anclas = new Map<string, Punto3>();

  /** Conecta un punto de pared con el canal de su cara. */
  const conectarPared = (id: string, quien: string, u: Ubicado, ep: EnPared) => {
    const rango = espacio(ep.ambiente, haciaAdentro(u), ep.entrepiso);
    const h = canalSobre(u.interior, rango, u.pos[1]);
    if (!h) {
      adv.push(`${quien}: no pasa ningún canal por encima ni por debajo (en la cara de ${nombreAmb(ep.ambiente)}).`);
      return;
    }
    const enCanal: Punto3 = [u.interior[0], h.y, u.interior[1]];
    const pts: Punto3[] = ep.atraviesa ? [u.pos, [u.interior[0], u.pos[1], u.interior[1]], enCanal] : [u.pos, enCanal];
    conexiones.push({ id, pts });
  };

  // Tablero: el canal sale de arriba.
  const ubTab = ubicar(inst.tablero, inst.tablero.nombre);
  let raizPos: Punto3 | null = null;
  if (ubTab) {
    const arriba: Punto3 = [ubTab.pos[0], ubTab.pos[1] + inst.tablero.alto / 2, ubTab.pos[2]];
    raizPos = arriba;
    anclas.set(inst.tablero.id, arriba);
    puntos.push({
      id: inst.tablero.id,
      nombre: inst.tablero.nombre,
      clase: 'tablero',
      pos: ubTab.pos,
      normal: [ubTab.normal[0], 0, ubTab.normal[1]],
      ambiente: nombreAmb(inst.tablero.ambiente),
      modulos: [],
      color: '#9aa1a6',
      ancho: inst.tablero.ancho,
      alto: inst.tablero.alto,
      vista: vistaDe(ubTab),
    });
    // Salidas: los recorridos que arrancan (o terminan) sobre el borde de arriba del tablero. Los
    // cables van por adentro del tablero hasta cada una. Si no hay ninguna, sube derecho al canal.
    const enBorde = (p: Punto3) =>
      Math.abs(p[1] - arriba[1]) < 0.01 &&
      sobreCara(ubTab.cara, plano(p)) !== null &&
      dist2(plano(p), plano(arriba)) <= inst.tablero.ancho / 2 + TOL;
    const salidas = inst.canales.flatMap((c) => [c.puntos[0], c.puntos[c.puntos.length - 1]]).filter(enBorde);
    for (const s of salidas) {
      conexiones.push({ id: inst.tablero.id, pts: [arriba, s] });
      internos.push([arriba, s]);
    }
    if (!salidas.length) {
      const h = canalSobre(ubTab.interior, espacio(inst.tablero.ambiente, haciaAdentro(ubTab)), arriba[1]);
      if (h) conexiones.push({ id: inst.tablero.id, pts: [arriba, [ubTab.interior[0], h.y, ubTab.interior[1]]] });
      else adv.push('Tablero: no pasa ningún canal por encima.');
    }
  } else {
    adv.push('No se pudo ubicar el tablero.');
  }

  // Cajas de pared.
  for (const c of inst.cajas) {
    const u = ubicar(c, c.nombre);
    if (!u) continue;
    const modulos: ModuloResuelto[] = c.modulos.map((m) => {
      if (m.tipo === 'toma') {
        const circ = circuitos.get(m.circuito);
        if (!circ) adv.push(`${c.nombre}: el circuito "${m.circuito}" no existe.`);
        return { tipo: m.exterior ? 'toma-exterior' : 'toma', color: circ?.color ?? '#ffffff' };
      }
      const luz = inst.luces.find((l) => l.id === m.luces[0]);
      const color = circuitos.get(luz?.circuito ?? '')?.color ?? '#ffffff';
      for (const id of m.luces) if (!inst.luces.some((l) => l.id === id)) adv.push(`${c.nombre}: la luz "${id}" no existe.`);
      return { tipo: m.tipo, color, luces: m.luces };
    });
    if (c.modulos.length > 6) adv.push(`${c.nombre}: tiene más de 6 módulos.`);
    puntos.push({
      id: c.id,
      nombre: c.nombre,
      clase: 'caja',
      pos: u.pos,
      normal: [u.normal[0], 0, u.normal[1]],
      ambiente: ambienteDelPunto(c, u),
      modulos,
      color: '#1d1f22',
      vista: vistaDe(u, c.atraviesa),
    });
    anclas.set(c.id, u.pos);
    conectarPared(c.id, c.nombre, u, c);
  }

  // Luces (las que van en cadena, después de la luz de la que salen).
  const ordenLuces: Luz[] = [];
  const agregar = (l: Luz, pila: Set<string>) => {
    if (ordenLuces.includes(l)) return;
    if (pila.has(l.id)) {
      adv.push(`${l.nombre}: la cadena de luces vuelve sobre sí misma.`);
      return;
    }
    pila.add(l.id);
    if (typeof l.desde === 'string') {
      const previa = inst.luces.find((x) => x.id === l.desde);
      if (previa) agregar(previa, pila);
      else adv.push(`${l.nombre}: la luz "${l.desde}" no existe.`);
    }
    ordenLuces.push(l);
  };
  for (const l of inst.luces) agregar(l, new Set());

  for (const l of ordenLuces) {
    const circ = circuitos.get(l.circuito);
    if (!circ) adv.push(`${l.nombre}: el circuito "${l.circuito}" no existe.`);
    const color = circ?.color ?? '#f2b84b';
    if (l.pared) {
      const u = ubicar(l.pared, l.nombre);
      if (!u) continue;
      puntos.push({
        id: l.id,
        nombre: l.nombre,
        clase: 'luz',
        tipoLuz: l.tipo,
        pos: u.pos,
        normal: [u.normal[0], 0, u.normal[1]],
        ambiente: ambienteDelPunto({ ...l.pared, entrepiso: l.entrepiso ?? l.pared.entrepiso }, u),
        modulos: [],
        color,
        largo: l.largo,
        cuelga: l.cuelga,
        ganchos: l.ganchos?.map((g): Punto3 => [g[0], u.pos[1], g[1]]),
        vista: vistaDe(u, l.pared.atraviesa),
      });
      anclas.set(l.id, u.pos);
      conectarPared(l.id, l.nombre, u, l.pared);
      continue;
    }
    if (!l.techo) {
      adv.push(`${l.nombre}: le falta \`techo\` o \`pared\`.`);
      continue;
    }
    const amb = ambientes.get(l.ambiente);
    const techoT = techos.get(l.ambiente);
    const bajoViga = (q: Punto2) => (techoT && techoT.techo.viga ? enCumbrera(techoT, q) * techoT.techo.viga.alto : 0);
    const boca: Punto3 = [l.techo[0], techoEn(amb, l.techo, l.entrepiso) - bajoViga(l.techo), l.techo[1]];
    puntos.push({
      id: l.id,
      nombre: l.nombre,
      clase: 'luz',
      tipoLuz: l.tipo,
      pos: boca,
      normal: [0, -1, 0],
      ambiente: l.entrepiso ? (casa.entrepisos.find((e) => e.id === l.entrepiso)?.nombre ?? l.ambiente) : nombreAmb(l.ambiente),
      modulos: [],
      color,
      cuelga: l.cuelga,
    });
    anclas.set(l.id, boca);
    if (typeof l.desde === 'string') {
      const previa = anclas.get(l.desde);
      if (previa) conexiones.push({ id: l.id, pts: [boca, previa] });
      continue;
    }
    // Tramo de techo hasta la pared con canal y bajada hasta el canal.
    const rango = espacio(l.ambiente, l.techo, l.entrepiso);
    let elegido: { h: Horizontal; q: Punto2 } | null = null;
    for (const h of horizontales) {
      if (h.y < rango[0] - 1e-3 || h.y > rango[1] + 1e-3) continue;
      if (!h.cara || h.cara.ambiente !== l.ambiente) continue;
      if (Array.isArray(l.desde)) {
        const pr = proyectar(l.desde, plano(h.a), plano(h.b));
        if (pr.d > TOL) continue;
        elegido = { h, q: pr.q };
        break;
      }
      const pr = proyectar(l.techo, plano(h.a), plano(h.b));
      if (!elegido || pr.d < dist2(l.techo, elegido.q)) elegido = { h, q: pr.q };
    }
    if (!elegido) {
      adv.push(`${l.nombre}: no encontré canal en las paredes de ${nombreAmb(l.ambiente)} para llegar por el techo.`);
      continue;
    }
    const { h, q } = elegido;
    const hacia: Punto2 = [l.techo[0] - q[0], l.techo[1] - q[1]];
    const dh = Math.hypot(hacia[0], hacia[1]) || 1;
    const adentro: Punto2 = [q[0] + (hacia[0] / dh) * 0.02, q[1] + (hacia[1] / dh) * 0.02];
    const yPared = techoEn(amb, adentro, l.entrepiso) - bajoViga(q);
    conexiones.push({ id: l.id, pts: [boca, [q[0], yPared, q[1]], [q[0], h.y, q[1]]] });
  }

  // ── Red ──
  const polilineas = [...inst.canales.map((c) => c.puntos), ...conexiones.map((c) => c.pts)];
  const dentroDe = (a: Punto3, b: Punto3, [p, q]: [Punto3, Punto3]) =>
    proyectar3(a, p, q).d < UNIR && proyectar3(b, p, q).d < UNIR;
  const red = armarRed(polilineas, (a, b) =>
    internos.some((s) => dentroDe(a, b, s)) ? 'interno' : esPasaje(a, b) ? 'pasaje' : 'canal',
  );
  const nodoDe = new Map<string, number>();
  for (const [id, p] of anclas) nodoDe.set(id, red.nodo(p));
  const raiz = raizPos ? red.nodo(raizPos) : 0;
  const { dist, camino } = arbol(red, raiz);
  for (const [id, n] of nodoDe) {
    if (!Number.isFinite(dist[n])) adv.push(`"${id}" no está conectado al tablero por el canal.`);
  }
  const conectado = (id: string) => {
    const n = nodoDe.get(id);
    return n !== undefined && Number.isFinite(dist[n]);
  };
  const nodosConCaja = new Set(nodoDe.values());
  // Donde el canal entra al tablero también es "caja".
  red.aristas.forEach((ar) => {
    if (ar.interno) nodosConCaja.add(ar.a).add(ar.b);
  });

  // ── Cables de cada circuito ──
  // Se tiende dos veces: la segunda, todos los circuitos pueden empalmar en las cajas de paso que
  // hicieron falta en la primera (así no se pone una caja por circuito en la misma T).
  interface Conductor {
    circuito: string;
    funcion: Funcion;
    seccion: number;
    cantidad: number;
    t: Tendido;
  }
  let conductores: Conductor[] = [];
  let derivaciones = new Set<number>();
  for (let pasada = 0; pasada < 2; pasada++) {
    const previas = derivaciones;
    conductores = [];
    derivaciones = new Set(previas);
    tenderCircuitos(previas, pasada === 0);
  }

  function tenderCircuitos(cajasDePaso: Set<number>, avisar: boolean) {
  const aviso = (texto: string) => {
    if (avisar) adv.push(texto);
  };
  const tenderA = (desde: number, ids: string[]) => {
    const destinos = [...new Set(ids.filter(conectado).map((id) => nodoDe.get(id)!))].filter((n) => n !== desde);
    if (!destinos.length) return null;
    const t = tender(red, camino, desde, destinos, new Set([...cajasDePaso, ...derivaciones]));
    for (const d of t.derivaciones) derivaciones.add(d);
    return t;
  };
  const sumar = (circuito: string, funcion: Funcion, seccion: number, t: Tendido | null, cantidad = 1) => {
    if (t) conductores.push({ circuito, funcion, seccion, cantidad, t });
  };

  for (const circ of inst.circuitos) {
    if (circ.tipo === 'IUG') {
      const lucesC = inst.luces.filter((l) => l.circuito === circ.id);
      const idsLuces = lucesC.map((l) => l.id);
      const nt = tenderA(raiz, idsLuces);
      sumar(circ.id, 'neutro', circ.seccion, nt);
      sumar(circ.id, 'tierra', inst.seccionTierra, nt);
      // Fase: a cada caja con teclas de este circuito (en las combinaciones, solo a la primera).
      const conFase = new Set<string>();
      const prendidas = new Set<string>();
      const parejas = new Set<string>();
      for (const c of inst.cajas) {
        for (const m of c.modulos) {
          if (m.tipo === 'toma') continue;
          const propias = m.luces.filter((id) => idsLuces.includes(id));
          if (!propias.length) continue;
          propias.forEach((id) => prendidas.add(id));
          if (m.tipo === 'tecla') {
            conFase.add(c.id);
            const n = nodoDe.get(c.id);
            if (n !== undefined && conectado(c.id)) sumar(circ.id, 'retorno', circ.seccion, tenderA(n, propias));
          } else {
            const clave = [c.id, m.con].sort().join('|');
            if (parejas.has(clave)) continue;
            parejas.add(clave);
            if (!inst.cajas.some((x) => x.id === m.con)) {
              aviso(`${c.nombre}: la combinación apunta a una caja que no existe ("${m.con}").`);
              continue;
            }
            conFase.add(c.id);
            const n = nodoDe.get(c.id);
            const otra = nodoDe.get(m.con);
            if (n === undefined || otra === undefined || !conectado(c.id) || !conectado(m.con)) continue;
            sumar(circ.id, 'retorno', circ.seccion, tenderA(n, [m.con]), 2); // viajeros
            sumar(circ.id, 'retorno', circ.seccion, tenderA(otra, propias));
          }
        }
      }
      for (const l of lucesC) {
        if (!prendidas.has(l.id)) {
          aviso(`${l.nombre}: ninguna tecla la prende (le llevo la fase directo).`);
          conFase.add(l.id);
        }
      }
      sumar(circ.id, 'fase', circ.seccion, tenderA(raiz, [...conFase]));
    } else {
      const ids = inst.cajas.filter((c) => c.modulos.some((m) => m.tipo === 'toma' && m.circuito === circ.id)).map((c) => c.id);
      const t = tenderA(raiz, ids);
      sumar(circ.id, 'fase', circ.seccion, t);
      sumar(circ.id, 'neutro', circ.seccion, t);
      sumar(circ.id, 'tierra', inst.seccionTierra, t);
    }
  }
  }

  // ── Canal: qué medida va en cada tramo ──
  const ocupado = new Array<number>(red.aristas.length).fill(0);
  const cuenta = new Array<number>(red.aristas.length).fill(0);
  for (const c of conductores) {
    for (const [e, v] of c.t.veces) {
      ocupado[e] += v * c.cantidad * areaCable(c.seccion);
      cuenta[e] += v * c.cantidad;
    }
  }
  const medidas = [...inst.medidas].sort((p, q) => p.capacidad - q.capacidad);
  const medidaDe = red.aristas.map((ar, e) => {
    if (ar.pasaje || ar.interno) return null;
    const m = medidas.find((x) => x.capacidad >= ocupado[e] - 1e-6);
    if (!m) {
      adv.push(
        `Un tramo de canal lleva ${cuenta[e]} cables (${Math.round(ocupado[e])} mm²) y no entran en ${medidas.at(-1)?.nombre}: van dos canales.`,
      );
    }
    return m ?? medidas.at(-1)!;
  });
  const esCanal = (e: number) => !red.aristas[e].pasaje && !red.aristas[e].interno && red.aristas[e].largo > 1e-3;

  // ── Tramos para dibujar ──
  const tramos: TramoResuelto[] = [];
  red.aristas.forEach((ar, e) => {
    if (!esCanal(e)) return;
    const a = red.nodos[ar.a];
    const b = red.nodos[ar.b];
    const cara = caraDeTramo(a, b);
    let normal: Punto3;
    if (cara) normal = [cara.normal[0], 0, cara.normal[1]];
    else {
      const d = unitario3(resta(b, a));
      normal = unitario3([d[0] * d[1], -1 + d[1] * d[1], d[2] * d[1]]);
    }
    tramos.push({ a, b, medida: medidaDe[e]!, normal, ocupado: ocupado[e], conductores: cuenta[e] });
  });

  // ── Accesorios en cada nodo ──
  const accesorios = new Map<string, number>();
  const sumarAcc = (nombre: string, medida: MedidaCanal, n = 1) => {
    const clave = `${nombre}|${medida.nombre}`;
    accesorios.set(clave, (accesorios.get(clave) ?? 0) + n);
  };
  const dentroDeAmbiente = (q: Punto2) =>
    casa.ambientes.some((a) => puntoEnPoligono(q, a.poligono)) && !esPasaje([q[0], 0, q[1]], [q[0], 0, q[1]]);
  const direccion = (e: number, n: number) => unitario3(resta(red.nodos[red.otro(e, n)], red.nodos[n]));
  const mayor = (es: number[]) => es.map((e) => medidaDe[e]!).reduce((p, q) => (q.capacidad > p.capacidad ? q : p));
  red.nodos.forEach((p, n) => {
    const es = red.incidentes[n].filter(esCanal);
    if (!es.length) return;
    if (nodosConCaja.has(n) || derivaciones.has(n) || n === raiz) return;
    const m = mayor(es);
    const distintas = new Set(es.map((e) => medidaDe[e]!.nombre));
    if (distintas.size > 1) sumarAcc('Reducción', medidas[0], distintas.size - 1);
    if (es.length === 1) return sumarAcc('Tapa final', m);
    if (es.length >= 3) return sumarAcc('Derivación T', m, es.length - 2);
    const [v1, v2] = es.map((e) => direccion(e, n));
    const vert1 = Math.abs(v1[1]) > 0.95;
    const vert2 = Math.abs(v2[1]) > 0.95;
    if (vert1 && vert2) return;
    if (!vert1 && !vert2) {
      const p1 = unitario2([v1[0], v1[2]]);
      const p2 = unitario2([v2[0], v2[2]]);
      if (p1[0] * p2[0] + p1[1] * p2[1] < -0.95) return; // sigue derecho
      const bis = unitario2([p1[0] + p2[0], p1[1] + p2[1]]);
      const prueba: Punto2 = [p[0] + bis[0] * 0.05, p[2] + bis[1] * 0.05];
      return sumarAcc(dentroDeAmbiente(prueba) ? 'Ángulo interno' : 'Ángulo externo', m);
    }
    const h = vert1 ? v2 : v1;
    const hp = unitario2([h[0], h[2]]);
    const aLoLargo = caras.some(
      (c) => sobreCara(c, plano(p)) !== null && Math.abs(hp[0] * c.pared.dir[0] + hp[1] * c.pared.dir[1]) > 0.95,
    );
    sumarAcc(aLoLargo ? 'Ángulo plano' : 'Ángulo interno', m);
  });

  // Uniones: en cada tramo recto, una cada 2 m.
  const pasaDeLargo = (n: number) => {
    const es = red.incidentes[n].filter(esCanal);
    if (es.length !== 2 || nodosConCaja.has(n) || derivaciones.has(n) || n === raiz) return false;
    const [v1, v2] = es.map((e) => direccion(e, n));
    return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2] < -0.999 && medidaDe[es[0]] === medidaDe[es[1]];
  };
  const visitadas = new Set<number>();
  red.aristas.forEach((_, e) => {
    if (!esCanal(e) || visitadas.has(e)) return;
    let total = 0;
    const pila = [e];
    while (pila.length) {
      const f = pila.pop()!;
      if (visitadas.has(f)) continue;
      visitadas.add(f);
      total += red.aristas[f].largo;
      for (const n of [red.aristas[f].a, red.aristas[f].b]) {
        if (!pasaDeLargo(n)) continue;
        for (const g of red.incidentes[n]) if (g !== f && esCanal(g) && !visitadas.has(g)) pila.push(g);
      }
    }
    const uniones = Math.max(0, Math.ceil(total / LARGO_TIRA - 1e-6) - 1);
    if (uniones) sumarAcc('Unión', medidaDe[e]!, uniones);
  });

  // ── Cómputo ──
  const computo: ItemComputo[] = [];
  const item = (categoria: string, nombre: string, cantidad: number, unidad: string, detalle?: string, aDefinir?: boolean) => {
    if (cantidad > 0 || aDefinir) computo.push({ categoria, nombre, cantidad, unidad, detalle, aDefinir });
  };

  // Canal
  const CANAL = 'Cable canal (negro)';
  let metrosCanal = 0;
  for (const m of medidas) {
    const largo = red.aristas.reduce((s, ar, e) => s + (esCanal(e) && medidaDe[e] === m ? ar.largo : 0), 0);
    if (largo < 1e-3) continue;
    metrosCanal += largo;
    item(
      CANAL,
      `Cable canal ${m.nombre}`,
      Math.ceil((largo * DESPERDICIO) / LARGO_TIRA),
      'tiras de 2 m',
      `${fmt(largo, 1)} m de recorrido + 10 %`,
    );
    for (const nombre of ['Ángulo interno', 'Ángulo externo', 'Ángulo plano', 'Derivación T', 'Unión', 'Tapa final']) {
      item(CANAL, `${nombre} ${m.nombre}`, accesorios.get(`${nombre}|${m.nombre}`) ?? 0, 'u.');
    }
  }
  if (medidas.length > 1) {
    item(CANAL, `Reducción ${medidas.at(-1)!.nombre} → ${medidas[0].nombre}`, accesorios.get(`Reducción|${medidas[0].nombre}`) ?? 0, 'u.', 'donde cambia la medida del canal');
  }

  // Cajas y módulos
  const CAJAS = 'Cajas y módulos (negros)';
  let cajas1 = 0;
  let cajas2 = 0;
  let bastidores = 0;
  let ciegos = 0;
  let nTomas = 0;
  let nTeclas = 0;
  let nCombinacion = 0;
  let nExterior = 0;
  for (const c of inst.cajas) {
    const interiores = c.modulos.filter((m) => !(m.tipo === 'toma' && m.exterior));
    nExterior += c.modulos.length - interiores.length;
    for (const m of interiores) {
      if (m.tipo === 'toma') nTomas++;
      else if (m.tipo === 'tecla') nTeclas++;
      else nCombinacion++;
    }
    if (!interiores.length) continue;
    const b = Math.ceil(interiores.length / 3);
    bastidores += b;
    ciegos += b * 3 - interiores.length;
    if (b === 1) cajas1++;
    else cajas2++;
  }
  item(CAJAS, 'Caja exterior para 1 bastidor (hasta 3 módulos)', cajas1, 'u.');
  item(CAJAS, 'Caja exterior para 2 bastidores (hasta 6 módulos)', cajas2, 'u.');
  item(CAJAS, 'Bastidor con tapa de 3 módulos', bastidores, 'u.');
  item(CAJAS, 'Módulo toma 10 A (2 patas planas + tierra)', nTomas, 'u.');
  item(CAJAS, 'Módulo tecla simple', nTeclas, 'u.');
  item(CAJAS, 'Módulo tecla de combinación', nCombinacion, 'u.', 'escalera: una abajo y una arriba');
  item(CAJAS, 'Tapón ciego', ciegos, 'u.', 'para completar los bastidores');
  item(CAJAS, 'Toma exterior con tapa (IP44)', nExterior, 'u.');
  const bocasTecho = inst.luces.filter((l) => l.techo && !l.pared).length;
  const apliques = inst.luces.filter((l) => l.tipo === 'aplique' || l.tipo === 'aplique-exterior').length;
  item(CAJAS, 'Caja de paso para boca de techo', bocasTecho, 'u.', 'redonda u octogonal, exterior');
  item(CAJAS, 'Caja de paso para aplique', apliques, 'u.', 'o la base que traiga el aplique');
  const nGuirnaldas = inst.luces.filter((l) => l.tipo === 'guirnalda').length;
  item(CAJAS, 'Caja estanca (IP44) para conectar la guirnalda', nGuirnaldas, 'u.', 'con bornera o toma; con tecla adentro');
  item(CAJAS, 'Caja de paso / derivación', derivaciones.size, 'u.', 'en las T donde hay que empalmar');

  // Cables
  const CABLES = 'Cables (IRAM NM 247-3)';
  const metros = new Map<string, { seccion: number; funcion: Funcion; m: number }>();
  const metrosCircuito = new Map<string, number>();
  for (const c of conductores) {
    let m = 0;
    for (const [e, v] of c.t.veces) m += v * c.cantidad * red.aristas[e].largo;
    m += c.t.cajas * c.cantidad * PUNTA_POR_CAJA;
    m *= DESPERDICIO;
    const clave = `${c.seccion}|${c.funcion}`;
    const previo = metros.get(clave) ?? { seccion: c.seccion, funcion: c.funcion, m: 0 };
    previo.m += m;
    metros.set(clave, previo);
    metrosCircuito.set(c.circuito, (metrosCircuito.get(c.circuito) ?? 0) + m);
  }
  const ordenFuncion: Funcion[] = ['fase', 'neutro', 'retorno', 'tierra'];
  [...metros.values()]
    .sort((p, q) => p.seccion - q.seccion || ordenFuncion.indexOf(p.funcion) - ordenFuncion.indexOf(q.funcion))
    .forEach(({ seccion, funcion, m }) => {
      const total = Math.ceil(m);
      item(
        CABLES,
        `Cable ${fmt(seccion, seccion % 1 ? 1 : 0)} mm² ${COLOR_FUNCION[funcion]} (${NOMBRE_FUNCION[funcion]})`,
        total,
        'm',
        total > 60 ? `conviene el rollo de 100 m` : 'por metro (con 10 % de más y las puntas)',
      );
    });
  // Línea principal: del medidor (afuera) al tablero. Baja del medidor a la zanja, va por el
  // recorrido, sube por afuera de la pared del tablero y la atraviesa.
  const lp = inst.lineaPrincipal;
  let linea: ElectricaResuelta['linea'];
  const tabPunto = puntos.find((p) => p.clase === 'tablero');
  if (lp && lp.recorrido.length >= 2 && tabPunto) {
    const LINEA = 'Línea principal (medidor → tablero)';
    const horizontal = lp.recorrido.slice(1).reduce((suma, q, k) => suma + dist2(q, lp.recorrido[k]), 0);
    const y = lp.enterrada ? -lp.profundidad : 0.05;
    const yTablero = tabPunto.pos[1] - inst.tablero.alto / 2;
    const ultimo = lp.recorrido[lp.recorrido.length - 1];
    const espesor = r.paredes.find((w) => w.pared.id === inst.tablero.pared)?.espesor ?? 0.2;
    const metrosCano = horizontal + (lp.medidor.altura - y) + (yTablero - y) + espesor;
    const metrosCable = Math.ceil((metrosCano + 2 * PUNTA_POR_CAJA) * DESPERDICIO);
    item(
      LINEA,
      `Cable ${lp.enterrada ? 'subterráneo (IRAM 2178) ' : ''}2 × ${fmt(lp.seccion, 0)} mm²`,
      metrosCable,
      'm',
      `fase y neutro · ${fmt(horizontal, 0)} m de recorrido · sección a confirmar con el electricista`,
    );
    item(
      LINEA,
      lp.enterrada ? 'Caño para enterrar (PVC reforzado o corrugado, 32 mm)' : 'Caño para la línea (32 mm)',
      Math.ceil(metrosCano * DESPERDICIO),
      'm',
      lp.enterrada ? `zanja de ${fmt(lp.profundidad * 100, 0)} cm; las subidas al medidor y al tablero, en caño rígido` : undefined,
    );
    const yDibujo = 0.02; // se dibuja a ras del piso aunque vaya enterrada
    const [mx, mz] = lp.medidor.posicion;
    linea = {
      medidor: [mx, lp.medidor.altura, mz],
      enterrada: lp.enterrada,
      puntos: [
        [mx, lp.medidor.altura, mz],
        ...lp.recorrido.map((q): Punto3 => [q[0], yDibujo, q[1]]),
        [ultimo[0], yTablero, ultimo[1]],
        [tabPunto.pos[0], yTablero, tabPunto.pos[2]],
      ],
    };
  } else {
    item(CABLES, 'Línea del medidor al tablero', 0, '', 'sección y largo según dónde esté el medidor', true);
  }

  // Tablero
  const TAB = 'Tablero y protecciones';
  const usados = 2 + inst.circuitos.length * 2;
  item(TAB, `Gabinete de tablero exterior de ${inst.tablero.modulos} módulos (riel DIN, con puerta)`, 1, 'u.', `usa ${usados} módulos`);
  if (usados > inst.tablero.modulos) adv.push(`El tablero tiene ${inst.tablero.modulos} módulos y hacen falta ${usados}.`);
  item(TAB, `Interruptor diferencial bipolar ${inst.diferencial.amperes} A, ${inst.diferencial.sensibilidad} mA`, 1, 'u.');
  const termicas = new Map<number, string[]>();
  for (const c of inst.circuitos) termicas.set(c.termica, [...(termicas.get(c.termica) ?? []), c.nombre.toLowerCase()]);
  for (const [a, nombres] of [...termicas].sort((p, q) => p[0] - q[0])) {
    item(TAB, `Termomagnética bipolar ${a} A (curva C)`, nombres.length, 'u.', nombres.join(' · '));
  }
  item(TAB, 'Bornera de neutro y bornera de tierra', 1, 'juego');
  item(TAB, 'Puesta a tierra: jabalina con cámara de inspección y cable', 1, 'juego', 'a confirmar con el electricista', true);
  item(TAB, 'Interruptor general junto al medidor', 1, 'u.', 'lo que pida la distribuidora', true);

  // Luminarias
  const LUM = 'Luminarias';
  const porTipo = (t: TipoLuz) => inst.luces.filter((l) => l.tipo === t);
  item(LUM, 'Colgante', porTipo('colgante').length, 'u.', porTipo('colgante').map((l) => l.nombre.replace(/^Colgante /, '')).join(' · '));
  item(LUM, 'Plafón', porTipo('plafon').length, 'u.', porTipo('plafon').map((l) => l.nombre.replace(/^Plafón /, '')).join(' · '));
  item(LUM, 'Aplique interior', porTipo('aplique').length, 'u.', porTipo('aplique').map((l) => l.nombre.replace(/^Aplique /, '')).join(' · '));
  item(LUM, 'Aplique exterior (IP65)', porTipo('aplique-exterior').length, 'u.', porTipo('aplique-exterior').map((l) => l.nombre.replace(/^Aplique /, '')).join(' · '));
  const tiras = porTipo('tira-led');
  const metrosTira = tiras.reduce((s, l) => s + (l.largo ?? 1), 0);
  if (tiras.length) {
    item(LUM, 'Tira de LED 12 V (luz cálida)', Math.ceil(metrosTira), 'm', 'con perfil de aluminio');
    item(LUM, 'Fuente para tira de LED 12 V', tiras.length, 'u.');
  }
  // Guirnaldas: largo colgado (cada tramo baja `cuelga` en el medio: arco ≈ L + 8·c²/3L) + 50 cm.
  const guirnaldas = puntos.filter((p) => p.tipoLuz === 'guirnalda' && p.ganchos && p.ganchos.length >= 2);
  let metrosGuirnalda = 0;
  let metrosGuia = 0;
  let nGanchos = 0;
  for (const g of guirnaldas) {
    const ganchos = g.ganchos!;
    const c = g.cuelga ?? 0.3;
    nGanchos += ganchos.length;
    for (let k = 0; k < ganchos.length - 1; k++) {
      const L = dist2([ganchos[k][0], ganchos[k][2]], [ganchos[k + 1][0], ganchos[k + 1][2]]);
      metrosGuia += L;
      metrosGuirnalda += L + (8 * c * c) / (3 * Math.max(L, 0.1));
    }
    metrosGuirnalda += 0.5;
  }
  if (guirnaldas.length) {
    const lamparas = Math.round(metrosGuirnalda / 0.5);
    item(
      LUM,
      'Guirnalda de luces LED para exterior (IP44)',
      Math.ceil(metrosGuirnalda),
      'm',
      `${guirnaldas.map((g) => g.nombre.replace(/^Guirnalda /, '')).join(' · ')} · con unas ${lamparas} lámparas (una cada 50 cm); se venden de 5, 10 o 15 m`,
    );
  }
  item(LUM, 'Lámpara LED (E27 o según la luminaria)', inst.luces.length - tiras.length - guirnaldas.length, 'u.');

  // Varios
  const VAR = 'Varios';
  const pasajes = red.aristas.filter((a) => a.pasaje).length;
  item(VAR, 'Agujeros en paredes para pasar cables', pasajes, 'u.', 'con un caño corto o pasamuro');
  if (guirnaldas.length) {
    item(VAR, 'Gancho (armella) con taco para colgar la guirnalda', nGanchos, 'u.');
    item(VAR, 'Cable de acero de 2 mm con tensores (guía de la guirnalda)', Math.ceil(metrosGuia * 1.1), 'm', 'la guirnalda se ata a la guía y no carga su peso');
  }
  const fijaciones = Math.ceil(metrosCanal / PASO_FIJACION) + 2 * (inst.cajas.length + inst.luces.length) + 4;
  item(VAR, 'Tornillos y tarugos de 6 mm', Math.ceil(fijaciones / 10) * 10, 'u.', 'una fijación cada 50 cm de canal y dos por caja');
  item(VAR, 'Conectores de empalme (tipo Wago)', 3 * (inst.luces.length + derivaciones.size) + 10, 'u.', 'aprox.');
  item(VAR, 'Cinta aisladora y precintos', 1, 'juego');

  // ── Resúmenes ──
  const resumenCircuitos: ResumenCircuito[] = inst.circuitos.map((c) => {
    const luces = inst.luces.filter((l) => l.circuito === c.id).length;
    const tomas = inst.cajas.reduce((s, k) => s + k.modulos.filter((m) => m.tipo === 'toma' && m.circuito === c.id).length, 0);
    const cajasC = inst.cajas.filter((k) => k.modulos.some((m) => m.tipo === 'toma' && m.circuito === c.id)).length;
    return {
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      seccion: c.seccion,
      termica: c.termica,
      color: c.color,
      bocas: c.tipo === 'IUG' ? luces : cajasC,
      detalleBocas: c.tipo === 'IUG' ? `${luces} bocas de luz` : `${cajasC} cajas · ${tomas} tomas`,
      metrosCable: Math.ceil(metrosCircuito.get(c.id) ?? 0),
    };
  });
  const porAmbiente = new Map<string, ResumenAmbiente>();
  const fila = (nombre: string) => {
    if (!porAmbiente.has(nombre)) porAmbiente.set(nombre, { nombre, luces: 0, teclas: 0, tomas: 0 });
    return porAmbiente.get(nombre)!;
  };
  for (const pt of puntos) {
    if (pt.clase === 'luz') fila(pt.ambiente).luces++;
    for (const m of pt.modulos) {
      if (m.tipo === 'toma' || m.tipo === 'toma-exterior') fila(pt.ambiente).tomas++;
      else fila(pt.ambiente).teclas++;
    }
  }

  for (const c of inst.circuitos) {
    const n = c.tipo === 'IUG' ? inst.luces.filter((l) => l.circuito === c.id).length : 0;
    if (n > 15) adv.push(`El circuito "${c.nombre}" tiene ${n} bocas: conviene partirlo en dos (máximo habitual: 15).`);
  }

  return {
    puntos,
    tramos,
    derivaciones: [...derivaciones].map((n) => {
      const es = red.incidentes[n].filter(esCanal);
      const t = tramos.find((x) => es.some((e) => red.nodos[red.aristas[e].a] === x.a && red.nodos[red.aristas[e].b] === x.b));
      return { pos: red.nodos[n], normal: t?.normal ?? [0, 0, 1] };
    }),
    pasamuros: red.aristas
      .filter((ar) => ar.pasaje)
      .flatMap((ar) => {
        const a = red.nodos[ar.a];
        const b = red.nodos[ar.b];
        const d = unitario3([a[0] - b[0], 0, a[2] - b[2]]);
        return [
          { pos: a, normal: d },
          { pos: b, normal: [-d[0], 0, -d[2]] as Punto3 },
        ];
      }),
    computo,
    circuitos: resumenCircuitos,
    ambientes: [...porAmbiente.values()],
    metrosCanal,
    linea,
    advertencias: adv,
  };

  /** Ambiente donde se ve el punto: el de su cara, la oficina si está arriba o el del otro lado. */
  function ambienteDelPunto(ep: EnPared, u: Ubicado) {
    if (ep.entrepiso) return casa.entrepisos.find((e) => e.id === ep.entrepiso)?.nombre ?? ep.ambiente;
    if (ep.atraviesa) return nombreAmb(u.lado === 'izq' ? u.pared.der : u.pared.izq);
    return nombreAmb(ep.ambiente);
  }
}

const unitario2 = (p: Punto2): Punto2 => {
  const l = Math.hypot(p[0], p[1]) || 1;
  return [p[0] / l, p[1] / l];
};

/** Altura de la cara de abajo del techo de un ambiente en un punto. */
function alturaTecho(amb: Ambiente, t: TechoResuelto | undefined, casa: Casa, p: Punto2) {
  if (t) return t.alturaEn(p);
  return amb.alturaTecho ?? casa.alturaTecho;
}

/** 1 si el punto está debajo de la viga de la cumbrera, 0 si no. */
function enCumbrera(t: TechoResuelto, q: Punto2) {
  const viga = t.techo.viga;
  if (!viga) return 0;
  const rel: Punto2 = [q[0] - t.a[0], q[1] - t.a[1]];
  const d = Math.abs(rel[0] * -t.dir[1] + rel[1] * t.dir[0]);
  return d <= viga.ancho / 2 + 0.01 ? 1 : 0;
}

/** Pendientes de la instalación para el panel. */
export function pendientesInstalacion(inst: Instalacion, res: ElectricaResuelta) {
  const lista: { elemento: string; texto: string; vista?: string }[] = [];
  for (const t of inst.pendientes) lista.push({ elemento: 'Instalación', texto: t });
  const vista = (id: string) => res.puntos.find((p) => p.id === id)?.vista;
  if (inst.tablero.todo) lista.push({ elemento: inst.tablero.nombre, texto: inst.tablero.todo, vista: vista(inst.tablero.id) });
  const lp = inst.lineaPrincipal;
  if (lp?.medidor.todo) lista.push({ elemento: 'Medidor', texto: lp.medidor.todo });
  if (lp?.todo) lista.push({ elemento: 'Línea principal', texto: lp.todo });
  for (const c of inst.circuitos) if (c.todo) lista.push({ elemento: `Circuito: ${c.nombre}`, texto: c.todo });
  for (const l of inst.luces) if (l.todo) lista.push({ elemento: l.nombre, texto: l.todo, vista: vista(l.id) });
  for (const c of inst.cajas as CajaElectrica[]) if (c.todo) lista.push({ elemento: c.nombre, texto: c.todo, vista: vista(c.id) });
  for (const c of inst.canales) if (c.todo) lista.push({ elemento: c.nombre ?? c.id, texto: c.todo });
  return lista;
}
