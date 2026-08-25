#!/usr/bin/env node
/**
 * scripts/watch.js
 *
 * Chrome 扩展热加载工具（v2: HTTP server + 文件指纹）
 *
 * 工作机制：
 *   1. 本脚本启动一个 HTTP server（默认 9223 端口）
 *      - GET  /version    → 返回文件指纹 (mtime+size 的哈希)
 *      - POST /trigger    → 强制 bump 指纹，让 background.js 立即 reload
 *   2. background.js 每秒拉一次 /version，发现变化就 chrome.runtime.reload()
 *   3. chokidar 监听文件改动，触发后立即 POST /trigger（或直接 bump 指纹）
 *
 * 使用：
 *   1. 启动 Chrome:  /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
 *                     --remote-debugging-port=9222 \
 *                     --user-data-dir=/tmp/chrome-dev-profile
 *   2. 在 chrome://extensions/ 加载本扩展（选 "加载已解压的扩展程序"，选项目根目录）
 *   3. npm install && npm run watch
 *   4. 编辑文件保存 → 扩展自动重载（background.js 拉取指纹变化 → runtime.reload()）
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const chokidar = require('chokidar');

// ---------- 配置 ----------
const HTTP_PORT = parseInt(process.env.PORT || '9223', 10);
const ROOT = path.resolve(__dirname, '..');

const WATCH_GLOBS = [
  'manifest.json',
  'popup.html',
  'popup.js',
  'background.js',
  'content.js',
  'styles/*.css',
];
const IGNORED = ['**/node_modules/**', '**/.git/**', '**/.npm-cache/**', '**/scripts/**', '**/icons/**'];

// ---------- 颜色 ----------
const c = {
  reset: '\x1b[0m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', magenta: '\x1b[35m',
};
const ts = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
const log = (color, ...args) => console.log(`${c.dim}[${ts()}]${c.reset} ${color}${args.join(' ')}${c.reset}`);

// ---------- 文件指纹 ----------
function computeFingerprint() {
  const files = [];
  for (const pattern of WATCH_GLOBS) {
    const abs = path.join(ROOT, pattern);
    try {
      const stat = fs.statSync(abs);
      if (stat.isFile()) {
        files.push({
          file: pattern,
          mtime: stat.mtimeMs,
          size: stat.size,
        });
      }
    } catch (_) {
      // 文件不存在，跳过（可能还没创建）
    }
  }
  // 也扫一下 icons/* 和 其他可能的 json/html/js
  const extras = ['icons/*.png', 'icons/*.jpg'];
  for (const pattern of extras) {
    const base = pattern.split('/')[0];
    try {
      const dir = path.join(ROOT, base);
      const list = fs.readdirSync(dir);
      for (const f of list) {
        const abs = path.join(dir, f);
        const stat = fs.statSync(abs);
        if (stat.isFile()) {
          files.push({ file: `${base}/${f}`, mtime: stat.mtimeMs, size: stat.size });
        }
      }
    } catch (_) {}
  }

  // 排序后做哈希，保证顺序无关
  files.sort((a, b) => a.file.localeCompare(b.file));
  const hash = crypto.createHash('sha1');
  for (const f of files) {
    hash.update(f.file);
    hash.update(String(f.mtime));
    hash.update(String(f.size));
    hash.update('|');
  }
  return {
    version: hash.digest('hex').slice(0, 16),
    files: files.length,
    ts: Date.now(),
  };
}

let currentVersion = computeFingerprint();

// ---------- HTTP server ----------
const server = http.createServer((req, res) => {
  // 允许 CORS（避免扩展里 fetch 时被拦）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/version') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    return res.end(JSON.stringify(currentVersion));
  }

  if (req.method === 'POST' && req.url === '/trigger') {
    currentVersion = computeFingerprint();
    log(c.cyan, `↻ 触发 reload（指纹已更新为 ${currentVersion.version}）`);
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    return res.end(JSON.stringify({ ok: true, ...currentVersion }));
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    return res.end('ok');
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(HTTP_PORT, '127.0.0.1', () => {
  log(c.green, `✓ 本地 server 已启动: http://127.0.0.1:${HTTP_PORT}`);
});

// ---------- 文件监听 ----------
function scheduleUpdate(reason) {
  // 重算指纹，watcher 的 awaitWriteFinish 已做防抖，这里只再加一点
  const next = computeFingerprint();
  if (next.version !== currentVersion.version) {
    currentVersion = next;
    log(c.cyan, `↻ ${reason} → 指纹变化 (${next.version})`);
  }
}

const watcher = chokidar.watch(WATCH_GLOBS, {
  cwd: ROOT,
  ignored: IGNORED,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 30 },
});

watcher.on('ready', () => {
  log(c.green, `👀 已监听 ${WATCH_GLOBS.length} 类文件，保存即热加载`);
  log(c.dim, `   当前指纹: ${currentVersion.version} (${currentVersion.files} 个文件)`);
  log(c.yellow, '   提示：在 chrome://extensions/ 加载本扩展（开发者模式 + 加载已解压的扩展程序）');
});
watcher.on('change', (p) => { log(c.blue, `✎ ${p}`); scheduleUpdate(`修改 ${p}`); });
watcher.on('add',    (p) => { log(c.green, `+ ${p}`); scheduleUpdate(`新增 ${p}`); });
watcher.on('unlink', (p) => { log(c.red,   `- ${p}`); scheduleUpdate(`删除 ${p}`); });
watcher.on('error',  (e) => log(c.red, '监听器错误:', e.message));

// ---------- 优雅退出 ----------
process.on('SIGINT', () => {
  log(c.yellow, '\n👋 退出热加载');
  watcher.close().then(() => server.close(() => process.exit(0)));
});