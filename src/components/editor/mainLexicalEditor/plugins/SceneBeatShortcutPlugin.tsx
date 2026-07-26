import { useEffect } from "react";

import {
    $getSelection,
    $isRangeSelection,
    $isSelectionCapturedInDecoratorInput,
    COMMAND_PRIORITY_EDITOR,
    COMMAND_PRIORITY_HIGH,
    COMMAND_PRIORITY_NORMAL,
    isDOMNode,
    KEY_BACKSPACE_COMMAND,
    KEY_ENTER_COMMAND,
    KEY_MODIFIER_COMMAND,
    KEY_TAB_COMMAND,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext.js";

import { $isSceneBeatNode } from "../nodes/SceneBeatNode";
import { $insertSceneBeatBelowSelection, focusInsertedSceneBeat } from "../nodes/scene-beat/insertSceneBeat";
import { $getBlockInsertAnchor } from "../nodes/fork/getBlockInsertAnchor";
import { $isForkGroupNode } from "../nodes/fork/ForkGroupNode";
import { $isForkHeaderNode } from "../nodes/fork/ForkHeaderNode";
import { $isForkBranchNode } from "../nodes/fork/ForkBranchNode";
import { $insertForkBelowSelection } from "../nodes/fork/insertFork";

/**
 * True when the event targets a nested INPUT/TEXTAREA inside a DecoratorNode
 * (SceneBeat command field, image prompt, etc.). Lexical still sees bubbled
 * keydowns from those controls; rich-text's KEY_ENTER handler will otherwise
 * preventDefault and insert a paragraph under the decorator.
 */
function isDecoratorInputEvent(event: KeyboardEvent | null | undefined): boolean {
    if (!event || !isDOMNode(event.target) || !(event.target instanceof HTMLElement)) {
        return false;
    }
    return $isSelectionCapturedInDecoratorInput(event.target, event.target);
}

function isInsertSceneBeatShortcut(event: KeyboardEvent): boolean {
    return (
        event.code === "KeyS" &&
        event.altKey &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey
    );
}

function isInsertForkShortcut(event: KeyboardEvent): boolean {
    return (
        event.code === "KeyB" &&
        event.altKey &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey
    );
}

function isParagraphBlockEmpty(blockNode: ReturnType<typeof $getBlockInsertAnchor>): boolean {
    return !!blockNode &&
        blockNode.getType() === "paragraph" &&
        blockNode.getTextContentSize() === 0;
}

export function SceneBeatShortcutPlugin() {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        const removeShortcut = editor.registerCommand(
            KEY_MODIFIER_COMMAND,
            (event: KeyboardEvent) => {
                if (isInsertSceneBeatShortcut(event)) {
                    event.preventDefault();
                    editor.update(() => {
                        const nodeKey = $insertSceneBeatBelowSelection();
                        focusInsertedSceneBeat(nodeKey);
                    });
                    return true;
                }

                if (isInsertForkShortcut(event)) {
                    event.preventDefault();
                    editor.update(() => {
                        $insertForkBelowSelection();
                    });
                    return true;
                }

                return false;
            },
            COMMAND_PRIORITY_NORMAL
        );

        // Let Enter create a newline inside decorator inputs instead of a
        // paragraph below the SceneBeat / image node.
        const removeEnterPassthrough = editor.registerCommand(
            KEY_ENTER_COMMAND,
            (event: KeyboardEvent | null) => {
                if (isDecoratorInputEvent(event)) {
                    return true;
                }
                return false;
            },
            COMMAND_PRIORITY_HIGH
        );

        const removeBackspace = editor.registerCommand(
            KEY_BACKSPACE_COMMAND,
            (event: KeyboardEvent) => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
                    return false;
                }

                const anchorNode = selection.anchor.getNode();
                const blockNode = $getBlockInsertAnchor(anchorNode);

                if (
                    !isParagraphBlockEmpty(blockNode) ||
                    selection.anchor.offset !== 0 ||
                    !blockNode
                ) {
                    return false;
                }

                const previousNode = blockNode.getPreviousSibling();

                // Empty paragraph after SceneBeat → remove SceneBeat
                if ($isSceneBeatNode(previousNode)) {
                    event.preventDefault();
                    previousNode.remove();
                    blockNode.selectStart();
                    return true;
                }

                // Empty first paragraph in a branch with nothing before → leave alone
                // Empty paragraph immediately after a fork group → remove fork (flatten would lose inactive; just delete empty merge)
                if ($isForkGroupNode(previousNode)) {
                    // Don't auto-delete forks on backspace; only remove SceneBeats.
                    return false;
                }

                // Empty paragraph as sole content after fork header inside branch — no-op special
                if ($isForkHeaderNode(previousNode) || $isForkBranchNode(previousNode)) {
                    return false;
                }

                return false;
            },
            COMMAND_PRIORITY_HIGH
        );

        const removeTabFocusMove = editor.registerCommand(
            KEY_TAB_COMMAND,
            (event: KeyboardEvent) => {
                if (isDecoratorInputEvent(event)) {
                    return false;
                }

                if (event.altKey || event.ctrlKey || event.metaKey) {
                    return false;
                }

                const selection = $getSelection();
                if (!$isRangeSelection(selection)) {
                    return false;
                }

                event.preventDefault();
                if (!event.shiftKey) {
                    selection.insertText("    ");
                }
                return true;
            },
            COMMAND_PRIORITY_EDITOR
        );

        return () => {
            removeShortcut();
            removeEnterPassthrough();
            removeBackspace();
            removeTabFocusMove();
        };
    }, [editor]);

    return null;
}
