import {
  ChannelType,
  Client,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  PermissionsBitField,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import { getConfig } from "../config.js";
import { createStripeClient } from "../stripe/client.js";
import { createInviteToken, isDbEnabled as isInviteDbEnabled } from "../db/inviteTokens.js";
import { verifyActiveSubscriber } from "../subscribers/verify.js";

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

  async function grantPremium({ discordId, accessToken, reason }) {
    const guild = await getGuild();

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



  function createInviteButtonRow() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("invite:create")
        .setLabel("Generate Invite Link")
        .setStyle(ButtonStyle.Primary)
    );
  }

  function createSubscribeButtonRow() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("subscribe:create")
        .setLabel("Subscribe")
        .setStyle(ButtonStyle.Primary)
    );
  }

  function getPostMessageConfig(kind) {
    if (kind === "invite") {
      return {
        modalId: "post-invite:modal",
        title: "Premium Access Links",
        footer: "Admin-only access link workflow",
        defaultBody:
          "Use the button below to generate a secure one-time access link for an existing mentorship subscriber.",
        confirmLabel: "invite"
      };
    }

    return {
      modalId: "post-subscribe:modal",
      title: "Join FIFO AUS Premium",
      footer: "Secure Stripe checkout with automatic Discord access",
      defaultBody:
        "Start your subscription below to unlock the premium Discord role and member-only mentorship access.",
      confirmLabel: "subscribe"
    };
  }

  function createPostMessageEmbed({ kind, body }) {
    const cfgForKind = getPostMessageConfig(kind);
    return new EmbedBuilder()
      .setColor(0xef8600)
      .setTitle(cfgForKind.title)
      .setDescription(body || cfgForKind.defaultBody)
      .setFooter({ text: cfgForKind.footer });
  }

  function createPostMessagePayload({ kind, body }) {
    const row = kind === "invite" ? createInviteButtonRow() : createSubscribeButtonRow();
    return {
      content: "",
      embeds: [createPostMessageEmbed({ kind, body })],
      components: [row]
    };
  }

  function createPostMessageModal(kind) {
    const cfgForKind = getPostMessageConfig(kind);
    const messageIdInput = new TextInputBuilder()
      .setCustomId("message_id")
      .setLabel("Message ID to edit (optional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setPlaceholder("Leave blank to post a new message");
    const messageBodyInput = new TextInputBuilder()
      .setCustomId("message_body")
      .setLabel("Message body")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(4000)
      .setPlaceholder(cfgForKind.defaultBody);

    return new ModalBuilder()
      .setCustomId(cfgForKind.modalId)
      .setTitle(cfgForKind.title)
      .addComponents(
        new ActionRowBuilder().addComponents(messageIdInput),
        new ActionRowBuilder().addComponents(messageBodyInput)
      );
  }

  async function handlePostMessageModal(interaction, kind) {
    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || !("send" in channel) || !("messages" in channel)) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: "Run this in a text channel."
      });
      return;
    }

    const messageId = interaction.fields.getTextInputValue("message_id").trim();
    const messageBody = interaction.fields.getTextInputValue("message_body").trim();
    const cfgForKind = getPostMessageConfig(kind);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (messageId) {
      try {
        const existingMessage = await channel.messages.fetch(messageId).catch(() => null);
        if (!existingMessage) {
          await interaction.editReply({ content: "Could not find that message in this channel." });
          return;
        }

        if (existingMessage.author.id !== client.user.id) {
          await interaction.editReply({
            content: `I can only edit ${cfgForKind.confirmLabel} messages that were posted by this bot.`
          });
          return;
        }

        const existingBody =
          existingMessage.embeds[0]?.description ||
          existingMessage.content ||
          cfgForKind.defaultBody;

        await existingMessage.edit(
          createPostMessagePayload({
            kind,
            body: messageBody || existingBody
          })
        );

        await interaction.editReply({
          content: `Updated the ${cfgForKind.confirmLabel} message.\nMessage ID: ${existingMessage.id}`
        });
      } catch (err) {
        console.error(`[discord] /${cfgForKind.modalId} edit failed`, err);
        await interaction.editReply({
          content: `Could not edit that ${cfgForKind.confirmLabel} message. Please try again later.`
        });
      }
      return;
    }

    try {
      const sentMessage = await channel.send(
        createPostMessagePayload({
          kind,
          body: messageBody
        })
      );

      await interaction.editReply({
        content: `Posted the ${cfgForKind.confirmLabel} message.\nMessage ID: ${sentMessage.id}`
      });
    } catch (err) {
      console.error(`[discord] /${cfgForKind.modalId} post failed`, err);
      await interaction.editReply({
        content: `Could not post the ${cfgForKind.confirmLabel} message. Please try again later.`
      });
    }
  }

  async function createCheckoutSessionForDiscordUser({ discordId }) {
    if (await hasPremium({ discordId })) {
      const err = new Error("already_premium");
      err.code = "already_premium";
      throw err;
    }

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

  function stripTrailingSlash(url) {
    return url.endsWith("/") ? url.slice(0, -1) : url;
  }

  client.on(Events.GuildMemberAdd, async (member) => {
    if (member.guild?.id !== cfg.DISCORD_GUILD_ID) return;

    try {
      const verified = await verifyActiveSubscriber({ stripe, discordId: member.id });
      if (verified.error) {
        console.warn("[discord] verification unavailable on join", verified.error);
        return;
      }
      if (!verified.active) {
        console.log("[discord] member joined without active subscription", member.id);
        return;
      }
      await grantPremium({ discordId: member.id, reason: "guildMemberAdd:active_subscription" });
    } catch (err) {
      console.warn("[discord] failed to verify subscription on join", err?.message || err);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
      if (interaction.customId === "subscribe:create") {
        const discordId = interaction.user.id;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          const session = await createCheckoutSessionForDiscordUser({ discordId });
          const url = session.url;
          if (!url) throw new Error("Stripe did not return a Checkout URL.");

          await interaction.editReply({
            content: `Click the link below to open Stripe Checkout and complete your subscription:\n\n${url}`,
            components: []
          });
        } catch (err) {
          if (err?.code === "already_premium" || err?.message === "already_premium") {
            await interaction.editReply({ content: "You already have Premium access." });
          } else {
            console.error("[discord] subscribe button failed", err);
            await interaction.editReply({
              content: "Could not create a checkout session. Please try again later."
            });
          }
        }
        return;
      }

      if (interaction.customId === "invite:create") {
        const discordId = interaction.user.id;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
            await interaction.editReply({
              content: "Only admins can generate invite links."
            });
            return;
          }

          if (!isInviteDbEnabled()) {
            await interaction.editReply({
              content: "DATABASE_URL is not configured. Cannot generate invite links."
            });
            return;
          }

          if (!cfg.BASE_URL) {
            await interaction.editReply({
              content: "Set BASE_URL in your env to generate invite links."
            });
            return;
          }

          const token = await createInviteToken({ maxUses: 1 });
          const inviteUrl = `${stripTrailingSlash(cfg.BASE_URL)}/invite/${token}`;

          await interaction.editReply({
            content: `One-time access link generated:\n${inviteUrl}\nThis link works once.`
          });
        } catch (err) {
          console.error("[discord] invite button failed", err);
          await interaction.editReply({
            content: "Could not create an access link. Please try again later."
          });
        }
        return;
      }

      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "post-invite:modal") {
        await handlePostMessageModal(interaction, "invite");
      } else if (interaction.customId === "post-subscribe:modal") {
        await handlePostMessageModal(interaction, "subscribe");
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "status") {
      const count = await countPremiumMembers();
      const upSeconds = state.readyAt
        ? Math.floor((Date.now() - state.readyAt.getTime()) / 1000)
        : 0;

      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content:
          `Subscribers: ${count}\n` +
          `Bot ready: ${state.readyAt ? state.readyAt.toISOString() : "no"}\n` +
          `Uptime: ${upSeconds}s\n` +
          `Counter update: ${state.lastCounterUpdateAt ? state.lastCounterUpdateAt.toISOString() : "n/a"
          }`
      });
      return;
    }

    if (interaction.commandName === "subscribe") {
      const discordId = interaction.user.id;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const session = await createCheckoutSessionForDiscordUser({ discordId });
        const url = session.url;
        if (!url) throw new Error("Stripe did not return a Checkout URL.");

        await interaction.editReply({
          content: `Click the link below to open Stripe Checkout and complete your subscription:\n\n${url}`,
          components: []
        });
      } catch (err) {
        if (err?.code === "already_premium" || err?.message === "already_premium") {
          await interaction.editReply({ content: "You already have Premium access." });
        } else {
          console.error("[discord] /subscribe failed", err);
          await interaction.editReply({
            content: "Could not create a checkout session. Please try again later."
          });
        }
      }
      return;
    }

    if (interaction.commandName === "post-invite") {
      await interaction.showModal(createPostMessageModal("invite"));
      return;
    }

    if (interaction.commandName === "post-subscribe") {
      await interaction.showModal(createPostMessageModal("subscribe"));
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
        name: "post-invite",
        description: "Open the editor for the one-time invite button message",
        default_member_permissions: PermissionsBitField.Flags.ManageGuild.toString()
      },
      {
        name: "post-subscribe",
        description: "Open the editor for the Subscribe button message",
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
    hasPremium,
    updateSubscriberCounter,
    countPremiumMembers,
    client
  };
}
