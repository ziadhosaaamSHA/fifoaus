# Paid Discord Server (No DB)

Single Node.js service that:

- Creates Stripe Checkout sessions for a monthly subscription
- Verifies Stripe webhooks (signature + idempotency)
- Adds/removes a Discord Premium role
- Updates an optional subscriber counter voice channel

## Local dev

1. Install deps: `npm i`
2. Create `.env` from `.env.example`
3. Start: `npm run dev`

## API

Create a Stripe Checkout session:

`POST /checkout-session`

```json
{
  "discord_id": "123456789012345678",
  "customer_email": "optional@example.com"
}
```

Returns `{ "url": "https://checkout.stripe.com/..." }`.

## Discord (in-server button)

The bot can create a Checkout session for the user who clicks a button.

- `/post-subscribe` (Manage Server) posts a "Subscribe" button in the current channel.
- When a user clicks it, the bot creates a Checkout session using their Discord user ID and replies with an ephemeral "Open Checkout" link.
- `/subscribe` is the same flow but as a command.

Note: for this Discord-initiated checkout flow you must set `BASE_URL` (or explicit `SUCCESS_URL`/`CANCEL_URL`) so Stripe gets absolute redirect URLs.

### Webhook

Expose locally (example): `stripe listen --forward-to localhost:3000/stripe/webhook`

## Notes (No DB)

- Discord ID is stored in Stripe metadata (`session.metadata.discord_id` and `subscription.metadata.discord_id`). This is how webhooks map back to a member without a database.
- The bot needs the `GuildMembers` privileged intent enabled in the Discord Developer Portal to reliably fetch members for role changes/counting.

## Railway

Deploy as one service with the same env vars as `.env.example`.
