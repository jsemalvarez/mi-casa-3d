import { casa, PASILLO } from './casa';
import type { CajaElectrica, Circuito, Instalacion, LineaPrincipal, Luz, MedidaCanal, Punto2, Punto3, RecorridoCanal } from './tipos';

/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  INSTALACIÓN ELÉCTRICA — propuesta 1 (12/11/2026)
 *
 *  A la vista, con cable canal negro sobre paredes blancas. Criterio:
 *  - Todo el canal corre en una sola línea horizontal a 2,40 m, por encima de puertas
 *    (2,05) y ventanas (2,10) y por debajo de las vigas del cuarto 1 (2,55). De ahí baja
 *    derecho a cada caja y sube por el techo, entre viga y viga, hasta cada boca de luz.
 *  - Detrás de la mesada corre una segunda línea a 1,25 m (entre la mesada y la alacena),
 *    y en la oficina, otra a 1,00 m sobre su piso (sobre el escritorio).
 *  - Teclas a 1,10; tomas bajos a 0,35; tomas de mesada a 1,25.
 *  - Cuatro circuitos: luces, tomas de la cocina, tomas de lavadero / baño / patio y tomas
 *    de los cuartos y la oficina. Diferencial y termomagnéticas bipolares en el tablero.
 *
 *  Las coordenadas salen de las caras de los ambientes de `casa.ts`: si cambia una medida
 *  de la casa, la instalación se corre con ella. Todo lo supuesto lleva `todo`.
 *  Los metros de canal y cable, los accesorios y las cajas se calculan solos
 *  (`src/modelo/electrica.ts`) y se ven en el panel "Materiales".
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Caras de los ambientes ───────────────────────────────────────────────────
function limites(poli: Punto2[]) {
  const xs = poli.map((p) => p[0]);
  const zs = poli.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}
const amb = (id: string) => limites(casa.ambientes.find((a) => a.id === id)!.poligono);
const COC = amb('cocina');
const C1 = amb('cuarto1');
const C2 = amb('matrimonial');
const LAV = amb('lavadero');
const BAN = amb('banio');
const PAT = amb('patio');
const oficina = casa.entrepisos.find((e) => e.id === 'oficina')!;
const OF = { ...limites(oficina.poligono), nivel: oficina.nivel };

// ── Alturas ──────────────────────────────────────────────────────────────────
/** Línea principal de canal. */
const T = 2.4;
/** Línea detrás de la mesada de la cocina (entre la mesada a 0,90 y la alacena a 1,55). */
const MESADA = 1.25;
/** Línea de la oficina: 1,00 sobre su piso, encima del escritorio (0,75). */
const OFI = OF.nivel + 1.0;
const TECLA = 1.1;
const TOMA_BAJO = 0.35;

// ── Lugares que se usan en más de un elemento ────────────────────────────────
/** z del tablero (centro), en el frente de la cocina, entre la ventana y la puerta de entrada. */
const Z_TABLERO = 1.68;
/** Gabinete de 18 módulos en dos filas de 9. */
const TABLERO = { altura: 1.65, alto: 0.45, ancho: 0.3 };
/** El canal sale del tablero por arriba, en dos: hacia el cuarto 1 y hacia la mesada. */
const SALIDA_TABLERO = {
  y: TABLERO.altura + TABLERO.alto / 2,
  izq: Z_TABLERO - TABLERO.ancho / 2 + 0.05,
  der: Z_TABLERO + TABLERO.ancho / 2 - 0.05,
};
/** Cara del baño que da al patio (z). */
const Z_BANIO_PATIO = BAN.z0 - casa.paredes.find((w) => w.id === 'p-banio-patio')!.espesor;
/** Guirnalda del patio: altura de los ganchos y z de la caja donde se conecta (en la esquina del lavadero). */
const Y_GANCHOS = 2.35;
const Z_GUIRNALDA = PAT.z1 - 0.1;
/** z de las teclas de la puerta balcón; abajo, en la misma bajada, los tomas del comedor y del patio. */
const Z_TECLAS_PATIO = 2.9;
/** x de la toma del termotanque (adentro de la garita del patio; el cable sale del baño). */
const X_TERMOTANQUE = 7.0;
/** Canal de afuera, para las luces del pasillo: a 1,90 (los muros tienen 2,00). */
const Y_PASILLO = 1.9;
/** Agujero del frente de la cocina por donde sale el canal del pasillo (al lado de la ventanita). */
const Z_PASE_PASILLO = 4.25;
/** x de la cumbrera de la cocina (de ahí cuelgan las luces). */
const X_CUMBRERA = 1.75;
/** Agujero cocina → cuarto 1 (sobre la puerta granero) y subida a la oficina, al lado. */
const X_PASE_C1 = 3.0;
const X_SUBIDA_OF = 3.05;
/** Agujero cuarto 1 → cuarto 2, sobre la puerta plegable. */
const Z_PASE_C2 = -0.5;
/** Agujeros cocina → lavadero → baño, sobre las dos puertas. */
const Z_PASE_LAV = 3.45;
/** Hasta dónde llega el canal en la pared del cuarto 1 contra el cuarto 2 (para la luz de la escalera). */
const Z_ESCALERA = -2.1;
/** Tomas de la tele del cuarto 2, en la medianera. */
const Z_TV_C2 = -0.85;
/** Bajada de la línea de la mesada, en el frente, entre la ventanita y los estantes. */
const Z_BAJADA_MESADA = 4.35;
const X_FIN_MESADA = 1.95;
const X_CAMPANA = 2.61;
const X_TECLA_C2 = C2.x0 + 0.2;
const X_TECLA_OFICINA = OF.x1 - 0.1;
const X_FIN_BANIO = 6.5;
const X_LAVARROPAS_Z = 4.33;

// ── Circuitos ────────────────────────────────────────────────────────────────
const circuitos: Circuito[] = [
  { id: 'c1', nombre: 'Luces', tipo: 'IUG', seccion: 1.5, termica: 10, color: '#f2b84b' },
  { id: 'c2', nombre: 'Tomas de la cocina', tipo: 'TUG', seccion: 2.5, termica: 16, color: '#4f9de0' },
  {
    id: 'c3',
    nombre: 'Tomas de lavadero, baño y patio',
    tipo: 'TUG',
    seccion: 2.5,
    termica: 16,
    color: '#3fbfa5',
    todo: 'Separé el lavarropas de la cocina para que no salte la térmica con el lavarropas calentando agua, la pava y el microondas a la vez.',
  },
  {
    id: 'c4',
    nombre: 'Tomas de los cuartos y la oficina',
    tipo: 'TUG',
    seccion: 2.5,
    termica: 16,
    color: '#a77be6',
    todo: 'Si en la oficina hay mucha carga (dos PC, estufa o caloventor) conviene darle un circuito propio.',
  },
  {
    id: 'c5',
    nombre: 'Termotanque',
    tipo: 'TUE',
    seccion: 2.5,
    termica: 16,
    color: '#e0604f',
    todo: 'Circuito propio para el termotanque eléctrico de la garita. Con 2,5 mm² y térmica de 16 A alcanza para uno de hasta unos 3 kW; si es más potente, 4 mm² y 20 A. ¿De cuántos litros y watts es?',
  },
  {
    id: 'c6',
    nombre: 'Luces del pasillo',
    tipo: 'IUG',
    seccion: 1.5,
    termica: 10,
    color: '#9ccf5a',
    todo: 'Aparte de las luces de la casa: sumando las 4 del pasillo, el circuito de luces pasaba las 15 bocas.',
  },
];

// ── Tablero ──────────────────────────────────────────────────────────────────
const tablero: Instalacion['tablero'] = {
  id: 'tablero',
  nombre: 'Tablero',
  pared: 'p-cocina-frente',
  ambiente: 'cocina',
  en: Z_TABLERO,
  altura: TABLERO.altura,
  ancho: TABLERO.ancho,
  alto: TABLERO.alto,
  modulos: 18,
  todo: 'Supuse el tablero adentro, en la pared del frente entre la ventana y la puerta, arriba de la tele (de ahí sale todo el canal); la línea del medidor llega por afuera y entra justo debajo. Si hoy el tablero está en otro lado, se mueve y se recalcula todo.',
};

// ── Medidor y línea principal ────────────────────────────────────────────────
// Croquis del 12/11/2026: el medidor está en la vereda, al final de un pasillo de 2,40 m de ancho
// y 20 m de largo que arranca a la altura de la pared de abajo de la cocina (la del lateral). El
// borde del pasillo del lado de la casa queda 1,00 m hacia afuera del frente de la cocina, y el
// medidor está del otro lado del pasillo.
/** Cara de afuera del frente de la cocina (x) y de la pared de abajo (z). */
const X_FACHADA = PASILLO.fachadaX;
const Z_FACHADA_LATERAL = PASILLO.zInicio;
/** Caras interiores de los muros del pasillo y línea de la calle (ver `casa.ts`). */
const X_PASILLO_CASA = PASILLO.xCasa;
const X_PASILLO_OTRO = PASILLO.xOtro;
const Z_CALLE = PASILLO.zCalle;
/** Cara de adentro del muro de la calle. */
const Z_ADENTRO_CALLE = Z_CALLE - PASILLO.espesor;
/** La zanja va a 15 cm de las paredes. */
const SEPARACION = 0.15;

const lineaPrincipal: LineaPrincipal = {
  medidor: {
    // En un pilar, en la punta del muro del pasillo del otro lado de la casa, mirando a la calle.
    posicion: [X_PASILLO_OTRO - PASILLO.espesor / 2, Z_CALLE],
    altura: 1.4,
    todo: 'Ubicado según el croquis: en la línea de la calle, en la punta del muro del pasillo del lado opuesto a la casa. Altura supuesta.',
  },
  recorrido: [
    [X_PASILLO_OTRO + SEPARACION, Z_ADENTRO_CALLE - SEPARACION],
    [X_PASILLO_CASA - SEPARACION, Z_ADENTRO_CALLE - SEPARACION],
    [X_PASILLO_CASA - SEPARACION, Z_FACHADA_LATERAL - SEPARACION],
    [X_FACHADA - SEPARACION, Z_FACHADA_LATERAL - SEPARACION],
    [X_FACHADA - SEPARACION, Z_TABLERO],
  ],
  enterrada: true,
  profundidad: 0.6,
  seccion: 10,
  todo:
    'Supuse que va enterrada en caño a 60 cm, por el costado del pasillo que da a la casa, y que entra por la pared del frente justo debajo del tablero. ¿Hoy cómo llega: enterrada, por pared o aérea? La sección la define el electricista según la potencia contratada: puse 2 × 10 mm² porque con unos 30 m, en 6 mm² ya se pierde cerca de 2,6 % de tensión a 32 A.',
};

// ── Luces ────────────────────────────────────────────────────────────────────
// Bocas de techo entre viga y viga. En la cocina, tres colgantes en la viga de la cumbrera,
// en cadena (el canal va por abajo de la viga marrón).
/** Luces del pasillo de entrada (se definen al final de `luces`). */
const LUCES_PASILLO = ['l-pasillo-1', 'l-pasillo-2', 'l-pasillo-3', 'l-pasillo-4'];

const luces: Luz[] = [
  // Cocina-comedor
  {
    id: 'l-living',
    nombre: 'Colgante del living',
    tipo: 'colgante',
    circuito: 'c1',
    ambiente: 'cocina',
    techo: [X_CUMBRERA, 1.0],
    desde: [X_CUMBRERA, COC.z0],
    cuelga: 0.7,
    todo: 'Sobre el diván y la tele. ¿Colgante o plafón? Con colgantes, el canal va por debajo de la viga de la cumbrera.',
  },
  {
    id: 'l-mesa',
    nombre: 'Colgante de la mesa',
    tipo: 'colgante',
    circuito: 'c1',
    ambiente: 'cocina',
    techo: [X_CUMBRERA, 2.5],
    desde: 'l-living',
    cuelga: 1.35,
  },
  {
    // Sube por la pared de abajo hasta la cumbrera (más corto que seguir la cadena desde el living).
    id: 'l-cocina',
    nombre: 'Colgante de la cocina',
    tipo: 'colgante',
    circuito: 'c1',
    ambiente: 'cocina',
    techo: [X_CUMBRERA, 3.9],
    desde: [X_CUMBRERA, COC.z1],
    cuelga: 0.7,
  },
  {
    id: 'l-led-mesada',
    nombre: 'Tira de LED bajo la alacena',
    tipo: 'tira-led',
    circuito: 'c1',
    ambiente: 'cocina',
    pared: { pared: 'p-cocina-lateral', ambiente: 'cocina', en: 1.15, altura: 1.53 },
    largo: 2.3,
    todo: 'Opcional: luz de trabajo sobre la mesada, debajo de los estantes y la alacena, con su fuente de 12 V.',
  },
  {
    id: 'l-entrada',
    nombre: 'Aplique de la entrada',
    tipo: 'aplique-exterior',
    circuito: 'c1',
    ambiente: 'cocina',
    pared: { pared: 'p-cocina-frente', ambiente: 'cocina', en: 3.3, altura: 2.25, atraviesa: true },
    todo: 'Afuera, del lado del picaporte. El cable cruza la pared del frente.',
  },
  // Patio
  {
    id: 'l-patio-1',
    nombre: 'Aplique del patio (puerta balcón)',
    tipo: 'aplique-exterior',
    circuito: 'c1',
    ambiente: 'cocina',
    // Arriba del medio de la puerta balcón, para no quedar sobre la salida del calefactor.
    pared: { pared: 'p-cocina-patio', ambiente: 'cocina', en: 1.85, altura: 2.25, atraviesa: true },
  },
  {
    id: 'l-patio-2',
    nombre: 'Aplique del patio (pared del baño)',
    tipo: 'aplique-exterior',
    circuito: 'c1',
    ambiente: 'banio',
    pared: { pared: 'p-banio-patio', ambiente: 'banio', en: 5.8, altura: 2.25, atraviesa: true },
  },
  {
    // Dibujo del 12/11/2026: en zigzag de lado a lado del patio.
    id: 'l-guirnalda',
    nombre: 'Guirnalda del patio',
    tipo: 'guirnalda',
    circuito: 'c1',
    ambiente: 'patio',
    pared: { pared: 'p-cocina-patio', ambiente: 'cocina', en: Z_GUIRNALDA, altura: Y_GANCHOS, atraviesa: true },
    ganchos: [
      [PAT.x0, Z_GUIRNALDA], // esquina de la puerta del lavadero (ahí se conecta)
      [4.85, PAT.z0], // pared del cuarto 2
      [BAN.x0 + 0.12, Z_BANIO_PATIO], // esquina del baño
      [7.1, PAT.z0], // pared del cuarto 2, cerca de la medianera
    ],
    cuelga: 0.35,
    todo: 'Según tu dibujo: de la esquina de la puerta del lavadero a la pared del cuarto 2, a la esquina del baño y de vuelta a la pared del cuarto 2 (unos 9,5 m entre ganchos; las x de los ganchos son estimadas). Supuse los ganchos a 2,35 y que en el medio de cada tramo baja 35 cm (queda a 2,00). Se conecta en una caja estanca en la esquina y se prende con una tecla adentro, junto a las del patio.',
  },
  // Cuarto 1, escalera y oficina
  {
    id: 'l-cuarto1',
    nombre: 'Plafón del cuarto 1',
    tipo: 'plafon',
    circuito: 'c1',
    ambiente: 'cuarto1',
    techo: [2.19, -1.05],
    todo: 'Debajo de la oficina, entre la tercera y la cuarta viga, sobre el lugar libre entre la cucheta y el placard.',
  },
  {
    id: 'l-escalera',
    nombre: 'Aplique de la escalera',
    tipo: 'aplique',
    circuito: 'c1',
    ambiente: 'cuarto1',
    pared: { pared: 'p-cuarto1-cuarto2', ambiente: 'cuarto1', en: Z_ESCALERA, altura: 3.3 },
    todo: 'Sobre el descanso, a 1,90 de su piso. Se prende abajo (al lado de la puerta) y arriba (al llegar a la oficina) con llaves de combinación.',
  },
  {
    id: 'l-oficina',
    nombre: 'Plafón de la oficina',
    tipo: 'plafon',
    circuito: 'c1',
    ambiente: 'cuarto1',
    entrepiso: 'oficina',
    techo: [1.4, -1.35],
    desde: [1.4, C1.z1],
    todo: 'Sobre el escritorio, entre la primera y la segunda viga del techo. La tira de LED que ya tenés se enchufa en el toma de la punta del escritorio.',
  },
  // Cuarto 2
  {
    id: 'l-cuarto2',
    nombre: 'Plafón del cuarto 2',
    tipo: 'plafon',
    circuito: 'c1',
    ambiente: 'matrimonial',
    techo: [6.37, -1.35],
    desde: [6.37, C2.z0],
    todo: 'Al medio del cuarto hay una viga: lo corrí al espacio entre la tercera y la cuarta.',
  },
  // Lavadero y baño
  {
    id: 'l-lavadero',
    nombre: 'Plafón del lavadero',
    tipo: 'plafon',
    circuito: 'c1',
    ambiente: 'lavadero',
    techo: [4.5, 4.1],
  },
  {
    id: 'l-banio',
    nombre: 'Plafón del baño',
    tipo: 'plafon',
    circuito: 'c1',
    ambiente: 'banio',
    techo: [6.5, 3.85],
    desde: [6.5, BAN.z0],
  },
  {
    id: 'l-espejo',
    nombre: 'Aplique del espejo',
    tipo: 'aplique',
    circuito: 'c1',
    ambiente: 'banio',
    pared: { pared: 'p-banio-patio', ambiente: 'banio', en: 5.95, altura: 2.15 },
    todo: 'Depende de dónde va el espejo (sobre la pileta está la ventana). Lo puse a la izquierda de la ventana, como lugar provisorio.',
  },
  // Pasillo de entrada: apliques tipo tortuga cada 5,50 m sobre el muro del lado de la casa, el
  // último junto al portón. Se prenden y apagan desde la entrada y desde el portón (combinación).
  ...[2.5, 8.0, 13.5, 19.0].map(
    (d, k): Luz => ({
      id: `l-pasillo-${k + 1}`,
      nombre: `Aplique del pasillo ${k + 1}`,
      tipo: 'aplique-exterior',
      circuito: 'c6',
      ambiente: 'pasillo',
      pared: { pared: 'p-pasillo-este', ambiente: 'pasillo', en: Z_FACHADA_LATERAL + d, altura: 1.65 },
      todo:
        k === 0
          ? 'Cuatro apliques tipo tortuga cada 5,50 m, a 1,65, sobre el muro del lado de la casa. ¿Te parece o preferís balizas bajas o proyectores?'
          : undefined,
    }),
  ),
];

// ── Cajas de pared (teclas y tomas) ──────────────────────────────────────────
const toma = (circuito: string, uso?: string) => ({ tipo: 'toma' as const, circuito, uso });

const cajas: CajaElectrica[] = [
  // ── Cocina-comedor ──
  {
    id: 'k-entrada',
    nombre: 'Teclas de la entrada',
    pared: 'p-cocina-frente',
    ambiente: 'cocina',
    en: 2.27,
    altura: TECLA,
    modulos: [
      { tipo: 'tecla', luces: ['l-living'] },
      { tipo: 'tecla', luces: ['l-mesa'] },
      { tipo: 'tecla', luces: ['l-entrada'] },
      { tipo: 'combinacion', luces: LUCES_PASILLO, con: 'k-porton' },
    ],
    todo: 'Del lado de las bisagras, porque del lado del picaporte está el mueble del microondas. ¿La puerta abre del todo contra la pared? Si la tapa, conviene ponerlas arriba del mueble.',
  },
  {
    id: 'k-patio',
    nombre: 'Teclas de la puerta balcón',
    pared: 'p-cocina-patio',
    ambiente: 'cocina',
    en: Z_TECLAS_PATIO,
    altura: TECLA,
    modulos: [
      { tipo: 'tecla', luces: ['l-cocina'] },
      { tipo: 'tecla', luces: ['l-patio-1', 'l-patio-2'] },
      { tipo: 'tecla', luces: ['l-guirnalda'] },
    ],
  },
  {
    id: 't-tv',
    nombre: 'Tomas de la tele',
    pared: 'p-cocina-frente',
    ambiente: 'cocina',
    en: 2.05,
    altura: 0.8,
    modulos: [toma('c2', 'tele'), toma('c2', 'deco / router')],
    todo: 'Detrás de la tele, debajo del tablero. ¿El router de internet está acá?',
  },
  {
    id: 't-divan',
    nombre: 'Tomas del diván',
    pared: 'p-cocina-retiro',
    ambiente: 'cocina',
    en: 0.35,
    altura: 0.6,
    modulos: [toma('c2'), toma('c2')],
  },
  {
    id: 't-comedor',
    nombre: 'Tomas del comedor',
    pared: 'p-cocina-patio',
    ambiente: 'cocina',
    en: Z_TECLAS_PATIO,
    altura: TOMA_BAJO,
    modulos: [toma('c2'), toma('c2')],
    todo: 'Lo pasé abajo de las teclas del patio (misma bajada de canal), lejos del calefactor: el aire caliente sube y el canal y las cajas son de PVC. ¿Te sirve ahí?',
  },
  {
    id: 't-micro',
    nombre: 'Toma del microondas',
    pared: 'p-cocina-frente',
    ambiente: 'cocina',
    en: 3.5,
    altura: 1.72,
    modulos: [toma('c2', 'microondas')],
  },
  {
    id: 't-mesada-1',
    nombre: 'Tomas de la mesada (esquina)',
    pared: 'p-cocina-lateral',
    ambiente: 'cocina',
    en: 0.75,
    altura: MESADA,
    modulos: [{ tipo: 'tecla', luces: ['l-led-mesada'] }, toma('c2'), toma('c2')],
  },
  {
    id: 't-mesada-2',
    nombre: 'Tomas de la mesada (pileta)',
    pared: 'p-cocina-lateral',
    ambiente: 'cocina',
    en: X_FIN_MESADA,
    altura: MESADA,
    modulos: [toma('c2'), toma('c2')],
    todo: 'Entre la pileta y la cocina, a 30 cm del borde de la pileta.',
  },
  {
    id: 't-campana',
    nombre: 'Toma de la campana',
    pared: 'p-cocina-lateral',
    ambiente: 'cocina',
    en: X_CAMPANA,
    altura: 2.1,
    modulos: [toma('c2', 'campana')],
    todo: '¿La cocina es a gas con encendido eléctrico o luz en el horno? Si necesita toma, va abajo, al costado.',
  },
  {
    id: 't-heladera',
    nombre: 'Toma de la heladera',
    pared: 'p-cocina-lateral',
    ambiente: 'cocina',
    en: 3.2,
    altura: 1.85,
    modulos: [toma('c2', 'heladera')],
  },
  {
    id: 't-patio-ext',
    nombre: 'Toma exterior del patio',
    pared: 'p-cocina-patio',
    ambiente: 'cocina',
    // Del otro lado de la pared, a la misma altura que los tomas del comedor (cajas espalda con espalda).
    en: Z_TECLAS_PATIO,
    altura: TOMA_BAJO,
    atraviesa: true,
    modulos: [{ tipo: 'toma', circuito: 'c3', uso: 'exterior', exterior: true }],
    todo: 'Opcional (hidrolavadora, parrilla eléctrica, guirnaldas). Con tapa, apto exterior.',
  },
  {
    id: 'k-porton',
    nombre: 'Tecla del portón',
    pared: 'p-pasillo-este',
    ambiente: 'pasillo',
    en: Z_ADENTRO_CALLE - 0.45,
    altura: TECLA,
    modulos: [{ tipo: 'combinacion', luces: LUCES_PASILLO, con: 'k-entrada' }],
    todo: 'Combinación con la tecla de la entrada: se prende al entrar por el portón y se apaga en la casa (y al revés). Caja estanca, apta exterior. ¿O preferís sensor de movimiento o fotocélula?',
  },
  {
    id: 't-termotanque',
    nombre: 'Toma del termotanque',
    pared: 'p-banio-patio',
    ambiente: 'banio',
    en: X_TERMOTANQUE,
    altura: 1.2,
    atraviesa: true,
    modulos: [{ tipo: 'toma', circuito: 'c5', uso: 'termotanque', exterior: true }],
    todo: 'Adentro de la garita, con tapa; el cable sale del baño por un agujero en la pared. Si el termotanque pide más de 2 kW, va un toma de 20 A o una conexión fija con llave.',
  },

  // ── Cuarto 1 ──
  {
    id: 'k-cuarto1',
    nombre: 'Teclas del cuarto 1',
    pared: 'p-cocina-cuarto1',
    ambiente: 'cuarto1',
    en: 3.5,
    altura: TECLA,
    modulos: [
      { tipo: 'tecla', luces: ['l-cuarto1'] },
      { tipo: 'combinacion', luces: ['l-escalera'], con: 'k-oficina' },
    ],
  },
  {
    id: 't-cuarto1-puerta',
    nombre: 'Tomas del cuarto 1 (puerta)',
    pared: 'p-cuarto1-patio',
    ambiente: 'cuarto1',
    en: 3.9,
    altura: TOMA_BAJO,
    modulos: [toma('c4'), toma('c4')],
  },
  {
    id: 't-cuarto1-cucheta',
    nombre: 'Tomas del cuarto 1 (cucheta)',
    pared: 'p-cuarto1-frente',
    ambiente: 'cuarto1',
    en: -0.75,
    altura: TOMA_BAJO,
    modulos: [toma('c4'), toma('c4')],
    todo: 'Entre la ventana y el placard. ¿Hace falta uno en la cucheta (lámpara o cargador)? El canal no puede bajar por la ventana.',
  },

  // ── Oficina (alturas desde su piso) ──
  {
    id: 'k-oficina',
    nombre: 'Teclas de la oficina',
    pared: 'p-cuarto1-fondo',
    ambiente: 'cuarto1',
    entrepiso: 'oficina',
    en: X_TECLA_OFICINA,
    altura: 1.0,
    modulos: [
      { tipo: 'combinacion', luces: ['l-escalera'], con: 'k-cuarto1' },
      { tipo: 'tecla', luces: ['l-oficina'] },
    ],
    todo: 'Al llegar por la escalera, a la derecha. A 1,00 de su piso, en la misma línea que los tomas.',
  },
  {
    id: 't-oficina-1',
    nombre: 'Tomas del puesto 1',
    pared: 'p-cuarto1-frente',
    ambiente: 'cuarto1',
    entrepiso: 'oficina',
    en: -1.85,
    altura: 1.0,
    modulos: [toma('c4', 'PC'), toma('c4', 'monitor'), toma('c4', 'cargador')],
  },
  {
    id: 't-oficina-2',
    nombre: 'Tomas del puesto 2',
    pared: 'p-cuarto1-frente',
    ambiente: 'cuarto1',
    entrepiso: 'oficina',
    en: -1.05,
    altura: 1.0,
    modulos: [toma('c4', 'PC'), toma('c4', 'monitor'), toma('c4', 'cargador')],
  },
  {
    id: 't-oficina-3',
    nombre: 'Tomas de la punta del escritorio',
    pared: 'p-cuarto1-frente',
    ambiente: 'cuarto1',
    entrepiso: 'oficina',
    en: -0.4,
    altura: 1.0,
    modulos: [toma('c4', 'tira de LED'), toma('c4')],
  },

  // ── Cuarto 2 ──
  {
    id: 'k-cuarto2',
    nombre: 'Tecla del cuarto 2',
    pared: 'p-cuarto2-patio',
    ambiente: 'matrimonial',
    en: X_TECLA_C2,
    altura: TECLA,
    modulos: [{ tipo: 'tecla', luces: ['l-cuarto2'] }],
    todo: 'Entrando, a la derecha. ¿Querés prenderla también desde la cama (combinación)?',
  },
  {
    id: 't-cuarto2-izq',
    nombre: 'Tomas de la mesa de luz (izquierda)',
    pared: 'p-cuarto2-fondo',
    ambiente: 'matrimonial',
    en: 5.1,
    altura: 0.6,
    modulos: [toma('c4'), toma('c4')],
  },
  {
    id: 't-cuarto2-der',
    nombre: 'Tomas de la mesa de luz (derecha)',
    pared: 'p-cuarto2-fondo',
    ambiente: 'matrimonial',
    en: 6.9,
    altura: 0.6,
    modulos: [toma('c4'), toma('c4')],
  },
  {
    id: 't-cuarto2-tv',
    nombre: 'Tomas de la tele del cuarto 2',
    pared: 'p-cuarto2-medianera',
    ambiente: 'matrimonial',
    en: Z_TV_C2,
    altura: 1.25,
    modulos: [toma('c4', 'tele'), toma('c4', 'deco')],
  },

  // ── Lavadero ──
  {
    id: 'k-lavadero',
    nombre: 'Tecla del lavadero',
    pared: 'p-lavadero-patio',
    ambiente: 'lavadero',
    en: 4.6,
    altura: TECLA,
    modulos: [{ tipo: 'tecla', luces: ['l-lavadero'] }],
  },
  {
    id: 't-lavadero',
    nombre: 'Tomas del lavadero',
    pared: 'p-cocina-lavadero',
    ambiente: 'lavadero',
    en: X_LAVARROPAS_Z,
    altura: 1.15,
    modulos: [toma('c3', 'lavarropas'), toma('c3')],
    todo: 'Sobre la mesada, al costado de la alacena.',
  },

  // ── Baño ──
  {
    id: 'k-banio',
    nombre: 'Teclas del baño',
    pared: 'p-lavadero-banio',
    ambiente: 'banio',
    en: Z_PASE_LAV,
    altura: TECLA,
    modulos: [
      { tipo: 'tecla', luces: ['l-banio'] },
      { tipo: 'tecla', luces: ['l-espejo'] },
    ],
    todo: 'Adentro, al lado del marco de la puerta (queda muy justo: hay 10 cm hasta la esquina). ¿O la preferís afuera, en el lavadero?',
  },
  {
    id: 't-banio',
    nombre: 'Toma del baño',
    pared: 'p-patio-banio',
    ambiente: 'banio',
    en: 3.15,
    altura: 1.15,
    modulos: [toma('c3', 'secador')],
    todo: 'Sobre la punta de la mesada, lejos de la ducha.',
  },
];

// ── Recorridos de cable canal ────────────────────────────────────────────────
const p3 = (x: number, y: number, z: number): Punto3 => [x, y, z];

// Del tablero, las cajas y las luces al canal no hace falta dibujar nada: se conectan solos.
const canales: RecorridoCanal[] = [
  {
    // Sale del tablero por la izquierda: frente → pared del cuarto 1 → pared del patio y del
    // lavadero → pared de abajo hasta la cumbrera (de ahí sube el colgante de la cocina).
    id: 'canal-cocina-1',
    nombre: 'Cocina (vuelta por el patio)',
    puntos: [
      p3(COC.x0, SALIDA_TABLERO.y, SALIDA_TABLERO.izq),
      p3(COC.x0, T, SALIDA_TABLERO.izq),
      p3(COC.x0, T, COC.z0),
      p3(COC.x1, T, COC.z0),
      p3(COC.x1, T, COC.z1),
      p3(X_CUMBRERA, T, COC.z1),
    ],
    todo: 'En la pared de abajo pasa a 2,40 por encima de la campana: si la campana tiene chimenea, hay que esquivarla.',
  },
  {
    // Sale del tablero por la derecha hacia la mesada: baja entre la ventanita y los estantes y
    // sigue detrás de la mesada.
    id: 'canal-cocina-2',
    nombre: 'Cocina (frente y mesada)',
    puntos: [
      p3(COC.x0, SALIDA_TABLERO.y, SALIDA_TABLERO.der),
      p3(COC.x0, T, SALIDA_TABLERO.der),
      p3(COC.x0, T, Z_BAJADA_MESADA),
      p3(COC.x0, MESADA, Z_BAJADA_MESADA),
      p3(COC.x0, MESADA, COC.z1),
      p3(X_FIN_MESADA, MESADA, COC.z1),
    ],
  },
  {
    id: 'canal-cuarto1',
    nombre: 'Cuarto 1 y escalera',
    puntos: [
      p3(X_PASE_C1, T, COC.z0), // agujero desde la cocina
      p3(X_PASE_C1, T, C1.z1),
    ],
  },
  {
    id: 'canal-cuarto1-pared',
    nombre: 'Cuarto 1 (paredes)',
    puntos: [
      p3(C1.x0, T, -0.75),
      p3(C1.x0, T, C1.z1),
      p3(C1.x1, T, C1.z1),
      p3(C1.x1, T, Z_ESCALERA),
    ],
  },
  {
    // Sube por la pared de la cocina en el hueco de la escalera y entra a la oficina por arriba de la ventana.
    id: 'canal-oficina',
    nombre: 'Oficina',
    puntos: [
      p3(X_SUBIDA_OF, T, C1.z1),
      p3(X_SUBIDA_OF, OFI, C1.z1),
      p3(C1.x0, OFI, C1.z1),
      p3(C1.x0, OFI, C1.z0),
      p3(X_TECLA_OFICINA, OFI, C1.z0),
    ],
    todo: 'Pasa al lado del primer listón de la baranda. ¿Se puede, o conviene subir por otro lado?',
  },
  {
    id: 'canal-cuarto2',
    nombre: 'Cuarto 2',
    puntos: [
      p3(C1.x1, T, Z_PASE_C2), // agujero desde el cuarto 1
      p3(C2.x0, T, Z_PASE_C2),
    ],
  },
  {
    id: 'canal-cuarto2-pared',
    nombre: 'Cuarto 2 (paredes)',
    puntos: [
      p3(X_TECLA_C2, T, C2.z1),
      p3(C2.x0, T, C2.z1),
      p3(C2.x0, T, C2.z0),
      p3(C2.x1, T, C2.z0),
      p3(C2.x1, T, Z_TV_C2),
    ],
  },
  {
    id: 'canal-lavadero-pase',
    nombre: 'Lavadero',
    puntos: [
      p3(COC.x1, T, Z_PASE_LAV), // agujero desde la cocina
      p3(LAV.x0, T, Z_PASE_LAV),
    ],
  },
  {
    id: 'canal-lavadero-banio',
    nombre: 'Lavadero y baño',
    puntos: [
      p3(LAV.x0, T, X_LAVARROPAS_Z),
      p3(LAV.x0, T, LAV.z0),
      p3(LAV.x1, T, LAV.z0),
      p3(LAV.x1, T, Z_PASE_LAV),
      p3(BAN.x0, T, Z_PASE_LAV), // agujero al baño
      p3(BAN.x0, T, BAN.z0),
      p3(X_FIN_BANIO, T, BAN.z0),
      p3(X_TERMOTANQUE, T, BAN.z0), // bajada al agujero de la garita
    ],
  },
  {
    id: 'canal-pasillo',
    nombre: 'Frente y pasillo (afuera)',
    puntos: [
      p3(COC.x0, T, Z_PASE_PASILLO),
      p3(X_FACHADA, T, Z_PASE_PASILLO), // agujero al frente
      p3(X_FACHADA, Y_PASILLO, Z_PASE_PASILLO),
      p3(X_FACHADA, Y_PASILLO, Z_FACHADA_LATERAL),
      p3(X_PASILLO_CASA, Y_PASILLO, Z_FACHADA_LATERAL),
      p3(X_PASILLO_CASA, Y_PASILLO, Z_ADENTRO_CALLE - 0.35),
    ],
    todo: 'Va a la intemperie: conviene canal apto exterior (con filtro UV) o caño rígido, y cajas estancas. En el cómputo lo conté como canal común.',
  },
];

/**
 * Medidas de canal: la capacidad es la mitad de la sección interior (en el canal los cables se
 * apoyan, no se pasan tirando como en un caño). En un 20 × 10 entran unos 7 cables de 2,5 mm² o
 * 10 de 1,5 mm².
 */
const medidas: MedidaCanal[] = [
  { nombre: '20 × 10 mm', ancho: 0.02, alto: 0.01, capacidad: 77 },
  { nombre: '40 × 16 mm', ancho: 0.04, alto: 0.016, capacidad: 250 },
];

export const instalacion: Instalacion = {
  tablero,
  lineaPrincipal,
  circuitos,
  luces,
  cajas,
  canales,
  medidas,
  seccionTierra: 2.5,
  diferencial: { amperes: 40, sensibilidad: 30 },
  pendientes: [
    'Propuesta para charlar, no un proyecto firmado: el electricista matriculado tiene que revisar circuitos, secciones y protecciones (y hacer el certificado si lo pide la distribuidora).',
    'Supuse que se rehace toda la instalación a la vista y que no hay aire acondicionado: sumaría un circuito propio (TUE). El calefactor es a gas y el termotanque eléctrico tiene su circuito.',
    'Falta confirmar con el electricista la sección de la línea principal, la protección junto al medidor y la puesta a tierra (jabalina, cerca del tablero).',
    'Medidas de canal según la marca: conviene elegir una que tenga en negro el canal, los accesorios (ángulos, T, tapas) y las cajas, porque no se mezclan entre marcas.',
  ],
};
