function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function baseStyles() {
  return `
    @import url("https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@300;400;500;600;700;800&display=swap");

    :root {
      color-scheme: light;
      --fifo-orange: #ef8600;
      --fifo-orange-light: #f3aa4c;
      --fifo-ink: #0d0803;
      --fifo-ink-muted: rgba(13, 8, 3, 0.68);
      --fifo-cream: #fff7ef;
      --fifo-card: #ffffff;
      --fifo-border: rgba(13, 8, 3, 0.12);
      --fifo-shadow: 0 24px 70px rgba(13, 8, 3, 0.12);
    }
    body {
      margin: 0;
      font: 16px/1.55 "Instrument Sans", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      color: var(--fifo-ink);
      background:
        radial-gradient(900px 600px at 15% 10%, rgba(239, 134, 0, 0.16) 0%, rgba(255, 247, 239, 0) 55%),
        radial-gradient(900px 600px at 85% 12%, rgba(243, 170, 76, 0.18) 0%, rgba(255, 247, 239, 0) 55%),
        linear-gradient(180deg, var(--fifo-cream) 0%, #ffffff 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 28px 16px;
      overflow-x: hidden;
    }
    .shell { width: 100%; max-width: 760px; position: relative; }
    .card {
      background: var(--fifo-card);
      border: 1px solid var(--fifo-border);
      border-radius: 18px;
      box-shadow: var(--fifo-shadow);
      padding: 28px 24px;
      transform: translateY(10px);
      opacity: 0;
      animation: card-in 550ms cubic-bezier(.2,.9,.2,1) forwards;
    }
    @keyframes card-in { to { transform: translateY(0); opacity: 1; } }
    h1 {
      margin: 12px 0 8px;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.03em;
    }
    p { margin: 0; color: var(--fifo-ink-muted); }
    .row { margin-top: 18px; display: flex; gap: 12px; flex-wrap: wrap; }
    a.btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 24px;
      border-radius: 10px;
      border: 1px solid var(--fifo-border);
      text-decoration: none;
      font-weight: 600;
      color: var(--fifo-ink);
      background: #ffffff;
      transition: transform 120ms ease, box-shadow 120ms ease;
    }
    a.btn:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(2,6,23,0.10); }
    a.btn.primary {
      border: 0;
      color: white;
      background: var(--fifo-orange);
      box-shadow: 0 12px 25px rgba(239, 134, 0, 0.35);
    }
    .meta {
      margin-top: 14px;
      font-size: 13px;
      color: rgba(13, 8, 3, 0.6);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 999px;
      border: 1px solid rgba(239, 134, 0, 0.24);
      background: linear-gradient(125deg, rgba(239, 134, 0, 0.16), rgba(243, 170, 76, 0.16));
      width: fit-content;
    }
    .icon-wrap {
      width: 64px;
      height: 64px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: #fff6ea;
      border: 1px solid rgba(239, 134, 0, 0.2);
      box-shadow: 0 14px 30px rgba(239, 134, 0, 0.15);
      transform: scale(0.7);
      opacity: 0;
      animation: pop-in 520ms cubic-bezier(.34,1.56,.64,1.3) 120ms forwards;
    }
    @keyframes pop-in { to { transform: scale(1); opacity: 1; } }
    svg { display: block; }
    .stroke {
      fill: none;
      stroke-width: 8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .draw-circle {
      stroke-dasharray: 260;
      stroke-dashoffset: 260;
      animation: draw 700ms ease-out 160ms forwards;
    }
    .draw-mark {
      stroke-dasharray: 80;
      stroke-dashoffset: 80;
      animation: draw 520ms ease-out 680ms forwards;
    }
    @keyframes draw { to { stroke-dashoffset: 0; } }

    /* confetti shimmer (subtle, no external JS) */
    .sparkles::before, .sparkles::after {
      content: "";
      position: absolute;
      inset: -120px -80px;
      background:
        radial-gradient(circle at 15% 20%, rgba(239,134,0,0.35) 0 2px, transparent 3px),
        radial-gradient(circle at 75% 28%, rgba(243,170,76,0.30) 0 2px, transparent 3px),
        radial-gradient(circle at 35% 70%, rgba(20,12,1,0.18) 0 2px, transparent 3px),
        radial-gradient(circle at 60% 78%, rgba(239,134,0,0.22) 0 2px, transparent 3px);
      opacity: 0;
      transform: translateY(12px);
      animation: shimmer 1200ms ease 250ms forwards;
      pointer-events: none;
      filter: blur(0.2px);
    }
    .sparkles::after {
      animation-delay: 450ms;
      opacity: 0;
      transform: translateY(18px) scale(1.02);
    }
    @keyframes shimmer {
      0% { opacity: 0; transform: translateY(18px); }
      40% { opacity: 1; }
      100% { opacity: 0.45; transform: translateY(0); }
    }
  `;
}

function iconSvg({ variant }) {
  if (variant === "success") {
    return `
      <svg width="44" height="44" viewBox="0 0 72 72" aria-hidden="true">
        <circle class="stroke draw-circle" cx="36" cy="36" r="28" stroke="#ef8600"></circle>
        <path class="stroke draw-mark" d="M22 37.5 L32.5 48 L52 28.5" stroke="#b65a00"></path>
      </svg>
    `;
  }
  if (variant === "fail") {
    return `
      <svg width="44" height="44" viewBox="0 0 72 72" aria-hidden="true">
        <circle class="stroke draw-circle" cx="36" cy="36" r="28" stroke="#e5484d"></circle>
        <path class="stroke draw-mark" d="M26 26 L46 46" stroke="#c7362f"></path>
        <path class="stroke draw-mark" style="animation-delay: 820ms" d="M46 26 L26 46" stroke="#c7362f"></path>
      </svg>
    `;
  }
  // cancel / neutral
  return `
    <svg width="44" height="44" viewBox="0 0 72 72" aria-hidden="true">
      <circle class="stroke draw-circle" cx="36" cy="36" r="28" stroke="#6f675d"></circle>
      <path class="stroke draw-mark" d="M26 36 H46" stroke="#4c4339"></path>
    </svg>
  `;
}

export function renderResultPage({
  variant,
  title,
  message,
  supportText,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel
}) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeSupport = supportText ? escapeHtml(supportText) : null;

  const primary = primaryHref
    ? `<a class="btn primary" href="${escapeHtml(primaryHref)}">${escapeHtml(primaryLabel || "Continue")}</a>`
    : "";
  const secondary = secondaryHref
    ? `<a class="btn" href="${escapeHtml(secondaryHref)}">${escapeHtml(secondaryLabel || "Back")}</a>`
    : "";
  const row = primary || secondary ? `<div class="row">${primary}${secondary}</div>` : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>${baseStyles()}</style>
  </head>
  <body>
    <div class="shell sparkles">
      <div class="card">
        <div class="badge">
          <div class="icon-wrap">${iconSvg({ variant })}</div>
          <div>
            <div style="font-weight:800; letter-spacing:-0.02em">${safeTitle}</div>
          </div>
        </div>
        <h1>${safeTitle}</h1>
        <p>${safeMessage}</p>
        ${safeSupport
      ? `<p class="meta">Need help? ${safeSupport}</p>`
      : `<p class="meta">Need help? Contact support in the Discord server.</p>`
    }
        ${row}
      </div>
    </div>
  </body>
</html>`;
}

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
        radial-gradient(1200px 600px at 20% 10%, rgba(239, 134, 0, 0.18), rgba(20, 12, 1, 0) 60%),
        radial-gradient(1000px 600px at 85% 5%, rgba(243, 170, 76, 0.12), rgba(20, 12, 1, 0) 55%),
        linear-gradient(180deg, #140c01 0%, #0d0803 100%);
      color: #fff6ea;
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
      background: rgba(17, 10, 2, 0.7);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 246, 234, 0.1);
      box-shadow: 0 20px 60px rgba(0,0,0,0.6);
      text-align: center;
    }

    .badge {
      display: inline-block;
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 999px;
      background: linear-gradient(125deg, rgba(239, 134, 0, 0.2), rgba(243, 170, 76, 0.2));
      color: #ffe0b5;
      margin-bottom: 16px;
      border: 1px solid rgba(239, 134, 0, 0.35);
    }

    h1 {
      font-size: 30px;
      margin: 0 0 12px;
      font-weight: 700;
      letter-spacing: -0.03em;
    }

    p {
      margin: 0 0 24px;
      color: rgba(255, 246, 234, 0.7);
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
      color: rgba(255, 246, 234, 0.85);
    }

    .features span {
      color: #f3aa4c;
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
      color: rgba(255, 246, 234, 0.55);
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
