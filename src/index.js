import "dotenv/config";
import { createApp } from "./server.js";
import { createDiscordBot } from "./discord/bot.js";

const port = Number(process.env.PORT || 3000);

const bot = await createDiscordBot();
const app = createApp({ bot });

app.listen(port, () => {
  console.log(`[http] listening on :${port}`);
});

