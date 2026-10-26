import {
    $applyNodeReplacement,
    $isRootNode,
    DecoratorNode,
    type EditorConfig,
    type LexicalNode,
    type NodeKey,
} from "lexical";

import type { SerializedForkHeaderNode } from "./types";

export class ForkHeaderNode extends DecoratorNode<null> {
    static getType(): string {
        return "fork-header";
    }

    static clone(node: ForkHeaderNode): ForkHeaderNode {
        return new ForkHeaderNode(node.__key);
    }

    static importJSON(_serializedNode: SerializedForkHeaderNode): ForkHeaderNode {
        return $createForkHeaderNode();
    }

    exportJSON(): SerializedForkHeaderNode {
        return {
            type: "fork-header",
            version: 1,
        };
    }

    createDOM(_config: EditorConfig): HTMLElement {
        const dom = document.createElement("div");
        dom.className = "fork-header-node";
        dom.setAttribute("data-testid", "fork-header");
        dom.setAttribute("contenteditable", "false");
        return dom;
    }

    updateDOM(): boolean {
        return false;
    }

    isInline(): false {
        return false;
    }

    isKeyboardSelectable(): boolean {
        return false;
    }

    decorate(): null {
        // Chrome is rendered by ForkChromePlugin into this DOM host.
        return null;
    }
}

export function $createForkHeaderNode(): ForkHeaderNode {
    return $applyNodeReplacement(new ForkHeaderNode());
}

export function $isForkHeaderNode(
    node: LexicalNode | null | undefined
): node is ForkHeaderNode {
    return node instanceof ForkHeaderNode;
}

export function $getForkDepth(node: LexicalNode): number {
    let depth = 0;
    let current: LexicalNode | null = node.getParent();
    while (current && !$isRootNode(current)) {
        if (current.getType() === "fork-group") {
            depth += 1;
        }
        current = current.getParent();
    }
    return depth;
}
