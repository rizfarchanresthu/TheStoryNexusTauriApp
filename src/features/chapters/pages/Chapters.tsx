import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChapterCard } from "@/features/chapters/components/ChapterCard";
import { useChapterStore } from "@/features/chapters/stores/useChapterStore";
import { usePromptStore } from "@/features/prompts/store/promptStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { useLorebookStore } from "@/features/lorebook/stores/useLorebookStore";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Chapter } from "@/types/story";

interface CreateChapterForm {
  title: string;
  povCharacter?: string;
  povType?: "First Person" | "Third Person Limited" | "Third Person Omniscient";
}

function BranchTree({
  branches,
  branchesByParent,
  storyId,
  onCreateBranch,
}: {
  branches: Chapter[];
  branchesByParent: Map<string, Chapter[]>;
  storyId: string;
  onCreateBranch: (parent: Chapter) => void;
}) {
  return (
    <div className="ml-8 mt-1 space-y-1 border-l-2 border-muted-foreground/20 pl-4">
      {branches.map((branch) => {
        const subBranches = branchesByParent.get(branch.id) || [];
        return (
          <div key={branch.id}>
            <ChapterCard
              chapter={branch}
              storyId={storyId}
              isBranch
              onCreateBranch={() => onCreateBranch(branch)}
              hasBranches={subBranches.length > 0}
            />
            {subBranches.length > 0 && (
              <BranchTree
                branches={subBranches}
                branchesByParent={branchesByParent}
                storyId={storyId}
                onCreateBranch={onCreateBranch}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Chapters() {
  const { storyId } = useParams();
  const { setCurrentStoryId } = useStoryContext();
  const {
    chapters,
    loading,
    error,
    fetchChapters,
    createChapter,
    createBranch,
    updateChapterOrders,
  } = useChapterStore();
  const { fetchPrompts } = usePromptStore();
  const { entries } = useLorebookStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [branchDialogParentId, setBranchDialogParentId] = useState<string | null>(null);
  const form = useForm<CreateChapterForm>({
    defaultValues: {
      povType: "Third Person Omniscient",
    },
  });
  const branchForm = useForm<CreateChapterForm>({
    defaultValues: {
      povType: "Third Person Omniscient",
    },
  });

  const povType = form.watch("povType");
  const branchPovType = branchForm.watch("povType");
  const characterEntries = entries.filter(
    (entry) => entry.category === "character"
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const mainChapters = useMemo(
    () => chapters.filter((ch) => !ch.parentChapterId).sort((a, b) => a.order - b.order),
    [chapters]
  );

  const branchesByParent = useMemo(() => {
    const map = new Map<string, Chapter[]>();
    for (const ch of chapters) {
      if (ch.parentChapterId) {
        const existing = map.get(ch.parentChapterId) || [];
        existing.push(ch);
        map.set(ch.parentChapterId, existing);
      }
    }
    for (const [key, branches] of map) {
      map.set(key, branches.sort((a, b) => (a.branchOrder ?? 0) - (b.branchOrder ?? 0)));
    }
    return map;
  }, [chapters]);

  useEffect(() => {
    if (storyId) {
      setCurrentStoryId(storyId);
      Promise.all([fetchChapters(storyId), fetchPrompts()]).catch(
        console.error
      );
    }
  }, [storyId, fetchChapters, setCurrentStoryId, fetchPrompts]);

  useEffect(() => {
    if (povType === "Third Person Omniscient") {
      form.setValue("povCharacter", undefined);
    }
  }, [povType, form]);

  useEffect(() => {
    if (branchPovType === "Third Person Omniscient") {
      branchForm.setValue("povCharacter", undefined);
    }
  }, [branchPovType, branchForm]);

  const handleCreateChapter = async (data: CreateChapterForm) => {
    if (!storyId) return;

    try {
      const nextOrder =
        mainChapters.length === 0
          ? 1
          : Math.max(...mainChapters.map((chapter) => chapter.order ?? 0)) + 1;

      const povCharacter =
        data.povType !== "Third Person Omniscient"
          ? data.povCharacter
          : undefined;

      await createChapter({
        storyId,
        title: data.title,
        content: "",
        povCharacter,
        povType: data.povType,
        order: nextOrder,
        outline: { content: "", lastUpdated: new Date() },
      });
      setIsCreateDialogOpen(false);
      form.reset({
        title: "",
        povType: "Third Person Omniscient",
        povCharacter: undefined,
      });
      toast.success("Chapter created successfully");
    } catch (error) {
      console.error("Failed to create chapter:", error);
      toast.error("Failed to create chapter");
    }
  };

  const handleCreateBranch = async (data: CreateChapterForm) => {
    if (!branchDialogParentId) return;

    try {
      const povCharacter =
        data.povType !== "Third Person Omniscient"
          ? data.povCharacter
          : undefined;

      await createBranch(branchDialogParentId, {
        title: data.title,
        povCharacter,
        povType: data.povType,
      });
      setBranchDialogParentId(null);
      branchForm.reset({
        title: "",
        povType: "Third Person Omniscient",
        povCharacter: undefined,
      });
      toast.success("Branch created successfully");
    } catch (error) {
      console.error("Failed to create branch:", error);
      toast.error("Failed to create branch");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    const activeId = active.id.toString();
    const overId = over?.id.toString();

    if (!over || activeId === overId) return;

    const oldIndex = mainChapters.findIndex((chapter) => chapter.id === activeId);
    const newIndex = mainChapters.findIndex((chapter) => chapter.id === overId);

    if (oldIndex === -1 || newIndex === -1) return;

    try {
      const updatedChapters = arrayMove(mainChapters, oldIndex, newIndex);

      await updateChapterOrders(
        updatedChapters.map((chapter: Chapter, index) => ({
          id: chapter.id,
          order: index + 1,
        }))
      );

      toast.success("Chapter order updated successfully");
    } catch (error) {
      console.error("Failed to update chapter order:", error);
      toast.error("Failed to update chapter order");
      await fetchChapters(storyId!);
    }
  };

  const parentChapterForDialog = branchDialogParentId
    ? chapters.find((ch) => ch.id === branchDialogParentId)
    : null;

  if (!storyId) return null;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading chapters...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Chapters</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Chapter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={form.handleSubmit(handleCreateChapter)}>
              <DialogHeader>
                <DialogTitle>Create New Chapter</DialogTitle>
                <DialogDescription>
                  Add a new chapter to your story. You can edit the content
                  after creating it.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter chapter title"
                    {...form.register("title", { required: true })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="povType">POV Type</Label>
                  <Select
                    defaultValue="Third Person Omniscient"
                    onValueChange={(value) =>
                      form.setValue("povType", value as any)
                    }
                  >
                    <SelectTrigger id="povType">
                      <SelectValue placeholder="Select POV type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="First Person">First Person</SelectItem>
                      <SelectItem value="Third Person Limited">
                        Third Person Limited
                      </SelectItem>
                      <SelectItem value="Third Person Omniscient">
                        Third Person Omniscient
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {povType && povType !== "Third Person Omniscient" && (
                  <div className="grid gap-2">
                    <Label htmlFor="povCharacter">POV Character</Label>
                    <Select
                      onValueChange={(value) =>
                        form.setValue("povCharacter", value)
                      }
                    >
                      <SelectTrigger id="povCharacter">
                        <SelectValue placeholder="Select character" />
                      </SelectTrigger>
                      <SelectContent>
                        {characterEntries.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No characters available
                          </SelectItem>
                        ) : (
                          characterEntries.map((character) => (
                            <SelectItem
                              key={character.id}
                              value={character.name}
                            >
                              {character.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="submit">Create Chapter</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="h-[calc(100vh-10rem)]">
        {mainChapters.length === 0 ? (
          <div className="h-[200px] flex flex-col items-center justify-center text-center p-6">
            <p className="text-muted-foreground mb-4">
              No chapters yet. Start writing your story by creating a new
              chapter.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Chapter
            </Button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={mainChapters.map((chapter) => chapter.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {mainChapters.map((chapter) => {
                  const branches = branchesByParent.get(chapter.id) || [];
                  return (
                    <div key={chapter.id}>
                      <ChapterCard
                        chapter={chapter}
                        storyId={storyId}
                        onCreateBranch={() => {
                          setBranchDialogParentId(chapter.id);
                          const parentPov = chapter.povType || "Third Person Omniscient";
                          branchForm.reset({
                            title: "",
                            povType: parentPov,
                            povCharacter: chapter.povCharacter,
                          });
                        }}
                        hasBranches={branches.length > 0}
                      />
                      {branches.length > 0 && (
                        <BranchTree
                          branches={branches}
                          branchesByParent={branchesByParent}
                          storyId={storyId}
                          onCreateBranch={(parentChapter) => {
                            setBranchDialogParentId(parentChapter.id);
                            const parentPov = parentChapter.povType || "Third Person Omniscient";
                            branchForm.reset({
                              title: "",
                              povType: parentPov,
                              povCharacter: parentChapter.povCharacter,
                            });
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </ScrollArea>

      {/* Create Branch Dialog */}
      <Dialog
        open={branchDialogParentId !== null}
        onOpenChange={(open) => {
          if (!open) setBranchDialogParentId(null);
        }}
      >
        <DialogContent>
          <form onSubmit={branchForm.handleSubmit(handleCreateBranch)}>
            <DialogHeader>
              <DialogTitle>Create Branch</DialogTitle>
              <DialogDescription>
                Create a branch for{" "}
                {parentChapterForDialog?.parentChapterId
                  ? `Branch ${parentChapterForDialog?.branchLabel}: ${parentChapterForDialog?.title}`
                  : `Chapter ${parentChapterForDialog?.order}: ${parentChapterForDialog?.title}`
                }. Branches are alternative story paths that share the same preceding context.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="branch-title">Title</Label>
                <Input
                  id="branch-title"
                  placeholder="Enter branch title"
                  {...branchForm.register("title", { required: true })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="branch-povType">POV Type</Label>
                <Select
                  value={branchForm.watch("povType") || "Third Person Omniscient"}
                  onValueChange={(value) =>
                    branchForm.setValue("povType", value as any)
                  }
                >
                  <SelectTrigger id="branch-povType">
                    <SelectValue placeholder="Select POV type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="First Person">First Person</SelectItem>
                    <SelectItem value="Third Person Limited">
                      Third Person Limited
                    </SelectItem>
                    <SelectItem value="Third Person Omniscient">
                      Third Person Omniscient
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {branchPovType && branchPovType !== "Third Person Omniscient" && (
                <div className="grid gap-2">
                  <Label htmlFor="branch-povCharacter">POV Character</Label>
                  <Select
                    value={branchForm.watch("povCharacter")}
                    onValueChange={(value) =>
                      branchForm.setValue("povCharacter", value)
                    }
                  >
                    <SelectTrigger id="branch-povCharacter">
                      <SelectValue placeholder="Select character" />
                    </SelectTrigger>
                    <SelectContent>
                      {characterEntries.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No characters available
                        </SelectItem>
                      ) : (
                        characterEntries.map((character) => (
                          <SelectItem key={character.id} value={character.name}>
                            {character.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit">Create Branch</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
