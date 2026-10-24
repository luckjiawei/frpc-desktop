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
    🎉 FRP跨平台桌面客户端，可视化配置，轻松实现内网穿透！
    <br />
    支持所有frp版本 / 开机自启 / 可视化配置 / 免费开源
  </p>

  <p>🎊 <strong>下载量突破 10,000！感谢大家的支持！</strong></p>

  <p><a href="https://jwinks.com/p/frp/">📖 文档</a> &nbsp; <a href="https://jwinks.com/p/frpc-desktop-faq/">常见问题</a></p>

<a href="https://trendshift.io/repositories/12489" target="_blank"><img src="https://trendshift.io/api/badge/repositories/12489" alt="luckjiawei%2Ffrpc-desktop | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
<a href="https://hellogithub.com/repository/b0dc116e9f2e4b8188da5a6d3e1bd8a4" target="_blank"><img src="https://abroad.hellogithub.com/v1/widgets/recommend.svg?rid=b0dc116e9f2e4b8188da5a6d3e1bd8a4&claim_uid=8ZMOhz30mGJAHpa" alt="Featured｜HelloGitHub" style="width: 250px; height: 54px;" width="250" height="54" /></a>
</div>

> 💡 如果你更喜欢 **Web 界面**，试试 [Podux](https://github.com/luckjiawei/podux) —
> 基于浏览器的 frpc 可视化管理工具。

## TODO

- [x] 开机自启动
- [x] 适配多用户 user & meta_token
- [x] 便携版
- [x] 增加udp代理类型
- [x] 支持快速分享frps
- [x] 增加快速选择本地端口
- [x] 支持stcp代理类型
- [x] 通过镜像站下载frp
- [x] 支持所有配置的导入导出
- [x] 一键清空所有配置
- [x] 支持导入识别frpc.toml
- [x] tcp、udp协议支持批量端口
- [x] support multiple languages
- [x] 支持代理快速搜索及卡片/列表分页

## Windows 无人值守服务

Windows 客户端现在可以把 frpc 安装为 `FrpcDesktopService` 系统服务。服务由 Windows 服务控制管理器启动，使用低权限 `NT AUTHORITY\LocalService` 账户运行，因此即使没有用户登录、GUI 已退出或用户注销，隧道仍可自动启动。

### 使用方法

1. 在“设置”中保存服务端、代理、frp 版本以及证书/私钥配置。
2. 在“Windows 系统服务”区域点击“安装服务”，确认 UAC 管理员提示。
3. 使用“启动服务”“停止服务”“更新服务配置”管理服务；更新配置会创建新的快照，失败时保留原快照并尝试恢复。
4. 不再需要时先停止服务，再点击“卸载服务”。卸载只删除服务专用目录，不删除客户端数据库、原始配置或已下载的 frp 版本。

服务文件和日志放在 Windows 的 `%ProgramData%\FrpcDesktopService`，不是当前用户的 AppData。安装时引用的证书、私钥会复制到服务快照目录并重写配置路径；原始文件不会被移动或删除。保存设置后，必须点击“更新服务配置”才会同步到已安装的服务。

服务管理需要管理员确认；服务账户只获得服务目录的读取权限和日志目录的写入权限。若同名服务、链接目录或权限不符合预期，程序会拒绝覆盖并显示错误。

服务管理已接入 Tauri 2 后端，兼容已下载版本、Electron 1.x 旧文件名及自定义 frpc 可执行文件。2026-10-20 已在 Windows 本机使用独立配置和回环隧道验证安装、启动/停止、LocalService 身份、会话 0、延迟自动启动设置、目录权限、进程崩溃恢复、失败更新回滚、运行中/停止时更新、卸载清理及损坏 WinSW 拒绝。测试结束后已清除测试服务和部署目录，未改动原有客户端。

Windows x64 Release 安装包已在独立目录安装，安装后的客户端二进制与构建产物一致，WinSW 资源完整性检查通过。用户随后安装服务并重启；2026-10-21（UTC+08:00）日志确认重启后服务以 LocalService 在会话 0 运行，frpc 登录成功且三个代理注册成功。

用户登录早于服务启动，因此注销和重启后未登录时的实际隧道连通性仍未验证，需在隔离 Windows 客机或目标机器上补充验证。代理注册成功不代表所有本地业务端口均可连接；本地业务应用也需要自行配置开机启动。GUI/UAC 完整交互流程尚未系统验证。

可复现的管理员集成测试位于 `tests/windows-service.integration.ps1`。运行前执行 `npm run prepare:windows-service`，并准备包含 `frpc.exe` 和 `frps.exe` 的目录。以管理员 PowerShell 执行以下命令；工作目录必须尚不存在，调用者 SID 应为使用客户端的用户：

```powershell
.\tests\windows-service.integration.ps1 `
  -FrpDirectory 'E:\frp-test\frp_0.68.1_windows_amd64' `
  -WorkDirectory 'E:\frp-test\run-01' `
  -CallerSid ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value)
```

脚本拒绝覆盖已有服务及部署目录，仅使用本机回环隧道，结束后卸载测试服务，并在工作目录写入 `integration-result.json`。测试工作目录可整体清理。

### Windows unattended service (English)

The Windows client can install `frpc` as the `FrpcDesktopService` system service. It runs as the low-privilege `NT AUTHORITY\LocalService` account and can start without a logged-in user or the desktop GUI.

Save the configuration first, then use **Install service**, **Start/Stop service**, **Update service config**, and **Uninstall service** in Settings. Service snapshots and logs live under `%ProgramData%\FrpcDesktopService`; certificate and key references are copied into the snapshot and the original files are kept. Updating the desktop settings does not change an installed snapshot until **Update service config** is used.

Service management requires administrator confirmation. A Windows loopback integration test verified installation, LocalService/session 0, ACLs, crash recovery, snapshot updates/rollback and removal on 2026-10-20. The x64 release installer was installed in a separate directory and its binary and WinSW resource were verified. After the user installed the service and rebooted, logs on 2026-10-21 (UTC+08:00) confirmed service startup, frpc login and three successful proxy registrations. Login preceded service startup, so logoff and pre-logon tunnel connectivity remain unverified. Proxy registration does not establish connectivity to every local application; those applications need their own startup configuration. Full GUI/UAC interaction has not been systematically tested. The opt-in administrator harness is `tests/windows-service.integration.ps1`.


## 开发

环境要求：Node.js 22.12+、npm 和稳定版 Rust 工具链（参见 [Tauri 环境准备](https://v2.tauri.app/zh-cn/start/prerequisites/)）。

```sh
npm ci
npm run tauri:dev    # 以开发模式运行桌面应用
npm run tauri:build  # 为当前平台构建安装包
```

## 常见问题

### 从 1.x 升级

2.0 版本基于 Tauri 重构，可直接覆盖升级 1.x 的 Electron 版本。服务器配置、代理、系统设置和已下载的 frpc 版本会自动保留；仍为旧 NeDB 格式的数据（1.2.6 及更早版本）会在首次启动时导入，原文件以 `*.bak` 保留。

## 里程碑

- 2026-05-21: 发布v1.2.6版本 增加下载代理选择
- 2026-03-26: 发布v1.2.5版本 修复已知BUG
- 2025-09-10: 发布v1.2.3版本 修复已知BUG，支持代理协议，优化性能
- 2025-04-22: 发布v1.2.2版本 修复已知BUG，支持HTTP路径设置
- 2025-03-25: 发布v1.2.1版本 修复已知BUG，支持英文
- 2025-03-06: 发布v1.2.0版本 底层重构，提高稳定性
- 2025-01-09: 发布v1.1.6版本
- 2024-12-04: 发布v1.1.5版本 优化体验、支持修改webport、解决github限流问题、日志优化
- 2024-11-08: 发布v1.1.4版本 修复已知BUG
- 2024-10-14: 发布v1.1.3版本 支持xtcp协议、优化体验
- 2024-09-25: 发布v1.1.2版本 支持 http basic、子域名
- 2024-09-07: 发布v1.1.0版本 支持批量端口、支持单条代理开关控制
- 2024-08-24: 发布v1.0.9版本 支持镜像下载、导出导入配置
- 2024-08-17: 发布v1.0.8版本 支持stcp代理
- 2024-08-11: 发布v1.0.7版本
- 2024-08-09: 发布v1.0.6版本
- 2024-08-06: 发布v1.0.5版本
- 2024-08-06: 发布v1.0.4版本 适配支持多用户插件
- 2024-07-17: 发布v1.0.3版本 修复已知bug 增加开机自启 增加删除frp版本
- 2024-01-29: 发布v1.0.2版本 增加Linux客户端和代理模式
- 2023-12-01: 发布v1.0.1版本
- 2023-11-28: 发布v1.0版本

## 社区

广告勿进！！！

### TG

[https://t.me/+4kziSBL3LxVmYzVl](https://t.me/+4kziSBL3LxVmYzVl)

### 微信群

**~~微信扫描加入开源项目交流群~~ 微信群超过200人无法扫码进群 关注公众号进群**



 <img src="screenshots/wechat-qr.png" alt="二维码" width="200"><img src="screenshots/mp_qr.jpg" alt="公众号二维码" width="200">

## 演示

![launch](https://github.com/luckjiawei/frpc-desktop/blob/main/screenshots/zh/launch.png?raw=true)

![proxys manager](https://github.com/luckjiawei/frpc-desktop/blob/main/screenshots/zh/proxy.png?raw=true)

![frp download](https://github.com/luckjiawei/frpc-desktop/blob/main/screenshots/zh/download.png?raw=true)

![config](https://github.com/luckjiawei/frpc-desktop/blob/main/screenshots/zh/config.png?raw=true)

![logger](https://github.com/luckjiawei/frpc-desktop/blob/main/screenshots/zh/logger.png?raw=true)

![about](https://github.com/luckjiawei/frpc-desktop/blob/main/screenshots/zh/about.png?raw=true)

## 捐赠

👉👉👉[点击去捐赠](https://jwinks.com/donate/)👈👈👈

## 贡献者

<a href="https://github.com/luckjiawei/frpc-desktop/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=luckjiawei/frpc-desktop" />
</a>

## License

[MIT](LICENSE)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=luckjiawei/frpc-desktop&type=Date)](https://star-history.com/#luckjiawei/frpc-desktop&Date)
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
