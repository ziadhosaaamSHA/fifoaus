#!/usr/bin/env node
import "dotenv/config";
import { getConfig } from "../src/config.js";
import { fetchSeekFifoJobs } from "../src/jobs/seek.js";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      args.help = true;
      continue;
    }
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/scrape-seek-fifo.js [--limit <count>] [--url <seek-url>]

Options:
  --limit   Number of jobs to print (default: 5)
  --url     Override the SEEK search URL
`);
}

function parseLimit(value) {
  if (value === undefined) return 5;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 25) {
    throw new Error("limit must be an integer between 1 and 25");
  }
  return parsed;
}

function formatJob(job, index) {
  const lines = [
    `${index + 1}. ${job.title}`,
    `   Company: ${job.company || "n/a"}`,
    `   Location: ${job.location || "n/a"}`,
    `   Type: ${job.workType || "n/a"}`,
    `   Salary: ${job.salary || "n/a"}`,
    `   Listed: ${job.listedAt || "n/a"}`,
    `   URL: ${job.url}`
  ];

  if (job.summary) {
    lines.splice(6, 0, `   Summary: ${job.summary}`);
  }

  return lines.join("\n");
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
  process.exit(0);
}

const cfg = getConfig();
const limit = parseLimit(args.limit);
const searchUrl = args.url || cfg.SEEK_FIFO_SEARCH_URL || "https://au.seek.com/FIFO-jobs";

const jobs = await fetchSeekFifoJobs({
  searchUrl,
  maxResults: limit
});

if (jobs.length === 0) {
  console.log("No FIFO jobs found.");
  process.exit(0);
}

for (const [index, job] of jobs.entries()) {
  console.log(formatJob(job, index));
  if (index < jobs.length - 1) {
    console.log("");
  }
}
