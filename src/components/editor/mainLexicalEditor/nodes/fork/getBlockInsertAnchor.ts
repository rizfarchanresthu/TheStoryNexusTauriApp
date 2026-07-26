import {
    $getRoot,
    $getSelection,
    $isDecoratorNode,
    $isElementNode,
    $isRangeSelection,
    $isRootNode,
    type ElementNode,
    type LexicalNode,
} from "lexical";

import { $isForkBranchNode, type ForkBranchNode } from "./ForkBranchNode";
import { $isForkGroupNode, type ForkGroupNode } from "./ForkGroupNode";

/**
 * If the caret sits inside an inactive fork path, move the reference onto
 * that fork's active path so inserts/edits never target a hidden branch.
 */
export function $resolveActivePathNode(
    fromNode?: LexicalNode | null
): LexicalNode | null {
    let current: LexicalNode | null = fromNode ?? null;

    if (!current) {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
            current = selection.focus.getNode();
        }
    }

    if (!current || current.getKey() === "root") {
        return null;
    }

    let node: LexicalNode | null = current;
    while (node) {
        if ($isForkBranchNode(node) && !node.isActiveBranch()) {
            const fork = node.getParent();
            if ($isForkGroupNode(fork)) {
                const active = fork.getActiveBranch();
                if (active) {
                    return active.getLastChild() ?? active;
                }
            }
        }
        node = node.getParent();
    }

    return current;
}

/**
 * Nearest block (or decorator) whose parent is the root or a fork branch.
 * Used so inserts land inside the active branch when the caret is nested.
 */
export function $getBlockInsertAnchor(
    fromNode?: LexicalNode | null
): LexicalNode | null {
    let current: LexicalNode | null = $resolveActivePathNode(fromNode);

    if (!current || current.getKey() === "root") {
        return null;
    }

    while (current) {
        const parent = current.getParent();
        if (!parent) {
            return null;
        }

        if ($isRootNode(parent) || $isForkBranchNode(parent)) {
            if ($isElementNode(current) || $isDecoratorNode(current)) {
                return current;
            }
        }

        current = parent;
    }

    return null;
}

export function $insertNodesAfterSelectionAnchor(
    ...nodes: LexicalNode[]
): LexicalNode | null {
    if (nodes.length === 0) return null;

    // Ensure Lexical selection is not stuck inside a hidden inactive path.
    $ensureSelectionOutsideInactiveForkBranches();

    const selection = $getSelection();
    const focusNode = $isRangeSelection(selection)
        ? selection.focus.getNode()
        : null;
    const anchor = $getBlockInsertAnchor(focusNode);

    if (anchor) {
        let previous: LexicalNode = anchor;
        for (const node of nodes) {
            previous.insertAfter(node);
            previous = node;
        }
        return nodes[0] ?? null;
    }

    $getRoot().append(...nodes);
    return nodes[0] ?? null;
}

/**
 * If selection is inside any inactive fork-branch, move it into that fork's
 * active branch. Returns true when selection was moved.
 */
export function $ensureSelectionOutsideInactiveForkBranches(): boolean {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
        return false;
    }

    const focusNode = selection.focus.getNode();
    let current: LexicalNode | null = focusNode;
    while (current) {
        if ($isForkBranchNode(current) && !current.isActiveBranch()) {
            const fork = current.getParent();
            if ($isForkGroupNode(fork)) {
                const active = fork.getActiveBranch();
                if (active) {
                    $focusFirstSelectableIn(active);
                    return true;
                }
            }
            return false;
        }
        current = current.getParent();
    }

    return false;
}

export function $getNearestForkGroup(
    node: LexicalNode | null | undefined
): ForkGroupNode | null {
    let current: LexicalNode | null = node ?? null;
    while (current) {
        if ($isForkGroupNode(current)) {
            return current;
        }
        current = current.getParent();
    }
    return null;
}

export function $getNearestForkBranch(
    node: LexicalNode | null | undefined
): ForkBranchNode | null {
    let current: LexicalNode | null = node ?? null;
    while (current) {
        if ($isForkBranchNode(current)) {
            return current;
        }
        current = current.getParent();
    }
    return null;
}

export function $focusFirstSelectableIn(container: ElementNode): void {
    const first = container.getFirstDescendant();
    if (first) {
        first.selectStart();
        return;
    }
    container.selectStart();
}
