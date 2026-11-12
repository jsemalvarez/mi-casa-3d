import type { Abertura, Ambiente, Casa, Entrepiso, Escalera, Mueble, Pared, Punto2, TechoInclinado } from './tipos';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  CASA — versión base ("actual")
 *
 *  Según el croquis a mano del 11/11/2026. Las medidas de los ambientes son las
 *  tuyas; las posiciones de puertas y ventanas están estimadas del dibujo (que no
 *  está a escala) y llevan `todo`. Todo `todo` aparece en el panel "Pendientes".
 *
 *  Planta (arriba = −Z, "norte del plano"; izquierda = frente con la entrada):
 *
 *            ┌───────────────────────────┬──────────────────────┐
 *            │ Cuarto 1 (chicos)         │ Cuarto 2 (matrimonial)│
 *            V        3,40 × 2,40        P     3,00 × 2,40      │
 *    ┌───────┴──────────────────P──┬─────┴───────V──────────────┤
 *    │                             │                            │
 *    V                             │                            │
 *    │   Cocina-comedor            PB        Patio interno      │
 *  → P   3,50 × 4,80  (entrada)    PB                           │
 *    │                             │               ┌─────V──────┤
 *    V                             ├──P────────────┤   Baño     │
 *    │                             P  Lavadero     P 2,00 × 1,90│
 *    │                             │ 1,70 × 1,40   │            │
 *    └─────────────────────────────┴───────────────┴────────────┘
 *    V = ventana · P = puerta · PB = puerta balcón
 *
 *  Las coordenadas salen de las medidas interiores y los espesores: cambiar una
 *  medida corre todo lo que depende de ella.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Alturas y espesores ──────────────────────────────────────────────────────
const H = 2.7; // altura de techo
// El cuarto 1 sube hasta el techo de la oficina (entretecho) que está arriba.
const PISO_OFICINA = 0.1; // espesor del piso de madera de la oficina — TODO confirmar
const ALTO_OFICINA = 2.0; // altura de la oficina (confirmado)
const NIVEL_OFICINA = H + PISO_OFICINA; // cara de arriba del piso de la oficina
const ALTO_CUARTO1 = NIVEL_OFICINA + ALTO_OFICINA; // 4,80
const E = 0.2; // espesor de frente y medianeras — TODO confirmar (¿0,20? ¿0,30?)
const I = 0.15; // espesor de paredes interiores y hacia el patio — TODO confirmar
const e = E / 2;
const i = I / 2;

// ── Medidas interiores [ancho en X, largo en Z] (las del croquis) ────────────
const COCINA = [3.5, 4.8] as const;
const LAVADERO = [1.7, 1.4] as const;
const BANIO = [2.0, 1.9] as const;
const CUARTO1 = [3.4, 2.4] as const;
const CUARTO2 = [3.0, 2.4] as const;

// ── Ejes de las paredes ──────────────────────────────────────────────────────
// Confirmado (11/11/2026): la medianera derecha es recta (cuarto 2 y baño alineados)
// y la diferencia entre las medidas de arriba (6,55 m) y las de abajo (7,50 m) queda
// en el frente: la cocina sobresale 0,95 m respecto del cuarto 1. Por eso la pared
// cocina | patio queda 0,85 m corrida de la pared entre los cuartos.

/** Cara interior de la medianera derecha. */
const X_DER = COCINA[0] + I + LAVADERO[0] + I + BANIO[0];

/** Ejes "verticales" en planta (x constante), del frente (izquierda) a la medianera. */
const X = {
  frenteCocina: -e,
  frenteCuarto1: X_DER - CUARTO2[0] - I - CUARTO1[0] - e,
  cocinaPatio: COCINA[0] + i, // cocina | patio interno / lavadero
  cuarto1Cuarto2: X_DER - CUARTO2[0] - i,
  lavaderoBanio: COCINA[0] + I + LAVADERO[0] + i,
  medianera: X_DER + e,
};

/** Ejes "horizontales" en planta (z constante), del fondo (arriba) al lateral (abajo). */
const Z = {
  fondo: -I - CUARTO1[1] - e, // pared de atrás de los cuartos
  cuartos: -i, // cuartos | cocina / patio interno
  banio: COCINA[1] - BANIO[1] - i, // baño | patio interno
  lavadero: COCINA[1] - LAVADERO[1] - i, // lavadero | patio interno
  lateral: COCINA[1] + e, // pared de abajo (cocina, lavadero, baño)
};

/** Cuánto sobresale la cocina hacia el frente respecto del cuarto 1 (cara contra cara). */
export const ESCALON_FRENTE = X.frenteCuarto1 - X.frenteCocina; // 0,95 m con los datos actuales

// ── Frente y pasillo de entrada ──────────────────────────────────────────────
// Croquis del 12/11/2026: se llega por un pasillo de 2,40 m de ancho y 20 m de largo, con muros
// de 2,00 m (confirmado) y un portón en la calle. Arranca a la altura de la pared de abajo de la
// cocina y su borde del lado de la casa queda 1,00 m hacia afuera del frente de la cocina. Entre
// el pasillo y la casa queda el frente (donde está la puerta de entrada), cerrado por el muro del
// fondo, que sigue la línea de atrás de los cuartos.
const CERCO = 0.15; // espesor de los muros del pasillo — TODO confirmar
const ALTO_CERCO = 2.0; // (confirmado)
/** Caras de afuera de la casa: frente de la cocina, frente del cuarto 1, pared de abajo y fondo. */
const FACHADA_X = X.frenteCocina - e;
const FACHADA_CUARTO1_X = X.frenteCuarto1 - e;
const LATERAL_Z = Z.lateral + e;
const FONDO_Z = Z.fondo - e;
export const PASILLO = {
  /** Cara interior del muro del lado de la casa y del otro lado (x). */
  xCasa: FACHADA_X - 1.0,
  xOtro: FACHADA_X - 1.0 - 2.4,
  /** Dónde arranca (z de la cara de afuera de la pared de abajo de la cocina) y la línea de la calle. */
  zInicio: LATERAL_Z,
  zCalle: LATERAL_Z + 20,
  espesor: CERCO,
  alto: ALTO_CERCO,
  /** Cara de afuera del frente de la cocina. */
  fachadaX: FACHADA_X,
};
/** Ejes de los muros del frente y el pasillo. */
const MURO = {
  xOtro: PASILLO.xOtro - CERCO / 2,
  xCasa: PASILLO.xCasa + CERCO / 2,
  zFondo: FONDO_Z - CERCO / 2,
  zLateral: LATERAL_Z + CERCO / 2,
  zCalle: PASILLO.zCalle - CERCO / 2,
};

// ── Ayudas ───────────────────────────────────────────────────────────────────
const rect = (x0: number, z0: number, x1: number, z1: number): Punto2[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
/** Metros con coma, para los textos de los pendientes. */
const m = (n: number) => n.toFixed(2).replace('.', ',');

// Caras interiores de los ambientes que se usan en varios lugares.
const [C1_X0, C1_Z0] = [X.frenteCuarto1 + e, Z.fondo + e]; // esquina frente-fondo del cuarto 1
const [C1_X1, C1_Z1] = [X.cuarto1Cuarto2 - i, Z.cuartos - i]; // esquina hacia cuarto 2 y cocina
/** Caras interiores del cuarto 2, del lavadero y del baño. */
const C2 = { x0: X.cuarto1Cuarto2 + i, x1: X.medianera - e, z0: Z.fondo + e, z1: Z.cuartos - i };
const LAV = { x0: X.cocinaPatio + i, x1: X.lavaderoBanio - i, z0: Z.lavadero + i, z1: Z.lateral - e };
const BAN = { x0: X.lavaderoBanio + i, x1: X.medianera - e, z0: Z.banio + i, z1: Z.lateral - e };

const PISO_CERAMICO = { color: '#d9d3c7', descripcion: 'cerámico claro (TODO)' };
const PISO_HUMEDO = { color: '#cdd3d5', descripcion: 'cerámico gris (TODO)' };
const PISO_MADERA = { color: '#c4a17a', descripcion: 'madera / flotante (TODO)' };

// ── Techos de madera ─────────────────────────────────────────────────────────
// Tablas y vigas pintadas de blanco; la viga de la cumbrera de la cocina, marrón (fotos, 12/11/2026).
const TECHO_BLANCO = '#fbfaf7';
const VIGA_BLANCA = '#e9e7e1';
const VIGA_MARRON = '#6b3a24';
/** Sección supuesta de las vigas chicas: tirante de 3" × 6". */
const SECCION_VIGA = { ancho: 0.075, alto: 0.15 };

/**
 * Techo de la cocina a dos aguas (12/11/2026): un faldón cae hacia la calle y el otro hacia el patio
 * interno. La cumbrera va a lo largo, de la pared del cuarto 1 a la de abajo, con la viga marrón; de
 * ella bajan 7 vigas chicas blancas por lado hasta el frente y hasta la pared del patio.
 */
const TECHO_COCINA: TechoInclinado = {
  cumbrera: [
    [COCINA[0] / 2, 0],
    [COCINA[0] / 2, COCINA[1]],
  ],
  alturaBorde: H,
  alturaCumbrera: 3.1,
  viga: { ancho: 0.1, alto: 0.2, color: VIGA_MARRON },
  vigasChicas: { porLado: 7, ...SECCION_VIGA, color: VIGA_BLANCA },
};

/**
 * Los demás techos son a un agua (marcados en el plano, 12/11/2026): la oficina cae hacia el techo de
 * la cocina, y el cuarto 2, el lavadero y el baño, hacia el patio interno. Las vigas van en el sentido
 * de la caída. Pendiente supuesta para todos: 12 %.
 */
const PENDIENTE = 0.12;

/**
 * Techo a un agua de tablas y vigas blancas. `bordeAlto` va de esquina a esquina sobre la cara de la
 * pared alta; cae hacia la pared baja, que está a `profundidad`, donde las tablas quedan a `alturaBaja`.
 */
function unAgua(
  bordeAlto: [Punto2, Punto2],
  profundidad: number,
  alturaBaja: number,
  vigas: number,
  extremos?: 'separadas',
): TechoInclinado {
  return {
    cumbrera: bordeAlto,
    alturaBorde: alturaBaja,
    alturaCumbrera: alturaBaja + PENDIENTE * profundidad,
    vigasChicas: { porLado: vigas, ...SECCION_VIGA, color: VIGA_BLANCA, extremos },
  };
}

const TECHO_OFICINA = unAgua([[C1_X0, C1_Z0], [C1_X1, C1_Z0]], C1_Z1 - C1_Z0, ALTO_CUARTO1, 5);
const TECHO_CUARTO2 = unAgua([[C2.x0, C2.z0], [C2.x1, C2.z0]], C2.z1 - C2.z0, H, 5);
const TECHO_LAVADERO = unAgua([[LAV.x0, LAV.z1], [LAV.x1, LAV.z1]], LAV.z1 - LAV.z0, H, 2, 'separadas');
const TECHO_BANIO = unAgua([[BAN.x0, BAN.z1], [BAN.x1, BAN.z1]], BAN.z1 - BAN.z0, H, 4);

// ── Ambientes ────────────────────────────────────────────────────────────────
const ambientes: Ambiente[] = [
  {
    id: 'cocina',
    nombre: 'Cocina-comedor',
    poligono: rect(0, 0, COCINA[0], COCINA[1]),
    piso: PISO_CERAMICO,
    techo: TECHO_COCINA,
    // Entrando por la puerta de calle, mirando hacia la puerta balcón.
    recorrido: { desde: [0.7, 2.8], mirarHacia: [3.5, 1.9] },
    todo: 'Techo a dos aguas: supuse la cumbrera al medio, las tablas a 2,70 sobre el frente y la pared del patio y a 3,10 en la cumbrera. ¿Cuánto hay del piso a la parte de abajo de la viga marrón (supuesta 0,10 × 0,20)? Vigas chicas: 7 por lado, parejas de pared a pared.',
  },
  {
    id: 'cuarto1',
    nombre: 'Cuarto 1 (chicos)',
    poligono: rect(C1_X0, C1_Z0, C1_X1, C1_Z1),
    piso: PISO_MADERA,
    // Sube hasta el techo de la oficina (a un agua hacia la cocina); la oficina ocupa la parte del
    // frente (ver `entrepisos`).
    techo: TECHO_OFICINA,
    // Entrando desde la cocina, mirando hacia la cucheta.
    recorrido: { desde: [3.0, -0.6], mirarHacia: [1.2, -2.1] },
    todo:
      'Altura total 4,80 = 2,70 del cuarto + 0,10 del piso de madera (supuesto) + 2,00 de la oficina. ¿O el total es 4,70? Los 2,70: supuse que son hasta las tablas y que las vigas cuelgan debajo (a 2,55). ¿O son hasta abajo de las vigas? ' +
      `Techo de la oficina a un agua hacia la cocina, con 5 vigas blancas: supuse los 2,00 contra la pared de la cocina y ${m(TECHO_OFICINA.alturaCumbrera - NIVEL_OFICINA)} contra el fondo (12 % de pendiente). ¿Cuánto mide de alto la oficina contra el fondo? ¿Tablas y vigas blancas?`,
  },
  {
    id: 'matrimonial',
    nombre: 'Cuarto 2 (matrimonial)',
    poligono: rect(C2.x0, C2.z0, C2.x1, C2.z1),
    piso: PISO_MADERA,
    techo: TECHO_CUARTO2,
    // Entrando desde el cuarto 1, mirando hacia la medianera.
    recorrido: { desde: [4.85, -0.6], mirarHacia: [7.3, -1.7] },
    todo: `Techo a un agua hacia el patio, con 5 vigas: supuse 2,70 contra la pared del patio y ${m(TECHO_CUARTO2.alturaCumbrera)} contra el fondo (12 % de pendiente). ¿Cuánto mide de alto contra el fondo? ¿Tablas y vigas blancas?`,
  },
  {
    id: 'lavadero',
    nombre: 'Lavadero',
    poligono: rect(LAV.x0, LAV.z0, LAV.x1, LAV.z1),
    piso: PISO_HUMEDO,
    techo: TECHO_LAVADERO,
    todo: `Techo a un agua hacia el patio, con 2 vigas (las puse separadas de las paredes, como en tu dibujo): supuse 2,70 contra el patio y ${m(TECHO_LAVADERO.alturaCumbrera)} contra la pared de abajo (12 % de pendiente). ¿Cuánto mide de alto? ¿Tablas y vigas blancas?`,
  },
  {
    id: 'banio',
    nombre: 'Baño',
    poligono: rect(BAN.x0, BAN.z0, BAN.x1, BAN.z1),
    piso: PISO_HUMEDO,
    techo: TECHO_BANIO,
    todo: `Techo a un agua hacia el patio, con 4 vigas (la primera y la última contra las paredes): supuse 2,70 contra el patio y ${m(TECHO_BANIO.alturaCumbrera)} contra la pared de abajo (12 % de pendiente). ¿Cuánto mide de alto? ¿Tablas y vigas blancas?`,
  },
  {
    id: 'patio',
    nombre: 'Patio interno',
    exterior: true,
    poligono: [
      [X.cocinaPatio + i, Z.cuartos + i],
      [X.medianera - e, Z.cuartos + i],
      [X.medianera - e, Z.banio - i],
      [X.lavaderoBanio - i, Z.banio - i],
      [X.lavaderoBanio - i, Z.lavadero - i],
      [X.cocinaPatio + i, Z.lavadero - i],
    ],
    piso: { color: '#bdb6a8', descripcion: 'baldosas (TODO)' },
    todo: 'Terminación del piso del patio sin definir.',
  },
  {
    id: 'frente',
    nombre: 'Frente',
    exterior: true,
    poligono: [
      [PASILLO.xOtro, FONDO_Z],
      [FACHADA_CUARTO1_X, FONDO_Z],
      [FACHADA_CUARTO1_X, Z.cuartos - i],
      [FACHADA_X, Z.cuartos - i],
      [FACHADA_X, LATERAL_Z],
      [PASILLO.xOtro, LATERAL_Z],
    ],
    piso: { color: '#a9a69d', descripcion: 'sin definir (TODO)' },
    todo: 'Lo que queda entre el pasillo y la casa, cerrado atrás por un muro en la línea del fondo de los cuartos (así sale del croquis). ¿Qué piso tiene (pasto, cemento, baldosas)?',
  },
  {
    id: 'pasillo',
    nombre: 'Pasillo de entrada',
    exterior: true,
    poligono: rect(PASILLO.xOtro, PASILLO.zInicio, PASILLO.xCasa, PASILLO.zCalle - CERCO),
    piso: { color: '#a9a69d', descripcion: 'sin definir (TODO)' },
    todo: '2,40 × 20 m, según el croquis. ¿Qué piso tiene?',
  },
];

// ── Paredes ──────────────────────────────────────────────────────────────────
// Partidas en cada encuentro para que cada cara dé a un solo ambiente.
const paredes: Pared[] = [
  // Frente (de arriba hacia abajo). Izquierda = adentro, derecha = calle.
  { id: 'p-cocina-frente', a: [X.frenteCocina, Z.cuartos], b: [X.frenteCocina, Z.lateral], espesor: E },
  { id: 'p-cuarto1-frente', a: [X.frenteCuarto1, Z.fondo], b: [X.frenteCuarto1, Z.cuartos], espesor: E, alto: ALTO_CUARTO1 },
  // Fondo (de izquierda a derecha). Izquierda = afuera.
  { id: 'p-cuarto1-fondo', a: [X.frenteCuarto1, Z.fondo], b: [X.cuarto1Cuarto2, Z.fondo], espesor: E, alto: ALTO_CUARTO1 },
  { id: 'p-cuarto2-fondo', a: [X.cuarto1Cuarto2, Z.fondo], b: [X.medianera, Z.fondo], espesor: E },
  // Medianera derecha (de arriba hacia abajo). Derecha = adentro.
  { id: 'p-cuarto2-medianera', a: [X.medianera, Z.fondo], b: [X.medianera, Z.cuartos], espesor: E },
  { id: 'p-patio-medianera', a: [X.medianera, Z.cuartos], b: [X.medianera, Z.banio], espesor: E },
  { id: 'p-banio-medianera', a: [X.medianera, Z.banio], b: [X.medianera, Z.lateral], espesor: E },
  // Lateral de abajo (de izquierda a derecha). Izquierda = adentro.
  { id: 'p-cocina-lateral', a: [X.frenteCocina, Z.lateral], b: [X.cocinaPatio, Z.lateral], espesor: E },
  { id: 'p-lavadero-lateral', a: [X.cocinaPatio, Z.lateral], b: [X.lavaderoBanio, Z.lateral], espesor: E },
  { id: 'p-banio-lateral', a: [X.lavaderoBanio, Z.lateral], b: [X.medianera, Z.lateral], espesor: E },
  // Línea cuartos | cocina y patio (de izquierda a derecha). Izquierda = arriba.
  {
    id: 'p-cocina-retiro',
    a: [X.frenteCocina, Z.cuartos],
    b: [X.frenteCuarto1, Z.cuartos],
    espesor: I,
    todo: 'Tramo de frente donde la cocina sobresale del cuarto 1: lo dejé de 0,15 (como las interiores) para que empalme sin escalón con la pared cocina | cuarto 1. Si es más gruesa, se ajusta.',
  },
  { id: 'p-cocina-cuarto1', a: [X.frenteCuarto1, Z.cuartos], b: [X.cocinaPatio, Z.cuartos], espesor: I, alto: ALTO_CUARTO1 },
  { id: 'p-cuarto1-patio', a: [X.cocinaPatio, Z.cuartos], b: [X.cuarto1Cuarto2, Z.cuartos], espesor: I, alto: ALTO_CUARTO1 },
  { id: 'p-cuarto2-patio', a: [X.cuarto1Cuarto2, Z.cuartos], b: [X.medianera, Z.cuartos], espesor: I },
  // Cuarto 1 | cuarto 2 (de arriba hacia abajo). Izquierda = cuarto 2.
  { id: 'p-cuarto1-cuarto2', a: [X.cuarto1Cuarto2, Z.fondo], b: [X.cuarto1Cuarto2, Z.cuartos], espesor: I, alto: ALTO_CUARTO1 },
  // Cocina | patio y cocina | lavadero (de arriba hacia abajo). Izquierda = patio / lavadero.
  { id: 'p-cocina-patio', a: [X.cocinaPatio, Z.cuartos], b: [X.cocinaPatio, Z.lavadero], espesor: I },
  { id: 'p-cocina-lavadero', a: [X.cocinaPatio, Z.lavadero], b: [X.cocinaPatio, Z.lateral], espesor: I },
  // Lavadero | patio (de izquierda a derecha). Izquierda = patio.
  { id: 'p-lavadero-patio', a: [X.cocinaPatio, Z.lavadero], b: [X.lavaderoBanio, Z.lavadero], espesor: I },
  // Baño: oeste (patio y lavadero) y norte (patio).
  { id: 'p-patio-banio', a: [X.lavaderoBanio, Z.banio], b: [X.lavaderoBanio, Z.lavadero], espesor: I },
  { id: 'p-lavadero-banio', a: [X.lavaderoBanio, Z.lavadero], b: [X.lavaderoBanio, Z.lateral], espesor: I },
  { id: 'p-banio-patio', a: [X.lavaderoBanio, Z.banio], b: [X.medianera, Z.banio], espesor: I },
  // Muros del frente y del pasillo de entrada (2,00 m de alto).
  {
    id: 'p-frente-fondo',
    a: [MURO.xOtro, MURO.zFondo],
    b: [FACHADA_CUARTO1_X, MURO.zFondo],
    espesor: CERCO,
    alto: ALTO_CERCO,
    cerco: true,
    todo: 'Muro del fondo del frente, en línea con el fondo de los cuartos (así sale del croquis). Espesor supuesto: 0,15.',
  },
  { id: 'p-frente-oeste', a: [MURO.xOtro, MURO.zFondo], b: [MURO.xOtro, PASILLO.zInicio], espesor: CERCO, alto: ALTO_CERCO, cerco: true },
  { id: 'p-frente-lateral', a: [MURO.xCasa, MURO.zLateral], b: [FACHADA_X, MURO.zLateral], espesor: CERCO, alto: ALTO_CERCO, cerco: true },
  {
    id: 'p-pasillo-oeste',
    a: [MURO.xOtro, PASILLO.zInicio],
    b: [MURO.xOtro, MURO.zCalle],
    espesor: CERCO,
    alto: ALTO_CERCO,
    cerco: true,
    todo: 'Muros del pasillo: 2,00 de alto (confirmado); espesor supuesto 0,15.',
  },
  { id: 'p-pasillo-este', a: [MURO.xCasa, MURO.zLateral], b: [MURO.xCasa, MURO.zCalle], espesor: CERCO, alto: ALTO_CERCO, cerco: true },
  { id: 'p-pasillo-calle', a: [MURO.xOtro, MURO.zCalle], b: [MURO.xCasa, MURO.zCalle], espesor: CERCO, alto: ALTO_CERCO, cerco: true },
];

// ── Aberturas ────────────────────────────────────────────────────────────────
// `desde` se mide sobre el eje de la pared desde su punto `a`.
// Las posiciones salen del croquis (no está a escala): todas a confirmar con cinta.
const PUERTA = 2.05; // alto estándar de puertas — TODO confirmar
const MEDIR = 'Posición y medida estimadas del croquis.';
const PUERTA_BLANCA = '#f3f2ee';
const PUERTA_GRIS = '#8e9296';

/** `desde` para que la abertura empiece en la coordenada `inicio` (x o z según la pared). */
const desdeZ = (pared: { a: Punto2 }, inicio: number) => inicio - pared.a[1];
const desdeX = (pared: { a: Punto2 }, inicio: number) => inicio - pared.a[0];
const p = (id: string) => paredes.find((w) => w.id === id)!;

const aberturas: Abertura[] = [
  // Frente de la cocina
  {
    id: 'a-ventana-cocina-1',
    nombre: 'Ventana frente cocina (arriba)',
    pared: 'p-cocina-frente',
    tipo: 'ventana',
    desde: desdeZ(p('p-cocina-frente'), 0.45), // z = 0,45 → 1,45
    ancho: 1.0,
    alto: 1.1,
    antepecho: 1.0,
    todo: MEDIR + ' Ancho, alto y antepecho supuestos.',
  },
  {
    id: 'a-puerta-entrada',
    nombre: 'Puerta de entrada',
    pared: 'p-cocina-frente',
    tipo: 'puerta',
    desde: desdeZ(p('p-cocina-frente'), 2.35), // z = 2,35 → 3,25
    ancho: 0.9,
    alto: PUERTA,
    // Bisagras del lado del cuarto 1 y picaporte del lado del lavadero (se ve en las fotos).
    hoja: { bisagra: 'a', abreHacia: 'izq' },
    color: PUERTA_BLANCA, // (confirmado)
    todo: MEDIR + ' Supuse que abre hacia adentro.',
  },
  {
    id: 'a-ventana-cocina-2',
    nombre: 'Ventana frente cocina (abajo)',
    pared: 'p-cocina-frente',
    tipo: 'ventana',
    desde: desdeZ(p('p-cocina-frente'), 3.65), // z = 3,65 → 4,15, arriba del mueble del microondas
    ancho: 0.5,
    alto: 0.5,
    antepecho: 1.55,
    todo: 'Ventanita alta: medida y altura estimadas de la foto.',
  },
  // Cuarto 1
  {
    id: 'a-ventana-cuarto1',
    nombre: 'Ventana cuarto 1',
    pared: 'p-cuarto1-frente',
    tipo: 'ventana',
    desde: desdeZ(p('p-cuarto1-frente'), -1.85), // z = −1,85 → −0,85
    ancho: 1.0,
    alto: 1.1,
    antepecho: 1.0,
    todo: MEDIR,
  },
  {
    // Arriba, en la oficina: da sobre el techo de la cocina (confirmado).
    id: 'a-ventana-oficina',
    nombre: 'Ventana de la oficina',
    pared: 'p-cocina-cuarto1',
    tipo: 'ventana',
    desde: desdeX(p('p-cocina-cuarto1'), 1.45), // x = 1,45 → 2,75
    ancho: 1.3,
    alto: 0.4,
    antepecho: NIVEL_OFICINA + 0.4,
    hojas: 4,
    todo: 'Posición sobre la pared, medida y altura estimadas de la foto.',
  },
  {
    id: 'a-puerta-cuarto1',
    nombre: 'Puerta cocina → cuarto 1',
    pared: 'p-cocina-cuarto1',
    tipo: 'puerta',
    desde: desdeX(p('p-cocina-cuarto1'), 2.6), // x = 2,60 → 3,40
    ancho: 0.8,
    alto: PUERTA,
    // Puerta granero colgada del lado de la cocina, corre hacia el frente (confirmado).
    hoja: { tipo: 'granero', lado: 'der', correHacia: 'a' },
    color: PUERTA_GRIS, // (confirmado)
    todo: MEDIR,
  },
  {
    id: 'a-puerta-cuarto2',
    nombre: 'Puerta cuarto 1 → cuarto 2',
    pared: 'p-cuarto1-cuarto2',
    tipo: 'puerta',
    desde: desdeZ(p('p-cuarto1-cuarto2'), -1.0), // z = −1,00 → −0,20
    ancho: 0.8,
    alto: PUERTA,
    // Puerta plegable (confirmado).
    hoja: { tipo: 'plegable', juntaHacia: 'b' },
    todo:
      MEDIR +
      ' Es plegable; supuse plegadiza tipo acordeón que se junta del lado del patio. ¿O es de dos hojas (tipo tijera)? ¿Hacia qué lado se junta? ¿También es blanca, como la de la cocina?',
  },
  // Cuarto 2
  {
    id: 'a-ventana-cuarto2',
    nombre: 'Ventana cuarto 2 al patio',
    pared: 'p-cuarto2-patio',
    tipo: 'ventana',
    desde: desdeX(p('p-cuarto2-patio'), 5.4), // x = 5,40 → 6,60
    ancho: 1.2,
    alto: 1.1,
    antepecho: 1.0,
    todo: MEDIR,
  },
  // Cocina ↔ patio y lavadero
  {
    id: 'a-puerta-balcon',
    nombre: 'Puerta balcón al patio interno',
    pared: 'p-cocina-patio',
    tipo: 'puerta-balcon',
    desde: desdeZ(p('p-cocina-patio'), 0.95), // z = 0,95 → 2,75
    ancho: 1.8,
    alto: PUERTA,
    hojas: 2,
    // Corrediza (confirmado).
    hoja: { tipo: 'corrediza', fija: 'a' },
    todo: MEDIR + ' En el dibujo mide casi 2 m: puse 1,80. Supuse que queda fija la hoja del lado de los cuartos y corre la del lado del lavadero.',
  },
  {
    id: 'a-puerta-lavadero',
    nombre: 'Puerta cocina → lavadero',
    pared: 'p-cocina-lavadero',
    tipo: 'puerta',
    desde: desdeZ(p('p-cocina-lavadero'), 3.5), // z = 3,50 → 4,20
    ancho: 0.7,
    alto: PUERTA,
    // Plegadiza tipo acordeón que se junta del lado de la heladera (se ve en la foto del lavadero).
    hoja: { tipo: 'plegable', juntaHacia: 'b' },
    color: PUERTA_BLANCA, // (confirmado)
    todo: MEDIR,
  },
  // Lavadero
  {
    id: 'a-puerta-lavadero-patio',
    nombre: 'Puerta lavadero → patio',
    pared: 'p-lavadero-patio',
    tipo: 'puerta',
    desde: desdeX(p('p-lavadero-patio'), 3.75), // x = 3,75 → 4,45
    ancho: 0.7,
    alto: PUERTA,
    // Abre hacia el patio, con las bisagras del lado del baño (confirmado).
    hoja: { bisagra: 'b', abreHacia: 'izq' },
    todo: MEDIR,
  },
  {
    id: 'a-puerta-banio',
    nombre: 'Puerta lavadero → baño',
    pared: 'p-lavadero-banio',
    tipo: 'puerta',
    desde: desdeZ(p('p-lavadero-banio'), 3.5), // z = 3,50 → 4,20
    ancho: 0.7,
    alto: PUERTA,
    // Abre hacia el lavadero, con las bisagras del lado de la pared de abajo (confirmado).
    hoja: { bisagra: 'b', abreHacia: 'der' },
    todo: MEDIR,
  },
  // Baño
  {
    id: 'a-ventana-banio',
    nombre: 'Ventana baño al patio',
    pared: 'p-banio-patio',
    tipo: 'ventana',
    desde: desdeX(p('p-banio-patio'), 6.1), // x = 6,10 → 6,80
    ancho: 0.7,
    alto: 0.6,
    antepecho: 1.5,
    hojas: 1,
    todo: MEDIR + ' Alto y antepecho supuestos.',
  },
  // Pasillo de entrada
  {
    id: 'a-porton',
    nombre: 'Portón de entrada',
    pared: 'p-pasillo-calle',
    tipo: 'puerta',
    desde: CERCO / 2 + 0.1, // deja 10 cm de cada lado
    ancho: 2.2,
    alto: ALTO_CERCO,
    hoja: { tipo: 'doble', abreHacia: 'izq' },
    color: '#3f4448',
    todo: 'Supuse un portón de dos hojas que abren hacia adentro, de 2,20 × 2,00, gris oscuro. ¿Cómo es (de abrir, corredizo, con puerta de paso)?',
  },
];

// ── Oficina (entretecho) y escalera ──────────────────────────────────────────
// Según el croquis de la oficina (12/11/2026): sobre el cuarto 1, la oficina ocupa los 2,00 m
// del lado del frente por toda la profundidad (2,40). Los otros 1,40, del lado de las puertas,
// son el hueco de la escalera, en L: sube contra la pared del cuarto 2, descansa en la esquina
// del fondo y llega a la oficina contra la pared del fondo.
const OF_X1 = C1_X0 + 2.0; // borde libre de la oficina (con listones)

const ESC = {
  anchoTramo1: 0.8,
  anchoTramo2: 0.85,
  inicioTramo1: -1.02, // z donde arranca, justo después de la puerta al cuarto 2
  nivelDescanso: 1.4,
};
/** Descanso en la esquina del fondo, del lado del cuarto 2. */
const DESC = { x0: C1_X1 - ESC.anchoTramo1, x1: C1_X1, z0: C1_Z0, z1: C1_Z0 + ESC.anchoTramo2 };

/**
 * Vigas de madera debajo de la oficina (foto del techo del cuarto 1, 12/11/2026): van de la pared de
 * la cocina a la del fondo, con las tablas del piso encima. Son cinco, parejas, desde la que está
 * contra la pared del frente hasta la del borde de los listones. Blancas, como las tablas de abajo.
 */
const VIGA = { cantidad: 5, ...SECCION_VIGA };
const VIGAS_X = Array.from(
  { length: VIGA.cantidad },
  (_, k) => C1_X0 + VIGA.ancho / 2 + (k * (OF_X1 - C1_X0 - VIGA.ancho)) / (VIGA.cantidad - 1),
);

const entrepisos: Entrepiso[] = [
  {
    id: 'oficina',
    nombre: 'Oficina (entretecho)',
    poligono: rect(C1_X0, C1_Z0, OF_X1, C1_Z1),
    nivel: NIVEL_OFICINA,
    espesor: PISO_OFICINA,
    alturaLibre: ALTO_OFICINA,
    color: '#a98b67',
    colorAbajo: TECHO_BLANCO, // techo del cuarto 1, pintado de blanco

    // Listones de piso a techo sobre el borde libre, menos donde llega la escalera.
    barandas: [
      [
        [OF_X1, C1_Z1],
        [OF_X1, DESC.z1],
      ],
    ],
    altoBaranda: ALTO_OFICINA,
    separacionBaranda: 0.11,
    vigas: {
      ejes: VIGAS_X.map((x): [Punto2, Punto2] => [
        [x, C1_Z0],
        [x, C1_Z1],
      ]),
      ancho: VIGA.ancho,
      alto: VIGA.alto,
      color: VIGA_BLANCA,
    },
    todo:
      'Ancho de la oficina (2,00) y posición de los listones según el croquis y las fotos. Vigas: cinco parejas según la foto; sección supuesta 0,075 × 0,15, colgando debajo de las tablas.',
  },
];

const escaleras: Escalera[] = [
  {
    id: 'escalera-oficina',
    nombre: 'Escalera a la oficina',
    color: '#d9bf8f',
    tramos: [
      {
        // Contra la pared del cuarto 2, subiendo hacia el fondo.
        desde: [C1_X1 - ESC.anchoTramo1 / 2, ESC.inicioTramo1],
        hasta: [C1_X1 - ESC.anchoTramo1 / 2, DESC.z1],
        ancho: ESC.anchoTramo1,
        alturaDesde: 0,
        alturaHasta: ESC.nivelDescanso,
        escalones: 5,
        baranda: 'izq',
      },
      {
        // Contra la pared del fondo, subiendo hacia el frente hasta la oficina.
        desde: [DESC.x0, C1_Z0 + ESC.anchoTramo2 / 2],
        hasta: [OF_X1, C1_Z0 + ESC.anchoTramo2 / 2],
        ancho: ESC.anchoTramo2,
        alturaDesde: ESC.nivelDescanso,
        alturaHasta: NIVEL_OFICINA,
        escalones: 5,
        baranda: 'izq',
      },
    ],
    descansos: [{ poligono: rect(DESC.x0, DESC.z0, DESC.x1, DESC.z1), altura: ESC.nivelDescanso }],
    todo:
      'Escalera en L según el croquis. ¿Cuántos escalones tiene cada tramo y a qué altura está el descanso? (supuse 5 + 5 y el descanso a 1,40).',
  },
];

// ── Muebles y artefactos ─────────────────────────────────────────────────────
// Ubicados a partir de las fotos de la cocina y el lavadero y del croquis del baño
// (12/11/2026). Medidas típicas: todo a confirmar con cinta.
// giro: 0 = frente hacia abajo de la planta, 90 = izquierda, 180 = arriba, 270 = derecha.
const BLANCO = '#f4f3ef';
const LOZA = '#fbfbf9';

/** z del centro de un mueble apoyado contra la pared de abajo (z = `cara`) con esa profundidad. */
const contraAbajo = (cara: number, prof: number) => cara - prof / 2;
const COC_ABAJO = COCINA[1]; // cara interior de la pared de abajo de cocina y lavadero

/** Mueble del microondas contra el frente: de la puerta de entrada (z 3,25) hacia la esquina. */
const MUEBLE_MICRO = { z0: 3.25, z1: 3.95 };
/** Mesada en L: `finCocina` = x donde arranca la cocina con horno; la vuelta ocupa x 0 → `fondoVuelta`. */
const MESADA_L = { finCocina: 2.33, fondoVuelta: 0.6, prof: 0.6 };
/** x del centro de la cocina con horno. */
const X_COCINA = 2.61;
/**
 * Arriba de la mesada, de la cocina hacia el frente (confirmado): la campana sobre la cocina, la
 * alacena de 1,20 y tres estantes desde la alacena hasta la pared de la ventana (x = 0).
 */
const ARRIBA = { anchoCampana: 0.6, largoAlacena: 1.2, elevacion: 1.55, altoAlacena: 0.65 };
const X_CAMPANA_0 = X_COCINA - ARRIBA.anchoCampana / 2; // donde termina la alacena
const X_ALACENA_0 = X_CAMPANA_0 - ARRIBA.largoAlacena; // donde terminan los estantes

const MADERA_OSCURA = '#7a3d27'; // muebles del cuarto de los chicos
const MADERA_CLARA = '#c99a63'; // base de la mesa pizza y patas de las sillas
/** Mesa pizza: `salidaSillas` = cuánto están corridas las sillas hacia afuera desde el centro. */
const MESA = { centro: [1.8, 2.5] as Punto2, diametro: 0.9, salidaSillas: 0.02 };
/** Silla de la mesa pizza: gajo de 80° (deja lugar a las patas de la mesa en las diagonales). */
const SILLA_PIZZA = { radio: 0.43, ancho: 2 * 0.43 * Math.sin((40 * Math.PI) / 180) };
/** Cucheta del cuarto 1: largo de la cama, profundidad y estante de la cabecera. */
const CUCHETA = { largo: 2.0, prof: 0.95, estante: 0.3 };
/** z de cada puesto de la oficina (monitor y silla). */
const PUESTOS_OFICINA = [-1.85, -1.05];

const muebles: Mueble[] = [
  // ── Cocina: pared de abajo (medianera), de derecha a izquierda ──
  {
    id: 'm-heladera',
    nombre: 'Heladera',
    tipo: 'heladera',
    ambiente: 'cocina',
    centro: [3.2, contraAbajo(COC_ABAJO, 0.65)],
    ancho: 0.6,
    profundidad: 0.65,
    alto: 1.65,
    giro: 180,
    color: BLANCO,
  },
  {
    id: 'm-cocina',
    nombre: 'Cocina con horno',
    tipo: 'cocina',
    ambiente: 'cocina',
    centro: [X_COCINA, contraAbajo(COC_ABAJO, 0.6)],
    ancho: 0.55,
    profundidad: 0.6,
    alto: 0.85,
    giro: 180,
    color: BLANCO,
  },
  // Mesada en L (confirmado): un tramo contra la pared de abajo, desde la cocina hasta la
  // esquina, y la vuelta por el frente hasta el mueble del microondas.
  {
    id: 'm-mesada-cocina',
    nombre: 'Mesada de cocina (tramo de abajo)',
    tipo: 'mesada',
    ambiente: 'cocina',
    centro: [(MESADA_L.fondoVuelta + MESADA_L.finCocina) / 2, contraAbajo(COC_ABAJO, MESADA_L.prof)],
    ancho: MESADA_L.finCocina - MESADA_L.fondoVuelta,
    profundidad: MESADA_L.prof,
    alto: 0.9,
    giro: 180,
    color: '#ebe7de',
    colorTapa: '#8c8477',
    piletas: [{ desplazamiento: 0.05, ancho: 0.5, profundidad: 0.38 }],
    todo: 'Mesada en L que termina en el mueble del microondas (confirmado). Largo de cada tramo y lugar de la pileta estimados de las fotos.',
  },
  {
    id: 'm-mesada-cocina-vuelta',
    nombre: 'Mesada de cocina (vuelta del frente)',
    tipo: 'mesada',
    ambiente: 'cocina',
    centro: [MESADA_L.fondoVuelta / 2, (MUEBLE_MICRO.z1 + COC_ABAJO) / 2],
    ancho: COC_ABAJO - MUEBLE_MICRO.z1,
    profundidad: MESADA_L.fondoVuelta,
    alto: 0.9,
    giro: 270,
    color: '#c9a678', // abajo tiene estantes de madera
    colorTapa: '#8c8477',
  },
  // Arriba de la mesada (confirmado): campana, alacena de 1,20 y tres estantes hasta el frente.
  {
    id: 'm-campana',
    nombre: 'Campana / extractor',
    tipo: 'campana',
    ambiente: 'cocina',
    centro: [X_COCINA, contraAbajo(COC_ABAJO, 0.5)],
    ancho: ARRIBA.anchoCampana,
    profundidad: 0.5,
    alto: 0.15,
    elevacion: ARRIBA.elevacion,
    giro: 180,
    color: '#c3c6c8',
    todo: 'Medida y altura de la campana supuestas (0,60 × 0,50, abajo a 1,55). ¿Tiene chimenea o salida hacia arriba? Necesita un toma cerca (fase 3).',
  },
  {
    id: 'm-alacena-cocina',
    nombre: 'Alacena de cocina',
    tipo: 'caja',
    ambiente: 'cocina',
    centro: [X_CAMPANA_0 - ARRIBA.largoAlacena / 2, contraAbajo(COC_ABAJO, 0.35)],
    ancho: ARRIBA.largoAlacena,
    profundidad: 0.35,
    alto: ARRIBA.altoAlacena,
    elevacion: ARRIBA.elevacion,
    giro: 180,
    color: BLANCO,
  },
  {
    id: 'm-estantes-cocina',
    nombre: 'Estantes de cocina',
    tipo: 'estantes',
    ambiente: 'cocina',
    centro: [X_ALACENA_0 / 2, contraAbajo(COC_ABAJO, 0.25)],
    ancho: X_ALACENA_0,
    profundidad: 0.25,
    alto: ARRIBA.altoAlacena,
    elevacion: ARRIBA.elevacion,
    giro: 180,
    divisiones: 3,
    color: '#c9a678',
    todo: 'Altura de cada estante y profundidad supuestas: puse los tres a la altura de la alacena (abajo, al medio y arriba).',
  },
  // ── Cocina: frente ──
  {
    id: 'm-mueble-microondas',
    nombre: 'Mueble blanco (microondas)',
    tipo: 'caja',
    ambiente: 'cocina',
    centro: [0.225, (MUEBLE_MICRO.z0 + MUEBLE_MICRO.z1) / 2],
    ancho: MUEBLE_MICRO.z1 - MUEBLE_MICRO.z0,
    profundidad: 0.45,
    alto: 1.3,
    giro: 270,
    color: BLANCO,
  },
  {
    id: 'm-microondas',
    nombre: 'Microondas',
    tipo: 'microondas',
    ambiente: 'cocina',
    centro: [0.2, (MUEBLE_MICRO.z0 + MUEBLE_MICRO.z1) / 2],
    ancho: 0.45,
    profundidad: 0.35,
    alto: 0.27,
    elevacion: 1.3,
    giro: 270,
    color: BLANCO,
  },
  {
    // Croquis del 12/11/2026: en la pared del patio, a la izquierda de la puerta balcón, abajo.
    id: 'm-calefactor',
    nombre: 'Calefactor',
    tipo: 'caja',
    ambiente: 'cocina',
    centro: [COCINA[0] - 0.1, 0.5],
    ancho: 0.55,
    profundidad: 0.2,
    alto: 0.7,
    elevacion: 0.1,
    giro: 90,
    color: BLANCO,
    todo: 'A gas, de tiro balanceado (confirmado): sale por la pared al patio. Medidas y posición estimadas del croquis.',
  },
  {
    // Croquis del 12/11/2026: en la esquina del patio, contra la medianera y la pared del baño.
    id: 'm-garita-termotanque',
    nombre: 'Garita del termotanque',
    tipo: 'caja',
    ambiente: 'patio',
    centro: [X.medianera - e - 0.475, Z.banio - i - 0.45],
    ancho: 0.95,
    profundidad: 0.9,
    alto: 1.45,
    giro: 180,
    color: '#d9d4ca',
    todo: 'Medidas estimadas del croquis (0,95 × 0,90). Le puse 1,45 de alto para que no tape la ventana del baño, que empieza a 1,50. ¿Cuánto mide y de qué es?',
  },
  {
    id: 'm-rack-tv',
    nombre: 'Rack de la tele',
    tipo: 'caja',
    ambiente: 'cocina',
    centro: [0.175, 1.65],
    ancho: 1.4,
    profundidad: 0.35,
    alto: 0.55,
    giro: 270,
    color: '#5f5d5a',
  },
  {
    id: 'm-tv',
    nombre: 'Tele',
    tipo: 'tv',
    ambiente: 'cocina',
    centro: [0.15, 1.7],
    ancho: 1.0,
    profundidad: 0.08,
    alto: 0.6,
    elevacion: 0.55,
    giro: 270,
  },
  // ── Cocina: pared del cuarto 1 ──
  {
    id: 'm-divan',
    nombre: 'Diván',
    tipo: 'cama',
    ambiente: 'cocina',
    centro: [0.925, 0.08 + 0.425],
    ancho: 1.85,
    profundidad: 0.85,
    alto: 0.45,
    giro: 0,
    color: '#e8e3d8',
    todo: 'Largo y separación de la pared estimados: el extremo queda justo antes de la puerta granero abierta.',
  },
  // ── Cocina: mesa pizza con 4 sillas (confirmado) ──
  // Tapa redonda de vidrio y sillas en cuarto de círculo que se guardan debajo, formando un círculo.
  {
    id: 'm-mesa-cocina',
    nombre: 'Mesa pizza',
    tipo: 'mesa-pizza',
    ambiente: 'cocina',
    centro: MESA.centro,
    ancho: MESA.diametro,
    profundidad: MESA.diametro,
    alto: 0.75,
    color: '#cfe0e2',
    colorTapa: MADERA_CLARA,
    todo: 'Diámetro supuesto 0,90 (la medida más común de este modelo). Las sillas están dibujadas guardadas debajo de la mesa.',
  },
  ...(
    [
      ['n', [0, -1], 0],
      ['s', [0, 1], 180],
      ['o', [-1, 0], 270],
      ['e', [1, 0], 90],
    ] as const
  ).map(([k, [dx, dz], giro]): Mueble => {
    // Centro del gajo: el vértice queda en el centro de la mesa y el respaldo hacia afuera.
    const d = MESA.salidaSillas + SILLA_PIZZA.radio / 2;
    return {
      id: `m-silla-${k}`,
      nombre: 'Silla',
      tipo: 'silla-pizza',
      ambiente: 'cocina',
      centro: [MESA.centro[0] + dx * d, MESA.centro[1] + dz * d],
      ancho: SILLA_PIZZA.ancho,
      profundidad: SILLA_PIZZA.radio,
      alto: 0.74,
      giro,
      // Dos blancas y dos negras, como en las fotos de la cocina.
      color: k === 'n' || k === 'o' ? '#f0ede6' : '#2e3033',
      colorTapa: MADERA_CLARA,
    };
  }),

  // ── Lavadero: mesada de lado a lado sobre la pared de abajo ──
  {
    id: 'm-mesada-lavadero',
    nombre: 'Mesada del lavadero',
    tipo: 'mesada',
    ambiente: 'lavadero',
    centro: [X.cocinaPatio + i + LAVADERO[0] / 2, contraAbajo(COC_ABAJO, 0.6)],
    ancho: LAVADERO[0],
    profundidad: 0.6,
    alto: 0.95,
    giro: 180,
    abajo: 'abierto',
    colorTapa: '#c8a377',
    // Pileta de lavar del lado del baño (a la izquierda mirando la mesada de frente).
    piletas: [{ desplazamiento: -0.55, ancho: 0.5, profundidad: 0.45 }],
  },
  {
    id: 'm-lavarropas',
    nombre: 'Lavarropas',
    tipo: 'lavarropas',
    ambiente: 'lavadero',
    centro: [X.cocinaPatio + i + 0.32, contraAbajo(COC_ABAJO, 0.6)],
    ancho: 0.6,
    profundidad: 0.6,
    alto: 0.85,
    giro: 180,
    color: BLANCO,
  },
  {
    id: 'm-alacena-lavadero',
    nombre: 'Alacena del lavadero',
    tipo: 'caja',
    ambiente: 'lavadero',
    centro: [X.cocinaPatio + i + 0.5, contraAbajo(COC_ABAJO, 0.35)],
    ancho: 1.0,
    profundidad: 0.35,
    alto: 0.75,
    elevacion: 1.55,
    giro: 180,
    color: '#e4ddcc',
    todo: 'Ancho y altura de la alacena estimados de la foto.',
  },

  // ── Baño (según el croquis: mesada contra la pared del patio, sanitarios contra la de abajo) ──
  {
    id: 'm-mesada-banio',
    nombre: 'Mesada del baño',
    tipo: 'mesada',
    ambiente: 'banio',
    centro: [X.lavaderoBanio + i + BANIO[0] / 2, Z.banio + i + 0.25],
    ancho: BANIO[0],
    profundidad: 0.5,
    alto: 0.85,
    giro: 0,
    color: '#efece6',
    colorTapa: '#e6e3dc',
    piletas: [{ desplazamiento: -0.25, ancho: 0.45, profundidad: 0.35 }],
    todo: 'En el croquis la mesada ocupa toda la pared del patio (2 m): ¿es así? Profundidad supuesta 0,50.',
  },
  {
    id: 'm-inodoro',
    nombre: 'Inodoro',
    tipo: 'inodoro',
    ambiente: 'banio',
    centro: [5.9, contraAbajo(COC_ABAJO, 0.65)],
    ancho: 0.37,
    profundidad: 0.65,
    alto: 0.8,
    giro: 180,
    color: LOZA,
  },
  {
    id: 'm-bidet',
    nombre: 'Bidet',
    tipo: 'bidet',
    ambiente: 'banio',
    centro: [6.45, contraAbajo(COC_ABAJO, 0.55)],
    ancho: 0.37,
    profundidad: 0.55,
    alto: 0.4,
    giro: 180,
    color: LOZA,
  },
  {
    id: 'm-ducha',
    nombre: 'Ducha',
    tipo: 'ducha',
    ambiente: 'banio',
    centro: [X.medianera - e - 0.4, contraAbajo(COC_ABAJO, 1.2)],
    ancho: 0.8,
    profundidad: 1.2,
    alto: 0.04,
    giro: 180,
    color: '#e4e4e1',
    todo: 'Medida del plato estimada del croquis (0,80 × 1,20). ¿Tiene mampara o cortina?',
  },

  // ── Cuarto 1 (chicos), según las fotos (12/11/2026) ──
  // Contra la pared del fondo, la cucheta con su estante en la cabecera, del lado de la ventana.
  // Contra la pared de la cocina, en la esquina del frente, el placard y la biblioteca.
  {
    id: 'm-estante-cucheta',
    nombre: 'Estante de la cucheta',
    tipo: 'biblioteca',
    ambiente: 'cuarto1',
    centro: [C1_X0 + CUCHETA.estante / 2, C1_Z0 + CUCHETA.prof / 2],
    ancho: CUCHETA.estante,
    profundidad: CUCHETA.prof,
    alto: 1.6,
    giro: 0,
    color: MADERA_OSCURA,
  },
  {
    id: 'm-cucheta',
    nombre: 'Cucheta',
    tipo: 'cucheta',
    ambiente: 'cuarto1',
    centro: [C1_X0 + CUCHETA.estante + CUCHETA.largo / 2, C1_Z0 + CUCHETA.prof / 2],
    ancho: CUCHETA.largo,
    profundidad: CUCHETA.prof,
    alto: 1.65,
    giro: 0,
    color: MADERA_OSCURA,
    colorTapa: '#3b4f80',
    todo: 'A los pies de la cucheta, debajo de la escalera, se ve un tercer colchón más bajo: ¿es una cama carrito que sale de abajo? Todavía no lo dibujé.',
  },
  {
    id: 'm-placard-cuarto1',
    nombre: 'Placard (cuarto 1)',
    tipo: 'placard',
    ambiente: 'cuarto1',
    centro: [C1_X0 + 0.4, C1_Z1 - 0.25],
    ancho: 0.8,
    profundidad: 0.5,
    alto: 1.9,
    giro: 180,
    color: MADERA_OSCURA,
  },
  {
    id: 'm-biblioteca-cuarto1',
    nombre: 'Biblioteca',
    tipo: 'biblioteca',
    ambiente: 'cuarto1',
    // Termina donde arranca la puerta a la cocina.
    centro: [C1_X0 + 0.8 + 0.425, C1_Z1 - 0.175],
    ancho: 0.85,
    profundidad: 0.35,
    alto: 1.8,
    giro: 180,
    abajo: 'cerrado',
    color: MADERA_OSCURA,
  },

  // ── Cuarto 2 (matrimonial), según las fotos (12/11/2026) ──
  // Contra la pared del cuarto 1: perchero con un estante arriba. La cama con la cabecera contra la pared
  // del fondo y los pies hacia la ventana. Contra la medianera: cajonera, ropero y cómoda con la tele.
  {
    id: 'm-perchero',
    nombre: 'Perchero',
    tipo: 'perchero',
    ambiente: 'matrimonial',
    centro: [C2.x0 + 0.225, C2.z0 + 0.02 + 0.6],
    ancho: 1.2,
    profundidad: 0.45,
    alto: 1.6,
    giro: 270,
    color: '#4a3b2f',
    colorTapa: '#6d6870',
  },
  {
    id: 'm-estante-cuarto2',
    nombre: 'Estante sobre el perchero',
    tipo: 'biblioteca',
    ambiente: 'matrimonial',
    centro: [C2.x0 + 0.11, C2.z0 + 0.05 + 0.55],
    ancho: 1.1,
    profundidad: 0.22,
    alto: 0.26,
    elevacion: 1.7,
    giro: 270,
    color: BLANCO,
  },
  {
    id: 'm-mueble-bajo-cuarto2',
    nombre: 'Mueble bajo blanco',
    tipo: 'caja',
    ambiente: 'matrimonial',
    centro: [C2.x0 + 0.2, C2.z0 + 1.22 + 0.15],
    ancho: 0.3,
    profundidad: 0.4,
    alto: 0.55,
    giro: 270,
    color: BLANCO,
    todo: 'En la foto se ve algo blanco y bajo entre el perchero y la puerta, tapado con ropa: ¿qué es y cuánto mide?',
  },
  {
    id: 'm-cama-matrimonial',
    nombre: 'Cama',
    tipo: 'cama',
    ambiente: 'matrimonial',
    // Cabecera contra la pared del fondo y los pies hacia la ventana, sin llegar a ella (confirmado).
    // Centrada frente a la ventana, que está en el medio del cuarto.
    centro: [(C2.x0 + C2.x1) / 2, C2.z0 + 1.9 / 2],
    ancho: 1.4,
    profundidad: 1.9,
    alto: 0.55,
    giro: 0,
    color: '#8a5470',
    todo: 'Supuse de 2 plazas (1,40 × 1,90), centrada frente a la ventana.',
  },
  {
    id: 'm-cajonera-cuarto2',
    nombre: 'Cajonera blanca',
    tipo: 'comoda',
    ambiente: 'matrimonial',
    centro: [C2.x1 - 0.15, C2.z0 + 0.3],
    ancho: 0.6,
    profundidad: 0.3,
    alto: 1.3,
    giro: 90,
    color: BLANCO,
  },
  {
    id: 'm-placard-cuarto2',
    nombre: 'Ropero blanco',
    tipo: 'placard',
    ambiente: 'matrimonial',
    centro: [C2.x1 - 0.25, C2.z0 + 0.65 + 0.3],
    ancho: 0.6,
    profundidad: 0.5,
    alto: 1.6,
    giro: 90,
    divisiones: 1,
    color: BLANCO,
  },
  {
    id: 'm-comoda-cuarto2',
    nombre: 'Cómoda',
    tipo: 'comoda',
    ambiente: 'matrimonial',
    centro: [C2.x1 - 0.225, C2.z0 + 1.3 + 0.375],
    ancho: 0.75,
    profundidad: 0.45,
    alto: 1.0,
    giro: 90,
    color: '#b97c43',
  },
  {
    id: 'm-tv-cuarto2',
    nombre: 'Tele (cuarto 2)',
    tipo: 'tv',
    ambiente: 'matrimonial',
    centro: [C2.x1 - 0.2, C2.z0 + 1.3 + 0.375],
    ancho: 0.73,
    profundidad: 0.06,
    alto: 0.43,
    elevacion: 1.0 + 0.05,
    giro: 90,
    todo: 'Supuse una tele de 32" sobre la cómoda.',
  },

  // ── Oficina (entretecho), sobre el piso de madera ──
  {
    // Contra la pared del frente, de punta a punta: 2,40 (confirmado).
    id: 'm-escritorio',
    nombre: 'Escritorio',
    tipo: 'escritorio',
    ambiente: 'cuarto1',
    centro: [C1_X0 + 0.35, (C1_Z0 + C1_Z1) / 2],
    ancho: C1_Z1 - C1_Z0,
    profundidad: 0.7,
    alto: 0.75,
    elevacion: NIVEL_OFICINA,
    giro: 270,
    color: '#b07a45',
  },
  // Dos puestos (confirmado: dos monitores y dos sillas), cada silla frente a su monitor.
  ...PUESTOS_OFICINA.flatMap((z, k): Mueble[] => [
    {
      id: `m-monitor-${k + 1}`,
      nombre: `Monitor ${k + 1}`,
      tipo: 'tv',
      ambiente: 'cuarto1',
      centro: [C1_X0 + 0.12, z],
      ancho: 0.55,
      profundidad: 0.05,
      alto: 0.35,
      elevacion: NIVEL_OFICINA + 0.75 + 0.1,
      giro: 270,
    },
    {
      id: `m-silla-oficina-${k + 1}`,
      nombre: `Silla de escritorio ${k + 1}`,
      tipo: 'silla',
      ambiente: 'cuarto1',
      centro: [C1_X0 + 0.85, z],
      ancho: 0.5,
      profundidad: 0.5,
      alto: 1.0,
      elevacion: NIVEL_OFICINA,
      giro: 90,
      color: '#2e3033',
    },
  ]),
];

// ── Casa ─────────────────────────────────────────────────────────────────────
export const casa: Casa = {
  nombre: 'Mi casa',
  alturaTecho: H,
  norte: {
    grados: 0,
    todo: 'Orientación real sin confirmar: supuse que el arriba del croquis es el norte. Hace falta para el sol en el modo día.',
  },
  // Vista 3D inicial: desde el frente (entrada), un poco desde abajo del plano.
  vista3d: { direccion: [-0.55, 0.85, 0.5] },
  colores: {
    paredInterior: '#f3f1ec',
    paredExterior: '#e8e4dc',
    techo: TECHO_BLANCO,
    corte: '#3b4148',
    marco: '#d4d4d2',
    vidrio: '#9fc6dc',
    puerta: '#c9a57c',
    umbral: '#d7d2ca',
    terreno: '#93a874',
  },
  ambientes,
  paredes,
  aberturas,
  entrepisos,
  escaleras,
  muebles,
  pendientes: [
    'Supuse que el fondo, la medianera derecha y el lateral de abajo no tienen aberturas (en el croquis no hay).',
    'Espesores de muros supuestos: 0,20 m frente y medianeras, 0,15 m interiores y hacia el patio.',
    'Alto de puertas supuesto: 2,05 m.',
    'Muebles ubicados a ojo desde las fotos y el croquis, con medidas típicas: a confirmar con cinta.',
    '¿Dónde va el espejo del baño (y a qué altura)? Hace falta para sus luces laterales (fase 2).',
    'Oficina: hay una tira de LED alrededor de la pared del escritorio (se ve en la foto). La sumo con las luces en la fase 2.',
  ],
};
