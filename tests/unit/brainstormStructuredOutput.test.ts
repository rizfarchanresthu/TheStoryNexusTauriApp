import { describe, expect, test } from "vitest";

import parseLorebookJson from "@/features/brainstorm/utils/parseLorebookJson";
import {
  buildBrainstormUserInput,
  parseBrainstormStructuredOutput,
  STRUCTURED_OUTPUT_OPTIONS,
} from "@/features/brainstorm/utils/structuredOutput";

describe("brainstorm structured output", () => {
  test("appends hidden lorebook entry instructions for lorebook mode", () => {
    const input = buildBrainstormUserInput("Extract this character.", "lorebook_entries");

    expect(input).toContain("Extract this character.");
    expect(input).toContain("STRUCTURED OUTPUT MODE: Lorebook Entries");
    expect(input).toContain('"lorebookEntries"');
  });

  test("appends world seed instructions for world seed mode", () => {
    const input = buildBrainstormUserInput("An academy AU with three leads.", "world_seed");

    expect(input).toContain("An academy AU with three leads.");
    expect(input).toContain("STRUCTURED OUTPUT MODE: World Seed");
    expect(input).toContain('"synopsis" entry');
    expect(input).toContain('"starting scenario" entries');
    expect(input).toContain('"magic system"');
    expect(input).toContain('"world rule"');
  });

  test("exposes world seed as a structured output option", () => {
    expect(STRUCTURED_OUTPUT_OPTIONS).toContainEqual({
      value: "world_seed",
      label: "World Seed",
      description: "Return a starter world as importable lorebook entry JSON.",
    });
  });

  test("leaves normal brainstorm input unchanged", () => {
    expect(buildBrainstormUserInput("Talk through this scene.", "normal")).toBe("Talk through this scene.");
  });

  test("parses chapter outline structured JSON", () => {
    const parsed = parseBrainstormStructuredOutput(`
\`\`\`json
{
  "chapterOutline": {
    "title": "The Crossing",
    "content": "## Beats\\n- Arrival\\n- Reversal"
  }
}
\`\`\`
`);

    expect(parsed.chapterOutline).toEqual({
      title: "The Crossing",
      content: "## Beats\n- Arrival\n- Reversal",
    });
  });

  test("parses decisions and open questions structured JSON", () => {
    const parsed = parseBrainstormStructuredOutput(`
\`\`\`json
{
  "storyDecisions": [
    { "decision": "Mara hides the map.", "rationale": "It preserves the mystery." }
  ],
  "openQuestions": [
    { "question": "Who taught Mara the cipher?", "context": "This affects the backstory." }
  ]
}
\`\`\`
`);

    expect(parsed.storyDecisions).toEqual([
      { decision: "Mara hides the map.", rationale: "It preserves the mystery." },
    ]);
    expect(parsed.openQuestions).toEqual([
      { question: "Who taught Mara the cipher?", context: "This affects the backstory." },
    ]);
  });

  test("parses lorebookEntries wrapper for lorebook extraction", () => {
    const parsed = parseLorebookJson(`
\`\`\`json
{
  "lorebookEntries": [
    {
      "name": "Mara",
      "description": "A cartographer with a hidden map.",
      "category": "character",
      "aliases": ["Mara", "the cartographer"],
      "tags": ["cartographer"]
    }
  ]
}
\`\`\`
`);

    expect(parsed.error).toBeUndefined();
    expect(parsed.entries).toEqual([
      {
        name: "Mara",
        description: "A cartographer with a hidden map.",
        category: "character",
        aliases: ["Mara", "the cartographer"],
        tags: ["cartographer"],
      },
    ]);
  });

  test("parses magic system and world rule lorebook categories", () => {
    const parsed = parseLorebookJson(`
\`\`\`json
{
  "lorebookEntries": [
    {
      "name": "Wand Magic",
      "description": "Spellcasting requires a wand and clear intent.",
      "category": "magic system",
      "aliases": ["wand magic"],
      "tags": ["spellcasting"]
    },
    {
      "name": "Statute of Secrecy",
      "description": "Magical society must remain hidden from non-magical society.",
      "category": "world rule",
      "aliases": ["secrecy statute"],
      "tags": ["law"]
    }
  ]
}
\`\`\`
`);

    expect(parsed.error).toBeUndefined();
    expect(parsed.entries.map((entry) => entry.category)).toEqual([
      "magic system",
      "world rule",
    ]);
  });

  test("treats legacy lorebook tags as aliases", () => {
    const parsed = parseLorebookJson(`
\`\`\`json
{
  "lorebookEntries": [
    {
      "name": "Mara",
      "description": "A cartographer with a hidden map.",
      "category": "character",
      "tags": ["the mapmaker"]
    }
  ]
}
\`\`\`
`);

    expect(parsed.error).toBeUndefined();
    expect(parsed.entries).toEqual([
      {
        name: "Mara",
        description: "A cartographer with a hidden map.",
        category: "character",
        aliases: ["the mapmaker"],
      },
    ]);
  });
});
