// background.js - 热加载 helper + 开关广播
//
// 三件事：
//   1. 每秒拉一次 /version，发现指纹变化就 chrome.runtime.reload()
//   2. 监听 chrome.storage 的 enhancerEnabled / autoplayEnabled 变化，
//      向 course.ysjf.com 域名下的所有 tab 发 type: 'ysjf-state' 消息
//   3. 接收 content script 的 'ysjf-get-state' 查询，把当前两个开关的值回传

const VERSION_URL = 'http://127.0.0.1:9223/version';
const POLL_INTERVAL_MS = 1000;
const TARGET_HOST = 'course.ysjf.com';

// 所有需要同步的开关
const STATE_KEYS = ['enhancerEnabled', 'autoplayEnabled'];

// ---------- 热加载 ----------
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
      return;
    }
    if (v !== lastVersion) {
      lastVersion = v;
      chrome.runtime.reload();
    }
  } catch (err) {
    failedAttempts++;
    if (failedAttempts === 1) {
      console.warn('[ysjf-watch] poll 失败:', err.message, '(请先运行 npm run watch)');
    } else if (failedAttempts === 30) {
      console.warn('[ysjf-watch] poll 持续失败，已静默');
      failedAttempts = 2;
    }
  }
}

poll();
setInterval(poll, POLL_INTERVAL_MS);

// ---------- 开关广播 ----------
async function sendStateToTab(tab) {
  try {
    const res = await chrome.storage.sync.get(STATE_KEYS);
    await chrome.tabs.sendMessage(tab.id, {
      type: 'ysjf-state',
      enhancerEnabled: Boolean(res.enhancerEnabled),
      autoplayEnabled: Boolean(res.autoplayEnabled),
    });
  } catch (_) {
    // 静默：tab 可能没 content script 监听器
  }
}

async function broadcastState() {
  try {
    const tabs = await chrome.tabs.query({ url: `*://*.${TARGET_HOST}/*` });
    await Promise.allSettled(tabs.map(sendStateToTab));
  } catch (_) {}
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  // 只要有任一开关变化，就广播完整状态
  const hit = STATE_KEYS.some((k) => changes[k]);
  if (!hit) return;
  broadcastState();
});

globalThis.__ysjfReloadNow = () => chrome.runtime.reload();

// ---------- 接收 content script 的状态查询 ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'ysjf-get-state') return;
  chrome.storage.sync.get(STATE_KEYS, (res) => {
    sendResponse({
      enhancerEnabled: Boolean(res.enhancerEnabled),
      autoplayEnabled: Boolean(res.autoplayEnabled),
    });
  });
  return true;
});