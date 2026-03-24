import { describe, it, expect } from "vitest";
import { request } from "../setup/testHelpers";

describe("GET /health", () => {
  it("should return status ok", async () => {
    const res = await request.get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
