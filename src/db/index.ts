import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// La integración PostgreSQL del Marketplace puede inyectar nombres distintos según el proveedor.
// Nunca usamos aquí una URL sin pool reservada a las migraciones.
const databaseUrl = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL (o POSTGRES_URL) de la integración PostgreSQL de Vercel.");
}

const globalForDb = globalThis as typeof globalThis & { __espcbPgPool?: Pool };

function createPool() {
  const instance = new Pool({
    connectionString: databaseUrl,
    max: process.env.VERCEL === "1" ? 3 : 5,
    idleTimeoutMillis: process.env.VERCEL === "1" ? 5_000 : 10_000,
    connectionTimeoutMillis: 10_000,
  });
  // pg elimina el cliente inactivo averiado; evitar que su evento sin listener derribe la función.
  instance.on("error", (error) => console.error("Cliente PostgreSQL inactivo desconectado:", error));
  if (process.env.VERCEL === "1") {
    // Fluid Compute: libera conexiones inactivas antes de suspender la función.
    attachDatabasePool(instance);
  }
  return instance;
}

export const pool = globalForDb.__espcbPgPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__espcbPgPool = pool;
export const db = drizzle(pool);
