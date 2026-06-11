#!/usr/bin/env node
import { fetchLinkedInFifoJobs } from "../src/services/jobs/index.js";

const DEFAULT_LINKEDIN_FIFO_SEARCH_URL =
  "https://www.linkedin.com/jobs/search?keywords=%28FIFO%2BOR%2BDIDO%2BOR%2BOil%2BOR%2BGas%2BOR%2BConstruction%2BFifo%2BOR%2BFifo%2BMining%29&location=Australia&geoId=101452733&f_TPR=r86400";

async function main() {
  const searchUrl = process.env.LINKEDIN_FIFO_SEARCH_URL || DEFAULT_LINKEDIN_FIFO_SEARCH_URL;
  const maxResults = Number(process.env.MAX_RESULTS) || 20;

  console.log(`Fetching up to ${maxResults} FIFO jobs from ${searchUrl} ...`);
  try {
    const jobs = await fetchLinkedInFifoJobs({
      searchUrl,
      maxResults
    });
    console.log(JSON.stringify(jobs, null, 2));
  } catch (err) {
    console.error("Error during LinkedIn scrape:", err);
    process.exit(1);
  }
}

main();
