import { escapeHtml } from "./utils.js";
import { baseStyles } from "./styles.js";
import { iconSvg } from "./icons.js";

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
