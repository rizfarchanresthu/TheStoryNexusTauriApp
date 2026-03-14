import { create } from 'zustand';
import { db } from '../../../services/database';
import type { Chapter, ChapterOutline, ChapterNotes } from '../../../types/story';

interface ChapterState {
    chapters: Chapter[];
    currentChapter: Chapter | null;
    loading: boolean;
    error: string | null;
    summariesSoFar: string;
    lastEditedChapterIds: Record<string, string>; // Map of storyId -> chapterId

    // Actions
    fetchChapters: (storyId: string) => Promise<void>;
    getChapter: (id: string) => Promise<void>;
    createChapter: (chapterData: Omit<Chapter, 'id' | 'createdAt' | 'wordCount'>) => Promise<string>;
    updateChapter: (id: string, chapterData: Partial<Chapter>) => Promise<void>;
    deleteChapter: (id: string) => Promise<void>;
    setCurrentChapter: (chapter: Chapter | null) => void;
    getPreviousChapterSummaries: (storyId: string, currentOrder: number) => Promise<string>;
    clearError: () => void;
    updateChapterSummary: (id: string, summary: string) => Promise<void>;
    updateChapterSummaryOptimistic: (id: string, summary: string) => Promise<void>;
    getChapterPlainText: (id: string) => Promise<string>;
    getChapterSummaries: (storyId: string, currentOrder: number, includeLatest?: boolean) => Promise<string>;
    getAllChapterSummaries: (storyId: string) => Promise<string>;
    updateChapterOutline: (id: string, outline: ChapterOutline) => Promise<void>;
    getChapterOutline: (id: string) => Promise<ChapterOutline | null>;
    getChapterSummary: (id: string) => Promise<string>;
    getPreviousChapter: (chapterId: string) => Promise<Chapter | null>;
    getChapterPlainTextByChapterOrder: (chapterOrder: number) => Promise<string>;
    updateChapterNotes: (id: string, notes: ChapterNotes) => Promise<void>;
    getChapterNotes: (id: string) => Promise<ChapterNotes | null>;
    setLastEditedChapterId: (storyId: string, chapterId: string) => void;
    getLastEditedChapterId: (storyId: string) => string | null;
    updateChapterOrders: (updates: Array<{ id: string, order: number }>) => Promise<void>;

    // Branch actions
    createBranch: (parentChapterId: string, data: { title: string; branchLabel?: string; povCharacter?: string; povType?: Chapter['povType'] }) => Promise<string>;
    getBranches: (parentChapterId: string) => Promise<Chapter[]>;
    getMainChapters: () => Chapter[];
    deleteBranch: (branchId: string) => Promise<void>;
    updateActiveBranchPath: (chapterId: string, parentChapterId: string, selectedBranchIds: string[]) => Promise<void>;
    getChaptersWithBranches: (storyId: string) => Promise<Map<string, Chapter[]>>;
}

export const useChapterStore = create<ChapterState>((set, get) => ({
    chapters: [],
    currentChapter: null,
    loading: false,
    error: null,
    summariesSoFar: '',
    lastEditedChapterIds: JSON.parse(localStorage.getItem('lastEditedChapterIds') || '{}'),

    // Fetch all chapters for a story
    fetchChapters: async (storyId: string) => {
        set({ loading: true, error: null });
        try {
            const chapters = await db.chapters
                .where('storyId')
                .equals(storyId)
                .sortBy('order');
            set({ chapters, loading: false });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to fetch chapters',
                loading: false
            });
        }
    },

    // Get a single chapter
    getChapter: async (id: string) => {
        set({ loading: true, error: null });
        try {
            const chapter = await db.chapters.get(id);
            if (!chapter) {
                throw new Error('Chapter not found');
            }
            set({ currentChapter: chapter, loading: false });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to fetch chapter',
                loading: false
            });
        }
    },

    // Create a new chapter
    createChapter: async (chapterData) => {
        set({ loading: true, error: null });
        try {
            // Get all chapters for this story and find the highest order
            const storyChapters = await db.chapters
                .where('storyId')
                .equals(chapterData.storyId)
                .toArray();

            const nextOrder = storyChapters.length === 0
                ? 1
                : Math.max(...storyChapters.map(chapter => chapter.order)) + 1;

            const chapterId = crypto.randomUUID();

            await db.chapters.add({
                ...chapterData,
                id: chapterId,
                order: nextOrder,
                createdAt: new Date(),
                wordCount: chapterData.content.split(/\s+/).length
            });

            const newChapter = await db.chapters.get(chapterId);
            if (!newChapter) throw new Error('Failed to create chapter');

            set(state => ({
                chapters: [...state.chapters, newChapter].sort((a, b) => a.order - b.order),
                currentChapter: newChapter,
                loading: false
            }));

            return chapterId;
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to create chapter',
                loading: false
            });
            throw error;
        }
    },

    // Update a chapter
    updateChapter: async (id: string, chapterData: Partial<Chapter>) => {
        set({ loading: true, error: null });
        try {
            if (chapterData.content) {
                chapterData.wordCount = chapterData.content.split(/\s+/).length;
                const chapter = await db.chapters.get(id);
                if (chapter) {
                    // Store last edited with storyId
                    const { lastEditedChapterIds } = get();
                    const newLastEdited = {
                        ...lastEditedChapterIds,
                        [chapter.storyId]: id
                    };
                    set({ lastEditedChapterIds: newLastEdited });
                    localStorage.setItem('lastEditedChapterIds', JSON.stringify(newLastEdited));
                }
            }

            await db.chapters.update(id, chapterData);
            const updatedChapter = await db.chapters.get(id);
            if (!updatedChapter) throw new Error('Chapter not found after update');

            set(state => ({
                chapters: state.chapters.map(chapter =>
                    chapter.id === id ? updatedChapter : chapter
                ),
                currentChapter: state.currentChapter?.id === id ? updatedChapter : state.currentChapter,
                loading: false
            }));
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to update chapter',
                loading: false
            });
        }
    },

    // Delete a chapter (recursively deletes all descendant branches)
    deleteChapter: async (id: string) => {
        set({ loading: true, error: null });
        try {
            await db.transaction('rw', [db.chapters], async () => {
                const chapterToDelete = await db.chapters.get(id);
                if (!chapterToDelete) throw new Error('Chapter not found');

                // Collect all descendant IDs recursively
                const allDescendantIds: string[] = [];
                const collectDescendants = async (parentId: string) => {
                    const children = await db.chapters
                        .where('parentChapterId')
                        .equals(parentId)
                        .toArray();
                    for (const child of children) {
                        allDescendantIds.push(child.id);
                        await collectDescendants(child.id);
                    }
                };
                await collectDescendants(id);

                // Delete all descendants
                for (const descId of allDescendantIds) {
                    await db.chapters.delete(descId);
                }

                // Clean up activeBranchPath references to deleted chapter and all descendants
                const idsToClean = new Set([id, ...allDescendantIds]);
                const allStoryChapters = await db.chapters
                    .where('storyId')
                    .equals(chapterToDelete.storyId)
                    .toArray();
                for (const ch of allStoryChapters) {
                    if (ch.activeBranchPath) {
                        let changed = false;
                        const newPath = { ...ch.activeBranchPath };
                        for (const key of Object.keys(newPath)) {
                            if (idsToClean.has(key)) {
                                delete newPath[key];
                                changed = true;
                            } else {
                                const filtered = newPath[key].filter(bId => !idsToClean.has(bId));
                                if (filtered.length !== newPath[key].length) {
                                    changed = true;
                                    if (filtered.length === 0) delete newPath[key];
                                    else newPath[key] = filtered;
                                }
                            }
                        }
                        if (changed) {
                            await db.chapters.update(ch.id, { activeBranchPath: newPath });
                        }
                    }
                }

                await db.chapters.delete(id);

                const { lastEditedChapterIds } = get();
                if (lastEditedChapterIds[chapterToDelete.storyId] === id) {
                    const newLastEdited = { ...lastEditedChapterIds };
                    delete newLastEdited[chapterToDelete.storyId];
                    localStorage.setItem('lastEditedChapterIds', JSON.stringify(newLastEdited));
                    set({ lastEditedChapterIds: newLastEdited });
                }

                if (!chapterToDelete.parentChapterId) {
                    await db.chapters
                        .where('storyId')
                        .equals(chapterToDelete.storyId)
                        .filter(chapter => !chapter.parentChapterId && chapter.order > chapterToDelete.order)
                        .modify(chapter => {
                            chapter.order -= 1;
                        });
                }

                const updatedChapters = await db.chapters
                    .where('storyId')
                    .equals(chapterToDelete.storyId)
                    .sortBy('order');

                set(state => ({
                    chapters: updatedChapters,
                    currentChapter: state.currentChapter?.id === id ? null : state.currentChapter,
                    loading: false
                }));
            });
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to delete chapter',
                loading: false
            });
        }
    },

    // Set current chapter
    setCurrentChapter: (chapter) => {
        set({ currentChapter: chapter });
    },

    // Get summaries for previous chapters (main chapters only)
    getPreviousChapterSummaries: async (storyId: string, currentOrder: number) => {
        try {
            const previousChapters = await db.chapters
                .where('storyId')
                .equals(storyId)
                .filter(chapter => chapter.order <= currentOrder && !chapter.parentChapterId)
                .sortBy('order');

            const summaries = previousChapters
                .map(chapter => chapter.summary?.trim() || '')
                .filter(Boolean)
                .join(' ');

            set({ summariesSoFar: summaries });
            return summaries;
        } catch (error) {
            console.error('Error getting previous chapter summaries:', error);
            return '';
        }
    },

    // Clear error
    clearError: () => {
        set({ error: null });
    },

    // Add new dedicated summary update function
    updateChapterSummary: async (id: string, summary: string) => {
        set({ loading: true, error: null });
        try {
            await db.chapters.update(id, { summary });
            const updatedChapter = await db.chapters.get(id);
            if (!updatedChapter) throw new Error('Chapter not found after update');

            set(state => ({
                chapters: state.chapters.map(chapter =>
                    chapter.id === id ? updatedChapter : chapter
                ),
                currentChapter: state.currentChapter?.id === id ? updatedChapter : state.currentChapter,
                loading: false
            }));
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to update chapter summary',
                loading: false
            });
        }
    },

    // Add a new action that doesn't trigger full chapter list update
    updateChapterSummaryOptimistic: async (id: string, summary: string) => {
        try {
            await db.chapters.update(id, { summary });
            // Optimistic update
            set(state => ({
                chapters: state.chapters.map(chapter =>
                    chapter.id === id
                        ? { ...chapter, summary }
                        : chapter
                )
            }));
        } catch (error) {
            console.error('Failed to update summary:', error);
            throw error;
        }
    },

    // New method to get chapter plain text
    getChapterPlainText: async (id: string) => {
        try {
            console.log('DEBUG: getChapterPlainText called for chapter ID:', id);
            const chapter = await db.chapters.get(id);
            if (!chapter) {
                console.error('getChapterPlainText - Chapter not found:', id);
                return '';
            }

            // Parse the Lexical state
            const editorState = JSON.parse(chapter.content);
            let plainText = '';

            const processNode = (node: any) => {
                if (node.type === 'text') {
                    plainText += node.text;
                } else if (node.children) {
                    node.children.forEach(processNode);
                }
                if (node.type === 'paragraph') {
                    plainText += '\n\n';
                }
            };

            if (editorState.root?.children) {
                editorState.root.children.forEach(processNode);
            }

            const finalText = plainText.trim();

            return finalText;
        } catch (error) {
            console.error('getChapterPlainText - Failed to parse chapter content:', error);
            return '';
        }
    },

    // Enhanced summary gathering function with detailed formatting (main chapters only)
    getChapterSummaries: async (storyId: string, currentOrder: number, includeLatest: boolean = false) => {
        try {
            const chapters = await db.chapters
                .where('storyId')
                .equals(storyId)
                .filter(chapter => !chapter.parentChapterId && (includeLatest
                    ? true
                    : chapter.order < currentOrder))
                .sortBy('order');

            const summaries = chapters
                .map(chapter => {
                    const summary = chapter.summary?.trim();
                    return summary
                        ? `Chapter ${chapter.order} - ${chapter.title}: ${summary}`
                        : '';
                })
                .filter(Boolean)
                .join(', ');

            return summaries;
        } catch (error) {
            console.error('Error getting chapter summaries:', error);
            return '';
        }
    },

    // Get a specific chapter summary by ID
    getChapterSummary: async (id: string) => {
        try {
            const chapter = await db.chapters.get(id);
            if (!chapter || !chapter.summary) {
                return '';
            }
            return `Chapter ${chapter.order} - ${chapter.title}:\n${chapter.summary.trim()}`;
        } catch (error) {
            console.error('Error getting chapter summary:', error);
            return '';
        }
    },

    // Fetch all summaries for a story (main chapters only)
    getAllChapterSummaries: async (storyId: string) => {
        try {
            const chapters = await db.chapters
                .where('storyId')
                .equals(storyId)
                .filter(chapter => !chapter.parentChapterId)
                .sortBy('order');

            const summaries = chapters
                .map(chapter => {
                    const summary = chapter.summary?.trim();
                    return summary
                        ? `Chapter ${chapter.order} - ${chapter.title}:\n${summary}`
                        : '';
                })
                .filter(Boolean)
                .join('\n\n');

            return summaries;
        } catch (error) {
            console.error('Error getting all chapter summaries:', error);
            return '';
        }
    },

    // Update chapter outline
    updateChapterOutline: async (id: string, outline: ChapterOutline) => {
        set({ loading: true, error: null });
        try {
            await db.chapters.update(id, { outline });
            const updatedChapter = await db.chapters.get(id);
            if (!updatedChapter) throw new Error('Chapter not found after update');

            set(state => ({
                chapters: state.chapters.map(chapter =>
                    chapter.id === id ? updatedChapter : chapter
                ),
                currentChapter: state.currentChapter?.id === id ? updatedChapter : state.currentChapter,
                loading: false
            }));
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to update chapter outline',
                loading: false
            });
            throw error;
        }
    },

    // Get chapter outline
    getChapterOutline: async (id: string) => {
        try {
            const chapter = await db.chapters.get(id);
            return chapter?.outline || null;
        } catch (error) {
            return null;
        }
    },

    getPreviousChapter: async (chapterId: string): Promise<Chapter | null> => {
        try {
            const currentChapter = await db.chapters.get(chapterId);
            if (!currentChapter) {
                console.error('Current chapter not found:', chapterId);
                return null;
            }

            // If this is a branch, its "previous" is its parent chapter
            if (currentChapter.parentChapterId) {
                return await db.chapters.get(currentChapter.parentChapterId) || null;
            }

            // For main chapters, find the previous main chapter (skip branches)
            const previousChapters = await db.chapters
                .where('storyId')
                .equals(currentChapter.storyId)
                .and(chapter => chapter.order < currentChapter.order && !chapter.parentChapterId)
                .toArray();

            if (previousChapters.length === 0) {
                return null;
            }

            return previousChapters.reduce((prev, current) =>
                prev.order > current.order ? prev : current
            );
        } catch (error) {
            console.error('Error fetching previous chapter:', error);
            return null;
        }
    },

    getChapterPlainTextByChapterOrder: async (chapterOrder: number) => {
        const { getChapterPlainText } = useChapterStore.getState();
        const chapter = await db.chapters.where('order').equals(chapterOrder).first();
        if (!chapter) {
            return 'No chapter data is available for this order number.';
        }
        return getChapterPlainText(chapter.id);
    },

    // Add new methods for chapter notes
    updateChapterNotes: async (id: string, notes: ChapterNotes) => {
        set({ loading: true, error: null });
        try {
            await db.chapters.update(id, { notes });
            const updatedChapter = await db.chapters.get(id);
            if (!updatedChapter) throw new Error('Chapter not found after update');

            set(state => ({
                chapters: state.chapters.map(chapter =>
                    chapter.id === id ? updatedChapter : chapter
                ),
                currentChapter: state.currentChapter?.id === id ? updatedChapter : state.currentChapter,
                loading: false
            }));
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to update chapter notes',
                loading: false
            });
            throw error;
        }
    },

    getChapterNotes: async (id: string) => {
        try {
            const chapter = await db.chapters.get(id);
            return chapter?.notes || null;
        } catch (error) {
            return null;
        }
    },

    setLastEditedChapterId: (storyId: string, chapterId: string) => {
        const { lastEditedChapterIds } = get();
        const newLastEdited = {
            ...lastEditedChapterIds,
            [storyId]: chapterId
        };
        set({ lastEditedChapterIds: newLastEdited });
        localStorage.setItem('lastEditedChapterIds', JSON.stringify(newLastEdited));
    },

    getLastEditedChapterId: (storyId: string) => {
        const { lastEditedChapterIds } = get();
        return lastEditedChapterIds[storyId] || null;
    },

    // Add new method implementation
    updateChapterOrders: async (updates) => {
        set({ loading: true, error: null });
        try {
            await db.transaction('rw', [db.chapters], async () => {
                await Promise.all(
                    updates.map(({ id, order }) =>
                        db.chapters.update(id, { order })
                    )
                );
            });

            // Update local state
            set(state => ({
                chapters: state.chapters.map(chapter => {
                    const update = updates.find(u => u.id === chapter.id);
                    return update ? { ...chapter, order: update.order } : chapter;
                }),
                loading: false
            }));
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to update chapter orders',
                loading: false
            });
            throw error;
        }
    },

    // --- Branch actions ---

    createBranch: async (parentChapterId, data) => {
        set({ loading: true, error: null });
        try {
            const parentChapter = await db.chapters.get(parentChapterId);
            if (!parentChapter) throw new Error('Parent chapter not found');

            const existingBranches = await db.chapters
                .where('parentChapterId')
                .equals(parentChapterId)
                .toArray();

            const nextBranchOrder = existingBranches.length === 0
                ? 1
                : Math.max(...existingBranches.map(b => b.branchOrder ?? 0)) + 1;

            const parentPrefix = parentChapter.branchLabel ?? String(parentChapter.order);
            const branchLabel = data.branchLabel || `${parentPrefix}-${nextBranchOrder}`;

            const branchId = crypto.randomUUID();
            await db.chapters.add({
                id: branchId,
                storyId: parentChapter.storyId,
                title: data.title,
                content: '',
                order: parentChapter.order,
                wordCount: 0,
                createdAt: new Date(),
                parentChapterId,
                branchLabel,
                branchOrder: nextBranchOrder,
                povCharacter: data.povCharacter ?? parentChapter.povCharacter,
                povType: data.povType ?? parentChapter.povType,
            });

            const newBranch = await db.chapters.get(branchId);
            if (!newBranch) throw new Error('Failed to create branch');

            set(state => ({
                chapters: [...state.chapters, newBranch],
                loading: false
            }));

            return branchId;
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to create branch',
                loading: false
            });
            throw error;
        }
    },

    getBranches: async (parentChapterId: string) => {
        const branches = await db.chapters
            .where('parentChapterId')
            .equals(parentChapterId)
            .sortBy('branchOrder');
        return branches;
    },

    getMainChapters: () => {
        return get().chapters.filter(ch => !ch.parentChapterId);
    },

    deleteBranch: async (branchId: string) => {
        set({ loading: true, error: null });
        try {
            const branch = await db.chapters.get(branchId);
            if (!branch || !branch.parentChapterId) throw new Error('Branch not found');

            // Collect all descendant IDs recursively
            const allDescendantIds: string[] = [];
            const collectDescendants = async (parentId: string) => {
                const children = await db.chapters
                    .where('parentChapterId')
                    .equals(parentId)
                    .toArray();
                for (const child of children) {
                    allDescendantIds.push(child.id);
                    await collectDescendants(child.id);
                }
            };
            await collectDescendants(branchId);

            // Delete all descendants first
            for (const descId of allDescendantIds) {
                await db.chapters.delete(descId);
            }

            await db.chapters.delete(branchId);

            // Re-order remaining siblings
            const siblings = await db.chapters
                .where('parentChapterId')
                .equals(branch.parentChapterId)
                .sortBy('branchOrder');
            for (let i = 0; i < siblings.length; i++) {
                await db.chapters.update(siblings[i].id, { branchOrder: i + 1 });
            }

            // Clean up activeBranchPath references to this branch and all descendants
            const idsToClean = new Set([branchId, ...allDescendantIds]);
            const storyChapters = await db.chapters
                .where('storyId')
                .equals(branch.storyId)
                .toArray();
            for (const ch of storyChapters) {
                if (ch.activeBranchPath) {
                    let changed = false;
                    const newPath = { ...ch.activeBranchPath };
                    for (const key of Object.keys(newPath)) {
                        if (idsToClean.has(key)) {
                            delete newPath[key];
                            changed = true;
                        } else {
                            const filtered = newPath[key].filter(id => !idsToClean.has(id));
                            if (filtered.length !== newPath[key].length) {
                                changed = true;
                                if (filtered.length === 0) delete newPath[key];
                                else newPath[key] = filtered;
                            }
                        }
                    }
                    if (changed) {
                        await db.chapters.update(ch.id, { activeBranchPath: newPath });
                    }
                }
            }

            const updatedChapters = await db.chapters
                .where('storyId')
                .equals(branch.storyId)
                .sortBy('order');

            set(state => ({
                chapters: updatedChapters,
                currentChapter: state.currentChapter?.id === branchId ? null : state.currentChapter,
                loading: false
            }));
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to delete branch',
                loading: false
            });
        }
    },

    updateActiveBranchPath: async (chapterId: string, parentChapterId: string, selectedBranchIds: string[]) => {
        try {
            const chapter = await db.chapters.get(chapterId);
            if (!chapter) throw new Error('Chapter not found');

            const activeBranchPath = { ...(chapter.activeBranchPath || {}) };
            if (selectedBranchIds.length === 0) {
                delete activeBranchPath[parentChapterId];
            } else {
                activeBranchPath[parentChapterId] = selectedBranchIds;
            }

            await db.chapters.update(chapterId, { activeBranchPath });

            set(state => ({
                chapters: state.chapters.map(ch =>
                    ch.id === chapterId ? { ...ch, activeBranchPath } : ch
                ),
                currentChapter: state.currentChapter?.id === chapterId
                    ? { ...state.currentChapter, activeBranchPath }
                    : state.currentChapter,
            }));
        } catch (error) {
            console.error('Failed to update active branch path:', error);
            throw error;
        }
    },

    getChaptersWithBranches: async (storyId: string) => {
        const allChapters = await db.chapters
            .where('storyId')
            .equals(storyId)
            .toArray();

        const branchMap = new Map<string, Chapter[]>();
        for (const ch of allChapters) {
            if (ch.parentChapterId) {
                const existing = branchMap.get(ch.parentChapterId) || [];
                existing.push(ch);
                branchMap.set(ch.parentChapterId, existing);
            }
        }

        // Sort each group by branchOrder
        for (const [key, branches] of branchMap) {
            branchMap.set(key, branches.sort((a, b) => (a.branchOrder ?? 0) - (b.branchOrder ?? 0)));
        }

        return branchMap;
    },
})); 