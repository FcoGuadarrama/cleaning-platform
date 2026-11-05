# WORKTREE STATE & HANDOFF LOG
- **Feature:** eas-ios-dev-build (EAS cloud iOS development build from the Docker run command)
- **Current Agent:** claude-code
- **Last Updated:** 2026-11-05T22:26:45Z
- **Branch / Worktree:** feature/agregar-expo-services (current worktree)
- **Base SHA:** 9e3bf4e96816f0fb6e07eaa4d87259815d438b23
- **Contract Version:** docs/contracts/openapi.json unchanged (no API changes)
- **Database:** compose project from .env.worktree; stack verified then stopped with `dev-stack.sh down` (volume kept)

## Microtask checklist
- [x] 1. apps/mobile-client: expo-dev-client ~58.0.18 (SDK 58 bundled), devDependency eas-cli 27.4.1, eas.json profile `development` (developmentClient, internal distribution, node 26.13.0, pnpm 12.16.1). Lockfile regenerated with pnpm 12.16.1 in node:26.13.0.
- [x] 2. pnpm-workspace.yaml `allowBuilds` denies dtrace-provider and protobufjs (eas-cli transitive; pnpm 12 fails with ERR_PNPM_IGNORED_BUILDS otherwise).
- [x] 3. docker-compose.yml one-off `eas` service (profile `eas`): EAS_NO_VCS=1, EAS_PROJECT_ROOT=/repo, bind-mount apps/mobile-client, anonymous volume for its node_modules, `expo-home` volume for Expo/Apple sessions. node.Dockerfile copies .gitignore so EAS uses git's ignore rules.
- [x] 4. scripts/dev-stack.sh: `up [-d] [--ios]` (--ios runs `eas build --platform ios --profile development --no-wait` first and aborts the stack if it fails) and `eas <args>` passthrough.
- [x] 5. Docs: RUNNING.md (Spanish owner guide), ARCHITECTURE.md, VERSIONS.md, AGENTS.md commands.

## Immediate context / Handoff notes
Not done, needs the owner: `eas login`, `eas device:create` and the first real build (interactive Apple/Expo prompts write extra.eas.projectId and ios.bundleIdentifier into app.json). No cloud build was submitted by the agent (EAS quota = owner spend).
Open follow-up: the dev build loads JS from Metro, but Docker binds Metro and the API to 127.0.0.1, so a phone cannot reach them yet.

## Verification
- `dev-stack.sh eas --version` → eas-cli/27.4.1 linux-arm64 node-v26.13.0.
- `expo config --type public` resolves inside the eas container.
- eas-cli 27.4.1 source: NoVcsClient honors absolute EAS_PROJECT_ROOT; node_modules is always ignored.
- `dev-stack.sh up -d`: api healthy, admin created, web 200, Expo web index 200 and web bundle 200 (4.2 MB) with expo-dev-client installed.
- `dev-stack.sh up -d --ios` without an Expo session: EAS reports login required, script exits before starting the stack (0 containers).
- Invalid args (`bogus`, `up --nope`) print usage and exit 2. `bash -n` clean. shellcheck/aislop not installed; not run.

## Partial work
None.
