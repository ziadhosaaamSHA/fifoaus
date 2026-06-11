import "dotenv/config";
import { createApp } from "./server.js";
import { createDiscordBot } from "./services/discord/bot.js";
import { startConfiguredJobWatchers } from "./services/jobs/index.js";
import { startNewsWatcher } from "./services/news/index.js";

const port = Number(process.env.PORT || 3000);

const bot = await createDiscordBot();
await startConfiguredJobWatchers({ bot });
await startNewsWatcher({ bot });
const app = createApp({ bot });

app.listen(port, () => {
  console.log(`[http] listening on :${port}`);
});
