const TRAZOS = {
  cubo: 'M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Zm0 0v9m0 0 8-4.5M12 12 4 7.5M12 12v9',
  planta: 'M4 4h16v16H4zM4 12h7m4 0h5M11 4v5m0 6v5',
  pared: 'M3 5h18v14H3zM3 10h18M3 15h18M9 5v5m6 0v5m-6 0v4',
  caminar: 'M13 4.5a1.5 1.5 0 1 0 0-.01M10 21l2-6 3 3v3m-6-9 2-3 3 1 2 3h2m-7-4-1 5',
  cortar: 'M4 14h16M4 18h16M8 14V6m8 8V9',
  subir: 'M4 20h4v-4h4v-4h4V8h4M14 4h6v6',
  etiqueta: 'M4 6h10l6 6-6 6H4zM8 12h.01',
  centrar: 'M12 3v4m0 10v4M3 12h4m10 0h4M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  atras: 'm15 5-7 7 7 7',
  adelante: 'm9 5 7 7-7 7',
  alerta: 'M12 4 2.5 20h19L12 4Zm0 6v4m0 3h.01',
  cerrar: 'M6 6l12 12M18 6 6 18',
  ir: 'M5 12h14m-6-6 6 6-6 6',
  rayo: 'M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z',
  lista: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  copiar: 'M9 9h10v11H9zM5 15V4h10',
  luna: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  foco: 'M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z',
  puerta: 'M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M3.5 21h17M14.5 12.5h.01',
} as const;

export function Icono({ nombre }: { nombre: keyof typeof TRAZOS }) {
  return (
    <svg
      className="ico"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
