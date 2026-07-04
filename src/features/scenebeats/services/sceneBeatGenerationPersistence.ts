import { useSceneBeatStore } from "@/features/scenebeats/stores/useSceneBeatStore";

export async function persistAcceptedSceneBeat(sceneBeatId: string, generatedContent: string): Promise<void> {
    await useSceneBeatStore.getState().updateSceneBeat(sceneBeatId, {
        generatedContent,
        accepted: true,
    });
}

export async function persistRejectedSceneBeat(sceneBeatId: string): Promise<void> {
    await useSceneBeatStore.getState().updateSceneBeat(sceneBeatId, {
        generatedContent: "",
        accepted: false,
    });
}
