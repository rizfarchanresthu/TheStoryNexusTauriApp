import { beforeEach, describe, expect, test } from "vitest";

import { createPromptParser } from "@/features/prompts/services/promptParser";
import { useLorebookStore } from "@/features/lorebook/stores/useLorebookStore";
import { db } from "@/services/database";
import type { LorebookEntry, Prompt } from "@/types/story";
import { resetTestDb } from "./testDb";

describe("PromptParser", () => {
  beforeEach(async () => {
    await resetTestDb();
    useLorebookStore.setState({
      entries: [],
      isLoading: false,
      error: null,
      aliasMap: {},
      editorContent: "",
      matchedEntries: new Map(),
      chapterMatchedEntries: new Map(),
    });
  });

  test("resolves after_words with a word limit from the start of afterWords", async () => {
    await addPrompt("After text: {{after_words(4)}}");

    const result = await createPromptParser().parse({
      promptId: "unit-prompt",
      storyId: "story-1",
      afterWords: "one two three four five six",
    });

    expect(result.error).toBeUndefined();
    expect(result.messages[0].content).toBe("After text: one two three four");
  });

  test("resolves after_words without arguments using the default limit", async () => {
    await addPrompt("After text: {{after_words}}");

    const result = await createPromptParser().parse({
      promptId: "unit-prompt",
      storyId: "story-1",
      afterWords: "one two three",
    });

    expect(result.error).toBeUndefined();
    expect(result.messages[0].content).toBe("After text: one two three");
  });

  test("resolves after_words to an explicit no-context note when no afterWords context exists", async () => {
    await addPrompt("After text: {{after_words(5)}}");

    const result = await createPromptParser().parse({
      promptId: "unit-prompt",
      storyId: "story-1",
    });

    expect(result.error).toBeUndefined();
    expect(result.messages[0].content).toBe("After text: No after-cursor text was provided.");
  });

  test("resolves after_words to an explicit no-context note when afterWords is blank", async () => {
    await addPrompt("After text: {{after_words(5)}}");

    const result = await createPromptParser().parse({
      promptId: "unit-prompt",
      storyId: "story-1",
      afterWords: "   ",
    });

    expect(result.error).toBeUndefined();
    expect(result.messages[0].content).toBe("After text: No after-cursor text was provided.");
  });

  test("omits lorebook type when metadata type is missing", async () => {
    await addPrompt("Lore:\n{{lorebook_chapter_matched_entries}}");

    const result = await createPromptParser().parse({
      promptId: "unit-prompt",
      storyId: "story-1",
      chapterMatchedEntries: new Set([
        lorebookEntry({
          name: "Mara",
          metadata: {},
        }),
      ]),
    });

    expect(result.error).toBeUndefined();
    expect(result.messages[0].content).toContain("CHARACTER: Mara");
    expect(result.messages[0].content).toContain("Description: Lore description");
    expect(result.messages[0].content).not.toContain("Type: Unknown");
  });

  test("keeps lorebook type when metadata type has a value", async () => {
    await addPrompt("Lore:\n{{lorebook_chapter_matched_entries}}");

    const result = await createPromptParser().parse({
      promptId: "unit-prompt",
      storyId: "story-1",
      chapterMatchedEntries: new Set([
        lorebookEntry({
          name: "Mara",
          metadata: { type: "Cartographer" },
        }),
      ]),
    });

    expect(result.error).toBeUndefined();
    expect(result.messages[0].content).toContain("Type: Cartographer");
  });

  test("resolves a specific lorebook entry by name", async () => {
    await addPrompt("Lore:\n{{lorebook The Towering Statue}}");
    await db.lorebookEntries.add(lorebookEntry({
      name: "The Towering Statue",
      category: "location",
      description: "A moonlit monument above the old harbor.",
    }));

    const result = await createPromptParser().parse({
      promptId: "unit-prompt",
      storyId: "story-1",
    });

    expect(result.error).toBeUndefined();
    expect(result.messages[0].content).toContain("LOCATION: The Towering Statue");
    expect(result.messages[0].content).toContain("Description: A moonlit monument above the old harbor.");
  });

  test("resolves a specific lorebook entry by alias", async () => {
    await addPrompt("Lore:\n{{lorebook sky needle}}");
    await db.lorebookEntries.add(lorebookEntry({
      name: "The Towering Statue",
      category: "location",
      aliases: ["Sky Needle"],
      description: "A moonlit monument above the old harbor.",
    }));

    const result = await createPromptParser().parse({
      promptId: "unit-prompt",
      storyId: "story-1",
    });

    expect(result.error).toBeUndefined();
    expect(result.messages[0].content).toContain("LOCATION: The Towering Statue");
  });

  test("resolves magic system and world rule lorebook variables", async () => {
    await addPrompt("Magic:\n{{all_magic_systems}}\nRules:\n{{all_world_rules}}");
    useLorebookStore.setState({
      entries: [
        lorebookEntry({
          id: "magic-1",
          name: "Wand Magic",
          category: "magic system",
          description: "Spellcasting requires a wand and clear intent.",
        }),
        lorebookEntry({
          id: "rule-1",
          name: "Statute of Secrecy",
          category: "world rule",
          description: "Magical society must remain hidden.",
        }),
      ],
    });

    const result = await createPromptParser().parse({
      promptId: "unit-prompt",
      storyId: "story-1",
    });

    expect(result.error).toBeUndefined();
    expect(result.messages[0].content).toContain("MAGIC SYSTEM: Wand Magic");
    expect(result.messages[0].content).toContain("WORLD RULE: Statute of Secrecy");
  });

  test("resolves selected chapter outlines in brainstorm_context", async () => {
    await addPrompt("Context:\n{{brainstorm_context}}");
    await addOutlinedChapters();

    const result = await createPromptParser().parse({
      promptId: "unit-prompt",
      storyId: "story-1",
      additionalContext: {
        selectedOutlines: ["ch-1"],
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.messages[0].content).toContain("Chapter Outlines:");
    expect(result.messages[0].content).toContain("Chapter 1 Outline (Crossing)");
    expect(result.messages[0].content).toContain("## Beats\n- Arrival");
    expect(result.messages[0].content).not.toContain("Return");
  });

  test("resolves all chapter outlines in brainstorm_context", async () => {
    await addPrompt("Context:\n{{brainstorm_context}}");
    await addOutlinedChapters();

    const result = await createPromptParser().parse({
      promptId: "unit-prompt",
      storyId: "story-1",
      additionalContext: {
        selectedOutlines: ["all"],
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.messages[0].content).toContain("Chapter 1 Outline (Crossing)");
    expect(result.messages[0].content).toContain("Chapter 2 Outline (Return)");
    expect(result.messages[0].content).not.toContain("Chapter 3 Outline");
  });

  test("includes chapter outlines in full brainstorm context", async () => {
    await addPrompt("Context:\n{{brainstorm_context}}");
    await addOutlinedChapters();

    const result = await createPromptParser().parse({
      promptId: "unit-prompt",
      storyId: "story-1",
      additionalContext: {
        includeFullContext: true,
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.messages[0].content).toContain("Chapter Outlines:");
    expect(result.messages[0].content).toContain("Chapter 1 Outline (Crossing)");
    expect(result.messages[0].content).toContain("Chapter 2 Outline (Return)");
  });
});

async function addPrompt(content: string): Promise<void> {
  const prompt: Prompt = {
    id: "unit-prompt",
    createdAt: new Date(),
    name: "Unit Prompt",
    promptType: "continue_writing",
    messages: [{ role: "user", content }],
    allowedModels: [{ id: "local", name: "local", provider: "local" }],
  };

  await db.prompts.add(prompt);
}

async function addOutlinedChapters(): Promise<void> {
  await db.chapters.bulkAdd([
    {
      id: "ch-1",
      createdAt: new Date(),
      storyId: "story-1",
      title: "Crossing",
      order: 1,
      content: "",
      wordCount: 0,
      outline: { content: "## Beats\n- Arrival", lastUpdated: new Date() },
    },
    {
      id: "ch-2",
      createdAt: new Date(),
      storyId: "story-1",
      title: "Return",
      order: 2,
      content: "",
      wordCount: 0,
      outline: { content: "## Beats\n- Reversal", lastUpdated: new Date() },
    },
    {
      id: "ch-3",
      createdAt: new Date(),
      storyId: "story-1",
      title: "Empty",
      order: 3,
      content: "",
      wordCount: 0,
    },
  ]);
}

function lorebookEntry(overrides: Partial<LorebookEntry>): LorebookEntry {
  return {
    id: "unit-lore",
    storyId: "story-1",
    createdAt: new Date(),
    name: "Unit Lore",
    description: "Lore description",
    category: "character",
    aliases: [],
    tags: [],
    ...overrides,
  };
}
