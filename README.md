# Mi casa 3D

Web para ver la casa en 3D mientras se reforma. Sirve para planificar la instalación eléctrica y para probar
colores, muebles e iluminación antes de hacerlos.

Hecha con **Vite + React + TypeScript + React Three Fiber** (y drei para cámaras y controles).
**Todo lo de la casa está en datos** (`src/data/`): cambiar la casa es cambiar un dato, no un componente.

## Estado

| Fase | Contenido | Estado |
| --- | --- | --- |
| 1 | Modelo de datos, paredes, aberturas, pisos, cámaras | ✅ hecha |
| 2 | Luces con encendido/apagado y modo día/noche | pendiente |
| 3 | Cable canal y puntos eléctricos | pendiente |
| 4 | Muebles | cargados en todos los ambientes (de las fotos); faltan medidas con cinta |
| 5 | Escenarios (con URL propia) y panel de edición | pendiente |

> ⚠️ La distribución sale del croquis a mano (11/11/2026). Las medidas de los ambientes son las reales;
> las posiciones de puertas y ventanas están estimadas del dibujo. Todo lo supuesto lleva un `todo` en
> los datos y aparece en el panel **Pendientes** de la web (botón arriba a la derecha).

## Cómo correrlo

```bash
npm install
npm run dev
```

Abrí `http://localhost:5173`. Para verlo en el celular (misma red Wi-Fi), usá la dirección "Network" que
muestra la consola, por ejemplo `http://192.168.1.60:5173`.

```bash
npm run build     # chequea tipos y arma dist/
npm run preview   # sirve dist/ para probar el build
```

### Deploy en Vercel

Todavía no está conectado. Cuando el repo esté en GitHub: en Vercel → *Add New Project* → importar el repo.
Vercel detecta Vite solo (build `npm run build`, salida `dist`). Cada push a `main` publica.

## Vistas y controles

| Vista | Qué muestra | PC | Celular |
| --- | --- | --- | --- |
| **3D** | La casa entera, orbitando | arrastrar = rotar · rueda = zoom · botón derecho = mover | 1 dedo = rotar · 2 dedos = zoom / mover |
| **Planta** | Vista desde arriba, ortogonal, paredes cortadas a 1,20 m | arrastrar = mover · rueda = zoom | 1 dedo = mover · pellizcar = zoom |
| **Paredes** | Vista de frente de cada pared de cada ambiente y de cada fachada. Muestra solo el ambiente y lo que está hasta 1,30 m delante de la pared (muebles contra ella) | igual que planta · ◀ ▶ cambia de pared | igual |
| **Recorrido** | Primera persona a 1,60 m, con choques contra paredes y muebles. Se sube a la oficina por la escalera; se puede arrancar en cualquier ambiente o en la oficina | arrastrar = mirar · W A S D / flechas = caminar · Shift = correr | arrastrar = mirar · joystick = caminar |

- **Paredes bajas** (en 3D): corta las paredes a 1,20 m para ver adentro.
- **Oficina** (en 3D y planta): corta a 1,20 m sobre el piso de la oficina para verla por dentro. En
  planta muestra la planta alta.
- **Nombres**: muestra u oculta las etiquetas de los ambientes.
- **Centrar**: vuelve a encuadrar.
- En celulares en vertical la planta se gira 90° para aprovechar la pantalla; la flecha **N** indica el norte.

## Sistema de coordenadas

- **Unidades:** metros (y grados para ángulos).
- **Origen (0, 0, 0):** esquina interior **de arriba a la izquierda de la cocina-comedor** (entre la
  pared del frente y la pared hacia el cuarto 1), a nivel de piso terminado.
- **Ejes** (con la planta orientada como el croquis: frente con la entrada a la izquierda, cuartos arriba):
  - **X → derecha**: del frente hacia la medianera.
  - **Z → abajo**: de los cuartos hacia el lateral de abajo.
  - **Y → arriba**.
- Los puntos en planta se escriben `[x, z]`.
- "Norte del plano" = −Z (arriba en la planta). El norte real se configura en `casa.norte.grados`
  (sentido horario desde el arriba de la planta). **Hoy está en 0 como supuesto (TODO).**

```
                 −Z (arriba del plano: cuartos)
                  ▲
    frente        │   (0,0) = esquina interior de arriba a la izquierda de la cocina
    −X ◄──────────┼──────────► +X (hacia la medianera)
                  │
                  ▼
                 +Z (abajo del plano: lateral)
```

## Estructura del proyecto

```
src/
  data/
    tipos.ts        ← tipos del modelo (qué campos tiene cada cosa)
    casa.ts         ← LA CASA: ambientes, paredes, aberturas, entrepiso, colores
    escenarios/     ← (fase 5) variantes que guardan solo lo que cambia
  modelo/
    geometria.ts    ← uniones de paredes, piezas alrededor de aberturas, vistas de frente
    techos.ts       ← techos inclinados: faldones, alturas y hastiales
    colisiones.ts   ← choques del recorrido
    pendientes.ts   ← junta los `todo` para el panel
  escena/           ← componentes 3D (solo dibujan lo que dicen los datos)
  ui/               ← barras, panel de pendientes, joystick
  estado.ts         ← estado de la interfaz (zustand)
```

## Modelo de datos

Definido en [`src/data/tipos.ts`](src/data/tipos.ts). La casa ([`src/data/casa.ts`](src/data/casa.ts)) tiene:

| Colección | Qué es | Campos principales |
| --- | --- | --- |
| `ambientes` | Cocina, cuartos, patio… | `id`, `nombre`, `poligono` (contorno interior), `piso.color`, `colorParedes?`, `colorTecho?`, `alturaTecho?`, `techo?` (inclinado: a dos aguas o a un agua), `exterior?` |
| `paredes` | Muros rectos | `id`, `a`, `b` (eje), `espesor`, `alto?`, `colorIzq?`, `colorDer?` |
| `aberturas` | Puertas, ventanas, vanos | `id`, `pared`, `tipo`, `desde`, `ancho`, `alto`, `antepecho?`, `hoja?`, `hojas?` |
| `entrepisos` | Pisos elevados (la oficina del entretecho) | `id`, `poligono`, `nivel` (cara de arriba del piso), `espesor`, `color` (el piso), `colorAbajo?` (el techo del ambiente de abajo), `alturaLibre?`, `barandas?`, `altoBaranda?`, `separacionBaranda?`, `vigas?` (`ejes`, `ancho`, `alto`, `color?`: cuelgan debajo del piso) |
| `escaleras` | Escaleras de tramos rectos | `id`, `tramos` (`desde`, `hasta`, `ancho`, `alturaDesde`, `alturaHasta`, `escalones`, `baranda?`), `descansos?` |
| `muebles` | Muebles y artefactos como volúmenes simples | `id`, `nombre`, `tipo`, `centro`, `ancho`, `profundidad`, `alto`, `giro?`, `elevacion?`, `color?` |

Además: `alturaTecho` (2,70), `norte`, `vista3d` (desde dónde mira la vista 3D al abrir), `colores`
(paredes, techo, marcos, vidrio…) y `pendientes` (notas generales).

Un ambiente con `exterior: true` (como el **patio interno**) no lleva techo, pero tiene sus propias vistas
de pared. Las fachadas son solo las caras que dan afuera del lote.

**Pisos altos.** La oficina es un `entrepiso` dentro del cuarto 1: el cuarto tiene `alturaTecho` 4,80 y sus
paredes `alto: ALTO_CUARTO1`, y la oficina es un piso a 2,80 sobre parte de su planta. Los muebles de
arriba llevan `elevacion` = nivel de la oficina. Una pared puede tener aberturas encimadas (la puerta
granero abajo y la ventana de la oficina arriba, en la misma pared).

**Techos inclinados.** Un ambiente con `techo` tiene el techo inclinado en lugar del plano de
`alturaTecho`. La `cumbrera` es la línea más alta: si pasa por adentro del ambiente, el techo es **a dos
aguas** (la cocina); si va sobre la cara de una pared, es **a un agua** y cae hacia el otro lado (todos los
demás).

| Campo | Qué es |
| --- | --- |
| `cumbrera` | línea más alta, en planta, de una pared a la otra (de esquina a esquina si es a un agua) |
| `alturaCumbrera`, `alturaBorde` | altura de la cara de abajo de las tablas en la cumbrera y donde apoyan en las paredes bajas |
| `viga?` | viga grande a lo largo de la cumbrera: `ancho`, `alto`, `color` |
| `vigasChicas?` | vigas de cada faldón, en el sentido de la caída: `porLado` (en un techo a un agua, el total), `ancho`, `alto`, `color` y `extremos?`: `'contra-paredes'` (por defecto, la primera y la última pegadas a las paredes) o `'separadas'` (todas a la misma distancia, con media distancia hasta cada pared) |

Las paredes que quedan debajo suben solas hasta el techo (en punta o en pendiente): no hace falta
cambiarles el `alto`. Las vistas de pared de ese ambiente llegan hasta la cumbrera, y en planta las vigas
se ven translúcidas (sirve para ubicar las bocas de luz entre viga y viga).

```ts
// A dos aguas (la cocina)
techo: {
  cumbrera: [[1.75, 0], [1.75, 4.8]], alturaBorde: 2.7, alturaCumbrera: 3.1,
  viga: { ancho: 0.1, alto: 0.2, color: '#6b3a24' },
  vigasChicas: { porLado: 7, ancho: 0.075, alto: 0.15, color: '#e9e7e1' },
},
// A un agua: en casa.ts está `unAgua(bordeAlto, profundidad, alturaBaja, vigas)`, que usa la
// pendiente supuesta (`PENDIENTE`). Ej.: el cuarto 2, alto contra el fondo y bajo contra el patio.
techo: unAgua([[C2.x0, C2.z0], [C2.x1, C2.z0]], C2.z1 - C2.z0, 2.7, 5),
```

Todos los elementos aceptan **`todo: '...'`**: marca el dato como provisorio y lo muestra en **Pendientes**.

### Paredes

- Se definen por su **eje** (línea media) de `a` a `b`, con su `espesor`.
- **Las uniones se resuelven solas.** En una esquina en L, la primera pared de la lista se alarga y la otra
  se recorta. En un encuentro en T, la pared que llega se recorta hasta la cara de la otra (si las que
  siguen de largo tienen distinto espesor, hasta la más delgada).
- **Partí las paredes en cada encuentro**, así cada lado da a un solo ambiente. Eso permite pintar cada cara
  por separado y nombrar bien las vistas. Si un lado toca dos ambientes, aparece una advertencia en
  Pendientes.
- **Izquierda / derecha** se miran parados en `a`, mirando hacia `b`.
- **Color de una cara**, de mayor a menor prioridad: `colorIzq` / `colorDer` de la pared → `colorParedes`
  del ambiente → `colores.paredInterior` (o `paredExterior` si da afuera).

### Aberturas

- `pared`: id de la pared donde está.
- `tipo`: `'puerta'` (con hoja de abrir), `'puerta-balcon'` (vidriada, cerrada), `'ventana'` o `'vano'`
  (hueco sin puerta).
- `desde`: distancia **sobre el eje de la pared desde el punto `a`** hasta el borde más cercano de la
  abertura. Ojo: el punto `a` está en el eje, así que si medís desde la esquina interior sumá medio espesor
  de la pared perpendicular. Para no hacer la cuenta, en `casa.ts` están `desdeX(pared, x)` y
  `desdeZ(pared, z)`: le pasás la coordenada donde empieza la abertura.
  Ejemplo: `desde: desdeZ(p('p-cocina-patio'), 0.95)` pone la puerta balcón desde z = 0,95, o sea a 0,95 m
  de la esquina interior de la cocina.
- `antepecho`: altura del borde inferior (0 en puertas). `alto`: altura del hueco.
- `color` (solo puertas): color de la hoja; si falta, usa `colores.puerta`.
- `hoja` (solo puertas) dice cómo abre. Los extremos `'a'` / `'b'` son los bordes de la abertura más
  cercanos al punto `a` o `b` de la pared:

  | Tipo | Campos | Cómo se dibuja |
  | --- | --- | --- |
  | De abrir (por defecto) | `bisagra: 'a' \| 'b'`, `abreHacia: 'izq' \| 'der'` | hoja abierta a 90° y arco en planta |
  | `tipo: 'plegable'` | `juntaHacia: 'a' \| 'b'` | acordeón juntado contra ese costado |
  | `tipo: 'granero'` | `lado: 'izq' \| 'der'` (de qué lado cuelga), `correHacia: 'a' \| 'b'` | hoja corrida sobre la pared, riel arriba y, en planta, la posición cerrada en trazos |

  Sirve para la instalación eléctrica: la llave va del lado del picaporte, y donde queda corrida una puerta
  granero no se puede poner nada en la pared.

## Cómo agregar…

### …un ambiente

1. En `casa.ts`, agregá un objeto en `ambientes` con un `id` nuevo y su `poligono` por las **caras
   interiores** de las paredes. Para rectángulos usá `rect(x0, z0, x1, z1)`.
2. Agregá sus paredes en `paredes` (ejes a medio espesor de las caras), partidas en cada encuentro.
3. Si comparte una pared existente que ahora tiene dos ambientes de un lado, partí esa pared en dos.
4. Mirá **Pendientes**: si algo no cierra (un lado que toca dos ambientes, una abertura fuera de su pared),
   aparece como advertencia.

```ts
// Ejemplo (coordenadas inventadas): un depósito de 1,50 × 1,20
{ id: 'deposito', nombre: 'Depósito', poligono: rect(5.0, 0.15, 6.5, 1.35), piso: PISO_HUMEDO, todo: 'Ejemplo' },
```

### …una pared o una abertura

```ts
// Pared nueva (eje de (0, 1.2) a (2, 1.2), 0,10 de espesor: un tabique)
{ id: 'p-tabique-cocina', a: [0, 1.2], b: [2, 1.2], espesor: 0.1 },

// Puerta de 0,80 a 0,30 del punto `a`, que abre hacia la izquierda con bisagras del lado `a`
{ id: 'a-puerta-nueva', pared: 'p-tabique-cocina', tipo: 'puerta', desde: 0.3, ancho: 0.8, alto: 2.05,
  hoja: { bisagra: 'a', abreHacia: 'izq' } },

// La misma, pero plegable que se junta del lado `b`, o granero colgada a la derecha que corre hacia `a`
  hoja: { tipo: 'plegable', juntaHacia: 'b' },
  hoja: { tipo: 'granero', lado: 'der', correHacia: 'a' },

// Ventana de 1,20 × 1,10 con antepecho de 0,90 que arranca en x = 5,40
{ id: 'a-ventana-nueva', pared: 'p-cuarto2-patio', tipo: 'ventana',
  desde: desdeX(p('p-cuarto2-patio'), 5.4), ancho: 1.2, alto: 1.1, antepecho: 0.9 },
```

### …un mueble

Agregá un objeto en `muebles` (en `casa.ts`):

- `centro`: `[x, z]` del centro del mueble en planta.
- `ancho` × `profundidad` × `alto`: medidas reales. El **frente** es el lado de la profundidad que da al
  ambiente; la espalda va contra la pared.
- `giro`: hacia dónde mira el frente en la planta. `0` = abajo, `90` = izquierda, `180` = arriba,
  `270` = derecha.
- `elevacion`: para lo que no apoya en el piso (alacenas, microondas, tele). La planta los muestra
  translúcidos.
- `tipo`: `'caja'` (volumen simple) o uno con forma propia:

  | Tipo | Extras |
  | --- | --- |
  | `mesada` | `piletas`, `colorTapa`, `abajo: 'abierto'` si hay lugar debajo |
  | `cama` | si es más profunda que ancha, la cabecera va en la espalda y lleva almohadas |
  | `cucheta` | `color` = marco, `colorTapa` = colchones; la escalera va del lado izquierdo mirándola de frente |
  | `biblioteca` | estantes abiertos cada ~35 cm; `abajo: 'cerrado'` = puertas en la parte de abajo. Sirve también para estantes de pared (con `elevacion`) |
  | `placard` | `divisiones` = cantidad de puertas (2) |
  | `comoda` | `divisiones` = cantidad de cajones (4) |
  | `perchero` | `colorTapa` = la ropa colgada |
  | `estantes` | tablas sueltas sin laterales; `divisiones` = cantidad de tablas (3), repartidas de abajo hasta `alto` |
  | `campana` | campana / extractor, con el filtro abajo |
  | `mesa-pizza` | tapa redonda de vidrio (diámetro = `ancho`) sobre base de madera (`colorTapa`) |
  | `silla-pizza` | cuarto de círculo: `profundidad` = radio, `ancho` = abertura del gajo; el vértice es el frente (hacia el centro de la mesa). `colorTapa` = patas |
  | `heladera`, `cocina`, `lavarropas`, `microondas`, `inodoro`, `bidet`, `ducha`, `mesa`, `silla`, `sillon`, `escritorio`, `tv` | — |
- `contraAbajo(cara, profundidad)` calcula el `z` del centro para algo apoyado contra la pared de abajo.

```ts
// Ejemplo: placard de 3 puertas de 1,50 × 0,60 × 2,40 contra la pared del fondo, mirando hacia abajo
{ id: 'm-placard', nombre: 'Placard', tipo: 'placard', divisiones: 3, ambiente: 'matrimonial',
  centro: [6.0, -2.55 + 0.3], ancho: 1.5, profundidad: 0.6, alto: 2.4, giro: 0, todo: 'Medidas a confirmar' },
```

Los muebles a la altura del cuerpo frenan en el recorrido (las alacenas no; el plato de ducha tampoco).

### …una luz

Llega en la fase 2; esta sección se completa ahí.

## Distribución: qué sale del croquis y qué es supuesto

Del croquis (11/11/2026):

- Cuarto 1 (3,40 × 2,40) y cuarto 2 / matrimonial (3,00 × 2,40) arriba; cocina-comedor (3,50 × 4,80)
  abajo a la izquierda, con la **entrada** y dos ventanas en el frente.
- **Patio interno** entre la cocina, el cuarto 2 y el baño. La puerta balcón de la cocina da al patio: a su
  izquierda la puerta al cuarto 1 y a su derecha la del lavadero, como habías descrito.
- Lavadero (1,70 × 1,40) con puerta al patio; baño (2,00 × 1,90) al que se entra desde el lavadero, con
  ventana al patio. Al cuarto 2 se entra desde el cuarto 1 y tiene ventana al patio.
- Puertas (confirmado): cocina → cuarto 1 granero, colgada del lado de la cocina y que corre hacia el
  frente; cocina → lavadero plegadiza de acordeón que se junta del lado de la heladera; cuarto 1 → cuarto 2
  plegable; lavadero → baño abre hacia el lavadero con las bisagras del lado de la pared de abajo;
  lavadero → patio abre hacia el patio con las bisagras del lado del baño; entrada con las bisagras del
  lado del cuarto 1.
- Muebles (de las fotos y del croquis del baño, 12/11/2026):
  - Cocina: contra la pared de abajo, heladera, cocina con horno y la mesada **en L** con la pileta. La L
    dobla en la esquina y sigue por el frente hasta el mueble del microondas (la vuelta tiene estantes de
    madera abajo). Arriba (confirmado): la campana sobre la cocina, la alacena de 1,20 y tres estantes
    desde la alacena hasta la pared de la ventana. Contra el frente, el mueble del microondas y el rack con la
    tele. Contra la pared del cuarto 1, el diván. En el medio, la mesa pizza de vidrio con sus 4 sillas
    en cuarto de círculo, dibujadas guardadas debajo.
  - Puertas (confirmado): la de entrada y la plegable de la cocina son blancas; la granero, gris.
  - Lavadero: mesada de lado a lado con el lavarropas abajo, la pileta del lado del baño y la alacena
    arriba.
  - Baño: mesada con pileta contra la pared del patio; inodoro, bidet y ducha contra la pared de abajo.
    En el croquis del baño, la pared del lavadero (con la puerta) está arriba.
  - Cuarto 1: la cucheta contra la pared del fondo, con su estante en la cabecera, del lado de la
    ventana (los pies quedan debajo de la escalera). El placard y la biblioteca contra la pared de la
    cocina, en la esquina del frente; la biblioteca termina donde arranca la puerta.
  - Cuarto 2: contra la pared del cuarto 1, el perchero con un estante arriba. La cama con la cabecera
    contra la pared del fondo y los pies hacia la ventana, sin tocarla (confirmado). Contra la
    medianera, de la esquina del fondo hacia el patio: la cajonera blanca, el ropero blanco y la cómoda
    con la tele.
- **Oficina en el entretecho** (croquis y fotos, 12/11/2026): arriba del cuarto 1, de 2,00 m de alto.
  Ocupa los 2,00 m del lado del frente por toda la profundidad. Los 1,40 restantes, del lado de las
  puertas, son el hueco de la escalera: en L, sube contra la pared del cuarto 2, descansa en la esquina del
  fondo y llega contra la pared del fondo. El borde de la oficina tiene listones de piso a techo. El
  piso son tablas sobre cinco vigas de madera que van de la pared de la cocina a la del fondo, desde la
  pared del frente hasta el borde (foto del techo del cuarto 1). La
  ventana baja da sobre el techo de la cocina. El escritorio ocupa los 2,40 de la pared del frente, con
  dos monitores y dos sillas (confirmado; el sillón se saca).
- **Techo de la cocina a dos aguas** (foto, 12/11/2026): un faldón cae hacia la calle y el otro hacia el
  patio interno, con la cumbrera a lo largo (de la pared del cuarto 1 a la de abajo). Tablas blancas,
  7 vigas chicas blancas por lado (tu conteo) y la viga grande marrón en la cumbrera. La pared de abajo y
  el tramo del frente contra el cuarto 1 suben en punta hasta el techo.
- **Techo del cuarto 1** (pedido): las tablas de abajo de la oficina y sus vigas, pintadas de blanco.
- **Techos a un agua** (marcados en el plano, 12/11/2026), con las vigas en el sentido de la caída: la
  oficina y el hueco de la escalera (5 vigas) caen hacia el techo de la cocina; el cuarto 2 (5), el
  lavadero (2, separadas de las paredes) y el baño (4) caen hacia el patio interno.
- **Medianera derecha recta y escalón en el frente** (confirmado): abajo las medidas suman 7,50 m con
  paredes y arriba 6,55 m, así que la cocina sobresale 0,95 m respecto del cuarto 1. Por eso la pared
  cocina | patio queda 0,85 m corrida de la pared entre los cuartos.

Supuestos (todos marcados `todo`):

- Posición exacta y medida de puertas y ventanas, alturas y antepechos: estimados del croquis.
- Si la plegable entre los cuartos es de acordeón o de dos hojas y hacia qué lado se junta; si la
  puerta de entrada abre hacia adentro.
- Posición y medidas de los muebles (a ojo de las fotos, con medidas típicas).
- Fondo, medianera derecha y lateral de abajo sin aberturas.
- Espesores: 0,20 frente y medianeras, 0,15 interiores. Puertas de 2,05 de alto.
- Altura total del cuarto 1: 4,80 (2,70 + 0,10 de piso de madera + 2,00 de oficina). Los 2,70, hasta
  las tablas; las vigas (0,075 × 0,15, supuesto) cuelgan debajo, a 2,55.
- Techo de la cocina: cumbrera al medio, tablas a 2,70 sobre el frente y la pared del patio y a 3,10 en la
  cumbrera; viga marrón de 0,10 × 0,20 y vigas chicas de 0,075 × 0,15.
- Techos a un agua: 12 % de pendiente; del lado bajo, 2,70 (la oficina, 2,00 sobre su piso); tablas y
  vigas blancas.
- Escalera: 5 + 5 escalones y el descanso a 1,40.
- Oficina: posición exacta y medidas de la ventana; profundidad del escritorio y lugar de cada monitor
  (estimados de las fotos).
- Cuartos: medidas de todos los muebles (típicas); el tercer colchón a los pies de la cucheta y el
  mueble blanco bajo del cuarto 2 sin definir.
- Norte real desconocido.

## Notas técnicas

- **drei se importa de a un componente** (`src/escena/drei.ts`) y se excluye del pre-empaquetado de Vite en
  desarrollo. En esta PC el antivirus borraba el archivo pre-empaquetado de drei (3,7 MB) de
  `node_modules/.vite` y el servidor respondía 504. El build de producción no se ve afectado.
- Las etiquetas de los ambientes son DOM común, posicionado en cada cuadro desde la escena
  (`src/escena/Etiquetas.tsx`).
