/**
 * Techos inclinados (a dos aguas o a un agua): faldones y alturas derivados de los datos
 * (sin React ni three.js).
 */
import type { Ambiente, Punto2, TechoInclinado } from '../data/tipos';

/** Recorta un polígono y deja la parte donde `f(p) ≥ 0` (Sutherland–Hodgman, un semiplano). */
export function recortar(poli: Punto2[], f: (p: Punto2) => number): Punto2[] {
  const salida: Punto2[] = [];
  for (let k = 0; k < poli.length; k++) {
    const p = poli[k];
    const q = poli[(k + 1) % poli.length];
    const fp = f(p);
    const fq = f(q);
    if (fp >= 0) salida.push(p);
    if ((fp > 0 && fq < 0) || (fp < 0 && fq > 0)) {
      const t = fp / (fp - fq);
      salida.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return salida;
}

/** Área con signo de un polígono en planta (o en el plano de una pared). */
function areaConSigno(poli: Punto2[]) {
  let a = 0;
  for (let k = 0; k < poli.length; k++) {
    const [x0, z0] = poli[k];
    const [x1, z1] = poli[(k + 1) % poli.length];
    a += x0 * z1 - x1 * z0;
  }
  return a / 2;
}

/**
 * Agranda un polígono `d` metros hacia afuera por todos sus lados (esquinas en inglete).
 * Sirve para meter las tablas del techo dentro de las paredes: si el techo termina justo en la cara
 * de la pared, el sol se filtra por la junta y deja una raya de luz.
 */
export function agrandar(poli: Punto2[], d: number): Punto2[] {
  const p = poli.filter((q, k) => {
    const r = poli[(k + 1) % poli.length];
    return Math.hypot(q[0] - r[0], q[1] - r[1]) > 1e-9;
  });
  const signo = areaConSigno(p) >= 0 ? 1 : -1;
  const normal = (a: Punto2, b: Punto2): Punto2 => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(signo * (b[1] - a[1])) / l, (-signo * (b[0] - a[0])) / l];
  };
  return p.map((q, k) => {
    const n1 = normal(p[(k - 1 + p.length) % p.length], q);
    const n2 = normal(q, p[(k + 1) % p.length]);
    const den = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    if (den < 1e-6) return [q[0] + n1[0] * d, q[1] + n1[1] * d];
    return [q[0] + (d * (n1[0] + n2[0])) / den, q[1] + (d * (n1[1] + n2[1])) / den];
  });
}

/** Un lado del techo, de la cumbrera a la pared baja. */
export interface Faldon {
  /** Parte del ambiente que queda de este lado de la cumbrera. */
  poligono: Punto2[];
  /** Dirección horizontal hacia la que baja (perpendicular a la cumbrera). */
  baja: Punto2;
  /** Distancia horizontal de la cumbrera al borde más lejano de este lado. */
  ancho: number;
  /** Cuánto baja por cada metro horizontal. */
  pendiente: number;
}

export interface TechoResuelto {
  ambiente: string;
  techo: TechoInclinado;
  /** Punto `a` de la cumbrera, su dirección y su largo. */
  a: Punto2;
  dir: Punto2;
  largo: number;
  faldones: Faldon[];
  /** Altura de la cara de abajo de las tablas en un punto en planta (sigue de largo fuera del ambiente). */
  alturaEn: (p: Punto2) => number;
}

export function resolverTecho(amb: Ambiente): TechoResuelto | null {
  const techo = amb.techo;
  if (!techo) return null;
  const [a, b] = techo.cumbrera;
  const largo = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const dir: Punto2 = [(b[0] - a[0]) / largo, (b[1] - a[1]) / largo];
  const n: Punto2 = [-dir[1], dir[0]];
  /** Distancia con signo a la línea de la cumbrera. */
  const s = (p: Punto2) => (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1];
  const caida = techo.alturaCumbrera - techo.alturaBorde;

  const pendientes = new Map<number, number>();
  const faldones: Faldon[] = [];
  for (const signo of [1, -1]) {
    const poligono = recortar(amb.poligono, (p) => signo * s(p));
    const ancho = Math.max(0, ...poligono.map((p) => signo * s(p)));
    const pendiente = ancho > 1e-3 ? caida / ancho : 0;
    pendientes.set(signo, pendiente);
    if (poligono.length >= 3 && ancho > 1e-3) {
      faldones.push({ poligono, baja: [n[0] * signo, n[1] * signo], ancho, pendiente });
    }
  }
  const alturaEn = (p: Punto2) => {
    const d = s(p);
    return techo.alturaCumbrera - Math.abs(d) * (pendientes.get(d >= 0 ? 1 : -1) ?? 0);
  };
  return { ambiente: amb.id, techo, a, dir, largo, faldones, alturaEn };
}

/** Altura máxima del techo de un ambiente: la cumbrera si es a dos aguas. */
export function alturaMaximaTecho(amb: Ambiente, alturaGeneral: number) {
  return amb.techo?.alturaCumbrera ?? amb.alturaTecho ?? alturaGeneral;
}

/**
 * Parte de una pared que sube por encima de su `alto` hasta el techo inclinado (hastial), en
 * coordenadas locales de la pared: [u a lo largo desde `a`, y vertical]. `null` si no sobresale.
 */
export function remateHastaTecho(
  t: TechoResuelto,
  a: Punto2,
  dir: Punto2,
  u0: number,
  u1: number,
  alto: number,
): Punto2[] | null {
  const punto = (u: number): Punto2 => [a[0] + dir[0] * u, a[1] + dir[1] * u];
  const us = [u0, u1];
  // Donde la pared cruza la cumbrera, el perfil del techo hace pico.
  const n: Punto2 = [-t.dir[1], t.dir[0]];
  const avance = dir[0] * n[0] + dir[1] * n[1];
  if (Math.abs(avance) > 1e-6) {
    const uPico = -((a[0] - t.a[0]) * n[0] + (a[1] - t.a[1]) * n[1]) / avance;
    if (uPico > u0 && uPico < u1) us.splice(1, 0, uPico);
  }
  const arriba: Punto2[] = us.map((u) => [u, t.alturaEn(punto(u))]);
  const poli = recortar([[u0, alto], [u1, alto], ...arriba.reverse()], ([, y]) => y - alto);
  return poli.length >= 3 && Math.abs(areaConSigno(poli)) > 1e-4 ? poli : null;
}
