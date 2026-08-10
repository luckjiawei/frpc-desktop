# Repository Guidelines

## Project Overview

Frpc-Desktop is a cross-platform Electron application. The renderer uses Vue 3, TypeScript, Vite, Pinia, Vue Router, Element Plus, and vue-i18n. The Electron main process manages frpc processes, local persistence, downloads, system integration, and IPC.

Use Node.js 22.12 or newer and npm. Keep changes focused; do not edit generated output or downloaded dependencies.

## Repository Layout

- `src/`: Vue renderer application.
  - `views/`: route-level screens.
  - `components/`: shared UI components.
  - `store/`: Pinia stores and renderer-side application state.
  - `lang/`: English and Simplified Chinese translations.
  - `utils/ipcUtils.ts`: renderer IPC helpers.
- `electron/`: Electron main and preload code.
  - `main/`: application startup, window, tray, bean, listener, and router wiring.
  - `controller/`: IPC request adapters and response/error handling.
  - `service/`: business logic and external/system interactions.
  - `repository/`: NeDB persistence.
  - `core/IpcRouter.ts`: canonical IPC routes and listener channels.
- `types/`: global TypeScript declarations shared across layers.
- `public/`: packaged static assets and platform icons.
- `screenshots/`: README assets; do not update unless documentation visuals change.
- `dist/`, `dist-electron/`, `release/`, and `node_modules/`: generated content; never hand-edit or commit newly generated files unless explicitly requested.

## Common Commands

```sh
npm ci
npm run dev
npm run lint
npm run build
```

`npm run dev` launches the Vite/Electron development app. `npm run build` runs `vue-tsc --noEmit` before the Vite production build. Packaging commands are platform-specific (`build:electron:mac`, `build:electron:win`, and `build:electron:linux`) and are not routine validation steps.

There is currently no automated test script. For normal code changes, run lint and build. For UI or Electron behavior changes, also exercise the affected workflow in the development app and report what was checked.

## Architecture and Change Conventions

- Keep renderer code concerned with presentation and state. Filesystem, process, network, database, and OS behavior belong under `electron/`.
- Follow the existing main-process flow: renderer -> IPC route -> controller -> service/repository. Controllers translate results with `ResponseUtils` and log failures with `Logger`.
- When adding IPC behavior, update all participating pieces: the route in `electron/core/IpcRouter.ts`, controller registration/wiring in `electron/main/index.ts`, the controller/service implementation, and renderer listeners or sends. Remove listeners when component-scoped subscriptions can be recreated.
- Register new services, repositories, and controllers through `BeanFactory` using the established names and initialization order.
- Put shared global interfaces in `types/`; avoid duplicating cross-process payload shapes in Vue components.
- User-facing text must support both `src/lang/en-US.ts` and `src/lang/zh-CN.ts`. Preserve existing terminology for frp/frpc concepts.
- Preserve the current formatting style: two-space indentation, double quotes, semicolons, trailing commas only where Prettier adds them, and TypeScript/Vue conventions enforced by ESLint and Prettier.
- Use the `@/` alias for renderer imports. Electron code generally uses relative imports.
- Do not introduce unrelated refactors, broad formatting churn, or dependency upgrades as part of a focused fix.

## Data and Security

- Treat configuration, tokens, proxy definitions, logs, and local paths as sensitive. Do not log secrets or include real credentials in fixtures, screenshots, or examples.
- Preserve compatibility with existing NeDB data and frpc configuration formats. Schema or filename changes require an explicit migration or backward-compatible fallback.
- Validate renderer-provided IPC arguments in the main process before using them in paths, shell operations, downloads, or process commands.

## Documentation and Commits

The canonical frontend UI development standard is `docs/FRONTEND_UI_STANDARDS.md`. Read and follow it before creating or changing renderer UI, layout, styling, interaction states, icons, or user-facing copy.

The canonical database design and migration document is `docs/DATABASES.md`. Read and follow it before changing persistence models, SQLite schema or migrations, repositories, database paths, or data compatibility behavior.

Update both `README.md` and `README.zh_CN.md` when changing user-facing setup or behavior. Keep commit subjects short and aligned with the repository's conventional emoji-prefixed history when practical (for example, `🐛 Fix ...`, `✨ Add ...`, or `🔧 Update ...`). Do not commit build artifacts or local application data.
