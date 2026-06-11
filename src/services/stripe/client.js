import Stripe from "stripe";

/**
 * Initializes and returns a new Stripe SDK instance with the configured secret key.
 * 
 * @param {Object} cfg - App configuration object
 * @param {string} cfg.STRIPE_SECRET - Stripe API secret key
 * @returns {Stripe} Initialized Stripe SDK client
 */
export function createStripeClient(cfg) {
  return new Stripe(cfg.STRIPE_SECRET, {
    typescript: false
  });
}
