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
    :root { color-scheme: light; }
    body {
      margin: 0;
      font: 16px/1.45 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      color: #0b1220;
      background:
        radial-gradient(1200px 800px at 20% 10%, rgba(34, 211, 238, 0.22) 0%, rgba(255,255,255,0) 55%),
        radial-gradient(1000px 650px at 85% 20%, rgba(99, 102, 241, 0.18) 0%, rgba(255,255,255,0) 55%),
        radial-gradient(1200px 900px at 40% 95%, rgba(16, 185, 129, 0.12) 0%, rgba(255,255,255,0) 60%),
        linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 28px 16px;
      overflow-x: hidden;
    }
    .shell { width: 100%; max-width: 760px; position: relative; }
    .card {
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 20px;
      box-shadow: 0 22px 65px rgba(2, 6, 23, 0.12);
      backdrop-filter: blur(10px);
      padding: 26px 22px;
      transform: translateY(10px);
      opacity: 0;
      animation: card-in 550ms cubic-bezier(.2,.9,.2,1) forwards;
    }
    @keyframes card-in { to { transform: translateY(0); opacity: 1; } }
    h1 {
      margin: 12px 0 6px;
      font-size: 26px;
      letter-spacing: -0.02em;
    }
    p { margin: 0; color: rgba(2, 6, 23, 0.72); }
    .row { margin-top: 18px; display: flex; gap: 12px; flex-wrap: wrap; }
    a.btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 11px 14px;
      border-radius: 14px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      text-decoration: none;
      font-weight: 700;
      color: #0b1220;
      background: rgba(255, 255, 255, 0.8);
      transition: transform 120ms ease, box-shadow 120ms ease;
    }
    a.btn:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(2,6,23,0.10); }
    a.btn.primary {
      border: 0;
      color: white;
      background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
    }
    .meta {
      margin-top: 14px;
      font-size: 13px;
      color: rgba(2, 6, 23, 0.6);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 999px;
      border: 1px solid rgba(15,23,42,0.10);
      background: rgba(255,255,255,0.75);
      width: fit-content;
    }
    .icon-wrap {
      width: 64px;
      height: 64px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: rgba(255,255,255,0.9);
      border: 1px solid rgba(15,23,42,0.10);
      box-shadow: 0 14px 30px rgba(2,6,23,0.10);
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
        radial-gradient(circle at 15% 20%, rgba(56,189,248,0.35) 0 2px, transparent 3px),
        radial-gradient(circle at 75% 28%, rgba(99,102,241,0.30) 0 2px, transparent 3px),
        radial-gradient(circle at 35% 70%, rgba(34,197,94,0.22) 0 2px, transparent 3px),
        radial-gradient(circle at 60% 78%, rgba(251,146,60,0.22) 0 2px, transparent 3px);
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
        <circle class="stroke draw-circle" cx="36" cy="36" r="28" stroke="#22c55e"></circle>
        <path class="stroke draw-mark" d="M22 37.5 L32.5 48 L52 28.5" stroke="#16a34a"></path>
      </svg>
    `;
  }
  if (variant === "fail") {
    return `
      <svg width="44" height="44" viewBox="0 0 72 72" aria-hidden="true">
        <circle class="stroke draw-circle" cx="36" cy="36" r="28" stroke="#ef4444"></circle>
        <path class="stroke draw-mark" d="M26 26 L46 46" stroke="#dc2626"></path>
        <path class="stroke draw-mark" style="animation-delay: 820ms" d="M46 26 L26 46" stroke="#dc2626"></path>
      </svg>
    `;
  }
  // cancel / neutral
  return `
    <svg width="44" height="44" viewBox="0 0 72 72" aria-hidden="true">
      <circle class="stroke draw-circle" cx="36" cy="36" r="28" stroke="#64748b"></circle>
      <path class="stroke draw-mark" d="M26 36 H46" stroke="#475569"></path>
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
            <div style="font-weight:800; letter-spacing:-0.01em">${safeTitle}</div>
            <div style="font-size:13px; color:rgba(2,6,23,0.62)">${new Date().toISOString()}</div>
          </div>
        </div>
        <h1>${safeTitle}</h1>
        <p>${safeMessage}</p>
        ${
          safeSupport
            ? `<p class="meta">Need help? ${safeSupport}</p>`
            : `<p class="meta">Need help? Contact support in the Discord server.</p>`
        }
        <div class="row">${primary}${secondary}</div>
      </div>
    </div>
  </body>
</html>`;
}

