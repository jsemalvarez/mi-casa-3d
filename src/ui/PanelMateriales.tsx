import { useMemo, useState } from 'react';
import { useElectrica, useEstado } from '../estado';
import { fmt } from '../modelo/geometria';
import type { ElectricaResuelta, ItemComputo } from '../modelo/electrica';
import { Icono } from './Iconos';

/** Cómputo de materiales de la instalación eléctrica (se recalcula con los datos). */
export function PanelMateriales() {
  const panel = useEstado((s) => s.panel);
  const setPanel = useEstado((s) => s.setPanel);
  const e = useElectrica();
  const [copiado, setCopiado] = useState(false);

  const grupos = useMemo(() => {
    const g = new Map<string, ItemComputo[]>();
    for (const it of e.computo) {
      if (!g.has(it.categoria)) g.set(it.categoria, []);
      g.get(it.categoria)!.push(it);
    }
    return [...g];
  }, [e]);

  const totales = useMemo(() => {
    const luces = e.puntos.filter((p) => p.clase === 'luz').length;
    let tomas = 0;
    let teclas = 0;
    for (const p of e.puntos) {
      for (const m of p.modulos) {
        if (m.tipo === 'toma' || m.tipo === 'toma-exterior') tomas++;
        else teclas++;
      }
    }
    return { luces, tomas, teclas };
  }, [e]);

  if (panel !== 'materiales') return null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(comoTexto(e));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <aside className="panel" aria-label="Materiales">
      <div className="panel-cabecera">
        <div>
          <h2>Materiales (estimado)</h2>
          <p>
            Sale de la propuesta de instalación: {fmt(e.metrosCanal, 0)} m de canal · {totales.luces} luces ·{' '}
            {totales.teclas} teclas · {totales.tomas} tomas. Si movés un punto en los datos, se recalcula.
          </p>
        </div>
        <button className="chip icono" onClick={() => setPanel(null)} aria-label="Cerrar">
          <Icono nombre="cerrar" />
        </button>
      </div>
      <div className="panel-cuerpo">
        <button className="chip copiar" onClick={copiar}>
          <Icono nombre="copiar" /> {copiado ? 'Copiado' : 'Copiar la lista'}
        </button>

        {e.advertencias.length > 0 && (
          <section>
            <h3 className="advertencia">Advertencias</h3>
            <ul>
              {e.advertencias.map((a, k) => (
                <li key={k} className="item advertencia">
                  {a}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3>Circuitos</h3>
          <ul>
            {e.circuitos.map((c) => (
              <li key={c.id} className="fila-material">
                <span className="muestra" style={{ background: c.color }} />
                <span className="material-nombre">
                  <strong>{c.nombre}</strong>
                  <span>
                    {c.tipo} · cable {fmt(c.seccion, 1)} mm² · térmica {c.termica} A · {c.detalleBocas}
                  </span>
                </span>
                <span className="material-cantidad">{c.metrosCable} m</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Por ambiente</h3>
          <table className="tabla-ambientes">
            <thead>
              <tr>
                <th />
                <th>Luces</th>
                <th>Teclas</th>
                <th>Tomas</th>
              </tr>
            </thead>
            <tbody>
              {e.ambientes.map((a) => (
                <tr key={a.nombre}>
                  <td>{a.nombre}</td>
                  <td>{a.luces || '—'}</td>
                  <td>{a.teclas || '—'}</td>
                  <td>{a.tomas || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {grupos.map(([cat, items]) => (
          <section key={cat}>
            <h3>{cat}</h3>
            <ul>
              {items.map((it, k) => (
                <li key={k} className={`fila-material${it.aDefinir ? ' a-definir' : ''}`}>
                  <span className="material-nombre">
                    <strong>{it.nombre}</strong>
                    {it.detalle && <span>{it.detalle}</span>}
                  </span>
                  <span className="material-cantidad">{it.aDefinir && !it.cantidad ? 'a definir' : `${it.cantidad} ${it.unidad}`}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="nota">
          Cantidades con 10 % de más. Es para presupuestar: el electricista matriculado tiene que revisar el proyecto.
        </p>
      </div>
    </aside>
  );
}

/** Lista en texto plano, para mandar a un corralón o a una casa de electricidad. */
function comoTexto(e: ElectricaResuelta) {
  const lineas: string[] = ['Materiales de la instalación eléctrica (a la vista, cable canal negro)', ''];
  let cat = '';
  for (const it of e.computo) {
    if (it.categoria !== cat) {
      cat = it.categoria;
      lineas.push('', cat.toUpperCase());
    }
    const cantidad = it.aDefinir && !it.cantidad ? 'a definir' : `${it.cantidad} ${it.unidad}`.trim();
    lineas.push(`- ${cantidad} · ${it.nombre}${it.detalle ? ` (${it.detalle})` : ''}`);
  }
  return lineas.join('\n');
}
