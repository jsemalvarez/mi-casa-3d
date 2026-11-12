/**
 * Geometría derivada de los datos de la casa (sin React ni three.js):
 * uniones de paredes, piezas de muro alrededor de las aberturas, qué ambiente
 * hay a cada lado de cada pared y las "vistas de frente" de cada pared.
 */
import type { Abertura, Ambiente, Casa, Pared, Punto2 } from '../data/tipos';

const EPS = 1e-3;

// ── Vectores 2D ──────────────────────────────────────────────────────────────
export const sub = (p: Punto2, q: Punto2): Punto2 => [p[0] - q[0], p[1] - q[1]];
export const add = (p: Punto2, q: Punto2): Punto2 => [p[0] + q[0], p[1] + q[1]];
export const mul = (p: Punto2, k: number): Punto2 => [p[0] * k, p[1] * k];
export const dot = (p: Punto2, q: Punto2) => p[0] * q[0] + p[1] * q[1];
export const len = (p: Punto2) => Math.hypot(p[0], p[1]);
export const norm = (p: Punto2): Punto2 => {
  const l = len(p) || 1;
  return [p[0] / l, p[1] / l];
};
const cross = (p: Punto2, q: Punto2) => p[0] * q[1] - p[1] * q[0];
const cerca = (p: Punto2, q: Punto2) => len(sub(p, q)) < EPS;

/** Normal izquierda (mirando a lo largo de `d`, con Y hacia arriba). */
export const izquierdaDe = (d: Punto2): Punto2 => [d[1], -d[0]];
/** Normal derecha. */
export const derechaDe = (d: Punto2): Punto2 => [-d[1], d[0]];

function distPuntoSegmento(p: Punto2, a: Punto2, b: Punto2) {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  return len(sub(p, add(a, mul(ab, t))));
}

export function puntoEnPoligono(p: Punto2, poli: Punto2[]) {
  let dentro = false;
  for (let k = 0, j = poli.length - 1; k < poli.length; j = k++) {
    const [xi, zi] = poli[k];
    const [xj, zj] = poli[j];
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) dentro = !dentro;
  }
  return dentro;
}

export function centroide(poli: Punto2[]): Punto2 {
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let k = 0; k < poli.length; k++) {
    const [x0, z0] = poli[k];
    const [x1, z1] = poli[(k + 1) % poli.length];
    const f = x0 * z1 - x1 * z0;
    a += f;
    cx += (x0 + x1) * f;
    cz += (z0 + z1) * f;
  }
  if (Math.abs(a) < 1e-9) return poli[0];
  return [cx / (3 * a), cz / (3 * a)];
}

export function area(poli: Punto2[]) {
  let a = 0;
  for (let k = 0; k < poli.length; k++) {
    const [x0, z0] = poli[k];
    const [x1, z1] = poli[(k + 1) % poli.length];
    a += x0 * z1 - x1 * z0;
  }
  return Math.abs(a) / 2;
}

export function caja(poli: Punto2[]) {
  const xs = poli.map((p) => p[0]);
  const zs = poli.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

// ── Tipos derivados ──────────────────────────────────────────────────────────
export type Lado = 'izq' | 'der';

/** Rectángulo de muro en coordenadas locales de la pared (u a lo largo, y vertical). */
export interface Pieza {
  u0: number;
  u1: number;
  y0: number;
  y1: number;
}

export interface ParedResuelta {
  pared: Pared;
  a: Punto2;
  dir: Punto2;
  largo: number;
  alto: number;
  espesor: number;
  /** Rotación alrededor de Y que lleva el eje local X a la dirección de la pared. */
  angulo: number;
  /** Alargue (+) o recorte (−) en cada extremo, resuelto por las uniones. */
  extInicio: number;
  extFin: number;
  /** id del ambiente a cada lado (null = exterior sin nombre). */
  izq: string | null;
  der: string | null;
  /** id de la vista de frente a la que pertenece cada cara. */
  vistaIzq: string;
  vistaDer: string;
  aberturas: Abertura[];
  /** Piezas de muro a altura completa (sin corte). */
  piezas: Pieza[];
}

export interface VistaPared {
  id: string;
  titulo: string;
  detalle: string;
  /** Ambiente interior que se mira, o null para fachadas. */
  ambiente: string | null;
  /** Normal que sale de la pared hacia quien mira (en planta). */
  normal: Punto2;
  /** Punto al que mira la cámara (centro de la pared, a media altura). */
  objetivo: [number, number, number];
  /** Distancia de la cámara al objetivo, medida sobre la normal. */
  distancia: number;
  ancho: number;
  alto: number;
  /** Dirección "derecha en pantalla" y rango que ocupa el ambiente sobre ella (para recortar la vista). */
  tangente: Punto2;
  rango: [number, number];
}

export interface CasaResuelta {
  casa: Casa;
  paredes: ParedResuelta[];
  vistas: VistaPared[];
  /** Límites en planta de todo lo construido (paredes incluidas). */
  limites: { x0: number; x1: number; z0: number; z1: number };
  advertencias: string[];
}

// ── Uniones ──────────────────────────────────────────────────────────────────
function resolverExtremo(idx: number, extremo: 'a' | 'b', paredes: Pared[]): number {
  const w = paredes[idx];
  const p = w[extremo];
  const dw = norm(sub(w.b, w.a));
  const tocan = paredes
    .map((v, k) => ({ v, k }))
    .filter(({ v, k }) => k !== idx && distPuntoSegmento(p, v.a, v.b) < EPS);
  if (tocan.length === 0) return 0;

  // Encuentro en T: la pared llega al medio de otra → se recorta hasta su cara.
  const pasantes = tocan.filter(({ v }) => !cerca(p, v.a) && !cerca(p, v.b));
  if (pasantes.length) return -Math.max(...pasantes.map(({ v }) => v.espesor / 2));

  const paralela = (v: Pared) => Math.abs(cross(dw, norm(sub(v.b, v.a)))) < 1e-3;
  const colineales = tocan.filter(({ v }) => paralela(v));
  const otras = tocan.filter(({ v }) => !paralela(v));

  // Llega a un punto donde otras dos paredes siguen en línea recta → también es T.
  // Si esas dos tienen distinto espesor se recorta con el menor: mejor que se meta un
  // poco en la más gruesa (no se ve) a que quede un hueco.
  for (let m = 0; m < otras.length; m++) {
    for (let n = m + 1; n < otras.length; n++) {
      const d1 = norm(sub(otras[m].v.b, otras[m].v.a));
      const d2 = norm(sub(otras[n].v.b, otras[n].v.a));
      if (Math.abs(cross(d1, d2)) < 1e-3) {
        return -Math.min(otras[m].v.espesor, otras[n].v.espesor) / 2;
      }
    }
  }
  // Sigue de largo en otra pared colineal: no se toca.
  if (colineales.length) return 0;
  // Esquina en L: la que aparece primero en la lista se alarga, la otra se recorta.
  if (otras.length) {
    const t = Math.max(...otras.map(({ v }) => v.espesor)) / 2;
    const primero = otras.every(({ k }) => idx < k);
    return primero ? t : -t;
  }
  return 0;
}

/**
 * Piezas de muro que quedan alrededor de las aberturas. Admite aberturas encimadas
 * (p. ej. una puerta abajo y una ventana arriba en el mismo tramo): la pared se corta en
 * franjas verticales en cada borde de abertura y a cada franja se le restan los huecos.
 */
function calcularPiezas(u0: number, u1: number, alto: number, aberturas: Abertura[]): Pieza[] {
  const cortes = new Set<number>([u0, u1]);
  for (const ab of aberturas) {
    cortes.add(Math.min(u1, Math.max(u0, ab.desde)));
    cortes.add(Math.min(u1, Math.max(u0, ab.desde + ab.ancho)));
  }
  const us = [...cortes].sort((p, q) => p - q);
  const piezas: Pieza[] = [];
  for (let k = 0; k < us.length - 1; k++) {
    const a = us[k];
    const b = us[k + 1];
    if (b - a < EPS) continue;
    const medio = (a + b) / 2;
    const huecos = aberturas
      .filter((ab) => ab.desde < medio && medio < ab.desde + ab.ancho)
      .map((ab) => [ab.antepecho ?? 0, Math.min(alto, (ab.antepecho ?? 0) + ab.alto)] as const)
      .sort((p, q) => p[0] - q[0]);
    let y = 0;
    for (const [h0, h1] of huecos) {
      if (h0 > y + EPS) piezas.push({ u0: a, u1: b, y0: y, y1: h0 });
      y = Math.max(y, h1);
    }
    if (y < alto - EPS) piezas.push({ u0: a, u1: b, y0: y, y1: alto });
  }
  // Une franjas vecinas que quedaron con la misma altura (menos piezas que dibujar).
  const unidas: Pieza[] = [];
  for (const pz of piezas) {
    const previa = unidas.find(
      (q) => Math.abs(q.u1 - pz.u0) < EPS && Math.abs(q.y0 - pz.y0) < EPS && Math.abs(q.y1 - pz.y1) < EPS,
    );
    if (previa) previa.u1 = pz.u1;
    else unidas.push({ ...pz });
  }
  return unidas;
}

// ── Orientación ──────────────────────────────────────────────────────────────
const CARDINALES = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];

/** Punto cardinal real de una dirección en planta, según `casa.norte`. */
export function cardinal(d: Punto2, norteGrados: number) {
  const enPlano = (Math.atan2(d[0], -d[1]) * 180) / Math.PI; // 0 = arriba de la planta, horario
  const real = (((enPlano - norteGrados) % 360) + 360) % 360;
  return CARDINALES[Math.round(real / 45) % 8];
}

function ambienteEn(p: Punto2, ambientes: Ambiente[]) {
  return ambientes.find((amb) => puntoEnPoligono(p, amb.poligono)) ?? null;
}

// ── Resolución completa ──────────────────────────────────────────────────────
export function resolverCasa(casa: Casa): CasaResuelta {
  const advertencias: string[] = [];
  const ids = new Set<string>();
  for (const el of [
    ...casa.ambientes,
    ...casa.paredes,
    ...casa.aberturas,
    ...casa.entrepisos,
    ...casa.escaleras,
    ...casa.muebles,
  ]) {
    if (ids.has(el.id)) advertencias.push(`id repetido: "${el.id}"`);
    ids.add(el.id);
  }
  for (const ab of casa.aberturas) {
    if (!casa.paredes.some((p) => p.id === ab.pared)) {
      advertencias.push(`La abertura "${ab.id}" apunta a una pared que no existe ("${ab.pared}").`);
    }
  }
  const nombreAmb = (id: string | null) =>
    id ? (casa.ambientes.find((a) => a.id === id)?.nombre ?? id) : 'exterior';
  const esInterior = (id: string | null) =>
    !!id && !casa.ambientes.find((a) => a.id === id)?.exterior;

  // Paredes
  const paredes: ParedResuelta[] = casa.paredes.map((pared, idx) => {
    const v = sub(pared.b, pared.a);
    const largo = len(v);
    const dir = norm(v);
    const alto = pared.alto ?? casa.alturaTecho;
    const extInicio = resolverExtremo(idx, 'a', casa.paredes);
    const extFin = resolverExtremo(idx, 'b', casa.paredes);
    const propias = casa.aberturas.filter((ab) => ab.pared === pared.id);
    for (const ab of propias) {
      if (ab.desde < -EPS || ab.desde + ab.ancho > largo + EPS) {
        advertencias.push(`La abertura "${ab.id}" se sale de la pared "${pared.id}" (largo ${largo.toFixed(2)} m).`);
      }
      if ((ab.antepecho ?? 0) + ab.alto > alto + EPS) {
        advertencias.push(`La abertura "${ab.id}" es más alta que la pared "${pared.id}".`);
      }
    }
    for (let m = 0; m < propias.length; m++) {
      for (let n = m + 1; n < propias.length; n++) {
        const [p, q] = [propias[m], propias[n]];
        const seCruzanU = p.desde < q.desde + q.ancho - EPS && q.desde < p.desde + p.ancho - EPS;
        const [p0, q0] = [p.antepecho ?? 0, q.antepecho ?? 0];
        const seCruzanY = p0 < q0 + q.alto - EPS && q0 < p0 + p.alto - EPS;
        if (seCruzanU && seCruzanY) advertencias.push(`Las aberturas "${p.id}" y "${q.id}" se pisan.`);
      }
    }
    // Ambiente a cada lado: se prueba un punto apenas afuera de cada cara, en dos lugares.
    const lado = (n: Punto2) => {
      const enT = (t: number) =>
        ambienteEn(add(add(pared.a, mul(dir, largo * t)), mul(n, pared.espesor / 2 + 0.05)), casa.ambientes)?.id ??
        null;
      const r1 = enT(0.25);
      const r2 = enT(0.75);
      if (r1 !== r2) {
        advertencias.push(
          `Un lado de la pared "${pared.id}" da a dos ambientes (${nombreAmb(r1)} y ${nombreAmb(r2)}): conviene partirla.`,
        );
      }
      return enT(0.5);
    };
    const izq = lado(izquierdaDe(dir));
    const der = lado(derechaDe(dir));
    if (esInterior(izq) && izq === der) {
      advertencias.push(`La pared "${pared.id}" tiene el mismo ambiente a los dos lados.`);
    }
    return {
      pared,
      a: pared.a,
      dir,
      largo,
      alto,
      espesor: pared.espesor,
      angulo: Math.atan2(-dir[1], dir[0]),
      extInicio,
      extFin,
      izq,
      der,
      vistaIzq: '',
      vistaDer: '',
      aberturas: propias,
      piezas: calcularPiezas(-extInicio, largo + extFin, alto, propias),
    };
  });

  // Límites de lo construido
  const esquinas: Punto2[] = [];
  for (const p of paredes) {
    const ini = add(p.a, mul(p.dir, -p.extInicio));
    const fin = add(p.a, mul(p.dir, p.largo + p.extFin));
    const n = mul(izquierdaDe(p.dir), p.espesor / 2);
    esquinas.push(add(ini, n), sub(ini, n), add(fin, n), sub(fin, n));
  }
  for (const amb of casa.ambientes) if (!amb.exterior) esquinas.push(...amb.poligono);
  const limites = caja(esquinas);

  // Vistas de frente: las caras que dan a un ambiente (también a uno exterior con nombre,
  // como el patio) se agrupan por (ambiente, orientación); las que dan afuera, por orientación.
  type Grupo = { normal: Punto2; ambiente: string | null; caras: { p: ParedResuelta; lado: Lado }[] };
  const grupos = new Map<string, Grupo>();
  const claveDir = (n: Punto2) => `${Math.round(n[0] * 100)},${Math.round(n[1] * 100)}`;
  for (const p of paredes) {
    for (const ladoActual of ['izq', 'der'] as Lado[]) {
      const amb = ladoActual === 'izq' ? p.izq : p.der;
      const normal = ladoActual === 'izq' ? izquierdaDe(p.dir) : derechaDe(p.dir);
      const clave = amb ? `${amb}|${claveDir(normal)}` : `exterior|${claveDir(normal)}`;
      if (!grupos.has(clave)) grupos.set(clave, { normal, ambiente: amb, caras: [] });
      grupos.get(clave)!.caras.push({ p, lado: ladoActual });
    }
  }

  const vistas: VistaPared[] = [];
  const H = casa.alturaTecho;
  for (const g of grupos.values()) {
    if (g.caras.length === 0) continue;
    const n = g.normal;
    const t: Punto2 = [n[1], -n[0]]; // derecha en pantalla mirando hacia la pared
    // Alto de la vista: el techo del ambiente si es interior; si no, la pared más alta.
    const ambGrupo = g.ambiente ? casa.ambientes.find((a) => a.id === g.ambiente) : undefined;
    const alto =
      ambGrupo && !ambGrupo.exterior
        ? (ambGrupo.alturaTecho ?? H)
        : Math.max(...g.caras.map((c) => c.p.alto));
    let t0: number;
    let t1: number;
    let sObjetivo: number;
    let sCamara: number;
    let titulo: string;
    const vecinos = new Set<string>();
    for (const c of g.caras) {
      const otro = c.lado === 'izq' ? c.p.der : c.p.izq;
      vecinos.add(nombreAmb(otro));
    }
    const sCaras = g.caras.map((c) => dot(add(c.p.a, mul(n, c.p.espesor / 2)), n));
    let id: string;
    if (g.ambiente) {
      const amb = casa.ambientes.find((a) => a.id === g.ambiente)!;
      const ts = amb.poligono.map((q) => dot(q, t));
      const ss = amb.poligono.map((q) => dot(q, n));
      t0 = Math.min(...ts);
      t1 = Math.max(...ts);
      sObjetivo = Math.min(...sCaras);
      sCamara = Math.max(...ss) - 0.05;
      const card = cardinal(mul(n, -1), casa.norte.grados);
      id = `${amb.id}:${card}`;
      titulo = `${amb.nombre} · pared ${card}`;
    } else {
      const ts: number[] = [];
      for (const c of g.caras) {
        const ini = add(c.p.a, mul(c.p.dir, -c.p.extInicio));
        const fin = add(c.p.a, mul(c.p.dir, c.p.largo + c.p.extFin));
        ts.push(dot(ini, t), dot(fin, t));
      }
      t0 = Math.min(...ts);
      t1 = Math.max(...ts);
      sObjetivo = Math.max(...sCaras);
      const sCasa = Math.max(
        limites.x0 * n[0] + limites.z0 * n[1],
        limites.x1 * n[0] + limites.z0 * n[1],
        limites.x0 * n[0] + limites.z1 * n[1],
        limites.x1 * n[0] + limites.z1 * n[1],
      );
      sCamara = sCasa + 8;
      const card = cardinal(n, casa.norte.grados);
      id = `fachada:${card}`;
      titulo = `Fachada ${card}`;
    }
    // Ids únicos aunque dos grupos caigan en el mismo cardinal.
    let idUnico = id;
    for (let k = 2; vistas.some((v) => v.id === idUnico); k++) idUnico = `${id}-${k}`;
    const tc = (t0 + t1) / 2;
    const centro = add(mul(t, tc), mul(n, sObjetivo));
    vistas.push({
      id: idUnico,
      titulo,
      detalle: g.ambiente
        ? `Limita con: ${[...vecinos].join(', ')}`
        : `Ambientes detrás: ${[...vecinos].join(', ')}`,
      ambiente: g.ambiente,
      normal: n,
      objetivo: [centro[0], alto / 2, centro[1]],
      distancia: Math.max(0.2, sCamara - sObjetivo),
      ancho: t1 - t0,
      alto,
      tangente: t,
      rango: [t0, t1],
    });
    for (const c of g.caras) {
      if (c.lado === 'izq') c.p.vistaIzq = idUnico;
      else c.p.vistaDer = idUnico;
    }
  }
  // Orden: por ambiente (en el orden de los datos), fachadas al final.
  const ordenAmb = (v: VistaPared) =>
    v.ambiente ? casa.ambientes.findIndex((a) => a.id === v.ambiente) : casa.ambientes.length;
  const ordenCard = (v: VistaPared) => CARDINALES.indexOf((v.id.split(':')[1] ?? '').replace(/-\d+$/, ''));
  vistas.sort((p, q) => ordenAmb(p) - ordenAmb(q) || ordenCard(p) - ordenCard(q));

  return { casa, paredes, vistas, limites, advertencias };
}

/** Ambiente-nombre legible para un lado. */
export function nombreAmbiente(casa: Casa, id: string | null) {
  return id ? (casa.ambientes.find((a) => a.id === id)?.nombre ?? id) : 'exterior';
}

/** Color resuelto de la cara de una pared. */
export function colorCara(casa: Casa, p: ParedResuelta, lado: Lado) {
  const propio = lado === 'izq' ? p.pared.colorIzq : p.pared.colorDer;
  if (propio) return propio;
  const ambId = lado === 'izq' ? p.izq : p.der;
  const amb = ambId ? casa.ambientes.find((a) => a.id === ambId) : undefined;
  if (amb?.colorParedes) return amb.colorParedes;
  return amb && !amb.exterior ? casa.colores.paredInterior : casa.colores.paredExterior;
}

/** Formato argentino: 4,80 */
export const fmt = (n: number, dec = 2) => n.toFixed(dec).replace('.', ',');
