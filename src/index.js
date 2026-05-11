import "dotenv/config";
import { createApp } from "./server.js";
import { createDiscordBot } from "./discord/bot.js";
import { startSeekFifoWatcher } from "./jobs/seekFifoWatcher.js";

const port = Number(process.env.PORT || 3000);

const bot = await createDiscordBot();
await startSeekFifoWatcher({ bot });
const app = createApp({ bot });

app.listen(port, () => {
  console.log(`[http] listening on :${port}`);
});
