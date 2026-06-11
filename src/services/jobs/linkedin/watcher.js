import { getJobsConfig, startFifoWatcher } from "../helpers/watcher.js";
import { fetchLinkedInFifoJobs } from "./scraper.js";

const SOURCE = "linkedin:fifo";

export async function startLinkedInFifoWatcher({ bot }) {
  const cfg = getJobsConfig();

  return startFifoWatcher({
    bot,
    source: SOURCE,
    platform: "linkedin",
    label: "LINKEDIN_FIFO",
    cronName: "linkedin-fifo",
    enabled: cfg.LINKEDIN_FIFO_ENABLED,
    channelId: cfg.LINKEDIN_FIFO_CHANNEL_ID,
    searchUrl: cfg.LINKEDIN_FIFO_SEARCH_URL,
    cronExpression: cfg.LINKEDIN_FIFO_CRON,
    maxResults: cfg.LINKEDIN_FIFO_MAX_RESULTS,
    fetchJobs: fetchLinkedInFifoJobs,
    sendJobsToChannel: ({ bot: discordBot, channelId, jobs }) =>
      discordBot.sendLinkedInJobsToChannel({ channelId, jobs })
  });
}
