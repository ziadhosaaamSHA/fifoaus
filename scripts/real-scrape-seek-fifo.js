#!/usr/bin/env node
import { fetchSeekFifoJobs } from "../src/services/jobs/index.js";

async function main() {
  const searchUrl = process.env.SEEK_FIFO_SEARCH_URL || "https://au.seek.com/FIFO-jobs";
  const maxResults = Number(process.env.MAX_RESULTS) || 20;

  console.log(`Fetching up to ${maxResults} FIFO jobs from ${searchUrl} ...`);
  try {
    const jobs = await fetchSeekFifoJobs({
      searchUrl,
      maxResults,
      // default fetch implementation
    });
    console.log(JSON.stringify(jobs, null, 2));
  } catch (err) {
    console.error("Error during SEEK scrape:", err);
    process.exit(1);
  }
}

main();
