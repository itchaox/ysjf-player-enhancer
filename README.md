# 飓风课堂播放器助手

一个 Chrome 浏览器扩展（Manifest V3），专门为 [飓风课堂](https://course.ysjf.com/) 打造，让视频学习更顺手。

> ⚠️ **免责声明**：本扩展仅供个人学习使用，请遵守 [飓风课堂服务条款](https://course.ysjf.com/)。扩展只触发页面原有元素的点击事件，不抓取任何数据，不绕过任何付费或登录限制。

## 作者

🎬 **[爱听书的程序员阿超](https://space.bilibili.com/521041866)** —— B站 AI 自媒体，分享 AI 编程实战。

如果这个项目对你有帮助，欢迎来 B站 **点个关注** 👆，你的支持是我持续分享的动力！

---

## 它能做什么

- 🎬 **播放器里直接切换章节**：在视频控制栏里出现 ⏮ "上一个" / ⏭ "下一个" 两个按钮，点一下就切到对应章节，不用回到右边目录去找
- ⏮ **第一个 / 最后一个自动隐藏按钮**：第一节时只显示"下一个"，最后一节时只显示"上一个"
- 📂 **切到新章节时自动展开目录**：跳过去后右边目录对应的章节组会自动展开，一眼能看到自己在哪
- ⏭ **视频结束自动下一节**：开启后视频播完自动切下一节，连播不停顿
- 💾 **开关状态跨设备同步**：你在一台电脑开过"自动连播"，另一台电脑登录同一个 Chrome 账号也是开着的

## 安装

### 第一步：下载代码

前往 [GitHub 仓库](https://github.com/itchaox/ysjf-player-enhancer) 下载 ZIP 并解压，或用 git 克隆：

```bash
git clone git@github.com:itchaox/ysjf-player-enhancer.git
```

### 第二步：加载扩展

1. 打开 Chrome 地址栏输入 `chrome://extensions/` 回车
2. 打开右上角**开发者模式**开关
3. 点击左上角**加载已解压的扩展程序**
4. 选择刚才解压的项目根目录

完成后扩展列表里会出现 **飓风课堂播放器助手**。

> ⚠️ **普通用户到此为止**：用就行了，不用往下看。
>
> 🔧 **开发者继续往下**：有可选的热加载方案。

## 使用方法

1. 打开 [飓风课堂](https://course.ysjf.com/) 任意课程播放页
2. 等视频加载完成
3. 点击工具栏里的扩展图标 🎬，弹窗里可分别开启：
   - **上下切换按钮** —— 播放器控制栏里出现 ⏮"上一个" / ⏭"下一个"
   - **自动连播** —— 视频结束自动下一节
4. 弹窗里还有：
   - 🎬 **现在去飓风课堂学习~** —— 一键跳到课程网站
   - 👉 **关注作者（B站）** —— 支持作者持续开发

## 常见问题

### 按钮没有出现？

- 刷新一下页面（content script 需要重新注入）
- 在 `chrome://extensions/` 检查扩展是否已启用
- 看页面控制台是否有错误

### 自动连播没生效？

- 检查"自动连播"开关是否已打开
- 视频正常结束（不是中途暂停）才会触发
- 章节列表的最后一个时不会切（已经是末尾）

### 视频播放报错 code: 62？

这是飓风课堂播放器自己的接口问题（防盗链 / 流加载失败），**不是扩展的问题**。建议：

- 等几秒让它自己恢复
- 或者刷新页面

### 普通用户怎么调试？

不用调试，遇到问题去 [GitHub Issues](https://github.com/itchaox/ysjf-player-enhancer/issues) 反馈。

---

## 开发者指南

如果你想修改或定制这个扩展，需要先做开发环境的额外配置。

### 1. 启动带调试端口的 Chrome

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-dev-profile
```

> 必须指定 `--user-data-dir`，否则 Chrome 会复用默认 profile 导致调试端口失效。

### 2. 启动文件监听（热加载）

```bash
cd ysjf-player-enhancer
npm install
npm run watch
```

启动后修改任何文件保存，扩展会自动 reload，**注意 `content.js` 改动后已打开的飓风课堂页面需手动刷新一次**。

### 项目结构

```
ysjf-player-enhancer/
├── manifest.json          # 扩展配置
├── popup.html             # 弹窗 UI
├── popup.js               # 弹窗逻辑
├── background.js          # 后台服务：状态同步 + 热加载
├── content.js             # 注入页面的核心逻辑
├── scripts/watch.js       # 热加载脚本
└── icons/                 # 图标
```

## License

Copyright (c) 2026 itchaox (爱听书的程序员阿超) - MIT License，见 [LICENSE](LICENSE) 文件。