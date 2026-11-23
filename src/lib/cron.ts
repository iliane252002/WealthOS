import type { NextRequest } from "next/server";

/** Vercel Cron appelle les routes en GET avec « Authorization: Bearer <CRON_SECRET> ». */
export function cronAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.headers.get("x-cron-secret") === secret
  );
}
