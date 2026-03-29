#!/usr/bin/env node
import "dotenv/config";
import { getConfig } from "../src/config.js";
import { createStripeClient } from "../src/stripe/client.js";
import { findActiveSubscriptionByDiscordId } from "../src/stripe/subscriptions.js";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      args.help = true;
      continue;
    }
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/create-one-time-invite.js --discord-id <id> [--channel-id <id>] [--max-age <seconds>] [--skip-sub-check]

Options:
  --discord-id       Discord user id of the subscriber (required unless --skip-sub-check)
  --channel-id       Channel id where the invite will be created (required)
  --max-age          Seconds before invite expires (default: 0 = never)
  --skip-sub-check   Skip Stripe subscription validation
`);
}

function isDiscordId(value) {
  return typeof value === "string" && /^\d{17,20}$/.test(value);
}

async function createInvite({ token, channelId, maxAge }) {
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/invites`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      max_age: maxAge,
      max_uses: 1,
      temporary: false,
      unique: true
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord invite create failed (${res.status}): ${text}`);
  }

  return res.json();
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

const cfg = getConfig();

const discordId = args["discord-id"] || args.discordId;
const skipSubCheck = Boolean(args["skip-sub-check"] || args.skipSubCheck);
const channelId = args["channel-id"] || args.channelId;
const maxAge = args["max-age"] ? Number(args["max-age"]) : 0;

if (!channelId || !isDiscordId(channelId)) {
  console.error("Missing or invalid --channel-id. Expect a Discord channel id.");
  process.exit(1);
}

if (!skipSubCheck) {
  if (!isDiscordId(discordId)) {
    console.error("Missing or invalid --discord-id. Provide the subscriber's Discord id.");
    process.exit(1);
  }

  const stripe = createStripeClient(cfg);
  const subscription = await findActiveSubscriptionByDiscordId({
    stripe,
    discordId
  });
  if (!subscription) {
    console.error(`No active Stripe subscription found for discord_id=${discordId}`);
    process.exit(1);
  }
}

const invite = await createInvite({
  token: cfg.DISCORD_TOKEN,
  channelId,
  maxAge
});

const inviteUrl = `https://discord.gg/${invite.code}`;
console.log(`Invite URL: ${inviteUrl}`);
console.log(`Invite code: ${invite.code}`);
if (invite.expires_at) {
  console.log(`Expires at: ${invite.expires_at}`);
}
