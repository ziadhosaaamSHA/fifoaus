function stripTrailingSlash(url) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function buildHeaders(cfg) {
  const headers = { Accept: "application/json" };
  if (cfg.CONTENT_API_TOKEN) {
    headers.Authorization = `Bearer ${cfg.CONTENT_API_TOKEN}`;
  }
  return headers;
}

async function readJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload.error || `content_api_error:${response.status}`);
    err.status = response.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

function addAgeParams(url, { minAgeHours, maxAgeHours }) {
  if (minAgeHours !== undefined) url.searchParams.set("minAgeHours", String(minAgeHours));
  if (maxAgeHours !== undefined) url.searchParams.set("maxAgeHours", String(maxAgeHours));
}

export async function listJobsFromContentApi({ cfg, source, limit = 20, minAgeHours, maxAgeHours }) {
  const baseUrl = stripTrailingSlash(cfg.CONTENT_API_BASE_URL);
  const url = new URL(`${baseUrl}/api/jobs`);
  if (source) url.searchParams.set("source", source);
  url.searchParams.set("limit", String(limit));
  addAgeParams(url, { minAgeHours, maxAgeHours });

  const response = await fetch(url, {
    headers: buildHeaders(cfg)
  });
  const payload = await readJsonResponse(response);
  return payload.jobs || [];
}

export async function syncJobsFromContentApi({ cfg, source, maxResults, minAgeHours, maxAgeHours }) {
  const baseUrl = stripTrailingSlash(cfg.CONTENT_API_BASE_URL);
  const url = new URL(`${baseUrl}/api/jobs/sync/${source}`);
  if (maxResults) url.searchParams.set("maxResults", String(maxResults));
  addAgeParams(url, { minAgeHours, maxAgeHours });

  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(cfg)
  });
  return readJsonResponse(response);
}

export async function listNewsFromContentApi({ cfg, source, limit = 20, minAgeHours, maxAgeHours }) {
  const baseUrl = stripTrailingSlash(cfg.CONTENT_API_BASE_URL);
  const url = new URL(`${baseUrl}/api/news`);
  if (source) url.searchParams.set("source", source);
  url.searchParams.set("limit", String(limit));
  addAgeParams(url, { minAgeHours, maxAgeHours });

  const response = await fetch(url, {
    headers: buildHeaders(cfg)
  });
  const payload = await readJsonResponse(response);
  return payload.items || [];
}

export async function syncNewsFromContentApi({ cfg, source, maxResults, minAgeHours, maxAgeHours }) {
  const baseUrl = stripTrailingSlash(cfg.CONTENT_API_BASE_URL);
  const url = new URL(`${baseUrl}/api/news/sync/${source}`);
  if (maxResults) url.searchParams.set("maxResults", String(maxResults));
  addAgeParams(url, { minAgeHours, maxAgeHours });

  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(cfg)
  });
  return readJsonResponse(response);
}
