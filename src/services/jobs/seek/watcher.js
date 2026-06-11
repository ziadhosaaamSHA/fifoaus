import { getJobsConfig, startFifoWatcher } from "../helpers/watcher.js";
import { fetchSeekFifoJobs } from "./scraper.js";

const SOURCE = "seek:fifo";

export async function startSeekFifoWatcher({ bot }) {
  const cfg = getJobsConfig();

  return startFifoWatcher({
    bot,
    source: SOURCE,
    platform: "seek",
    label: "SEEK_FIFO",
    cronName: "seek-fifo",
    enabled: cfg.SEEK_FIFO_ENABLED,
    channelId: cfg.SEEK_FIFO_CHANNEL_ID,
    searchUrl: cfg.SEEK_FIFO_SEARCH_URL,
    cronExpression: cfg.SEEK_FIFO_CRON,
    maxResults: cfg.SEEK_FIFO_MAX_RESULTS,
    fetchJobs: fetchSeekFifoJobs,
    sendJobsToChannel: ({ bot: discordBot, channelId, jobs }) =>
      discordBot.sendSeekJobsToChannel({ channelId, jobs })
  });
}
