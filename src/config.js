import { z } from "zod";

const discordIdSchema = z.string().regex(/^\d{17,20}$/, "invalid discord id");

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
  DISCORD_SUBSCRIBER_VOICE_CHANNEL_ID: discordIdSchema.optional().or(z.literal(""))
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
      cfg.DISCORD_SUBSCRIBER_VOICE_CHANNEL_ID || undefined
  };
}
