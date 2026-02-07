// Tracks pending approval/input requests awaiting mobile responses

interface PendingRequest {
  id: string;
  type: "approval" | "input";
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

class PendingRequestStore {
  private requests = new Map<string, PendingRequest>();

  add(id: string, type: "approval" | "input", timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requests.delete(id);
        reject(new Error(`Request ${id} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.requests.set(id, { id, type, resolve, reject, timeout });
    });
  }

  resolve(id: string, value: unknown): boolean {
    const req = this.requests.get(id);
    if (!req) return false;
    clearTimeout(req.timeout);
    req.resolve(value);
    this.requests.delete(id);
    return true;
  }

  cancel(id: string): void {
    const req = this.requests.get(id);
    if (req) {
      clearTimeout(req.timeout);
      req.reject(new Error("Request cancelled"));
      this.requests.delete(id);
    }
  }
}

export const pendingRequests = new PendingRequestStore();
