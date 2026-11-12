import * as THREE from 'three';

const cache = new Map<string, THREE.Material>();

/** Material mate compartido por color (las paredes y pisos reusan materiales). */
export function mate(color: string, opciones: { lado?: THREE.Side; opacidad?: number } = {}) {
  const clave = `${color}|${opciones.lado ?? THREE.FrontSide}|${opciones.opacidad ?? 1}`;
  let m = cache.get(clave);
  if (!m) {
    const transparente = (opciones.opacidad ?? 1) < 1;
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.92,
      metalness: 0,
      side: opciones.lado ?? THREE.FrontSide,
      transparent: transparente,
      opacity: opciones.opacidad ?? 1,
      depthWrite: !transparente,
    });
    cache.set(clave, m);
  }
  return m;
}

export function vidrio(color: string) {
  const clave = `vidrio|${color}`;
  let m = cache.get(clave);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    cache.set(clave, m);
  }
  return m;
}
