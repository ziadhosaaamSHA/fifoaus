import { getConfig } from "../../../config.js";
import {
  countSeenJobListings,
  ensureJobListingsTable,
  isDbEnabled,
  markJobListingSeen
} from "../../db/jobListings.js";
import { scheduleCronJob } from "./cron.js";

function createMemoryStore() {
  const seen = new Map();

  return {
    async getCount() {
      return seen.size;
    },
    async markSeen(job) {
      const key = job.externalId;
      if (seen.has(key)) return false;
      seen.set(key, {
        platform: job.platform,
        matchedKeywords: job.matchedKeywords
      });
      return true;
    }
  };
}

function createPersistentStore(source) {
  return {
    async getCount() {
      return countSeenJobListings({ source });
    },
    async markSeen(job) {
      return markJobListingSeen({
        source,
        externalId: job.externalId,
        title: job.title,
        url: job.url,
        platform: job.platform,
        matchedKeywords: job.matchedKeywords
      });
    }
  };
}

export function logScrapedJobs(jobs, context = "watcher") {
  const platform = jobs[0]?.platform || "jobs";
  const sourceName = platform === "linkedin" ? "LinkedIn" : platform === "seek" ? "SEEK" : "jobs";
  console.log(`[${platform}] scraped ${jobs.length} job(s) from ${sourceName}`);

  jobs.forEach((job, index) => {
    const details = [job.company, job.location, job.salary].filter(Boolean).join(" | ");
    const keywords = job.matchedKeywords?.length
      ? ` :: matched=${job.matchedKeywords.join(", ")}`
      : "";
    console.log(
      `[${job.platform || platform}] ${context} scraped[${index + 1}] ${job.platform || platform}:${job.externalId} :: ${job.title}${details ? ` :: ${details}` : ""}${keywords}`
    );
  });
}

export async function startFifoWatcher({
  bot,
  source,
  platform,
  label,
  cronName,
  enabled,
  channelId,
  searchUrl,
  cronExpression,
  maxResults,
  fetchJobs,
  sendJobsToChannel
}) {
  if (!enabled) {
    return null;
  }

  if (!channelId) {
    console.warn(`[${platform}] ${label}_ENABLED is true but ${label}_CHANNEL_ID is missing`);
    return null;
  }

  const store = isDbEnabled() ? createPersistentStore(source) : createMemoryStore();

  if (isDbEnabled()) {
    await ensureJobListingsTable();
  } else {
    console.warn(`[${platform}] DATABASE_URL not configured, using in-memory dedupe for ${label} listings`);
  }

  let suppressNotificationsOnFirstRun = (await store.getCount()) === 0;
  let lastRunAt = null;
  let lastSuccessAt = null;
  let lastError = null;
  let running = false;

  async function publishJobs(jobs) {
    await sendJobsToChannel({
      bot,
      channelId,
      jobs
    });
  }

  async function runScan({ reason, scheduledAt = new Date() }) {
    if (running) {
      console.warn(`[${platform}] skipping scan because a previous run is still active`);
      return;
    }

    running = true;
    lastRunAt = scheduledAt;

    try {
      const jobs = await fetchJobs({
        searchUrl,
        maxResults
      });
      logScrapedJobs(jobs);

      const newJobs = [];
      for (const job of jobs) {
        const inserted = await store.markSeen(job);
        console.log(
          `[${platform}] ${inserted ? "new" : "seen"} :: ${job.externalId} :: ${job.title}`
        );
        if (inserted) {
          newJobs.push(job);
        }
      }

      if (suppressNotificationsOnFirstRun) {
        console.log(
          `[${platform}] initial sync completed (${newJobs.length} jobs seeded, no Discord post)`
        );
        suppressNotificationsOnFirstRun = false;
      } else if (newJobs.length > 0) {
        await publishJobs(newJobs);
        console.log(`[${platform}] posted ${newJobs.length} new FIFO jobs to Discord`);
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

  console.log(`[${platform}] watcher started: ${searchUrl} on cron "${cronExpression}"`);

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
