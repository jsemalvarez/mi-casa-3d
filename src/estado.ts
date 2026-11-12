import { create } from 'zustand';
import { casa as casaBase } from './data/casa';
import type { Casa } from './data/tipos';
import { resolverCasa, type CasaResuelta } from './modelo/geometria';

export type Modo = '3d' | 'planta' | 'alzado' | 'recorrido';

interface Estado {
  /** Casa activa (en la fase 5 va a salir del escenario elegido). */
  casa: Casa;
  modo: Modo;
  /** Vista de frente elegida en el modo "alzado". */
  vistaId: string | null;
  /** En 3D: paredes cortadas a 1,20 m para ver adentro. */
  paredesBajas: boolean;
  /** En 3D y planta: cortar a 1,20 m sobre el piso más alto (la oficina) para verla. */
  verOficina: boolean;
  etiquetas: boolean;
  /** Ambiente donde arranca el recorrido. */
  inicioRecorrido: string;
  /** Se incrementa para volver a encuadrar la cámara. */
  versionCamara: number;
  panel: 'pendientes' | null;
  /**
   * Hacia dónde apunta en pantalla el norte del plano (−Z), en grados horarios desde "arriba":
   * 0 normalmente, −90 cuando la planta se gira en celulares en vertical.
   */
  giroPlanta: number;

  setModo: (m: Modo) => void;
  setGiroPlanta: (g: number) => void;
  setVista: (id: string) => void;
  irAVista: (id: string) => void;
  alternarParedesBajas: () => void;
  alternarOficina: () => void;
  alternarEtiquetas: () => void;
  setInicioRecorrido: (id: string) => void;
  recentrar: () => void;
  setPanel: (p: Estado['panel']) => void;
}

export const useEstado = create<Estado>((set) => ({
  casa: casaBase,
  modo: '3d',
  vistaId: null,
  paredesBajas: false,
  verOficina: false,
  etiquetas: true,
  inicioRecorrido: casaBase.ambientes[0]?.id ?? '',
  versionCamara: 0,
  panel: null,
  giroPlanta: 0,

  setModo: (modo) => set({ modo }),
  setGiroPlanta: (giroPlanta) => set({ giroPlanta }),
  setVista: (vistaId) => set({ vistaId }),
  irAVista: (vistaId) => set({ vistaId, modo: 'alzado' }),
  alternarParedesBajas: () => set((s) => ({ paredesBajas: !s.paredesBajas, verOficina: false })),
  alternarOficina: () => set((s) => ({ verOficina: !s.verOficina, paredesBajas: false })),
  alternarEtiquetas: () => set((s) => ({ etiquetas: !s.etiquetas })),
  setInicioRecorrido: (inicioRecorrido) => set((s) => ({ inicioRecorrido, versionCamara: s.versionCamara + 1 })),
  recentrar: () => set((s) => ({ versionCamara: s.versionCamara + 1 })),
  setPanel: (panel) => set({ panel }),
}));

const cache = new WeakMap<Casa, CasaResuelta>();

/** Casa activa con toda la geometría derivada (memorizada). */
export function useCasaResuelta(): CasaResuelta {
  const casa = useEstado((s) => s.casa);
  let r = cache.get(casa);
  if (!r) {
    r = resolverCasa(casa);
    cache.set(casa, r);
    if (r.advertencias.length) console.warn('[casa] advertencias:\n' + r.advertencias.join('\n'));
  }
  return r;
}

/** Entrada del joystick táctil del recorrido (−1..1). Se lee en cada cuadro. */
export const entradaRecorrido = { x: 0, y: 0 };

/** Las etiquetas de ambientes se muestran en 3D y en planta. */
export function etiquetasVisibles(modo: Modo, etiquetas: boolean) {
  return etiquetas && (modo === '3d' || modo === 'planta');
}

/** Corte de las plantas: a 1,20 m sobre el piso que se mira. */
const CORTE = 1.2;

/** Nivel del piso más alto (la oficina), o 0 si no hay. */
export function nivelAlto(casa: Casa) {
  return Math.max(0, ...casa.entrepisos.map((e) => e.nivel));
}

/** Altura de corte de las paredes según el modo (Infinity = completas). */
export function alturaCorte(modo: Modo, paredesBajas: boolean, verOficina: boolean, nivelOficina: number) {
  if (verOficina && (modo === 'planta' || modo === '3d')) return nivelOficina + CORTE;
  if (modo === 'planta') return CORTE;
  if (modo === '3d' && paredesBajas) return CORTE;
  return Infinity;
}
