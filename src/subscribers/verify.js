import { isDbEnabled, upsertSubscriberFromSubscription } from "../db/subscribers.js";
import { findActiveSubscriptionByDiscordId } from "../stripe/subscriptions.js";

export async function verifyActiveSubscriber({ stripe, discordId }) {
  if (!discordId) {
    return { active: false, source: "invalid", subscription: null, subscriber: null, error: null };
  }

  if (!stripe) {
    return {
      active: false,
      source: "stripe",
      subscription: null,
      subscriber: null,
      error: "stripe_unavailable"
    };
  }

  try {
    const subscription = await findActiveSubscriptionByDiscordId({ stripe, discordId });
    if (subscription) {
      if (isDbEnabled()) {
        try {
          await upsertSubscriberFromSubscription({ discordId, subscription });
        } catch (err) {
          const message = err?.message || String(err);
          console.warn("[db] upsert failed", message);
        }
      }
      return {
        active: true,
        source: "stripe",
        subscription,
        subscriber: null,
        error: null
      };
    }
    return {
      active: false,
      source: "stripe",
      subscription: null,
      subscriber: null,
      error: null
    };
  } catch (err) {
    const message = err?.message || String(err);
    console.warn("[stripe] verify failed", message);
    return {
      active: false,
      source: "stripe",
      subscription: null,
      subscriber: null,
      error: "stripe_error"
    };
  }
}
