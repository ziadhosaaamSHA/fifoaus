#!/usr/bin/env node
import "dotenv/config";
import { getConfig } from "../src/config.js";
import { isDbEnabled } from "../src/db/subscribers.js";
import { createInviteToken } from "../src/db/inviteTokens.js";
import { createStripeClient } from "../src/stripe/client.js";
import { verifyActiveSubscriber } from "../src/subscribers/verify.js";

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
  node scripts/create-one-time-invite.js [--discord-id <id>] [--skip-sub-check]

Options:
  --discord-id       (Optional) Bind invite to a specific Discord user id
  --skip-sub-check   Skip Stripe subscription validation
`);
}

function isDiscordId(value) {
  return typeof value === "string" && /^\d{17,20}$/.test(value);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

const cfg = getConfig();

const discordId = args["discord-id"] || args.discordId;
const skipSubCheck = Boolean(args["skip-sub-check"] || args.skipSubCheck);
if (!cfg.BASE_URL) {
  console.error("Missing BASE_URL. Set it to your public app URL.");
  process.exit(1);
}

if (!skipSubCheck && isDiscordId(discordId)) {
  const stripe = createStripeClient(cfg);
  const verified = await verifyActiveSubscriber({ stripe, discordId });
  if (!verified.active) {
    console.error(`No active subscription found for discord_id=${discordId}`);
    process.exit(1);
  }
}

if (!isDbEnabled()) {
  console.error("DATABASE_URL not configured; cannot create invite token.");
  process.exit(1);
}

const token = await createInviteToken({ discordId: isDiscordId(discordId) ? discordId : null });
const inviteUrl = `${cfg.BASE_URL.replace(/\\/$/, "")}/invite/${token}`;

console.log(`Invite URL: ${inviteUrl}`);
console.log(`Invite token: ${token}`);
