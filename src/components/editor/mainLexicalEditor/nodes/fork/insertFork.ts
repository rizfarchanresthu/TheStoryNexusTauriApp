import { $createParagraphNode, $getNodeByKey } from "lexical";

import {
    $createForkBranchNode,
    $isForkBranchNode,
} from "./ForkBranchNode";
import { $createForkGroupNode, $isForkGroupNode } from "./ForkGroupNode";
import {
    $focusFirstSelectableIn,
    $insertNodesAfterSelectionAnchor,
} from "./getBlockInsertAnchor";

function createBranchKey(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return `branch-${crypto.randomUUID()}`;
    }
    return `branch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function $insertForkBelowSelection(): string {
    const fork = $createForkGroupNode();
    const trailingParagraph = $createParagraphNode();
    $insertNodesAfterSelectionAnchor(fork, trailingParagraph);

    const activeBranch = fork.getActiveBranch();
    if (activeBranch) {
        $focusFirstSelectableIn(activeBranch);
    }

    return fork.getKey();
}

export function $addBranchToFork(forkKey: string): string | null {
    const fork = $getNodeByKey(forkKey);
    if (!$isForkGroupNode(fork)) return null;

    const branchKey = createBranchKey();
    const index = fork.getBranchNodes().length + 1;
    const title = `Path ${String.fromCharCode(64 + Math.min(index, 26))}`;
    const branch = $createForkBranchNode(branchKey, title, false);
    fork.append(branch);
    fork.setActiveBranchKey(branchKey);
    $focusFirstSelectableIn(branch);
    return branchKey;
}

export function $flattenForkGroup(forkKey: string): boolean {
    const fork = $getNodeByKey(forkKey);
    if (!$isForkGroupNode(fork)) return false;

    const active = fork.getActiveBranch();
    if (!active) {
        fork.remove();
        return true;
    }

    const children = [...active.getChildren()];
    for (const child of children) {
        fork.insertBefore(child);
    }
    fork.remove();
    return true;
}

export function $deleteBranchFromFork(
    forkKey: string,
    branchKey: string
): boolean {
    const fork = $getNodeByKey(forkKey);
    if (!$isForkGroupNode(fork)) return false;

    const branches = fork.getBranchNodes();
    if (branches.length <= 1) return false;

    const target = branches.find((branch) => branch.getBranchKey() === branchKey);
    if (!target || !$isForkBranchNode(target)) return false;

    const wasActive = fork.getActiveBranchKey() === branchKey;
    target.remove();

    if (wasActive) {
        const next = fork.getBranchNodes()[0];
        if (next) {
            fork.setActiveBranchKey(next.getBranchKey());
            $focusFirstSelectableIn(next);
        }
    }

    return true;
}
