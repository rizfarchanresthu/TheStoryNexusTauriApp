import {
    $applyNodeReplacement,
    $createParagraphNode,
    ElementNode,
    type EditorConfig,
    type LexicalNode,
    type NodeKey,
} from "lexical";

import type { SerializedForkBranchNode } from "./types";

export class ForkBranchNode extends ElementNode {
    __branchKey: string;
    __title: string;
    __active: boolean;

    constructor(
        branchKey: string,
        title = "Path",
        active = false,
        key?: NodeKey
    ) {
        super(key);
        this.__branchKey = branchKey;
        this.__title = title;
        this.__active = active;
    }

    static getType(): string {
        return "fork-branch";
    }

    static clone(node: ForkBranchNode): ForkBranchNode {
        return new ForkBranchNode(
            node.__branchKey,
            node.__title,
            node.__active,
            node.__key
        );
    }

    static importJSON(serializedNode: SerializedForkBranchNode): ForkBranchNode {
        return $applyNodeReplacement(
            new ForkBranchNode(
                serializedNode.branchKey,
                serializedNode.title,
                serializedNode.active
            )
        );
    }

    exportJSON(): SerializedForkBranchNode {
        return {
            ...super.exportJSON(),
            type: "fork-branch",
            version: 1,
            branchKey: this.__branchKey,
            title: this.__title,
            active: this.__active,
        };
    }

    createDOM(_config: EditorConfig): HTMLElement {
        const dom = document.createElement("div");
        dom.className = "fork-branch-node";
        dom.setAttribute("data-testid", "fork-branch");
        dom.setAttribute("data-branch-key", this.__branchKey);
        dom.setAttribute("data-active", this.__active ? "true" : "false");
        if (!this.__active) {
            dom.hidden = true;
        }
        return dom;
    }

    updateDOM(prevNode: ForkBranchNode, dom: HTMLElement): boolean {
        if (prevNode.__branchKey !== this.__branchKey) {
            dom.setAttribute("data-branch-key", this.__branchKey);
        }
        if (prevNode.__active !== this.__active) {
            dom.setAttribute("data-active", this.__active ? "true" : "false");
            dom.hidden = !this.__active;
        }
        return false;
    }

    getBranchKey(): string {
        return this.__branchKey;
    }

    getTitle(): string {
        return this.__title;
    }

    setTitle(title: string): void {
        const writable = this.getWritable();
        writable.__title = title;
    }

    isActiveBranch(): boolean {
        return this.__active;
    }

    setActive(active: boolean): void {
        const writable = this.getWritable();
        writable.__active = active;
    }

    canBeEmpty(): boolean {
        return false;
    }

    isInline(): false {
        return false;
    }

    canInsertTextBefore(): boolean {
        return false;
    }

    canInsertTextAfter(): boolean {
        return false;
    }
}

export function $createForkBranchNode(
    branchKey: string,
    title = "Path",
    active = false
): ForkBranchNode {
    const branch = new ForkBranchNode(branchKey, title, active);
    branch.append($createParagraphNode());
    return $applyNodeReplacement(branch);
}

export function $isForkBranchNode(
    node: LexicalNode | null | undefined
): node is ForkBranchNode {
    return node instanceof ForkBranchNode;
}
