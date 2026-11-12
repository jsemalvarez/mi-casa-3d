import type { Entrepiso, Mueble, Punto2 } from '../data/tipos';
import { add, dot, len, mul, norm, sub, type ParedResuelta } from './geometria';

/** Rectángulo orientado en planta que no se puede atravesar, entre dos alturas. */
export interface Obstaculo {
  centro: Punto2;
  dir: Punto2; // eje "u" del rectángulo
  mu: number; // medio largo sobre u
  mv: number; // medio ancho
  y0: number;
  y1: number;
}

/** Paredes (los huecos de las puertas abiertas quedan libres), barandas de entrepisos y muebles. */
export function construirObstaculos(
  paredes: ParedResuelta[],
  entrepisos: Entrepiso[],
  muebles: Mueble[] = [],
  puertasCerradas: Record<string, true> = {},
): Obstaculo[] {
  const lista: Obstaculo[] = [];
  for (const p of paredes) {
    for (const pz of p.piezas) {
      lista.push({
        centro: add(p.a, mul(p.dir, (pz.u0 + pz.u1) / 2)),
        dir: p.dir,
        mu: (pz.u1 - pz.u0) / 2,
        mv: p.espesor / 2,
        y0: pz.y0,
        y1: pz.y1,
      });
    }
    // Las puertas balcón están cerradas (vidrio) y las puertas cerradas tampoco se atraviesan.
    for (const ab of p.aberturas) {
      // Corrediza abierta: solo tapa la mitad de la hoja fija.
      if (ab.tipo === 'puerta-balcon' && ab.hoja?.tipo === 'corrediza' && !puertasCerradas[ab.id]) {
        const mitad = ab.ancho / 2;
        const u = ab.hoja.fija === 'a' ? ab.desde + mitad / 2 : ab.desde + ab.ancho - mitad / 2;
        lista.push({ centro: add(p.a, mul(p.dir, u)), dir: p.dir, mu: mitad / 2, mv: p.espesor / 2, y0: 0, y1: ab.alto });
        continue;
      }
      if (ab.tipo !== 'puerta-balcon' && !(ab.tipo === 'puerta' && puertasCerradas[ab.id])) continue;
      lista.push({
        centro: add(p.a, mul(p.dir, ab.desde + ab.ancho / 2)),
        dir: p.dir,
        mu: ab.ancho / 2,
        mv: p.espesor / 2,
        y0: 0,
        y1: ab.alto,
      });
    }
  }
  for (const en of entrepisos) {
    // Postes, desde el piso hasta el entrepiso.
    for (const poste of en.postes ?? []) {
      lista.push({ centro: poste, dir: [1, 0], mu: 0.04, mv: 0.04, y0: 0, y1: en.nivel });
    }
    // Barandas o listones: frenan arriba, no abajo.
    for (const tramo of en.barandas ?? []) {
      for (let k = 0; k < tramo.length - 1; k++) {
        const d = sub(tramo[k + 1], tramo[k]);
        lista.push({
          centro: add(tramo[k], mul(d, 0.5)),
          dir: norm(d),
          mu: len(d) / 2,
          mv: 0.03,
          y0: en.nivel,
          y1: en.nivel + (en.altoBaranda ?? 0.9),
        });
      }
    }
  }
  for (const m of muebles) {
    const base = m.elevacion ?? 0;
    const g = ((m.giro ?? 0) * Math.PI) / 180;
    lista.push({
      centro: m.centro,
      dir: [Math.cos(g), Math.sin(g)],
      mu: m.ancho / 2,
      mv: m.profundidad / 2,
      y0: base,
      y1: base + m.alto,
    });
  }
  return lista;
}

/**
 * Empuja un círculo de radio `r` fuera de los obstáculos que están a la altura del cuerpo
 * de alguien parado en `piso` (de 0,3 a 1,6 m sobre su piso).
 */
export function resolverColision(p: Punto2, r: number, obstaculos: Obstaculo[], piso = 0): Punto2 {
  const cuerpo0 = piso + 0.3;
  const cuerpo1 = piso + 1.6;
  const activos = obstaculos.filter((o) => o.y1 > cuerpo0 && o.y0 < cuerpo1);
  let pos = p;
  for (let iter = 0; iter < 3; iter++) {
    let movido = false;
    for (const o of activos) {
      const d = sub(pos, o.centro);
      const n: Punto2 = [-o.dir[1], o.dir[0]];
      const lu = dot(d, o.dir);
      const lv = dot(d, n);
      const cu = Math.max(-o.mu, Math.min(o.mu, lu));
      const cv = Math.max(-o.mv, Math.min(o.mv, lv));
      let du = lu - cu;
      let dv = lv - cv;
      const dist = Math.hypot(du, dv);
      if (dist >= r) continue;
      if (dist > 1e-6) {
        const k = (r - dist) / dist;
        du *= k;
        dv *= k;
      } else {
        // El centro quedó adentro: sale por el lado más cercano.
        const pu = o.mu - Math.abs(lu);
        const pv = o.mv - Math.abs(lv);
        if (pu < pv) {
          du = Math.sign(lu || 1) * (pu + r);
          dv = 0;
        } else {
          du = 0;
          dv = Math.sign(lv || 1) * (pv + r);
        }
      }
      pos = add(pos, add(mul(o.dir, du), mul(n, dv)));
      movido = true;
    }
    if (!movido) break;
  }
  return pos;
}
