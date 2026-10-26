import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext.js";
import { $getNodeByKey, $getRoot, type LexicalNode } from "lexical";

import { ForkChrome } from "./ForkChrome";
import { $isForkBranchNode } from "./ForkBranchNode";
import { ForkHeaderNode, $getForkDepth, $isForkHeaderNode } from "./ForkHeaderNode";
import { $isForkGroupNode } from "./ForkGroupNode";
import {
    $addBranchToFork,
    $deleteBranchFromFork,
    $flattenForkGroup,
} from "./insertFork";
import { $focusFirstSelectableIn } from "./getBlockInsertAnchor";

type HostEntry = {
    root: Root;
    host: HTMLElement;
};

function visitNodes(node: LexicalNode, visit: (node: LexicalNode) => void): void {
    visit(node);
    if ("getChildren" in node && typeof node.getChildren === "function") {
        for (const child of node.getChildren()) {
            visitNodes(child, visit);
        }
    }
}

export function ForkChromePlugin(): null {
    const [editor] = useLexicalComposerContext();
    const hostsRef = useRef(new Map<string, HostEntry>());

    useEffect(() => {
        const hosts = hostsRef.current;

        const unmountHost = (headerKey: string) => {
            const entry = hosts.get(headerKey);
            if (!entry) return;
            entry.root.unmount();
            entry.host.remove();
            hosts.delete(headerKey);
        };

        const renderAll = () => {
            editor.getEditorState().read(() => {
                const seen = new Set<string>();

                visitNodes($getRoot(), (node) => {
                    if (!$isForkHeaderNode(node)) return;

                    seen.add(node.getKey());
                    const fork = node.getParent();
                    if (!$isForkGroupNode(fork)) return;

                    const headerDom = editor.getElementByKey(node.getKey());
                    if (!headerDom) return;

                    let entry = hosts.get(node.getKey());
                    if (!entry) {
                        const host = document.createElement("div");
                        host.className = "fork-chrome-portal-host";
                        host.setAttribute("contenteditable", "false");
                        headerDom.appendChild(host);
                        entry = { root: createRoot(host), host };
                        hosts.set(node.getKey(), entry);
                    }

                    const forkKey = fork.getKey();
                    const branches = fork.getBranchNodes().map((branch) => ({
                        key: branch.getBranchKey(),
                        title: branch.getTitle(),
                        active: branch.isActiveBranch(),
                    }));

                    entry.root.render(
                        <ForkChrome
                            forkKey={forkKey}
                            depth={$getForkDepth(fork)}
                            branches={branches}
                            activeBranchKey={fork.getActiveBranchKey()}
                            onSelectBranch={(branchKey) => {
                                editor.update(() => {
                                    const current = $getNodeByKey(forkKey);
                                    if (!$isForkGroupNode(current)) return;
                                    current.setActiveBranchKey(branchKey);
                                    const active = current.getActiveBranch();
                                    if (active) {
                                        $focusFirstSelectableIn(active);
                                    }
                                });
                            }}
                            onAddBranch={() => {
                                editor.update(() => {
                                    $addBranchToFork(forkKey);
                                });
                            }}
                            onDeleteBranch={(branchKey) => {
                                editor.update(() => {
                                    $deleteBranchFromFork(forkKey, branchKey);
                                });
                            }}
                            onRenameBranch={(branchKey, title) => {
                                editor.update(() => {
                                    const current = $getNodeByKey(forkKey);
                                    if (!$isForkGroupNode(current)) return;
                                    const branch = current
                                        .getBranchNodes()
                                        .find((item) => item.getBranchKey() === branchKey);
                                    if ($isForkBranchNode(branch)) {
                                        branch.setTitle(title);
                                    }
                                });
                            }}
                            onFlattenFork={() => {
                                editor.update(() => {
                                    $flattenForkGroup(forkKey);
                                });
                            }}
                        />
                    );
                });

                for (const key of [...hosts.keys()]) {
                    if (!seen.has(key)) {
                        unmountHost(key);
                    }
                }
            });
        };

        renderAll();
        const removeUpdateListener = editor.registerUpdateListener(() => {
            renderAll();
        });
        const removeMutationListener = editor.registerMutationListener(
            ForkHeaderNode,
            (mutatedNodes) => {
                for (const [nodeKey, mutation] of mutatedNodes) {
                    if (mutation === "destroyed") {
                        unmountHost(nodeKey);
                    }
                }
                renderAll();
            }
        );

        return () => {
            removeUpdateListener();
            removeMutationListener();
            for (const key of [...hosts.keys()]) {
                unmountHost(key);
            }
        };
    }, [editor]);

    return null;
}
