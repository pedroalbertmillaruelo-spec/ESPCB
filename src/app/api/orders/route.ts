import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { coupons, orders, projects } from "@/db/schema";
import { getUser, validEmail } from "@/lib/auth";
import { analyzeGerbers, MAX_GERBER_BYTES } from "@/lib/gerber/layers";
import { GerberValidationError } from "@/lib/gerber/errors";
import { validateGerberZip } from "@/lib/gerber/validator";
import { checkBodySize, checkOrigin, message } from "@/lib/http";
import { sendOrderMail } from "@/lib/mail";
import { requiereAceptacionDobleCara } from "@/lib/pcb/features";
import { calculateQuote } from "@/lib/pricing";
import { LEGAL_VERSION } from "@/lib/site";
import { findShippingOption, getShippingOptions, isValidCountryCode } from "@/lib/shipping";

export async function POST(request: Request) {
  try {
    checkOrigin(request); checkBodySize(request);
    const user = await getUser(); const form = await request.formData();
    const buyerName = String(form.get("buyerName") || "").trim();
    const buyerEmail = String(form.get("buyerEmail") || "").trim().toLowerCase();
    const shippingAddress = String(form.get("shippingAddress") || "").trim();
    const shippingCountry = String(form.get("shippingCountry") || "").trim().toUpperCase();
    const shippingPostalCode = String(form.get("shippingPostalCode") || "").trim();
    const shippingCity = String(form.get("shippingCity") || "").trim().slice(0, 100);
    const shippingOptionCode = String(form.get("shippingOptionCode") || "").trim();
    const notes = String(form.get("notes") || "").trim().slice(0, 1000);
    const projectId = String(form.get("projectId") || ""); const couponId = String(form.get("couponId") || "");
    const quantity = Number(form.get("quantity"));
    let width = Number(form.get("width")); let height = Number(form.get("height"));
    let gerberData: Buffer; let gerberName: string;
    if (buyerName.length < 2 || buyerName.length > 100 || !validEmail(buyerEmail)) throw new Error("Introduce tu nombre y un correo válido.");
    if (form.get("termsAccepted") !== "true") throw new Error("Debes aceptar las condiciones de uso y de la solicitud.");
    if (form.get("adultConfirmed") !== "true") throw new Error("Confirma que eres mayor de edad (18 años o más) para enviar una solicitud.");
    if (shippingAddress.length < 8 || shippingAddress.length > 300) throw new Error("Introduce una dirección de envío completa.");
    if (!isValidCountryCode(shippingCountry)) throw new Error("Selecciona un país de envío válido.");
    if (shippingPostalCode.length < 3 || shippingPostalCode.length > 10) throw new Error("Introduce un código postal válido.");
    if (!shippingOptionCode) throw new Error("Elige una modalidad de envío antes de continuar.");
    if (projectId) {
      const [project] = await db.select({ width: projects.width, height: projects.height, layers: projects.layers, gerberData: projects.gerberData, gerberName: projects.gerberName }).from(projects).where(and(eq(projects.id, projectId), eq(projects.isPublic, true))).limit(1);
      if (!project) throw new Error("El proyecto ya no está disponible en la galería.");
      if (project.layers > 2) throw new Error("Por ahora solo fabricamos placas de 1 o 2 caras. Puedes descargar este diseño multicapa.");
      width = project.width; height = project.height; gerberData = project.gerberData; gerberName = project.gerberName;
    } else {
      const gerber = form.get("gerber");
      if (!(gerber instanceof File) || !gerber.name.toLowerCase().endsWith(".zip") || gerber.size > MAX_GERBER_BYTES) throw new Error("Sube tu ZIP de Gerbers de hasta 2 MB.");
      gerberData = Buffer.from(await gerber.arrayBuffer()); gerberName = gerber.name.slice(0, 120);
    }
    const analysis = await analyzeGerbers(gerberData);
    if (analysis.faces.innerFiles.length) throw new Error("Por ahora solo fabricamos placas de 1 o 2 caras; el ZIP contiene capas internas.");
    // Si existe contorno verificable, las dimensiones reales prevalecen sobre las enviadas por el cliente.
    try {
      const verified = validateGerberZip(gerberData, gerberName);
      width = Math.min(150, verified.board.shortSideMm); height = Math.min(200, verified.board.longSideMm);
    } catch (error) { if (!(error instanceof GerberValidationError) || error.code !== "OUTLINE_NOT_FOUND") throw error; }
    const accepted = form.get("twoSidedAccepted") === "true";
    if (requiereAceptacionDobleCara(analysis.layers) && !accepted) throw new Error("Debes aceptar las condiciones del prototipo de dos caras sin metalizado de vías.");
    if (couponId && !user) throw new Error("Inicia sesión para utilizar un cupón.");

    // El precio del envío nunca se acepta del cliente: se vuelve a calcular aquí con las
    // medidas verificadas y el destino indicado, y se exige que coincida con una opción
    // realmente ofrecida en este momento (tarifa de Correos o de DHL si está configurado).
    const shippingQuote = await getShippingOptions({ destination: { country: shippingCountry, postalCode: shippingPostalCode, city: shippingCity }, widthMm: width, heightMm: height, quantity });
    const shippingOption = findShippingOption(shippingQuote.options, shippingOptionCode);
    if (!shippingOption) throw new Error("La modalidad de envío elegida ya no está disponible para este destino. Vuelve a seleccionar el envío.");

    const id = randomUUID(); const orderNumber = `ES-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const quote = await db.transaction(async (tx) => {
      let rewardCode: string | undefined;
      if (couponId && user) {
        const [coupon] = await tx.select().from(coupons).where(and(eq(coupons.id, couponId), eq(coupons.userId, user.id))).for("update");
        if (!coupon || coupon.status !== "available") throw new Error("El cupón no está disponible.");
        rewardCode = coupon.rewardCode;
      }
      const calculated = calculateQuote(width, height, quantity, { rewardCode, shippingCents: shippingOption.cents, shippingPromoEligible: shippingOption.promoEligible });
      await tx.insert(orders).values({
        id, orderNumber, userId: user?.id || null, projectId: projectId || null, buyerName, buyerEmail, shippingAddress,
        shippingMethod: shippingOption.code, shippingCarrier: shippingOption.carrier, shippingService: shippingOption.service,
        shippingSource: shippingOption.source, shippingEtaDays: shippingOption.etaDays,
        shippingCountry, shippingPostalCode, shippingCity,
        width, height, quantity, layers: analysis.layers, holes: analysis.holes, twoSidedAccepted: accepted, gerberName, gerberData,
        baseCents: calculated.base, shippingCents: calculated.shipping, discountCents: calculated.discount, totalCents: calculated.total,
        couponId: couponId || null, notes, termsAcceptedAt: new Date(), termsVersion: LEGAL_VERSION, adultConfirmed: true,
      });
      if (couponId) await tx.update(coupons).set({ status: "reserved", orderId: id }).where(eq(coupons.id, couponId));
      return calculated;
    });
    const sent = await sendOrderMail({
      orderNumber, buyerName, buyerEmail, shippingAddress, shippingCountry, shippingPostalCode, shippingCity,
      shippingCarrier: shippingOption.carrier, shippingService: shippingOption.service, shippingEtaDays: shippingOption.etaDays, shippingSource: shippingOption.source,
      width, height, quantity, layers: analysis.layers, holes: analysis.holes, baseCents: quote.base, shippingCents: quote.shipping, discountCents: quote.discount, totalCents: quote.total,
      notes, gerberName, gerberData,
    });
    await db.update(orders).set({ emailStatus: sent ? "sent" : "not_sent" }).where(eq(orders.id, id)).catch(console.error);
    return Response.json({ ok: true, orderNumber, total: quote.total, emailSent: sent });
  } catch (error) { return Response.json({ error: message(error) }, { status: 400 }); }
}
