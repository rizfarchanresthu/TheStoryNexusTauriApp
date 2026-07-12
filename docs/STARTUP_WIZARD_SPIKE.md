# Startup Wizard Spike

## Goal

Add a low-risk first-run setup path that takes a new user from an empty workspace to a usable editor setup:

1. Pick an AI provider and save the basic connection settings.
2. Learn the minimum prompt concepts needed for SceneBeat generation.
3. Create a starter story and first chapter.
4. Arrive in the editor with guidance for creating a SceneBeat and generating prose.

## Initial Implementation

The first implementation is intentionally a guided dialog mounted in `EditorWorkspace` instead of a separate route. The app is already editor-first, so the wizard appears only after the editor workspace has initialized and only when:

- no stories exist, and
- `story-nexus:onboarding:v1` is not marked complete in `localStorage`.

The wizard currently lives in:

- `src/features/onboarding/components/StartupWizard.tsx`
- `src/features/onboarding/onboardingStorage.ts`

The editor integration lives in:

- `src/features/editor/pages/EditorWorkspace.tsx`

## Scope

Included:

- First-run completion flag.
- Skip and finish flows.
- A Basics guide action for reopening the startup wizard after first run.
- Basic provider setup for local, OpenAI, OpenRouter, NanoGPT, Google AI, and OpenAI-compatible endpoints.
- Prompt basics that explain message roles and common SceneBeat variables.
- Starter story and chapter creation using existing story/chapter stores.
- SceneBeat insertion and prose generation guidance.

Not included yet:

- Playwright coverage.
- Automated insertion of a SceneBeat from the wizard.
- Automated prose generation from the wizard.
- A reset/reopen button in settings.
- A dedicated health check UI for paid providers beyond model refresh errors.

## Design Notes

The SceneBeat step explains the same insertion paths available in the editor: toolbar insert menu, slash command, and `Alt+S`.

The AI step calls the existing `AIService` methods instead of creating new persistence logic. The prompt step is informational and leaves prompt/default editing to the existing editor tools.

## Suggested Next Steps

1. Add a settings action to reset onboarding state entirely.
2. Add an editor command that inserts a SceneBeat and focuses its command textarea.
3. Add E2E coverage for first-run display, guide reopen, skip/finish persistence, and starter story creation.
4. Consider adding a non-network "configure later" lane to the AI step for users who want to write without AI immediately.
