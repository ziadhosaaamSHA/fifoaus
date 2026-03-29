import { createStripeEventDedupeCache } from "./idempotency.js";
import {
  isDbEnabled,
  upsertSubscriber,
  upsertSubscriberFromSubscription
} from "../db/subscribers.js";

const processedEvents = createStripeEventDedupeCache();
const inflight = new Map();

function getHeader(req, name) {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
}

async function resolveSubscriptionFromInvoice({ stripe, invoice }) {
  const subId = invoice?.subscription;
  if (!subId || typeof subId !== "string") return null;
  const subscription = await stripe.subscriptions.retrieve(subId);
  const discordId = subscription?.metadata?.discord_id;
  if (typeof discordId !== "string" || !/^\d{17,20}$/.test(discordId)) return null;
  return { discordId, subscription };
}

export function createStripeWebhookHandler({ cfg, stripe, bot }) {
  return async function stripeWebhook(req, res) {
    const signature = getHeader(req, "stripe-signature");
    if (!signature) return res.status(400).send("missing stripe-signature");

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, cfg.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.warn("[stripe] invalid signature", err?.message || err);
      return res.status(400).send("invalid signature");
    }

    if (processedEvents.has(event.id)) return res.status(200).json({ received: true });

    // If the same event hits concurrently, await the first processor.
    if (inflight.has(event.id)) {
      try {
        await inflight.get(event.id);
        return res.status(200).json({ received: true });
      } catch {
        return res.status(500).send("processing failed");
      }
    }

    const p = (async () => {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const discordId = session?.metadata?.discord_id;
          const accessToken = session?.metadata?.discord_access_token;
          if (typeof discordId !== "string" || !/^\d{17,20}$/.test(discordId)) {
            console.warn("[stripe] session missing discord_id metadata", session?.id);
            return;
          }
          if (isDbEnabled()) {
            const subscriptionId = session?.subscription;
            if (typeof subscriptionId === "string") {
              try {
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                await upsertSubscriberFromSubscription({ discordId, subscription });
              } catch (err) {
                console.warn("[db] failed to upsert from checkout session", err?.message || err);
              }
            } else {
              await upsertSubscriber({
                discordId,
                status: "active",
                currentPeriodEnd: null,
                stripeCustomerId: session?.customer || null,
                stripeSubscriptionId: subscriptionId || null
              }).catch((err) => {
                console.warn("[db] failed to upsert from checkout session", err?.message || err);
              });
            }
          }
          await bot.grantPremium({ discordId, accessToken, reason: "checkout.session.completed" });
          return;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object;
          const discordId = subscription?.metadata?.discord_id;
          if (typeof discordId !== "string" || !/^\d{17,20}$/.test(discordId)) {
            console.warn("[stripe] subscription missing discord_id metadata", subscription?.id);
            return;
          }
          if (isDbEnabled()) {
            await upsertSubscriberFromSubscription({ discordId, subscription });
          }
          return;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          const discordId = subscription?.metadata?.discord_id;
          if (typeof discordId !== "string" || !/^\d{17,20}$/.test(discordId)) {
            console.warn("[stripe] subscription missing discord_id metadata", subscription?.id);
            return;
          }
          if (isDbEnabled()) {
            await upsertSubscriberFromSubscription({ discordId, subscription });
          }
          await bot.revokePremium({ discordId, reason: "customer.subscription.deleted" });
          return;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const resolved = await resolveSubscriptionFromInvoice({ stripe, invoice });
          if (!resolved) {
            console.warn("[stripe] invoice.payment_failed: could not resolve discord_id", invoice?.id);
            return;
          }
          const { discordId, subscription } = resolved;
          if (isDbEnabled()) {
            await upsertSubscriberFromSubscription({ discordId, subscription });
          }
          await bot.revokePremium({ discordId, reason: "invoice.payment_failed" });
          return;
        }

        default:
          return;
      }
    })();

    inflight.set(event.id, p);
    try {
      await p;
      processedEvents.set(event.id, true);
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("[stripe] webhook handler error", event.type, err);
      return res.status(500).send("handler error");
    } finally {
      inflight.delete(event.id);
    }
  };
}
