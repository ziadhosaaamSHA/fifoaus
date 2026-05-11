import { isDbEnabled, query } from "./pool.js";

export { isDbEnabled };

export async function ensureSeekListingsTable() {
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
}

export async function countSeenSeekListings({ source }) {
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

export async function markSeekListingSeen({ source, externalId, title, url }) {
  if (!isDbEnabled()) {
    throw new Error("database_not_configured");
  }

  const { rows } = await query(
    `
    INSERT INTO seek_listings_seen (source, external_id, title, url)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (source, external_id) DO NOTHING
    RETURNING external_id
    `,
    [source, externalId, title || null, url]
  );

  return rows.length > 0;
}
