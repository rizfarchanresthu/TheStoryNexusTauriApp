import { lexicalToSelectedPathPlainText } from "../nodes/fork/selectedPathFromSerialized";

type SerializedLexicalNode = {
    type?: string;
    text?: string;
    children?: SerializedLexicalNode[];
};

/** Plain text following only the active branch at each story fork. */
export function lexicalToPlainText(content: string | SerializedLexicalNode | null | undefined): string {
    return lexicalToSelectedPathPlainText(content);
}

export function countWordsInText(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

export { lexicalToSelectedPathPlainText };
