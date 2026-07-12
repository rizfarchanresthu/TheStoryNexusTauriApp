import { FormEvent, useEffect, useState } from "react";
import {
    Bot,
    BookOpen,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    FilePlus,
    KeyRound,
    ListChecks,
    Loader2,
    PenLine,
    Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAIStore } from "@/features/ai/stores/useAIStore";
import { aiService } from "@/services/ai/AIService";
import { LOCAL_RUNTIME_PRESETS } from "@/services/ai/localRuntime";
import type { AIProvider, LocalAIRuntime } from "@/types/story";

type WizardStep = "welcome" | "ai" | "prompts" | "story" | "scenebeat" | "finish";
type ProviderChoice = AIProvider;

type StarterStoryInput = {
    title: string;
    author: string;
    language: string;
    synopsis: string;
    chapterTitle: string;
};

type StartupWizardProps = {
    open: boolean;
    hasStories: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete: () => void;
    onCreateStarterStory: (input: StarterStoryInput) => Promise<void>;
};

const steps: Array<{ id: WizardStep; label: string; icon: typeof Sparkles }> = [
    { id: "welcome", label: "Start", icon: Sparkles },
    { id: "ai", label: "AI", icon: Bot },
    { id: "prompts", label: "Prompts", icon: ListChecks },
    { id: "story", label: "Story", icon: BookOpen },
    { id: "scenebeat", label: "SceneBeat", icon: PenLine },
    { id: "finish", label: "Finish", icon: CheckCircle2 },
];

const providerLabels: Record<ProviderChoice, string> = {
    local: "Local model",
    openai: "OpenAI",
    openrouter: "OpenRouter",
    nanogpt: "NanoGPT",
    google: "Google AI",
    openai_compatible: "OpenAI-compatible",
};

export function StartupWizard({
    open,
    hasStories,
    onOpenChange,
    onComplete,
    onCreateStarterStory,
}: StartupWizardProps) {
    const [stepIndex, setStepIndex] = useState(0);
    const [provider, setProvider] = useState<ProviderChoice>("local");
    const [apiKey, setApiKey] = useState("");
    const [compatibleUrl, setCompatibleUrl] = useState("");
    const [localRuntime, setLocalRuntime] = useState<LocalAIRuntime>("lm_studio");
    const [localApiUrl, setLocalApiUrl] = useState(LOCAL_RUNTIME_PRESETS.lm_studio.apiUrl);
    const [localModelsUrl, setLocalModelsUrl] = useState(LOCAL_RUNTIME_PRESETS.lm_studio.modelsUrl);
    const [aiStatus, setAiStatus] = useState("");
    const [storyTitle, setStoryTitle] = useState("Untitled Nexus");
    const [author, setAuthor] = useState("Author");
    const [language, setLanguage] = useState("English");
    const [synopsis, setSynopsis] = useState("");
    const [chapterTitle, setChapterTitle] = useState("Chapter One");
    const [isSavingAI, setIsSavingAI] = useState(false);
    const [isCreatingStory, setIsCreatingStory] = useState(false);

    const { initialize, settings } = useAIStore();

    const activeStep = steps[stepIndex];
    const progress = ((stepIndex + 1) / steps.length) * 100;

    useEffect(() => {
        if (!open) return;

        initialize().catch((error) => {
            console.error("Failed to initialize AI settings for onboarding:", error);
        });
    }, [initialize, open]);

    useEffect(() => {
        if (!settings) return;

        setLocalRuntime(settings.localRuntime || "lm_studio");
        setLocalApiUrl(settings.localApiUrl || LOCAL_RUNTIME_PRESETS[settings.localRuntime || "lm_studio"].apiUrl);
        setLocalModelsUrl(settings.localModelsUrl || LOCAL_RUNTIME_PRESETS[settings.localRuntime || "lm_studio"].modelsUrl);
        setCompatibleUrl(settings.openaiCompatibleUrl || "");
    }, [settings]);

    const goNext = () => setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    const goBack = () => setStepIndex((current) => Math.max(current - 1, 0));

    const handleSkip = () => {
        onComplete();
        onOpenChange(false);
        toast.info("Startup wizard skipped");
    };

    const handleSaveAI = async () => {
        setIsSavingAI(true);
        setAiStatus("");

        try {
            await aiService.initialize();

            if (provider === "local") {
                await aiService.updateLocalRuntime(localRuntime);
                await aiService.updateLocalApiUrl(localApiUrl);
                await aiService.updateLocalModelsUrl(localModelsUrl);
                const models = await aiService.getAvailableModels("local", true);
                setAiStatus(models.length > 0
                    ? `${models.length} local model${models.length === 1 ? "" : "s"} available.`
                    : "Local settings saved. No models were returned yet."
                );
            } else {
                if (!apiKey.trim()) {
                    setAiStatus("Add an API key, or skip this step and configure AI later.");
                    return;
                }

                if (provider === "openai_compatible") {
                    if (!compatibleUrl.trim()) {
                        setAiStatus("Add an OpenAI-compatible base URL before saving.");
                        return;
                    }
                    await aiService.updateOpenAICompatibleUrl(compatibleUrl.trim());
                }

                await aiService.updateKey(provider, apiKey.trim());
                const models = await aiService.getAvailableModels(provider, false);
                setAiStatus(`${providerLabels[provider]} saved with ${models.length} available model${models.length === 1 ? "" : "s"}.`);
                setApiKey("");
            }

            await initialize();
            toast.success("AI setup saved");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to save AI setup";
            setAiStatus(message);
            toast.error(message);
        } finally {
            setIsSavingAI(false);
        }
    };

    const handleCreateStarterStory = async (event: FormEvent) => {
        event.preventDefault();
        if (!storyTitle.trim() || !author.trim() || !chapterTitle.trim()) return;

        setIsCreatingStory(true);
        try {
            await onCreateStarterStory({
                title: storyTitle.trim(),
                author: author.trim(),
                language,
                synopsis: synopsis.trim(),
                chapterTitle: chapterTitle.trim(),
            });
            toast.success("Starter story created");
            goNext();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create starter story");
        } finally {
            setIsCreatingStory(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                data-testid="startup-wizard"
                className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-3xl flex-col overflow-hidden p-0 sm:rounded-lg"
            >
                <DialogHeader className="border-b px-6 py-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">First run</Badge>
                        <DialogTitle>Set up The Story Nexus</DialogTitle>
                    </div>
                    <DialogDescription>
                        A short path from AI setup to your first SceneBeat.
                    </DialogDescription>
                    <Progress value={progress} className="mt-3" />
                </DialogHeader>

                <div className="grid min-h-0 flex-1 md:grid-cols-[180px_minmax(0,1fr)]">
                    <nav className="hidden border-r bg-muted/20 p-3 md:block">
                        <div className="space-y-1">
                            {steps.map((step, index) => (
                                <button
                                    key={step.id}
                                    type="button"
                                    onClick={() => setStepIndex(index)}
                                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                        index === stepIndex
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    }`}
                                >
                                    <step.icon className="h-4 w-4" />
                                    <span>{step.label}</span>
                                </button>
                            ))}
                        </div>
                    </nav>

                    <div className="min-h-0 overflow-y-auto px-6 py-5">
                        <StepHeading step={activeStep} />

                        {activeStep.id === "welcome" && (
                            <div className="space-y-4">
                                <p className="text-sm leading-6 text-muted-foreground">
                                    This setup saves only local app settings. You can skip anything and return to the same tools from the editor rail.
                                </p>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <MiniCard icon={KeyRound} title="Connect AI" text="Local or hosted providers." />
                                    <MiniCard icon={ListChecks} title="Learn prompts" text="Understand the pieces that guide generation." />
                                    <MiniCard icon={FilePlus} title="Make a chapter" text="Open the editor with a real target." />
                                </div>
                            </div>
                        )}

                        {activeStep.id === "ai" && (
                            <div className="space-y-5">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label>Provider</Label>
                                        <Select value={provider} onValueChange={(value) => setProvider(value as ProviderChoice)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(providerLabels).map(([value, label]) => (
                                                    <SelectItem key={value} value={value}>
                                                        {label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {provider === "local" ? (
                                        <div className="grid gap-2">
                                            <Label>Runtime</Label>
                                            <Select value={localRuntime} onValueChange={(value) => {
                                                const runtime = value as LocalAIRuntime;
                                                setLocalRuntime(runtime);
                                                setLocalApiUrl(LOCAL_RUNTIME_PRESETS[runtime].apiUrl);
                                                setLocalModelsUrl(LOCAL_RUNTIME_PRESETS[runtime].modelsUrl);
                                            }}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.values(LOCAL_RUNTIME_PRESETS).map((preset) => (
                                                        <SelectItem key={preset.runtime} value={preset.runtime}>
                                                            {preset.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : (
                                        <div className="grid gap-2">
                                            <Label>API Key</Label>
                                            <Input
                                                type="password"
                                                value={apiKey}
                                                onChange={(event) => setApiKey(event.target.value)}
                                                placeholder="Paste API key"
                                            />
                                        </div>
                                    )}
                                </div>

                                {provider === "local" && (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label>Chat API Base URL</Label>
                                            <Input value={localApiUrl} onChange={(event) => setLocalApiUrl(event.target.value)} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Models URL</Label>
                                            <Input value={localModelsUrl} onChange={(event) => setLocalModelsUrl(event.target.value)} />
                                        </div>
                                    </div>
                                )}

                                {provider === "openai_compatible" && (
                                    <div className="grid gap-2">
                                        <Label>Base URL</Label>
                                        <Input
                                            value={compatibleUrl}
                                            onChange={(event) => setCompatibleUrl(event.target.value)}
                                            placeholder="https://your-api.example/v1"
                                        />
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    <Button onClick={handleSaveAI} disabled={isSavingAI}>
                                        {isSavingAI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                                        Save AI Setup
                                    </Button>
                                    <Button variant="outline" onClick={goNext}>
                                        Configure later
                                    </Button>
                                </div>

                                {aiStatus && (
                                    <Alert>
                                        <AlertTitle>AI setup</AlertTitle>
                                        <AlertDescription>{aiStatus}</AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        )}

                        {activeStep.id === "prompts" && (
                            <div className="space-y-5">
                                <div className="rounded-md border bg-muted/20 p-4">
                                    <div className="font-medium">Prompt basics</div>
                                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                                        <li><span className="text-foreground">System</span> messages set the writing behavior.</li>
                                        <li><span className="text-foreground">User</span> messages hold the task and story context.</li>
                                        <li><span className="text-foreground">Variables</span> like {"{{scenebeat}}"} and {"{{previous_words(500)}}"} are filled in before generation.</li>
                                    </ul>
                                </div>
                                <div className="rounded-md border p-4">
                                    <div className="font-medium">What SceneBeat prompts usually include</div>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        A SceneBeat prompt typically combines your instruction, nearby chapter text, story context, and any matched lorebook entries. You can inspect and edit those prompts later from the editor's Prompts tool.
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeStep.id === "story" && (
                            <form className="space-y-4" onSubmit={handleCreateStarterStory}>
                                {hasStories ? (
                                    <Alert>
                                        <AlertTitle>Story found</AlertTitle>
                                        <AlertDescription>
                                            You already have a story. Continue to the editor whenever you are ready.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label htmlFor="onboarding-story-title">Story Title</Label>
                                                <Input id="onboarding-story-title" value={storyTitle} onChange={(event) => setStoryTitle(event.target.value)} required />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="onboarding-author">Author</Label>
                                                <Input id="onboarding-author" value={author} onChange={(event) => setAuthor(event.target.value)} required />
                                            </div>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label>Language</Label>
                                                <Select value={language} onValueChange={setLanguage}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="English">English</SelectItem>
                                                        <SelectItem value="Spanish">Spanish</SelectItem>
                                                        <SelectItem value="French">French</SelectItem>
                                                        <SelectItem value="German">German</SelectItem>
                                                        <SelectItem value="Chinese">Chinese</SelectItem>
                                                        <SelectItem value="Japanese">Japanese</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="onboarding-chapter-title">First Chapter</Label>
                                                <Input id="onboarding-chapter-title" value={chapterTitle} onChange={(event) => setChapterTitle(event.target.value)} required />
                                            </div>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="onboarding-synopsis">Synopsis</Label>
                                            <Textarea
                                                id="onboarding-synopsis"
                                                value={synopsis}
                                                onChange={(event) => setSynopsis(event.target.value)}
                                                placeholder="Optional"
                                                className="min-h-[96px]"
                                            />
                                        </div>
                                        <Button type="submit" disabled={isCreatingStory}>
                                            {isCreatingStory ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus className="mr-2 h-4 w-4" />}
                                            Create Starter Story
                                        </Button>
                                    </>
                                )}
                            </form>
                        )}

                        {activeStep.id === "scenebeat" && (
                            <div className="space-y-4">
                                <Alert>
                                    <PenLine className="h-4 w-4" />
                                    <AlertTitle>Write from a SceneBeat</AlertTitle>
                                    <AlertDescription>
                                        Insert a SceneBeat in the editor, describe the next moment, then click Generate Prose.
                                    </AlertDescription>
                                </Alert>
                                <div className="rounded-md border p-4">
                                    <div className="font-medium">How to insert one in the editor</div>
                                    <ol className="mt-3 ml-4 list-decimal space-y-2 text-sm text-muted-foreground">
                                        <li>Place your cursor where the generated prose should be anchored.</li>
                                        <li>Open the editor toolbar's <span className="text-foreground">Insert</span> menu and choose <span className="text-foreground">Scene Beat</span>.</li>
                                        <li>Or type <span className="font-mono text-foreground">/</span>, choose <span className="text-foreground">Scene Beat</span> from the command menu, and press Enter.</li>
                                        <li>You can also press <span className="font-mono text-foreground">Alt+S</span> while focused in the editor.</li>
                                    </ol>
                                </div>
                                <div className="rounded-md border bg-muted/20 p-4">
                                    <div className="font-medium">Starter SceneBeat example</div>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        The protagonist enters the central location for the first time and notices one detail that should not be there.
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeStep.id === "finish" && (
                            <div className="space-y-4">
                                <Alert>
                                    <CheckCircle2 className="h-4 w-4" />
                                    <AlertTitle>Ready to write</AlertTitle>
                                    <AlertDescription>
                                        The editor is ready. You can reopen AI settings, prompts, and the guide from the right tool rail.
                                    </AlertDescription>
                                </Alert>
                                <Button onClick={() => {
                                    onComplete();
                                    onOpenChange(false);
                                }}>
                                    Finish Setup
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="border-t px-6 py-4 sm:justify-between">
                    <Button type="button" variant="ghost" onClick={handleSkip}>
                        Skip wizard
                    </Button>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={goBack} disabled={stepIndex === 0}>
                            <ChevronLeft className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                        <Button type="button" onClick={goNext} disabled={stepIndex === steps.length - 1}>
                            Next
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function StepHeading({ step }: { step: { label: string; icon: typeof Sparkles } }) {
    return (
        <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <step.icon className="h-5 w-5" />
            </div>
            <div>
                <div className="text-xl font-semibold">{step.label}</div>
                <div className="text-sm text-muted-foreground">Step through the essentials at your pace.</div>
            </div>
        </div>
    );
}

function MiniCard({
    icon: Icon,
    title,
    text,
}: {
    icon: typeof Sparkles;
    title: string;
    text: string;
}) {
    return (
        <div className="rounded-md border bg-card p-4">
            <Icon className="h-5 w-5 text-primary" />
            <div className="mt-3 font-medium">{title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{text}</div>
        </div>
    );
}
