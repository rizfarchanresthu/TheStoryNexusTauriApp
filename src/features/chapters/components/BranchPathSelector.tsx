import { useEffect, useState } from "react";
import { Chapter } from "@/types/story";
import { useChapterStore } from "../stores/useChapterStore";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GitBranch } from "lucide-react";

interface BranchPathSelectorProps {
  chapter: Chapter;
  storyId: string;
}

interface BranchNode {
  parent: Chapter;
  branches: Chapter[];
}

export function BranchPathSelector({ chapter, storyId }: BranchPathSelectorProps) {
  const [topLevelGroups, setTopLevelGroups] = useState<BranchNode[]>([]);
  const [branchesByParent, setBranchesByParent] = useState<Map<string, Chapter[]>>(new Map());
  const chapters = useChapterStore((state) => state.chapters);
  const updateActiveBranchPath = useChapterStore((state) => state.updateActiveBranchPath);

  useEffect(() => {
    const byParent = new Map<string, Chapter[]>();
    for (const ch of chapters) {
      if (ch.parentChapterId) {
        const existing = byParent.get(ch.parentChapterId) || [];
        existing.push(ch);
        byParent.set(ch.parentChapterId, existing);
      }
    }
    for (const [key, branches] of byParent) {
      byParent.set(key, branches.sort((a, b) => (a.branchOrder ?? 0) - (b.branchOrder ?? 0)));
    }
    setBranchesByParent(byParent);

    // Top-level: main chapters before the current one that have branches
    const mainWithBranches = chapters
      .filter((ch) => !ch.parentChapterId && ch.id !== chapter.id && ch.order < chapter.order)
      .sort((a, b) => a.order - b.order)
      .filter((ch) => byParent.has(ch.id))
      .map((parent) => ({ parent, branches: byParent.get(parent.id)! }));

    setTopLevelGroups(mainWithBranches);
  }, [chapters, chapter.id, chapter.order]);

  if (topLevelGroups.length === 0) return null;

  const activePath = chapter.activeBranchPath || {};

  const handleToggle = async (parentId: string, branchId: string, checked: boolean) => {
    const current = activePath[parentId] || [];
    const updated = checked
      ? [...current, branchId]
      : current.filter((id) => id !== branchId);

    try {
      await updateActiveBranchPath(chapter.id, parentId, updated);
    } catch (error) {
      console.error("Failed to update branch path:", error);
    }
  };

  return (
    <div className="pt-3 border-t space-y-3">
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Branch Context</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Toggle which branches to include in the AI context (past N words) for this chapter.
      </p>
      <div className="space-y-3">
        {topLevelGroups.map(({ parent, branches }) => (
          <BranchGroupRenderer
            key={parent.id}
            parent={parent}
            branches={branches}
            activePath={activePath}
            branchesByParent={branchesByParent}
            chapterId={chapter.id}
            onToggle={handleToggle}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}

function BranchGroupRenderer({
  parent,
  branches,
  activePath,
  branchesByParent,
  chapterId,
  onToggle,
  depth,
}: {
  parent: Chapter;
  branches: Chapter[];
  activePath: Record<string, string[]>;
  branchesByParent: Map<string, Chapter[]>;
  chapterId: string;
  onToggle: (parentId: string, branchId: string, checked: boolean) => void;
  depth: number;
}) {
  const selectedIds = activePath[parent.id] || [];
  const parentLabel = parent.parentChapterId
    ? `Branch ${parent.branchLabel}: ${parent.title}`
    : `Ch. ${parent.order}: ${parent.title}`;

  return (
    <div className="space-y-1.5" style={{ paddingLeft: depth * 12 }}>
      <span className="text-xs font-medium text-muted-foreground">
        {parentLabel}
      </span>
      <div className="flex flex-col gap-1.5 pl-2">
        {branches.map((branch) => {
          const isSelected = selectedIds.includes(branch.id);
          const subBranches = branchesByParent.get(branch.id);
          return (
            <div key={branch.id}>
              <div className="flex items-center gap-2">
                <Switch
                  id={`branch-toggle-${chapterId}-${branch.id}`}
                  checked={isSelected}
                  onCheckedChange={(checked) =>
                    onToggle(parent.id, branch.id, checked)
                  }
                />
                <Label
                  htmlFor={`branch-toggle-${chapterId}-${branch.id}`}
                  className="text-xs cursor-pointer"
                >
                  {branch.branchLabel}: {branch.title}
                </Label>
              </div>
              {isSelected && subBranches && subBranches.length > 0 && (
                <BranchGroupRenderer
                  parent={branch}
                  branches={subBranches}
                  activePath={activePath}
                  branchesByParent={branchesByParent}
                  chapterId={chapterId}
                  onToggle={onToggle}
                  depth={depth + 1}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
