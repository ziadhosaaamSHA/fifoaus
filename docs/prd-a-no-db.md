# PRD A — Paid Discord Server (No Database)

## 1. Product Overview

Build a system that allows users to:

1. Join a **Discord server**
2. Purchase a **monthly subscription via Stripe**
3. Automatically receive a **Premium role**
4. Lose access automatically when subscription ends

Infrastructure will run on **Railway**.

This version **does not persist subscription state** in a database.

---

## 2. Goals

### Primary

- Fully automated subscription access
- Secure webhook processing
- Minimal infrastructure
- Easy deployment

### Non-Goals

- revenue analytics
- subscription history
- churn tracking
- advanced user management

---

## 3. User Flow

### Join Server

User clicks Discord invite link.

### Subscribe

User clicks **Subscribe** on website.

Backend creates Stripe checkout session.

### Payment Success

Stripe sends webhook:

```txt
checkout.session.completed
```

Backend triggers bot to add role.

### Subscription Expiration

Stripe sends:

```txt
customer.subscription.deleted
invoice.payment_failed
```

Bot removes role.

---

## 4. Discord Server Requirements

Roles:

```txt
Admin
Moderator
Bot
Premium Member
Free Member
```

Important rule:

```txt
Bot role must be above Premium Member
```

### Channel Categories

**START HERE**

```txt
welcome
how-to-subscribe
announcements
```

**COMMUNITY**

```txt
general
support
introductions
```

**PREMIUM**

```txt
premium-chat
resources
signals
private-discussions
```

Visible only to Premium role.

### Subscriber Counter

Voice channel example:

```txt
📈 Subscribers: 0
```

Bot updates channel name based on role count.

---

## 5. Backend Requirements

Responsibilities:

```txt
create Stripe checkout sessions
receive Stripe webhooks
validate webhook signatures
trigger Discord bot actions
update subscriber counter
```

Single Node.js service.

---

## 6. Discord Bot Requirements

Bot must support:

### Role Assignment

Triggered by:

```txt
checkout.session.completed
```

Action:

```txt
add Premium role
```

### Role Removal

Triggered by:

```txt
customer.subscription.deleted
invoice.payment_failed
```

Action:

```txt
remove Premium role
```

### Subscriber Counter

Bot counts members with Premium role and updates channel name.

### Status Command

Slash command:

```txt
/status
```

Returns:

```txt
subscriber count
bot health
```

---

## 7. Security Requirements

### Stripe Webhook Verification

All webhook requests must verify Stripe signature using HMAC.

Requests failing verification must return HTTP 400.

### Rate Limiting

Endpoints must enforce rate limits.

Recommended policy:

```txt
/stripe/webhook → 100 requests/minute
/checkout-session → 10 requests/minute per IP
```

Purpose:

```txt
prevent DoS attacks
prevent checkout abuse
```

### Input Validation

All incoming data must be validated:

```txt
Discord ID numeric
Stripe IDs valid format
```

Reject invalid requests.

### Environment Secret Protection

Secrets stored only in environment variables:

```txt
DISCORD_TOKEN
STRIPE_SECRET
STRIPE_WEBHOOK_SECRET
```

Never committed to repository.

### Discord Permission Restrictions

Disable dangerous permissions for `@everyone`:

```txt
Manage Roles
Manage Channels
Kick Members
Ban Members
Create Invites
```

---

## 8. Reliability Requirements

### Stripe Event Idempotency

Webhook processing must avoid duplicate execution.

Strategy (No-DB version):

```txt
ignore duplicate webhook events by checking event id in memory cache
```

Cache expiration recommended: 24 hours.

### Retry Handling

Stripe retries failed webhooks.

Server must return HTTP 200 after successful processing.

---

## 9. Infrastructure

Deployment target: **Railway**

Service includes:

```txt
Node backend
Discord bot
Stripe webhook endpoint
```

Environment variables stored in Railway.

---

## 10. Limitations

Without a database:

```txt
missed webhook = potential desync
no historical tracking
no analytics
```

Stripe acts as the only persistent source of truth.

