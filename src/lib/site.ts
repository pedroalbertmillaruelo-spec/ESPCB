/** Datos públicos. Los datos identificativos que aún no se conocen quedan vacíos, nunca inventados. */
export const SUPPORT_EMAIL = "espcb.soportecnico@gmail.com";
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
export const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() || "ESPCB S.L.";
export const COMPANY_NIF = process.env.NEXT_PUBLIC_COMPANY_NIF?.trim() || "";
export const COMPANY_ADDRESS = process.env.NEXT_PUBLIC_COMPANY_ADDRESS?.trim() || "";
export const COMPANY_REGISTER = process.env.NEXT_PUBLIC_COMPANY_REGISTER?.trim() || "";
export const COMPANY_PHONE = process.env.NEXT_PUBLIC_COMPANY_PHONE?.trim() || "";
/** Cambiar al modificar sustancialmente el texto de las condiciones. */
export const LEGAL_VERSION = "2026-10-27";
