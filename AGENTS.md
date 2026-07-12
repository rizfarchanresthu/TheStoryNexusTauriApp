# Repository Working Rules

These rules apply to all coding work in this repository.

## Default Workflow

1. Read the relevant code before changing it.
2. Keep changes scoped to the user request.
3. Prefer existing patterns, stores, components, and helper APIs.
4. Do not revert unrelated user changes.
5. Document important behavior, setup, or testing changes as part of the same task.
6. Finish with verification: run the smallest useful test set, plus broader tests when the change has wider risk.

## Sandbox Approval Preferences

The user is comfortable with Codex running non-destructive local git inspection commands, including:

- `git status`
- `git diff`
- `git log`
- `git branch`
- `git rev-parse`
- `git show`

The user is also comfortable with Codex running routine npm project commands, including:

- `npm.cmd install`
- `npm.cmd run build`
- `npm.cmd run test:unit`
- `npm.cmd run test:e2e:editor`
- `npm.cmd run test:e2e:llm`
- `npm.cmd run dev`

If one of these commands fails because of sandbox restrictions, rerun it with escalation and request an appropriate persistent prefix rule when useful.

Do not escalate destructive git commands such as `git reset`, `git checkout`, `git clean`, branch deletion, or file removal unless the user explicitly requests them. Remote/network commands such as `git fetch`, `git pull`, `git push`, package downloads, or dependency installs may still require approval because they contact external services.

## Testing Expectations

Run enough tests for the risk of the change. Do not leave testing as an afterthought.

### Always Consider

- `npm.cmd run build`
  - Run after TypeScript, Vite, dependency, routing, AI service, database, or shared component changes.
- `npm.cmd run test:unit`
  - Run after service, utility, database helper, parser, backup/import/export, or other non-UI logic changes.
- `npm.cmd run test:e2e:editor`
  - Run after editor, Lexical, chapter content, SceneBeat insertion/removal, autosave, or editor layout changes.
- `npm.cmd run test:e2e:llm`
  - Run after local AI generation, prompt selection/defaults, SceneBeat generation, summary generation, streaming parsing, or model/provider routing changes.

### Local LLM Tests

The local LLM lane must never spend paid API credits.

- The test health check uses LM Studio at `http://localhost:1234/api/v1/models`.
- The app generation API base defaults to `http://localhost:1234/v1`.
- Tests must abort if LM Studio is unreachable or has no loaded model.
- Tests must block paid-provider hosts, including OpenAI, OpenRouter, NanoGPT, and Google AI endpoints.
- If local LLM tests cannot run because LM Studio is not available, say that explicitly in the final result.

### What To Report

In the final response, include:

- what changed
- which tests were run
- whether any tests could not be run and why
- important warnings that remain, such as existing bundle-size or Browserslist warnings
- Do not report the known `npm.cmd run build` warnings for Lexical Rollup pure-comment annotations or the existing large chunk size unless they change or become relevant to the task.

## Editor And Lexical Rules

- Prefer testing serialized Lexical state over brittle caret DOM assumptions.
- Use the Playwright E2E bridge only behind `VITE_E2E=true`.
- Preserve autosave behavior and save-status UX.
- When changing SceneBeat behavior, cover insertion, generation, acceptance, deletion/backspace behavior, and persisted chapter content when relevant.
- Do not introduce test-only runtime behavior into production mode.

## AI And Provider Safety

- Local generation should use the configured local model when available.
- Do not silently fall back from local tests to paid providers.
- Do not add API keys, secrets, or real user data to the repo.
- Keep prompt/model defaults explicit when tests depend on them.
- Prefer OpenAI-compatible local routes for generation and LM Studio native routes for health checks when using LM Studio.

## Documentation Rules

Update docs when adding or changing:

- commands
- setup steps
- test strategy
- local LLM behavior
- editor architecture
- non-obvious debugging or recovery workflows

Use `docs/PLAYWRIGHT_EDITOR_TESTING.md` for Playwright/editor/LLM test notes.

## Release Automation

When the user says changes have been added, committed, and pushed, and asks to create a new release:

1. Read the release version from `package.json` unless the user gives a specific version.
2. Confirm the working tree is clean with `git status --short`. Do not create a release from a dirty tree unless the user explicitly asks.
3. Confirm GitHub CLI auth with `gh auth status`. If `gh` is not in PATH on Windows, check `C:\Program Files\GitHub CLI\gh.exe`.
4. Run a preview first:

```powershell
make -f Makefile release-dry-run VERSION=<version>
```

5. If the dry run shows the correct user-facing release body and assets, create the release:

```powershell
make -f Makefile release VERSION=<version>
```

Release notes live in `docs/releases/<version>.md`. The `## GitHub Release Body` section must be user-facing only: mention new user-visible features, upgrade notes, and the MSI users should download. Do not include maintainer checklists, command-line steps, `.sig`, `latest.json`, updater signing internals, or other development details in the public release body.

The release command builds, tests, creates the signed MSI, generates updater metadata, creates and pushes the git tag, creates the GitHub release, and uploads the MSI, `.sig`, and `latest.json`. Do not commit generated release artifacts or local updater secrets.

## UI Rules

- Keep the app editor-first.
- Avoid landing-page or marketing-style layouts inside the app.
- Use existing UI primitives and Lucide icons.
- Add stable `data-testid` attributes only where role/name selectors are not stable enough for important E2E coverage.
- Do not add visible explanatory text just for tests.

## Code Hygiene

- Keep comments sparse and useful.
- Avoid broad refactors during bug fixes.
- Prefer structured parsing and typed data over ad hoc string manipulation.
- Keep generated artifacts, reports, and caches out of git.
- If a test exposes a real app bug, fix the app instead of weakening the test.

## Current Useful Commands

```powershell
npm.cmd run build
npm.cmd run test:unit
npm.cmd run test:e2e:editor
npm.cmd run test:e2e:llm
```
