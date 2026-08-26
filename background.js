// background.js - 热加载 helper + 开关广播
//
// 两件事：
//   1. 每秒拉一次 /version，发现指纹变化就 chrome.runtime.reload()
//   2. 监听 chrome.storage 的 enhancerEnabled 变化，
//      向 course.ysjf.com 域名下的所有 tab 发 type: 'ysjf-toggle' 消息
//
// 性能优化：
//   - 启动时不再主动 broadcast（content script 会主动来问）
//   - tabs.sendMessage 每个 tab 独立 try/catch，单个失败不阻塞其他
//   - 减少 console 输出，避免拖慢 popup 渲染

const VERSION_URL = 'http://127.0.0.1:9223/version';
const POLL_INTERVAL_MS = 1000;
const TARGET_HOST = 'course.ysjf.com';
const STORAGE_KEY = 'enhancerEnabled';

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
    // 只在第一次失败和每 30 次失败时打日志，避免噪音
    if (failedAttempts === 1) {
      console.warn('[ysjf-watch] poll 失败:', err.message, '(请先运行 npm run watch)');
    } else if (failedAttempts === 30) {
      console.warn('[ysjf-watch] poll 持续失败，已静默');
      failedAttempts = 2; // 进入低频日志模式
    }
  }
}

poll();
setInterval(poll, POLL_INTERVAL_MS);

// ---------- 开关广播 ----------
// 给单个 tab 发消息，单独 try/catch
async function sendToggleToTab(tab, enabled) {
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'ysjf-toggle', enabled });
  } catch (_) {
    // tab 没有 content script 监听器（页面刚加载/已关闭/非目标页面），静默忽略
  }
}

async function broadcastToggle(enabled) {
  try {
    const tabs = await chrome.tabs.query({ url: `*://*.${TARGET_HOST}/*` });
    // 并发发送，单个失败不阻塞其他
    await Promise.allSettled(tabs.map((tab) => sendToggleToTab(tab, enabled)));
  } catch (_) {
    // tabs.query 失败也静默
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (!changes[STORAGE_KEY]) return;
  const enabled = Boolean(changes[STORAGE_KEY].newValue);
  broadcastToggle(enabled);
});

// ❗ 删掉原来"SW 启动时主动广播"的逻辑
// 原因：
//   1. content script 现在会主动 sendMessage('ysjf-get-state') 来问
//   2. 主动广播会让失败的 tab sendMessage 超时（30s），拖慢 popup 打开
// 之前这行会导致 popup 打开时 background 还没回应 storage.get 就卡住：
//   chrome.storage.sync.get([STORAGE_KEY], (res) => { broadcastToggle(...) });

globalThis.__ysjfReloadNow = () => chrome.runtime.reload();

// ---------- 接收 content script 的状态查询 ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'ysjf-get-state') return;
  chrome.storage.sync.get([STORAGE_KEY], (res) => {
    sendResponse({ enabled: Boolean(res[STORAGE_KEY]) });
  });
  return true;
});