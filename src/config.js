import { z } from "zod";

const discordIdSchema = z.string().regex(/^\d{17,20}$/, "invalid discord id");
const envBooleanSchema = z.enum(["true", "false"]);

function parseEnvBoolean(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return value === "true";
}

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().optional(),
  BASE_URL: z.string().url().optional(),
  SUCCESS_URL: z.string().url().optional(),
  CANCEL_URL: z.string().url().optional(),
  SUPPORT_TEXT: z.string().optional(),

  STRIPE_SECRET: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_ID: z
    .string()
    .regex(/^price_[a-zA-Z0-9]+$/, "invalid Stripe price id"),

  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: discordIdSchema,
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_GUILD_ID: discordIdSchema,
  DISCORD_PREMIUM_ROLE_ID: discordIdSchema,
  DISCORD_SUBSCRIBER_VOICE_CHANNEL_ID: discordIdSchema.optional().or(z.literal("")),

  SEEK_FIFO_ENABLED: envBooleanSchema.optional(),
  SEEK_FIFO_CHANNEL_ID: discordIdSchema.optional().or(z.literal("")),
  SEEK_FIFO_SEARCH_URL: z.string().url().optional(),
  SEEK_FIFO_CRON: z.string().min(1).optional(),
  SEEK_FIFO_MAX_RESULTS: z.coerce.number().int().positive().max(25).optional(),

  LINKEDIN_FIFO_ENABLED: envBooleanSchema.optional(),
  LINKEDIN_FIFO_CHANNEL_ID: discordIdSchema.optional().or(z.literal("")),
  LINKEDIN_FIFO_SEARCH_URL: z.string().url().optional(),
  LINKEDIN_FIFO_CRON: z.string().min(1).optional(),
  LINKEDIN_FIFO_MAX_RESULTS: z.coerce.number().int().positive().max(25).optional()
});

export function getConfig() {
  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) {
    const pretty = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${pretty}`);
  }
  const cfg = parsed.data;

  return {
    ...cfg,
    DISCORD_SUBSCRIBER_VOICE_CHANNEL_ID:
      cfg.DISCORD_SUBSCRIBER_VOICE_CHANNEL_ID || undefined,
    SEEK_FIFO_ENABLED: parseEnvBoolean(cfg.SEEK_FIFO_ENABLED, false),
    SEEK_FIFO_CHANNEL_ID: cfg.SEEK_FIFO_CHANNEL_ID || undefined,
    SEEK_FIFO_SEARCH_URL: cfg.SEEK_FIFO_SEARCH_URL || "https://au.seek.com/FIFO-jobs",
    SEEK_FIFO_CRON: cfg.SEEK_FIFO_CRON || "0 * * * *",
    SEEK_FIFO_MAX_RESULTS: cfg.SEEK_FIFO_MAX_RESULTS || 10,

    LINKEDIN_FIFO_ENABLED: parseEnvBoolean(cfg.LINKEDIN_FIFO_ENABLED, false),
    LINKEDIN_FIFO_CHANNEL_ID: cfg.LINKEDIN_FIFO_CHANNEL_ID || undefined,
    LINKEDIN_FIFO_SEARCH_URL:
      cfg.LINKEDIN_FIFO_SEARCH_URL ||
      "https://www.linkedin.com/jobs/search?keywords=%28FIFO%2BOR%2BDIDO%2BOR%2BOil%2BOR%2BGas%2BOR%2BConstruction%2BFifo%2BOR%2BFifo%2BMining%29&location=Australia&geoId=101452733&f_TPR=r86400",
    LINKEDIN_FIFO_CRON: cfg.LINKEDIN_FIFO_CRON || "7 * * * *",
    LINKEDIN_FIFO_MAX_RESULTS: cfg.LINKEDIN_FIFO_MAX_RESULTS || 10
  };
}
