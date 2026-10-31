import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Esquema que espera la aplicación. Se compara con information_schema para decir
 * exactamente qué falta en la base conectada (Vercel/Neon/Supabase) cuando una
 * consulta falla, en lugar de devolver el error crudo de PostgreSQL al cliente.
 */
const EXPECTED: Record<string, Record<string, string>> = {
  app_secrets: {
    key: "text", value: "text", created_at: "timestamp with time zone",
  },
  users: {
    id: "text", name: "text", email: "text", password_hash: "text", pennies: "integer",
    terms_accepted_at: "timestamp with time zone", terms_version: "text",
    adult_confirmed: "boolean", created_at: "timestamp with time zone",
  },
  projects: {
    id: "text", user_id: "text", title: "text", description: "text", category: "text",
    difficulty: "text", license: "text", cad_format: "text", tags: "ARRAY", components: "integer",
    featured: "boolean", width: "double precision", height: "double precision", layers: "integer",
    holes: "integer", image_type: "text", image_data: "bytea", gerber_name: "text", gerber_data: "bytea",
    is_public: "boolean", downloads: "integer", likes: "integer", views: "integer",
    rights_accepted_at: "timestamp with time zone", rights_terms_version: "text",
    created_at: "timestamp with time zone",
  },
  project_likes: {
    id: "text", project_id: "text", user_id: "text", created_at: "timestamp with time zone",
  },
  coupons: {
    id: "text", user_id: "text", code: "text", reward_code: "text", cost: "integer",
    status: "text", order_id: "text", created_at: "timestamp with time zone",
  },
  orders: {
    id: "text", order_number: "text", user_id: "text", project_id: "text", buyer_name: "text",
    buyer_email: "text", shipping_address: "text", shipping_method: "text",
    shipping_carrier: "text", shipping_service: "text", shipping_source: "text", shipping_eta_days: "text",
    shipping_country: "text", shipping_postal_code: "text", shipping_city: "text",
    width: "double precision", height: "double precision", quantity: "integer", layers: "integer",
    holes: "integer", two_sided_accepted: "boolean", gerber_name: "text", gerber_data: "bytea",
    base_cents: "integer", shipping_cents: "integer", discount_cents: "integer", total_cents: "integer",
    coupon_id: "text", notes: "text", terms_accepted_at: "timestamp with time zone",
    terms_version: "text", adult_confirmed: "boolean", status: "text", email_status: "text",
    created_at: "timestamp with time zone",
  },
  penny_ledger: {
    id: "text", user_id: "text", order_id: "text", type: "text", amount: "integer",
    description: "text", status: "text", reviewed_at: "timestamp with time zone",
    review_note: "text", created_at: "timestamp with time zone",
  },
  content_reports: {
    id: "text", report_number: "text", project_id: "text", location: "text", reason: "text",
    reporter_name: "text", reporter_email: "text", good_faith: "boolean", status: "text",
    decision: "text", email_status: "text", receipt_status: "text", decision_email_status: "text",
    created_at: "timestamp with time zone", resolved_at: "timestamp with time zone",
  },
};

export type SchemaIssue =
  | { kind: "missing_table"; table: string }
  | { kind: "missing_column"; table: string; column: string; type: string }
  | { kind: "wrong_type"; table: string; column: string; expected: string; found: string };

export type SchemaReport = {
  ok: boolean;
  issues: SchemaIssue[];
  connection: { reachable: boolean; role: string | null; bypassRls: boolean | null };
  rlsBlockedTables: string[];
};

/** Compara el esquema real con el esperado. No lee ni devuelve datos de clientes. */
export async function inspectSchema(): Promise<SchemaReport> {
  const issues: SchemaIssue[] = [];
  let reachable = true;
  let role: string | null = null;
  let bypassRls: boolean | null = null;
  const rlsBlockedTables: string[] = [];

  try {
    const columns = await db.execute<{ table_name: string; column_name: string; data_type: string }>(
      sql`select table_name, column_name, data_type from information_schema.columns where table_schema = 'public'`
    );
    const present = new Map<string, Map<string, string>>();
    for (const row of columns.rows ?? []) {
      const table = present.get(row.table_name) ?? new Map<string, string>();
      table.set(row.column_name, row.data_type);
      present.set(row.table_name, table);
    }
    for (const [table, expectedColumns] of Object.entries(EXPECTED)) {
      const found = present.get(table);
      if (!found) { issues.push({ kind: "missing_table", table }); continue; }
      for (const [column, type] of Object.entries(expectedColumns)) {
        const actual = found.get(column);
        if (!actual) issues.push({ kind: "missing_column", table, column, type });
        else if (actual !== type) issues.push({ kind: "wrong_type", table, column, expected: type, found: actual });
      }
    }

    const who = await db.execute<{ current_user: string; rolbypassrls: boolean | null; rolsuper: boolean | null }>(
      sql`select current_user, rolbypassrls, rolsuper from pg_roles where rolname = current_user`
    );
    const me = (who.rows ?? [])[0];
    role = me?.current_user ?? null;
    bypassRls = me ? Boolean(me.rolbypassrls || me.rolsuper) : null;

    // RLS activo sin políticas bloquea INSERT/UPDATE aunque el esquema sea correcto,
    // salvo que el rol sea propietario con bypassrls.
    const policies = await db.execute<{ relname: string; relrowsecurity: boolean; policies: number }>(
      sql`select c.relname, c.relrowsecurity, (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'`
    );
    if (bypassRls === false) {
      for (const row of policies.rows ?? []) {
        if (row.relrowsecurity && Number(row.policies) === 0) rlsBlockedTables.push(row.relname);
      }
    }
  } catch (error) {
    reachable = false;
    console.error("No se pudo inspeccionar el esquema de PostgreSQL:", error);
  }

  return {
    ok: reachable && issues.length === 0 && rlsBlockedTables.length === 0,
    issues,
    connection: { reachable, role, bypassRls },
    rlsBlockedTables,
  };
}

/** Motivo breve y seguro para respuestas públicas: nunca incluye datos de clientes. */
export function publicReason(report: SchemaReport): string {
  if (!report.connection.reachable) return "database_unreachable";
  if (report.issues.some((issue) => issue.kind === "missing_table")) return "schema_missing_tables";
  if (report.issues.length > 0) return "schema_outdated";
  if (report.rlsBlockedTables.length > 0) return "row_level_security_blocking";
  return "ok";
}

/** SQL que resuelve los problemas detectados. Se muestra solo en el panel de administración. */
export function suggestedSql(report: SchemaReport): string {
  const lines: string[] = ["-- Generado a partir del esquema detectado en tu base de datos.", "-- Idempotente: no borra datos existentes."];
  const missingTables = new Set(report.issues.filter((issue): issue is { kind: "missing_table"; table: string } => issue.kind === "missing_table").map((issue) => issue.table));
  if (missingTables.size > 0) lines.push(`-- Faltan tablas: ${[...missingTables].join(", ")}`, "-- Ejecuta el archivo completo sql/SCHEMA_ALL.sql en el editor SQL de tu proveedor.");
  const columns = report.issues.filter((issue) => issue.kind === "missing_column") as { table: string; column: string; type: string }[];
  for (const column of columns) lines.push(`ALTER TABLE public.${column.table} ADD COLUMN IF NOT EXISTS ${column.column} ${pgTypeWithDefault(column.type)};`);
  const types = report.issues.filter((issue) => issue.kind === "wrong_type") as { table: string; column: string; expected: string; found: string }[];
  for (const type of types) lines.push(`ALTER TABLE public.${type.table} ALTER COLUMN ${type.column} TYPE ${type.expected} USING ${type.column}::${type.expected};`);
  if (report.rlsBlockedTables.length > 0) {
    lines.push(`-- RLS activo sin políticas en: ${report.rlsBlockedTables.join(", ")}`, "-- El rol de conexión no puede escribir. Crea políticas para ese rol o usa un rol con acceso:");
    for (const table of report.rlsBlockedTables) lines.push(`-- ALTER TABLE public.${table} DISABLE ROW LEVEL SECURITY;  -- o conceder permisos al rol '${report.connection.role ?? "postgres"}'`);
  }
  return lines.length > 2 ? lines.join("\n") : "-- El esquema coincide con el que espera la aplicación.";
}

function pgTypeWithDefault(type: string): string {
  if (type === "boolean") return "boolean NOT NULL DEFAULT false";
  if (type === "integer") return "integer NOT NULL DEFAULT 0";
  if (type === "double precision") return "double precision NOT NULL DEFAULT 0";
  if (type === "ARRAY") return "text[] NOT NULL DEFAULT ARRAY[]::text[]";
  // Fechas y horas: nunca NOT NULL para no imponer aceptaciones retroactivas.
  if (type === "timestamp with time zone") return "timestamptz";
  return "text";
}
