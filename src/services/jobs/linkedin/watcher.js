import { getJobsConfig, startFifoWatcher } from "../helpers/watcher.js";
import { syncJobsFromContentApi } from "../apiClient.js";

export async function startLinkedInFifoWatcher({ bot }) {
  const cfg = getJobsConfig();
  const fetchScan = cfg.CONTENT_API_BASE_URL
    ? ({ maxResults }) =>
        syncJobsFromContentApi({
          cfg,
          source: "linkedin",
          maxResults,
          minAgeHours: cfg.FIFO_JOBS_MIN_AGE_HOURS,
          maxAgeHours: cfg.FIFO_JOBS_MAX_AGE_HOURS
        })
    : undefined;

  return startFifoWatcher({
    platform: "linkedin",
    label: "LINKEDIN_FIFO",
    channelLabel: "FIFO_JOBS_CHANNEL_ID",
    cronName: "linkedin-fifo",
    enabled: cfg.LINKEDIN_FIFO_ENABLED,
    channelId: cfg.FIFO_JOBS_CHANNEL_ID,
    cronExpression: cfg.LINKEDIN_FIFO_CRON,
    maxResults: cfg.LINKEDIN_FIFO_MAX_RESULTS,
    fetchScan,
    sendJobsToChannel: ({ channelId, jobs }) => bot.sendLinkedInJobsToChannel({ channelId, jobs })
  });
}
