import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, users } from "@/db/schema";
import { slugify } from "@/lib/gallery-options";

export type GalleryProject = {
  id: string; slug: string; title: string; description: string; category: string; tags: string[];
  difficulty: string; license: string; cadFormat: string; components: number; featured: boolean;
  width: number; height: number; layers: number; holes: number; downloads: number; likes: number; views: number;
  author: string; authorHandle: string; image: string; createdAt: string; liked?: boolean;
};
const projectFields = {
  id: projects.id, title: projects.title, description: projects.description, category: projects.category,
  tags: projects.tags, difficulty: projects.difficulty, license: projects.license, cadFormat: projects.cadFormat,
  components: projects.components, featured: projects.featured, width: projects.width, height: projects.height,
  layers: projects.layers, holes: projects.holes, downloads: projects.downloads, likes: projects.likes, views: projects.views,
  author: users.name, createdAt: projects.createdAt,
};
type ProjectRow = { [K in keyof typeof projectFields]: typeof projectFields[K] extends { _: { data: infer D } } ? D : never };
function formatProject(row: ProjectRow): GalleryProject {
  return { ...row, slug: `${slugify(row.title) || "proyecto"}-${row.id.slice(0, 8)}`, authorHandle: slugify(row.author), image: `/api/projects/${row.id}/image`, createdAt: row.createdAt.toISOString() };
}
export async function getGallery(): Promise<GalleryProject[]> {
  try {
    const rows = await db.select(projectFields).from(projects).innerJoin(users, eq(projects.userId, users.id)).where(eq(projects.isPublic, true)).orderBy(desc(projects.createdAt)).limit(200);
    return rows.map(formatProject);
  } catch (error) { console.error("No se pudo cargar la galería:", error); return []; }
}
export async function getProject(id: string): Promise<GalleryProject | null> {
  const [row] = await db.select(projectFields).from(projects).innerJoin(users, eq(projects.userId, users.id)).where(and(eq(projects.id, id), eq(projects.isPublic, true))).limit(1);
  return row ? formatProject(row) : null;
}
