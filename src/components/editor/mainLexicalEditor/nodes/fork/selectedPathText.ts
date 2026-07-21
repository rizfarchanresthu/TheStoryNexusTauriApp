import {
    $getRoot,
    $isElementNode,
    $isTextNode,
    type LexicalNode,
    type RangeSelection,
} from "lexical";

import { $isSceneBeatNode } from "../SceneBeatNode";
import { $isForkBranchNode } from "./ForkBranchNode";
import { $isForkGroupNode } from "./ForkGroupNode";
import { $isForkHeaderNode } from "./ForkHeaderNode";

function shouldSkipNode(node: LexicalNode): boolean {
    return (
        $isSceneBeatNode(node) ||
        $isForkHeaderNode(node) ||
        node.getType() === "image-generation" ||
        node.getType() === "asset-image"
    );
}

function appendBlockBreak(node: LexicalNode, textParts: string[]): void {
    const type = node.getType();
    if (type === "paragraph" || type === "heading" || type === "listitem" || type === "quote") {
        textParts.push("\n");
    }
}

/**
 * Children of a fork-group in document order, skipping the header decorator.
 * For inactive branches the walker never enters them.
 */
function getWalkableChildren(node: LexicalNode): LexicalNode[] {
    if ($isForkGroupNode(node)) {
        const active = node.getActiveBranch();
        return active ? [active] : [];
    }

    if (!$isElementNode(node)) {
        return [];
    }

    return node.getChildren().filter((child) => !shouldSkipNode(child));
}

export function $collectSelectedPathTextFromNode(node: LexicalNode): string {
    const textParts: string[] = [];

    const walk = (current: LexicalNode) => {
        if (shouldSkipNode(current)) return;

        if ($isTextNode(current)) {
            textParts.push(current.getTextContent());
            return;
        }

        if ($isForkGroupNode(current)) {
            const active = current.getActiveBranch();
            if (active) walk(active);
            return;
        }

        if ($isElementNode(current)) {
            for (const child of getWalkableChildren(current)) {
                walk(child);
            }
            appendBlockBreak(current, textParts);
        }
    };

    walk(node);
    return textParts.join("");
}

/**
 * Collect selected-path prose before an anchor node (e.g. a SceneBeat).
 * Climbs out of nested forks so prior siblings of ancestor forks are included.
 */
export function $collectSelectedPathTextBeforeNode(anchor: LexicalNode): string {
    const textParts: string[] = [];
    let reachedAnchor = false;

    const traverse = (node: LexicalNode): boolean => {
        if (reachedAnchor) return true;
        if (node.is(anchor)) {
            reachedAnchor = true;
            return true;
        }
        if (shouldSkipNode(node)) return false;

        if ($isTextNode(node)) {
            textParts.push(node.getTextContent());
            return false;
        }

        if ($isForkGroupNode(node)) {
            const active = node.getActiveBranch();
            if (active && traverse(active)) return true;
            return false;
        }

        if ($isElementNode(node)) {
            for (const child of node.getChildren()) {
                if (shouldSkipNode(child)) {
                    if (child.is(anchor)) {
                        reachedAnchor = true;
                        return true;
                    }
                    continue;
                }
                if (traverse(child)) return true;
            }
            if (!reachedAnchor) {
                appendBlockBreak(node, textParts);
            }
        }

        return false;
    };

    traverse($getRoot());
    return textParts.join("");
}

export function $collectSelectedPathTextBeforeSelection(
    selection: RangeSelection
): string {
    const anchorNode = selection.anchor.getNode();
    const anchorOffset = selection.anchor.offset;
    const textParts: string[] = [];
    let reachedAnchor = false;

    const traverse = (node: LexicalNode): boolean => {
        if (reachedAnchor) return true;
        if (shouldSkipNode(node)) return false;

        if (node.is(anchorNode)) {
            if ($isTextNode(node)) {
                textParts.push(node.getTextContent().substring(0, anchorOffset));
            } else if ($isElementNode(node)) {
                for (const child of node.getChildren().slice(0, anchorOffset)) {
                    if (!shouldSkipNode(child)) {
                        textParts.push($collectSelectedPathTextFromNode(child));
                    }
                }
            }
            reachedAnchor = true;
            return true;
        }

        if ($isTextNode(node)) {
            textParts.push(node.getTextContent());
            return false;
        }

        if ($isForkGroupNode(node)) {
            const active = node.getActiveBranch();
            if (active && traverse(active)) return true;
            return false;
        }

        if ($isElementNode(node)) {
            for (const child of node.getChildren()) {
                if (traverse(child)) return true;
            }
        }

        return false;
    };

    traverse($getRoot());
    return textParts.join("");
}

export function $collectSelectedPathTextAfterSelection(
    selection: RangeSelection
): string {
    const anchorNode = selection.anchor.getNode();
    const anchorOffset = selection.anchor.offset;
    const textParts: string[] = [];
    let reachedAnchor = false;

    const traverse = (node: LexicalNode): void => {
        if (shouldSkipNode(node)) return;

        if (node.is(anchorNode)) {
            if ($isTextNode(node)) {
                textParts.push(node.getTextContent().substring(anchorOffset));
            } else if ($isElementNode(node)) {
                for (const child of node.getChildren().slice(anchorOffset)) {
                    if (!shouldSkipNode(child)) {
                        textParts.push($collectSelectedPathTextFromNode(child));
                    }
                }
            }
            reachedAnchor = true;
            return;
        }

        if (reachedAnchor) {
            textParts.push($collectSelectedPathTextFromNode(node));
            return;
        }

        if ($isForkGroupNode(node)) {
            const active = node.getActiveBranch();
            if (active) traverse(active);
            return;
        }

        if ($isElementNode(node)) {
            for (const child of node.getChildren()) {
                traverse(child);
            }
        }
    };

    traverse($getRoot());
    return textParts.join("");
}

export function $isInsideInactiveForkBranch(node: LexicalNode): boolean {
    let current: LexicalNode | null = node;
    while (current) {
        if ($isForkBranchNode(current) && !current.isActiveBranch()) {
            return true;
        }
        current = current.getParent();
    }
    return false;
}
