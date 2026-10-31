import { sql } from "drizzle-orm";
import { boolean, customType, doublePrecision, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType() { return "bytea"; } });
/** Secretos generados por el propio servidor (p. ej. la clave de firma de sesión). Sin datos de usuarios. */
export const appSecrets = pgTable("app_secrets", {
  key: text("key").primaryKey(), value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const users = pgTable("users", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(), pennies: integer("pennies").notNull().default(0),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  termsVersion: text("terms_version"), adultConfirmed: boolean("adult_confirmed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const projects = pgTable("projects", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id),
  title: text("title").notNull(), description: text("description").notNull(), category: text("category").notNull(),
  difficulty: text("difficulty").notNull().default("Principiante"), license: text("license").notNull().default("CC BY 4.0"),
  cadFormat: text("cad_format").notNull().default("Solo Gerber"), tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  components: integer("components").notNull().default(0), featured: boolean("featured").notNull().default(false),
  width: doublePrecision("width").notNull(), height: doublePrecision("height").notNull(), layers: integer("layers").notNull(),
  holes: integer("holes").notNull().default(0), imageType: text("image_type").notNull(), imageData: bytea("image_data").notNull(),
  gerberName: text("gerber_name").notNull(), gerberData: bytea("gerber_data").notNull(),
  isPublic: boolean("is_public").notNull().default(true), downloads: integer("downloads").notNull().default(0),
  likes: integer("likes").notNull().default(0), views: integer("views").notNull().default(0),
  rightsAcceptedAt: timestamp("rights_accepted_at", { withTimezone: true }), rightsTermsVersion: text("rights_terms_version"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const projectLikes = pgTable("project_likes", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("project_likes_project_user_unique").on(table.projectId, table.userId)]);
export const coupons = pgTable("coupons", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id),
  code: text("code").notNull().unique(), rewardCode: text("reward_code").notNull(), cost: integer("cost").notNull(),
  status: text("status").notNull().default("available"), orderId: text("order_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const orders = pgTable("orders", {
  id: text("id").primaryKey(), orderNumber: text("order_number").notNull().unique(),
  userId: text("user_id").references(() => users.id), projectId: text("project_id").references(() => projects.id),
  buyerName: text("buyer_name").notNull(), buyerEmail: text("buyer_email").notNull(),
  shippingAddress: text("shipping_address").notNull().default(""),
  // shipping_method guarda el código de la opción elegida (p. ej. "correos_estandar", "dhl_P", "manual_quote").
  shippingMethod: text("shipping_method").notNull().default("standard"),
  shippingCarrier: text("shipping_carrier").notNull().default(""), shippingService: text("shipping_service").notNull().default(""),
  shippingSource: text("shipping_source").notNull().default("tariff"), shippingEtaDays: text("shipping_eta_days").notNull().default(""),
  shippingCountry: text("shipping_country").notNull().default("ES"), shippingPostalCode: text("shipping_postal_code").notNull().default(""),
  shippingCity: text("shipping_city").notNull().default(""),
  width: doublePrecision("width").notNull(), height: doublePrecision("height").notNull(), quantity: integer("quantity").notNull(),
  layers: integer("layers").notNull(), holes: integer("holes").notNull(), twoSidedAccepted: boolean("two_sided_accepted").notNull().default(false),
  gerberName: text("gerber_name").notNull(), gerberData: bytea("gerber_data").notNull(),
  baseCents: integer("base_cents").notNull(), shippingCents: integer("shipping_cents").notNull(),
  discountCents: integer("discount_cents").notNull().default(0), totalCents: integer("total_cents").notNull(),
  couponId: text("coupon_id").references(() => coupons.id), notes: text("notes").notNull().default(""),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }), termsVersion: text("terms_version"),
  adultConfirmed: boolean("adult_confirmed").notNull().default(false),
  status: text("status").notNull().default("pending"), emailStatus: text("email_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const contentReports = pgTable("content_reports", {
  id: text("id").primaryKey(), reportNumber: text("report_number").notNull().unique(),
  projectId: text("project_id"), location: text("location").notNull(), reason: text("reason").notNull(),
  reporterName: text("reporter_name"), reporterEmail: text("reporter_email"),
  goodFaith: boolean("good_faith").notNull().default(false), status: text("status").notNull().default("pending"),
  decision: text("decision"), emailStatus: text("email_status").notNull().default("pending"),
  receiptStatus: text("receipt_status").notNull().default("pending"), decisionEmailStatus: text("decision_email_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});
export const pennyLedger = pgTable("penny_ledger", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id),
  orderId: text("order_id").references(() => orders.id), type: text("type").notNull(), amount: integer("amount").notNull(),
  description: text("description").notNull(),
  // Concesiones: pasan por revisión manual antes de abonarse (pending → approved | rejected).
  // Los movimientos históricos y los reembolsos se guardan ya como approved.
  status: text("status").notNull().default("approved"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNote: text("review_note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("penny_ledger_order_type_unique").on(table.orderId, table.type)]);
