export interface ThinkingSplit {
    thinkingText: string;
    proseText: string;
}

export interface ThinkingStreamFilter {
    push(text: string): string;
    flush(): string;
}

const OPEN_THINK_TAG = "<think>";
const CLOSE_THINK_TAG = "</think>";

export function splitThinkingContent(raw: string): ThinkingSplit {
    const thinkParts: string[] = [];
    let prose = raw.replace(/<think>([\s\S]*?)<\/think>/gi, (_match, content: string) => {
        thinkParts.push(content.trim());
        return "";
    });

    const openThinkIndex = prose.search(/<think>/i);
    if (openThinkIndex !== -1) {
        thinkParts.push(prose.slice(openThinkIndex + "<think>".length).trim());
        prose = prose.slice(0, openThinkIndex);
    }

    if (thinkParts.length === 0) {
        const closeThinkIndex = prose.search(/<\/think>/i);
        if (closeThinkIndex !== -1) {
            thinkParts.push(prose.slice(0, closeThinkIndex).trim());
            prose = prose.slice(closeThinkIndex + "</think>".length);
        }
    }

    return {
        thinkingText: thinkParts.filter(Boolean).join("\n\n").trim(),
        proseText: prose.trimStart(),
    };
}

export function createThinkingStreamFilter(): ThinkingStreamFilter {
    let pending = "";
    let isThinking = false;

    const consumeVisible = (): string => {
        let output = "";

        while (pending) {
            if (isThinking) {
                const closeIndex = pending.toLowerCase().indexOf(CLOSE_THINK_TAG);
                if (closeIndex === -1) {
                    pending = keepPossibleTagPrefix(pending, [CLOSE_THINK_TAG]);
                    break;
                }

                pending = pending.slice(closeIndex + CLOSE_THINK_TAG.length);
                isThinking = false;
                continue;
            }

            const openIndex = pending.toLowerCase().indexOf(OPEN_THINK_TAG);
            if (openIndex === -1) {
                const keepLength = possibleTagPrefixLength(pending, [OPEN_THINK_TAG]);
                const emitLength = pending.length - keepLength;
                output += pending.slice(0, emitLength);
                pending = pending.slice(emitLength);
                break;
            }

            output += pending.slice(0, openIndex);
            pending = pending.slice(openIndex + OPEN_THINK_TAG.length);
            isThinking = true;
        }

        return output;
    };

    return {
        push(text: string): string {
            pending += text;
            return consumeVisible();
        },
        flush(): string {
            if (isThinking) {
                pending = "";
                isThinking = false;
                return "";
            }

            const output = pending;
            pending = "";
            return output;
        },
    };
}

function keepPossibleTagPrefix(text: string, tags: string[]): string {
    const keepLength = possibleTagPrefixLength(text, tags);
    return keepLength > 0 ? text.slice(-keepLength) : "";
}

function possibleTagPrefixLength(text: string, tags: string[]): number {
    const lowerText = text.toLowerCase();
    let bestLength = 0;

    for (const tag of tags) {
        for (let length = 1; length < tag.length; length++) {
            if (lowerText.endsWith(tag.slice(0, length))) {
                bestLength = Math.max(bestLength, length);
            }
        }
    }

    return bestLength;
}
