# Version matrix

Verified: **2026-11-03** (registry queries + official release pages). Policy: latest official LTS
line + latest patch where an LTS channel exists; otherwise "No official LTS channel" and latest
stable. No alpha/beta/rc/nightly/canary/Innovation. Upgrades are reviewed changes, never floating.

| Technology | Selected | LTS status | Evidence | Constraints / notes | Support end |
|---|---|---|---|---|---|
| MySQL | **9.7.4** (`mysql:9.7.4@sha256:df90258da46f6e7ff8574ff84f17618aba0765cac749928299c69fd4e7cb8ad8`) | Official LTS (9.7 LTS; supersedes 8.4 LTS) | https://dev.mysql.com/doc/refman/en/mysql-releases.html , https://hub.docker.com/_/mysql | InnoDB, utf8mb4 / utf8mb4_0900_ai_ci, STRICT sql_mode, REPEATABLE READ — see `infra/mysql/my.cnf` | Per Oracle lifetime policy (not stated on page) |
| Python | **3.15.2** (`python:3.15.2-slim@sha256:8c13a3f37a6a5b71498228e902c4b9f51c1f7900d49fabf71f9a650c6120e0d0`) | No official LTS channel (PEP 602 lifecycle); latest bugfix branch | https://devguide.python.org/versions/ | Local dev via `uv python install 3.15.2` | 2031-10 (scheduled) |
| Node.js | **26.13.0** (`node:26.13.0-slim@sha256:e4db4c914bf8ad241bd24804fc25d272d89bad97e68cdc8a1414862790a02c39`) | Official LTS (v26 "Lithium") | https://nodejs.org/en/about/previous-releases | Tooling/build only; host currently has 24.22 (also LTS) — CI pins 26.13.0 | Not stated on page |
| pnpm | 12.16.1 | No official LTS channel | https://www.npmjs.com/package/pnpm | Pinned via `packageManager` (corepack) | — |
| FastAPI | 0.162.0 | No official LTS channel | https://pypi.org/project/fastapi/ | Emits OpenAPI 3.1 | — |
| Pydantic | 2.14.2 | No official LTS channel | https://pypi.org/project/pydantic/ | | — |
| SQLAlchemy | 2.1.6 | No official LTS channel | https://pypi.org/project/SQLAlchemy/ | async engine, `mysql+asyncmy` | — |
| Alembic | 1.20.1 | No official LTS channel | https://pypi.org/project/alembic/ | | — |
| asyncmy | 0.2.17 | No official LTS channel | https://pypi.org/project/asyncmy/ | Async MySQL driver supported by SQLAlchemy dialects | — |
| HTTPX | 0.28.1 | No official LTS channel | https://pypi.org/project/httpx/ | Runtime since task 012 (Expo push calls); same version the tests already used (verified 2026-11-13) | — |
| Uvicorn | 0.54.0 | No official LTS channel | https://pypi.org/project/uvicorn/ | | — |
| Vue | 3.5.44 | No official LTS channel | https://www.npmjs.com/package/vue | | — |
| Vite | 8.3.5 | No official LTS channel | https://www.npmjs.com/package/vite | | — |
| Pinia | 4.1.0 | No official LTS channel | https://www.npmjs.com/package/pinia | | — |
| Vue Router | 5.4.0 | No official LTS channel | https://www.npmjs.com/package/vue-router | | — |
| Tailwind CSS (dashboard) | 4.3.4 + `@tailwindcss/vite` 4.3.4 | No official LTS channel | https://www.npmjs.com/package/tailwindcss | CSS-first `@theme` fed by design tokens | — |
| shadcn-vue (CLI, not a dependency) | 2.9.0 | No official LTS channel | https://www.npmjs.com/package/shadcn-vue | Used once via `npx shadcn-vue@2.9.0 add …`; components are copied into `apps/web-dashboard/src/components/ui/` and owned by the repo. Verified 2026-11-05. | — |
| Reka UI | 2.11.0 | No official LTS channel; 3.0 is **alpha only** → not eligible | https://www.npmjs.com/package/reka-ui | Headless primitives behind shadcn-vue (dialog, sheet, tabs, menu, listbox) | — |
| class-variance-authority / clsx / tailwind-merge | 0.7.1 / 2.1.1 / 3.7.0 | No official LTS channel | npm registry | `cn()` and component variants; tailwind-merge 3.x targets Tailwind 4 | — |
| @vueuse/core | 15.0.0 | No official LTS channel | https://www.npmjs.com/package/@vueuse/core | Required by shadcn-vue components | — |
| @lucide/vue | 1.65.0 | No official LTS channel | https://www.npmjs.com/package/@lucide/vue | Replaces deprecated `lucide-vue-next` | — |
| vue-sonner | 2.0.9 | No official LTS channel | https://www.npmjs.com/package/vue-sonner | Toasts (`import "vue-sonner/style.css"`) | — |
| tw-animate-css | 1.4.0 | No official LTS channel | https://www.npmjs.com/package/tw-animate-css | Enter/exit keyframes used by shadcn-vue overlays | — |
| TypeScript | **6.0.3** | No official LTS channel | https://www.npmjs.com/package/typescript , `expo install --check` (SDK 58 expects ~6.0.3) | **Documented conflict:** latest stable 7.0.2 (native Go compiler) has no JS compiler API (`ts.factory` undefined) → `openapi-typescript` 7.13.0 crashes and `vue-tsc` 3.3.14 (Volar) needs the same API. Decision 2026-11-03 (Shep decision defaulted to the recommendation; owner may override): stay on the JS-based line. Refined from 5.9.3 to 6.0.3 because Expo SDK 58 requires ~6.0.3; openapi-typescript declares peer `^5.x` but generates byte-identical output on 6.0.3 (explicit `peerDependencyRules` in pnpm-workspace.yaml). Recheck when tools support TS 7. | — |
| openapi-typescript / openapi-fetch | 7.13.0 / 0.17.0 | No official LTS channel | https://openapi-ts.dev | Supports OpenAPI 3.1 (`anyOf` null, `const`, `examples`) as emitted by FastAPI | — |
| Expo SDK | **58** (`expo` 58.0.22) | No official LTS channel (SDK cadence) | https://www.npmjs.com/package/expo , `bundledNativeModules.json` @ sdk-58 | Dictates the versions below | Expo supports latest SDKs only |
| react-native-web | **0.21.4** | No official LTS channel | Installed Expo SDK 58 `bundledNativeModules.json` (`~0.21.4`) | Required for the mobile client web target; exact version pinned. | — |
| React Native | 0.88.1 | No official LTS channel | SDK 58 bundledNativeModules | Fixed by Expo SDK 58 | — |
| React | 19.3.0 | No official LTS channel | SDK 58 bundledNativeModules | Fixed by Expo SDK 58 (npm latest 19.3.1 not used) | — |
| Expo Router | ~58.0.29 | No official LTS channel | SDK 58 bundledNativeModules | | — |
| react-native-css-interop | 0.2.7 | No official LTS channel | nativewind@4.2.7 dependency | Direct dependency so Metro resolves it under pnpm isolated installs | — |
| expo-location / expo-secure-store | ~58.0.20 / ~58.0.2 | No official LTS channel | SDK 58 bundledNativeModules | Foreground location only | — |
| expo-notifications / expo-device | ~58.1.9 / ~58.0.5 | No official LTS channel | SDK 58 bundledNativeModules (`~58.1.7` / `~58.0.5`), verified 2026-11-13 | Push token + permissions (task 012); config plugin in app.json. Push on devices needs an EAS project id | — |
| react-native-svg | 15.16.0 | No official LTS channel | SDK 58 bundledNativeModules (`15.16.0`, exact) | Mobile icon set (`apps/mobile-client/src/icons.tsx`); no icon font dependency | — |
| expo-font | ~58.0.11 | No official LTS channel | SDK 58 bundledNativeModules (`~58.0.11`) | Loads the brand typeface (`apps/mobile-client/src/fonts.ts`) | — |
| @expo-google-fonts/outfit | 0.4.2 | No official LTS channel | https://www.npmjs.com/package/@expo-google-fonts/outfit (published 2025-06-06; 0.4.3 exists, 0.4.2 kept as the older verified build) | Outfit 400–800, the "brisa" brand typeface (owner choice 2026-11-06); **needs review** | — |
| NativeWind | 4.2.7 | No official LTS channel; v5 is **rc only** → not eligible | https://www.npmjs.com/package/nativewind (dist-tags) | Requires Tailwind **3.4.x** (`3.4.19`) on mobile; dashboard uses Tailwind 4. Verified 2026-11-03: `expo export` for iOS and Android bundles successfully with RN 0.88.1 / Reanimated 4.7.1; device run still pending. | — |
| Nginx | 1.30.6 (`nginx:1.30.6-alpine@sha256:0e52bd054126cdc040b1276c0af347aeb02a41b9cfe305d6094767ac30e97949`) | Nginx "stable" branch (not called LTS) | https://nginx.org/en/download.html | | — |

## Upgrade procedure
1. Re-verify from the evidence URLs; update this table and the verification date.
2. Update `uv.lock` / `pnpm-lock.yaml` / image digests in one PR; CI must pass against MySQL.
