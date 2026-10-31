import { allowRequest, clientKey, retryAfterSeconds } from "@/lib/gerber/rate-limit";
import { checkBodySize, checkOrigin, message } from "@/lib/http";
import { boardCategory } from "@/lib/pricing";
import { getShippingOptions } from "@/lib/shipping";
import { isValidCountryCode } from "@/lib/shipping/countries";

export async function POST(request: Request) {
  const key = `shipping:${clientKey(request)}`;
  const rate = { max: 30, windowMs: 10 * 60 * 1000 };
  if (!allowRequest(key, rate)) {
    return Response.json({ error: "Demasiadas consultas de envío. Inténtalo de nuevo en unos minutos." }, {
      status: 429, headers: { "Retry-After": String(retryAfterSeconds(key, rate)) },
    });
  }
  try {
    checkOrigin(request); checkBodySize(request);
    const body = await request.json();
    const country = String(body.country || "").trim().toUpperCase();
    const postalCode = String(body.postalCode || "").trim();
    const city = String(body.city || "").trim().slice(0, 100);
    const width = Number(body.width);
    const height = Number(body.height);
    const quantity = Number(body.quantity);
    if (!isValidCountryCode(country)) throw new Error("Selecciona un país válido.");
    if (postalCode.length < 3 || postalCode.length > 10) throw new Error("Introduce un código postal válido.");
    if (!boardCategory(width, height)) throw new Error("Indica unas medidas de placa válidas antes de calcular el envío.");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) throw new Error("Indica una cantidad de placas válida.");
    const result = await getShippingOptions({ destination: { country, postalCode, city }, widthMm: width, heightMm: height, quantity });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: message(error) }, { status: 400 }); }
}
