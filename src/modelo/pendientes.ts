import type { Casa } from '../data/tipos';
import type { CasaResuelta } from './geometria';

export interface Pendiente {
  categoria: string;
  elemento: string;
  texto: string;
  /** A dónde llevar la cámara al tocarlo. */
  ir?: { modo: 'planta' } | { modo: 'alzado'; vista: string };
}

/** Junta todos los `todo` de los datos para mostrarlos en la web. */
export function juntarPendientes(casa: Casa, resuelta: CasaResuelta): Pendiente[] {
  const lista: Pendiente[] = [];
  for (const t of casa.pendientes) lista.push({ categoria: 'General', elemento: 'Casa', texto: t });
  if (casa.norte.todo) lista.push({ categoria: 'General', elemento: 'Orientación', texto: casa.norte.todo });
  for (const a of casa.ambientes) {
    if (a.todo) lista.push({ categoria: 'Ambientes', elemento: a.nombre, texto: a.todo, ir: { modo: 'planta' } });
  }
  for (const p of casa.paredes) {
    if (!p.todo) continue;
    const r = resuelta.paredes.find((x) => x.pared.id === p.id);
    lista.push({
      categoria: 'Paredes',
      elemento: p.nombre ?? p.id,
      texto: p.todo,
      ir: r ? { modo: 'alzado', vista: r.vistaDer || r.vistaIzq } : undefined,
    });
  }
  for (const ab of casa.aberturas) {
    if (!ab.todo) continue;
    const r = resuelta.paredes.find((x) => x.pared.id === ab.pared);
    // Preferimos mirar la abertura desde un ambiente interior.
    const interior = (id: string | null) => !!id && !casa.ambientes.find((a) => a.id === id)?.exterior;
    const vista = r ? (interior(r.izq) ? r.vistaIzq : interior(r.der) ? r.vistaDer : r.vistaIzq) : undefined;
    lista.push({
      categoria: 'Aberturas',
      elemento: ab.nombre ?? ab.id,
      texto: ab.todo,
      ir: vista ? { modo: 'alzado', vista } : undefined,
    });
  }
  for (const en of casa.entrepisos) {
    if (en.todo) lista.push({ categoria: 'Entrepisos', elemento: en.nombre, texto: en.todo, ir: { modo: 'planta' } });
  }
  for (const esc of casa.escaleras) {
    if (esc.todo) lista.push({ categoria: 'Escaleras', elemento: esc.nombre, texto: esc.todo, ir: { modo: 'planta' } });
  }
  for (const m of casa.muebles) {
    if (m.todo) lista.push({ categoria: 'Muebles', elemento: m.nombre, texto: m.todo, ir: { modo: 'planta' } });
  }
  return lista;
}
