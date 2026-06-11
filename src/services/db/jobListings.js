import { isDbEnabled, query } from "./pool.js";

export { isDbEnabled };

export async function ensureJobListingsTable() {
  if (!isDbEnabled()) return;

  await query(`
    CREATE TABLE IF NOT EXISTS seek_listings_seen (
      source TEXT NOT NULL,
      external_id TEXT NOT NULL,
      title TEXT,
      url TEXT NOT NULL,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (source, external_id)
    )
  `);

  await query(`
    ALTER TABLE seek_listings_seen
    ADD COLUMN IF NOT EXISTS platform TEXT
  `);

  await query(`
    ALTER TABLE seek_listings_seen
    ADD COLUMN IF NOT EXISTS matched_keywords TEXT[]
  `);
}

export async function countSeenJobListings({ source }) {
  if (!isDbEnabled()) {
    throw new Error("database_not_configured");
  }

  const { rows } = await query(
    `
    SELECT COUNT(*)::int AS count
    FROM seek_listings_seen
    WHERE source = $1
    `,
    [source]
  );

  return rows[0]?.count || 0;
}

/**
 * Marks a listing as seen. `source` partitions scraper streams, e.g. "seek:fifo"
 * and "linkedin:fifo", while the table name remains SEEK-prefixed for backward
 * compatibility with existing deployments.
 */
export async function markJobListingSeen({
  source,
  externalId,
  title,
  url,
  platform,
  matchedKeywords
}) {
  if (!isDbEnabled()) {
    throw new Error("database_not_configured");
  }

  const { rows } = await query(
    `
    INSERT INTO seek_listings_seen (
      source,
      external_id,
      title,
      url,
      platform,
      matched_keywords
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (source, external_id) DO NOTHING
    RETURNING external_id
    `,
    [
      source,
      externalId,
      title || null,
      url,
      platform || null,
      Array.isArray(matchedKeywords) ? matchedKeywords : []
    ]
  );

  return rows.length > 0;
}
