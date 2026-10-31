import { timingSafeEqual } from "node:crypto";
export function isAdmin(request: Request) {
  const configured = process.env.ADMIN_API_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!configured || configured.length < 16) return false;
  const a = Buffer.from(configured); const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}
