const SEEK_BASE_URL = "https://au.seek.com";

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "\n");
}

function htmlToLines(html) {
  return decodeHtmlEntities(stripTags(html))
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function extractJobLinks(html) {
  const jobLinks = [];
  const seen = new Set();
  const regex = /href="([^"]*\/job\/\d+[^"]*)"/g;

  for (const match of html.matchAll(regex)) {
    const rawUrl = decodeHtmlEntities(match[1]);
    const absoluteUrl = new URL(rawUrl, SEEK_BASE_URL).toString();

    if (!absoluteUrl.includes("/job/")) continue;
    if (seen.has(absoluteUrl)) continue;

    seen.add(absoluteUrl);
    jobLinks.push({
      url: absoluteUrl,
      externalId: absoluteUrl.match(/\/job\/(\d+)/)?.[1] || absoluteUrl
    });
  }

  return jobLinks;
}

function isNoiseLine(line) {
  return (
    line === "Featured" ||
    line === "New" ||
    line === "New to you" ||
    line === "Done" ||
    line === "Modify my search" ||
    line === "Select a job" ||
    line === "Display details here" ||
    line === "Image"
  );
}

function isJobBoundary(line) {
  return line === "###";
}

function isRelativeTime(line) {
  return /(?:\d+\s*(?:m|h|d)|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:minute|minutes|hour|hours|day|days)\s+ago$/i.test(
    line
  );
}

function extractJobsFromLines(lines) {
  const jobs = [];
  const startIndex = lines.findIndex((line) => /^\d[\d,]* jobs$/i.test(line));
  const scanFrom = startIndex >= 0 ? startIndex + 1 : 0;

  for (let index = scanFrom; index < lines.length; index += 1) {
    if (!isJobBoundary(lines[index])) continue;

    let cursor = index + 1;
    while (cursor < lines.length && isNoiseLine(lines[cursor])) {
      cursor += 1;
    }

    const title = lines[cursor];
    if (!title || isJobBoundary(title)) continue;

    cursor += 1;

    let company = "";
    if (lines[cursor] === "at") {
      company = lines[cursor + 1] || "";
      cursor += 2;
    } else if (lines[cursor]?.startsWith("at ")) {
      company = lines[cursor].slice(3).trim();
      cursor += 1;
    }

    while (cursor < lines.length && !/^This is a /i.test(lines[cursor]) && !isJobBoundary(lines[cursor])) {
      cursor += 1;
    }
    if (cursor >= lines.length || isJobBoundary(lines[cursor])) continue;

    const workType = lines[cursor];
    const location = lines[cursor + 1] || "";
    cursor += 2;

    let salary = "";
    if (
      lines[cursor] &&
      !lines[cursor].startsWith("*") &&
      !lines[cursor].startsWith("subClassification:") &&
      !lines[cursor].startsWith("classification:") &&
      !isRelativeTime(lines[cursor]) &&
      !lines[cursor].startsWith("Listed ")
    ) {
      salary = lines[cursor];
      cursor += 1;
    }

    const highlights = [];
    while (cursor < lines.length && lines[cursor].startsWith("*")) {
      highlights.push(lines[cursor].replace(/^\*\s*/, ""));
      cursor += 1;
    }

    let summary = "";
    while (cursor < lines.length && !isJobBoundary(lines[cursor])) {
      const currentLine = lines[cursor];
      if (
        currentLine.startsWith("subClassification:") ||
        currentLine.startsWith("classification:") ||
        isRelativeTime(currentLine) ||
        currentLine.startsWith("Listed ")
      ) {
        break;
      }
      if (!summary && !isNoiseLine(currentLine)) {
        summary = currentLine;
      }
      cursor += 1;
    }

    let listedAt = "";
    while (cursor < lines.length && !isJobBoundary(lines[cursor])) {
      if (lines[cursor].startsWith("Listed ")) {
        listedAt = lines[cursor];
        break;
      }
      if (!listedAt && isRelativeTime(lines[cursor])) {
        listedAt = lines[cursor];
      }
      cursor += 1;
    }

    jobs.push({
      title,
      company,
      location,
      workType,
      salary,
      highlights,
      summary,
      listedAt
    });
  }

  return jobs;
}

function mergeJobs(textJobs, linkJobs) {
  const merged = [];
  const seenIds = new Set();

  for (let index = 0; index < textJobs.length; index += 1) {
    const job = textJobs[index];
    const link = linkJobs[index];
    const externalId = link?.externalId || `${job.title}:${job.company}:${job.location}`;

    if (seenIds.has(externalId)) continue;
    seenIds.add(externalId);

    merged.push({
      ...job,
      externalId,
      url: link?.url || null
    });
  }

  return merged.filter((job) => job.url);
}

export async function fetchSeekFifoJobs({ searchUrl, maxResults, fetchImpl = fetch }) {
  const response = await fetchImpl(searchUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; FIFOAUS/1.0; +https://au.seek.com/FIFO-jobs)",
      Accept: "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(`SEEK returned ${response.status}`);
  }

  const html = await response.text();
  const lines = htmlToLines(html);
  const textJobs = extractJobsFromLines(lines);
  const linkJobs = extractJobLinks(html);
  const jobs = mergeJobs(textJobs, linkJobs);

  return jobs.slice(0, maxResults);
}
