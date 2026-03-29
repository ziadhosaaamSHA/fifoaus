const ACTIVE_STATUSES = new Set(["active", "trialing"]);

function isActiveSubscription(sub) {
  return Boolean(sub && ACTIVE_STATUSES.has(sub.status));
}

async function searchByMetadata({ stripe, discordId }) {
  const result = await stripe.subscriptions.search({
    query: `metadata['discord_id']:'${discordId}'`
  });
  return result.data || [];
}

async function listAllSubscriptions({ stripe }) {
  const all = [];
  let startingAfter = null;

  while (true) {
    const page = await stripe.subscriptions.list({
      limit: 100,
      status: "all",
      ...(startingAfter ? { starting_after: startingAfter } : {})
    });

    all.push(...page.data);
    if (!page.has_more) break;
    if (!page.data.length) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  return all;
}

export async function findActiveSubscriptionByDiscordId({ stripe, discordId }) {
  if (!discordId) return null;

  try {
    const subs = await searchByMetadata({ stripe, discordId });
    return subs.find((sub) => isActiveSubscription(sub)) || null;
  } catch (err) {
    const message = err?.message || String(err);
    console.warn("[stripe] subscription search failed, falling back to list", message);
  }

  const subs = await listAllSubscriptions({ stripe });
  const matched = subs.filter((sub) => sub?.metadata?.discord_id === discordId);
  return matched.find((sub) => isActiveSubscription(sub)) || null;
}
