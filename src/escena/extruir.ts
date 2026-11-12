import * as THREE from 'three';

/**
 * Extruye una forma `profundidad` hacia +Z con un material por cara:
 * 0 = tapa en z = 0, 1 = tapa en z = profundidad, 2 = costados.
 * (ExtrudeGeometry pone las dos tapas en un mismo grupo: primero la de z = 0 y después la otra.)
 */
export function extruir(forma: THREE.Shape, profundidad: number) {
  const geo = new THREE.ExtrudeGeometry(forma, { depth: profundidad, bevelEnabled: false });
  const [tapas, costados] = geo.groups;
  const mitad = tapas.count / 2;
  geo.clearGroups();
  geo.addGroup(tapas.start, mitad, 0);
  geo.addGroup(tapas.start + mitad, mitad, 1);
  geo.addGroup(costados.start, costados.count, 2);
  return geo;
}
