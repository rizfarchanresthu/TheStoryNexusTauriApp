import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "./button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "./dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./dialog";
import { Switch } from "./switch";
import { Label } from "./label";
import { toast } from "react-toastify";
import { downloadChapter, downloadStory, getStoryBranchPoints } from "@/utils/exportUtils";
import type { BranchPointNode } from "@/utils/exportUtils";
import type { Chapter } from "@/types/story";

interface DownloadMenuProps {
    type: 'story' | 'chapter';
    id: string;
    variant?: "outline" | "ghost" | "link" | "default" | "destructive" | "secondary";
    size?: "default" | "sm" | "lg" | "icon";
    showIcon?: boolean;
    label?: string;
    className?: string;
}

export function DownloadMenu({
    type,
    id,
    variant = "ghost",
    size = "icon",
    showIcon = true,
    label = "Download",
    className = "",
}: DownloadMenuProps) {
    const [showBranchDialog, setShowBranchDialog] = useState(false);
    const [pendingFormat, setPendingFormat] = useState<'html' | 'text' | null>(null);
    const [branchPoints, setBranchPoints] = useState<BranchPointNode[]>([]);
    const [selectedBranches, setSelectedBranches] = useState<Record<string, string[]>>({});

    const handleDownload = async (format: 'html' | 'text', e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            if (type === 'story') {
                const points = await getStoryBranchPoints(id);
                if (points.length > 0) {
                    setPendingFormat(format);
                    setBranchPoints(points);
                    setSelectedBranches({});
                    setShowBranchDialog(true);
                    return;
                }
                await downloadStory(id, format);
            } else {
                await downloadChapter(id, format);
            }
            toast.success(`${type === 'story' ? 'Story' : 'Chapter'} downloaded as ${format.toUpperCase()}`, {
                position: "bottom-center",
                autoClose: 2000,
            });
        } catch (error) {
            console.error(`Failed to download ${type}:`, error);
            toast.error(`Failed to download ${type}`, {
                position: "bottom-center",
                autoClose: 2000,
            });
        }
    };

    const handleConfirmExport = async () => {
        if (!pendingFormat) return;
        try {
            await downloadStory(id, pendingFormat, selectedBranches);
            setShowBranchDialog(false);
            setPendingFormat(null);
            toast.success(`Story downloaded as ${pendingFormat.toUpperCase()}`, {
                position: "bottom-center",
                autoClose: 2000,
            });
        } catch (error) {
            console.error('Failed to download story:', error);
            toast.error('Failed to download story', {
                position: "bottom-center",
                autoClose: 2000,
            });
        }
    };

    const toggleBranch = (parentId: string, branchId: string, checked: boolean) => {
        setSelectedBranches((prev) => {
            const current = prev[parentId] || [];
            const updated = checked
                ? [...current, branchId]
                : current.filter((id) => id !== branchId);
            const next = { ...prev };
            if (updated.length === 0) {
                delete next[parentId];
            } else {
                next[parentId] = updated;
            }
            return next;
        });
    };

    // Build a map of parentId -> BranchPointNode for nested rendering
    const branchPointMap = new Map<string, BranchPointNode>();
    for (const bp of branchPoints) {
        branchPointMap.set(bp.parent.id, bp);
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant={variant} size={size} className={`flex items-center gap-1 ${className}`}>
                        {showIcon && <Download className="h-4 w-4" />}
                        {(size !== "icon" || !showIcon) && label}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => handleDownload('html', e)}>
                        Download as HTML
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => handleDownload('text', e)}>
                        Download as Text
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={showBranchDialog} onOpenChange={setShowBranchDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Branches for Export</DialogTitle>
                        <DialogDescription>
                            Your story has branching chapters. Choose which branches to
                            include in the export. Unselected branches will be excluded.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                        {branchPoints
                            .filter(({ parent }) => !parent.parentChapterId)
                            .map(({ parent, branches }) => (
                                <ExportBranchGroup
                                    key={parent.id}
                                    parent={parent}
                                    branches={branches}
                                    selectedBranches={selectedBranches}
                                    branchPointMap={branchPointMap}
                                    toggleBranch={toggleBranch}
                                    depth={0}
                                />
                            ))}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowBranchDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleConfirmExport}>
                            Export
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function ExportBranchGroup({
    parent,
    branches,
    selectedBranches,
    branchPointMap,
    toggleBranch,
    depth,
}: {
    parent: Chapter;
    branches: Chapter[];
    selectedBranches: Record<string, string[]>;
    branchPointMap: Map<string, BranchPointNode>;
    toggleBranch: (parentId: string, branchId: string, checked: boolean) => void;
    depth: number;
}) {
    const selectedIds = selectedBranches[parent.id] || [];
    const parentLabel = parent.parentChapterId
        ? `Branch ${parent.branchLabel}: ${parent.title}`
        : `Ch. ${parent.order}: ${parent.title}`;

    return (
        <div className="space-y-2" style={{ paddingLeft: depth * 16 }}>
            <span className="text-sm font-medium">{parentLabel}</span>
            <div className="flex flex-col gap-2 pl-4">
                {branches.map((branch) => {
                    const isSelected = selectedIds.includes(branch.id);
                    const subPoint = branchPointMap.get(branch.id);
                    return (
                        <div key={branch.id}>
                            <div className="flex items-center gap-2">
                                <Switch
                                    id={`export-branch-${branch.id}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) =>
                                        toggleBranch(parent.id, branch.id, checked)
                                    }
                                />
                                <Label
                                    htmlFor={`export-branch-${branch.id}`}
                                    className="text-sm cursor-pointer"
                                >
                                    {branch.branchLabel}: {branch.title}
                                </Label>
                            </div>
                            {isSelected && subPoint && (
                                <ExportBranchGroup
                                    parent={subPoint.parent}
                                    branches={subPoint.branches}
                                    selectedBranches={selectedBranches}
                                    branchPointMap={branchPointMap}
                                    toggleBranch={toggleBranch}
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
