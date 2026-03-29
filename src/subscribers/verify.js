import {
  getSubscriberByDiscordId,
  isActiveSubscriber,
  isDbEnabled,
  upsertSubscriberFromSubscription
} from "../db/subscribers.js";
import { findActiveSubscriptionByDiscordId } from "../stripe/subscriptions.js";

export async function verifyActiveSubscriber({ stripe, discordId }) {
  if (!discordId) {
    return { active: false, source: "invalid", subscription: null, subscriber: null, error: null };
  }

  let subscriber = null;
  let lastError = null;

  if (stripe) {
    try {
      const subscription = await findActiveSubscriptionByDiscordId({ stripe, discordId });
      if (subscription) {
        if (isDbEnabled()) {
          await upsertSubscriberFromSubscription({ discordId, subscription });
        }
        return {
          active: true,
          source: "stripe",
          subscription,
          subscriber,
          error: null
        };
      }
      return { active: false, source: "stripe", subscription: null, subscriber, error: null };
    } catch (err) {
      const message = err?.message || String(err);
      console.warn("[stripe] verify failed, falling back to db", message);
      lastError = "stripe";
    }
  }

  if (isDbEnabled()) {
    try {
      subscriber = await getSubscriberByDiscordId({ discordId });
      if (isActiveSubscriber(subscriber)) {
        return { active: true, source: "db", subscription: null, subscriber, error: null };
      }
    } catch (err) {
      const message = err?.message || String(err);
      console.warn("[db] verify failed", message);
      return {
        active: false,
        source: "db",
        subscription: null,
        subscriber: null,
        error: lastError ? `${lastError}+db` : "db"
      };
    }
  }

  return {
    active: false,
    source: "db",
    subscription: null,
    subscriber,
    error: lastError
  };
}
