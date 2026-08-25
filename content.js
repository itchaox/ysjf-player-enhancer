// content.js
// 在 https://course.ysjf.com/ 的页面里注入"上一节/下一节"按钮
// 切换对象：所有 ul.collapse-content 下的 外层 li（每节课）
// 当前 li 识别：包含 <img src="playing-*.gif"> 的 li

(function () {
  'use strict';

  const TARGET_HOST = 'course.ysjf.com';
  const CONTAINER_ID = 'ysjf-player-enhancer-buttons';
  const STYLE_ID = 'ysjf-player-enhancer-style';

  // 只在目标域名生效
  if (location.hostname !== TARGET_HOST && !location.hostname.endsWith('.' + TARGET_HOST)) {
    return;
  }

  let mounted = false;
  let prevBtn, nextBtn;

  // ---------- 选择器配置 ----------
  const LIST_SELECTOR = 'ul.collapse-content'; // 章节组容器
  const PLAYING_IMG_SELECTOR = 'img[src*="playing"]'; // 当前播放图标（playing-*.gif）

  // ---------- 工具：注入样式 ----------
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      #${CONTAINER_ID} {
        position: fixed !important;
        right: 24px !important;
        bottom: 96px !important;
        z-index: 2147483647 !important; /* 最高优先级，避免被覆盖 */
        display: flex !important;
        gap: 8px !important;
        font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif !important;
        pointer-events: auto !important;
      }
      #${CONTAINER_ID} button {
        all: unset;
        box-sizing: border-box !important;
        cursor: pointer !important;
        padding: 10px 18px !important;
        background: #1e88e5 !important;
        color: #fff !important;
        border-radius: 6px !important;
        font-size: 14px !important;
        line-height: 1 !important;
        user-select: none !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25) !important;
        transition: background 0.15s !important;
      }
      #${CONTAINER_ID} button:hover:not(:disabled) {
        background: #1565c0 !important;
      }
      #${CONTAINER_ID} button:disabled {
        background: #9e9e9e !important;
        cursor: not-allowed !important;
        opacity: 0.6 !important;
      }
    `;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------- 工具：把所有 ul.collapse-content 下的 li 收集起来 ----------
  // 按 DOM 顺序排，因为 ul 是按章节分组的，flatten 后就是课程总列表
  function collectLessons() {
    const uls = document.querySelectorAll(LIST_SELECTOR);
    const lessons = [];
    for (const ul of uls) {
      // 每个 ul 下的直接子 li
      for (const li of ul.children) {
        if (li.tagName !== 'LI') continue;
        lessons.push(li);
      }
    }
    return lessons;
  }

  // ---------- 工具：找到当前播放的 li ----------
  function findCurrentLessonIndex(lessons) {
    for (let i = 0; i < lessons.length; i++) {
      if (lessons[i].querySelector(PLAYING_IMG_SELECTOR)) {
        return i;
      }
    }
    return -1;
  }

  // ---------- 点击某个 li ----------
  // 框架的 click 监听通常挂在 li 内的 .cursor-pointer div 上
  function clickLesson(li) {
    if (!li) return false;

    // 优先点 li 内的 .cursor-pointer div（框架事件监听点）
    // 其次才是 li 本身
    const target = li.querySelector('div.cursor-pointer') || li;

    console.log('[ysjf-enhancer] 派发点击到:', target.tagName, target.className.slice(0, 60));

    // 1) 原生 click
    target.click();

    // 2) 派发完整鼠标事件序列（pointerdown/pointerup/mousedown/mouseup/click）
    // 框架（Vue/React）通常在 root 节点上用 addEventListener 监听 mousedown
    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const baseInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 1,
    };
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      try {
        target.dispatchEvent(new MouseEvent(type, baseInit));
      } catch (e) {}
    }

    return true;
  }

  // ---------- 切换按钮可用性 ----------
  function refreshButtonState() {
    const lessons = collectLessons();
    const idx = findCurrentLessonIndex(lessons);
    if (idx === -1) {
      // 还没识别到当前 li（页面可能刚加载）
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }
    prevBtn.disabled = idx <= 0;
    nextBtn.disabled = idx >= lessons.length - 1;
  }

  // ---------- 创建 UI ----------
  function buildUI() {
    injectStyle();
    const wrap = document.createElement('div');
    wrap.id = CONTAINER_ID;

    prevBtn = document.createElement('button');
    prevBtn.textContent = '上一节';
    prevBtn.addEventListener('click', () => {
      const lessons = collectLessons();
      const idx = findCurrentLessonIndex(lessons);
      if (idx > 0) {
        const ok = clickLesson(lessons[idx - 1]);
        console.log('[ysjf-enhancer] 点击上一节 (idx=' + (idx - 1) + '):', ok);
      }
    });

    nextBtn = document.createElement('button');
    nextBtn.textContent = '下一节';
    nextBtn.addEventListener('click', () => {
      const lessons = collectLessons();
      const idx = findCurrentLessonIndex(lessons);
      if (idx >= 0 && idx < lessons.length - 1) {
        const ok = clickLesson(lessons[idx + 1]);
        console.log('[ysjf-enhancer] 点击下一节 (idx=' + (idx + 1) + '):', ok);
      }
    });

    wrap.appendChild(prevBtn);
    wrap.appendChild(nextBtn);
    refreshButtonState();
    return wrap;
  }

  // ---------- 挂载 / 卸载 ----------
  function mount() {
    if (mounted) return;
    if (!document.body) {
      return document.addEventListener('DOMContentLoaded', mount, { once: true });
    }
    document.body.appendChild(buildUI());
    mounted = true;
    console.log('[ysjf-enhancer] 按钮已挂载');

    // 页面内容可能动态变化（切章节后 li 列表会变），定时刷新按钮可用性
    setInterval(refreshButtonState, 1000);
  }

  function unmount() {
    const el = document.getElementById(CONTAINER_ID);
    if (el) el.remove();
    mounted = false;
    console.log('[ysjf-enhancer] 按钮已移除');
  }

  // ---------- 接收 background 消息 ----------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'ysjf-toggle') return;
    if (msg.enabled) mount(); else unmount();
    sendResponse({ ok: true, mounted: msg.enabled });
    return false;
  });
})();