import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Next.js carga .env.local en desarrollo; Drizzle CLI necesita cargarlo explícitamente.
// process.env existente (por ejemplo, una integración de Vercel) tiene prioridad.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

// Las migraciones pueden usar la URL directa; las funciones de la web usan la URL con pool.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_POOLED;
if (!url) throw new Error("Configura DATABASE_URL o POSTGRES_URL de tu PostgreSQL existente.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url },
});
