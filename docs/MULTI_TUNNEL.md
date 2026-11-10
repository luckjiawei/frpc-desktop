# 多隧道实例设计

本文档描述 Frpc-Desktop 同时运行多个隧道实例（frpc 与 Cloudflare Tunnel / cloudflared）的架构。数据库结构见 `docs/DATABASES.md` 第 11、12 节。

## 1. 概念

- **Tunnel（实例）**：与具体工具无关的运行单元，记录名称、`provider`、是否自动启动和排序，保存在 `t_frpcd_tunnels`。
- **Provider**：实例使用的工具。frpc 实例的配置保存在 `t_frpcd_servers`（`id` 与实例相同），代理保存在 `t_frpcd_proxies`（`server_id`）；cloudflared 实例的配置保存在 `t_frpcd_cloudflared_tunnels`，没有代理。
- **默认实例**：`id = "1"`，由升级前的单服务端配置迁移而来，不可删除；不带 `tunnelId` 的 IPC 调用都作用于它。

## 2. 后端结构

```text
commands/mod.rs   AppState::launch_tunnel / launch_all / tunnel_paths，IPC 参数校验
providers/        TunnelProvider trait；frpc.rs 负责校验配置、检查端口、生成 TOML、给出 LaunchSpec；
                  cloudflared.rs 负责校验令牌、解析二进制、写隔离配置、给出 LaunchSpec
process/mod.rs    RuntimeManager：按 tunnelId 管理进程、日志写入、退出监听、状态事件、结束进程树
db/tunnel_repo.rs 实例增删改查、默认实例保护、Web 端口分配
```

- `TunnelProvider::prepare` 返回 `LaunchSpec { binary, args, envs, log_path }`。密钥类参数（如 cloudflared token）应放在 `envs`，避免出现在进程列表中。
- `TunnelProvider::log_classifier` 把日志行分类为 `Connected` / `Error` / `None`，`RuntimeManager` 据此更新 `connectionError`。
- 每次启动递增 `generation`，旧进程迟到的退出或日志不会覆盖新进程的状态。
- 状态通过事件 `tunnel:status` 推送，payload 为 `TunnelStatus { tunnelId, provider, running, connectionError, lastStartTime }`。
- 启动前检查：服务端地址、frpc 二进制、`webServer` 端口和 Visitor 绑定端口（被其他实例占用时返回 `B1007`）。

## 3. IPC

| 路由 | 参数 | 说明 |
| --- | --- | --- |
| `tunnel/list` | — | 实例列表及摘要（服务端地址、代理数量，不含密钥） |
| `tunnel/create` | `name`, `provider`（`frpc` / `cloudflared`） | 新建实例，同时创建该 provider 的默认配置 |
| `tunnel/update` | `tunnelId`, `name?`, `autoStart?` | 重命名或切换自动启动 |
| `tunnel/delete` | `tunnelId` | 停止并删除实例（级联代理、清理配置和日志目录）；默认实例返回 `B1009` |
| `launch/launch` / `launch/terminate` / `launch/getStatus` | `tunnelId` | 单实例启停与状态；启动失败的 `data` 中带 `tunnelId` |
| `launch/launchAll` / `launch/terminateAll` / `launch/getStatuses` | — | 批量启停与全部状态 |
| `server/getServerConfig`、`server/exportConfig`、`proxy/getAllProxies`、`log/getFrpLogContent`、`log/openFrpcLogFile` | `tunnelId?` | 缺省为默认实例 |
| `server/saveConfig` | server 对象（`_id` 即实例 ID） | 只保存该实例的 frpc 配置，不再写入桌面设置 |
| `system/getSystemConfig` / `system/saveSystemConfig` | `FrpcSystemConfiguration` | 全局桌面设置（开机自启、静默启动、启动时自动连接、语言），保存时同步系统自启动项 |
| `proxy/createProxy` | proxy 对象（`serverId`） | 新代理归属的实例（只能是 frpc 实例） |
| `cloudflared/getConfig` / `cloudflared/saveConfig` | `tunnelId` / `CloudflaredSettings` | 读写 cloudflared 实例配置；非 cloudflared 实例返回 `B1008`，字段非法返回 `B1000` |
| `cloudflared/detectPath` / `cloudflared/validatePath` | — / `path` | 自动检测本机 cloudflared、校验指定文件并返回版本 |
| `version/getVersions` / `version/downloadVersion` | `provider?` | 缺省为 `frpc`；`version/getDownloadedVersions` 返回全部工具，条目带 `provider` |

无效或不存在的实例返回 `B1008`。

## 4. 前端

- `store/tunnel.ts`：实例列表、各实例状态（监听 `tunnel:status`）和 `currentTunnelId`（保存在 localStorage）。
- 左侧菜单：仪表盘、实例、代理、下载、设置、日志、关于。
- 仪表盘（`views/home`）：只读的全局概览，包括运行中实例、代理总数、连接异常数、已下载 frpc 版本和实例状态表；只提供“全部启动/全部停止”快捷操作，不做实例管理。
- 实例（`views/tunnel`）：“新建实例”下拉选择 frpc 或 Cloudflare Tunnel。实例卡片（状态、运行时长、错误、启停、配置/代理/日志入口、重命名、自动连接、删除）；cloudflared 卡片显示令牌是否已配置，不显示“代理”入口。“日志”在抽屉（`TunnelLogDrawer.vue`）中按 provider 解析显示该实例的日志。
- cloudflared 实例配置（`views/config/CloudflaredConfigDrawer.vue`）：令牌（可直接粘贴控制台中的完整安装命令，自动提取令牌）、二进制来源（已下载版本 / 本地文件，留空版本时自动检测）、协议、边缘 IP 版本、日志级别。
- 下载（`views/download`）：可在 frpc / Cloudflare Tunnel 之间切换；cloudflared 只列出最近 20 个正式版本，导入本地文件只支持 frpc。
- 实例配置（`views/config/ConfigDrawer.vue`）：不再是独立路由，在实例页点击卡片的“配置”时以右侧抽屉打开（新建实例、启动失败提示“去配置”也会打开它）。只包含该实例的 frpc 配置及导入/导出，标题显示实例名称；有未保存的修改时关闭前会确认。
- 设置（`views/system`）：开机自启、静默启动、启动时自动连接、语言、打开数据目录和“重置全部配置”，修改后立即保存。
- 日志（`views/logger`）：只显示应用日志。
- `components/TunnelSwitcher.vue`：在代理页有多个 frpc 实例时显示（只列 frpc 实例；当前实例不是 frpc 时回退到默认实例）。
- `views/tunnel/useTunnelStatus.ts`：仪表盘和实例页共用的状态文案、运行时长和批量启停逻辑。
- 托盘菜单：全部启动、全部停止；退出时停止所有实例。

## 5. Cloudflare Tunnel（cloudflared）

只支持远程管理（令牌）模式：在 Cloudflare 控制台创建隧道并配置公共主机名，本地只填写连接器令牌。

- 启动命令：`cloudflared tunnel --config <实例目录>/cloudflared.yml --no-autoupdate --loglevel <级别> [--protocol quic|http2] [--edge-ip-version 4|6] run`，令牌通过环境变量 `TUNNEL_TOKEN` 传入。
- **配置隔离**：不传 `--config` 时 cloudflared 会自动加载 `~/.cloudflared/config.yml` 或 `/etc/cloudflared/config.yml`，用户自己的凭据文件和 ingress 会混进实例。因此每次启动都重写一个只含 `no-autoupdate: true` 的配置文件并显式传入；空文件会被 cloudflared 记为 `ERR` 日志，导致误报连接错误。
- 日志分类：包含 ` ERR ` / ` FTL ` 为错误，`Registered tunnel connection` 为已连接。令牌无效时 cloudflared 不会退出，而是持续重试并输出 `ERR Register tunnel error ...`，实例显示为“连接异常”。
- 启动前检查：未填写令牌返回 `B1001`，找不到二进制返回 `B1005`，前端按 frpc 的同类错误提示并打开配置抽屉。
- 二进制下载：发布资产按平台匹配 `cloudflared-<os>-<arch>`（macOS 为 `.tgz`，Windows 为 `.exe`，Linux 为裸二进制）；Windows ARM64 没有官方构建，只能使用本地文件。

## 6. 接入新的 provider

1. 新增迁移：重建 `t_frpcd_tunnels` 以放开 `provider` CHECK（参照迁移 005），新增明细表（`id` 外键引用 `t_frpcd_tunnels.id`，`ON DELETE CASCADE`）；如需下载二进制，放开 `t_frpcd_versions.provider` 的 CHECK。
2. 在 `TunnelRepository::create` 中为新 provider 创建默认明细记录，`is_supported_provider` 中放行，`list_summaries` 中给出摘要。
3. 新增 `providers/<name>.rs` 实现 `TunnelProvider`，在 `provider_for` 中注册；在 `AppState::tunnel_paths` 中确定配置和日志文件名。
4. 前端：`types/frpc-desktop.d.ts` 的 `TunnelProvider`、实例页的新建菜单和卡片摘要、配置抽屉、日志解析、下载页切换以及中英文文案。
