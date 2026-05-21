import type { LorebookEntry } from "@/types/story";

export type LorebookTagMatchMode = "content-contains-tag" | "bidirectional";

/**
 * Match lorebook entries whose tag-map keys appear in the given text.
 *
 * - `content-contains-tag`: text must contain the full tag (chapter prose).
 * - `bidirectional`: also matches when a tag contains the text (short scene-beat commands).
 */
export function matchLorebookEntriesFromTagMap(
  text: string,
  tagMap: Record<string, LorebookEntry[]>,
  mode: LorebookTagMatchMode = "content-contains-tag"
): Map<string, LorebookEntry> {
  const normalizedText = text.toLowerCase().trim();
  const matched = new Map<string, LorebookEntry>();
  if (!normalizedText) {
    return matched;
  }

  Object.entries(tagMap).forEach(([tag, entries]) => {
    const normalizedTag = tag.trim().toLowerCase();
    if (!normalizedTag) {
      return;
    }

    const tagInText = normalizedText.includes(normalizedTag);
    const textInTag = mode === "bidirectional" && normalizedTag.includes(normalizedText);
    if (!tagInText && !textInTag) {
      return;
    }

    entries.forEach((entry) => {
      matched.set(entry.id, entry);
    });
  });

  return matched;
}
