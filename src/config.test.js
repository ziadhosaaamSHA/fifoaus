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
    vi.stubEnv("CONTENT_API_BASE_URL", undefined);
    vi.stubEnv("CONTENT_API_TOKEN", undefined);
    vi.stubEnv("DISCORD_SUBSCRIBER_VOICE_CHANNEL_ID", "123456789012345678");
    vi.stubEnv("FIFO_JOBS_CHANNEL_ID", "123456789012345678");
    vi.stubEnv("NEWS_CHANNEL_ID", "");
    vi.stubEnv("SEEK_FIFO_ENABLED", "false");
    vi.stubEnv("SEEK_FIFO_CRON", "0 * * * *");
    vi.stubEnv("SEEK_FIFO_MAX_RESULTS", "10");
    vi.stubEnv("LINKEDIN_FIFO_ENABLED", "false");
    vi.stubEnv("LINKEDIN_FIFO_CRON", "7 * * * *");
    vi.stubEnv("LINKEDIN_FIFO_MAX_RESULTS", "10");
    vi.stubEnv("NEWS_ENABLED", "false");
    vi.stubEnv("NEWS_CRON", "15 * * * *");
    vi.stubEnv("NEWS_MAX_RESULTS", "5");
    vi.stubEnv("NEWS_SOURCE", "australian-mining-review");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should successfully parse valid environment configuration", () => {
    const config = getConfig();
    expect(config.STRIPE_SECRET).toBe("sk_test_123");
    expect(config.DISCORD_CLIENT_ID).toBe("123456789012345678");
    expect(config.SEEK_FIFO_ENABLED).toBe(false); // Default
    expect(config.SEEK_FIFO_MAX_RESULTS).toBe(10);
    expect(config.FIFO_JOBS_CHANNEL_ID).toBe("123456789012345678");
    expect(config.NEWS_CHANNEL_ID).toBeUndefined();
    expect(config.NEWS_ENABLED).toBe(false);
    expect(config.NEWS_MAX_RESULTS).toBe(5);
    expect(config.NEWS_SOURCE).toBe("australian-mining-review");
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

  it("should parse NEWS_ENABLED boolean flag correctly", () => {
    vi.stubEnv("NEWS_ENABLED", "true");
    const config = getConfig();
    expect(config.NEWS_ENABLED).toBe(true);
  });

  it("should parse optional content API settings", () => {
    vi.stubEnv("CONTENT_API_BASE_URL", "https://content-api.example.com");
    vi.stubEnv("CONTENT_API_TOKEN", "secret-token");

    const config = getConfig();

    expect(config.CONTENT_API_BASE_URL).toBe("https://content-api.example.com");
    expect(config.CONTENT_API_TOKEN).toBe("secret-token");
  });

  it("should treat blank content API settings as unset", () => {
    vi.stubEnv("CONTENT_API_BASE_URL", "");
    vi.stubEnv("CONTENT_API_TOKEN", "");

    const config = getConfig();

    expect(config.CONTENT_API_BASE_URL).toBeUndefined();
    expect(config.CONTENT_API_TOKEN).toBeUndefined();
  });
});
