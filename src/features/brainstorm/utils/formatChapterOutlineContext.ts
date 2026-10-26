import type { Chapter } from "@/types/story";

export function hasChapterOutline(chapter: Pick<Chapter, "outline">): boolean {
  return Boolean(chapter.outline?.content?.trim());
}

export function formatChapterOutlineContext(
  chapters: Array<Pick<Chapter, "order" | "title" | "outline">>
): string {
  const blocks = chapters
    .filter(hasChapterOutline)
    .map((chapter) =>
      `Chapter ${chapter.order} Outline (${chapter.title}):\n${chapter.outline!.content.trim()}`
    );

  if (blocks.length === 0) return "";

  return `Chapter Outlines:\n${blocks.join("\n\n")}`;
}
