import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project] = await db.select({ data: projects.gerberData, name: projects.gerberName }).from(projects).where(and(eq(projects.id, id), eq(projects.isPublic, true))).limit(1);
  if (!project) return new Response("No encontrado", { status: 404 });
  await db.update(projects).set({ downloads: sql`${projects.downloads} + 1` }).where(eq(projects.id, id));
  const name = project.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "gerbers.zip";
  return new Response(new Uint8Array(project.data), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"`, "X-Content-Type-Options": "nosniff" } });
}
