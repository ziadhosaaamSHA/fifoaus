# PRD B — Paid Discord Server (With Database)

## 1. Product Overview

Same system as PRD A, but adds persistence using: **PostgreSQL**

Database ensures reliable subscription tracking and role synchronization.

---

## 2. Goals

Primary goals:

```txt
accurate subscription state
self-healing role sync
analytics capability
resilience to webhook failures
```

---

## 3. Architecture

```txt
User
 ↓
Website
 ↓
Stripe Checkout
 ↓
Stripe Webhook
 ↓
Backend API
 ↓
PostgreSQL Database
 ↓
Discord Bot
 ↓
Role Assignment
```

---

## 4. Database Schema

### users table

Fields:

```txt
id
discord_id
stripe_customer_id
stripe_subscription_id
subscription_status
created_at
```

Status values:

```txt
active
past_due
cancelled
trial
```

### payments table (optional)

Fields:

```txt
stripe_invoice_id
discord_id
amount
currency
created_at
```

Used for revenue tracking.

---

## 5. Subscription Lifecycle

### Checkout

Insert user if not exists.

### Payment Success

Event:

```txt
checkout.session.completed
```

Backend actions:

```txt
update DB
set status active
store subscription id
assign Discord role
```

### Renewal

Event:

```txt
invoice.paid
```

Update status to active.

### Cancellation

Event:

```txt
customer.subscription.deleted
```

Backend:

```txt
update status cancelled
remove role
```

---

## 6. Role Synchronization

When bot starts:

```sql
SELECT discord_id
FROM users
WHERE subscription_status='active'
```

Verify each member has Premium role.

Repair mismatches automatically.

---

## 7. Subscriber Counter

Subscriber count calculated from DB:

```sql
SELECT COUNT(*)
FROM users
WHERE subscription_status='active'
```

More reliable than Discord role count.

---

## 8. Security Requirements

Same requirements as PRD A plus additional protections.

### Database Security

Database credentials stored in:

```txt
DATABASE_URL
```

Access restricted to backend service.

### Event Idempotency

Use Stripe `event_id` stored in database.

Table example: `stripe_events`

Fields:

```txt
event_id
processed_at
```

If event already exists:

```txt
ignore duplicate processing
```

### Rate Limiting

Apply limits:

```txt
/checkout-session → 10 requests/min/IP
/stripe/webhook → 100 requests/min
```

### Input Validation

Validate:

```txt
discord_id format
stripe ids
subscription status values
```

---

## 9. Reliability Requirements

### Webhook Recovery

If webhook fails:

```txt
Stripe retries
```

If webhook missed: system can resync by querying Stripe subscriptions.

### Bot Restart Recovery

When bot starts:

```txt
sync roles using database state
```

Ensures no access mismatch.

---

## 10. Infrastructure

Services on **Railway**

```txt
Node backend
PostgreSQL service
Discord bot
```

---

## 11. Operational Monitoring

Logs must include:

```txt
webhook events
role assignment actions
errors
```

Logs accessible through Railway.

---

## 12. Advantages Over No-DB Version

```txt
role recovery
subscription history
analytics capability
duplicate webhook protection
data consistency
```

---

## Final Recommendation

Use **No-DB version** if:

```txt
small private server
<200 subscribers
```

Use **Database version** if:

```txt
long-term project
>500 subscribers
or revenue-critical system
```

