# Paid Discord Server

Single Node.js service that:

- Creates Stripe Checkout sessions for a monthly subscription
- Verifies Stripe webhooks (signature + idempotency)
- Adds/removes a Discord Premium role
- Updates an optional subscriber counter voice channel
- Can scrape FIFO job listings from SEEK on an env-driven cron schedule and post new jobs to Discord

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
- `/post-invite` (Manage Server) replies with a private "Generate Invite Link" button for admins. It creates a one-time access link you can email to existing subscribers.

Note: for this Discord-initiated checkout flow you must set `BASE_URL` (or explicit `SUCCESS_URL`/`CANCEL_URL`) so Stripe gets absolute redirect URLs.

### Webhook

Expose locally (example): `stripe listen --forward-to localhost:3000/stripe/webhook`

## Database (Postgres)

Set `DATABASE_URL`. The app uses an `invite_tokens` table with:

- `token` (PK)
- `discord_id` (nullable, `TEXT` or `BIGINT`)
- `max_uses`
- `uses`
- `created_at`
- `used_at`

Optional (for future reporting): a `subscribers` table can store Stripe status, but it is **not** used for access decisions.

If you already created tables with `INTEGER`, run:

```sql
ALTER TABLE subscribers ALTER COLUMN discord_id TYPE TEXT;
ALTER TABLE invite_tokens ALTER COLUMN discord_id TYPE TEXT;
```

## One-time access link (existing subscribers)

Create a single-use access link (token-based) that routes through OAuth:

```bash
npm run invite:one-time -- --discord-id 123456789012345678
```

If you omit `--discord-id`, the link can be redeemed by any Discord account with an active subscription.

## SEEK CLI scrape

Run a one-off SEEK FIFO scrape from the command line:

## Notes

- Discord ID is stored in Stripe metadata (`session.metadata.discord_id` and `subscription.metadata.discord_id`). This is how webhooks map back to a member without a database.
- The bot needs the `GuildMembers` privileged intent enabled in the Discord Developer Portal to reliably fetch members for role changes/counting.

## FIFO jobs

The bot consumes jobs from the separate `content-api` service and posts all FIFO job
sources into one Discord channel:

```env
CONTENT_API_BASE_URL=https://your-content-api.railway.app
CONTENT_API_TOKEN=shared-secret
FIFO_JOBS_CHANNEL_ID=123456789012345678

SEEK_FIFO_ENABLED=true
SEEK_FIFO_CRON=0 * * * *
SEEK_FIFO_MAX_RESULTS=10

LINKEDIN_FIFO_ENABLED=true
LINKEDIN_FIFO_CRON=7 * * * *
LINKEDIN_FIFO_MAX_RESULTS=10

NEWS_CHANNEL_ID=123456789012345678
NEWS_ENABLED=true
NEWS_CRON=15 * * * *
NEWS_MAX_RESULTS=5
NEWS_SOURCE=australian-mining-review,australian-mining,industry-qld,paydirt,mining-technology
```

- `SEEK_FIFO_CRON` and `LINKEDIN_FIFO_CRON` use standard 5-field cron format in the server's local timezone.
- `FIFO_JOBS_CHANNEL_ID` is the single destination for all FIFO job sources.
- `NEWS_CHANNEL_ID` is the destination for mining/news embeds.
- `NEWS_SOURCE` can be one content-api source key or a comma-separated list, for example `australian-mining-review,australian-mining,industry-qld,paydirt,mining-technology`.
- Scraping, dedupe, and content persistence live in `content-api`.

## Railway

Deploy the root app as the Discord bot/consumer service. Deploy `content-api/` as a
separate Railway service.
