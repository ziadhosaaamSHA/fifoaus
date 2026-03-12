import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { getConfig } from "./config.js";
import { createStripeClient } from "./stripe/client.js";
import { createStripeWebhookHandler } from "./stripe/webhook.js";
import { renderSubscribePage } from "./pages/subscribePage.js";
import { renderResultPage } from "./pages/resultPages.js";

const checkoutBodySchema = z.object({
  discord_id: z.string().regex(/^\d{17,20}$/),
  customer_email: z.string().email().optional()
});

export function createApp({ bot }) {
  const cfg = getConfig();
  const stripe = createStripeClient(cfg);

  const app = express();
  app.set("trust proxy", 1);

  app.get("/", (_req, res) => res.status(200).type("html").send(renderSubscribePage()));
  app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
  app.get("/success", (_req, res) =>
    res.status(200).type("html").send(
      renderResultPage({
        variant: "success",
        title: "Payment Successful",
        message: "Thanks. If your Discord role doesn't update within a minute, contact support.",
        supportText: cfg.SUPPORT_TEXT
      })
    )
  );
  app.get("/cancel", (_req, res) =>
    res.status(200).type("html").send(
      renderResultPage({
        variant: "cancel",
        title: "Checkout Cancelled",
        message: "No worries. You can try again whenever you're ready.",
        supportText: cfg.SUPPORT_TEXT
      })
    )
  );
  app.get("/fail", (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const message = code
      ? `Something went wrong (${code}). Please contact support.`
      : "Something went wrong. Please contact support.";
    res.status(200).type("html").send(
      renderResultPage({
        variant: "fail",
        title: "Payment Error",
        message,
        supportText: cfg.SUPPORT_TEXT
      })
    );
  });

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

      if (bot?.hasPremium && (await bot.hasPremium({ discordId: discord_id }))) {
        return res.status(409).json({ error: "already_premium" });
      }

      // Stripe requires absolute URLs. Prefer explicit env vars, otherwise derive from the request host.
      const baseUrl = cfg.BASE_URL || `${req.protocol}://${req.get("host")}`;
      const successUrl = cfg.SUCCESS_URL || `${baseUrl}/success`;
      const cancelUrl = cfg.CANCEL_URL || `${baseUrl}/cancel`;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: cfg.STRIPE_PRICE_ID, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
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
    // Prefer JSON for API, but show a human page when a browser hits an HTML route.
    if (res.headersSent) return;
    if (typeof _req?.accepts === "function" && _req.accepts("html")) {
      res.status(500).type("html").send(
        renderResultPage({
          variant: "fail",
          title: "Server Error",
          message: "An unexpected error occurred. Please contact support.",
          supportText: cfg.SUPPORT_TEXT,
          primaryHref: "/fail?code=server_error",
          primaryLabel: "Details"
        })
      );
      return;
    }
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
