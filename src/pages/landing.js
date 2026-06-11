import { escapeHtml } from "./utils.js";
import { baseStyles } from "./styles.js";

export function renderLandingPage(cfg) {
  const safeSupport = cfg?.SUPPORT_TEXT ? escapeHtml(cfg.SUPPORT_TEXT) : null;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Unlock Premium</title>

  <style>
    ${baseStyles()}

    body {
      margin: 0;
      background:
        radial-gradient(1200px 700px at 18% 10%, rgba(239, 134, 0, 0.16), rgba(255, 247, 239, 0) 60%),
        radial-gradient(1000px 650px at 85% 12%, rgba(243, 170, 76, 0.18), rgba(255, 247, 239, 0) 55%),
        linear-gradient(180deg, #fff7ef 0%, #ffffff 100%);
      color: #0d0803;
      font-family: "Instrument Sans", system-ui, -apple-system, sans-serif;
    }

    .shell {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .card {
      max-width: 460px;
      width: 100%;
      padding: 40px 32px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(13, 8, 3, 0.12);
      box-shadow: 0 20px 60px rgba(13, 8, 3, 0.12);
      text-align: center;
    }

    .badge {
      display: inline-block;
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 999px;
      background: linear-gradient(125deg, rgba(239, 134, 0, 0.18), rgba(243, 170, 76, 0.18));
      color: #c96300;
      margin-bottom: 16px;
      border: 1px solid rgba(239, 134, 0, 0.35);
    }

    h1 {
      font-size: 30px;
      margin: 0 0 12px;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: #0d0803;
    }

    p {
      margin: 0 0 24px;
      color: rgba(13, 8, 3, 0.7);
      line-height: 1.6;
      font-size: 15px;
    }

    .features {
      text-align: left;
      margin-bottom: 28px;
    }

    .features div {
      margin-bottom: 10px;
      font-size: 14px;
      color: rgba(13, 8, 3, 0.8);
    }

    .features span {
      color: #ef8600;
      margin-right: 8px;
    }

    .btn {
      display: inline-block;
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      font-weight: 500;
      font-size: 15px;
      text-decoration: none;
      transition: all 0.2s ease;
    }

    .btn.primary {
      background: #ef8600;
      color: white;
      box-shadow: 0 10px 25px rgba(239, 134, 0, 0.35);
    }

    .btn.primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 30px rgba(239, 134, 0, 0.45);
    }

    .meta {
      margin-top: 18px;
      font-size: 13px;
      color: rgba(13, 8, 3, 0.55);
    }

  </style>
</head>

<body>
  <div class="shell">
    <div class="card">

      <div class="badge">Premium Access</div>

      <h1>Join the Inner Circle</h1>

      <p>
        Get exclusive roles, private channels, and premium perks inside our Discord community.
      </p>

      <div class="features">
        <div><span>✔</span> Exclusive Discord channels</div>
        <div><span>✔</span> Priority support</div>
        <div><span>✔</span> Members-only drops & updates</div>
      </div>

      <a class="btn primary" href="/auth/discord">
        Continue with Discord →
      </a>

      ${safeSupport
      ? `<p class="meta">Need help? ${safeSupport}</p>`
      : `<p class="meta">After subscribing, you will automatically join our Discord server with Premium access.</p>`
    }

    </div>
  </div>
</body>
</html>`;
}
