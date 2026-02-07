import { describe, it, expect, vi, beforeEach } from "vitest";

// We can't easily import the singleton, so test the class behavior
// by re-creating the module
describe("PendingRequestStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("resolves a pending request", async () => {
    // Dynamic import to get fresh module
    const { pendingRequests } = await import(
      "../../relay/pending-requests.js"
    );

    const promise = pendingRequests.add("req-1", "approval", 5000);

    // Resolve it
    const resolved = pendingRequests.resolve("req-1", {
      decision: "approved",
    });
    expect(resolved).toBe(true);

    const result = await promise;
    expect(result).toEqual({ decision: "approved" });
  });

  it("returns false when resolving non-existent request", async () => {
    const { pendingRequests } = await import(
      "../../relay/pending-requests.js"
    );

    const resolved = pendingRequests.resolve("non-existent", {});
    expect(resolved).toBe(false);
  });

  it("times out after specified duration", async () => {
    const { pendingRequests } = await import(
      "../../relay/pending-requests.js"
    );

    const promise = pendingRequests.add("req-timeout", "approval", 1000);

    // Advance time past timeout
    vi.advanceTimersByTime(1100);

    await expect(promise).rejects.toThrow("timed out");
  });

  it("cancels a pending request", async () => {
    const { pendingRequests } = await import(
      "../../relay/pending-requests.js"
    );

    const promise = pendingRequests.add("req-cancel", "input", 5000);

    pendingRequests.cancel("req-cancel");

    await expect(promise).rejects.toThrow("cancelled");
  });

  it("handles multiple concurrent requests", async () => {
    const { pendingRequests } = await import(
      "../../relay/pending-requests.js"
    );

    const promise1 = pendingRequests.add("req-a", "approval", 5000);
    const promise2 = pendingRequests.add("req-b", "input", 5000);

    pendingRequests.resolve("req-b", { response: "hello" });
    pendingRequests.resolve("req-a", { decision: "denied" });

    const [result1, result2] = await Promise.all([promise1, promise2]);
    expect(result1).toEqual({ decision: "denied" });
    expect(result2).toEqual({ response: "hello" });
  });
});
