import { useEffect } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext.js";

import { countWordsInText, lexicalToPlainText } from "../serialization/lexicalToPlainText";

type WordCountPluginProps = {
    onChange: (wordCount: number) => void;
};

export function WordCountPlugin({ onChange }: WordCountPluginProps) {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        const updateWordCount = () => {
            onChange(countWordsInText(lexicalToPlainText(editor.getEditorState().toJSON())));
        };

        updateWordCount();

        return editor.registerUpdateListener(({ editorState }) => {
            onChange(countWordsInText(lexicalToPlainText(editorState.toJSON())));
        });
    }, [editor, onChange]);

    return null;
}
