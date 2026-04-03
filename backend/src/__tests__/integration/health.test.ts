import { describe, it, expect } from "vitest";
import { request } from "../setup/testHelpers";

describe("GET /health", () => {
  it("should return status ok with enriched info", async () => {
    const res = await request.get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.version).toBeDefined();
    expect(typeof res.body.uptime).toBe("number");
    expect(res.body.db).toBe("ok");
  });
});

describe("GET /health/ready", () => {
  it("should return ready when DB is accessible", async () => {
    const res = await request.get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
  });
});
