import Link from "next/link";
import { COMPANY_NAME, SUPPORT_EMAIL } from "@/lib/site";

const purposes = {
  account: "crear y gestionar tu cuenta y los servicios que solicites",
  order: "gestionar tu solicitud de fabricación y comunicarnos contigo",
  gallery: "publicar el proyecto y gestionar la galería que solicitas",
  report: "recibir y tramitar tu comunicación sobre un contenido",
} as const;

/** Primera capa informativa; la política enlazada amplía el detalle. */
export function PrivacyNotice({ purpose }: { purpose: keyof typeof purposes }) {
  return <div className="privacy-notice"><p><strong>Protección de datos.</strong> Responsable: {COMPANY_NAME}. Finalidad: {purposes[purpose]}. Base: {purpose === "report" ? "obligación legal e interés legítimo" : "prestación o solicitud del servicio"}. Destinatarios: proveedores necesarios{purpose === "gallery" ? " y público de la galería" : ""}; puede haber transferencias fuera del EEE. Derechos: acceso, rectificación, supresión y otros en <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. <Link href="/legal/privacidad" target="_blank">Más información en la política de privacidad</Link>.</p></div>;
}
