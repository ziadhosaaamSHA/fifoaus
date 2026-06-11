import { isDbEnabled, upsertSubscriberFromSubscription } from "../db/subscribers.js";
import { findActiveSubscriptionByDiscordId } from "../stripe/subscriptions.js";

/**
 * Verifies if a user has an active premium subscription.
 * Checks Stripe subscription metadata and upserts the result to the local DB if enabled.
 * 
 * @param {Object} params
 * @param {Object} params.stripe - Stripe client instance
 * @param {string} params.discordId - The Discord user ID to verify
 * @returns {Promise<Object>} Verification status object
 */
export async function verifyActiveSubscriber({ stripe, discordId }) {
  // Guard clause for missing Discord ID
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
