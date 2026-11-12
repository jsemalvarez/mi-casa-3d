import { useRef, useState } from 'react';
import { entradaRecorrido } from '../estado';

const RADIO = 48; // px de recorrido de la perilla

/** Joystick táctil para caminar en el recorrido (también anda con mouse). */
export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [perilla, setPerilla] = useState({ x: 0, y: 0 });
  const activo = useRef<number | null>(null);

  const actualizar = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > RADIO) {
      dx = (dx / d) * RADIO;
      dy = (dy / d) * RADIO;
    }
    setPerilla({ x: dx, y: dy });
    entradaRecorrido.x = dx / RADIO;
    entradaRecorrido.y = -dy / RADIO;
  };
  const soltar = () => {
    activo.current = null;
    setPerilla({ x: 0, y: 0 });
    entradaRecorrido.x = 0;
    entradaRecorrido.y = 0;
  };

  return (
    <div
      ref={base}
      className="joystick"
      onPointerDown={(e) => {
        activo.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        actualizar(e);
      }}
      onPointerMove={(e) => activo.current === e.pointerId && actualizar(e)}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      aria-label="Joystick para caminar"
      role="application"
    >
      <div className="perilla" style={{ transform: `translate(${perilla.x}px, ${perilla.y}px)` }} />
    </div>
  );
}
