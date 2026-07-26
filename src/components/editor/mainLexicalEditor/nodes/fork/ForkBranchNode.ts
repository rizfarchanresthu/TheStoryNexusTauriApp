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
        this.applyActiveDomState(dom, this.__active);
        return dom;
    }

    updateDOM(prevNode: ForkBranchNode, dom: HTMLElement): boolean {
        if (prevNode.__branchKey !== this.__branchKey) {
            dom.setAttribute("data-branch-key", this.__branchKey);
        }
        if (prevNode.__active !== this.__active) {
            this.applyActiveDomState(dom, this.__active);
        }
        return false;
    }

    private applyActiveDomState(dom: HTMLElement, active: boolean): void {
        dom.setAttribute("data-active", active ? "true" : "false");
        dom.hidden = !active;
        // Prevent focus/selection from landing in a visually hidden path.
        if (active) {
            dom.removeAttribute("inert");
        } else {
            dom.setAttribute("inert", "");
        }
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

    /**
     * Isolate each path so backspace/delete cannot merge Path B into Path A
     * (or vice versa). Same pattern as Lexical table cells.
     */
    isShadowRoot(): boolean {
        return true;
    }

    /** Keep the branch container when backspacing at the start of its first block. */
    collapseAtStart(): boolean {
        return true;
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
