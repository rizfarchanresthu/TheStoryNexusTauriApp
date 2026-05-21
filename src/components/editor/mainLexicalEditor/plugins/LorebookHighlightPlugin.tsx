import { useEffect } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import debounce from "lodash/debounce";
import { $getRoot } from "lexical";

import { useLorebookStore } from "@/features/lorebook/stores/useLorebookStore";
import { matchLorebookEntriesFromTagMap } from "@/features/lorebook/utils/matchLorebookEntries";

export function LorebookHighlightPlugin(): null {
    const [editor] = useLexicalComposerContext();
    const {
        tagMap,
        setChapterMatchedEntries,
        setEditorContent,
    } = useLorebookStore();

    useEffect(() => {
        setChapterMatchedEntries(new Map());

        const updateMatches = debounce(() => {
            editor.getEditorState().read(() => {
                const content = $getRoot().getTextContent();
                const matchedEntries = matchLorebookEntriesFromTagMap(content, tagMap);

                setEditorContent(content);
                setChapterMatchedEntries(matchedEntries);
            });
        }, 500);

        const removeListener = editor.registerTextContentListener(updateMatches);
        updateMatches();

        return () => {
            removeListener();
            updateMatches.cancel();
            setEditorContent("");
            setChapterMatchedEntries(new Map());
        };
    }, [editor, setChapterMatchedEntries, setEditorContent, tagMap]);

    return null;
}
