#!/usr/bin/env node
/**
 * scripts/build.js
 *
 * 打包 Chrome 扩展用于商店上架。
 *
 * 思路：
 * 1. 读取 manifest.json 的 version 字段
 * 2. 复制"扩展本体需要的文件"到 dist/ 临时目录
 * 3. 用 zip 把 dist/ 打包成 ysjf-player-helper-v{version}.zip
 *
 * 不打包的文件：
 * - node_modules / package-lock.json / .npm-cache（依赖）
 * - scripts/watch.js（开发热加载工具，含本地路径）
 * - .gitignore / LICENSE / README.md（仓库元数据）
 * - .gstack / .claude（本地工具痕迹）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// ────────── 读 manifest version ──────────
const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf-8')
);
const version = manifest.version;
if (!version) {
  console.error('❌ manifest.json 缺少 version 字段');
  process.exit(1);
}

// ────────── 准备 dist/ 目录 ──────────
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, { recursive: true, force: true });
}
fs.mkdirSync(DIST, { recursive: true });

// ────────── 复制的白名单（Chrome 扩展运行时需要的文件）──────────
const INCLUDE = [
  'manifest.json',
  'popup.html',
  'popup.js',
  'background.js',
  'content.js',
  'icons/',
];

let copied = 0;
for (const rel of INCLUDE) {
  const src = path.join(ROOT, rel);
  const dest = path.join(DIST, rel);
  if (!fs.existsSync(src)) {
    console.warn(`⚠ 跳过不存在的文件/目录: ${rel}`);
    continue;
  }
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    copyDir(src, dest);
  } else {
    fs.copyFileSync(src, dest);
  }
  copied++;
  console.log(`✓ ${rel}`);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// ────────── 打包成 zip ──────────
const zipName = `ysjf-player-helper-v${version}.zip`;
const zipPath = path.join(ROOT, zipName);

// macOS / Linux 上 zip 一般可用
// Windows 用户如果没有 zip，可以装 Git Bash 或用 PowerShell Compress-Archive
try {
  // 注意：zip 的 -r 参数会包含 dist 子目录的相对路径
  // 我们在 dist/ 内执行 zip *，让 zip 看到的是"扩展根目录"的文件
  execSync(`cd "${DIST}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
} catch (err) {
  console.error('❌ zip 命令执行失败:', err.message);
  console.error('   macOS / Linux 用户请确认 zip 已安装');
  console.error('   Windows 用户请用 PowerShell: Compress-Archive -Path dist\\* -DestinationPath .\\' + zipName);
  process.exit(1);
}

// ────────── 清理 dist/ ──────────
fs.rmSync(DIST, { recursive: true, force: true });

const size = (fs.statSync(zipPath).size / 1024).toFixed(1);
console.log(`\n🎉 打包完成: ${zipName} (${size} KB)`);
console.log(`   路径: ${zipPath}`);
console.log(`\n📦 上传到 Chrome Web Store:`);
console.log(`   https://chrome.google.com/webstore/devconsole/`);