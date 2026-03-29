import { isDbEnabled, query } from "./pool.js";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export function isActiveSubscriber(record) {
  return Boolean(record && ACTIVE_STATUSES.has(record.status));
}

export { isDbEnabled };

export async function getSubscriberByDiscordId({ discordId }) {
  if (!isDbEnabled()) {
    throw new Error("database_not_configured");
  }
  const { rows } = await query(
    `
    SELECT discord_id, status, stripe_subscription_id, stripe_customer_id, current_period_end
    FROM subscribers
    WHERE discord_id::text = $1
    LIMIT 1
    `,
    [discordId]
  );
  return rows[0] || null;
}

export async function upsertSubscriber({
  discordId,
  stripeCustomerId,
  stripeSubscriptionId,
  status,
  currentPeriodEnd
}) {
  if (!isDbEnabled()) {
    throw new Error("database_not_configured");
  }
  await query(
    `
    INSERT INTO subscribers (
      discord_id,
      stripe_customer_id,
      stripe_subscription_id,
      status,
      current_period_end,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (discord_id)
    DO UPDATE SET
      stripe_customer_id = EXCLUDED.stripe_customer_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      status = EXCLUDED.status,
      current_period_end = EXCLUDED.current_period_end,
      updated_at = NOW()
    `,
    [
      discordId,
      stripeCustomerId || null,
      stripeSubscriptionId || null,
      status || null,
      currentPeriodEnd || null
    ]
  );
}

export async function upsertSubscriberFromSubscription({ discordId, subscription }) {
  if (!discordId || !subscription) return;

  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;

  await upsertSubscriber({
    discordId,
    stripeCustomerId: subscription.customer || null,
    stripeSubscriptionId: subscription.id || null,
    status: subscription.status || null,
    currentPeriodEnd
  });
}
