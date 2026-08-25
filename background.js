// background.js - 热加载 helper + 开关广播
//
// 两件事：
//   1. 每秒拉一次 /version，发现指纹变化就 chrome.runtime.reload()
//   2. 监听 chrome.storage 的 enhancerEnabled 变化，
//      向 course.ysjf.com 域名下的所有 tab 发 type: 'ysjf-toggle' 消息

const VERSION_URL = 'http://127.0.0.1:9223/version';
const POLL_INTERVAL_MS = 1000;
const TARGET_HOST = 'course.ysjf.com';
const STORAGE_KEY = 'enhancerEnabled';

// ---------- 热加载（保持原样）----------
let lastVersion = null;
let failedAttempts = 0;

async function poll() {
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    failedAttempts = 0;
    const v = data.version;
    if (lastVersion === null) {
      lastVersion = v;
      console.log('[ysjf-watch] baseline:', v);
      return;
    }
    if (v !== lastVersion) {
      console.log('[ysjf-watch] change detected:', lastVersion, '->', v);
      lastVersion = v;
      chrome.runtime.reload();
    }
  } catch (err) {
    failedAttempts++;
    if (failedAttempts === 1 || failedAttempts % 30 === 0) {
      console.warn('[ysjf-watch] poll failed (尝试 ' + failedAttempts + ' 次):', err.message);
      if (failedAttempts === 1) {
        console.warn('[ysjf-watch] 提示: 请先运行 `npm run watch` 启动本地 server');
      }
    }
  }
}

poll();
setInterval(poll, POLL_INTERVAL_MS);

// ---------- 开关广播 ----------
async function broadcastToggle(enabled) {
  try {
    const tabs = await chrome.tabs.query({ url: `*://*.${TARGET_HOST}/*` });
    if (!tabs.length) {
      console.log('[ysjf-toggle] 没有匹配的 tab，enabled=', enabled);
      return;
    }
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'ysjf-toggle', enabled });
        console.log('[ysjf-toggle] → tab', tab.id, 'enabled=', enabled);
      } catch (err) {
        // tab 内容脚本可能还没注入（页面刚加载），忽略
        console.warn('[ysjf-toggle] tab', tab.id, '发送失败:', err.message);
      }
    }
  } catch (err) {
    console.error('[ysjf-toggle] 查询 tab 失败:', err.message);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (!changes[STORAGE_KEY]) return;
  const enabled = Boolean(changes[STORAGE_KEY].newValue);
  broadcastToggle(enabled);
});

// service worker 启动时也检查一次当前状态（防止 SW 重启后丢上下文）
chrome.storage.sync.get([STORAGE_KEY], (res) => {
  const enabled = Boolean(res[STORAGE_KEY]);
  console.log('[ysjf-toggle] SW 启动，当前 enabled=', enabled);
  // 主动广播给已打开的页面，避免 content script 错过推送
  broadcastToggle(enabled);
});

globalThis.__ysjfReloadNow = () => chrome.runtime.reload();