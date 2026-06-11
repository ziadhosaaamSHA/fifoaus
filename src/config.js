import { z } from "zod";

const discordIdSchema = z.string().regex(/^\d{17,20}$/, "invalid discord id");
const envBooleanSchema = z.enum(["true", "false"]);

function parseEnvBoolean(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return value === "true";
}

function parseCsv(value, fallback) {
  const rawValue = value || fallback;
  return rawValue
    .split(",")
    .map((item) => item.trim().replace(/^[A-Z_]+=/, "").trim())
    .filter(Boolean);
}

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().optional(),
  BASE_URL: z.string().url().optional(),
  SUCCESS_URL: z.string().url().optional(),
  CANCEL_URL: z.string().url().optional(),
  SUPPORT_TEXT: z.string().optional(),
  CONTENT_API_BASE_URL: z.string().url().optional().or(z.literal("")),
  CONTENT_API_TOKEN: z.string().min(1).optional().or(z.literal("")),

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
  FIFO_JOBS_CHANNEL_ID: discordIdSchema.optional().or(z.literal("")),
  NEWS_CHANNEL_ID: discordIdSchema.optional().or(z.literal("")),

  SEEK_FIFO_ENABLED: envBooleanSchema.optional(),
  SEEK_FIFO_CRON: z.string().min(1).optional(),
  SEEK_FIFO_MAX_RESULTS: z.coerce.number().int().positive().max(25).optional(),

  LINKEDIN_FIFO_ENABLED: envBooleanSchema.optional(),
  LINKEDIN_FIFO_CRON: z.string().min(1).optional(),
  LINKEDIN_FIFO_MAX_RESULTS: z.coerce.number().int().positive().max(25).optional(),

  NEWS_ENABLED: envBooleanSchema.optional(),
  NEWS_CRON: z.string().min(1).optional(),
  NEWS_MAX_RESULTS: z.coerce.number().int().positive().max(25).optional(),
  NEWS_SOURCE: z.string().min(1).optional()
});

function formatConfigError(error) {
  return error.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

export function getConfig() {
  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${formatConfigError(parsed.error)}`);
  }
  const cfg = parsed.data;

  return {
    ...cfg,
    CONTENT_API_BASE_URL: cfg.CONTENT_API_BASE_URL || undefined,
    CONTENT_API_TOKEN: cfg.CONTENT_API_TOKEN || undefined,
    DISCORD_SUBSCRIBER_VOICE_CHANNEL_ID:
      cfg.DISCORD_SUBSCRIBER_VOICE_CHANNEL_ID || undefined,
    FIFO_JOBS_CHANNEL_ID: cfg.FIFO_JOBS_CHANNEL_ID || undefined,
    NEWS_CHANNEL_ID: cfg.NEWS_CHANNEL_ID || undefined,
    SEEK_FIFO_ENABLED: parseEnvBoolean(cfg.SEEK_FIFO_ENABLED, false),
    SEEK_FIFO_CRON: cfg.SEEK_FIFO_CRON || "0 * * * *",
    SEEK_FIFO_MAX_RESULTS: cfg.SEEK_FIFO_MAX_RESULTS || 10,

    LINKEDIN_FIFO_ENABLED: parseEnvBoolean(cfg.LINKEDIN_FIFO_ENABLED, false),
    LINKEDIN_FIFO_CRON: cfg.LINKEDIN_FIFO_CRON || "7 * * * *",
    LINKEDIN_FIFO_MAX_RESULTS: cfg.LINKEDIN_FIFO_MAX_RESULTS || 10,

    NEWS_ENABLED: parseEnvBoolean(cfg.NEWS_ENABLED, false),
    NEWS_CRON: cfg.NEWS_CRON || "*/15 * * * *",
    NEWS_MAX_RESULTS: cfg.NEWS_MAX_RESULTS || 5,
    NEWS_SOURCE: cfg.NEWS_SOURCE || "australian-mining-review",
    NEWS_SOURCES: parseCsv(cfg.NEWS_SOURCE, "australian-mining-review")
  };
}
