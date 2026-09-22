# TunnelDock

<p align="center">
  <img src="./app-icon.svg" alt="TunnelDock" width="96" />
</p>

<p>
  <a href="https://github.com/t59688/tunneldock/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/t59688/tunneldock?include_prereleases&display_name=tag" /></a>
  <a href="./LICENSE"><img alt="License: GPLv3" src="https://img.shields.io/badge/License-GPLv3-blue.svg" /></a>
  <img alt="Platform: Windows | macOS | Linux" src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" />
  <a href="https://github.com/t59688/tunneldock/actions/workflows/release.yml"><img alt="Release build" src="https://img.shields.io/github/actions/workflow/status/t59688/tunneldock/release.yml" /></a>
</p>

**TunnelDock** 是一个基于 [Tauri 2](https://tauri.app/)（Rust）+ [React 19](https://react.dev/) + TypeScript 的桌面控制台，用于管理 **OpenAI Secure MCP Tunnel + Chappie + Pi** 三件套，让 **ChatGPT 网页版**直接读取、修改、构建和测试你电脑上的项目——无需公网 IP、无需域名、无需路由器端口转发，也不暴露任何本地 HTTP 服务。

> 核心理念：**ChatGPT 负责思考与上下文，Pi 负责本地执行**。
>
> `Chappie` 在本项目中仅指 [@zetaloop/chappie](https://www.npmjs.com/package/@zetaloop/chappie) 上游依赖和对应 CLI/profile 配置，不是本软件的产品名称或品牌。

## 目录

- [TunnelDock](#tunneldock)
  - [目录](#目录)
  - [特性](#特性)
  - [架构](#架构)
  - [安装](#安装)
    - [下载发布包](#下载发布包)
    - [从源码构建](#从源码构建)
  - [快速开始](#快速开始)
  - [配置文件](#配置文件)
  - [开发与构建](#开发与构建)
  - [项目结构](#项目结构)
  - [安全须知](#安全须知)
  - [贡献指南](#贡献指南)
  - [许可证](#许可证)
  - [致谢](#致谢)
  - [免责声明](#免责声明)

## 特性

| 模块 | 说明 |
| --- | --- |
| **环境检测与安装** | 自动探测 8 项本机依赖（Node ≥ 26 / npm / Git / Rust / cargo-binstall / otunnel / Pi / Chappie），逐项展示状态与版本，支持单项或「自动安装全部缺失组件」，安装日志实时流式输出 |
| **工作区与 Session** | 添加本地项目工作区（自动探测 Git 分支与未提交变更），管理 Pi Session 生命周期（启动 / 停止 / 重启），一键生成 ChatGPT 项目绑定提示词 |
| **健康度与 Doctor 诊断** | 实时展示 otunnel 守护进程状态、健康探针与网络延迟；一键 Doctor 深度体检（配置、Tunnel ID、凭据、MCP 可达性、控制面连接等 8 项），失败项附中文修复建议 |
| **MCP 调用审计** | 全量记录 ChatGPT 发起的工具调用（工具名 / 参数 / 结果摘要 / 耗时 / 状态），全文搜索、按类型与状态筛选、统计卡片（调用数 / 成功率 / 平均耗时）、单条详情查看与 JSON 导出 |
| **凭据与设置** | 编辑 Tunnel ID、OpenAI Restricted API Key、健康探针端口，保存后自动同步至 `~/.chappie/` |
| **更新中心** | 基于 Tauri Updater 的签名更新：启动后静默后台检查、手动检查、下载进度实时显示、一键安装并重启 |
| **全局框架** | 自绘跨平台标题栏、顶栏（Tunnel 状态 / Session 数量 / 一键启停）、侧边栏实时状态徽章、常驻终端抽屉（流式日志、错误高亮） |

## 架构

```text
ChatGPT 网页版
      │
      │ MCP Tool Call
      ▼
OpenAI Secure MCP Tunnel
      │
      ▼
    otunnel              ← TunnelDock 管理其生命周期、健康与诊断
      │
      │ stdio
      ▼
 pi --chappie            ← stdio MCP Server（Chappie broker）
      │
      ▼
项目中的 Pi Session
      ├── read / write / edit
      ├── bash
      ├── git
      └── build / test
```

关键在于：本地 `otunnel` **主动**通过 HTTPS 出站连接 OpenAI 拉取 MCP 请求，再转发给本地 `pi --chappie`。网络方向始终是出站 443，一般不受防火墙、NAT 与路由器设置影响。

## 安装

### 下载发布包

前往 [Releases](https://github.com/t59688/tunneldock/releases) 下载最新版本：

| 平台 | 产物 |
| --- | --- |
| Windows (x64) | `.msi` / `.exe`（NSIS 安装包） |
| macOS（Apple Silicon / Intel） | `.dmg` / `.app` |
| Linux (x64) | `.AppImage` / `.deb` / `.rpm` |

### 从源码构建

前置条件：

- [Node.js](https://nodejs.org/) ≥ 26
- [Rust](https://rustup.rs/)（stable）
- 平台构建依赖，见 [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)（例如 Linux 需 `libwebkit2gtk-4.1-dev` 等）

```bash
git clone https://github.com/t59688/tunneldock.git
cd hola
npm ci
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`。

## 快速开始

1. **检查环境** — 启动应用进入「环境检测与安装」页面，确认依赖状态；缺失项可点击「自动安装全部缺失组件」。
2. **配置凭据** — 输入 **Tunnel ID** 与 **OpenAI Restricted API Key**（建议权限：`Tunnels: Read/Use`），应用将自动生成 `~/.chappie/tunnelkey.txt` 与 otunnel profile `chappie.yaml`。可在 [OpenAI 平台](https://platform.openai.com/) 创建 Tunnel 与 API Key（应用内提供直达链接）。
3. **启动 Tunnel** — 点击顶栏「启动 Tunnel」，确认守护进程运行且健康探针通过。
4. **添加工作区并启动 Session** — 在「工作区与 Session」添加项目路径，点击「启动 Session」（等效于在该目录运行 `pi --provider chappie --model chatgpt`）。
5. **绑定 ChatGPT** — 点击「生成 ChatGPT 绑定提示词」，复制到 ChatGPT 网页版发送，即可让 ChatGPT 开始操作该本地项目。

更完整的实践与故障排查，参见 [docs/OpenAI Tunnel + Chappie + Pi.md](docs/OpenAI%20Tunnel%20%2B%20Chappie%20%2B%20Pi.md)。
关于系统设计、通信协议与底层核心原理解析，参见 [docs/TUNNELDOCK_ARCHITECTURE_AND_PRINCIPLES.md](docs/TUNNELDOCK_ARCHITECTURE_AND_PRINCIPLES.md)。

## 配置文件

| 路径 | 用途 |
| --- | --- |
| `~/.chappie/tunnelkey.txt` | OpenAI Restricted API Key（控制面凭据） |
| `~/.chappie/chappie.yaml` | otunnel profile：控制面、健康探针（默认由系统自动分配空闲端口）、MCP 目标（`pi --chappie`） |
| 系统数据目录下的 `TunnelDock/` | 工作区列表、应用设置、MCP 调用历史（Rust 端持久化，重启后保留） |

从旧版 `local-mcp-console/` 或更早的 `chappie-desktop/` 升级时，TunnelDock 会在首次启动时自动迁移上述应用数据；`~/.chappie/` 属于 Chappie/otunnel 兼容配置，不会随产品品牌改名。

> 切勿将 `tunnelkey.txt` 或任何 API Key 提交到代码仓库。

## 开发与构建

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 仅前端 Vite 开发服务器（`http://localhost:11420`） |
| `npm run tauri dev` | 桌面应用开发模式运行（热更新） |
| `npm run build` | 前端类型检查（`tsc`）+ 构建 |
| `npm run tauri build` | 完整桌面构建（前端 + Rust） |
| `npm run tauri <cmd>` | 透传 Tauri CLI 的其他命令 |

## 项目结构

```text
hola/
├── src/                        # React 前端（Vite + TypeScript + Tailwind）
│   ├── api/                    # Tauri invoke 命令封装
│   ├── components/             # TitleBar / Header / Sidebar / TerminalDrawer / UpdateDialog
│   ├── hooks/                  # useAppUpdater 等
│   ├── views/                  # 环境 / 工作区 / 健康度 / 审计 / 设置 五大页面
│   └── types/                  # 共享类型
├── src-tauri/                  # Rust 后端
│   ├── src/commands/           # env / workspace / otunnel / history / settings
│   ├── src/utils/              # 进程管理、路径工具
│   └── tauri.conf.json         # 窗口、打包与 updater 配置
├── docs/                       # 功能列表、实践教程
├── .github/workflows/          # release.yml 发布流水线
└── version.json                # 版本唯一来源
```

## 安全须知

当 ChatGPT 被允许通过 MCP 执行操作时，本地 Pi 拥有**你的系统用户权限**，请务必注意：

- 不要以管理员 / root 身份运行 Pi；
- 不要把 Tunnel API Key 或任何凭据提交到 Git；
- 首次连接先做只读测试，确认工作目录（cwd）后再允许修改文件；
- 多项目场景使用 `sessionId` 精确绑定，避免操作错项目；
- 重要仓库保持 Git 工作区干净，便于审查与回滚；
- 项目目录**不是**系统级沙箱——最强的权限边界是：操作系统用户权限 + Git + ChatGPT 工具确认。

## 贡献指南

欢迎任何形式的贡献！

1. 先 [提交 Issue](https://github.com/t59688/tunneldock/issues) 讨论 bug 或新功能；
2. Fork 本仓库，创建特性分支，发起 Pull Request；
3. 请遵循现有代码风格：Rust 端使用 `rustfmt`，前端使用 TypeScript 严格模式；
4. PR 描述中请说明改动目的，UI 变更请附截图。

## 许可证

本项目基于 [GNU General Public License v3.0（GPLv3）](./LICENSE) 开源。

> 这是 **copyleft（著佐权）** 许可证：对本软件的任何衍生作品，在向公众分发时都必须同样以 GPLv3 开源，并提供完整源代码。完整条款见 [LICENSE](./LICENSE)。

## 致谢

- [Tauri](https://tauri.app/) — 跨平台桌面应用框架
- OpenAI Secure MCP Tunnel / `otunnel` — MCP 安全隧道
- [Pi](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) — 本地编码代理与 MCP broker
- [Chappie](https://www.npmjs.com/package/@zetaloop/chappie) — Pi 扩展，以 MCP 暴露会话 broker
- [linux.do](https://linux.do/) — 有意思的社区与技术交流平台

## 免责声明

- 本项目为社区开源工具，**与 OpenAI 官方无关**，非 OpenAI 官方产品；
- Chappie、otunnel、Pi 及其相关名称属于各自上游项目；TunnelDock 仅集成这些组件，不宣称与其品牌存在从属或官方关系；
- 本工具会将 ChatGPT 网页版的工具调用转发到本地执行，请充分理解其中的安全风险并自行负责使用后果；
- 作者不对使用本软件导致的任何数据丢失或损失承担责任。

---

<p align="center">
  <b>让 ChatGPT 安全、透明、可审计地触达你的本地项目。</b>
</p>
