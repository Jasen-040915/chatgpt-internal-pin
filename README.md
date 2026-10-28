# ChatGPT Internal Pin

为 Windows ChatGPT 主窗口标题栏添加一个图钉按钮，点击置顶，再次点击取消，并保存选择。名称保持 ChatGPT，快捷方式使用本机商店原版图标。

本仓库仅包含原创补丁和工具，不含 OpenAI 客户端、图标或账号数据。非 OpenAI 官方项目。MIT 许可仅适用于原创代码。

## 支持版本

内部版本 26.1023.50603，对应本次商店包 OpenAI.Codex_26.1023.6123.0_x64。严格校验原主进程和 preload 的 SHA-256；其他版本拒绝，需重新适配。

## 安装

需要 Python 3.11+。下载源码，在独立 PowerShell 窗口运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-local.ps1
```

出现提示后完全退出 ChatGPT（包括托盘），保持安装窗口运行，再按回车。不要在即将退出的客户端内置终端执行。

安装器从本机商店包复制完整客户端到 `%LOCALAPPDATA%\ChatGPT-Pinned\app`，修改副本中的 ASAR 和 EXE，并校验复制结果。桌面快捷方式叫 ChatGPT。安装器不会自动启动客户端。

任务栏旧图标绑定商店版，第一次需取消固定；从桌面打开修改版，再固定运行中的图标。以后只使用该任务栏图标。修复已有修改版快捷方式的名称和原版图标：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\restore-shortcuts.ps1
```

## 实现和完整排查流程

1. 识别商店包及内部版本，备份原文件，读取 ASAR 索引并验证源文件哈希。
2. 仅在主窗口创建处挂载 pin-main.cjs，调用 Electron setAlwaysOnTop，读取实际状态并保存选择。
3. 隔离 preload 添加封闭 Shadow DOM 图钉按钮。IPC 仅允许登记窗口的本地顶层文档，拒绝其他窗口、子框架与远程页面。
4. 创建新 ASAR，保留原始数据，追加修改条目，更新完整性信息并回读校验。
5. EXE 包含 ASAR 头部 SHA-256。只有原哈希唯一出现时才同步新哈希，保留 ASAR 校验及 onlyLoadAppFromAsar fuse。修改 EXE 会使原有 Authenticode 签名失效。
6. WindowsApps 直接替换被系统拒绝；本机原文件和权限已恢复。因此改为普通目录里的完整客户端副本。
7. 关闭承载聊天的客户端会中断其安装操作，因此安装由用户在独立窗口运行。
8. 默认 EXE 图标与商店图标不同。修复工具从本机商店包读取原版 PNG，原样封装成 ICO，更新快捷方式；名称统一为 ChatGPT。

## 验证

```powershell
node --test test_pin.cjs
python patch_client.py --source ORIGINAL_ASAR --output NEW_ASAR --exe-source ORIGINAL_EXE --exe-output NEW_EXE
```

三项主进程测试通过：置顶和保存、拒绝未授权来源、保留置顶并允许取消。生成的 ASAR 条目已回读校验。早期本地副本实际点击按钮后显示“取消置顶”；用户随后运行当前安装器，本机检测到修改版进程。快捷方式名称和图标引用已核验。

当前版本跨应用遮挡、重启保持及不同缩放比例仍需完整实机验收。Explorer 可能在下次打开客户端时刷新缓存图标。通用安装器仅做语法检查，未在第二台机器完整运行。生成的 ASAR/EXE 含本机客户端代码，只留本机，不上传。

## 恢复与更新

退出修改版并取消固定，从开始菜单启动商店原版并重新固定。商店更新不自动更新此副本；新版需要重新验证和适配补丁。
