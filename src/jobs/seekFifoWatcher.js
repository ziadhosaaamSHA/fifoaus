import { getConfig } from "../config.js";
import {
  countSeenSeekListings,
  ensureSeekListingsTable,
  isDbEnabled,
  markSeekListingSeen
} from "../db/seekListings.js";
import { scheduleCronJob } from "./cron.js";
import { fetchSeekFifoJobs } from "./seek.js";

const SOURCE = "seek:fifo";

function createMemoryStore() {
  const seenIds = new Set();

  return {
    async getCount() {
      return seenIds.size;
    },
    async markSeen(job) {
      const key = job.externalId;
      if (seenIds.has(key)) return false;
      seenIds.add(key);
      return true;
    }
  };
}

function createPersistentStore() {
  return {
    async getCount() {
      return countSeenSeekListings({ source: SOURCE });
    },
    async markSeen(job) {
      return markSeekListingSeen({
        source: SOURCE,
        externalId: job.externalId,
        title: job.title,
        url: job.url
      });
    }
  };
}

export function logScrapedJobs(jobs, context = "watcher") {
  console.log(`[seek] scraped ${jobs.length} job(s) from SEEK`);

  jobs.forEach((job, index) => {
    const details = [job.company, job.location, job.salary].filter(Boolean).join(" | ");
    console.log(
      `[seek] ${context} scraped[${index + 1}] ${job.externalId} :: ${job.title}${details ? ` :: ${details}` : ""}`
    );
  });
}

export async function startSeekFifoWatcher({ bot }) {
  const cfg = getConfig();
  if (!cfg.SEEK_FIFO_ENABLED) {
    return null;
  }

  if (!cfg.SEEK_FIFO_CHANNEL_ID) {
    console.warn("[seek] SEEK_FIFO_ENABLED is true but SEEK_FIFO_CHANNEL_ID is missing");
    return null;
  }

  const store = isDbEnabled() ? createPersistentStore() : createMemoryStore();

  if (isDbEnabled()) {
    await ensureSeekListingsTable();
  } else {
    console.warn("[seek] DATABASE_URL not configured, using in-memory dedupe for SEEK listings");
  }

  let suppressNotificationsOnFirstRun = (await store.getCount()) === 0;
  let lastRunAt = null;
  let lastSuccessAt = null;
  let lastError = null;
  let running = false;

  async function publishJobs(jobs) {
    await bot.sendSeekJobsToChannel({
      channelId: cfg.SEEK_FIFO_CHANNEL_ID,
      jobs
    });
  }

  async function runScan({ reason, scheduledAt = new Date() }) {
    if (running) {
      console.warn("[seek] skipping scan because a previous run is still active");
      return;
    }

    running = true;
    lastRunAt = scheduledAt;

    try {
      const jobs = await fetchSeekFifoJobs({
        searchUrl: cfg.SEEK_FIFO_SEARCH_URL,
        maxResults: cfg.SEEK_FIFO_MAX_RESULTS
      });
      logScrapedJobs(jobs);

      const newJobs = [];
      for (const job of jobs) {
        const inserted = await store.markSeen(job);
        console.log(
          `[seek] ${inserted ? "new" : "seen"} :: ${job.externalId} :: ${job.title}`
        );
        if (inserted) {
          newJobs.push(job);
        }
      }

      if (suppressNotificationsOnFirstRun) {
        console.log(`[seek] initial sync completed (${newJobs.length} jobs seeded, no Discord post)`);
        suppressNotificationsOnFirstRun = false;
      } else if (newJobs.length > 0) {
        await publishJobs(newJobs);
        console.log(`[seek] posted ${newJobs.length} new FIFO jobs to Discord`);
      } else {
        console.log("[seek] no new FIFO jobs found");
      }

      lastSuccessAt = new Date();
      lastError = null;
    } catch (err) {
      lastError = err?.message || String(err);
      console.error(`[seek] scan failed (${reason})`, err);
    } finally {
      running = false;
    }
  }

  await runScan({ reason: "startup", scheduledAt: new Date() });

  const scheduler = scheduleCronJob({
    expression: cfg.SEEK_FIFO_CRON,
    name: "seek-fifo",
    task: ({ scheduledAt }) => runScan({ reason: "cron", scheduledAt })
  });

  console.log(
    `[seek] watcher started: ${cfg.SEEK_FIFO_SEARCH_URL} on cron "${cfg.SEEK_FIFO_CRON}"`
  );

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
