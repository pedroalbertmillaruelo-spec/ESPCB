import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { projectLikes, projects } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { getProject } from "@/lib/gallery";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (new URL(request.url).searchParams.get("view") === "1") {
    await db.update(projects).set({ views: sql`${projects.views} + 1` }).where(and(eq(projects.id, id), eq(projects.isPublic, true)));
  }
  const project = await getProject(id);
  if (!project) return Response.json({ error: "Proyecto no encontrado." }, { status: 404 });
  const user = await getUser();
  if (user) {
    const [like] = await db.select({ id: projectLikes.id }).from(projectLikes).where(and(eq(projectLikes.projectId, id), eq(projectLikes.userId, user.id))).limit(1);
    project.liked = !!like;
  }
  return Response.json({ project }, { headers: { "Cache-Control": "no-store" } });
}
