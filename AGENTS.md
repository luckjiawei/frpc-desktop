# Repository Guidelines

## Project Overview

Frpc-Desktop is a cross-platform Tauri 2 desktop application. The webview UI uses Vue 3, TypeScript, Vite, Pinia, Vue Router, Element Plus, and vue-i18n. The Rust backend in `src-tauri/` manages frpc processes, SQLite persistence, downloads, system integration, tray, autostart, and IPC.

Use Node.js 22.12 or newer, npm, and a stable Rust toolchain. Keep changes focused; do not edit generated output or downloaded dependencies.

## Repository Layout

- `src/`: Vue webview application.
  - `views/`: route-level screens.
  - `components/`: shared UI components.
  - `store/`: Pinia stores and frontend application state.
  - `lang/`: English and Simplified Chinese translations.
  - `core/IpcRouter.ts`: canonical IPC route paths and event channels.
  - `utils/ipcUtils.ts`: frontend IPC helpers (`invoke("ipc_send")` and event listeners).
- `src-tauri/`: Tauri Rust backend.
  - `src/lib.rs`: application startup, data directory, window, tray, and autostart wiring.
  - `src/commands/`: `ipc_send` dispatcher that maps route paths to backend behavior.
  - `src/db/`: SQLite (rusqlite) connection, migration runner, and repositories.
  - `migrations/`: ordered SQLite migration files.
  - `src/downloader/`, `src/process/`, `src/config_gen/`, `src/system/`: frpc versions, frpc process, TOML generation, and OS integration.
  - `src/models.rs`: Rust payload models serialized to the frontend and JSON columns.
  - `tauri.conf.json`, `capabilities/`, `icons/`: Tauri app configuration and bundle assets.
- `types/`: global TypeScript declarations shared by frontend code.
- `public/`: static assets and logos.
- `scripts/`: npm helper scripts (for example `run-tauri.mjs`).
- `screenshots/`: README assets; do not update unless documentation visuals change.
- `dist/`, `src-tauri/target/`, and `node_modules/`: generated content; never hand-edit or commit newly generated files unless explicitly requested.

## Common Commands

```sh
npm ci
npm run tauri:dev
npm run lint
npm run build
cd src-tauri && cargo test
```

`npm run tauri:dev` starts Vite and the Tauri development app. `npm run dev` starts only the Vite frontend; Tauri APIs are unavailable in a plain browser. `npm run build` runs `vue-tsc --noEmit` before the Vite production build. `npm run tauri:build` produces platform installers and is not a routine validation step.

For normal code changes, run lint, build, and the Rust tests. For UI or backend behavior changes, also exercise the affected workflow in the development app and report what was checked.

## Architecture and Change Conventions

- Keep frontend code concerned with presentation and state. Filesystem, process, network, database, and OS behavior belong under `src-tauri/`.
- Follow the existing flow: frontend `send(ipcRouters.X.y)` -> `ipc_send` in `src-tauri/src/commands/mod.rs` -> repository/service -> `ApiResponse` returned to the `:hook` handler. Backend-pushed updates use Tauri events named by `listeners` in `src/core/IpcRouter.ts`.
- When adding IPC behavior, update all participating pieces: the route in `src/core/IpcRouter.ts`, the matching `ipc_send` branch, the Rust implementation, and frontend `on`/`send` calls. Remove listeners when component-scoped subscriptions can be recreated.
- Return results with `ApiResponse::success` / `ApiResponse::fail` and keep the existing `bizCode` conventions.
- Put shared frontend interfaces in `types/`; keep Rust models in `src-tauri/src/models.rs` serialized with the same JSON field names (use explicit `serde(rename)` when names are not plain camelCase, such as `proxyURL`).
- User-facing text must support both `src/lang/en-US.ts` and `src/lang/zh-CN.ts`. Preserve existing terminology for frp/frpc concepts.
- Preserve the current formatting style: two-space indentation, double quotes, semicolons, trailing commas only where Prettier adds them, and TypeScript/Vue conventions enforced by ESLint and Prettier. Format Rust with `rustfmt` conventions.
- Use the `@/` alias for frontend imports.
- Do not introduce unrelated refactors, broad formatting churn, or dependency upgrades as part of a focused fix.

## Data and Security

- Treat configuration, tokens, proxy definitions, logs, and local paths as sensitive. Do not log secrets or include real credentials in fixtures, screenshots, or examples.
- Preserve compatibility with existing user data: the app data directory (`<config dir>/Frpc-Desktop`), the SQLite database, Electron 1.x frpc binary names, and frpc configuration formats. Schema, path, or filename changes require an explicit migration or backward-compatible fallback.
- Keep the bundle identifier `priv.liujiawei.frpc.desktop` so installs upgrade in place.
- Validate frontend-provided IPC arguments in Rust before using them in paths, shell operations, downloads, or process commands.

## Documentation and Commits

The canonical frontend UI development standard is `docs/FRONTEND_UI_STANDARDS.md`. Read and follow it before creating or changing renderer UI, layout, styling, interaction states, icons, or user-facing copy.

The canonical database design and migration document is `docs/DATABASES.md`. Read and follow it before changing persistence models, SQLite schema or migrations, repositories, database paths, or data compatibility behavior.

Update both `README.md` and `README.zh_CN.md` when changing user-facing setup or behavior. Keep commit subjects short and aligned with the repository's conventional emoji-prefixed history when practical (for example, `🐛 Fix ...`, `✨ Add ...`, or `🔧 Update ...`). Do not commit build artifacts or local application data.
