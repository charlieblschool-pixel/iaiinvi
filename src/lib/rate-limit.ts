import { prisma } from "@/lib/prisma";

/**
 * DB-backed request counter so rate limits hold across serverless
 * instances (an in-memory counter wouldn't). Returns true if the request
 * is allowed and records the attempt; false if the limit is already hit.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMinutes: number,
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const count = await prisma.authAttempt.count({
      where: { key, createdAt: { gte: since } },
    });
    if (count >= limit) return false;

    await prisma.authAttempt.create({ data: { key } });
    return true;
  } catch (err) {
    // Fail open — a rate-limit outage shouldn't be able to take down
    // login/signup entirely.
    console.error("[rate-limit] check failed, allowing request", err);
    return true;
  }
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
