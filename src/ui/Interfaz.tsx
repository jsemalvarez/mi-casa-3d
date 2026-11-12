import { useMemo } from 'react';
import { useCasaResuelta, useEstado, type Modo } from '../estado';
import { juntarPendientes } from '../modelo/pendientes';
import { Icono } from './Iconos';
import { Joystick } from './Joystick';
import { PanelPendientes } from './PanelPendientes';

export function Interfaz() {
  const modo = useEstado((s) => s.modo);
  return (
    <>
      <header className="barra-superior">
        <div className="marca">
          <img src="/casa.svg" alt="" width={30} height={30} />
          <div>
            <h1>Mi casa 3D</h1>
            <small>Base · distribución provisoria</small>
          </div>
        </div>
        <BotonPendientes />
      </header>

      {modo === 'alzado' && <TituloVista />}
      {modo === 'planta' && <Brujula />}
      {modo === 'recorrido' && (
        <>
          <AyudaRecorrido />
          <Joystick />
        </>
      )}

      <footer className="barra-inferior">
        <BarraContexto />
        <BarraModos />
      </footer>

      <PanelPendientes />
    </>
  );
}

const MODOS: { id: Modo; texto: string; icono: Parameters<typeof Icono>[0]['nombre'] }[] = [
  { id: '3d', texto: '3D', icono: 'cubo' },
  { id: 'planta', texto: 'Planta', icono: 'planta' },
  { id: 'alzado', texto: 'Paredes', icono: 'pared' },
  { id: 'recorrido', texto: 'Recorrido', icono: 'caminar' },
];

function BarraModos() {
  const modo = useEstado((s) => s.modo);
  const setModo = useEstado((s) => s.setModo);
  const vistaId = useEstado((s) => s.vistaId);
  const setVista = useEstado((s) => s.setVista);
  const { vistas } = useCasaResuelta();
  return (
    <nav className="modos" aria-label="Tipo de vista">
      {MODOS.map((m) => (
        <button
          key={m.id}
          className={modo === m.id ? 'activo' : ''}
          aria-pressed={modo === m.id}
          onClick={() => {
            if (m.id === 'alzado' && !vistaId && vistas[0]) setVista(vistas[0].id);
            setModo(m.id);
          }}
        >
          <Icono nombre={m.icono} />
          <span>{m.texto}</span>
        </button>
      ))}
    </nav>
  );
}

function BarraContexto() {
  const modo = useEstado((s) => s.modo);
  const s = useEstado();
  const { casa, vistas } = useCasaResuelta();

  if (modo === '3d' || modo === 'planta') {
    return (
      <div className="contexto">
        {modo === '3d' && (
          <button className={`chip${s.paredesBajas ? ' activo' : ''}`} onClick={s.alternarParedesBajas}>
            <Icono nombre="cortar" /> Paredes bajas
          </button>
        )}
        {casa.entrepisos.length > 0 && (
          <button
            className={`chip${s.verOficina ? ' activo' : ''}`}
            onClick={s.alternarOficina}
            title="Corta las paredes por encima del piso de la oficina para verla"
          >
            <Icono nombre="subir" /> Oficina
          </button>
        )}
        <button className={`chip${s.etiquetas ? ' activo' : ''}`} onClick={s.alternarEtiquetas}>
          <Icono nombre="etiqueta" /> Nombres
        </button>
        <button className="chip" onClick={s.recentrar}>
          <Icono nombre="centrar" /> Centrar
        </button>
      </div>
    );
  }

  if (modo === 'alzado') {
    const idx = Math.max(0, vistas.findIndex((v) => v.id === s.vistaId));
    const ir = (d: number) => s.setVista(vistas[(idx + d + vistas.length) % vistas.length].id);
    const grupos = new Map<string, typeof vistas>();
    for (const v of vistas) {
      const g = v.ambiente ? (casa.ambientes.find((a) => a.id === v.ambiente)?.nombre ?? v.ambiente) : 'Fachadas';
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g)!.push(v);
    }
    return (
      <div className="contexto">
        <button className="chip icono" onClick={() => ir(-1)} aria-label="Pared anterior">
          <Icono nombre="atras" />
        </button>
        <select className="selector" value={vistas[idx]?.id} onChange={(e) => s.setVista(e.target.value)}>
          {[...grupos].map(([g, vs]) => (
            <optgroup key={g} label={g}>
              {vs.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.titulo}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button className="chip icono" onClick={() => ir(1)} aria-label="Pared siguiente">
          <Icono nombre="adelante" />
        </button>
      </div>
    );
  }

  // recorrido
  return (
    <div className="contexto">
      <label className="selector-etiqueta">
        Empezar en
        <select className="selector" value={s.inicioRecorrido} onChange={(e) => s.setInicioRecorrido(e.target.value)}>
          {casa.ambientes
            .filter((a) => !a.exterior)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          {casa.entrepisos.map((en) => (
            <option key={en.id} value={en.id}>
              {en.nombre}
            </option>
          ))}
        </select>
      </label>
      <button className="chip" onClick={s.recentrar}>
        <Icono nombre="centrar" /> Volver
      </button>
    </div>
  );
}

function TituloVista() {
  const vistaId = useEstado((s) => s.vistaId);
  const { vistas } = useCasaResuelta();
  const v = vistas.find((x) => x.id === vistaId) ?? vistas[0];
  if (!v) return null;
  return (
    <div className="titulo-vista">
      <strong>{v.titulo}</strong>
      <span>{v.detalle}</span>
    </div>
  );
}

/** Flecha al norte real (según `casa.norte`), girada igual que la planta en pantalla. */
function Brujula() {
  const { casa } = useCasaResuelta();
  const giro = useEstado((s) => s.giroPlanta);
  const angulo = giro + casa.norte.grados;
  return (
    <div className="brujula" title={casa.norte.todo ?? 'Norte'}>
      <svg viewBox="0 0 40 40" width="40" height="40" style={{ transform: `rotate(${angulo}deg)` }} aria-hidden="true">
        <circle cx="20" cy="20" r="18" fill="rgba(24,28,33,.82)" />
        <path d="M20 6 26 24 20 20 14 24Z" fill="#f2b84b" />
        <text x="20" y="34" textAnchor="middle" fontSize="9" fontWeight="700" fill="#eef0f2">
          N
        </text>
      </svg>
      {casa.norte.todo && <span>a confirmar</span>}
    </div>
  );
}

function AyudaRecorrido() {
  const tactil = useMemo(() => window.matchMedia?.('(pointer: coarse)').matches ?? false, []);
  return (
    <div className="ayuda">
      {tactil
        ? 'Arrastrá para mirar · joystick para caminar'
        : 'Arrastrá para mirar · W A S D o flechas para caminar · Shift corre'}
    </div>
  );
}

function BotonPendientes() {
  const { casa } = useCasaResuelta();
  const resuelta = useCasaResuelta();
  const setPanel = useEstado((s) => s.setPanel);
  const panel = useEstado((s) => s.panel);
  const n = useMemo(() => juntarPendientes(casa, resuelta).length + resuelta.advertencias.length, [casa, resuelta]);
  return (
    <button
      className={`chip pendientes${panel === 'pendientes' ? ' activo' : ''}`}
      onClick={() => setPanel(panel === 'pendientes' ? null : 'pendientes')}
    >
      <Icono nombre="alerta" /> Pendientes <span className="contador">{n}</span>
    </button>
  );
}
