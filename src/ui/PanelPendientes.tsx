import { useMemo } from 'react';
import { useCasaResuelta, useEstado } from '../estado';
import { juntarPendientes, type Pendiente } from '../modelo/pendientes';
import { Icono } from './Iconos';

/** Lista de todo lo provisorio (los `todo` de los datos) y advertencias de validación. */
export function PanelPendientes() {
  const panel = useEstado((s) => s.panel);
  const setPanel = useEstado((s) => s.setPanel);
  const setModo = useEstado((s) => s.setModo);
  const irAVista = useEstado((s) => s.irAVista);
  const resuelta = useCasaResuelta();
  const lista = useMemo(() => juntarPendientes(resuelta.casa, resuelta), [resuelta]);

  const grupos = useMemo(() => {
    const g = new Map<string, Pendiente[]>();
    for (const p of lista) {
      if (!g.has(p.categoria)) g.set(p.categoria, []);
      g.get(p.categoria)!.push(p);
    }
    return [...g];
  }, [lista]);

  if (panel !== 'pendientes') return null;

  const ir = (p: Pendiente) => {
    if (!p.ir) return;
    if (p.ir.modo === 'alzado') irAVista(p.ir.vista);
    else setModo(p.ir.modo);
    if (window.innerWidth < 700) setPanel(null);
  };

  return (
    <aside className="panel" aria-label="Pendientes">
      <div className="panel-cabecera">
        <div>
          <h2>Pendientes</h2>
          <p>Todo lo que es supuesto o falta confirmar. Se edita en los datos (`todo`).</p>
        </div>
        <button className="chip icono" onClick={() => setPanel(null)} aria-label="Cerrar">
          <Icono nombre="cerrar" />
        </button>
      </div>
      <div className="panel-cuerpo">
        {resuelta.advertencias.length > 0 && (
          <section>
            <h3 className="advertencia">Advertencias de los datos</h3>
            <ul>
              {resuelta.advertencias.map((a, k) => (
                <li key={k} className="item advertencia">
                  {a}
                </li>
              ))}
            </ul>
          </section>
        )}
        {grupos.map(([cat, items]) => (
          <section key={cat}>
            <h3>
              {cat} <span className="contador">{items.length}</span>
            </h3>
            <ul>
              {items.map((p, k) => (
                <li key={k}>
                  <button className="item" onClick={() => ir(p)} disabled={!p.ir}>
                    <strong>{p.elemento}</strong>
                    <span>{p.texto}</span>
                    {p.ir && <Icono nombre="ir" />}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
