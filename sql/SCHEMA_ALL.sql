-- ESPCB · Esquema completo para PostgreSQL (Vercel Marketplace, Neon, Supabase u otro).
-- Idempotente y NO destructivo: crea lo que falta, añade columnas nuevas y ajusta tipos
-- sin borrar cuentas, diseños, pedidos ni avisos existentes.
-- Ejecútalo completo en el editor SQL del proveedor, sobre la base conectada a tu proyecto.

CREATE TABLE IF NOT EXISTS public.app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  pennies integer NOT NULL DEFAULT 0,
  terms_accepted_at timestamptz,
  terms_version text,
  adult_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.users(id),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  difficulty text NOT NULL DEFAULT 'Principiante',
  license text NOT NULL DEFAULT 'CC BY 4.0',
  cad_format text NOT NULL DEFAULT 'Solo Gerber',
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  components integer NOT NULL DEFAULT 0,
  featured boolean NOT NULL DEFAULT false,
  width double precision NOT NULL,
  height double precision NOT NULL,
  layers integer NOT NULL,
  holes integer NOT NULL DEFAULT 0,
  image_type text NOT NULL,
  image_data bytea NOT NULL,
  gerber_name text NOT NULL,
  gerber_data bytea NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  downloads integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  rights_accepted_at timestamptz,
  rights_terms_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_likes (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.users(id),
  code text NOT NULL UNIQUE,
  reward_code text NOT NULL,
  cost integer NOT NULL,
  status text NOT NULL DEFAULT 'available',
  order_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id text PRIMARY KEY,
  order_number text NOT NULL UNIQUE,
  user_id text REFERENCES public.users(id),
  project_id text REFERENCES public.projects(id),
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  shipping_address text NOT NULL DEFAULT '',
  shipping_method text NOT NULL DEFAULT 'standard',
  shipping_carrier text NOT NULL DEFAULT '',
  shipping_service text NOT NULL DEFAULT '',
  shipping_source text NOT NULL DEFAULT 'tariff',
  shipping_eta_days text NOT NULL DEFAULT '',
  shipping_country text NOT NULL DEFAULT 'ES',
  shipping_postal_code text NOT NULL DEFAULT '',
  shipping_city text NOT NULL DEFAULT '',
  width double precision NOT NULL,
  height double precision NOT NULL,
  quantity integer NOT NULL,
  layers integer NOT NULL,
  holes integer NOT NULL,
  two_sided_accepted boolean NOT NULL DEFAULT false,
  gerber_name text NOT NULL,
  gerber_data bytea NOT NULL,
  base_cents integer NOT NULL,
  shipping_cents integer NOT NULL,
  discount_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL,
  coupon_id text REFERENCES public.coupons(id),
  notes text NOT NULL DEFAULT '',
  terms_accepted_at timestamptz,
  terms_version text,
  adult_confirmed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  email_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.penny_ledger (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES public.users(id),
  order_id text REFERENCES public.orders(id),
  type text NOT NULL,
  amount integer NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'approved',
  reviewed_at timestamptz,
  review_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.content_reports (
  id text PRIMARY KEY,
  report_number text NOT NULL UNIQUE,
  project_id text,
  location text NOT NULL,
  reason text NOT NULL,
  reporter_name text,
  reporter_email text,
  good_faith boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  decision text,
  email_status text NOT NULL DEFAULT 'pending',
  receipt_status text NOT NULL DEFAULT 'pending',
  decision_email_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- ── Actualización de bases creadas con versiones anteriores ─────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS terms_version text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS adult_confirmed boolean NOT NULL DEFAULT false;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'Principiante';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS license text NOT NULL DEFAULT 'CC BY 4.0';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS cad_format text NOT NULL DEFAULT 'Solo Gerber';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS components integer NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS likes integer NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS rights_accepted_at timestamptz;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS rights_terms_version text;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address text NOT NULL DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_method text NOT NULL DEFAULT 'standard';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_carrier text NOT NULL DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_service text NOT NULL DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_source text NOT NULL DEFAULT 'tariff';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_eta_days text NOT NULL DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_country text NOT NULL DEFAULT 'ES';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_postal_code text NOT NULL DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_city text NOT NULL DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS terms_version text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS adult_confirmed boolean NOT NULL DEFAULT false;

ALTER TABLE public.penny_ledger ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
ALTER TABLE public.penny_ledger ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.penny_ledger ADD COLUMN IF NOT EXISTS review_note text NOT NULL DEFAULT '';
-- Las concesiones antiguas ya estaban abonadas: se marcan como aprobadas.
UPDATE public.penny_ledger SET status = 'approved' WHERE status IS NULL OR status = '';

ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS receipt_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.content_reports ADD COLUMN IF NOT EXISTS decision_email_status text NOT NULL DEFAULT 'pending';

-- Las medidas admiten decimales (mm). La conversión conserva los valores existentes.
ALTER TABLE public.projects ALTER COLUMN width TYPE double precision USING width::double precision;
ALTER TABLE public.projects ALTER COLUMN height TYPE double precision USING height::double precision;
ALTER TABLE public.orders ALTER COLUMN width TYPE double precision USING width::double precision;
ALTER TABLE public.orders ALTER COLUMN height TYPE double precision USING height::double precision;

CREATE UNIQUE INDEX IF NOT EXISTS project_likes_project_user_unique ON public.project_likes(project_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS penny_ledger_order_type_unique ON public.penny_ledger(order_id, type);

-- ── Acceso ─────────────────────────────────────────────────────────────────
-- La aplicación se conecta con la URL pooled de la integración (DATABASE_URL /
-- POSTGRES_URL). No se usan las API REST públicas del proveedor: se retira su
-- acceso si esos roles existen, de modo que las tablas no queden expuestas.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
  END IF;
END $$;

-- RLS como defensa adicional. El rol propietario de las tablas (o uno con
-- BYPASSRLS) sigue operando con normalidad. Si /admin → "Estado de la base de
-- datos" indica que RLS bloquea al rol de conexión, crea políticas para ese rol
-- o utiliza un rol propietario; no desactives RLS si el proyecto expone API REST.
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penny_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Verificación rápida: debe devolver 0 en las tres columnas si todo está aplicado.
-- SELECT
--   (SELECT count(*) FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='orders' AND column_name='shipping_method') AS debe_ser_1,
--   (SELECT count(*) FROM information_schema.tables
--     WHERE table_schema='public' AND table_name='content_reports') AS debe_ser_1,
--   (SELECT count(*) FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='orders' AND column_name='width'
--       AND data_type='double precision') AS debe_ser_1;
