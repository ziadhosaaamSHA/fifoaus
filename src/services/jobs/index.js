import { fetchLinkedInFifoJobs } from "./linkedin/scraper.js";
import { startLinkedInFifoWatcher } from "./linkedin/watcher.js";
import { fetchSeekFifoJobs } from "./seek/scraper.js";
import { startSeekFifoWatcher } from "./seek/watcher.js";

export { fetchLinkedInFifoJobs, startLinkedInFifoWatcher };
export { fetchSeekFifoJobs, startSeekFifoWatcher };
export { logScrapedJobs } from "./helpers/watcher.js";
export {
  FIFO_FILTER_KEYWORDS,
  findFifoKeywordMatches,
  jobMatchesFifoFilter
} from "./helpers/filters.js";

const SCRAPERS = {
  linkedin: {
    platform: "linkedin",
    fetchFifoJobs: fetchLinkedInFifoJobs,
    startWatcher: startLinkedInFifoWatcher
  },
  seek: {
    platform: "seek",
    fetchFifoJobs: fetchSeekFifoJobs,
    startWatcher: startSeekFifoWatcher
  }
};

export function getJobScrapers() {
  return SCRAPERS;
}

export async function fetchFifoJobsFromSources(sources) {
  const entries = Object.entries(sources);
  const results = await Promise.all(
    entries.map(async ([source, args]) => {
      const scraper = SCRAPERS[source];
      if (!scraper) {
        throw new Error(`unknown_job_source:${source}`);
      }
      return [source, await scraper.fetchFifoJobs(args)];
    })
  );

  return Object.fromEntries(results);
}

export async function startConfiguredJobWatchers({ bot }) {
  return Promise.all([
    SCRAPERS.seek.startWatcher({ bot }),
    SCRAPERS.linkedin.startWatcher({ bot })
  ]);
}
