export function iconSvg({ variant }) {
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
