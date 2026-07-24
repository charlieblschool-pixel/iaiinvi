import type { ActivityType } from "@/generated/prisma/enums";

type BadgeTone = "good" | "warn" | "bad" | "neutral";

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  STOCK_ADJUSTED: "Stock adjusted",
  SUGGESTION_CREATED: "Suggestion created",
  SUGGESTION_APPROVED: "Approved",
  SUGGESTION_SKIPPED: "Skipped",
  AUTO_CHARGED: "Auto-charged",
  SETTINGS_CHANGED: "Settings changed",
  MEMBER_INVITED: "Team",
};

export const ACTIVITY_TONES: Record<ActivityType, BadgeTone> = {
  STOCK_ADJUSTED: "neutral",
  SUGGESTION_CREATED: "warn",
  SUGGESTION_APPROVED: "good",
  SUGGESTION_SKIPPED: "neutral",
  AUTO_CHARGED: "good",
  SETTINGS_CHANGED: "neutral",
  MEMBER_INVITED: "neutral",
};
