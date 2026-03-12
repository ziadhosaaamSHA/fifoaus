import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { getConfig } from "./config.js";
import { createStripeClient } from "./stripe/client.js";
import { createStripeWebhookHandler } from "./stripe/webhook.js";

const checkoutBodySchema = z.object({
  discord_id: z.string().regex(/^\d{17,20}$/),
  customer_email: z.string().email().optional()
});

export function createApp({ bot }) {
  const cfg = getConfig();
  const stripe = createStripeClient(cfg);

  const app = express();
  app.set("trust proxy", 1);

  app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
  app.get("/success", (_req, res) => res.status(200).send("Payment success. You can close this tab."));
  app.get("/cancel", (_req, res) => res.status(200).send("Checkout cancelled. You can close this tab."));

  const asyncRoute =
    (fn) =>
    (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };

  // Rate limit checkout creation to prevent abuse.
  const checkoutLimiter = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false
  });

  app.post(
    "/checkout-session",
    checkoutLimiter,
    express.json(),
    asyncRoute(async (req, res) => {
      const parsed = checkoutBodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

      const { discord_id, customer_email } = parsed.data;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: cfg.STRIPE_PRICE_ID, quantity: 1 }],
        success_url: cfg.SUCCESS_URL,
        cancel_url: cfg.CANCEL_URL,
        customer_email: customer_email || undefined,
        metadata: { discord_id },
        subscription_data: {
          metadata: { discord_id }
        }
      });

      return res.status(200).json({ url: session.url });
    })
  );

  const webhookRouter = express.Router();
  const webhookLimiter = rateLimit({
    windowMs: 60_000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Stripe doesn't set stable IPs for all regions; enforce a global cap.
    keyGenerator: () => "stripe-webhook-global"
  });

  webhookRouter.post(
    "/webhook",
    webhookLimiter,
    express.raw({ type: "application/json" }),
    createStripeWebhookHandler({ cfg, stripe, bot })
  );
  app.use("/stripe", webhookRouter);

  app.use((err, _req, res, _next) => {
    console.error("[http] unhandled error", err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
