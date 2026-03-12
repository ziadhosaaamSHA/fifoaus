import { z } from "zod";

const discordIdSchema = z.string().regex(/^\d{17,20}$/, "invalid discord id");

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().optional(),
  BASE_URL: z.string().url().optional(),
  SUCCESS_URL: z.string().url().optional(),
  CANCEL_URL: z.string().url().optional(),

  STRIPE_SECRET: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_ID: z
    .string()
    .regex(/^price_[a-zA-Z0-9]+$/, "invalid Stripe price id"),

  DISCORD_TOKEN: z.string().min(1),
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

  // On Railway, `RAILWAY_PUBLIC_DOMAIN` is provided automatically, e.g. `example.up.railway.app`.
  // We can use it to build default redirect URLs and avoid hardcoding per-deploy domains.
  const railwayPublicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  const derivedBase =
    typeof railwayPublicDomain === "string" && railwayPublicDomain.length > 0
      ? `https://${railwayPublicDomain}`
      : undefined;

  const successUrl = cfg.SUCCESS_URL || (derivedBase ? `${derivedBase}/success` : undefined);
  const cancelUrl = cfg.CANCEL_URL || (derivedBase ? `${derivedBase}/cancel` : undefined);

  if (!successUrl || !cancelUrl) {
    throw new Error(
      "Missing SUCCESS_URL/CANCEL_URL. Set them for local dev, or deploy on Railway with a public domain."
    );
  }

  return {
    ...cfg,
    SUCCESS_URL: successUrl,
    CANCEL_URL: cancelUrl,
    DISCORD_SUBSCRIBER_VOICE_CHANNEL_ID:
      cfg.DISCORD_SUBSCRIBER_VOICE_CHANNEL_ID || undefined
  };
}
