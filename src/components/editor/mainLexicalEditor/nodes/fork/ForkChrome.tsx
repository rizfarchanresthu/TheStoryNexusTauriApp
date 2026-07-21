import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
    ChevronLeft,
    ChevronRight,
    GitBranch,
    Plus,
    Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ForkChromeBranch = {
    key: string;
    title: string;
    active: boolean;
};

type ForkChromeProps = {
    forkKey: string;
    depth: number;
    branches: ForkChromeBranch[];
    activeBranchKey: string;
    onSelectBranch: (branchKey: string) => void;
    onAddBranch: () => void;
    onDeleteBranch: (branchKey: string) => void;
    onRenameBranch: (branchKey: string, title: string) => void;
    onFlattenFork: () => void;
};

const SWIPE_THRESHOLD_PX = 48;

export function ForkChrome({
    depth,
    branches,
    activeBranchKey,
    onSelectBranch,
    onAddBranch,
    onDeleteBranch,
    onRenameBranch,
    onFlattenFork,
}: ForkChromeProps) {
    const activeIndex = Math.max(
        0,
        branches.findIndex((branch) => branch.key === activeBranchKey)
    );
    const activeBranch = branches[activeIndex] ?? branches[0];
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [editingTitle, setEditingTitle] = useState(false);
    const [draftTitle, setDraftTitle] = useState(activeBranch?.title ?? "");
    const dragStartX = useRef(0);
    const trackRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setDraftTitle(activeBranch?.title ?? "");
        setEditingTitle(false);
    }, [activeBranch?.key, activeBranch?.title]);

    const goToIndex = useCallback(
        (index: number) => {
            const next = branches[index];
            if (next) onSelectBranch(next.key);
        },
        [branches, onSelectBranch]
    );

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (editingTitle) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStartX.current = event.clientX;
        setIsDragging(true);
        setDragOffset(0);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        setDragOffset(event.clientX - dragStartX.current);
    };

    const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        setIsDragging(false);

        if (dragOffset <= -SWIPE_THRESHOLD_PX && activeIndex < branches.length - 1) {
            goToIndex(activeIndex + 1);
        } else if (dragOffset >= SWIPE_THRESHOLD_PX && activeIndex > 0) {
            goToIndex(activeIndex - 1);
        }
        setDragOffset(0);
    };

    const peekPrev = branches[activeIndex - 1];
    const peekNext = branches[activeIndex + 1];
    const nested = depth > 0;

    return (
        <div
            className={cn(
                "fork-chrome",
                nested ? "fork-chrome-nested" : "fork-chrome-root"
            )}
            data-testid="fork-chrome"
            data-fork-depth={depth}
            onKeyDown={(event) => {
                if (editingTitle) return;
                if (event.key === "ArrowLeft" && activeIndex > 0) {
                    event.preventDefault();
                    goToIndex(activeIndex - 1);
                } else if (event.key === "ArrowRight" && activeIndex < branches.length - 1) {
                    event.preventDefault();
                    goToIndex(activeIndex + 1);
                }
            }}
            tabIndex={0}
        >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
                <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Story fork
                </span>
                <div className="ml-auto flex items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        aria-label="Add branch"
                        data-testid="fork-add-branch"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={onAddBranch}
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive"
                        aria-label="Remove fork and keep active branch"
                        data-testid="fork-flatten"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={onFlattenFork}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            <div
                ref={trackRef}
                className="fork-chrome-track relative select-none touch-pan-y px-3 py-3"
                data-testid="fork-swipe-track"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
            >
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0"
                        aria-label="Previous branch"
                        disabled={activeIndex <= 0}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => goToIndex(activeIndex - 1)}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="relative min-h-[2.5rem] flex-1 overflow-hidden">
                        {peekPrev && isDragging && dragOffset > 8 && (
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-xs text-muted-foreground opacity-70">
                                {peekPrev.title}
                            </div>
                        )}
                        {peekNext && isDragging && dragOffset < -8 && (
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center text-xs text-muted-foreground opacity-70">
                                {peekNext.title}
                            </div>
                        )}

                        <div
                            className={cn(
                                "flex flex-col items-center justify-center rounded-md border border-border bg-background/80 px-3 py-2 transition-transform",
                                isDragging && "transition-none"
                            )}
                            style={{ transform: `translateX(${dragOffset * 0.35}px)` }}
                        >
                            {editingTitle ? (
                                <input
                                    className="w-full bg-transparent text-center text-sm font-medium outline-none"
                                    value={draftTitle}
                                    data-testid="fork-branch-title-input"
                                    autoFocus
                                    onChange={(event) => setDraftTitle(event.target.value)}
                                    onBlur={() => {
                                        if (activeBranch && draftTitle.trim()) {
                                            onRenameBranch(activeBranch.key, draftTitle.trim());
                                        }
                                        setEditingTitle(false);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.currentTarget.blur();
                                        } else if (event.key === "Escape") {
                                            setDraftTitle(activeBranch?.title ?? "");
                                            setEditingTitle(false);
                                        }
                                    }}
                                    onPointerDown={(event) => event.stopPropagation()}
                                />
                            ) : (
                                <button
                                    type="button"
                                    className="text-sm font-medium"
                                    data-testid="fork-branch-title"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => setEditingTitle(true)}
                                    onDoubleClick={() => setEditingTitle(true)}
                                >
                                    {activeBranch?.title ?? "Path"}
                                </button>
                            )}
                            <div className="mt-1 text-[10px] text-muted-foreground">
                                {activeIndex + 1} / {branches.length} · drag to switch
                            </div>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0"
                        aria-label="Next branch"
                        disabled={activeIndex >= branches.length - 1}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => goToIndex(activeIndex + 1)}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="mt-2 flex items-center justify-center gap-2">
                    <div className="flex items-center gap-1.5" data-testid="fork-branch-dots">
                        {branches.map((branch, index) => (
                            <button
                                key={branch.key}
                                type="button"
                                aria-label={`Switch to ${branch.title}`}
                                aria-current={branch.key === activeBranchKey}
                                className={cn(
                                    "h-2 w-2 rounded-full transition-colors",
                                    branch.key === activeBranchKey
                                        ? "bg-primary"
                                        : "bg-muted-foreground/40 hover:bg-muted-foreground/70"
                                )}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => goToIndex(index)}
                            />
                        ))}
                    </div>
                    {branches.length > 1 && activeBranch && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground"
                            aria-label="Delete this branch"
                            data-testid="fork-delete-branch"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => onDeleteBranch(activeBranch.key)}
                        >
                            Delete path
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
