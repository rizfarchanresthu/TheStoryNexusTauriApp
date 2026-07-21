import { useEffect } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext.js";
import { $getRoot } from "lexical";

import { countWordsInText } from "../serialization/lexicalToPlainText";
import { $collectSelectedPathTextFromNode } from "../nodes/fork/selectedPathText";

type WordCountPluginProps = {
    onChange: (wordCount: number) => void;
};

export function WordCountPlugin({ onChange }: WordCountPluginProps) {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        const updateWordCount = () => {
            editor.getEditorState().read(() => {
                onChange(countWordsInText($collectSelectedPathTextFromNode($getRoot())));
            });
        };

        updateWordCount();

        return editor.registerUpdateListener(({ editorState }) => {
            editorState.read(() => {
                onChange(countWordsInText($collectSelectedPathTextFromNode($getRoot())));
            });
        });
    }, [editor, onChange]);

    return null;
}
