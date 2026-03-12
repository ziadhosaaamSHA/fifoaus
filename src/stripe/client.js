import Stripe from "stripe";

export function createStripeClient(cfg) {
  return new Stripe(cfg.STRIPE_SECRET, {
    typescript: false
  });
}
