import { startLinkedInFifoWatcher } from "./linkedin/watcher.js";
import { startSeekFifoWatcher } from "./seek/watcher.js";

export { startLinkedInFifoWatcher, startSeekFifoWatcher };
export { logScrapedJobs } from "./helpers/watcher.js";

export async function startConfiguredJobWatchers({ bot }) {
  return Promise.all([
    startSeekFifoWatcher({ bot }),
    startLinkedInFifoWatcher({ bot })
  ]);
}
