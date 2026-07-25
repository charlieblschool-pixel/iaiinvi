const TRIAL_DAYS = 14;

export function trialEndDate(from: Date = new Date()) {
  return new Date(from.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

type SubscriptionLike = {
  status: string | null;
  trialEndsAt: Date | null;
} | null;

export function isTrialActive(subscription: SubscriptionLike) {
  return Boolean(
    subscription?.status === "trialing" &&
      subscription.trialEndsAt &&
      subscription.trialEndsAt.getTime() > Date.now(),
  );
}

export function hasInventoryAccess(subscription: SubscriptionLike) {
  if (!subscription) return false;
  if (subscription.status === "active") return true;
  return isTrialActive(subscription);
}

export function trialDaysLeft(subscription: SubscriptionLike) {
  if (!subscription?.trialEndsAt) return null;
  const ms = subscription.trialEndsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
