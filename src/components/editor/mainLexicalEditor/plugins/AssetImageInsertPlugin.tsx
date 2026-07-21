import { useEffect } from "react";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext.js";
import { $createParagraphNode } from "lexical";

import { assetReference } from "@/features/images/services/assetStorage";

import { $createAssetImageNode } from "../nodes/AssetImageNode";
import { $insertNodesAfterSelectionAnchor } from "../nodes/fork/getBlockInsertAnchor";

export const INSERT_ASSET_IMAGE_EVENT = "story-nexus-insert-asset-image";

export function dispatchInsertAssetImage(assetId: string, altText?: string): void {
    window.dispatchEvent(new CustomEvent(INSERT_ASSET_IMAGE_EVENT, {
        detail: { assetId, altText },
    }));
}

export function AssetImageInsertPlugin(): null {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<{ assetId?: string; altText?: string }>).detail;
            if (!detail?.assetId) return;

            editor.update(() => {
                const imageNode = $createAssetImageNode({
                    src: assetReference(detail.assetId),
                    altText: detail.altText || "Story image",
                    maxWidth: 720,
                });
                const paragraphNode = $createParagraphNode();
                $insertNodesAfterSelectionAnchor(imageNode, paragraphNode);
            });
        };

        window.addEventListener(INSERT_ASSET_IMAGE_EVENT, handler);
        return () => window.removeEventListener(INSERT_ASSET_IMAGE_EVENT, handler);
    }, [editor]);

    return null;
}
