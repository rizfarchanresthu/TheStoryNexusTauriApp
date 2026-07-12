const ONBOARDING_STORAGE_KEY = "story-nexus:onboarding:v1";

export function hasCompletedOnboarding(storage: Storage = localStorage): boolean {
    return storage.getItem(ONBOARDING_STORAGE_KEY) === "complete";
}

export function completeOnboarding(storage: Storage = localStorage): void {
    storage.setItem(ONBOARDING_STORAGE_KEY, "complete");
}

export function resetOnboarding(storage: Storage = localStorage): void {
    storage.removeItem(ONBOARDING_STORAGE_KEY);
}

export { ONBOARDING_STORAGE_KEY };
