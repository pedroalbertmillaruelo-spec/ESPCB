import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project] = await db.select({ image: projects.imageData, type: projects.imageType }).from(projects).where(and(eq(projects.id, id), eq(projects.isPublic, true))).limit(1);
  if (!project) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(project.image), { headers: { "Content-Type": project.type, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}
