import {
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  PermissionsBitField
} from "discord.js";
import { getConfig } from "../config.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function createDiscordBot() {
  const cfg = getConfig();

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
  });

  const state = {
    readyAt: null,
    lastCounterUpdateAt: null
  };

  async function getGuild() {
    const guild = await client.guilds.fetch(cfg.DISCORD_GUILD_ID);
    return guild;
  }

  async function ensureMembersFetched(guild) {
    // For small servers this keeps subscriber counting reliable.
    // For larger servers, this can be replaced with more efficient strategies.
    try {
      await guild.members.fetch();
    } catch (err) {
      console.warn("[discord] members.fetch failed (continuing)", err?.message || err);
    }
  }

  async function countPremiumMembers() {
    const guild = await getGuild();
    await ensureMembersFetched(guild);
    return guild.members.cache.filter((m) => m.roles.cache.has(cfg.DISCORD_PREMIUM_ROLE_ID))
      .size;
  }

  let counterUpdateInFlight = null;
  async function updateSubscriberCounter({ reason }) {
    if (!cfg.DISCORD_SUBSCRIBER_VOICE_CHANNEL_ID) return;
    if (counterUpdateInFlight) return counterUpdateInFlight;

    counterUpdateInFlight = (async () => {
      const guild = await getGuild();
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
      state.lastCounterUpdateAt = new Date();
    })();

    try {
      await counterUpdateInFlight;
    } finally {
      counterUpdateInFlight = null;
    }
  }

  async function grantPremium({ discordId, reason }) {
    const guild = await getGuild();
    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) {
      console.warn("[discord] member not found for grantPremium", discordId);
      return;
    }
    await member.roles.add(cfg.DISCORD_PREMIUM_ROLE_ID, reason);
    try {
      await member.send(
        `Your subscription is active and Premium access has been enabled in **${guild.name}**.`
      );
    } catch {
      // User may have DMs disabled; ignore.
    }
    await updateSubscriberCounter({ reason: `grant:${reason}` });
  }

  async function hasPremium({ discordId }) {
    const guild = await getGuild();
    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) return false;
    return member.roles.cache.has(cfg.DISCORD_PREMIUM_ROLE_ID);
  }

  async function revokePremium({ discordId, reason }) {
    const guild = await getGuild();
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
    await updateSubscriberCounter({ reason: `revoke:${reason}` });
  }

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "status") return;

    const count = await countPremiumMembers();
    const upSeconds = state.readyAt
      ? Math.floor((Date.now() - state.readyAt.getTime()) / 1000)
      : 0;

    await interaction.reply({
      ephemeral: true,
      content:
        `Subscribers: ${count}\n` +
        `Bot ready: ${state.readyAt ? state.readyAt.toISOString() : "no"}\n` +
        `Uptime: ${upSeconds}s\n` +
        `Counter update: ${
          state.lastCounterUpdateAt ? state.lastCounterUpdateAt.toISOString() : "n/a"
        }`
    });
  });

  client.once(Events.ClientReady, async () => {
    state.readyAt = new Date();

    const guild = await getGuild();
    const me = await guild.members.fetchMe();

    // Quick operational guard: warn if bot likely can't manage roles/channels.
    const perms = me.permissions;
    if (!perms.has(PermissionsBitField.Flags.ManageRoles)) {
      console.warn("[discord] missing ManageRoles permission");
    }
    if (cfg.DISCORD_SUBSCRIBER_VOICE_CHANNEL_ID) {
      if (!perms.has(PermissionsBitField.Flags.ManageChannels)) {
        console.warn("[discord] missing ManageChannels permission (subscriber counter)");
      }
    }

    // Guild-scoped command avoids global propagation delays.
    await guild.commands.set([
      {
        name: "status",
        description: "Shows subscriber count and bot health"
      }
    ]);

    console.log(`[discord] ready as ${client.user?.tag || "unknown"}`);

    await updateSubscriberCounter({ reason: "startup" });

    // Periodic refresh (keeps the counter correct if roles are changed manually).
    while (true) {
      await sleep(5 * 60 * 1000);
      await updateSubscriberCounter({ reason: "periodic" }).catch((err) => {
        console.warn("[discord] counter periodic failed", err?.message || err);
      });
    }
  });

  await client.login(cfg.DISCORD_TOKEN);

  return {
    grantPremium,
    revokePremium,
    hasPremium,
    updateSubscriberCounter,
    countPremiumMembers,
    client
  };
}
