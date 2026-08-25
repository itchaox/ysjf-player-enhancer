# ysjf-player-enhancer

一个面向 [course.ysjf.com](https://course.ysjf.com/) 的 Chrome 浏览器扩展（Manifest V3），用快捷按钮在视频页内一键切换上一节 / 下一节。

## 功能

- 🎬 **章节切换按钮**：在课程页右下角注入蓝色"上一节 / 下一节"按钮
- 💾 **状态持久化**：开关状态跨设备同步（基于 `chrome.storage.sync`）
- 🔌 **可插拔**：开关关闭时按钮自动从页面移除
- ♻️ **开发热加载**：文件改动后扩展自动 reload，无需手动去 `chrome://extensions/` 刷新

## 项目结构

```
ysjf-player-enhancer/
├── manifest.json          # Manifest V3 配置（content_scripts / permissions）
├── popup.html             # 弹窗 UI（含开关）
├── popup.js               # 弹窗逻辑（读写 chrome.storage）
├── background.js          # Service Worker：广播开关状态 + 热加载 helper
├── content.js             # 注入页面：识别章节、注入按钮、点击切换
├── scripts/
│   └── watch.js           # chokidar + 本地 HTTP server，驱动自动 reload
├── icons/                 # 16/48/128 尺寸占位图标
└── package.json           # 依赖：chokidar、ws
```

## 安装与运行

### 1. 启动带调试端口的 Chrome

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-dev-profile
```

> 第一次需要指定 `--user-data-dir` 给开发用，否则 Chrome 会复用默认 profile 导致调试端口失效。

### 2. 加载扩展

打开 `chrome://extensions/` → 打开右上角**开发者模式** → 点击左上角**加载已解压的扩展程序** → 选择本项目根目录。

### 3.（可选）启动热加载

```bash
npm install
npm run watch
```

启动后，修改任意 `.js` / `.html` / `.json` 文件保存，扩展会在约 2 秒内自动 reload（**注意：已打开的 course.ysjf.com 页面需要手动刷新一次以重新注入 content script**）。

## 开发流程

| 文件改动 | 热加载行为 |
|---|---|
| `popup.js` / `popup.html` | 自动生效（重新打开 popup 即可） |
| `background.js` | 自动 reload，下次操作生效 |
| `content.js` / `manifest.json` | 自动 reload，但**已打开的 course.ysjf.com 页面需手动刷新** |

## 核心模块说明

### `content.js`

- 只在 `course.ysjf.com` 域名生效
- 接收 background 的 `ysjf-toggle` 消息，控制按钮挂载/卸载
- 识别当前播放节：通过 `img[src*="playing"]` 图标定位
- 章节列表：`ul.collapse-content` 下的所有 `<li>`（flatten 后按 DOM 顺序）
- 点击方式：派发 `pointerdown / mousedown / pointerup / mouseup / click` 全套鼠标事件，兼容 Vue / React 的合成事件系统

### `background.js`

- 每秒拉取 `http://127.0.0.1:9223/version` 检测文件指纹变化，触发 `chrome.runtime.reload()`
- 监听 `chrome.storage.onChanged`，把开关变化广播到 course.ysjf.com 的所有 tab

### `scripts/watch.js`

- chokidar 监听 `manifest.json / popup.* / background.js / content.js`
- 计算文件指纹（mtime + size 的 SHA-1），通过 `GET /version` 暴露
- 监听 `GET /health` 和 `POST /trigger` 用于健康检查 / 手动触发 reload

## 后续规划

- ⌨️ 键盘快捷键（左右方向键切上下节）
- ⏭️ 自动跳过片头片尾
- 📌 视频倍速记忆
- 🖼️ 画中画按钮

## License

见 [LICENSE](LICENSE) 文件。