import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { projectLikes, projects } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { checkOrigin, message } from "@/lib/http";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(request);
    const user = await getUser();
    if (!user) return Response.json({ error: "Inicia sesión para guardar tus favoritos." }, { status: 401 });
    const { id } = await params; const body = await request.json();
    if (typeof body.liked !== "boolean") throw new Error("Acción no válida.");
    const result = await db.transaction(async (tx) => {
      const [project] = await tx.select({ id: projects.id, likes: projects.likes }).from(projects).where(and(eq(projects.id, id), eq(projects.isPublic, true))).for("update");
      if (!project) throw new Error("Proyecto no encontrado.");
      let difference = 0;
      if (body.liked) {
        const inserted = await tx.insert(projectLikes).values({ id: randomUUID(), projectId: id, userId: user.id }).onConflictDoNothing().returning({ id: projectLikes.id });
        if (inserted.length) difference = 1;
      } else {
        const removed = await tx.delete(projectLikes).where(and(eq(projectLikes.projectId, id), eq(projectLikes.userId, user.id))).returning({ id: projectLikes.id });
        if (removed.length) difference = -1;
      }
      if (difference) await tx.update(projects).set({ likes: sql`GREATEST(0, ${projects.likes} + ${difference})` }).where(eq(projects.id, id));
      return { liked: body.liked, likes: Math.max(0, project.likes + difference) };
    });
    return Response.json(result);
  } catch (error) { return Response.json({ error: message(error) }, { status: 400 }); }
}
