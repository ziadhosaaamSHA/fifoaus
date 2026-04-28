import express from "express";
import { z } from "zod";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import { getConfig } from "./config.js";
import { createStripeClient } from "./stripe/client.js";
import { createStripeWebhookHandler } from "./stripe/webhook.js";
import { renderResultPage, renderLandingPage } from "./pages/resultPages.js";
import {
  getInviteToken,
  consumeInviteToken,
  isDbEnabled as isInviteDbEnabled
} from "./db/inviteTokens.js";

const checkoutBodySchema = z.object({
  discord_id: z.string().regex(/^\d{17,20}$/),
  customer_email: z.string().email().optional()
});

export function createApp({ bot }) {
  const cfg = getConfig();
  const stripe = createStripeClient(cfg);

  const app = express();
  app.set("trust proxy", 1);
  app.use(cookieParser());

  app.get("/", (_req, res) => res.status(200).type("html").send(renderLandingPage(cfg)));
  app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
  app.get("/success", (_req, res) =>
    res.status(200).type("html").send(
      renderResultPage({
        variant: "success",
        title: "Payment Successful",
        message: "Thanks! You will be automatically added to the Discord server with Premium access. If you don't see it within a minute, contact support.",
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
  app.get("/invite/success", (_req, res) =>
    res.status(200).type("html").send(
      renderResultPage({
        variant: "success",
        title: "Access Granted",
        message: "You're all set. Premium access has been enabled in the Discord server.",
        supportText: cfg.SUPPORT_TEXT
      })
    )
  );
  app.get("/fail", (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    let message = code
      ? `Something went wrong (${code}). Please contact support.`
      : "Something went wrong. Please contact support.";
    let title = "Payment Error";

    if (code === "not_in_server") {
      message = "We couldn't add you to the server. Please join manually before subscribing, or check if you've reached your server limit.";
    } else if (code === "already_premium") {
      message = "You already have Premium access.";
    } else if (code === "invite_invalid") {
      message = "This access link is invalid or has already been used.";
      title = "Access Error";
    } else if (code === "invite_unavailable") {
      message = "Access links are temporarily unavailable. Please contact support.";
      title = "Access Error";
    } else if (code === "invite_user_mismatch") {
      message = "This access link was generated for a different Discord account.";
      title = "Access Error";
    }
    res.status(200).type("html").send(
      renderResultPage({
        variant: "fail",
        title,
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

  const getRedirectUri = (req) => {
    return (cfg.BASE_URL || `${req.protocol}://${req.get("host")}`) + "/auth/discord/callback";
  };

  const stripTrailingSlash = (url) => (url.endsWith("/") ? url.slice(0, -1) : url);

  app.get(
    "/invite/:token",
    asyncRoute(async (req, res) => {
      const token = req.params.token;
      if (!token) return res.redirect("/fail?code=invite_invalid");
      if (!isInviteDbEnabled()) return res.redirect("/fail?code=invite_unavailable");

      const invite = await getInviteToken({ token });
      if (!invite || invite.uses >= invite.max_uses) {
        return res.redirect("/fail?code=invite_invalid");
      }

      res.cookie("invite_token", token, {
        httpOnly: true,
        secure: req.protocol === "https",
        maxAge: 10 * 60 * 1000
      });
      res.cookie("discord_oauth_mode", "invite", {
        httpOnly: true,
        secure: req.protocol === "https",
        maxAge: 10 * 60 * 1000
      });

      return res.redirect("/auth/discord");
    })
  );

  app.get("/auth/discord", (req, res) => {
    const state = crypto.randomBytes(16).toString("hex");
    res.cookie("discord_oauth_state", state, {
      httpOnly: true,
      secure: req.protocol === "https",
      maxAge: 5 * 60 * 1000
    });

    const redirectUri = encodeURIComponent(getRedirectUri(req));
    const clientId = cfg.DISCORD_CLIENT_ID;
    const scopes = encodeURIComponent("identify guilds guilds.join");

    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}&state=${state}`);
  });

  app.get(
    "/auth/discord/callback",
    asyncRoute(async (req, res) => {
      const { code, state } = req.query;
      const savedState = req.cookies.discord_oauth_state;

      if (!state || state !== savedState) {
        return res.redirect("/fail?code=invalid_state");
      }
      if (!code) {
        return res.redirect("/fail?code=access_denied");
      }

      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: cfg.DISCORD_CLIENT_ID,
          client_secret: cfg.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: getRedirectUri(req)
        })
      });

      if (!tokenResponse.ok) throw new Error("Failed to exchange token");
      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!userResponse.ok) throw new Error("Failed to fetch user");
      const userData = await userResponse.json();
      const discord_id = userData.id;

      const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!guildsResponse.ok) throw new Error("Failed to fetch guilds");
      const guildsData = await guildsResponse.json();
      const inGuild = guildsData.some((g) => g.id === cfg.DISCORD_GUILD_ID);

      const oauthMode = req.cookies.discord_oauth_mode;
      const inviteToken = req.cookies.invite_token;

      if (oauthMode === "invite" && inviteToken) {
        res.clearCookie("discord_oauth_mode");
        res.clearCookie("invite_token");
        res.clearCookie("discord_oauth_state");

        if (!isInviteDbEnabled()) {
          return res.redirect("/fail?code=invite_unavailable");
        }

        const invite = await getInviteToken({ token: inviteToken });
        if (!invite || invite.uses >= invite.max_uses) {
          return res.redirect("/fail?code=invite_invalid");
        }

        if (invite.discord_id && invite.discord_id !== discord_id) {
          return res.redirect("/fail?code=invite_user_mismatch");
        }

        const consumed = await consumeInviteToken({ token: inviteToken });
        if (!consumed) {
          return res.redirect("/fail?code=invite_invalid");
        }

        await bot.grantPremium({ discordId: discord_id, accessToken, reason: "invite:oauth" });

        return res.redirect("/invite/success");
      }

      if (inGuild && bot?.hasPremium && (await bot.hasPremium({ discordId: discord_id }))) {
        return res.redirect("/fail?code=already_premium");
      }

      const baseUrl = stripTrailingSlash(cfg.BASE_URL || `${req.protocol}://${req.get("host")}`);
      const successUrl = cfg.SUCCESS_URL || `${baseUrl}/success`;
      const cancelUrl = cfg.CANCEL_URL || `${baseUrl}/cancel`;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: cfg.STRIPE_PRICE_ID, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { discord_id, discord_access_token: accessToken },
        subscription_data: {
          metadata: { discord_id }
        }
      });

      res.redirect(session.url);
    })
  );



  app.post(
    "/checkout-session",
    express.json(),
    asyncRoute(async (req, res) => {
      const parsed = checkoutBodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "invalid_request" });

      const { discord_id, customer_email } = parsed.data;

      if (bot?.hasPremium && (await bot.hasPremium({ discordId: discord_id }))) {
        return res.status(409).json({ error: "already_premium" });
      }

      // Stripe requires absolute URLs. Prefer explicit env vars, otherwise derive from the request host.
      const baseUrl = stripTrailingSlash(cfg.BASE_URL || `${req.protocol}://${req.get("host")}`);
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


  webhookRouter.post(
    "/webhook",
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
