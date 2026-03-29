import crypto from "crypto";
import { isDbEnabled, query } from "./pool.js";

export { isDbEnabled };

function generateToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export async function createInviteToken({ discordId = null, maxUses = 1 }) {
  if (!isDbEnabled()) {
    throw new Error("database_not_configured");
  }
  const token = generateToken();

  await query(
    `
    INSERT INTO invite_tokens (
      token,
      discord_id,
      max_uses,
      uses,
      created_at
    )
    VALUES ($1, $2, $3, 0, NOW())
    `,
    [token, discordId, maxUses]
  );

  return token;
}

export async function getInviteToken({ token }) {
  if (!isDbEnabled()) {
    throw new Error("database_not_configured");
  }

  const { rows } = await query(
    `
    SELECT token, discord_id, max_uses, uses, created_at, used_at
    FROM invite_tokens
    WHERE token = $1
    LIMIT 1
    `,
    [token]
  );

  return rows[0] || null;
}

export async function consumeInviteToken({ token }) {
  if (!isDbEnabled()) {
    throw new Error("database_not_configured");
  }

  const { rows } = await query(
    `
    UPDATE invite_tokens
    SET
      uses = uses + 1,
      used_at = CASE WHEN uses + 1 >= max_uses THEN NOW() ELSE used_at END
    WHERE token = $1 AND uses < max_uses
    RETURNING token, discord_id, max_uses, uses, created_at, used_at
    `,
    [token]
  );

  return rows[0] || null;
}
