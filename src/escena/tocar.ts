import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

const rayo = new THREE.Raycaster();

/** Lo que no tapa la vista: líneas, vidrios, mallas invisibles o que solo reciben sombra. */
function noTapa(o: THREE.Object3D) {
  const m = o as THREE.Mesh;
  if (!m.isMesh) return true;
  const mats = Array.isArray(m.material) ? m.material : [m.material];
  return mats.every((x) => !x.visible || !x.colorWrite || (x.transparent && x.opacity < 0.6));
}

function seVe(o: THREE.Object3D | null) {
  for (let x = o; x; x = x.parent) if (!x.visible) return false;
  return true;
}

function dentroDe(o: THREE.Object3D | null, padre: THREE.Object3D) {
  for (let x = o; x; x = x.parent) if (x === padre) return true;
  return false;
}

/**
 * true si lo primero que se ve en la dirección del puntero es el objeto del evento. Los eventos de
 * R3F solo prueban contra los objetos que tienen eventos: sin esto, se podría abrir una puerta
 * tocando la pared que la tapa.
 */
export function aLaVista(e: ThreeEvent<PointerEvent | MouseEvent>) {
  let raiz: THREE.Object3D = e.eventObject;
  while (raiz.parent) raiz = raiz.parent;
  rayo.set(e.ray.origin, e.ray.direction);
  rayo.camera = e.camera;
  rayo.far = e.distance + 0.05;
  for (const h of rayo.intersectObject(raiz, true)) {
    if (noTapa(h.object) || !seVe(h.object)) continue;
    return dentroDe(h.object, e.eventObject) || h.distance >= e.distance - 0.005;
  }
  return true;
}

/** Un toque (no un arrastre para mirar o girar) sobre algo que está a la vista. */
export function tocado(e: ThreeEvent<MouseEvent>) {
  return e.delta <= 6 && aLaVista(e);
}

/** Manito al pasar el puntero por algo que se puede tocar. */
export const manito = {
  onPointerOver: (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = aLaVista(e) ? 'pointer' : '';
  },
  onPointerOut: () => {
    document.body.style.cursor = '';
  },
};
