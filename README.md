# ysjf-player-enhancer

一个面向 [course.ysjf.com](https://course.ysjf.com/) 的 Chrome 浏览器扩展（Manifest V3），在 video.js 播放器的原生控制栏里嵌入"上一节 / 下一节"两个按钮。

## 功能

- 🎬 **嵌入播放器控制栏**：按钮插入到 `.vjs-control-bar` 内 `.vjs-play-control` 按钮的左右两侧，外观与原生控件一致
- ⏮ **当前是第一节时自动隐藏"上一节"**，当前是最后一节时自动隐藏"下一节"
- 🔄 **点击切换章节**：点击按钮触发目标 li 的原生 click 事件，由页面框架（Vue/React）处理路由切换
- 💾 **状态持久化**：开关状态通过 `chrome.storage.sync` 跨设备同步
- 🔌 **可插拔**：关闭开关后按钮从控制栏移除
- ♻️ **开发热加载**：修改文件保存即自动 reload 扩展，无需去 `chrome://extensions/` 手动刷新

## 项目结构

```
ysjf-player-enhancer/
├── manifest.json          # Manifest V3 配置（content_scripts / permissions）
├── popup.html             # 弹窗 UI（含"播放器增强"开关）
├── popup.js               # 弹窗逻辑（读写 chrome.storage）
├── background.js          # Service Worker：广播开关状态 + 热加载 helper
├── content.js             # 注入页面：识别章节、嵌入按钮、点击切换
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

## 使用方法

1. 访问 [course.ysjf.com](https://course.ysjf.com/) 的任意课程播放页
2. 等待视频加载（控制栏出现后按钮自动嵌入）
3. 点击扩展图标 → 打开 **"播放器增强"** 开关
4. 播放按钮左侧出现 ⏮ "上一节"、右侧出现 ⏭ "下一节"
5. 点击按钮即可切换章节

切换章节时按钮会短暂隐藏（避免重复点击）；新章节加载完成后恢复显示。

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
- 用 `MutationObserver` 等待 `.vjs-control-bar` 异步出现，再把按钮插入到播放按钮两侧
- 识别当前播放节：通过 `img[src*="playing"]` 图标定位
- 章节列表：`ul.collapse-content` 下的所有 `<li>`（flatten 后按 DOM 顺序）
- 第一节时隐藏"上一节"，最后一节时隐藏"下一节"
- 点击目标 li 的 `div.cursor-pointer` 触发原生 click，由 Vue/React 框架处理路由切换
- 切换期间锁定按钮，等待 `playing.gif` 移到目标 li 后再解锁（最多 5 秒超时兜底）

### `background.js`

- 每秒拉取 `http://127.0.0.1:9223/version` 检测文件指纹变化，触发 `chrome.runtime.reload()`
- 监听 `chrome.storage.onChanged`，把开关变化广播到 course.ysjf.com 的所有 tab

### `scripts/watch.js`

- chokidar 监听 `manifest.json / popup.* / background.js / content.js`
- 计算文件指纹（mtime + size 的 SHA-1），通过 `GET /version` 暴露
- 监听 `GET /health` 和 `POST /trigger` 用于健康检查 / 手动触发 reload

## License

见 [LICENSE](LICENSE) 文件。