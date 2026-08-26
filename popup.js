// popup.js - 持久化保存两个开关的状态
//
// 开关：
//   - enhancerSwitch  → enhancerEnabled  (上下切换按钮)
//   - autoplaySwitch  → autoplayEnabled  (自动播放：视频结束后自动下一节)

const SWITCHES = [
  { id: 'enhancerSwitch', key: 'enhancerEnabled', label: '上下切换按钮' },
  { id: 'autoplaySwitch', key: 'autoplayEnabled', label: '自动播放' },
];

function init() {
  // 1. 收集所有 input 引用
  const items = SWITCHES.map((s) => {
    const el = document.getElementById(s.id);
    if (!el) console.error('找不到开关元素 #' + s.id);
    return { ...s, el };
  }).filter((s) => s.el);

  // 2. 一次性读取所有 storage 值，回填到对应开关
  const keys = items.map((s) => s.key);
  chrome.storage.sync.get(keys, (result) => {
    if (chrome.runtime.lastError) {
      console.error('读取开关状态失败:', chrome.runtime.lastError);
      return;
    }
    for (const s of items) {
      s.el.checked = Boolean(result[s.key]);
    }
  });

  // 3. 每个开关 change 时回写 storage
  for (const s of items) {
    s.el.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      chrome.storage.sync.set({ [s.key]: enabled }, () => {
        if (chrome.runtime.lastError) {
          console.error('保存 ' + s.label + ' 失败:', chrome.runtime.lastError);
        } else {
          console.log(s.label + ':', enabled ? '已开启' : '已关闭');
        }
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', init);