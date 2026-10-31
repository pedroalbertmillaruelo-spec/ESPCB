import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { getGallery } from "@/lib/gallery";
import { CATEGORIES, CAD_FORMATS, DIFFICULTIES, LICENSES, LAYER_OPTIONS } from "@/lib/gallery-options";
import { analyzeGerbers, imageMime, MAX_GERBER_BYTES, MAX_IMAGE_BYTES } from "@/lib/gerber/layers";
import { GerberValidationError } from "@/lib/gerber/errors";
import { validateGerberZip } from "@/lib/gerber/validator";
import { checkBodySize, checkOrigin, message } from "@/lib/http";
import { boardCategory } from "@/lib/pricing";
import { LEGAL_VERSION } from "@/lib/site";

export const dynamic = "force-dynamic";
export async function GET() { return Response.json({ projects: await getGallery() }); }
export async function POST(request: Request) {
  try {
    checkOrigin(request); checkBodySize(request);
    const user = await getUser();
    if (!user) return Response.json({ error: "Inicia sesión para publicar tu proyecto." }, { status: 401 });
    if (!user.adultConfirmed || user.termsVersion !== LEGAL_VERSION) return Response.json({ error: "Revisa y acepta las condiciones actuales de tu cuenta antes de publicar." }, { status: 403 });
    const form = await request.formData();
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const category = String(form.get("category") || "");
    const difficulty = String(form.get("difficulty") || "Principiante");
    const license = String(form.get("license") || "CC BY 4.0");
    const cadFormat = String(form.get("cadFormat") || "Solo Gerber");
    const layers = Number(form.get("layers") || 2);
    const components = Number(form.get("components") || 0);
    const tags = [...new Set(String(form.get("tags") || "").split(",").map((tag) => tag.trim().slice(0, 24)).filter(Boolean))].slice(0, 8);
    let width = Number(form.get("width")); let height = Number(form.get("height"));
    const gerber = form.get("gerber"); const image = form.get("image");
    if (title.length < 3 || title.length > 90 || description.length < 10 || description.length > 1500) throw new Error("Añade un título y una descripción de al menos 10 caracteres.");
    if (!boardCategory(width, height)) throw new Error("Indica dimensiones válidas, hasta 150 × 200 mm y con dos decimales como máximo.");
    if (!(CATEGORIES as readonly string[]).includes(category)) throw new Error("Selecciona una categoría válida.");
    if (!(DIFFICULTIES as readonly string[]).includes(difficulty) || !(LICENSES as readonly string[]).includes(license) || !(CAD_FORMATS as readonly string[]).includes(cadFormat)) throw new Error("Selecciona dificultad, licencia y formato CAD válidos.");
    if (!(LAYER_OPTIONS as readonly number[]).includes(layers)) throw new Error("Selecciona un número de capas válido.");
    if (!Number.isInteger(components) || components < 0 || components > 10000) throw new Error("Indica un número de componentes válido.");
    if (form.get("rights") !== "true") throw new Error("Confirma que tienes derecho a compartir el diseño.");
    if (!(gerber instanceof File) || !gerber.name.toLowerCase().endsWith(".zip") || gerber.size > MAX_GERBER_BYTES) throw new Error("Añade un ZIP de Gerbers de hasta 2 MB.");
    if (!(image instanceof File) || image.size > MAX_IMAGE_BYTES) throw new Error("Añade una imagen JPG, PNG o WebP de hasta 1 MB.");
    const gerberData = Buffer.from(await gerber.arrayBuffer()); const imageData = Buffer.from(await image.arrayBuffer());
    const type = imageMime(imageData);
    if (!type) throw new Error("La imagen debe ser JPG, PNG o WebP y pesar como máximo 1 MB.");
    const analysis = await analyzeGerbers(gerberData);
    if (!analysis.faces.detected) throw new Error("No se ha detectado ninguna capa de cobre en el ZIP.");
    if (layers <= 2 && layers !== analysis.faces.count) throw new Error(`El ZIP muestra ${analysis.faces.count} ${analysis.faces.count === 1 ? "cara" : "caras"}. Revisa las capas declaradas.`);
    if (layers <= 2 && analysis.faces.innerFiles.length) throw new Error("Se han detectado capas internas. Selecciona 4 o 6 capas.");
    if (analysis.faces.copperLayers > layers) throw new Error("El ZIP contiene más capas de cobre de las declaradas.");
    // Cuando hay contorno válido, las medidas se obtienen del archivo, no del navegador.
    try { const verified = validateGerberZip(gerberData, gerber.name); width = Math.min(150, verified.board.shortSideMm); height = Math.min(200, verified.board.longSideMm); }
    catch (e) { if (!(e instanceof GerberValidationError) || e.code !== "OUTLINE_NOT_FOUND") throw e; }
    if (!boardCategory(width, height)) throw new Error("El contorno de la placa supera el tamaño admitido.");
    const id = randomUUID();
    await db.insert(projects).values({ id, userId: user.id, title, description, category, difficulty, license, cadFormat, tags, components, width, height, layers, holes: analysis.holes, imageType: type, imageData, gerberName: gerber.name.slice(0, 120), gerberData, rightsAcceptedAt: new Date(), rightsTermsVersion: LEGAL_VERSION });
    return Response.json({ ok: true, id, analysis });
  } catch (error) { return Response.json({ error: message(error) }, { status: 400 }); }
}
