import { getJobsConfig, startFifoWatcher } from "../helpers/watcher.js";
import { syncJobsFromContentApi } from "../apiClient.js";

export async function startSeekFifoWatcher({ bot }) {
  const cfg = getJobsConfig();
  const fetchScan = cfg.CONTENT_API_BASE_URL
    ? ({ maxResults }) =>
        syncJobsFromContentApi({
          cfg,
          source: "seek",
          maxResults,
          minAgeHours: cfg.FIFO_JOBS_MIN_AGE_HOURS,
          maxAgeHours: cfg.FIFO_JOBS_MAX_AGE_HOURS
        })
    : undefined;

  return startFifoWatcher({
    platform: "seek",
    label: "SEEK_FIFO",
    channelLabel: "FIFO_JOBS_CHANNEL_ID",
    cronName: "seek-fifo",
    enabled: cfg.SEEK_FIFO_ENABLED,
    channelId: cfg.FIFO_JOBS_CHANNEL_ID,
    cronExpression: cfg.SEEK_FIFO_CRON,
    maxResults: cfg.SEEK_FIFO_MAX_RESULTS,
    fetchScan,
    sendJobsToChannel: ({ channelId, jobs }) => bot.sendSeekJobsToChannel({ channelId, jobs })
  });
}
