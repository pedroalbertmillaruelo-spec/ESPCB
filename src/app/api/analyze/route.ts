import { analyzeGerbers, MAX_GERBER_BYTES } from "@/lib/gerber/layers";
import { checkBodySize, checkOrigin, message } from "@/lib/http";
export async function POST(request: Request) {
  try {
    checkOrigin(request); checkBodySize(request);
    const form = await request.formData();
    const file = form.get("gerber");
    if (!(file instanceof File) || file.size > MAX_GERBER_BYTES) throw new Error("Selecciona un ZIP de Gerbers de hasta 2 MB.");
    return Response.json(await analyzeGerbers(Buffer.from(await file.arrayBuffer())));
  } catch (error) { return Response.json({ error: message(error) }, { status: 400 }); }
}
