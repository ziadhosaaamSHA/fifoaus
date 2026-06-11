import { MessageFlags, PermissionsBitField } from "discord.js";
import { isDbEnabled as isInviteDbEnabled, createInviteToken } from "../db/inviteTokens.js";
import { hasPremium } from "./premium.js";
import { listJobsFromContentApi } from "../jobs/apiClient.js";
import { logScrapedJobs } from "../jobs/index.js";
import {
  createLinkedInJobEmbed,
  createLinkedInJobRow,
  createPostMessagePayload,
  createPostMessageModal,
  getPostMessageConfig,
  createSeekJobEmbed,
  createSeekJobRow
} from "./embeds.js";

function stripTrailingSlash(url) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

async function fetchJobsForInteraction({ cfg, source, maxResults }) {
  if (!cfg.CONTENT_API_BASE_URL) {
    throw new Error("content_api_not_configured");
  }

  return listJobsFromContentApi({
    cfg,
    source,
    limit: maxResults
  });
}

export async function createCheckoutSessionForDiscordUser({ client, cfg, stripe, discordId }) {
  if (await hasPremium(client, cfg, { discordId })) {
    const err = new Error("already_premium");
    err.code = "already_premium";
    throw err;
  }

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

export async function handlePostMessageModal({ client, interaction, kind }) {
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

export async function postSeekJobsFromInteraction({
  interaction,
  jobs,
  intro,
  emptyMessage = "No FIFO jobs were found on SEEK right now.",
  createEmbed = createSeekJobEmbed,
  createRow = createSeekJobRow
}) {
  if (jobs.length === 0) {
    await interaction.editReply({ content: intro || emptyMessage });
    return;
  }

  const orderedJobs = [...jobs].reverse();
  const [firstOrderedJob, ...remainingOrderedJobs] = orderedJobs;

  await interaction.editReply({
    content: intro || null,
    embeds: [createEmbed(firstOrderedJob)],
    components: [createRow(firstOrderedJob)]
  });

  for (const job of remainingOrderedJobs) {
    await interaction.followUp({
      embeds: [createEmbed(job)],
      components: [createRow(job)]
    });
  }
}

export async function handleInteractionCreate({ client, cfg, stripe, state, interaction }) {
  if (interaction.isButton()) {
    if (interaction.customId === "subscribe:create") {
      const discordId = interaction.user.id;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const session = await createCheckoutSessionForDiscordUser({ client, cfg, stripe, discordId });
        const url = session.url;
        if (!url) throw new Error("Stripe did not return a Checkout URL.");

        await interaction.editReply({
          content: `Click the link below to open Stripe Checkout and complete your subscription:\n\n${url}`,
          components: []
        });

        setTimeout(() => {
          interaction.deleteReply().catch(() => null);
        }, 45 * 1000);
      } catch (err) {
        if (err?.code === "already_premium" || err?.message === "already_premium") {
          await interaction.editReply({ content: "You already have Premium access." });
        } else {
          console.error("[discord] subscribe button failed", err);
          await interaction.editReply({
            content: "Could not create a checkout session. Please try again later."
          });
          setTimeout(() => {
            interaction.deleteReply().catch(() => null);
          }, 10 * 1000);
        }
      }
      return;
    }

    if (interaction.customId === "invite:create") {
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

        setTimeout(() => {
          interaction.deleteReply().catch(() => null);
        }, 45 * 1000);
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
      await handlePostMessageModal({ client, cfg, interaction, kind: "invite" });
    } else if (interaction.customId === "post-subscribe:modal") {
      await handlePostMessageModal({ client, cfg, interaction, kind: "subscribe" });
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "status") {
    const guild = await client.guilds.fetch(cfg.DISCORD_GUILD_ID);
    try {
      await guild.members.fetch();
    } catch (err) {
      console.warn("[discord] members.fetch failed during status call (continuing)", err?.message || err);
    }
    const count = guild.members.cache.filter((m) => m.roles.cache.has(cfg.DISCORD_PREMIUM_ROLE_ID)).size;
    const upSeconds = state.readyAt ? Math.floor((Date.now() - state.readyAt.getTime()) / 1000) : 0;

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        `Subscribers: ${count}\n` +
        `Bot ready: ${state.readyAt ? state.readyAt.toISOString() : "no"}\n` +
        `Uptime: ${upSeconds}s\n` +
        `Counter update: ${state.lastCounterUpdateAt ? state.lastCounterUpdateAt.toISOString() : "n/a"}`
    });
    return;
  }

  if (interaction.commandName === "subscribe") {
    const discordId = interaction.user.id;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const session = await createCheckoutSessionForDiscordUser({ client, cfg, stripe, discordId });
      const url = session.url;
      if (!url) throw new Error("Stripe did not return a Checkout URL.");

      await interaction.editReply({
        content: `Click the link below to open Stripe Checkout and complete your subscription:\n\n${url}`,
        components: []
      });

      setTimeout(() => {
        interaction.deleteReply().catch(() => null);
      }, 45 * 1000);
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

  if (interaction.commandName === "seek-fifo") {
    await interaction.deferReply();

    try {
      const jobs = await fetchJobsForInteraction({ cfg, source: "seek", maxResults: 5 });
      logScrapedJobs(jobs, "/seek-fifo");

      if (jobs.length === 0) {
        await interaction.editReply({
          content: "No FIFO jobs were found on SEEK right now."
        });
        return;
      }
      await postSeekJobsFromInteraction({
        interaction,
        jobs,
        createEmbed: createSeekJobEmbed,
        createRow: createSeekJobRow
      });
    } catch (err) {
      console.error("[discord] /seek-fifo failed", err);
      await interaction.editReply({
        content:
          err?.message === "content_api_not_configured"
            ? "CONTENT_API_BASE_URL is not configured for the bot service."
            : "Could not fetch FIFO jobs from SEEK right now. Please try again later."
      });
    }
    return;
  }

  if (interaction.commandName === "linkedin-fifo") {
    await interaction.deferReply();

    try {
      const jobs = await fetchJobsForInteraction({ cfg, source: "linkedin", maxResults: 5 });
      logScrapedJobs(jobs, "/linkedin-fifo");

      await postSeekJobsFromInteraction({
        interaction,
        jobs,
        emptyMessage: "No FIFO jobs were found on LinkedIn right now.",
        createEmbed: createLinkedInJobEmbed,
        createRow: createLinkedInJobRow
      });
    } catch (err) {
      console.error("[discord] /linkedin-fifo failed", err);
      await interaction.editReply({
        content:
          err?.message === "content_api_not_configured"
            ? "CONTENT_API_BASE_URL is not configured for the bot service."
            : "Could not fetch FIFO jobs from LinkedIn right now. Please try again later."
      });
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
}
