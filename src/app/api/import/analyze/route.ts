import { NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { hasInventoryAccess } from "@/lib/billing";
import { checkRateLimit } from "@/lib/rate-limit";
import { analyzeSheet, sheetAnalystEnabled } from "@/lib/sheet-analyst";

export const maxDuration = 60;

// Claude sees at most this much of a sheet — plenty to understand its layout.
const MAX_ROWS = 250;
const MAX_COLS = 40;

const bodySchema = z.object({
  sheetName: z.string().max(120).default("Sheet"),
  rows: z.array(z.array(z.string().max(500)).max(200)).min(1).max(5000),
  knownLocations: z.array(z.string().max(80)).max(200).default([]),
});

export async function POST(request: Request) {
  if (!sheetAnalystEnabled()) {
    return NextResponse.json({ available: false }, { status: 503 });
  }

  const { organization } = await requireOrg();
  const subscription = await prisma.subscription.findUnique({ where: { organizationId: organization.id } });
  if (!hasInventoryAccess(subscription)) {
    return NextResponse.json({ error: "Your free trial has ended." }, { status: 402 });
  }

  if (!(await checkRateLimit(`sheet-analyst:${organization.id}`, 40, 60))) {
    return NextResponse.json(
      { error: "Lots of sheets this hour — using the standard reader for now." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sheet" }, { status: 400 });
  }
  const rows = parsed.data.rows.slice(0, MAX_ROWS).map((r) => r.slice(0, MAX_COLS));

  try {
    const analysis = await analyzeSheet({
      sheetName: parsed.data.sheetName,
      rows,
      knownLocations: parsed.data.knownLocations,
    });
    return NextResponse.json({ available: true, analysis, analyzedRows: rows.length });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Claude is busy — using the standard reader." }, { status: 429 });
    } else if (err instanceof Anthropic.APIError) {
      console.error("[sheet-analyst] API error", err.status, err.message);
    } else {
      console.error("[sheet-analyst] failed", err);
    }
    return NextResponse.json({ error: "Claude couldn't read this sheet — using the standard reader." }, { status: 502 });
  }
}
