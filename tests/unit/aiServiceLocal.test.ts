import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { aiService } from "@/services/ai/AIService";

function streamResponse(text: string): Response {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });

  return new Response(body, { status: 200 });
}

describe("AIService.testLocalDefaultModel", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const service = aiService as any;
    service.settings = {
      id: "settings",
      createdAt: new Date(),
      localRuntime: "lm_studio",
      localApiUrl: "http://localhost:1234/v1",
      localModelsUrl: "http://localhost:1234/v1/models",
      localModelIdByRuntime: { lm_studio: "gemma-3" },
      availableModels: [
        {
          id: "local/gemma-3",
          name: "Gemma 3",
          provider: "local",
          contextLength: 32768,
          enabled: true,
        },
      ],
    };
    service.abortController = null;

    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("sends a simple prompt to the configured local default model", async () => {
    fetchMock.mockResolvedValue(streamResponse([
      'data: {"choices":[{"delta":{"content":"local test ok"}}]}',
      "",
      "data: [DONE]",
      "",
    ].join("\n")));

    await expect(aiService.testLocalDefaultModel()).resolves.toBe("local test ok");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:1234/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({
      model: "gemma-3",
      stream: true,
      temperature: 0,
      max_tokens: 32,
      messages: [
        { role: "user", content: "Reply with exactly this text: local test ok" },
      ],
    });
  });

  test("surfaces local API error responses", async () => {
    fetchMock.mockResolvedValue(new Response("no model loaded", {
      status: 503,
      statusText: "Service Unavailable",
    }));

    await expect(aiService.testLocalDefaultModel()).rejects.toThrow(
      "Local AI test failed (503 Service Unavailable): no model loaded"
    );
  });
});
