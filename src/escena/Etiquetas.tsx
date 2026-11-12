import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Ambiente, Punto2 } from '../data/tipos';
import { area, caja, centroide, fmt, puntoEnPoligono } from '../modelo/geometria';
import { etiquetasVisibles, useCasaResuelta, useEstado } from '../estado';

/*
 * Etiquetas de ambientes: los textos son DOM común (afuera del <Canvas>) y un
 * componente dentro de la escena los ubica en pantalla en cada cuadro.
 */
const registro = new Map<string, { el: HTMLDivElement; pos: THREE.Vector3 }>();

/** Va dentro del <Canvas>: proyecta cada etiqueta registrada a coordenadas de pantalla. */
export function ProyectorEtiquetas() {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const { el, pos } of registro.values()) {
      v.copy(pos).project(camera);
      const visible = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      el.style.visibility = visible ? 'visible' : 'hidden';
      if (visible) {
        const x = ((v.x + 1) / 2) * size.width;
        const y = ((1 - v.y) / 2) * size.height;
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      }
    }
  });
  return null;
}

/**
 * Va afuera del <Canvas>, encima. En planta se muestran las etiquetas del piso que se mira:
 * con "Oficina" activo, la de la oficina en lugar de la del ambiente que queda debajo.
 */
export function CapaEtiquetas() {
  const { casa } = useCasaResuelta();
  const modo = useEstado((s) => s.modo);
  const etiquetas = useEstado((s) => s.etiquetas);
  const verOficina = useEstado((s) => s.verOficina);
  if (!etiquetasVisibles(modo, etiquetas)) return null;
  const tapadoPorEntrepiso = (a: Ambiente) =>
    casa.entrepisos.some((en) => puntoEnPoligono(centroide(a.poligono), en.poligono));
  const verAmbiente = (a: Ambiente) => modo === '3d' || !verOficina || !tapadoPorEntrepiso(a);
  const verEntrepisos = modo === '3d' || verOficina;
  return (
    <div className="capa-etiquetas" aria-hidden="true">
      {casa.ambientes.filter(verAmbiente).map((a) => (
        <Etiqueta key={a.id} id={a.id} nombre={a.nombre} poligono={a.poligono} y={0.05} provisoria={!!a.todo} exterior={a.exterior} />
      ))}
      {verEntrepisos &&
        casa.entrepisos.map((en) => (
          <Etiqueta key={en.id} id={en.id} nombre={en.nombre} poligono={en.poligono} y={en.nivel + 0.05} provisoria={!!en.todo} />
        ))}
    </div>
  );
}

function Etiqueta({
  id,
  nombre,
  poligono,
  y,
  provisoria,
  exterior,
}: {
  id: string;
  nombre: string;
  poligono: Punto2[];
  y: number;
  provisoria: boolean;
  exterior?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const [x, z] = centroide(poligono);
    registro.set(id, { el: ref.current!, pos: new THREE.Vector3(x, y, z) });
    return () => {
      registro.delete(id);
    };
  }, [id, poligono, y]);
  const b = caja(poligono);
  const esRect = poligono.length === 4 && Math.abs(area(poligono) - (b.x1 - b.x0) * (b.z1 - b.z0)) < 1e-3;
  const medidas = esRect ? `${fmt(b.x1 - b.x0)} × ${fmt(b.z1 - b.z0)}` : `${fmt(area(poligono), 1)} m²`;
  return (
    <div
      ref={ref}
      className={`etiqueta${provisoria ? ' provisoria' : ''}${exterior ? ' exterior' : ''}`}
      style={{ visibility: 'hidden' }}
    >
      <strong>{nombre}</strong>
      <span>{medidas}</span>
    </div>
  );
}
