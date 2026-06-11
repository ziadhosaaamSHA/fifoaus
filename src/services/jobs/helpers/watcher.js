import { getConfig } from "../../../config.js";
import { scheduleCronJob } from "./cron.js";

export function logScrapedJobs(jobs, context = "watcher") {
  const platform = jobs[0]?.platform || "jobs";
  const sourceName = platform === "linkedin" ? "LinkedIn" : platform === "seek" ? "SEEK" : "jobs";
  console.log(`[${platform}] received ${jobs.length} job(s) from ${sourceName}`);

  jobs.forEach((job, index) => {
    const details = [job.company, job.location, job.salary].filter(Boolean).join(" | ");
    const keywords = job.matchedKeywords?.length
      ? ` :: matched=${job.matchedKeywords.join(", ")}`
      : "";
    console.log(
      `[${job.platform || platform}] ${context} job[${index + 1}] ${job.platform || platform}:${job.externalId} :: ${job.title}${details ? ` :: ${details}` : ""}${keywords}`
    );
  });
}

export async function startFifoWatcher({
  platform,
  label,
  channelLabel = `${label}_CHANNEL_ID`,
  cronName,
  enabled,
  channelId,
  cronExpression,
  maxResults,
  fetchScan,
  sendJobsToChannel
}) {
  if (!enabled) {
    return null;
  }

  if (!channelId) {
    console.warn(`[${platform}] ${label}_ENABLED is true but ${channelLabel} is missing`);
    return null;
  }

  if (typeof fetchScan !== "function") {
    console.warn(`[${platform}] ${label}_ENABLED is true but CONTENT_API_BASE_URL is missing`);
    return null;
  }

  let lastRunAt = null;
  let lastSuccessAt = null;
  let lastError = null;
  let running = false;

  async function runScan({ reason, scheduledAt = new Date() }) {
    if (running) {
      console.warn(`[${platform}] skipping scan because a previous run is still active`);
      return;
    }

    running = true;
    lastRunAt = scheduledAt;

    try {
      const scan = await fetchScan({ maxResults });
      const jobs = scan.jobs || [];
      logScrapedJobs(jobs);

      if (scan.initialSync) {
        console.log(
          `[${platform}] initial API sync completed (${jobs.length} jobs seeded, no Discord post)`
        );
      } else if (jobs.length > 0) {
        await sendJobsToChannel({ channelId, jobs });
        console.log(`[${platform}] posted ${jobs.length} new FIFO jobs to Discord`);
      } else {
        console.log(`[${platform}] no new FIFO jobs found`);
      }

      lastSuccessAt = new Date();
      lastError = null;
    } catch (err) {
      lastError = err?.message || String(err);
      console.error(`[${platform}] scan failed (${reason})`, err);
    } finally {
      running = false;
    }
  }

  await runScan({ reason: "startup", scheduledAt: new Date() });

  const scheduler = scheduleCronJob({
    expression: cronExpression,
    name: cronName,
    task: ({ scheduledAt }) => runScan({ reason: "cron", scheduledAt })
  });

  console.log(`[${platform}] API-backed watcher started on cron "${cronExpression}"`);

  return {
    stop() {
      scheduler.stop();
    },
    getState() {
      return {
        enabled: true,
        running,
        lastRunAt,
        lastSuccessAt,
        lastError
      };
    }
  };
}

export function getJobsConfig() {
  return getConfig();
}
