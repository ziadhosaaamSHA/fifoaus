import { getConfig } from "../../config.js";
import { syncNewsFromContentApi } from "../jobs/apiClient.js";
import { scheduleCronJob } from "../jobs/helpers/cron.js";

export function logNewsItems(items, context = "watcher") {
  console.log(`[news] received ${items.length} news item(s)`);

  items.forEach((item, index) => {
    const keywords = item.matchedKeywords?.length
      ? ` :: matched=${item.matchedKeywords.join(", ")}`
      : "";
    console.log(
      `[news] ${context} item[${index + 1}] ${item.source}:${item.externalId} :: ${item.title}${keywords}`
    );
  });
}

function sortNewsItemsNewestFirst(items) {
  return [...items].sort((a, b) => {
    const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return bTime - aTime;
  });
}

async function syncConfiguredNewsSources({ cfg }) {
  const results = [];

  for (const source of cfg.NEWS_SOURCES) {
    const scan = await syncNewsFromContentApi({
      cfg,
      source,
      maxResults: cfg.NEWS_MAX_RESULTS
    });

    results.push(...(scan.items || []));
  }

  return sortNewsItemsNewestFirst(results);
}

export async function startNewsWatcher({ bot }) {
  const cfg = getConfig();

  if (!cfg.NEWS_ENABLED) {
    console.log("[news] watcher disabled; set NEWS_ENABLED=true to enable");
    return null;
  }

  console.log(
    `[news] watcher enabled for sources "${cfg.NEWS_SOURCES.join(",")}" on cron "${cfg.NEWS_CRON}"`
  );

  if (!cfg.NEWS_CHANNEL_ID) {
    console.warn("[news] NEWS_ENABLED is true but NEWS_CHANNEL_ID is missing");
    return null;
  }

  if (!cfg.CONTENT_API_BASE_URL) {
    console.warn("[news] NEWS_ENABLED is true but CONTENT_API_BASE_URL is missing");
    return null;
  }

  let lastRunAt = null;
  let lastSuccessAt = null;
  let lastError = null;
  let running = false;

  async function runScan({ reason, scheduledAt = new Date() }) {
    if (running) {
      console.warn("[news] skipping scan because a previous run is still active");
      return;
    }

    running = true;
    lastRunAt = scheduledAt;

    try {
      const items = await syncConfiguredNewsSources({ cfg });
      logNewsItems(items);

      if (items.length > 0) {
        await bot.sendNewsToChannel({
          channelId: cfg.NEWS_CHANNEL_ID,
          items
        });
        console.log(`[news] posted ${items.length} new item(s) to Discord`);
      } else {
        console.log("[news] no new items found");
      }

      lastSuccessAt = new Date();
      lastError = null;
    } catch (err) {
      lastError = err?.message || String(err);
      console.error(`[news] scan failed (${reason})`, err);
    } finally {
      running = false;
    }
  }

  await runScan({ reason: "startup", scheduledAt: new Date() });

  const scheduler = scheduleCronJob({
    expression: cfg.NEWS_CRON,
    name: "news",
    task: ({ scheduledAt }) => runScan({ reason: "cron", scheduledAt })
  });

  console.log(`[news] API-backed watcher started on cron "${cfg.NEWS_CRON}"`);

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
