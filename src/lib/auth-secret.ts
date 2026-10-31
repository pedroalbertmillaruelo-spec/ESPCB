import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appSecrets } from "@/db/schema";

const SESSION_SECRET_KEY = "session_secret";

/**
 * Clave de firma de las cookies de sesión.
 *
 * Problema que resuelve: en Vercel (serverless) cada instancia fría podía generar
 * su propia clave aleatoria en memoria. Una sesión firmada por una instancia no
 * era válida en otra, así que el usuario se quedaba atrapado entre «he iniciado
 * sesión» y «inicia sesión para continuar». Pedir a cada usuario que configure
 * `SESSION_SECRET` a mano tampoco es razonable.
 *
 * Solución: si no se definió `SESSION_SECRET` en el entorno, la clave se genera
 * una única vez y se guarda en la propia base de datos ya conectada (tabla
 * `app_secrets`). Todas las instancias leen la misma fila, así que las firmas
 * coinciden siempre. Se cachea en memoria por instancia para no consultar la
 * base en cada petición.
 *
 * Resiliencia: la tabla `app_secrets` se crea sola la primera vez que hace
 * falta (CREATE TABLE IF NOT EXISTS), así que el inicio de sesión funciona
 * incluso si todavía no se ha ejecutado sql/SCHEMA_ALL.sql en la base conectada.
 */
const globalCache = globalThis as typeof globalThis & {
  __espcbSessionSecret?: string;
  __espcbSessionSecretPromise?: Promise<string>;
};

function fromEnv(): string | null {
  const value = process.env.SESSION_SECRET;
  return value && value.length >= 32 ? value : null;
}

async function ensureTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS public.app_secrets (
      key text PRIMARY KEY,
      value text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Drizzle envuelve el error del driver `pg`: el SQLSTATE real (p. ej. "42P01",
 * tabla inexistente) queda en `error.cause`, no en el objeto que se lanza.
 * Se recorre la cadena de causas para encontrarlo, igual que en isDatabaseError.
 */
function pgErrorCode(error: unknown): string | undefined {
  for (let current: unknown = error, depth = 0; current && depth < 5; current = (current as { cause?: unknown }).cause, depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

async function loadOrCreateSecret(): Promise<string> {
  // 42P01 = "undefined_table": la tabla aún no existe en esta base. Se crea sola
  // y se reintenta una vez; cualquier otro fallo (conexión, permisos…) se propaga.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [existing] = await db.select().from(appSecrets).where(eq(appSecrets.key, SESSION_SECRET_KEY)).limit(1);
      if (existing?.value) return existing.value;
      const envSecret = fromEnv();
      if (envSecret) {
        // Primera vez con variable de entorno: se persiste para que un futuro cambio
        // de variables no invalide las sesiones ya emitidas.
        await db.insert(appSecrets).values({ key: SESSION_SECRET_KEY, value: envSecret }).onConflictDoNothing();
        const [stored] = await db.select().from(appSecrets).where(eq(appSecrets.key, SESSION_SECRET_KEY)).limit(1);
        return stored?.value ?? envSecret;
      }
      const generated = randomBytes(32).toString("hex");
      // Condición de carrera entre instancias arrancando a la vez: la que pierda
      // el conflicto de clave primaria simplemente relee el valor ganador.
      await db.insert(appSecrets).values({ key: SESSION_SECRET_KEY, value: generated }).onConflictDoNothing();
      const [row] = await db.select().from(appSecrets).where(eq(appSecrets.key, SESSION_SECRET_KEY)).limit(1);
      return row?.value ?? generated;
    } catch (error) {
      if (attempt === 0 && pgErrorCode(error) === "42P01") { await ensureTable(); continue; }
      throw error;
    }
  }
  throw new Error("No se pudo preparar la clave de sesión.");
}

export async function getSessionSecret(): Promise<string> {
  // Prioridad: la clave ya persistida en la base de datos. Así, si más adelante se añade
  // SESSION_SECRET en Vercel, las sesiones abiertas siguen siendo válidas (la clave no
  // cambia bajo los pies del usuario). Solo si aún no existe ninguna se usa la variable
  // de entorno y, en su defecto, se genera. Para rotar la clave, borra la fila
  // `session_secret` de app_secrets y establece SESSION_SECRET.
  if (globalCache.__espcbSessionSecret) return globalCache.__espcbSessionSecret;
  if (!globalCache.__espcbSessionSecretPromise) {
    globalCache.__espcbSessionSecretPromise = loadOrCreateSecret()
      .then((value) => { globalCache.__espcbSessionSecret = value; return value; })
      .finally(() => { globalCache.__espcbSessionSecretPromise = undefined; });
  }
  return globalCache.__espcbSessionSecretPromise;
}
