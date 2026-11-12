import { MapControls, OrbitControls, OrthographicCamera, PerspectiveCamera } from './drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useCasaResuelta, useEstado } from '../estado';
import type { VistaPared } from '../modelo/geometria';
import { PrimeraPersona } from './PrimeraPersona';

/** Margen de pantalla que ocupan las barras de la interfaz (px). */
const MARGEN_UI = { arriba: 64, abajo: 132 };
const FOV_3D = 45;

/** Elige cámara y controles según el modo. Cambiar de modo/vista vuelve a montar todo. */
export function Camaras() {
  const modo = useEstado((s) => s.modo);
  const vistaId = useEstado((s) => s.vistaId);
  const version = useEstado((s) => s.versionCamara);
  const clave = `${modo}-${modo === 'alzado' ? vistaId : ''}-${version}`;
  switch (modo) {
    case '3d':
      return <Camara3D key={clave} />;
    case 'planta':
      return <CamaraPlanta key={clave} />;
    case 'alzado':
      return <CamaraAlzado key={clave} />;
    case 'recorrido':
      return (
        <group key={clave}>
          <PerspectiveCamera makeDefault fov={70} near={0.05} far={200} />
          <PrimeraPersona />
        </group>
      );
  }
}

function useCentro() {
  const { limites } = useCasaResuelta();
  return {
    cx: (limites.x0 + limites.x1) / 2,
    cz: (limites.z0 + limites.z1) / 2,
    ancho: limites.x1 - limites.x0,
    fondo: limites.z1 - limites.z0,
  };
}

/**
 * Aleja la cámara (en la dirección `dir`) hasta que todas las esquinas de la casa
 * entran en pantalla, dejando libres las barras de la interfaz.
 */
function distanciaParaEncuadrar(
  dir: THREE.Vector3,
  objetivo: THREE.Vector3,
  esquinas: THREE.Vector3[],
  ancho: number,
  alto: number,
) {
  const cam = new THREE.PerspectiveCamera(FOV_3D, ancho / alto, 0.1, 1000);
  const v = new THREE.Vector3();
  const limY = 1 - (2 * Math.max(MARGEN_UI.arriba, MARGEN_UI.abajo)) / alto;
  let d = 4;
  for (let k = 0; k < 80; k++) {
    cam.position.copy(objetivo).addScaledVector(dir, d);
    cam.lookAt(objetivo);
    cam.updateMatrixWorld();
    const entra = esquinas.every((e) => {
      v.copy(e).project(cam);
      return v.z < 1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < limY;
    });
    if (entra) break;
    d *= 1.06;
  }
  return d;
}

function Camara3D() {
  const { cx, cz, ancho, fondo } = useCentro();
  const { casa, limites, paredes } = useCasaResuelta();
  const size = useThree((s) => s.size);
  const [objetivo] = useState<[number, number, number]>(() => [cx, 0.6, cz]);
  const altoMaximo = Math.max(...paredes.map((p) => p.alto));
  const [pos] = useState<[number, number, number]>(() => {
    // Dirección de los datos (`casa.vista3d`). Si la casa es muy alargada y la pantalla
    // es vertical, se mira "a lo largo" para que entre mejor.
    const vertical = size.width / size.height < 0.9;
    const alargada = Math.max(ancho, fondo) / Math.max(0.1, Math.min(ancho, fondo)) > 1.4;
    let d3: [number, number, number] = casa.vista3d?.direccion ?? [0.28, 0.62, 0.73];
    if (vertical && alargada) d3 = ancho >= fondo ? [0.75, 0.62, 0.38] : [0.28, 0.62, 0.73];
    const dir = new THREE.Vector3(...d3).normalize();
    const esquinas: THREE.Vector3[] = [];
    for (const x of [limites.x0, limites.x1])
      for (const z of [limites.z0, limites.z1]) for (const y of [0, altoMaximo]) esquinas.push(new THREE.Vector3(x, y, z));
    const o = new THREE.Vector3(...objetivo);
    const d = distanciaParaEncuadrar(dir, o, esquinas, size.width, size.height);
    return [o.x + dir.x * d, o.y + dir.y * d, o.z + dir.z * d];
  });
  return (
    <>
      <PerspectiveCamera makeDefault fov={FOV_3D} near={0.1} far={400} position={pos} />
      <OrbitControls
        makeDefault
        target={objetivo}
        enableDamping
        dampingFactor={0.12}
        maxPolarAngle={Math.PI / 2 - 0.03}
        minDistance={1.5}
        maxDistance={80}
      />
    </>
  );
}

function CamaraPlanta() {
  const { cx, cz, ancho, fondo } = useCentro();
  const size = useThree((s) => s.size);
  const setGiroPlanta = useEstado((s) => s.setGiroPlanta);
  // En pantallas verticales, si la casa es más ancha que profunda, se gira 90° para aprovechar el alto.
  const [girada] = useState(() => size.width / size.height < 0.9 && ancho > fondo * 1.2);
  useEffect(() => setGiroPlanta(girada ? -90 : 0), [girada, setGiroPlanta]);
  const [zoom] = useState(() => {
    const alto = Math.max(100, size.height - MARGEN_UI.arriba - MARGEN_UI.abajo);
    const [w, h] = girada ? [fondo, ancho] : [ancho, fondo];
    return Math.min(size.width / (w + 1.2), alto / (h + 1.2));
  });
  // Corre el encuadre porque la barra de abajo es más alta que la de arriba.
  const corr = (MARGEN_UI.abajo - MARGEN_UI.arriba) / 2 / zoom;
  // "Abajo" en pantalla es +Z normalmente, o −X con la planta girada.
  const [tx, tz] = girada ? [cx - corr, cz] : [cx, cz + corr];
  // Un desplazamiento mínimo de la cámara define qué queda "arriba" en pantalla:
  // −Z (norte del plano) normalmente, +X (este del plano) con la planta girada.
  const pos: [number, number, number] = girada ? [tx - 0.001, 40, tz] : [tx, 40, tz + 0.001];
  return (
    <>
      <OrthographicCamera makeDefault position={pos} zoom={zoom} near={0.1} far={200} />
      <MapControls
        makeDefault
        target={[tx, 0, tz]}
        enableRotate={false}
        enableDamping
        dampingFactor={0.15}
        screenSpacePanning
        zoomToCursor
        minZoom={4}
        maxZoom={600}
      />
    </>
  );
}

/** Hasta cuánto delante de la pared se muestra en las vistas de frente (m). */
const PROFUNDIDAD_ALZADO = 1.3;

/**
 * En la vista de una pared de un ambiente, recorta todo lo que queda a los costados del
 * ambiente (así los márgenes no muestran pedazos de otros ambientes) y lo que está a más
 * de PROFUNDIDAD_ALZADO de la pared (así los muebles del otro lado no tapan la vista).
 */
function RecorteAlzado({ vista }: { vista: VistaPared }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const t = new THREE.Vector3(vista.tangente[0], 0, vista.tangente[1]);
    const n = new THREE.Vector3(vista.normal[0], 0, vista.normal[1]);
    const sPared = vista.objetivo[0] * vista.normal[0] + vista.objetivo[2] * vista.normal[1];
    const margen = 0.005;
    gl.clippingPlanes = [
      new THREE.Plane(t.clone(), -(vista.rango[0] - margen)), // deja t ≥ inicio
      new THREE.Plane(t.clone().negate(), vista.rango[1] + margen), // deja t ≤ fin
      new THREE.Plane(n.clone().negate(), sPared + PROFUNDIDAD_ALZADO), // deja lo cercano a la pared
      new THREE.Plane(new THREE.Vector3(0, -1, 0), vista.alto + margen), // nada por encima del techo
    ];
    return () => {
      gl.clippingPlanes = [];
    };
  }, [gl, vista]);
  return null;
}

function CamaraAlzado() {
  const { vistas } = useCasaResuelta();
  const vistaId = useEstado((s) => s.vistaId);
  const size = useThree((s) => s.size);
  const vista = vistas.find((v) => v.id === vistaId) ?? vistas[0];
  const [zoom] = useState(() => {
    if (!vista) return 50;
    const alto = Math.max(100, size.height - MARGEN_UI.arriba - MARGEN_UI.abajo - 40);
    return Math.min(size.width / (vista.ancho + 0.5), alto / (vista.alto + 0.4));
  });
  if (!vista) return null;
  const [ox, oy, oz] = vista.objetivo;
  const corrimiento = (MARGEN_UI.abajo - MARGEN_UI.arriba - 40) / 2 / zoom;
  const objetivo: [number, number, number] = [ox, oy - corrimiento, oz];
  const pos: [number, number, number] = [
    ox + vista.normal[0] * vista.distancia,
    oy - corrimiento,
    oz + vista.normal[1] * vista.distancia,
  ];
  return (
    <>
      {vista.ambiente && <RecorteAlzado vista={vista} />}
      <OrthographicCamera makeDefault position={pos} zoom={zoom} near={0.02} far={vista.distancia + 30} />
      <MapControls
        makeDefault
        target={objetivo}
        enableRotate={false}
        enableDamping
        dampingFactor={0.15}
        screenSpacePanning
        zoomToCursor
        minZoom={8}
        maxZoom={800}
      />
    </>
  );
}
