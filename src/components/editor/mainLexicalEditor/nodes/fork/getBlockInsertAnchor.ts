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
 * Nearest block (or decorator) whose parent is the root or a fork branch.
 * Used so inserts land inside the active branch when the caret is nested.
 */
export function $getBlockInsertAnchor(
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
