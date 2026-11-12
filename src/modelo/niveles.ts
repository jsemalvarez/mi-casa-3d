import type { Casa, Punto2 } from '../data/tipos';
import { dot, len, norm, puntoEnPoligono, sub } from './geometria';

/** Lo más alto que se puede subir de un paso (m). */
export const SUBIDA_MAXIMA = 0.45;

interface Superficie {
  /** Altura donde se pisa. */
  arriba: number;
  /** Altura de la cara de abajo (para no chocar la cabeza). */
  abajo: number;
}

/** Superficies pisables en un punto: escaleras (como rampa), descansos y entrepisos. */
function superficies(p: Punto2, casa: Casa): Superficie[] {
  const lista: Superficie[] = [];
  for (const esc of casa.escaleras) {
    for (const t of esc.tramos) {
      const d = sub(t.hasta, t.desde);
      const largo = len(d);
      const dir = norm(d);
      const rel = sub(p, t.desde);
      const u = dot(rel, dir);
      const v = dot(rel, [-dir[1], dir[0]]);
      if (u < -0.05 || u > largo + 0.05 || Math.abs(v) > t.ancho / 2 + 0.05) continue;
      const k = Math.max(0, Math.min(1, u / (largo || 1)));
      const h = t.alturaDesde + k * (t.alturaHasta - t.alturaDesde);
      lista.push({ arriba: h, abajo: h - 0.25 });
    }
    for (const de of esc.descansos ?? []) {
      if (puntoEnPoligono(p, de.poligono)) lista.push({ arriba: de.altura, abajo: de.altura - 0.05 });
    }
  }
  for (const en of casa.entrepisos) {
    if (puntoEnPoligono(p, en.poligono)) lista.push({ arriba: en.nivel, abajo: en.nivel - en.espesor });
  }
  return lista;
}

/**
 * Altura del piso en `p` para alguien que viene de `actual`: la superficie más alta a la
 * que se llega subiendo como mucho SUBIDA_MAXIMA (si no hay ninguna, el piso de planta baja).
 */
export function alturaPiso(p: Punto2, actual: number, casa: Casa): number {
  let mejor = 0;
  for (const s of superficies(p, casa)) {
    if (s.arriba <= actual + SUBIDA_MAXIMA && s.arriba > mejor) mejor = s.arriba;
  }
  return mejor;
}

/** Altura de los ojos sobre el piso: se agacha si arriba hay algo bajo (descanso, entrepiso). */
export function alturaOjos(p: Punto2, piso: number, casa: Casa, normal: number) {
  let ojos = normal;
  for (const s of superficies(p, casa)) {
    if (s.arriba > piso + SUBIDA_MAXIMA && s.abajo - piso - 0.12 < ojos) ojos = Math.max(0.8, s.abajo - piso - 0.12);
  }
  return ojos;
}
