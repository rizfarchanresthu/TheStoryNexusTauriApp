import {
    $applyNodeReplacement,
    ElementNode,
    type EditorConfig,
    type LexicalNode,
    type NodeKey,
} from "lexical";

import { $createForkBranchNode, $isForkBranchNode, type ForkBranchNode } from "./ForkBranchNode";
import { $createForkHeaderNode, $isForkHeaderNode } from "./ForkHeaderNode";
import type { SerializedForkGroupNode } from "./types";

function createId(prefix: string): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class ForkGroupNode extends ElementNode {
    __forkId: string;
    __activeBranchKey: string;
    __label: string;

    constructor(
        forkId: string,
        activeBranchKey: string,
        label = "",
        key?: NodeKey
    ) {
        super(key);
        this.__forkId = forkId;
        this.__activeBranchKey = activeBranchKey;
        this.__label = label;
    }

    static getType(): string {
        return "fork-group";
    }

    static clone(node: ForkGroupNode): ForkGroupNode {
        return new ForkGroupNode(
            node.__forkId,
            node.__activeBranchKey,
            node.__label,
            node.__key
        );
    }

    static importJSON(serializedNode: SerializedForkGroupNode): ForkGroupNode {
        return $applyNodeReplacement(
            new ForkGroupNode(
                serializedNode.forkId,
                serializedNode.activeBranchKey,
                serializedNode.label || ""
            )
        );
    }

    exportJSON(): SerializedForkGroupNode {
        return {
            ...super.exportJSON(),
            type: "fork-group",
            version: 1,
            forkId: this.__forkId,
            activeBranchKey: this.__activeBranchKey,
            label: this.__label || undefined,
        };
    }

    createDOM(_config: EditorConfig): HTMLElement {
        const dom = document.createElement("div");
        dom.className = "fork-group-node";
        dom.setAttribute("data-testid", "fork-group");
        dom.setAttribute("data-fork-id", this.__forkId);
        dom.setAttribute("data-active-branch", this.__activeBranchKey);
        if (this.__label) {
            dom.setAttribute("data-fork-label", this.__label);
        }
        return dom;
    }

    updateDOM(prevNode: ForkGroupNode, dom: HTMLElement): boolean {
        if (prevNode.__activeBranchKey !== this.__activeBranchKey) {
            dom.setAttribute("data-active-branch", this.__activeBranchKey);
        }
        if (prevNode.__forkId !== this.__forkId) {
            dom.setAttribute("data-fork-id", this.__forkId);
        }
        if (prevNode.__label !== this.__label) {
            if (this.__label) {
                dom.setAttribute("data-fork-label", this.__label);
            } else {
                dom.removeAttribute("data-fork-label");
            }
        }
        return false;
    }

    getForkId(): string {
        return this.__forkId;
    }

    getActiveBranchKey(): string {
        return this.__activeBranchKey;
    }

    getLabel(): string {
        return this.__label;
    }

    setLabel(label: string): void {
        const writable = this.getWritable();
        writable.__label = label;
    }

    getBranchNodes(): ForkBranchNode[] {
        return this.getChildren().filter($isForkBranchNode);
    }

    getActiveBranch(): ForkBranchNode | null {
        return (
            this.getBranchNodes().find(
                (branch) => branch.getBranchKey() === this.__activeBranchKey
            ) ?? null
        );
    }

    setActiveBranchKey(branchKey: string): void {
        const writable = this.getWritable();
        writable.__activeBranchKey = branchKey;
        for (const branch of this.getBranchNodes()) {
            branch.setActive(branch.getBranchKey() === branchKey);
        }
    }

    canBeEmpty(): boolean {
        return false;
    }

    isInline(): false {
        return false;
    }

    /** Keep fork boundaries from merging with surrounding chapter blocks. */
    isShadowRoot(): boolean {
        return true;
    }

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

export type CreateForkGroupOptions = {
    forkId?: string;
    activeBranchKey?: string;
    label?: string;
    withDefaultBranches?: boolean;
};

export function $createForkGroupNode(
    options: CreateForkGroupOptions = {}
): ForkGroupNode {
    const branchAKey = createId("branch");
    const fork = new ForkGroupNode(
        options.forkId || createId("fork"),
        branchAKey,
        options.label || ""
    );

    if (options.withDefaultBranches !== false) {
        fork.append($createForkHeaderNode());
        fork.append($createForkBranchNode(branchAKey, "Path A", true));
    }

    return $applyNodeReplacement(fork);
}

export function $isForkGroupNode(
    node: LexicalNode | null | undefined
): node is ForkGroupNode {
    return node instanceof ForkGroupNode;
}

export function $ensureForkHeader(fork: ForkGroupNode): void {
    const first = fork.getFirstChild();
    if (!$isForkHeaderNode(first)) {
        fork.splice(0, 0, [$createForkHeaderNode()]);
    }
}
