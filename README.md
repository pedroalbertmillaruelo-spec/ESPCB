# ESPCB — prototipado PCB y Galería PCB

Aplicación Next.js 16 (App Router) con PostgreSQL y Drizzle: cotizador Gerber, galería de diseños reales, Pennies, cupones y solicitudes de fabricación. **No procesa pagos.**

## Vercel: mismo proyecto, dominio y PostgreSQL

Sigue [VERCEL.md](./VERCEL.md). Conecta tu PostgreSQL existente mediante Storage/Marketplace en **el mismo proyecto de Vercel** que tendrá el dominio. Next.js no necesita `vercel.json` ni un dominio codificado. La app usa la URL pooled que la integración inyecte como `DATABASE_URL_POOLED`, `DATABASE_URL` o `POSTGRES_URL` y gestiona el pool con Fluid Compute. Para crear o actualizar el esquema ejecuta `sql/SCHEMA_ALL.sql` (idempotente, no borra datos) tras hacer una copia de seguridad; la URL sin pool es opcional y solo la usa Drizzle CLI. En `/admin` → «Estado de la base de datos» puedes comprobar qué tablas o columnas faltan y obtener el SQL necesario.

Comprueba `GET /api/health` (`{"ok":true}`) y `GET /api/db/status` (conexión y tablas); `/api/supabase/status` sigue funcionando como alias.

## Desarrollo local

```bash
npm ci
cp .env.example .env.local  # configura una base de desarrollo (SESSION_SECRET es opcional)
# Si estás vinculado al proyecto: vercel env pull .env.local (entorno Development)
npx drizzle-kit push        # solo después de comprobar a qué base apunta la URL
npm run dev                 # http://localhost:3000
```

## Fabricación y Galería PCB

Tarifa de las placas (`calculateBoardUnitCents` en `src/lib/pricing.ts`), multiplicada por 1–1000 unidades:

- Hasta **2.500 mm²**: **5,00 €** por placa.
- Entre 2.500 y 30.000 mm²: **curva exponencial negativa ascendente y amortiguada**, que arranca en 5 € y termina en **40,00 €** para 150 × 200 mm. Cada mm² adicional encarece menos que el anterior.
- **40,00 €** es el precio máximo por placa (el mayor tamaño fabricable).

    p(A) = 5 + 35 · (1 − e^(−k·(A − 2.500))) / (1 − e^(−k·27.500)),  k = 0,00003

Ejemplos: 50×50 mm (2.500 mm²) → 5,00 €; 60×50 mm → 5,93 €; 85×65 mm → 10,41 €; 100×100 mm → 17,55 €; 100×150 mm → 24,48 €; 100×200 mm → 30,45 €; 150×200 mm → **40,00 €**. La constante `BOARD_CURVE_DAMPING` permite ajustar la forma sin tocar el resto del código.

El contorno Gerber, cuando existe, prevalece sobre las medidas escritas por el cliente.

**Envío con precios reales según destino** (`src/lib/shipping/`): el comprador indica país, código postal y localidad, y la aplicación consulta tarifas reales en función de ese destino y del peso/dimensiones estimados del paquete (placas FR4 + embalaje). Para España se usan las tarifas oficiales publicadas de Correos 2026 (Paq Estándar y Paq Premium, PVP sin contrato), con precios distintos para Península/Baleares y Canarias/Ceuta/Melilla. **Para el extranjero** se aplica el *Paq Standard Internacional* oficial de Correos 2026 por zonas (Europa 1, Europa 2, Europa 3, América, Asia y Oceanía 1/2, África): por ejemplo Finlandia (Europa 1) 33,07 € hasta 1 kg y 36,48 € hasta 2 kg; EE. UU. (América) 37,96 € y 47,79 €. Si el paquete supera el tramo publicado para una zona sin precio por kilo adicional, no se inventa una cifra: se muestra «A confirmar» y el envío se revisa manualmente. Si se configuran las variables `DHL_*`, se añade DHL Express con tarifas en tiempo real (API real, ver VERCEL.md) para cualquier país. Si ningún transportista cubre el destino, se ofrece un presupuesto manual en vez de inventar un precio. El envío económico (Correos Estándar) es gratis desde 100 € de placas o 20 unidades; los servicios rápidos (Premium/DHL) no se ven afectados por ese umbral. El precio de envío **se recalcula siempre en el servidor** a partir del destino real; nunca se acepta el precio que envía el navegador.

La galería no contiene diseños de ejemplo; acepta únicamente publicaciones reales (ZIP Gerber de hasta 2 MB e imagen de hasta 1 MB). Los proyectos de 4 o 6 capas pueden compartirse, pero por ahora solo se fabrican diseños de una o dos caras. Con `NEXT_PUBLIC_TIENE_REMACHADORA=false`, las placas de dos caras requieren aceptar el aviso eco; con `true`, se informa de los micro-remaches de cobre y desaparece ese aviso.

La solicitud se guarda aunque no se configure SMTP; en ese caso no se envía ningún correo. El contacto público es **espcb.soportecnico@gmail.com**. `/admin`, protegido con `ADMIN_API_TOKEN`, permite revisar pedidos, avisos y el estado de la base de datos.

## Cuentas e inicio de sesión

Crear una cuenta solo requiere nombre, correo y una contraseña seguras (mínimo 8 caracteres); no hay que configurar nada más. La clave que firma las sesiones se genera automáticamente la primera vez y se guarda en tu base de datos (tabla `app_secrets`), para que todas las instancias de Vercel reconozcan la misma sesión. **Esa clave persistida tiene prioridad** sobre `SESSION_SECRET`: si más adelante añades o cambias esa variable, las sesiones ya abiertas siguen siendo válidas. Para forzar una rotación, borra la fila `session_secret` de `app_secrets` y define `SESSION_SECRET` (32+ caracteres).

Si una sesión caduca o la cookie deja de ser válida, la web ya no se queda bloqueada: el aviso de condiciones se puede cerrar, sigue visible un recordatorio no bloqueante y, al aceptar, si la sesión no es válida se te pide iniciar sesión de nuevo conservando tus datos.

## Pennies: sin topes, con revisión manual

La política está en `src/lib/pennies-award.ts` y **no tiene límites de cantidad**: si un diseño se fabrica cien veces, su autor gana los Pennies de esas cien fabricaciones. Cada fabricación es un ingreso real, así que el volumen siempre suma a favor del negocio.

El control no es un tope, sino que **nada se abona sin revisión**:

1. Al marcar un pedido de la galería como pagado se calcula la concesión íntegra y queda **pendiente** (`penny_ledger.status = 'pending'`). El saldo del diseñador no cambia.
2. En `/admin` → **«Pennies pendientes de revisión»** aparecen todas, con diseñador, diseño, pedido, comprador y medidas. Puedes **aprobar** (abona el importe completo) o **rechazar** con motivo, una a una o todas de golpe tras revisarlas.
3. Al reembolsar un pedido: si la concesión estaba pendiente se anula sin abonar; si ya estaba aprobada, se descuenta su importe.

Solo hay dos exclusiones, ambas de la especificación original y no un tope de volumen: fabricar tu **propio** diseño y los diseños **privados** no publicados en la galería. Las descargas y visitas nunca han otorgado puntos.

`tests/pennies-award.integration.mjs` verifica contra PostgreSQL real que 16 fabricaciones suman 320 Pennies sin recorte, que lo pendiente no se abona hasta aprobarlo, que aprobar dos veces no duplica el saldo, que lo rechazado no se abona, que el reembolso descuenta y que el diseño propio no genera puntos.

**Antes de publicar comercialmente**, completa la información societaria y revisa [LEGAL_LANZAMIENTO.md](./LEGAL_LANZAMIENTO.md) y [VERCEL.md](./VERCEL.md). Configurar el alojamiento no garantiza el cumplimiento legal.
