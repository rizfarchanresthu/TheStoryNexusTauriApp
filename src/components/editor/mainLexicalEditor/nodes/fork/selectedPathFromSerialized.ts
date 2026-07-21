type SerializedLexicalNode = {
    type?: string;
    text?: string;
    activeBranchKey?: string;
    branchKey?: string;
    active?: boolean;
    children?: SerializedLexicalNode[];
};

const BLOCK_TYPES = new Set([
    "paragraph",
    "heading",
    "quote",
    "listitem",
    "linebreak",
]);

const SKIP_TYPES = new Set([
    "scene-beat",
    "fork-header",
    "image-generation",
    "asset-image",
]);

function appendNodeTextSelectedPath(
    node: SerializedLexicalNode,
    chunks: string[]
): void {
    if (node.type && SKIP_TYPES.has(node.type)) {
        return;
    }

    if (node.type === "text" && typeof node.text === "string") {
        chunks.push(node.text);
        return;
    }

    if (node.type === "fork-group") {
        const activeKey = node.activeBranchKey;
        const branches = (node.children || []).filter(
            (child) => child.type === "fork-branch"
        );
        const active =
            branches.find((branch) => branch.branchKey === activeKey) ||
            branches.find((branch) => branch.active) ||
            branches[0];
        if (active) {
            appendNodeTextSelectedPath(active, chunks);
        }
        return;
    }

    if (node.children) {
        for (const child of node.children) {
            appendNodeTextSelectedPath(child, chunks);
        }
    }

    if (node.type && BLOCK_TYPES.has(node.type)) {
        chunks.push("\n");
    }
}

/**
 * Lexical JSON → plain text following only the active branch at each fork.
 */
export function lexicalToSelectedPathPlainText(
    content: string | SerializedLexicalNode | { root?: SerializedLexicalNode } | null | undefined
): string {
    if (!content) return "";

    try {
        const state = typeof content === "string" ? JSON.parse(content) : content;
        const chunks: string[] = [];

        if (state.root?.children) {
            for (const child of state.root.children) {
                appendNodeTextSelectedPath(child, chunks);
            }
        } else {
            appendNodeTextSelectedPath(state as SerializedLexicalNode, chunks);
        }

        return chunks
            .join("")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    } catch (error) {
        console.error(
            "lexicalToSelectedPathPlainText - Failed to parse editor content:",
            error
        );
        return "";
    }
}
