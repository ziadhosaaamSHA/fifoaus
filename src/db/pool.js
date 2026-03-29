import pg from "pg";

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;

if (DATABASE_URL) {
  const needsSsl =
    process.env.PGSSLMODE === "require" || DATABASE_URL.includes("sslmode=require");
  pool = new Pool({
    connectionString: DATABASE_URL,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {})
  });

  pool.on("error", (err) => {
    console.error("[db] pool error", err?.message || err);
  });
}

export function isDbEnabled() {
  return Boolean(pool);
}

export function getPool() {
  if (!pool) {
    throw new Error("DATABASE_URL not configured");
  }
  return pool;
}

export async function query(text, params) {
  const client = getPool();
  return client.query(text, params);
}
