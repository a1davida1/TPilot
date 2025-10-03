import { describe, expect, it, vi, afterEach } from "vitest";

import { apiRequest } from "../queryClient";

describe("apiRequest error handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes server metadata when a 403 email verification error is returned", async () => {
    const payload = {
      message: "Please verify your email before logging in.",
      code: "EMAIL_NOT_VERIFIED",
      email: "user@example.com",
    };

    const response = new Response(JSON.stringify(payload), {
      status: 403,
      statusText: "Forbidden",
      headers: { "Content-Type": "application/json" },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);

    await expect(apiRequest("GET", "/api/auth/login")).rejects.toMatchObject({
      status: 403,
      statusText: "Forbidden",
      code: "EMAIL_NOT_VERIFIED",
      email: "user@example.com",
      responseBody: payload,
    });
  });
});
