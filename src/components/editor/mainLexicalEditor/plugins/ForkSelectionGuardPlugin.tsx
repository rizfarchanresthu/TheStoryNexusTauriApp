import { useEffect } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext.js";
import {
    $getSelection,
    $isElementNode,
    $isRangeSelection,
    $isTextNode,
    COMMAND_PRIORITY_HIGH,
    KEY_BACKSPACE_COMMAND,
    KEY_DELETE_COMMAND,
    SELECTION_CHANGE_COMMAND,
} from "lexical";

import { $isForkBranchNode } from "../nodes/fork/ForkBranchNode";
import { $ensureSelectionOutsideInactiveForkBranches } from "../nodes/fork/getBlockInsertAnchor";

function $selectionIsInsideInactiveForkBranch(): boolean {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return false;

    let current = selection.focus.getNode();
    while (current) {
        if ($isForkBranchNode(current) && !current.isActiveBranch()) {
            return true;
        }
        current = current.getParent();
    }
    return false;
}

function $getEnclosingForkBranch() {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return null;

    let current = selection.anchor.getNode();
    while (current) {
        if ($isForkBranchNode(current)) {
            return current;
        }
        current = current.getParent();
    }
    return null;
}

/** True when the collapsed caret is at the very start of a fork branch. */
function $isCaretAtBranchStart(): boolean {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        return false;
    }

    const branch = $getEnclosingForkBranch();
    if (!branch) return false;

    let current = selection.anchor.getNode();
    let offset = selection.anchor.offset;

    while (current && current !== branch) {
        if (offset !== 0) return false;
        const parent = current.getParent();
        if (!parent) return false;
        if (parent.getFirstChild() !== current) return false;
        offset = current.getIndexWithinParent();
        current = parent;
    }

    return current === branch;
}

/** True when the collapsed caret is at the very end of a fork branch. */
function $isCaretAtBranchEnd(): boolean {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        return false;
    }

    const branch = $getEnclosingForkBranch();
    if (!branch) return false;

    let current = selection.anchor.getNode();
    let offset = selection.anchor.offset;

    while (current && current !== branch) {
        let size = 0;
        if ($isTextNode(current)) {
            size = current.getTextContentSize();
        } else if ($isElementNode(current)) {
            size = current.getChildrenSize();
        } else {
            // Decorator / other leaf: treat as a single unit for "at end" checks.
            size = selection.anchor.type === "element" ? 0 : 0;
        }

        if (offset !== size) return false;
        const parent = current.getParent();
        if (!parent) return false;
        if (parent.getLastChild() !== current) return false;
        offset = current.getIndexWithinParent() + 1;
        current = parent;
    }

    return current === branch;
}

/**
 * Keeps the caret out of inactive (hidden) fork paths and blocks
 * backspace/delete at branch edges so sibling paths cannot merge.
 */
export function ForkSelectionGuardPlugin(): null {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        const relocateIfNeeded = () => {
            editor.update(() => {
                $ensureSelectionOutsideInactiveForkBranches();
            });
        };

        const removeSelectionListener = editor.registerCommand(
            SELECTION_CHANGE_COMMAND,
            () => {
                let needsMove = false;
                editor.getEditorState().read(() => {
                    needsMove = $selectionIsInsideInactiveForkBranch();
                });
                if (needsMove) {
                    relocateIfNeeded();
                }
                return false;
            },
            COMMAND_PRIORITY_HIGH
        );

        const removeUpdateListener = editor.registerUpdateListener(
            ({ editorState }) => {
                editorState.read(() => {
                    if ($selectionIsInsideInactiveForkBranch()) {
                        queueMicrotask(relocateIfNeeded);
                    }
                });
            }
        );

        const removeBackspace = editor.registerCommand(
            KEY_BACKSPACE_COMMAND,
            (event) => {
                let block = false;
                editor.getEditorState().read(() => {
                    block = $isCaretAtBranchStart();
                });
                if (block) {
                    event.preventDefault();
                    return true;
                }

                // Also relocate if somehow still in an inactive path.
                let moved = false;
                editor.update(() => {
                    moved = $ensureSelectionOutsideInactiveForkBranches();
                });
                return moved;
            },
            COMMAND_PRIORITY_HIGH
        );

        const removeDelete = editor.registerCommand(
            KEY_DELETE_COMMAND,
            (event) => {
                let block = false;
                editor.getEditorState().read(() => {
                    block = $isCaretAtBranchEnd();
                });
                if (block) {
                    event.preventDefault();
                    return true;
                }
                return false;
            },
            COMMAND_PRIORITY_HIGH
        );

        return () => {
            removeSelectionListener();
            removeUpdateListener();
            removeBackspace();
            removeDelete();
        };
    }, [editor]);

    return null;
}
