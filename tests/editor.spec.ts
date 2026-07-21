/// <reference path="./e2e-globals.d.ts" />

import { expect, type Page, test } from "@playwright/test";

type EditorSnapshot = {
  currentStoryId: string | null;
  currentChapterId: string | null;
  paragraphCount: number;
  sceneBeatCount: number;
  forkGroupCount: number;
  topLevelTypes: string[];
  plainText: string;
  selection: null | {
    isRange: boolean;
    isCollapsed: boolean;
  };
  state?: unknown;
};

const EXAMPLE_STORY_ID = "example-story-iron-salt";
const CHAPTER_EDITOR = '[aria-label="Chapter editor"]';

test.describe("main Lexical editor", () => {
  test.beforeEach(async ({ page }) => {
    await openEditor(page);
  });

  test("loads the seeded example chapter as multiple paragraphs", async ({ page }) => {
    const snapshot = await getEditorSnapshot(page);

    expect(snapshot.currentStoryId).toBe(EXAMPLE_STORY_ID);
    expect(snapshot.currentChapterId).toBe(`${EXAMPLE_STORY_ID}-chapter-1`);
    expect(snapshot.paragraphCount).toBeGreaterThan(10);
    expect(snapshot.sceneBeatCount).toBe(0);
    expect(snapshot.topLevelTypes[0]).toBe("paragraph");
    expect(snapshot.plainText).toContain("Mara Venn");
  });

  test("keeps a valid selection after pressing Enter in seeded prose", async ({ page }) => {
    const before = await getEditorSnapshot(page);

    await placeCursorAtTopLevelNode(page, 0, "end");
    await page.keyboard.press("Enter");

    await expect.poll(() => getEditorSnapshot(page).then((snapshot) => snapshot.paragraphCount)).toBeGreaterThan(before.paragraphCount);

    const after = await getEditorSnapshot(page);
    expect(after.selection).toMatchObject({
      isRange: true,
      isCollapsed: true,
    });
  });

  test("inserts a SceneBeat with a trailing paragraph", async ({ page }) => {
    await placeCursorAtTopLevelNode(page, 0, "end");
    await page.keyboard.press("Alt+S");

    const after = await waitForEditorSnapshot(page, (snapshot) => snapshot.sceneBeatCount === 1);

    expect(after.topLevelTypes[1]).toBe("scene-beat");
    expect(after.topLevelTypes[2]).toBe("paragraph");
  });

  test("Backspace from an empty paragraph after a SceneBeat removes only the SceneBeat", async ({ page }) => {
    const before = await getEditorSnapshot(page);

    await placeCursorAtTopLevelNode(page, 0, "end");
    await page.keyboard.press("Alt+S");
    await waitForEditorSnapshot(page, (snapshot) => snapshot.sceneBeatCount === 1);

    await placeCursorAtTopLevelNode(page, 2, "start");
    await page.keyboard.press("Backspace");

    const after = await waitForEditorSnapshot(page, (snapshot) => snapshot.sceneBeatCount === 0);
    expect(after.paragraphCount).toBe(before.paragraphCount + 1);
    expect(after.selection).toMatchObject({
      isRange: true,
      isCollapsed: true,
    });
  });

  test("keeps Tab focus in the prose editor after a SceneBeat", async ({ page }) => {
    await placeCursorAtTopLevelNode(page, 0, "end");
    await page.keyboard.press("Alt+S");
    await waitForEditorSnapshot(page, (snapshot) => snapshot.sceneBeatCount === 1);

    const visibleEditor = page.locator(`${CHAPTER_EDITOR}:visible`).first();
    await visibleEditor.focus();
    await placeCursorAtTopLevelNode(page, 2, "end");

    await expect.poll(() => getActiveElementInfo(page)).toMatchObject({
      ariaLabel: "Chapter editor",
    });

    await page.keyboard.press("Tab");

    await expect.poll(() => getActiveElementInfo(page)).toMatchObject({
      ariaLabel: "Chapter editor",
    });
    await expect(page.locator("textarea:focus")).toHaveCount(0);
    expect(getTopLevelText(await getEditorSnapshot(page), 2)).toBe("    ");
  });

  test("autosaves edited prose back to IndexedDB", async ({ page }) => {
    const marker = ` E2E autosave marker ${Date.now()}.`;

    await placeCursorAtTopLevelNode(page, 0, "end");
    await page.keyboard.type(marker);

    await expect.poll(() => getPersistedChapterContent(page), {
      timeout: 8_000,
    }).toContain(marker.trim());
  });

  test("inserts a story fork with one branch and can add another", async ({ page }) => {
    await placeCursorAtTopLevelNode(page, 0, "end");
    await insertForkAtSelection(page);

    const afterInsert = await waitForEditorSnapshot(page, (snapshot) => snapshot.forkGroupCount === 1);
    expect(afterInsert.topLevelTypes).toContain("fork-group");
    expect(afterInsert.topLevelTypes).toContain("paragraph");

    const fork = findFirstFork(afterInsert);
    expect(fork).toBeTruthy();
    const branches = (fork?.children || []).filter((child) => child.type === "fork-branch");
    expect(branches).toHaveLength(1);
    await expect(page.getByTestId("fork-chrome").first()).toBeVisible();

    await page.getByTestId("fork-add-branch").first().click();
    const afterAdd = await waitForEditorSnapshot(page, (snapshot) => {
      const nextFork = findFirstFork(snapshot);
      const nextBranches = (nextFork?.children || []).filter((child) => child.type === "fork-branch");
      return nextBranches.length === 2;
    });
    expect(
      (findFirstFork(afterAdd)?.children || []).filter((child) => child.type === "fork-branch")
    ).toHaveLength(2);
  });

  test("inserts a SceneBeat inside the active fork branch", async ({ page }) => {
    await placeCursorAtTopLevelNode(page, 0, "end");
    await insertForkAtSelection(page);
    await waitForEditorSnapshot(page, (snapshot) => snapshot.forkGroupCount === 1);

    await placeCursorInForkBranch(page, 0);
    await page.keyboard.press("Alt+S");

    const after = await waitForEditorSnapshot(page, (snapshot) => snapshot.sceneBeatCount === 1);
    expect(after.topLevelTypes.filter((type) => type === "scene-beat")).toHaveLength(0);

    const fork = findFirstFork(after);
    const activeBranch = findActiveBranch(fork);
    const branchTypes = collectTypes(activeBranch?.children || []);
    expect(branchTypes).toContain("scene-beat");
  });

  test("switches fork branches and keeps inactive path out of plain text", async ({ page }) => {
    await placeCursorAtTopLevelNode(page, 0, "end");
    await insertForkAtSelection(page);
    await waitForEditorSnapshot(page, (snapshot) => snapshot.forkGroupCount === 1);
    await page.getByTestId("fork-add-branch").first().click();
    await waitForEditorSnapshot(page, (snapshot) => {
      const fork = findFirstFork(snapshot);
      return (fork?.children || []).filter((child) => child.type === "fork-branch").length === 2;
    });

    await placeCursorInForkBranch(page, 0, 0);
    await page.keyboard.type("Active branch marker AAA");

    await selectForkBranch(page, 0, 1);
    await placeCursorInForkBranch(page, 0, 1);
    await page.keyboard.type("Inactive branch marker BBB");

    await selectForkBranch(page, 0, 0);
    const activeSnapshot = await waitForEditorSnapshot(
      page,
      (snapshot) => snapshot.plainText.includes("Active branch marker AAA")
    );
    expect(activeSnapshot.plainText).toContain("Active branch marker AAA");
    expect(activeSnapshot.plainText).not.toContain("Inactive branch marker BBB");

    await selectForkBranch(page, 0, 1);
    const otherSnapshot = await waitForEditorSnapshot(
      page,
      (snapshot) => snapshot.plainText.includes("Inactive branch marker BBB")
    );
    expect(otherSnapshot.plainText).toContain("Inactive branch marker BBB");
    expect(otherSnapshot.plainText).not.toContain("Active branch marker AAA");
  });

  test("supports nested forks inside a branch", async ({ page }) => {
    await placeCursorAtTopLevelNode(page, 0, "end");
    await insertForkAtSelection(page);
    await waitForEditorSnapshot(page, (snapshot) => snapshot.forkGroupCount === 1);

    await placeCursorInForkBranch(page, 0, 0);
    await insertForkAtSelection(page);

    const after = await waitForEditorSnapshot(page, (snapshot) => snapshot.forkGroupCount === 2);
    const outer = findFirstFork(after);
    const nested = (outer?.children || [])
      .filter((child) => child.type === "fork-branch")
      .flatMap((branch) => branch.children || [])
      .find((child) => child.type === "fork-group");
    expect(nested?.type).toBe("fork-group");
  });

  test("resolves chapter_content from the current chapter", async ({ page }) => {
    const messages = await resolvePromptMessages(page, "Chapter text:\n{{chapter_content}}");

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("Chapter text:");
    expect(messages[0]).toContain("Mara Venn");
    expect(messages[0]).not.toContain("{{chapter_content}}");
  });

  test("resolves full previous chapter content variables", async ({ page }) => {
    const chapterThreeId = `${EXAMPLE_STORY_ID}-chapter-3`;
    const messages = await resolvePromptMessages(
      page,
      [
        "All previous:",
        "{{all_previous_chapters}}",
        "Last previous:",
        "{{previous_chapter(1)}}",
      ].join("\n"),
      { chapterId: chapterThreeId }
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("Chapter 1: Chapter One");
    expect(messages[0]).toContain("Mara Venn tightened the");
    expect(messages[0]).toContain("Chapter 2: Chapter Two");
    expect(messages[0]).toContain("Captain Anik sealed Cartography");
    expect(messages[0]).not.toContain("Chapter 3: Chapter Three");
    expect(messages[0]).not.toContain("{{all_previous_chapters}}");
    expect(messages[0]).not.toContain("{{previous_chapter(1)}}");

    const lastPrevious = messages[0]?.split("Last previous:")[1] || "";
    expect(lastPrevious).not.toContain("Chapter 1: Chapter One");
    expect(lastPrevious).toContain("Chapter 2: Chapter Two");
  });

  test("expands and collapses the Brainstorm sheet", async ({ page }) => {
    await page.getByRole("button", { name: "Brainstorm" }).click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const collapsedWidth = await getElementWidth(page, '[role="dialog"]');
    const viewportWidth = page.viewportSize()?.width || 0;

    await page.locator('[role="dialog"]').evaluate((dialog) => {
      const wideContent = document.createElement("div");
      wideContent.setAttribute("data-testid", "forced-wide-brainstorm-content");
      wideContent.style.width = "2200px";
      wideContent.style.height = "1px";
      dialog.appendChild(wideContent);
    });
    await expect.poll(() => getElementWidth(page, '[role="dialog"]')).toBeLessThanOrEqual(collapsedWidth + 8);

    await page.locator('button[title="Expand Brainstorm"]').click();
    await expect(page.locator('button[title="Collapse Brainstorm"]')).toBeVisible();
    await expect.poll(() => getElementWidth(page, '[role="dialog"]')).toBeGreaterThan(viewportWidth - 8);

    await page.locator('button[title="Collapse Brainstorm"]').click();
    await expect(page.locator('button[title="Expand Brainstorm"]')).toBeVisible();
    await expect.poll(() => getElementWidth(page, '[role="dialog"]')).toBeLessThan(collapsedWidth + 8);
  });

  test("opens the Prompts sheet from the Brainstorm prompt selector", async ({ page }) => {
    await page.getByRole("button", { name: "Brainstorm" }).click();
    await expect(page.locator('[role="dialog"]').getByRole("heading", { name: "Brainstorm" })).toBeVisible();

    await page.getByRole("button", { name: "Start New Brainstorm" }).click();
    await expect(page.getByTestId("prompt-select-brainstorm-trigger")).toBeVisible();
    await page.getByTestId("prompt-select-brainstorm-trigger").click();
    await page.getByTestId("prompt-select-configure-prompts").click();

    await expect(page.locator('[role="dialog"]').getByRole("heading", { name: "Prompts" })).toBeVisible();
  });

  test("preserves pinned Brainstorm context across sheet remounts", async ({ page }) => {
    await page.getByRole("button", { name: "Brainstorm" }).click();
    await expect(page.locator('[role="dialog"]').getByRole("heading", { name: "Brainstorm" })).toBeVisible();

    const startButton = page.getByRole("button", { name: "Start New Brainstorm" });
    if (await startButton.isVisible().catch(() => false)) {
      await startButton.click();
    }

    const pinSwitch = page.getByTestId("brainstorm-pin-to-chapter");
    const fullContextSwitch = page.getByTestId("brainstorm-full-context");

    await expect(pinSwitch).toBeVisible();
    await expect(pinSwitch).toHaveAttribute("data-state", "unchecked");

    await pinSwitch.click();
    await fullContextSwitch.click();
    await expect(pinSwitch).toHaveAttribute("data-state", "checked");
    await expect(fullContextSwitch).toHaveAttribute("data-state", "checked");

    await page.keyboard.press("Escape");
    await expect(page.locator('[role="dialog"]')).toBeHidden();

    await page.getByRole("button", { name: "Brainstorm" }).click();
    await expect(page.getByTestId("brainstorm-pin-to-chapter")).toHaveAttribute("data-state", "checked");
    await expect(page.getByTestId("brainstorm-full-context")).toHaveAttribute("data-state", "checked");

    await page.getByTestId("brainstorm-pin-to-chapter").click();
    await page.keyboard.press("Escape");
    await expect(page.locator('[role="dialog"]')).toBeHidden();

    await page.getByRole("button", { name: "Brainstorm" }).click();
    await expect(page.getByTestId("brainstorm-pin-to-chapter")).toHaveAttribute("data-state", "unchecked");
    await expect(page.getByTestId("brainstorm-full-context")).toHaveAttribute("data-state", "unchecked");
  });
});

async function openEditor(page: Page) {
  await page.goto("/");

  await expect(page.locator(CHAPTER_EDITOR).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const api = window.__STORY_NEXUS_E2E__;
    return !!api?.getEditorSnapshot().currentChapterId;
  });

  await waitForEditorSnapshot(page, (snapshot) => snapshot.paragraphCount > 0);
}

async function getEditorSnapshot(page: Page): Promise<EditorSnapshot> {
  return page.evaluate(() => {
    const api = window.__STORY_NEXUS_E2E__;
    if (!api) {
      throw new Error("Story Nexus E2E API is not available. Did Vite start with VITE_E2E=true?");
    }
    return api.getEditorSnapshot();
  });
}

async function getElementWidth(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((element) => element.getBoundingClientRect().width);
}

async function getActiveElementInfo(page: Page): Promise<{
  ariaLabel: string | null;
  tagName: string | null;
}> {
  return page.evaluate(() => {
    const activeElement = document.activeElement;
    return {
      ariaLabel: activeElement?.getAttribute("aria-label") ?? null,
      tagName: activeElement?.tagName ?? null,
    };
  });
}

function getTopLevelText(snapshot: EditorSnapshot, index: number): string {
  const root = (snapshot.state as { root?: { children?: SerializedLexicalNode[] } })?.root;
  const topLevelNode = Array.isArray(root?.children) ? root.children[index] : null;
  return topLevelNode ? collectSerializedText(topLevelNode) : "";
}

function collectSerializedText(node: SerializedLexicalNode): string {
  const ownText = typeof node.text === "string" ? node.text : "";
  const childText = Array.isArray(node.children)
    ? node.children.map(collectSerializedText).join("")
    : "";
  return `${ownText}${childText}`;
}

async function waitForEditorSnapshot(
  page: Page,
  predicate: (snapshot: EditorSnapshot) => boolean
): Promise<EditorSnapshot> {
  let latest: EditorSnapshot | null = null;

  await expect.poll(async () => {
    latest = await getEditorSnapshot(page);
    return predicate(latest);
  }).toBe(true);

  if (!latest) {
    throw new Error("Editor snapshot never became available.");
  }

  return latest;
}

async function placeCursorAtTopLevelNode(
  page: Page,
  index: number,
  position: "start" | "end"
) {
  await page.evaluate(
    ({ index, position }) => {
      const api = window.__STORY_NEXUS_E2E__;
      if (!api) {
        throw new Error("Story Nexus E2E API is not available.");
      }
      return api.placeCursorAtTopLevelNode(index, position);
    },
    { index, position }
  );
}

async function insertForkAtSelection(page: Page) {
  await page.evaluate(() => {
    const api = window.__STORY_NEXUS_E2E__;
    if (!api) {
      throw new Error("Story Nexus E2E API is not available.");
    }
    return api.insertForkAtSelection();
  });
}

async function selectForkBranch(page: Page, forkIndex: number, branchIndex: number) {
  await page.evaluate(
    ({ forkIndex, branchIndex }) => {
      const api = window.__STORY_NEXUS_E2E__;
      if (!api) {
        throw new Error("Story Nexus E2E API is not available.");
      }
      return api.selectForkBranch(forkIndex, branchIndex);
    },
    { forkIndex, branchIndex }
  );
}

async function placeCursorInForkBranch(
  page: Page,
  forkIndex: number,
  branchIndex?: number
) {
  await page.evaluate(
    ({ forkIndex, branchIndex }) => {
      const api = window.__STORY_NEXUS_E2E__;
      if (!api) {
        throw new Error("Story Nexus E2E API is not available.");
      }
      return api.placeCursorInForkBranch(forkIndex, branchIndex);
    },
    { forkIndex, branchIndex }
  );
}

type SerializedLexicalNode = {
  type?: string;
  text?: string;
  activeBranchKey?: string;
  branchKey?: string;
  active?: boolean;
  children?: SerializedLexicalNode[];
};

function findFirstFork(snapshot: EditorSnapshot): SerializedLexicalNode | null {
  const root = (snapshot.state as { root?: { children?: SerializedLexicalNode[] } })?.root;
  return (root?.children || []).find((child) => child.type === "fork-group") || null;
}

function findActiveBranch(fork: SerializedLexicalNode | null): SerializedLexicalNode | null {
  if (!fork) return null;
  const branches = (fork.children || []).filter((child) => child.type === "fork-branch");
  return (
    branches.find((branch) => branch.branchKey === fork.activeBranchKey) ||
    branches.find((branch) => branch.active) ||
    branches[0] ||
    null
  );
}

function collectTypes(nodes: SerializedLexicalNode[]): string[] {
  const types: string[] = [];
  for (const node of nodes) {
    if (node.type) types.push(node.type);
    if (node.children) types.push(...collectTypes(node.children));
  }
  return types;
}

async function getPersistedChapterContent(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const api = window.__STORY_NEXUS_E2E__;
    if (!api) {
      throw new Error("Story Nexus E2E API is not available.");
    }
    return api.getPersistedChapterContent();
  });
}

async function resolvePromptMessages(
  page: Page,
  content: string,
  options?: { chapterId?: string }
): Promise<Array<string | null>> {
  return page.evaluate(({ promptContent, promptOptions }) => {
    const api = window.__STORY_NEXUS_E2E__;
    if (!api) {
      throw new Error("Story Nexus E2E API is not available.");
    }
    return api.resolvePromptMessages(promptContent, promptOptions);
  }, { promptContent: content, promptOptions: options });
}
