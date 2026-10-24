<a name="readme-top"></a>

<!-- PROJECT SHIELDS -->
[![Downloads][downloads-shield]][downloads-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/luckjiawei/frpc-desktop">
    <img src="public/logo/pack/1024x1024.png" alt="Logo" width="140">
  </a>

<h3 align="center">Frpc-Desktop</h3>

  <p align="center">
    🎉 Cross-platform desktop client for FRP, visual configuration, easily achieve intranet penetration!
    <br />
    Support all frp versions / Auto-start / Visual configuration / Free and open source
  </p>

  <p>🎊 <strong>10,000+ Downloads Milestone!</strong> Thank you for your support!</p>

  <p><a href="https://jwinks.com/p/frp/">📖 Docs</a> &nbsp; <a href="README.zh_CN.md">中文</a></p>

<a href="https://trendshift.io/repositories/12489" target="_blank"><img src="https://trendshift.io/api/badge/repositories/12489" alt="luckjiawei%2Ffrpc-desktop | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
<a href="https://hellogithub.com/repository/b0dc116e9f2e4b8188da5a6d3e1bd8a4" target="_blank"><img src="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=b0dc116e9f2e4b8188da5a6d3e1bd8a4&claim_uid=8ZMOhz30mGJAHpa" alt="Featured｜HelloGitHub" style="width: 250px; height: 54px;" width="250" height="54" /></a>
</div>

> 💡 If you prefer a **web UI**, try [Podux](https://github.com/luckjiawei/podux) —
> the browser-based frpc manager from the same author.

## TODO

- [x] Auto-start on boot
- [x] Support multiple users with user & meta_token
- [x] Portable version
- [x] Add UDP proxy type
- [x] Support quick sharing of frps
- [x] Add quick local port selection
- [x] Support STCP proxy type
- [x] Download frp through mirror sites
- [x] Support import/export of all configurations
- [x] One-click clear all configurations
- [x] Support importing and recognizing frpc.toml
- [x] TCP and UDP protocols support batch ports
- [x] Support multiple languages
- [x] Fast proxy search with card/list pagination

## Windows 无人值守服务（中文优先）

Windows 客户端可以把 frpc 安装为 `FrpcDesktopService` 系统服务，由 Windows 服务控制管理器在没有用户登录时自动启动。服务使用低权限 `NT AUTHORITY\LocalService` 账户运行，GUI 退出或用户注销不会停止已安装的服务。

在设置页保存配置后，点击 **Install service** 并确认 UAC；随后可以启动、停止、更新服务配置或卸载服务。服务专用配置、证书副本和日志位于 `%ProgramData%\FrpcDesktopService`。更新设置后要再次点击 **Update service config**；卸载不会删除客户端数据库、原始配置或已下载版本。引用的证书和私钥会复制到服务快照，原文件保持不变。

安装、更新和卸载需要管理员确认。程序拒绝覆盖同名服务、链接目录或不安全权限。服务管理已接入 Tauri 2 后端，兼容已下载版本、Electron 1.x 旧文件名及自定义 frpc 可执行文件。

2026-10-20 已在 Windows 本机用独立配置和回环隧道验证：安装、启动/停止、LocalService 身份、会话 0、延迟自动启动设置、目录权限、进程崩溃恢复、失败更新回滚、运行中/停止时更新、卸载清理及损坏 WinSW 拒绝。测试结束后已清除测试服务和部署目录，未改动原有客户端。

Windows x64 Release 安装包已在独立目录安装，安装后的客户端二进制与构建产物一致，WinSW 资源完整性检查通过。用户随后安装服务并重启；2026-10-21（UTC+08:00）日志确认重启后服务以 LocalService 在会话 0 运行，frpc 登录成功且三个代理注册成功。用户登录早于服务启动，因此注销和重启后未登录时的实际隧道连通性仍未验证；代理注册也不代表所有本地业务端口均可连接。GUI/UAC 完整交互流程尚未系统验证。

可复现的管理员集成测试位于 `tests/windows-service.integration.ps1`，需提供包含 `frpc.exe` 和 `frps.exe` 的目录、尚不存在的工作目录和调用者 SID。脚本仅使用本机回环地址，拒绝覆盖已有服务，结束后清理测试服务并输出 `integration-result.json`。

### Windows unattended service (English supplement)

The Windows client can install `frpc` as `FrpcDesktopService`, running as `NT AUTHORITY\LocalService` so tunnels can start before any user logs in. Settings provides install, start, stop, snapshot update, and uninstall actions. Service data and logs are stored under `%ProgramData%\FrpcDesktopService`; referenced certificates and keys are copied into the service snapshot while the originals remain untouched. Administrator confirmation is required. Windows loopback integration tests verified installation, LocalService/session 0, ACLs, crash recovery, snapshot updates/rollback and removal on 2026-10-20. The x64 release installer was installed in a separate directory and its binary and WinSW resource were verified. After the user installed the service and rebooted, logs on 2026-10-21 (UTC+08:00) confirmed service startup, frpc login and three successful proxy registrations. Login preceded service startup, so logoff and pre-logon tunnel connectivity remain unverified. Proxy registration does not establish connectivity to every local application. Full GUI/UAC interaction has not been systematically tested.

## Development

Requirements: Node.js 22.12+, npm, and a stable Rust toolchain ([Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)).

```sh
npm ci
npm run tauri:dev    # run the desktop app in development mode
npm run tauri:build  # build installers for the current platform
```

## Common Issues

### Upgrading from 1.x

Version 2.0 is rebuilt on Tauri and upgrades the 1.x Electron app in place. Your server settings, proxies, desktop settings, and downloaded frpc versions are kept automatically; data still stored in the older NeDB format (1.2.6 and earlier) is imported on first launch and the original files are kept as `*.bak`.

### Mac shows app is damaged

Run command: `sudo xattr -cr Frpc-Desktop.app`

## Milestones

- 2026-05-21: Released v1.2.6 Added download proxy selection
- 2026-03-26: Released v1.2.5 Fixed known bugs
- 2025-09-10: Released v1.2.3 Fixed known bugs, Supports proxy protocol, Optimize performance
- 2025-04-22: Released v1.2.2 Fixed known bugs, Supports HTTP Locations
- 2025-03-25: Released v1.2.1 Fixed known bugs, Supports english
- 2025-03-06: Released v1.2.0 Underlying reconstruction, improved stability
- 2025-01-09: Released v1.1.6
- 2024-12-04: Released v1.1.5 Optimized experience, support modifying webport, solved GitHub rate limit issues, log optimization
- 2024-11-08: Released v1.1.4 Fixed known bugs
- 2024-10-14: Released v1.1.3 Support XTCP protocol, optimized experience
- 2024-09-25: Released v1.1.2 Support HTTP basic auth, subdomains
- 2024-09-07: Released v1.1.0 Support batch ports, single proxy switch control
- 2024-08-24: Released v1.0.9 Support mirror downloads, config import/export
- 2024-08-17: Released v1.0.8 Support STCP proxy
- 2024-08-11: Released v1.0.7
- 2024-08-09: Released v1.0.6
- 2024-08-06: Released v1.0.5
- 2024-08-06: Released v1.0.4 Adapted to support multi-user plugin
- 2024-07-17: Released v1.0.3 Fixed known bugs, added auto-start, added frp version deletion
- 2024-01-29: Released v1.0.2 Added Linux client and proxy mode
- 2023-12-01: Released v1.0.1
- 2023-11-28: Released v1.0

## Community

No advertisements allowed!!!

### Telegram

[https://t.me/+4kziSBL3LxVmYzVl](https://t.me/+4kziSBL3LxVmYzVl)

### WeChat Group

**~~Scan WeChat QR code to join open source project discussion group~~ WeChat group exceeds 200 people, cannot scan code to join. Follow official account to join group**

<img src="screenshots/wechat-qr.png" alt="QR Code" width="200"><img src="screenshots/mp_qr.jpg" alt="Official Account QR Code" width="200">

## Screenshot

![launch](https://github.com/luckjiawei/frpc-desktop/blob/main/screenshots/en/launch.png?raw=true)

![proxys manager](https://github.com/luckjiawei/frpc-desktop/blob/main/screenshots/en/proxy.png?raw=true)

![frp download](https://github.com/luckjiawei/frpc-desktop/blob/main/screenshots/en/download.png?raw=true)

![config](https://github.com/luckjiawei/frpc-desktop/blob/main/screenshots/en/config.png?raw=true)

![logger](https://github.com/luckjiawei/frpc-desktop/blob/main/screenshots/en/logger.png?raw=true)

![about](https://github.com/luckjiawei/frpc-desktop/blob/main/screenshots/en/about.png?raw=true)

## Donate

👉👉👉[Click to donate](https://jwinks.com/donate/)👈👈👈



## Contributors

<a href="https://github.com/luckjiawei/frpc-desktop/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=luckjiawei/frpc-desktop" />
</a>

## License

[MIT](LICENSE)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=luckjiawei/frpc-desktop&type=Date)](https://www.star-history.com/#luckjiawei/frpc-desktop&Date)

<!-- MARKDOWN LINKS & IMAGES -->

[downloads-shield]: https://img.shields.io/github/downloads/luckjiawei/frpc-desktop/total.svg?style=for-the-badge

[downloads-url]: https://github.com/luckjiawei/frpc-desktop/releases

[forks-shield]: https://img.shields.io/github/forks/luckjiawei/frpc-desktop.svg?style=for-the-badge

[forks-url]: https://github.com/luckjiawei/frpc-desktop/network/members

[stars-shield]: https://img.shields.io/github/stars/luckjiawei/frpc-desktop.svg?style=for-the-badge

[stars-url]: https://github.com/luckjiawei/frpc-desktop/stargazers

[issues-shield]: https://img.shields.io/github/issues/luckjiawei/frpc-desktop.svg?style=for-the-badge

[issues-url]: https://github.com/luckjiawei/frpc-desktop/issues

[license-shield]: https://img.shields.io/github/license/luckjiawei/frpc-desktop.svg?style=for-the-badge

[license-url]: https://github.com/luckjiawei/frpc-desktop/blob/master/LICENSE
