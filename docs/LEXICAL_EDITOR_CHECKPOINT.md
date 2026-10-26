# Lexical Editor Checkpoint

Date: 2026-07-21

This checkpoint records the current state after the clean editor migration and the addition of recursive story forks.

## Current State

- The chapter editor now runs through `src/components/editor/mainLexicalEditor`.
- `src/Lexical/lexical-playground` has been removed.
- Stale playground aliases were removed from `tsconfig.json` and `vite.config.ts`.
- `src/Lexical/shared` still exists as a separate legacy helper folder, but there are no active runtime imports from the deleted playground.
- Story forks are recursive `ElementNode` containers (`fork-group` / `fork-branch`) with swipeable chrome; SceneBeats remain `DecoratorNode`s and work inside active branches.
- AI previous/after words and chapter plain text follow only the **selected** branch at each fork.

## Important Editor Paths

| Area                    | Current path                                                                  |
| ----------------------- | ----------------------------------------------------------------------------- |
| Editor shell            | `src/components/editor/mainLexicalEditor/MainLexicalEditor.tsx`               |
| Editor config and nodes | `src/components/editor/mainLexicalEditor/editorConfig.ts`                     |
| Load/save plugin        | `src/components/editor/mainLexicalEditor/plugins/ChapterContentPlugin.tsx`    |
| Toolbar                 | `src/components/editor/mainLexicalEditor/toolbar/StoryToolbarPlugin.tsx`      |
| Slash commands          | `src/components/editor/mainLexicalEditor/plugins/SlashCommandPlugin.tsx`      |
| SceneBeat node          | `src/components/editor/mainLexicalEditor/nodes/SceneBeatNode.tsx`             |
| SceneBeat block UI      | `src/components/editor/mainLexicalEditor/nodes/scene-beat/`                   |
| Story forks             | `src/components/editor/mainLexicalEditor/nodes/fork/`                         |
| Fork chrome plugin      | `src/components/editor/mainLexicalEditor/nodes/fork/ForkChromePlugin.tsx`     |
| Selection-aware inserts | `src/components/editor/mainLexicalEditor/nodes/fork/getBlockInsertAnchor.ts`  |
| Selected-path text      | `src/components/editor/mainLexicalEditor/nodes/fork/selectedPathText.ts`      |
| Lorebook highlights     | `src/components/editor/mainLexicalEditor/plugins/LorebookHighlightPlugin.tsx` |
| Serialization helpers   | `src/components/editor/mainLexicalEditor/serialization/`                      |

## Story forks

- Insert via toolbar **Insert → Story Fork**, slash `/fork`, or the E2E bridge.
- A fork owns sibling branches; only the active branch is visible and included in AI context.
- Nested forks are allowed inside a branch. Nested chrome uses a left accent rail instead of stacked padded cards.
- Branch switching: drag the swipe track left/right, chevrons, or dots. Switching focuses the caret in the newly active branch.
- Fork chrome actions only: add branch, rename, delete branch, flatten fork (keeps active branch content).
- Global Story toolbar (SceneBeat, headings, images, etc.) targets the caret container — inside an active branch or outside the fork.
- `$getBlockInsertAnchor` / `$insertNodesAfterSelectionAnchor` replace `getTopLevelElementOrThrow()` for SceneBeat, image, asset-image, and fork inserts so nested inserts stay inside the branch.

## Recent Fixes

- SceneBeat matched aliases now show inline in the SceneBeat node without opening a duplicate dialog.
- Matched aliases were removed from the right rail because SceneBeat owns that display now.
- The top toolbar is sticky.
- The inert Save button was removed from the toolbar; autosave status remains.
- Chapter POV editing was renamed to Edit POV and moved to a sheet.
- Prompt model picker scrollbars were cleaned up, and mouse wheel scrolling was fixed in the prompt model list.
- Prompt selector and multi-model chips received contrast/readability fixes.
- Seeded example story content now splits Markdown paragraphs correctly with Windows line endings.
- Existing demo seed chapters are repaired on startup when their stored text still matches the seed and has the old malformed paragraph shape.
- Backspace from an empty paragraph immediately after a SceneBeat removes the SceneBeat and preserves a visible editor selection (also works when the SceneBeat lives inside a fork branch).

## Known Testing Gap

Browser automation for Lexical caret placement is brittle. Prefer the E2E bridge (`insertForkAtSelection`, `placeCursorInForkBranch`, `selectForkBranch`) and serialized Lexical state assertions over caret DOM assumptions.

Recommended tests (see `tests/editor.spec.ts` and `tests/unit/selectedPathPlainText.test.ts`):

- Load the seeded example story and assert it produces many paragraph nodes, not one giant paragraph.
- Insert SceneBeat below normal text and assert a trailing paragraph exists.
- Insert Story Fork; assert two branches and visible fork chrome.
- Insert SceneBeat while caret is inside a branch; assert it is nested under the branch, not a top-level sibling of the fork.
- Switch branches; assert plain text / AI path excludes the inactive branch.
- Insert a nested fork inside a branch.
- Backspace in an empty paragraph after SceneBeat should remove the SceneBeat and leave a valid selection.
