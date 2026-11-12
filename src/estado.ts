import { useMemo } from 'react';
import { create } from 'zustand';
import { casa as casaBase } from './data/casa';
import type { Casa } from './data/tipos';
import { instalacion } from './data/electrica';
import { resolverCasa, type CasaResuelta } from './modelo/geometria';
import { pendientesInstalacion, resolverInstalacion, type ElectricaResuelta } from './modelo/electrica';
import { juntarPendientes, type Pendiente } from './modelo/pendientes';

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
  /** Muestra la instalación eléctrica (canal, cajas y tablero). */
  electrica: boolean;
  /** De noche: sin sol, cielo oscuro; se ven solo las luces prendidas. */
  noche: boolean;
  /** Puertas cerradas, por id de abertura. Las que no están, abiertas (como en el plano). */
  puertasCerradas: Record<string, true>;
  /** Luces prendidas, por id de luz. */
  lucesPrendidas: Record<string, true>;
  /** Ambiente donde arranca el recorrido. */
  inicioRecorrido: string;
  /** Se incrementa para volver a encuadrar la cámara. */
  versionCamara: number;
  panel: 'pendientes' | 'materiales' | null;
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
  alternarElectrica: () => void;
  /** Pasa de día a noche y al revés. Si se hace de noche con todo apagado, prende todas las luces. */
  alternarNoche: () => void;
  alternarPuerta: (id: string) => void;
  /** Si hay alguna abierta, cierra todas; si no, abre todas. */
  alternarPuertas: () => void;
  /** Si alguna de esas luces está prendida, apaga todas; si no, las prende (como una tecla). */
  alternarLuces: (ids: string[]) => void;
  /** Todas las luces de la casa: si hay alguna prendida, apaga todo; si no, prende todo. */
  alternarTodasLasLuces: () => void;
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
  electrica: true,
  noche: false,
  puertasCerradas: {},
  lucesPrendidas: {},
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
  alternarElectrica: () => set((s) => ({ electrica: !s.electrica })),
  alternarNoche: () =>
    set((s) => {
      if (s.noche) return { noche: false };
      const algunaPrendida = Object.keys(s.lucesPrendidas).length > 0;
      return { noche: true, lucesPrendidas: algunaPrendida ? s.lucesPrendidas : todas(idsLuces()) };
    }),
  alternarPuerta: (id) =>
    set((s) => {
      const puertasCerradas = { ...s.puertasCerradas };
      if (puertasCerradas[id]) delete puertasCerradas[id];
      else puertasCerradas[id] = true;
      return { puertasCerradas };
    }),
  alternarPuertas: () =>
    set((s) => {
      const ids = idsPuertas(s.casa);
      const algunaAbierta = ids.some((id) => !s.puertasCerradas[id]);
      return { puertasCerradas: algunaAbierta ? todas(ids) : {} };
    }),
  alternarLuces: (ids) =>
    set((s) => {
      const lucesPrendidas = { ...s.lucesPrendidas };
      const prender = !ids.some((id) => lucesPrendidas[id]);
      for (const id of ids) {
        if (prender) lucesPrendidas[id] = true;
        else delete lucesPrendidas[id];
      }
      return { lucesPrendidas };
    }),
  alternarTodasLasLuces: () =>
    set((s) => ({ lucesPrendidas: Object.keys(s.lucesPrendidas).length ? {} : todas(idsLuces()) })),
  setInicioRecorrido: (inicioRecorrido) => set((s) => ({ inicioRecorrido, versionCamara: s.versionCamara + 1 })),
  recentrar: () => set((s) => ({ versionCamara: s.versionCamara + 1 })),
  setPanel: (panel) => set({ panel }),
}));

function todas(ids: string[]): Record<string, true> {
  return Object.fromEntries(ids.map((id) => [id, true as const]));
}

/** Puertas, portones y puertas balcón con hoja (los que se pueden abrir y cerrar). */
export function idsPuertas(casa: Casa) {
  return casa.aberturas.filter((a) => (a.tipo === 'puerta' || a.tipo === 'puerta-balcon') && a.hoja).map((a) => a.id);
}

export function idsLuces() {
  return instalacion.luces.map((l) => l.id);
}

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

const cacheElectrica = new WeakMap<CasaResuelta, ElectricaResuelta>();

/** Instalación eléctrica resuelta sobre la casa activa (memorizada). */
export function useElectrica(): ElectricaResuelta {
  const resuelta = useCasaResuelta();
  let e = cacheElectrica.get(resuelta);
  if (!e) {
    e = resolverInstalacion(instalacion, resuelta);
    cacheElectrica.set(resuelta, e);
    if (e.advertencias.length) console.warn('[instalación] advertencias:\n' + e.advertencias.join('\n'));
  }
  return e;
}

/** Todo lo provisorio (de la casa y de la instalación) y las advertencias de los datos. */
export function usePendientes() {
  const resuelta = useCasaResuelta();
  const e = useElectrica();
  return useMemo(() => {
    const extra: Pendiente[] = pendientesInstalacion(instalacion, e).map((p) => ({
      categoria: 'Instalación eléctrica',
      elemento: p.elemento,
      texto: p.texto,
      ir: p.vista ? { modo: 'alzado', vista: p.vista } : { modo: 'planta' },
    }));
    return {
      lista: juntarPendientes(resuelta.casa, resuelta, extra),
      advertencias: [...resuelta.advertencias, ...e.advertencias],
    };
  }, [resuelta, e]);
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
