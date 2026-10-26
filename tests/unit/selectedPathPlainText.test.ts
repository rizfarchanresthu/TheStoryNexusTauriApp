import { describe, expect, it } from "vitest";
import { lexicalToSelectedPathPlainText } from "@/components/editor/mainLexicalEditor/nodes/fork/selectedPathFromSerialized";

describe("lexicalToSelectedPathPlainText", () => {
  it("includes only the active branch text", () => {
    const content = {
      root: {
        children: [
          {
            type: "paragraph",
            version: 1,
            children: [{ type: "text", text: "Before.", version: 1 }],
          },
          {
            type: "fork-group",
            version: 1,
            forkId: "fork-1",
            activeBranchKey: "a",
            children: [
              { type: "fork-header", version: 1 },
              {
                type: "fork-branch",
                version: 1,
                branchKey: "a",
                title: "Path A",
                active: true,
                children: [
                  {
                    type: "paragraph",
                    version: 1,
                    children: [{ type: "text", text: "Active path.", version: 1 }],
                  },
                ],
              },
              {
                type: "fork-branch",
                version: 1,
                branchKey: "b",
                title: "Path B",
                active: false,
                children: [
                  {
                    type: "paragraph",
                    version: 1,
                    children: [{ type: "text", text: "Hidden path.", version: 1 }],
                  },
                ],
              },
            ],
          },
          {
            type: "paragraph",
            version: 1,
            children: [{ type: "text", text: "After.", version: 1 }],
          },
        ],
      },
    };

    const text = lexicalToSelectedPathPlainText(JSON.stringify(content));
    expect(text).toContain("Before.");
    expect(text).toContain("Active path.");
    expect(text).toContain("After.");
    expect(text).not.toContain("Hidden path.");
  });

  it("follows nested active branches", () => {
    const content = {
      root: {
        children: [
          {
            type: "fork-group",
            version: 1,
            forkId: "fork-outer",
            activeBranchKey: "outer-a",
            children: [
              { type: "fork-header", version: 1 },
              {
                type: "fork-branch",
                version: 1,
                branchKey: "outer-a",
                title: "Outer A",
                active: true,
                children: [
                  {
                    type: "paragraph",
                    version: 1,
                    children: [{ type: "text", text: "Outer active.", version: 1 }],
                  },
                  {
                    type: "fork-group",
                    version: 1,
                    forkId: "fork-inner",
                    activeBranchKey: "inner-b",
                    children: [
                      { type: "fork-header", version: 1 },
                      {
                        type: "fork-branch",
                        version: 1,
                        branchKey: "inner-a",
                        title: "Inner A",
                        active: false,
                        children: [
                          {
                            type: "paragraph",
                            version: 1,
                            children: [{ type: "text", text: "Inner hidden.", version: 1 }],
                          },
                        ],
                      },
                      {
                        type: "fork-branch",
                        version: 1,
                        branchKey: "inner-b",
                        title: "Inner B",
                        active: true,
                        children: [
                          {
                            type: "paragraph",
                            version: 1,
                            children: [{ type: "text", text: "Inner active.", version: 1 }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                type: "fork-branch",
                version: 1,
                branchKey: "outer-b",
                title: "Outer B",
                active: false,
                children: [
                  {
                    type: "paragraph",
                    version: 1,
                    children: [{ type: "text", text: "Outer hidden.", version: 1 }],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const text = lexicalToSelectedPathPlainText(JSON.stringify(content));
    expect(text).toContain("Outer active.");
    expect(text).toContain("Inner active.");
    expect(text).not.toContain("Outer hidden.");
    expect(text).not.toContain("Inner hidden.");
  });

  it("skips scene-beat and fork-header nodes", () => {
    const content = {
      root: {
        children: [
          {
            type: "paragraph",
            version: 1,
            children: [{ type: "text", text: "Prose.", version: 1 }],
          },
          {
            type: "scene-beat",
            version: 2,
            command: "Do not include me",
            generatedContent: "Also skip",
          },
          {
            type: "fork-group",
            version: 1,
            forkId: "fork-1",
            activeBranchKey: "a",
            children: [
              { type: "fork-header", version: 1 },
              {
                type: "fork-branch",
                version: 1,
                branchKey: "a",
                title: "Path A",
                active: true,
                children: [
                  {
                    type: "paragraph",
                    version: 1,
                    children: [{ type: "text", text: "Branch prose.", version: 1 }],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const text = lexicalToSelectedPathPlainText(JSON.stringify(content));
    expect(text).toContain("Prose.");
    expect(text).toContain("Branch prose.");
    expect(text).not.toContain("Do not include me");
    expect(text).not.toContain("Also skip");
  });
});
