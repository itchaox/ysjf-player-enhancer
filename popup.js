// popup.js - 持久化保存"播放器增强"开关状态
const SWITCH_ID = 'enhancerSwitch';
const STORAGE_KEY = 'enhancerEnabled';

function init() {
  const switchEl = document.getElementById(SWITCH_ID);
  if (!switchEl) {
    console.error('找不到开关元素 #' + SWITCH_ID);
    return;
  }

  // 页面打开时：读取已保存的状态并回填到开关上
  chrome.storage.sync.get([STORAGE_KEY], (result) => {
    if (chrome.runtime.lastError) {
      console.error('读取开关状态失败:', chrome.runtime.lastError);
      return;
    }
    const enabled = Boolean(result[STORAGE_KEY]);
    switchEl.checked = enabled;
  });

  // 用户切换开关时：把新状态写回 storage
  switchEl.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.storage.sync.set({ [STORAGE_KEY]: enabled }, () => {
      if (chrome.runtime.lastError) {
        console.error('保存开关状态失败:', chrome.runtime.lastError);
      } else {
        console.log('播放器增强:', enabled ? '已开启' : '已关闭');
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', init);