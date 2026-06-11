import { ChannelType } from "discord.js";

async function getGuild(client, cfg) {
  return await client.guilds.fetch(cfg.DISCORD_GUILD_ID);
}

async function ensureMembersFetched(guild) {
  try {
    await guild.members.fetch();
  } catch (err) {
    console.warn("[discord] members.fetch failed (continuing)", err?.message || err);
  }
}

export async function countPremiumMembers(client, cfg) {
  const guild = await getGuild(client, cfg);
  await ensureMembersFetched(guild);
  return guild.members.cache.filter((m) => m.roles.cache.has(cfg.DISCORD_PREMIUM_ROLE_ID)).size;
}

let counterUpdateInFlight = null;
export async function updateSubscriberCounter(client, cfg, reason) {
  if (!cfg.DISCORD_SUBSCRIBER_VOICE_CHANNEL_ID) return;
  if (counterUpdateInFlight) return counterUpdateInFlight;

  counterUpdateInFlight = (async () => {
    const guild = await getGuild(client, cfg);
    await ensureMembersFetched(guild);
    const count = guild.members.cache.filter((m) =>
      m.roles.cache.has(cfg.DISCORD_PREMIUM_ROLE_ID)
    ).size;

    const channel = await guild.channels.fetch(cfg.DISCORD_SUBSCRIBER_VOICE_CHANNEL_ID);
    if (!channel) return;
    if (channel.type !== ChannelType.GuildVoice) return;

    const nextName = `📈 Subscribers: ${count}`;
    if (channel.name !== nextName) {
      await channel.setName(nextName, `subscriber counter update (${reason})`);
    }
  })();

  try {
    await counterUpdateInFlight;
  } finally {
    counterUpdateInFlight = null;
  }
}

export async function grantPremium(client, cfg, { discordId, accessToken, reason }) {
  const guild = await getGuild(client, cfg);

  if (accessToken) {
    try {
      const addResponse = await fetch(`https://discord.com/api/v10/guilds/${cfg.DISCORD_GUILD_ID}/members/${discordId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bot ${cfg.DISCORD_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          access_token: accessToken,
          roles: [cfg.DISCORD_PREMIUM_ROLE_ID]
        })
      });
      if (!addResponse.ok) {
        console.error("[discord] failed to add user with access token", await addResponse.text());
      } else if (addResponse.status === 201) {
        console.log(`[discord] Added user ${discordId} to guild via access token`);
      }
    } catch (err) {
      console.error("[discord] error adding member with access token", err);
    }
  }

  const member = await guild.members.fetch(discordId).catch(() => null);
  if (!member) {
    console.warn("[discord] member not found for grantPremium", discordId);
    return;
  }

  if (!member.roles.cache.has(cfg.DISCORD_PREMIUM_ROLE_ID)) {
    await member.roles.add(cfg.DISCORD_PREMIUM_ROLE_ID, reason).catch(() => null);
  }

  try {
    await member.send(
      `Your subscription is active and Premium access has been enabled in **${guild.name}**.`
    );
  } catch {
    // User may have DMs disabled; ignore.
  }
  await updateSubscriberCounter(client, cfg, `grant:${reason}`);
}

export async function hasPremium(client, cfg, { discordId }) {
  const guild = await getGuild(client, cfg);
  const member = await guild.members.fetch(discordId).catch(() => null);
  if (!member) return false;
  return member.roles.cache.has(cfg.DISCORD_PREMIUM_ROLE_ID);
}

export async function revokePremium(client, cfg, { discordId, reason }) {
  const guild = await getGuild(client, cfg);
  const member = await guild.members.fetch(discordId).catch(() => null);
  if (!member) {
    console.warn("[discord] member not found for revokePremium", discordId);
    return;
  }
  await member.roles.remove(cfg.DISCORD_PREMIUM_ROLE_ID, reason);
  const msg =
    reason === "invoice.payment_failed"
      ? `Your payment failed and Premium access was disabled in **${guild.name}**. Please update your payment method and resubscribe.`
      : `Your subscription ended and Premium access was disabled in **${guild.name}**.`;
  try {
    await member.send(msg);
  } catch {
    // User may have DMs disabled; ignore.
  }
  await updateSubscriberCounter(client, cfg, `revoke:${reason}`);
}
