import {
  getSubscriberByDiscordId,
  isActiveSubscriber,
  isDbEnabled,
  upsertSubscriberFromSubscription
} from "../db/subscribers.js";
import { findActiveSubscriptionByDiscordId } from "../stripe/subscriptions.js";

export async function verifyActiveSubscriber({ stripe, discordId }) {
  if (!discordId) {
    return { active: false, source: "invalid", subscription: null, subscriber: null };
  }

  let subscriber = null;

  if (stripe) {
    try {
      const subscription = await findActiveSubscriptionByDiscordId({ stripe, discordId });
      if (subscription) {
        if (isDbEnabled()) {
          await upsertSubscriberFromSubscription({ discordId, subscription });
        }
        return { active: true, source: "stripe", subscription, subscriber };
      }
      return { active: false, source: "stripe", subscription: null, subscriber };
    } catch (err) {
      const message = err?.message || String(err);
      console.warn("[stripe] verify failed, falling back to db", message);
    }
  }

  if (isDbEnabled()) {
    subscriber = await getSubscriberByDiscordId({ discordId });
    if (isActiveSubscriber(subscriber)) {
      return { active: true, source: "db", subscription: null, subscriber };
    }
  }

  return { active: false, source: "db", subscription: null, subscriber };
}
