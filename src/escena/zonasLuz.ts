import * as THREE from 'three';
import type { Punto3 } from '../data/tipos';

/**
 * Zonas de luz.
 *
 * Las luces de three.js no tienen sombras baratas: sin ellas, una lámpara de la cocina ilumina
 * también las paredes del cuarto de al lado (la luz "atraviesa" la pared). Con 15 lámparas, ponerle
 * sombras a cada una es demasiado pesado. En cambio, a cada luz puntual y a cada foco se le asigna
 * una caja (su ambiente) y el shader descarta su luz fuera de esa caja. Además, dentro de la caja
 * suma un poco de luz pareja ("rebote" en paredes y techo), para que lo que no mira a la lámpara
 * no quede negro.
 *
 * Se arma parcheando los trozos de shader de three.js antes de que se compile ningún material.
 * Las luces sin `userData.zona` (o cualquier material que no tenga los uniformes) no se limitan.
 */

export interface ZonaLuz {
  min: Punto3;
  max: Punto3;
  /** Luz pareja que suma dentro de la zona, como fracción de la intensidad de la lámpara. */
  rebote: number;
}

const MAX = 64;
const arreglos = {
  zonaMinPuntual: new Float32Array(MAX * 4),
  zonaMaxPuntual: new Float32Array(MAX * 4),
  zonaMinFoco: new Float32Array(MAX * 4),
  zonaMaxFoco: new Float32Array(MAX * 4),
};

const DECLARACIONES = /* glsl */ `
#if NUM_POINT_LIGHTS > 0
uniform vec4 zonaMinPuntual[ NUM_POINT_LIGHTS ];
uniform vec4 zonaMaxPuntual[ NUM_POINT_LIGHTS ];
#endif
#if NUM_SPOT_LIGHTS > 0
uniform vec4 zonaMinFoco[ NUM_SPOT_LIGHTS ];
uniform vec4 zonaMaxFoco[ NUM_SPOT_LIGHTS ];
#endif
float dentroDeZona( vec3 p, vec4 a, vec4 b ) {
	if ( a.w < 0.5 ) return 1.0;
	return ( all( greaterThanEqual( p, a.xyz ) ) && all( lessThanEqual( p, b.xyz ) ) ) ? 1.0 : 0.0;
}
`;

/** Reemplazos sobre `lights_fragment_begin` (three r187). Si alguno no aparece, no se parchea nada. */
const REEMPLAZOS: [string, string][] = [
  [
    'IncidentLight directLight;',
    `IncidentLight directLight;
vec3 posMundoZona = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
vec3 reboteZona = vec3( 0.0 );
float enZonaLuz = 1.0;`,
  ],
  [
    'getPointLightInfo( pointLight, geometryPosition, directLight );',
    `getPointLightInfo( pointLight, geometryPosition, directLight );
		enZonaLuz = dentroDeZona( posMundoZona, zonaMinPuntual[ i ], zonaMaxPuntual[ i ] );
		directLight.color *= enZonaLuz;
		reboteZona += pointLight.color * ( enZonaLuz * zonaMaxPuntual[ i ].w );`,
  ],
  [
    'getSpotLightInfo( spotLight, geometryPosition, directLight );',
    `getSpotLightInfo( spotLight, geometryPosition, directLight );
		enZonaLuz = dentroDeZona( posMundoZona, zonaMinFoco[ i ], zonaMaxFoco[ i ] );
		directLight.color *= enZonaLuz;
		reboteZona += spotLight.color * ( enZonaLuz * zonaMaxFoco[ i ].w );`,
  ],
  [
    'vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );',
    `vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	irradiance += reboteZona;`,
  ],
];

let parcheado = false;

function parchear() {
  if (parcheado) return;
  parcheado = true;
  let codigo = THREE.ShaderChunk.lights_fragment_begin;
  for (const [buscar, poner] of REEMPLAZOS) {
    if (!codigo.includes(buscar)) {
      console.warn(`[luces] No se encontró "${buscar}" en el shader de three.js: las luces no se limitan a su ambiente.`);
      return;
    }
    codigo = codigo.replace(buscar, poner);
  }
  THREE.ShaderChunk.lights_fragment_begin = codigo;
  THREE.ShaderChunk.lights_pars_begin += DECLARACIONES;
  // Cada material copia los uniformes de su ShaderLib, pero los Float32Array quedan compartidos
  // (UniformsUtils.clone no los copia): basta con actualizarlos acá.
  for (const lib of Object.values(THREE.ShaderLib)) {
    if (!lib.fragmentShader.includes('<lights_fragment_begin>')) continue;
    for (const [nombre, valor] of Object.entries(arreglos)) lib.uniforms[nombre] = { value: valor };
  }
}

parchear();

/**
 * Carga las zonas en el orden en que three.js arma la lista de luces: recorrido de la escena en
 * profundidad, solo lo visible. Hay que llamarla en cada cuadro, antes de dibujar. Ninguna luz
 * puntual ni foco puede hacer sombra (three pone primero las que hacen sombra y cambiaría el orden).
 */
export function cargarZonas(escena: THREE.Object3D) {
  let p = 0;
  let f = 0;
  const poner = (min: Float32Array, max: Float32Array, k: number, z: ZonaLuz | undefined) => {
    if (k >= MAX) return;
    const o = k * 4;
    if (z) {
      min.set([z.min[0], z.min[1], z.min[2], 1], o);
      max.set([z.max[0], z.max[1], z.max[2], z.rebote], o);
    } else {
      min.fill(0, o, o + 4);
      max.fill(0, o, o + 4);
    }
  };
  escena.traverseVisible((o) => {
    const luz = o as THREE.Light;
    if (!luz.isLight) return;
    const zona = luz.userData.zona as ZonaLuz | undefined;
    if ((luz as THREE.PointLight).isPointLight) poner(arreglos.zonaMinPuntual, arreglos.zonaMaxPuntual, p++, zona);
    else if ((luz as THREE.SpotLight).isSpotLight) poner(arreglos.zonaMinFoco, arreglos.zonaMaxFoco, f++, zona);
  });
}
