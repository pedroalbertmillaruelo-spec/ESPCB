import nodemailer from "nodemailer";
import { euros } from "@/lib/pricing";
import { SUPPORT_EMAIL } from "@/lib/site";
import type { ShippingSource } from "@/lib/shipping";

function mailSettings() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return {
    transport: nodemailer.createTransport({ host: SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: process.env.SMTP_SECURE !== "false", connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000, auth: { user: SMTP_USER, pass: SMTP_PASS } }),
    from: process.env.SMTP_FROM || SMTP_USER,
    to: process.env.ORDER_EMAIL_TO || SUPPORT_EMAIL,
  };
}
const SOURCE_LABEL: Record<ShippingSource, string> = { api: "tiempo real", tariff: "tarifa oficial publicada", manual: "a confirmar manualmente" };
export async function sendOrderMail(order: { orderNumber: string; buyerName: string; buyerEmail: string; shippingAddress: string; shippingCountry: string; shippingPostalCode: string; shippingCity: string; shippingCarrier: string; shippingService: string; shippingEtaDays: string; shippingSource: ShippingSource; shippingCents: number; width: number; height: number; quantity: number; layers: number; holes: number; baseCents: number; discountCents: number; totalCents: number; notes: string; gerberName: string; gerberData: Buffer }) {
  const mail = mailSettings(); if (!mail) return false;
  const text = `Nueva solicitud ${order.orderNumber}\n\nCliente: ${order.buyerName}\nCorreo: ${order.buyerEmail}\nDirección de envío: ${order.shippingAddress}\nDestino: ${order.shippingCity ? `${order.shippingCity}, ` : ""}${order.shippingPostalCode}, ${order.shippingCountry}\nPlaca: ${order.width} × ${order.height} mm (${order.width * order.height} mm²)\nCantidad: ${order.quantity}\nCaras: ${order.layers}\nAgujeros/vías: ${order.holes}\nPlacas: ${euros(order.baseCents)}\nEnvío: ${order.shippingCarrier} · ${order.shippingService} (${order.shippingEtaDays} días, ${SOURCE_LABEL[order.shippingSource]}): ${euros(order.shippingCents)}\nDescuento: ${euros(order.discountCents)}\nTotal orientativo: ${euros(order.totalCents)}\nNotas: ${order.notes || "Sin notas"}\n\nEl pedido está pendiente de revisión y no se ha cobrado.`;
  try {
    await mail.transport.sendMail({ from: mail.from, to: mail.to, replyTo: order.buyerEmail, subject: `Solicitud PCB ${order.orderNumber}`, text, attachments: [{ filename: order.gerberName.replace(/[^a-zA-Z0-9._-]/g, "_"), content: order.gerberData }] });
    // Acuse informativo al cliente; no es una aceptación de fabricación ni un cobro.
    try { await mail.transport.sendMail({ from: mail.from, to: order.buyerEmail, replyTo: SUPPORT_EMAIL, subject: `Hemos recibido tu solicitud ${order.orderNumber}`, text: `Hola ${order.buyerName}:\n\nHemos recibido tu solicitud ${order.orderNumber} con un total estimado de ${euros(order.totalCents)} (envío: ${order.shippingCarrier} · ${order.shippingService}). La revisaremos y contactaremos contigo antes de cualquier fabricación. Esta solicitud no implica cobro ni aceptación de un pedido.\n\nSi tienes alguna pregunta, escríbenos a ${SUPPORT_EMAIL}.\n\nEquipo ESPCB` }); }
    catch (error) { console.error("No se pudo enviar el acuse al cliente:", error); }
    return true;
  } catch (error) { console.error("No se pudo enviar el pedido por SMTP:", error); return false; }
}
export async function sendContentReportMail(report: { reportNumber: string; projectId: string | null; location: string; reason: string; reporterName: string | null; reporterEmail: string | null }) {
  const mail = mailSettings(); if (!mail) return { teamSent: false, receiptSent: false };
  let teamSent = false; let receiptSent = false;
  try {
    await mail.transport.sendMail({ from: mail.from, to: mail.to, ...(report.reporterEmail ? { replyTo: report.reporterEmail } : {}), subject: `Aviso de contenido ${report.reportNumber}`, text: `Aviso ${report.reportNumber}\nProyecto: ${report.projectId || "no indicado"}\nUbicación: ${report.location}\nMotivo: ${report.reason}\nNombre: ${report.reporterName || "no indicado"}\nCorreo: ${report.reporterEmail || "no indicado"}\n\nGestiona el aviso desde /admin.` });
    teamSent = true;
  } catch (error) { console.error("No se pudo notificar al equipo:", error); }
  if (report.reporterEmail) {
    try { await mail.transport.sendMail({ from: mail.from, to: report.reporterEmail, replyTo: SUPPORT_EMAIL, subject: `Acuse de tu aviso ${report.reportNumber}`, text: `Hemos recibido tu aviso ${report.reportNumber}. Lo revisaremos de manera diligente y te comunicaremos la decisión a esta dirección.\n\nContacto: ${SUPPORT_EMAIL}\n\nEquipo ESPCB` }); receiptSent = true; }
    catch (error) { console.error("No se pudo enviar el acuse del aviso:", error); }
  }
  return { teamSent, receiptSent };
}
export async function sendReportDecision(report: { reportNumber: string; reporterEmail: string | null; decision: string }) {
  const mail = mailSettings(); if (!mail || !report.reporterEmail) return false;
  try {
    await mail.transport.sendMail({ from: mail.from, to: report.reporterEmail, replyTo: SUPPORT_EMAIL, subject: `Respuesta a tu aviso ${report.reportNumber}`, text: `Hemos revisado tu aviso ${report.reportNumber}.\n\nDecisión: ${report.decision}\n\nSi no estás de acuerdo o necesitas información adicional, responde a este correo o escríbenos a ${SUPPORT_EMAIL}.\n\nEquipo ESPCB` });
    return true;
  } catch (error) { console.error("No se pudo enviar la decisión del aviso:", error); return false; }
}
