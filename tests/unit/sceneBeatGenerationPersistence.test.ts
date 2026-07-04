import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  persistAcceptedSceneBeat,
  persistRejectedSceneBeat,
} from "@/features/scenebeats/services/sceneBeatGenerationPersistence";
import { useSceneBeatStore } from "@/features/scenebeats/stores/useSceneBeatStore";
import { db } from "@/services/database";
import type { SceneBeat } from "@/types/story";

const sceneBeat: SceneBeat = {
  id: "scene-beat-persistence-test",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  storyId: "story-1",
  chapterId: "chapter-1",
  command: "Write the next beat.",
  generatedContent: "Old generated prose.",
  accepted: false,
};

describe("SceneBeat generation persistence", () => {
  beforeEach(async () => {
    await db.sceneBeats.clear();
    await db.sceneBeats.add(sceneBeat);
    useSceneBeatStore.setState({
      sceneBeats: [sceneBeat],
      sceneBeatsById: { [sceneBeat.id]: sceneBeat },
      loadedChapterId: sceneBeat.chapterId,
      currentSceneBeat: sceneBeat,
      loading: false,
      error: null,
    });
  });

  afterEach(async () => {
    await db.sceneBeats.clear();
    useSceneBeatStore.getState().clearSceneBeats();
    useSceneBeatStore.setState({ loading: false, error: null, currentSceneBeat: null });
  });

  test("accepting generated prose marks the database row and cache as accepted", async () => {
    await persistAcceptedSceneBeat(sceneBeat.id, "Accepted generated prose.");

    const persisted = await db.sceneBeats.get(sceneBeat.id);
    const cached = useSceneBeatStore.getState().getCachedSceneBeat(sceneBeat.id);
    const current = useSceneBeatStore.getState().currentSceneBeat;

    expect(persisted).toMatchObject({
      generatedContent: "Accepted generated prose.",
      accepted: true,
    });
    expect(cached).toMatchObject({
      generatedContent: "Accepted generated prose.",
      accepted: true,
    });
    expect(current).toMatchObject({
      generatedContent: "Accepted generated prose.",
      accepted: true,
    });
  });

  test("rejecting generated prose clears the database row and cache", async () => {
    await persistRejectedSceneBeat(sceneBeat.id);

    const persisted = await db.sceneBeats.get(sceneBeat.id);
    const cached = useSceneBeatStore.getState().getCachedSceneBeat(sceneBeat.id);
    const current = useSceneBeatStore.getState().currentSceneBeat;

    expect(persisted).toMatchObject({
      generatedContent: "",
      accepted: false,
    });
    expect(cached).toMatchObject({
      generatedContent: "",
      accepted: false,
    });
    expect(current).toMatchObject({
      generatedContent: "",
      accepted: false,
    });
  });
});
