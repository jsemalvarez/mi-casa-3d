import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { alturaCorte, etiquetasVisibles, nivelAlto, useCasaResuelta, useEstado } from '../estado';
import { Camaras } from './Camaras';
import { Electrica } from './Electrica';
import { Entrepisos } from './Entrepisos';
import { Escaleras } from './Escaleras';
import { Luces } from './Luces';
import { ProyectorEtiquetas } from './Etiquetas';
import { Muebles } from './Muebles';
import { Paredes } from './Paredes';
import { Pisos, Techos, Terreno } from './Superficies';

export function Escena() {
  return (
    <div className="lienzo">
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Contenido />
        <Camaras />
      </Canvas>
    </div>
  );
}

function Contenido() {
  const modo = useEstado((s) => s.modo);
  const paredesBajas = useEstado((s) => s.paredesBajas);
  const verOficina = useEstado((s) => s.verOficina);
  const etiquetas = useEstado((s) => s.etiquetas);
  const { casa } = useCasaResuelta();
  const corte = alturaCorte(modo, paredesBajas, verOficina, nivelAlto(casa));
  const plano = modo === 'planta';
  return (
    <>
      <Iluminacion />
      <Terreno />
      <Pisos />
      {/* En el recorrido el techo tapa el sol: la luz entra solo por las aberturas. */}
      <Techos corte={corte} hacenSombra={modo === 'recorrido'} />
      <Paredes corte={corte} plano={plano} />
      <Entrepisos corte={corte} />
      <Escaleras corte={corte} />
      <Muebles corte={corte} />
      <Electrica />
      <Luces />
      {etiquetasVisibles(modo, etiquetas) && <ProyectorEtiquetas />}
    </>
  );
}

/** Cielo y sol de día; de noche, cielo oscuro y una luz de luna muy tenue. */
const CIELO = {
  dia: { fondo: '#cdd7de', cielo: '#ffffff', suelo: '#d9d2c3', hemisferio: 1.6, ambiente: 0.5, sol: '#ffffff', intensidadSol: 1.8 },
  noche: { fondo: '#0b111b', cielo: '#4a5a7a', suelo: '#16181d', hemisferio: 0.2, ambiente: 0.03, sol: '#9fb3d9', intensidadSol: 0.22 },
};

/**
 * Luz general: cielo, sol (o luna) y, en las vistas de pared y el recorrido, una luz suave desde la
 * cámara. Las vistas de pared se ven siempre de día: son para leer medidas y colores.
 */
function Iluminacion() {
  const { limites } = useCasaResuelta();
  const modo = useEstado((s) => s.modo);
  const noche = useEstado((s) => s.noche) && modo !== 'alzado';
  const c = noche ? CIELO.noche : CIELO.dia;
  // En planta y en las vistas de frente las sombras del sol ensucian la lectura; de noche no hay sol.
  const sombras = !noche && (modo === '3d' || modo === 'recorrido');
  const cx = (limites.x0 + limites.x1) / 2;
  const cz = (limites.z0 + limites.z1) / 2;
  const r = Math.hypot(limites.x1 - limites.x0, limites.z1 - limites.z0) / 2 + 2;
  const [objetivo] = useState(() => new THREE.Object3D());
  const relleno = modo === 'alzado' ? 1.3 : modo === 'recorrido' && !noche ? 0.6 : 0;
  return (
    <>
      <color attach="background" args={[c.fondo]} />
      <hemisphereLight args={[c.cielo, c.suelo, c.hemisferio]} />
      <ambientLight intensity={c.ambiente} />
      {relleno > 0 && <LuzCamara intensidad={relleno} />}
      {/* El objetivo del sol tiene que estar en la escena para que se actualice su posición. */}
      <primitive object={objetivo} position={[cx, 0, cz]} />
      <directionalLight
        target={objetivo}
        position={[cx - 7, 16, cz - 9]}
        color={c.sol}
        intensity={c.intensidadSol}
        castShadow={sombras}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-r}
        shadow-camera-right={r}
        shadow-camera-top={r}
        shadow-camera-bottom={-r}
        shadow-camera-near={1}
        shadow-camera-far={60}
      />
    </>
  );
}

/** Luz de relleno que sale desde la cámara (sin sombras): muestra los colores de las paredes de frente. */
function LuzCamara({ intensidad }: { intensidad: number }) {
  const luz = useRef<THREE.DirectionalLight>(null);
  const [objetivo] = useState(() => new THREE.Object3D());
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    if (!luz.current) return;
    camera.getWorldDirection(dir);
    luz.current.position.copy(camera.position).addScaledVector(dir, -2);
    objetivo.position.copy(camera.position).addScaledVector(dir, 10);
    objetivo.updateMatrixWorld();
  });
  return (
    <>
      <primitive object={objetivo} />
      <directionalLight ref={luz} target={objetivo} intensity={intensidad} />
    </>
  );
}
