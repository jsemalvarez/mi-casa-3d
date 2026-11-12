/**
 * Modelo de datos de la casa.
 *
 * Unidades: metros. Ángulos: grados.
 * Ejes (ver README), con la planta orientada como el croquis:
 *   X → derecha en la planta (del frente hacia la medianera)
 *   Z → abajo en la planta (de los cuartos hacia el lateral)
 *   Y → arriba
 * Origen: esquina interior de arriba a la izquierda de la cocina-comedor, a nivel de piso terminado.
 * "Norte del plano" = −Z; el norte real se configura en `casa.norte`.
 *
 * Todo lo que se dibuja sale de estos datos: cambiar la casa = cambiar un dato.
 */

/** Punto en planta: [x, z] en metros. */
export type Punto2 = [number, number];

/** Cualquier elemento puede llevar una nota de algo provisorio o a confirmar. */
export interface ConTodo {
  /** Texto visible en el panel "Pendientes". Si existe, el elemento se considera provisorio. */
  todo?: string;
}

export interface Ambiente extends ConTodo {
  id: string;
  nombre: string;
  /**
   * Contorno del piso por las caras interiores de las paredes (no por los ejes).
   * Vértices en orden (horario o antihorario, da igual).
   */
  poligono: Punto2[];
  /** true para patio, vereda, etc.: no lleva techo y sus caras de pared cuentan como fachada. */
  exterior?: boolean;
  /** Altura de techo (m). Si falta, usa `casa.alturaTecho`. */
  alturaTecho?: number;
  piso: { color: string; descripcion?: string };
  /** Color por defecto de todas las caras de pared que dan a este ambiente. */
  colorParedes?: string;
  colorTecho?: string;
  /** Punto de partida opcional para el recorrido en primera persona. */
  recorrido?: { desde: Punto2; mirarHacia: Punto2 };
}

/**
 * Pared recta definida por su EJE (línea media), de `a` a `b`.
 *
 * - Las uniones se resuelven solas: en esquinas en L una pared se alarga y la otra se recorta;
 *   en encuentros en T la pared que llega se recorta hasta la cara de la otra.
 * - Partí las paredes en cada encuentro, así cada lado da a un solo ambiente
 *   (eso permite pintar cada cara por separado).
 * - "Izquierda" y "derecha" son mirando desde `a` hacia `b`.
 */
export interface Pared extends ConTodo {
  id: string;
  /** Nombre opcional; si falta se arma con los ambientes de cada lado. */
  nombre?: string;
  a: Punto2;
  b: Punto2;
  espesor: number;
  /** Altura (m). Si falta, usa `casa.alturaTecho`. */
  alto?: number;
  /** Color de la cara izquierda (mirando de a → b). Pisa el color del ambiente. */
  colorIzq?: string;
  /** Color de la cara derecha (mirando de a → b). Pisa el color del ambiente. */
  colorDer?: string;
}

export type TipoAbertura = 'puerta' | 'puerta-balcon' | 'ventana' | 'vano';

/**
 * Cómo abre una puerta. "Izquierda/derecha" son mirando la pared de a → b; los extremos
 * 'a' / 'b' son los bordes de la abertura más cercanos al punto `a` o `b` de la pared.
 */
export type HojaPuerta = HojaBatiente | HojaPlegable | HojaGranero;

/** Puerta común de abrir (con bisagras). Es el tipo por defecto si no se indica `tipo`. */
export interface HojaBatiente {
  tipo?: 'batiente';
  /** Extremo de las bisagras. */
  bisagra: 'a' | 'b';
  /** Lado de la pared hacia el que abre. */
  abreHacia: 'izq' | 'der';
}

/** Puerta plegadiza tipo acordeón: se junta contra un costado del marco. */
export interface HojaPlegable {
  tipo: 'plegable';
  /** Extremo hacia el que se junta al abrir. */
  juntaHacia: 'a' | 'b';
}

/** Puerta granero: corre por fuera de la pared, colgada de un riel arriba del vano. */
export interface HojaGranero {
  tipo: 'granero';
  /** Lado de la pared del que cuelga (ahí queda tapada la pared cuando está abierta). */
  lado: 'izq' | 'der';
  /** Extremo hacia el que corre al abrir. */
  correHacia: 'a' | 'b';
}

export interface Abertura extends ConTodo {
  id: string;
  nombre?: string;
  /** id de la pared donde está. */
  pared: string;
  tipo: TipoAbertura;
  /**
   * Distancia (m) medida sobre el eje de la pared, desde el punto `a`
   * hasta el borde de la abertura más cercano a `a`.
   */
  desde: number;
  ancho: number;
  alto: number;
  /** Altura del borde inferior sobre el piso. 0 (o nada) en puertas y vanos. */
  antepecho?: number;
  /** Solo puertas: de abrir, plegable o granero. */
  hoja?: HojaPuerta;
  /** Solo puertas: color de la hoja. Si falta, usa `colores.puerta`. */
  color?: string;
  /** Ventanas y puertas balcón: cantidad de hojas (1 a 4). Por defecto 2. */
  hojas?: number;
}

/**
 * Piso elevado: entrepiso, entretecho, altillo. Por ahora no es un ambiente aparte:
 * está dentro del ambiente de abajo, que tiene que tener la altura total.
 */
export interface Entrepiso extends ConTodo {
  id: string;
  nombre: string;
  /** Contorno en planta. */
  poligono: Punto2[];
  /** Altura de la cara superior del piso del entrepiso (m). */
  nivel: number;
  espesor: number;
  color: string;
  /** Altura libre arriba (m), para las etiquetas y la vista "Oficina". */
  alturaLibre?: number;
  /** Postes que bajan hasta el piso, en planta. */
  postes?: Punto2[];
  /** Tramos de baranda (polilíneas en planta) sobre los bordes libres. */
  barandas?: Punto2[][];
  altoBaranda?: number;
  /** Separación entre balaustres o listones (m). Por defecto 0,14. */
  separacionBaranda?: number;
  /** Vigas que lo sostienen, colgadas debajo del piso. */
  vigas?: Vigas;
}

/** Vigas de un entrepiso: cuelgan debajo de su piso, de apoyo a apoyo. */
export interface Vigas {
  /** Eje de cada viga en planta, de un apoyo al otro. */
  ejes: [Punto2, Punto2][];
  /** Sección: `ancho` en planta y `alto` = cuánto cuelga debajo del piso. */
  ancho: number;
  alto: number;
  /** Si falta, el del entrepiso. */
  color?: string;
}

/** Tramo recto de escalera. "Izquierda/derecha" son mirando hacia arriba. */
export interface TramoEscalera {
  /** Centro del borde de abajo (donde se empieza a subir), en planta. */
  desde: Punto2;
  /** Centro del borde de arriba (donde se llega). */
  hasta: Punto2;
  ancho: number;
  /** Alturas de arranque y de llegada, en m sobre el piso de planta baja. */
  alturaDesde: number;
  alturaHasta: number;
  /** Cantidad de alzadas (escalones) del tramo. */
  escalones: number;
  baranda?: 'izq' | 'der' | 'ambos';
}

export interface Escalera extends ConTodo {
  id: string;
  nombre: string;
  color: string;
  tramos: TramoEscalera[];
  /** Descansos entre tramos. */
  descansos?: { poligono: Punto2[]; altura: number }[];
}

/** Tipos de mueble con forma propia; 'caja' es un volumen simple. */
export type TipoMueble =
  | 'caja'
  | 'mesada'
  | 'inodoro'
  | 'bidet'
  | 'ducha'
  | 'heladera'
  | 'cocina'
  | 'lavarropas'
  | 'microondas'
  | 'mesa'
  | 'silla'
  | 'cama'
  | 'sillon'
  | 'escritorio'
  | 'tv'
  | 'cucheta'
  | 'biblioteca'
  | 'perchero'
  | 'placard'
  | 'comoda'
  | 'campana'
  | 'estantes'
  | 'mesa-pizza'
  | 'silla-pizza';

/**
 * Mueble o artefacto como volumen simple con medidas reales.
 * Sistema local: `ancho` sobre X, `profundidad` sobre Z, `alto` hacia arriba.
 * El FRENTE mira hacia abajo en la planta con giro 0; la espalda es la que va contra la pared.
 * `giro`: 0 = frente hacia abajo de la planta, 90 = hacia la izquierda, 180 = hacia arriba, 270 = hacia la derecha.
 */
export interface Mueble extends ConTodo {
  id: string;
  nombre: string;
  tipo: TipoMueble;
  /** Ambiente donde está (para ordenar y para los pendientes). */
  ambiente?: string;
  /** Centro en planta [x, z]. */
  centro: Punto2;
  ancho: number;
  profundidad: number;
  alto: number;
  /** Giro en planta, en grados, sentido horario (ver arriba). */
  giro?: number;
  /** Altura de la base sobre el piso (alacenas, microondas, tele). Por defecto 0. */
  elevacion?: number;
  color?: string;
  /** Color secundario: tapa de las mesadas, colchones de la cucheta, ropa del perchero. */
  colorTapa?: string;
  /**
   * Mesadas: 'abierto' = solo la tapa (con lugar abajo, p. ej. para el lavarropas).
   * Bibliotecas: 'cerrado' = la parte de abajo tiene puertas.
   */
  abajo?: 'cerrado' | 'abierto';
  /**
   * Placard: cantidad de puertas (2 por defecto). Cómoda: cantidad de cajones (4).
   * Estantes: cantidad de tablas (3), repartidas de abajo hasta `alto`.
   */
  divisiones?: number;
  /**
   * Solo mesadas: bachas o piletas. `desplazamiento` va sobre el ancho, desde el centro:
   * positivo = hacia la derecha mirando la mesada de frente.
   */
  piletas?: { desplazamiento: number; ancho: number; profundidad: number }[];
}

export interface Colores {
  paredInterior: string;
  paredExterior: string;
  techo: string;
  /** Color del corte (cara superior de las paredes): da la lectura de "planta". */
  corte: string;
  marco: string;
  vidrio: string;
  puerta: string;
  umbral: string;
  terreno: string;
}

export interface Casa {
  nombre: string;
  /** Altura de techo general (m). */
  alturaTecho: number;
  /**
   * Hacia dónde está el norte real, medido en grados en sentido horario (visto desde arriba)
   * desde el "arriba" de la planta (−Z). 0 = el arriba de la planta es el norte.
   */
  norte: { grados: number } & ConTodo;
  /** Dirección desde la que mira la vista 3D inicial (desde el centro de la casa hacia la cámara). */
  vista3d?: { direccion: [number, number, number] };
  colores: Colores;
  ambientes: Ambiente[];
  paredes: Pared[];
  aberturas: Abertura[];
  entrepisos: Entrepiso[];
  escaleras: Escalera[];
  muebles: Mueble[];
  /** Pendientes generales que no son de un elemento puntual. */
  pendientes: string[];
}
