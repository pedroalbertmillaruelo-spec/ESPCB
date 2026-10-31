# Desplegar ESPCB en tu proyecto de Vercel

La aplicación ya es Next.js (App Router) y usa PostgreSQL con Drizzle. **No necesita otro proyecto de Vercel, otro dominio, `vercel.json` ni una base creada por el código.** Vercel Postgres como producto independiente ya no se ofrece; la integración de PostgreSQL se gestiona a través del Marketplace (por ejemplo Neon o Supabase). Puedes conectar allí la base que ya utilizas.

## 1. Mantener el proyecto, conectar la base y asignar el dominio

1. Importa este repositorio en **el proyecto que vas a usar en Vercel**, o actualiza su repositorio si ya existe. Vercel detecta Next.js y ejecuta `npm run build` sin adaptadores extra. En **Settings → General** selecciona Node.js 22.
2. En el proyecto, abre **Storage / Marketplace → Connect** y vincula tu PostgreSQL existente. Si la integración ya está vinculada, no crees otro recurso. Revisa en **Settings → Environment Variables** qué variables proporciona al entorno **Production**. La app acepta, en orden: `DATABASE_URL_POOLED`, `DATABASE_URL` y `POSTGRES_URL`; la URL utilizada durante las peticiones debe ser **pooled** y con TLS según las indicaciones de tu proveedor. Si el recurso solo proporciona una variable con otro nombre, asígnala a `DATABASE_URL` en el proyecto. Nunca copies contraseñas a Git.
3. Para Preview y Development, conecta **una rama o una base distinta** siempre que sea posible. No ejecutes migraciones o pruebas desde Preview contra la base de Production. El valor inyectado en el entorno es el que usa Drizzle en tiempo de ejecución. En funciones Vercel, `@vercel/functions` libera conexiones inactivas del pool cuando Fluid Compute suspende la instancia.
4. En **Settings → Domains** añade el dominio al **mismo proyecto**, asígnalo a Production y sigue las indicaciones DNS que Vercel muestre para tu caso (registro A o CNAME, verificación y certificado HTTPS). **No hace falta codificar el dominio en el repositorio**: la aplicación usa rutas relativas. El dominio apuntará a la última implementación de producción una vez verificado.

## 2. Instalar o actualizar el esquema en esa misma base

**Este paso es obligatorio.** La aplicación escribe columnas añadidas en versiones posteriores (`orders.shipping_method`, `terms_accepted_at`, `terms_version`, `adult_confirmed`, las columnas de galería y las tablas `project_likes` y `content_reports`). Si la base se creó con un esquema anterior, **los pedidos fallan al guardarse** con un error de PostgreSQL.

1. Haz una copia de seguridad y confirma que estás en la base correcta.
2. Ejecuta **`sql/SCHEMA_ALL.sql` completo** en el editor SQL de tu proveedor (Neon, Supabase u otro). Es idempotente y no destructivo: crea lo que falta, añade las columnas nuevas y convierte `width`/`height` a `double precision` **sin borrar** cuentas, diseños, pedidos ni avisos. Sirve igual para una base nueva que para una ya existente.
3. Vuelve a desplegar o recarga y comprueba `https://TU-DOMINIO/api/db/status`.

### Diagnóstico desde el panel

En `/admin`, tras introducir `ADMIN_API_TOKEN`, la sección **«Estado de la base de datos»** compara el esquema real con el esperado e indica:

- tablas y columnas que faltan, y columnas con un tipo distinto;
- el rol de conexión y si RLS bloquea la escritura para ese rol;
- el SQL concreto para resolverlo.

`GET /api/db/status` es público pero solo devuelve un motivo breve (`ok`, `schema_missing_tables`, `schema_outdated`, `row_level_security_blocking` o `database_unreachable`); el detalle exige el token en `GET /api/admin/db`.

### Migraciones y permisos

`drizzle.config.ts` usa `DATABASE_URL_UNPOOLED` o `POSTGRES_URL_NON_POOLING` si el proveedor ofrece una URL directa; si no, la URL disponible. **No ejecutes `npx drizzle-kit push` contra producción a ciegas ni añadas migraciones al comando de build.** Si el rol de conexión no es el propietario de las tablas ni tiene `BYPASSRLS`, RLS impedirá escribir: crea políticas para ese rol o usa un rol propietario. El script retira el acceso de los roles `anon`/`authenticated` si existen, para que las tablas no queden expuestas por la API REST del proveedor.

### Errores de base de datos

Los fallos de PostgreSQL ya no se devuelven al navegador: se registran en **Vercel → Logs** (con la causa: columna o tabla inexistente, permisos/RLS, tipo incompatible o conexión) y el cliente recibe un aviso neutro. Esto evita además exponer datos del comprador y el contenido de los archivos subidos.

## 3. Variables de entorno y despliegue

En **Settings → Environment Variables** establece al menos:

- `ADMIN_API_TOKEN`: secreto de al menos 16 caracteres para `/admin`.
- La URL pooled de PostgreSQL, facilitada por la integración (`DATABASE_URL_POOLED`, `DATABASE_URL` o `POSTGRES_URL`).

**Sobre `SESSION_SECRET` (opcional):** no hace falta configurarla. Si no está definida, la aplicación genera una clave segura la primera vez y la guarda en tu base de datos (tabla `app_secrets`), de modo que todas las instancias de Vercel firman y verifican las sesiones igual. **La clave guardada en la base de datos tiene prioridad sobre la variable de entorno**, precisamente para que añadir o cambiar `SESSION_SECRET` más tarde no invalide las sesiones abiertas (era la causa de que, tras aceptar condiciones o desplegar, apareciera «inicia sesión para continuar»). Para rotar la clave de forma deliberada: borra la fila `session_secret` de `app_secrets` y define `SESSION_SECRET` con 32+ caracteres (`openssl rand -hex 32`); se persistirá en el siguiente arranque.

**Condiciones actualizadas:** el aviso ya no es un diálogo bloqueante. Se muestra una banda inferior que se puede cerrar, se puede seguir navegando y, si la sesión ha caducado al aceptar, la aplicación pide iniciar sesión de nuevo con un mensaje claro en lugar de dejar un error sin salida.

**Correo de soporte:** `espcb.soportecnico@gmail.com` es el contacto público y el destinatario por defecto de solicitudes y avisos. Si existía `ORDER_EMAIL_TO` con otro correo, cámbialo o elimínalo. Para Gmail SMTP, configura `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=espcb.soportecnico@gmail.com`, `SMTP_FROM=espcb.soportecnico@gmail.com` y `SMTP_PASS` como secreto de Vercel. Google exige verificación en dos pasos para las contraseñas de aplicación (véase https://support.google.com/mail/answer/185833?hl=es). **No se enviará ningún correo real hasta configurar SMTP y probar la entrega.** Sin SMTP, la solicitud y los avisos siguen guardados en PostgreSQL para gestionarlos en `/admin`.

Para los textos legales, configura cuando tengas los datos reales `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_COMPANY_NIF`, `NEXT_PUBLIC_COMPANY_ADDRESS`, `NEXT_PUBLIC_COMPANY_REGISTER` y, si existe, `NEXT_PUBLIC_COMPANY_PHONE`. `NEXT_PUBLIC_TIENE_REMACHADORA=true` cambia el acabado de doble cara. Las variables `NEXT_PUBLIC_*` quedan incorporadas en el build: **vuelve a desplegar** tras modificarlas. Configura la misma versión coherente en Production y Preview si ese entorno se comparte con usuarios.

## Envíos: precios reales según destino

El coste de envío ya no es un precio fijo: el comprador indica país, código postal y localidad, y la aplicación consulta `src/lib/shipping/` para obtener tarifas reales según ese destino y el peso/volumen estimado del paquete. El precio se **recalcula siempre en el servidor** al enviar la solicitud (nunca se acepta el precio que envía el navegador), así que no hay forma de manipularlo desde el cliente.

- **España (siempre activo, sin configuración):** se usan las tarifas oficiales publicadas de Correos 2026 (Paq Estándar y Paq Premium, precio público sin contrato), con bandas distintas para Península/Baleares y Canarias/Ceuta/Melilla. Correos no ofrece una API de tarifas sin contrato de transporte firmado, por eso se usa su tarifario oficial en vez de una consulta en tiempo real; la interfaz lo indica como «tarifa oficial» frente a «tiempo real».
- **Internacional (siempre activo, sin configuración):** se aplica el *Paq Standard Internacional* oficial de Correos 2026 por zonas (`src/lib/shipping/providers/correos-international.ts`): Europa 1 (UE y Reino Unido), Europa 2, Europa 3, América, Asia y Oceanía 1/2 y África. Ejemplos verificados: Finlandia 33,07 € hasta 1 kg y 36,48 € hasta 2 kg; EE. UU. 37,96 € y 47,79 €. Para pesos superiores al último tramo publicado solo se extrapola cuando Correos publica precio por kilo adicional; si no, se muestra «A confirmar» en lugar de una cifra inventada.
- **DHL Express (opcional, cualquier país):** si configuras `DHL_API_KEY`, `DHL_ACCOUNT_NUMBER`, `DHL_ORIGIN_COUNTRY`, `DHL_ORIGIN_POSTAL_CODE` y `DHL_ORIGIN_CITY` en Vercel, la aplicación consulta la **MyDHL API** real (https://developer.dhl.com) y añade sus tarifas en tiempo real a las opciones disponibles para ese destino. Sin esas variables, DHL simplemente no aparece: no se inventa ningún precio en su lugar. Da de alta una cuenta sandbox gratuita en el portal de desarrolladores de DHL para probarlo antes de pasar a producción (`DHL_API_BASE_URL=https://express.api.dhl.com/mydhlapi` sin `/test`).
- **Otros transportistas (SEUR, Correos Express, etc.):** la arquitectura está preparada para añadirlos. Crea un archivo nuevo en `src/lib/shipping/providers/` con la misma forma que `dhl.ts` (recibe destino y paquete, devuelve una lista de `ShippingOption`) y regístralo en `src/lib/shipping/index.ts`; no hace falta tocar el resto de la aplicación.
- **Destinos sin transportista configurado:** se muestra un presupuesto manual («Te confirmamos el coste de envío») en vez de romper el cotizador o mostrar un precio inventado. El equipo revisa esos pedidos desde `/admin`.
- **Envío gratis propio:** el envío económico (Correos Estándar) sigue siendo gratuito desde 100 € de placas o 20 unidades, igual que antes; los servicios rápidos (Premium o DHL) no se ven afectados por ese umbral.

## 4. Comprobar el dominio publicado

Tras desplegar en Production y verificar el DNS:

- `https://TU-DOMINIO/api/health` → `{"ok":true}` cuando PostgreSQL responde.
- `https://TU-DOMINIO/api/db/status` → `{"ok":true,...,"reason":"ok"}` cuando el esquema está completo. Si devuelve `schema_missing_tables`, `schema_outdated` o `row_level_security_blocking`, ejecuta `sql/SCHEMA_ALL.sql` y revisa `/admin`. `/api/supabase/status` se conserva como alias.
- Comprueba `/galeria`, el acceso a cuenta y un pedido de prueba en **un entorno separado**. No uses pedidos ficticios para generar Pennies en Production.

Para desarrollar localmente con variables de **Development** de la integración: vincula el mismo proyecto mediante `vercel link` y usa `vercel env pull .env.local`. Nunca publiques `.env.local`. Antes de instalar tablas, comprueba de nuevo qué URL estás usando. Las subidas (ZIP de 2 MB e imagen de 1 MB) se almacenan en PostgreSQL y caben en el límite de petición de las Vercel Functions; no dependen del almacenamiento efímero de la función.

## Importante antes de vender

Esta versión **no cobra ni acepta automáticamente una compra**: almacena una solicitud para revisión. Completa NIF, domicilio y datos registrales y revisa proveedores, contratos de tratamiento, derechos de privacidad, impuestos, entrega y textos con asesoría profesional según [LEGAL_LANZAMIENTO.md](./LEGAL_LANZAMIENTO.md). Configurar Vercel y PostgreSQL no sustituye estos pasos ni garantiza por sí solo el cumplimiento legal.
