export function baseStyles() {
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
    .row { margin-top: 18px; display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
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
    a.btn.primary:hover { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(2,6,23,0.10); }
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
