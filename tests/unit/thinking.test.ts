import { describe, expect, it, vi } from "vitest";
import { aiService } from "@/services/ai/AIService";
import { createThinkingStreamFilter, splitThinkingContent } from "@/lib/thinking";

function createSseResponse(events: string[]): Response {
    const encoder = new TextEncoder();

    return new Response(new ReadableStream({
        start(controller) {
            for (const event of events) {
                controller.enqueue(encoder.encode(event));
            }
            controller.close();
        },
    }), {
        headers: { "Content-Type": "text/event-stream" },
    });
}

function contentEvent(content: string): string {
    return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

function reasoningEvent(reasoningContent: string): string {
    return `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: reasoningContent } }] })}\n\n`;
}

describe("thinking content helpers", () => {
    it("returns prose unchanged when no thinking tags are present", () => {
        expect(splitThinkingContent("The scene opens in rain.")).toEqual({
            thinkingText: "",
            proseText: "The scene opens in rain.",
        });
    });

    it("extracts complete thinking blocks and keeps surrounding prose", () => {
        expect(splitThinkingContent("<think>plan quietly</think>The scene opens.")).toEqual({
            thinkingText: "plan quietly",
            proseText: "The scene opens.",
        });
    });

    it("strips completed thinking blocks from full responses", () => {
        expect(splitThinkingContent("Before <think>hidden</think> after")).toEqual({
            thinkingText: "hidden",
            proseText: "Before  after",
        });
    });

    it("combines multiple thinking blocks in order", () => {
        expect(splitThinkingContent("<think>first</think>\nProse\n<think>second</think>")).toEqual({
            thinkingText: "first\n\nsecond",
            proseText: "Prose\n",
        });
    });

    it("handles an unclosed thinking block by dropping it from prose", () => {
        expect(splitThinkingContent("Visible prose\n<think>unfinished notes")).toEqual({
            thinkingText: "unfinished notes",
            proseText: "Visible prose\n",
        });
    });

    it("handles an orphan closing tag from streamed content", () => {
        expect(splitThinkingContent("hidden notes</think>Visible prose")).toEqual({
            thinkingText: "hidden notes",
            proseText: "Visible prose",
        });
    });

    it("filters thinking tags split across streamed chunks", () => {
        const filter = createThinkingStreamFilter();

        expect(filter.push("Before <thi")).toBe("Before ");
        expect(filter.push("nk>hidden ")).toBe("");
        expect(filter.push("still hidden</th")).toBe("");
        expect(filter.push("ink> after")).toBe(" after");
        expect(filter.flush()).toBe("");
    });

    it("keeps ordinary prose that contains the word think", () => {
        const filter = createThinkingStreamFilter();

        expect(filter.push("I think this should stay.")).toBe("I think this should stay.");
        expect(filter.flush()).toBe("");
    });

    it("drops an unterminated thinking block at stream completion", () => {
        const filter = createThinkingStreamFilter();

        expect(filter.push("Visible <think>hidden")).toBe("Visible ");
        expect(filter.flush()).toBe("");
    });
});

describe("AIService.processStreamedResponse", () => {
    it("does not emit reasoning_content deltas or tagged thinking content", async () => {
        const onToken = vi.fn();
        const onComplete = vi.fn();
        const onError = vi.fn();
        const response = createSseResponse([
            reasoningEvent("internal chain of thought"),
            contentEvent("Visible <think>hidden"),
            contentEvent(" still hidden</think> text"),
            "data: [DONE]\n\n",
        ]);

        await aiService.processStreamedResponse(response, onToken, onComplete, onError);

        expect(onError).not.toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalledOnce();
        expect(onToken.mock.calls.map(([token]) => token).join("")).toBe("Visible  text");
    });
});
