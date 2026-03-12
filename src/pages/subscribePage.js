export function renderSubscribePage({ baseUrl } = {}) {
  const apiBase = baseUrl || "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Subscribe</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        font: 16px/1.4 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        background: radial-gradient(1200px 700px at 10% 10%, #f1f5ff 0%, #ffffff 55%, #f8fafc 100%);
        color: #0f172a;
      }
      .wrap { max-width: 720px; margin: 0 auto; padding: 48px 20px; }
      .card {
        background: rgba(255,255,255,0.8);
        border: 1px solid rgba(15, 23, 42, 0.12);
        border-radius: 16px;
        padding: 22px;
        box-shadow: 0 14px 40px rgba(2, 6, 23, 0.08);
        backdrop-filter: blur(8px);
      }
      h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: -0.02em; }
      p { margin: 0 0 14px; color: rgba(15, 23, 42, 0.8); }
      label { display: block; margin: 14px 0 6px; font-weight: 600; }
      input {
        width: 100%;
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid rgba(15, 23, 42, 0.18);
        outline: none;
        font-size: 16px;
      }
      input:focus { border-color: rgba(37, 99, 235, 0.55); box-shadow: 0 0 0 4px rgba(37,99,235,0.12); }
      .row { display: flex; gap: 10px; align-items: center; margin-top: 14px; flex-wrap: wrap; }
      button {
        appearance: none;
        border: 0;
        border-radius: 12px;
        padding: 12px 16px;
        background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
        color: white;
        font-weight: 700;
        cursor: pointer;
      }
      button[disabled] { opacity: 0.6; cursor: not-allowed; }
      .hint {
        font-size: 13px;
        color: rgba(15, 23, 42, 0.75);
      }
      .err {
        margin-top: 12px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(220, 38, 38, 0.35);
        background: rgba(254, 226, 226, 0.6);
        color: #7f1d1d;
        display: none;
      }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>Premium Subscription</h1>
        <p>Enter your Discord user ID so we can assign your Premium role after payment.</p>
        <label for="discord_id">Discord ID</label>
        <input id="discord_id" inputmode="numeric" autocomplete="off" placeholder="e.g. 475045567245058088" />
        <div class="row">
          <button id="subscribe">Continue to Checkout</button>
          <span class="hint">Tip: Discord Settings → Advanced → Developer Mode → right click your name → Copy ID</span>
        </div>
        <div id="err" class="err"></div>
        <p class="hint" style="margin-top:14px">This page calls <code>POST /checkout-session</code> then redirects you to Stripe Checkout.</p>
      </div>
    </div>
    <script type="module">
      const input = document.getElementById("discord_id");
      const button = document.getElementById("subscribe");
      const err = document.getElementById("err");

      const qs = new URLSearchParams(window.location.search);
      const prefill = qs.get("discord_id");
      if (prefill) input.value = prefill;

      const isValidDiscordId = (v) => /^\\d{17,20}$/.test(String(v || "").trim());

      async function createCheckout(discordId) {
        const res = await fetch(${JSON.stringify(`${apiBase}/checkout-session`)}, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ discord_id: discordId })
        });
        if (!res.ok) throw new Error("Failed to create checkout session");
        return await res.json();
      }

      button.addEventListener("click", async () => {
        err.style.display = "none";
        const discordId = input.value.trim();
        if (!isValidDiscordId(discordId)) {
          err.textContent = "Please enter a valid Discord ID (17-20 digits).";
          err.style.display = "block";
          return;
        }
        button.disabled = true;
        try {
          const { url } = await createCheckout(discordId);
          if (!url) throw new Error("Missing checkout URL");
          window.location.assign(url);
        } catch (e) {
          err.textContent = String(e && e.message ? e.message : e);
          err.style.display = "block";
        } finally {
          button.disabled = false;
        }
      });
    </script>
  </body>
</html>`;
}

