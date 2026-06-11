import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();

vi.mock("./pool.js", () => ({
  isDbEnabled: () => true,
  query: (...args) => queryMock(...args)
}));

const {
  countSeenJobListings,
  ensureJobListingsTable,
  markJobListingSeen
} = await import("./jobListings.js");

describe("jobListings persistence", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("keeps the listings table compatible while adding source metadata columns", async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await ensureJobListingsTable();

    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(queryMock.mock.calls[0][0]).toContain("CREATE TABLE IF NOT EXISTS seek_listings_seen");
    expect(queryMock.mock.calls[1][0]).toContain("ADD COLUMN IF NOT EXISTS platform TEXT");
    expect(queryMock.mock.calls[2][0]).toContain("ADD COLUMN IF NOT EXISTS matched_keywords TEXT[]");
  });

  it("counts seen listings by source partition", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ count: 7 }] });

    await expect(countSeenJobListings({ source: "linkedin:fifo" })).resolves.toBe(7);
    expect(queryMock.mock.calls[0][1]).toEqual(["linkedin:fifo"]);
  });

  it("persists LinkedIn listing IDs with source partitioning and keyword metadata", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ external_id: "4423102032" }] });

    const inserted = await markJobListingSeen({
      source: "linkedin:fifo",
      externalId: "4423102032",
      title: "Project Supervisor | FIFO",
      url: "https://au.linkedin.com/jobs/view/project-supervisor-4423102032",
      platform: "linkedin",
      matchedKeywords: ["fifo"]
    });

    expect(inserted).toBe(true);
    expect(queryMock.mock.calls[0][0]).toContain("ON CONFLICT (source, external_id) DO NOTHING");
    expect(queryMock.mock.calls[0][1]).toEqual([
      "linkedin:fifo",
      "4423102032",
      "Project Supervisor | FIFO",
      "https://au.linkedin.com/jobs/view/project-supervisor-4423102032",
      "linkedin",
      ["fifo"]
    ]);
  });

  it("returns false when a LinkedIn listing was already seen", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    await expect(
      markJobListingSeen({
        source: "linkedin:fifo",
        externalId: "4423102032",
        title: "Project Supervisor | FIFO",
        url: "https://au.linkedin.com/jobs/view/project-supervisor-4423102032",
        platform: "linkedin",
        matchedKeywords: ["fifo"]
      })
    ).resolves.toBe(false);
  });
});
