# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Frpc-Desktop is a cross-platform Electron desktop client for FRP (Fast Reverse Proxy) with visual configuration. It supports Windows, macOS, and Linux. The application allows users to manage FRP client configurations, download FRP versions, monitor connections, and view logs through a graphical interface.

## Development Commands

### Development
- `npm run dev` - Start development server with hot reload (runs on port 3344)
- `npm run build` - Type check with vue-tsc and build frontend
- `npm run preview` - Preview production build

### Building Electron Apps
- `npm run build:electron` - Build for current platform
- `npm run build:electron:mac` - Build for macOS (dmg and zip for x64, arm64, universal)
- `npm run build:electron:win` - Build for Windows (nsis installer, zip, and portable for x64 and ia32)
- `npm run build:electron:linux` - Build for Linux (AppImage, deb, rpm)
- `npm run build:electron:all` - Build for all platforms

### Release (with GitHub publishing)
- `npm run release` - Build and publish for all platforms
- `npm run release:mac` - Build and publish for macOS only
- `npm run release:win` - Build and publish for Windows only
- `npm run release:linux` - Build and publish for Linux only

### Code Quality
- `npm run lint` - Run ESLint on src/ and electron/
- `npm run lint:fix` - Auto-fix linting issues

### Other
- `npm run electron:generate-icons` - Generate app icons from source

## Architecture

### Technology Stack
- **Frontend**: Vue 3 + TypeScript + Vite + Vue Router + Pinia
- **UI Framework**: Element Plus + Tailwind CSS
- **Desktop**: Electron
- **Database**: SQLite via Knex.js
- **Dependency Injection**: InversifyJS with decorators
- **Build**: Vite + electron-builder

### Project Structure

```
frpc-desktop/
├── electron/              # Electron main process code
│   ├── controller/       # IPC handlers using @IpcRoute decorators
│   ├── service/          # Business logic layer
│   ├── repository/       # Data access layer (extends BaseRepository)
│   ├── converter/        # Data transformation between models and DTOs
│   ├── core/            # Base classes and decorators
│   ├── event/           # System event handlers
│   ├── utils/           # Utility functions
│   ├── main/            # Application entry point and DI container setup
│   ├── preload/         # Preload scripts for renderer process
│   └── di.ts            # Dependency injection type definitions
├── src/                  # Frontend Vue application
│   ├── views/           # Page components (launch, proxies, versions, config, logger, about)
│   ├── store/           # Pinia stores
│   ├── router/          # Vue Router configuration
│   ├── components/      # Reusable Vue components
│   ├── layout/          # Layout components
│   ├── lang/            # i18n translations
│   └── utils/           # Frontend utilities
├── types/               # TypeScript type definitions
└── public/              # Static assets
```

### Electron Main Process Architecture

The Electron main process uses a **layered architecture** with **dependency injection**:

1. **Controller Layer** (`electron/controller/`)
   - Handles IPC communication using `@IpcRoute` decorator
   - Routes decorated with channel names from `IPCChannels` constant
   - Extends `BaseController` from `electron/core/controller`
   - Example: `ProxyController` handles proxy CRUD operations

2. **Service Layer** (`electron/service/`)
   - Contains business logic
   - Orchestrates operations between repositories
   - Key services:
     - `FrpcProcessService`: Manages FRP client process lifecycle
     - `ProxyService`: Proxy configuration management
     - `VersionService`: FRP version management and downloads
     - `GitHubService`: GitHub API interactions
     - `SystemService`: System operations and settings
     - `LogService`: Application logging

3. **Repository Layer** (`electron/repository/`)
   - Data access using Knex.js and SQLite
   - Each repository extends `BaseRepository<T>` from `electron/core/repository`
   - Implements table schema in `initTableSchema()` method
   - Key repositories:
     - `ProxyRepository`: FRP proxy configurations
     - `VersionRepository`: Downloaded FRP versions
     - `OpenSourceConfigRepository`: Open source configuration settings

4. **Converter Layer** (`electron/converter/`)
   - Transforms data between domain models and database models
   - Example: `ProxyConverter` converts between `FrpcDesktopProxy` and `ProxyModel`

5. **Dependency Injection Setup** (`electron/main/index.ts`)
   - Uses InversifyJS container
   - All dependencies registered in `FrpcDesktopRunner.initializeContainer()`
   - Type symbols defined in `electron/di.ts`
   - Controllers, services, repositories, and converters are injectable
   - Database (Knex instance) bound to container during initialization

### Frontend Architecture

- **Vue Router** with hash history mode
- **Pinia** for state management
- **Main views**:
  - `/launch` - Start/stop FRP client and view connection status
  - `/proxies` - Manage proxy configurations (TCP, UDP, HTTP, HTTPS, STCP, XTCP)
  - `/versions` - Download and manage FRP versions
  - `/config` - Application settings (server config, user/meta_token, auto-start)
  - `/logger` - View application logs
  - `/about` - About page and donation info

### Database

- **SQLite** database via Knex.js query builder
- Database file location managed by `PathUtils.getDatabaseFilename()`
- Tables auto-created via repository `initTableSchema()` methods
- Main tables:
  - `frpc_proxy` - Proxy configurations
  - `frpc_version` - Downloaded FRP versions
  - `frpc_opensource_config` - Application settings

### IPC Communication Pattern

**Main Process (Electron):**
Controllers use the `@IpcRoute` decorator to register IPC handlers:

```typescript
@IpcRoute(IPCChannels.PROXY_CREATE_PROXY)
public async createProxy(event: any, args: any) {
  return await this._proxyService.insertProxy(args);
}
```

**Renderer Process (Vue):**
Frontend uses the `send` and `on` utilities from `src/utils/ipcUtils.ts`:

```typescript
import { send, on } from "@/utils/ipcUtils";
import { IPCChannels } from "../../../electron/core/constant";

// Send IPC message
send(IPCChannels.SYSTEM_OPEN_URL, { url: "https://example.com" });

// Listen for IPC response
on(IPCChannels.CONFIG_GET_SERVER_CONFIG, data => {
  console.log("Received config:", data);
});
```

**Important:** Channel names are defined in `electron/core/constant.ts` under `IPCChannels`. Event channels are under `EventChannels`.

## Important Notes

### TypeScript Configuration
- Decorators enabled via `experimentalDecorators` and `emitDecoratorMetadata`
- `reflect-metadata` must be imported at entry points
- Strict mode is **disabled** (`strict: false`)
- Path alias: `@/*` maps to `src/*`

### Electron Build
- Main process entry: `electron/main/index.ts`
- Preload script: `electron/preload/index.ts`
- Output directories:
  - Frontend build: `dist/`
  - Electron build: `dist-electron/`
  - Release packages: `release/{version}/`

### When Adding New Features

1. **New IPC endpoint**:
   - Add channel constant to `IPCChannels` in `electron/core/constant.ts`
   - Add controller method with `@IpcRoute` decorator
   - Implement service layer logic if needed
   - Update repository if database access required

2. **New database table**:
   - Create model type in `types/model.d.ts`
   - Create repository extending `BaseRepository<YourModel>`
   - Implement `tableName()` and `initTableSchema()` methods
   - Register in DI container in `electron/main/index.ts`
   - Add type symbol to `electron/di.ts`

3. **New service/controller**:
   - Mark class with `@injectable()` decorator
   - Use `@inject(TYPES.X)` for constructor dependencies
   - Register in DI container
   - Add type symbol to `electron/di.ts`

### Current Branch Context

You are on the `sqlite` branch. The main branch is `main`, which is typically used for PRs.

### Known Patterns

- FRP process management happens in `FrpcProcessService` with reload capabilities
- Configuration files support TOML format import/export
- Multi-language support via vue-i18n (check `src/lang/` directory)
- Downloads use `electron-dl` with mirror site support for FRP binaries
