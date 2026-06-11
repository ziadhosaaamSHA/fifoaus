import { Client, GatewayIntentBits } from "discord.js";
import { getConfig } from "../../config.js";
import { createStripeClient } from "../stripe/client.js";
import { setupDiscordEvents } from "./events.js";
import {
  createLinkedInJobEmbed,
  createLinkedInJobRow,
  createSeekJobEmbed,
  createSeekJobRow
} from "./embeds.js";
import {
  grantPremium,
  revokePremium,
  hasPremium,
  updateSubscriberCounter,
  countPremiumMembers
} from "./premium.js";

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

  setupDiscordEvents({ client, cfg, stripe, state });

  async function sendMessageToChannel({ channelId, content }) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      throw new Error(`channel_not_found:${channelId}`);
    }
    if (!channel.isTextBased() || !("send" in channel)) {
      throw new Error(`channel_not_text:${channelId}`);
    }

    await channel.send({ content });
  }

  async function sendJobsToChannel({
    channelId,
    jobs,
    intro,
    createEmbed = createSeekJobEmbed,
    createRow = createSeekJobRow
  }) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      throw new Error(`channel_not_found:${channelId}`);
    }
    if (!channel.isTextBased() || !("send" in channel)) {
      throw new Error(`channel_not_text:${channelId}`);
    }

    if (intro) {
      await channel.send({ content: intro });
    }

    for (const job of [...jobs].reverse()) {
      await channel.send({
        embeds: [createEmbed(job)],
        components: [createRow(job)]
      });
    }
  }

  async function sendSeekJobsToChannel(args) {
    return sendJobsToChannel({
      ...args,
      createEmbed: createSeekJobEmbed,
      createRow: createSeekJobRow
    });
  }

  async function sendLinkedInJobsToChannel(args) {
    return sendJobsToChannel({
      ...args,
      createEmbed: createLinkedInJobEmbed,
      createRow: createLinkedInJobRow
    });
  }

  await client.login(cfg.DISCORD_TOKEN);

  return {
    grantPremium: (args) => grantPremium(client, cfg, args),
    revokePremium: (args) => revokePremium(client, cfg, args),
    hasPremium: (args) => hasPremium(client, cfg, args),
    updateSubscriberCounter: (args) => updateSubscriberCounter(client, cfg, args?.reason),
    countPremiumMembers: () => countPremiumMembers(client, cfg),
    sendMessageToChannel,
    sendJobsToChannel,
    sendSeekJobsToChannel,
    sendLinkedInJobsToChannel,
    client
  };
}
