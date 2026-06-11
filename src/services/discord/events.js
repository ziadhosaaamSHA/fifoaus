import { Events, PermissionsBitField } from "discord.js";
import { verifyActiveSubscriber } from "../subscribers/verify.js";
import { grantPremium, updateSubscriberCounter } from "./premium.js";
import { handleInteractionCreate } from "./interactions.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function setupDiscordEvents({ client, cfg, stripe, state }) {
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
      await grantPremium(client, cfg, { discordId: member.id, reason: "guildMemberAdd:active_subscription" });
    } catch (err) {
      console.warn("[discord] failed to verify subscription on join", err?.message || err);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      await handleInteractionCreate({ client, cfg, stripe, state, interaction });
    } catch (err) {
      console.error("[discord] unhandled interaction error", err);
    }
  });

  client.once(Events.ClientReady, async () => {
    state.readyAt = new Date();

    const guild = await client.guilds.fetch(cfg.DISCORD_GUILD_ID);
    const me = await guild.members.fetchMe();

    const perms = me.permissions;
    if (!perms.has(PermissionsBitField.Flags.ManageRoles)) {
      console.warn("[discord] missing ManageRoles permission");
    }
    if (cfg.DISCORD_SUBSCRIBER_VOICE_CHANNEL_ID) {
      if (!perms.has(PermissionsBitField.Flags.ManageChannels)) {
        console.warn("[discord] missing ManageChannels permission (subscriber counter)");
      }
    }

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
        name: "seek-fifo",
        description: "Fetch the latest 5 FIFO jobs from SEEK"
      },
      {
        name: "linkedin-fifo",
        description: "Fetch the latest 5 FIFO jobs from LinkedIn"
      },
      {
        name: "mining-news",
        description: "Fetch the latest mining and resources news"
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

    await updateSubscriberCounter(client, cfg, "startup");

    // Periodic refresh
    (async () => {
      while (true) {
        await sleep(5 * 60 * 1000);
        try {
          await updateSubscriberCounter(client, cfg, "periodic");
        } catch (err) {
          console.warn("[discord] counter periodic failed", err?.message || err);
        }
      }
    })();
  });
}
