import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getConfig } from "./config.js";

describe("getConfig", () => {

  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET", "sk_test_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_123");
    vi.stubEnv("STRIPE_PRICE_ID", "price_12345");
    vi.stubEnv("DISCORD_TOKEN", "token123");
    vi.stubEnv("DISCORD_CLIENT_ID", "123456789012345678");
    vi.stubEnv("DISCORD_CLIENT_SECRET", "client_secret123");
    vi.stubEnv("DISCORD_GUILD_ID", "123456789012345678");
    vi.stubEnv("DISCORD_PREMIUM_ROLE_ID", "123456789012345678");
    
    // Explicitly stub optional env variables to undefined/empty to avoid leakage from host shell
    vi.stubEnv("BASE_URL", "http://localhost:3000");
    vi.stubEnv("SUCCESS_URL", "http://localhost:3000/success");
    vi.stubEnv("CANCEL_URL", "http://localhost:3000/cancel");
    vi.stubEnv("DISCORD_SUBSCRIBER_VOICE_CHANNEL_ID", "123456789012345678");
    vi.stubEnv("SEEK_FIFO_ENABLED", "false");
    vi.stubEnv("SEEK_FIFO_CHANNEL_ID", "123456789012345678");
    vi.stubEnv("SEEK_FIFO_SEARCH_URL", "https://au.seek.com/FIFO-jobs");
    vi.stubEnv("SEEK_FIFO_CRON", "0 * * * *");
    vi.stubEnv("SEEK_FIFO_MAX_RESULTS", "10");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should successfully parse valid environment configuration", () => {
    const config = getConfig();
    expect(config.STRIPE_SECRET).toBe("sk_test_123");
    expect(config.DISCORD_CLIENT_ID).toBe("123456789012345678");
    expect(config.SEEK_FIFO_ENABLED).toBe(false); // Default
    expect(config.SEEK_FIFO_SEARCH_URL).toBe("https://au.seek.com/FIFO-jobs"); // Default
  });

  it("should throw an error if a required field is missing", () => {
    vi.stubEnv("STRIPE_SECRET", ""); // invalid length
    expect(() => getConfig()).toThrow(/STRIPE_SECRET/);
  });

  it("should fail validation on malformed stripe price ID", () => {
    vi.stubEnv("STRIPE_PRICE_ID", "not-a-valid-stripe-price-id");
    expect(() => getConfig()).toThrow(/STRIPE_PRICE_ID/);
  });

  it("should fail validation on invalid discord ID format", () => {
    vi.stubEnv("DISCORD_CLIENT_ID", "123");
    expect(() => getConfig()).toThrow(/DISCORD_CLIENT_ID/);
  });

  it("should parse SEEK_FIFO_ENABLED boolean flag correctly", () => {
    vi.stubEnv("SEEK_FIFO_ENABLED", "true");
    const config = getConfig();
    expect(config.SEEK_FIFO_ENABLED).toBe(true);
  });
});
