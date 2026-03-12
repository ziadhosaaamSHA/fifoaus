import {
  ChannelType,
  Client,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  GatewayIntentBits,
  PermissionsBitField
} from "discord.js";
import { getConfig } from "../config.js";
import { createStripeClient } from "../stripe/client.js";
import { LRUCache } from "lru-cache";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function createDiscordBot() {
  const cfg = getConfig();
  const stripe = createStripeClient(cfg);

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
    await updateSubscriberCounter({ reason: `grant:${reason}` });
  }

  async function revokePremium({ discordId, reason }) {
    const guild = await getGuild();
    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) {
      console.warn("[discord] member not found for revokePremium", discordId);
      return;
    }
    await member.roles.remove(cfg.DISCORD_PREMIUM_ROLE_ID, reason);
    await updateSubscriberCounter({ reason: `revoke:${reason}` });
  }

  client.on("interactionCreate", async (interaction) => {
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

  const subscribeCooldown = new LRUCache({
    max: 50_000,
    ttl: 60 * 1000
  });

  async function createCheckoutSessionForDiscordUser({ discordId }) {
    // When initiated from Discord, we can't derive host from an HTTP request.
    // Require BASE_URL (or explicit SUCCESS_URL/CANCEL_URL) in production.
    const baseUrl = cfg.BASE_URL;
    const successUrl = cfg.SUCCESS_URL || (baseUrl ? `${baseUrl}/success` : null);
    const cancelUrl = cfg.CANCEL_URL || (baseUrl ? `${baseUrl}/cancel` : null);
    if (!successUrl || !cancelUrl) {
      throw new Error("Missing BASE_URL (or SUCCESS_URL/CANCEL_URL) for Discord subscribe flow.");
    }

    return await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: cfg.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { discord_id: discordId },
      subscription_data: {
        metadata: { discord_id: discordId }
      }
    });
  }

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
      if (interaction.customId !== "subscribe:create") return;

      const discordId = interaction.user.id;
      const cooldownKey = `subscribe:${discordId}`;
      if (subscribeCooldown.has(cooldownKey)) {
        await interaction.reply({
          ephemeral: true,
          content: "Please wait a moment before trying again."
        });
        return;
      }
      subscribeCooldown.set(cooldownKey, true);

      await interaction.deferReply({ ephemeral: true });
      try {
        const session = await createCheckoutSessionForDiscordUser({ discordId });
        const url = session.url;
        if (!url) throw new Error("Stripe did not return a Checkout URL.");

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel("Open Checkout").setStyle(ButtonStyle.Link).setURL(url)
        );

        await interaction.editReply({
          content: "Open Stripe Checkout to complete your subscription.",
          components: [row]
        });
      } catch (err) {
        console.error("[discord] subscribe button failed", err);
        await interaction.editReply({
          content: "Could not create a checkout session. Please try again later."
        });
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "subscribe") {
      const discordId = interaction.user.id;
      await interaction.deferReply({ ephemeral: true });
      try {
        const session = await createCheckoutSessionForDiscordUser({ discordId });
        const url = session.url;
        if (!url) throw new Error("Stripe did not return a Checkout URL.");

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel("Open Checkout").setStyle(ButtonStyle.Link).setURL(url)
        );

        await interaction.editReply({
          content: "Open Stripe Checkout to complete your subscription.",
          components: [row]
        });
      } catch (err) {
        console.error("[discord] /subscribe failed", err);
        await interaction.editReply({
          content: "Could not create a checkout session. Please try again later."
        });
      }
      return;
    }

    if (interaction.commandName === "post-subscribe") {
      // Restricted via default_member_permissions at command registration time.
      const channel = interaction.channel;
      if (!channel) {
        await interaction.reply({ ephemeral: true, content: "No channel available." });
        return;
      }
      if (channel.type !== ChannelType.GuildText) {
        await interaction.reply({ ephemeral: true, content: "Run this in a text channel." });
        return;
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("subscribe:create")
          .setLabel("Subscribe")
          .setStyle(ButtonStyle.Primary)
      );

      await channel.send({
        content: "Click to subscribe and unlock Premium access:",
        components: [row]
      });

      await interaction.reply({ ephemeral: true, content: "Posted the Subscribe button." });
      return;
    }
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
      },
      {
        name: "subscribe",
        description: "Start a Stripe subscription checkout"
      },
      {
        name: "post-subscribe",
        description: "Post a Subscribe button in this channel",
        default_member_permissions: PermissionsBitField.Flags.ManageGuild.toString()
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
    updateSubscriberCounter,
    countPremiumMembers,
    client
  };
}
