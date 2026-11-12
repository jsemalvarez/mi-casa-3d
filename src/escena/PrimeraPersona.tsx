import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { caja, centroide } from '../modelo/geometria';
import { construirObstaculos, resolverColision } from '../modelo/colisiones';
import { alturaOjos, alturaPiso } from '../modelo/niveles';
import { entradaRecorrido, useCasaResuelta, useEstado } from '../estado';
import type { Punto2 } from '../data/tipos';

const ALTURA_OJOS = 1.6;
const RADIO = 0.25;
const VELOCIDAD = 1.4; // m/s caminando
const SENSIBILIDAD = 0.0042; // rad por píxel arrastrado

/**
 * Recorrido en primera persona.
 * PC: arrastrar para mirar · W/A/S/D o flechas para moverse · Shift para correr.
 * Celular: arrastrar para mirar · joystick para moverse.
 */
export function PrimeraPersona() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const { casa, paredes } = useCasaResuelta();
  const inicio = useEstado((s) => s.inicioRecorrido);
  const obstaculos = useMemo(
    () => construirObstaculos(paredes, casa.entrepisos, casa.muebles),
    [paredes, casa.entrepisos, casa.muebles],
  );
  // piso = altura de lo que se pisa; y = altura de los ojos (suavizada).
  const st = useRef({ x: 0, y: ALTURA_OJOS, z: 0, piso: 0, yaw: 0, pitch: -0.05 });
  const teclas = useRef(new Set<string>());

  // Punto de partida: un ambiente o un entrepiso (la oficina).
  useEffect(() => {
    const entrepiso = casa.entrepisos.find((en) => en.id === inicio);
    const amb = casa.ambientes.find((a) => a.id === inicio) ?? casa.ambientes[0];
    let desde: Punto2;
    let mirar: Punto2;
    if (!entrepiso && amb.recorrido) {
      desde = amb.recorrido.desde;
      mirar = amb.recorrido.mirarHacia;
    } else {
      const poli = entrepiso ? entrepiso.poligono : amb.poligono;
      desde = centroide(poli);
      const b = caja(poli);
      mirar = b.x1 - b.x0 >= b.z1 - b.z0 ? [b.x1, desde[1]] : [desde[0], b.z1];
    }
    st.current.x = desde[0];
    st.current.z = desde[1];
    st.current.piso = entrepiso ? entrepiso.nivel : 0;
    st.current.y = st.current.piso + ALTURA_OJOS;
    st.current.yaw = Math.atan2(-(mirar[0] - desde[0]), -(mirar[1] - desde[1]));
    st.current.pitch = -0.05;
  }, [casa, inicio]);

  // Mirar arrastrando + teclado
  useEffect(() => {
    const el = gl.domElement;
    const punteros = new Map<number, { x: number; y: number }>();
    const abajo = (e: PointerEvent) => {
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture?.(e.pointerId);
    };
    const mover = (e: PointerEvent) => {
      const prev = punteros.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      st.current.yaw += dx * SENSIBILIDAD;
      st.current.pitch = Math.max(-1.35, Math.min(1.35, st.current.pitch + dy * SENSIBILIDAD));
    };
    const arriba = (e: PointerEvent) => punteros.delete(e.pointerId);
    const tecla = (e: KeyboardEvent, apretada: boolean) => {
      if ((e.target as HTMLElement)?.tagName === 'SELECT' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
        if (apretada) teclas.current.add(k);
        else teclas.current.delete(k);
        e.preventDefault();
      }
    };
    const kd = (e: KeyboardEvent) => tecla(e, true);
    const ku = (e: KeyboardEvent) => tecla(e, false);
    const blur = () => teclas.current.clear();
    el.addEventListener('pointerdown', abajo);
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerup', arriba);
    el.addEventListener('pointercancel', arriba);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    return () => {
      el.removeEventListener('pointerdown', abajo);
      el.removeEventListener('pointermove', mover);
      el.removeEventListener('pointerup', arriba);
      el.removeEventListener('pointercancel', arriba);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
      entradaRecorrido.x = 0;
      entradaRecorrido.y = 0;
    };
  }, [gl]);

  useFrame((_, dtReal) => {
    const dt = Math.min(dtReal, 0.05);
    const t = teclas.current;
    const s = st.current;
    if (t.has('arrowleft') || t.has('q')) s.yaw += 1.8 * dt;
    if (t.has('arrowright') || t.has('e')) s.yaw -= 1.8 * dt;
    let adelante = (t.has('w') || t.has('arrowup') ? 1 : 0) - (t.has('s') || t.has('arrowdown') ? 1 : 0);
    let costado = (t.has('d') ? 1 : 0) - (t.has('a') ? 1 : 0);
    adelante += entradaRecorrido.y;
    costado += entradaRecorrido.x;
    const mag = Math.hypot(adelante, costado);
    if (mag > 1) {
      adelante /= mag;
      costado /= mag;
    }
    if (mag > 0.001) {
      const v = VELOCIDAD * (t.has('shift') ? 2 : 1) * dt;
      const fx = -Math.sin(s.yaw);
      const fz = -Math.cos(s.yaw);
      const rx = Math.cos(s.yaw);
      const rz = -Math.sin(s.yaw);
      const destino: Punto2 = [s.x + (fx * adelante + rx * costado) * v, s.z + (fz * adelante + rz * costado) * v];
      const [nx, nz] = resolverColision(destino, RADIO, obstaculos, s.piso);
      s.x = nx;
      s.z = nz;
    }
    // Sube o baja según lo que pisa (escalera, descanso, oficina); se agacha si arriba hay algo bajo.
    s.piso = alturaPiso([s.x, s.z], s.piso, casa);
    const ojos = s.piso + alturaOjos([s.x, s.z], s.piso, casa, ALTURA_OJOS);
    s.y += (ojos - s.y) * Math.min(1, dt * 8);
    camera.position.set(s.x, s.y, s.z);
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ');
  });

  return null;
}
