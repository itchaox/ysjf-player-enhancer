// content.js
// 在 https://course.ysjf.com/ 的页面里把"上一节/下一节"按钮嵌入到 video.js 播放器控制栏
// 位置：.vjs-control-bar 内，.vjs-play-control 按钮的左右两侧
// 切换对象：所有 ul.collapse-content 下的 外层 li（每节课）
// 当前 li 识别：包含 <img src="playing-*.gif"> 的 li

(function () {
  'use strict';

  const TARGET_HOST = 'course.ysjf.com';
  const STYLE_ID = 'ysjf-player-enhancer-style';
  const PREV_BTN_ID = 'ysjf-enhancer-prev';
  const NEXT_BTN_ID = 'ysjf-enhancer-next';

  // 只在目标域名生效
  if (location.hostname !== TARGET_HOST && !location.hostname.endsWith('.' + TARGET_HOST)) {
    return;
  }

  // ---------- 选择器 ----------
  const LIST_SELECTOR = 'ul.collapse-content';
  const PLAYING_IMG_SELECTOR = 'img[src*="playing"]';
  const CONTROL_BAR_SELECTOR = '.vjs-control-bar';
  const PLAY_BTN_SELECTOR = 'button.vjs-play-control';

  let mounted = false;
  let prevBtn, nextBtn;
  let switching = false;
  let controlBarObserver = null; // 监听 .vjs-control-bar 是否出现
  let refreshTimer = null;
  let autoplayEnabled = false; // 是否启用自动播放
  let autoplayObserver = null; // 监听 <video> 标签出现
  let videoEndedHandler = null; // video ended 事件处理函数
  let currentVideo = null; // 当前监听的 video 元素

  // ---------- 工具：收集所有 li ----------
  function collectLessons() {
    const uls = document.querySelectorAll(LIST_SELECTOR);
    const lessons = [];
    for (const ul of uls) {
      for (const li of ul.children) {
        if (li.tagName === 'LI') lessons.push(li);
      }
    }
    return lessons;
  }

  function findCurrentLessonIndex(lessons) {
    for (let i = 0; i < lessons.length; i++) {
      if (lessons[i].querySelector(PLAYING_IMG_SELECTOR)) return i;
    }
    return -1;
  }

  // ---------- 点击某个 li ----------
  function clickLesson(li) {
    if (!li) return false;
    const target = li.querySelector('div.cursor-pointer') || li;
    target.click();
    return true;
  }

  // ---------- 切换等待 ----------
  function waitForSwitch(targetIdx, timeoutMs = 5000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = setInterval(() => {
        const lessons = collectLessons();
        const cur = findCurrentLessonIndex(lessons);
        if (cur === targetIdx) { clearInterval(tick); resolve(true); }
        else if (Date.now() - start > timeoutMs) { clearInterval(tick); resolve(false); }
      }, 200);
    });
  }

  // ---------- 注入样式（仅视频图标相关） ----------
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      /* 上一节 / 下一节按钮：复用 video.js 的 vjs-button 样式，仅替换图标 */
      .vjs-button.ysjf-enhancer-btn {
        cursor: pointer;
      }
      .vjs-button.ysjf-enhancer-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      /* 内联 SVG 图标：覆盖 video.js 默认的 icon-placeholder 字体图标样式 */
      .vjs-button.ysjf-enhancer-btn .vjs-icon-placeholder {
        width: 22px;
        height: 22px;
        display: inline-block;
        fill: currentColor;
      }
      /* 上一节按钮图标旋转 180°，从 ⏭ 变成 ⏮ */
      #${PREV_BTN_ID} .vjs-icon-placeholder {
        transform: rotate(180deg);
        transform-origin: center center;
      }
      /* 缩小按钮与播放按钮的间距 */
      .vjs-button.ysjf-enhancer-btn {
        margin: 0 !important;
      }
    `;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------- 工具：克隆 video.js 播放按钮的结构 ----------
  function createEnhancerButton(id, title, controlText) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'vjs-button vjs-control ysjf-enhancer-btn';
    btn.type = 'button';
    btn.setAttribute('aria-live', 'polite');
    btn.title = title;
    btn.setAttribute('aria-disabled', 'false');

    // 内联 SVG 图标（用户指定的图标）
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('xml:space', 'preserve');
    svg.setAttribute('data-pointer', 'none');
    svg.setAttribute('style', 'enable-background:new 0 0 22 22');
    svg.setAttribute('viewBox', '0 0 22 22');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('vjs-icon-placeholder');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M16 5a1 1 0 0 0-1 1v4.615a1.431 1.431 0 0 0-.615-.829L7.21 5.23A1.439 1.439 0 0 0 5 6.445v9.11a1.44 1.44 0 0 0 2.21 1.215l7.175-4.555a1.436 1.436 0 0 0 .616-.828V16a1 1 0 0 0 2 0V6C17 5.448 16.552 5 16 5z');
    svg.appendChild(path);

    const text = document.createElement('span');
    text.className = 'vjs-control-text';
    text.textContent = controlText;

    btn.appendChild(svg);
    btn.appendChild(text);
    return btn;
  }

  // ---------- 把按钮插入到 .vjs-control-bar 里，播放按钮左右 ----------
  function insertButtonsToControlBar() {
    const bar = document.querySelector(CONTROL_BAR_SELECTOR);
    if (!bar) return false;

    const playBtn = bar.querySelector(PLAY_BTN_SELECTOR);
    if (!playBtn) return false;

    // 已插入则跳过
    if (bar.querySelector('#' + PREV_BTN_ID) && bar.querySelector('#' + NEXT_BTN_ID)) {
      return true;
    }

    if (!prevBtn) {
      prevBtn = createEnhancerButton(PREV_BTN_ID, '上一个', '上一个');
      prevBtn.addEventListener('click', async () => {
        if (switching) return;
        const lessons = collectLessons();
        const idx = findCurrentLessonIndex(lessons);
        if (idx <= 0) return;

        switching = true;
        lockButtons();
        const targetIdx = idx - 1;
        clickLesson(lessons[targetIdx]);
        console.log('[ysjf-enhancer] 点击上一个 (idx=' + targetIdx + ')');
        await waitForSwitch(targetIdx);
        switching = false;
        refreshButtonState();
      });
    }

    if (!nextBtn) {
      nextBtn = createEnhancerButton(NEXT_BTN_ID, '下一个', '下一个');
      nextBtn.addEventListener('click', () => {
        handleNext();
      });
    }

    // 插入到播放按钮的左右
    // playBtn.parentNode.insertBefore(prevBtn, playBtn) → 上一节插到播放按钮前
    // playBtn.parentNode.insertBefore(nextBtn, playBtn.nextSibling) → 下一节插到播放按钮后
    playBtn.parentNode.insertBefore(prevBtn, playBtn);
    if (playBtn.nextSibling) {
      playBtn.parentNode.insertBefore(nextBtn, playBtn.nextSibling);
    } else {
      playBtn.parentNode.appendChild(nextBtn);
    }

    console.log('[ysjf-enhancer] 按钮已嵌入 .vjs-control-bar');
    return true;
  }

  function lockButtons() {
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
  }

  function refreshButtonState() {
    if (switching) return;
    const lessons = collectLessons();
    const idx = findCurrentLessonIndex(lessons);
    if (!prevBtn || !nextBtn) return;
    if (idx === -1) {
      // 还没识别到当前 li，两个按钮都隐藏
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
      return;
    }
    // 第一节：隐藏上一节；最后一节：隐藏下一节
    prevBtn.style.display = idx <= 0 ? 'none' : '';
    nextBtn.style.display = idx >= lessons.length - 1 ? 'none' : '';
  }

  // ---------- 挂载 / 卸载 ----------
  function mount() {
    if (mounted) return;
    if (!document.body) {
      return document.addEventListener('DOMContentLoaded', mount, { once: true });
    }

    injectStyle();

    // 视频可能异步加载，用 MutationObserver 等待 .vjs-control-bar 出现
    controlBarObserver = new MutationObserver(() => {
      if (insertButtonsToControlBar()) {
        refreshButtonState();
      }
    });
    controlBarObserver.observe(document.body, { childList: true, subtree: true });

    // 立即尝试一次（可能视频已加载好）
    if (insertButtonsToControlBar()) {
      refreshButtonState();
    }

    mounted = true;
    console.log('[ysjf-enhancer] 挂载完成，等待 .vjs-control-bar 出现');

    // 定时刷新按钮可用性（页面上 li 可能动态变化）
    refreshTimer = setInterval(refreshButtonState, 1000);
  }

  function unmount() {
    if (controlBarObserver) {
      controlBarObserver.disconnect();
      controlBarObserver = null;
    }
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    // 同时清理自动播放的资源
    detachVideoListener();
    if (prevBtn) prevBtn.remove();
    if (nextBtn) nextBtn.remove();
    prevBtn = null;
    nextBtn = null;
    mounted = false;
    console.log('[ysjf-enhancer] 按钮已卸载');
  }

  // ---------- 接收 background 消息 ----------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== 'ysjf-state') return;
    // 同步两个开关的状态
    if (typeof msg.enhancerEnabled === 'boolean') {
      if (msg.enhancerEnabled) mount(); else unmount();
    }
    if (typeof msg.autoplayEnabled === 'boolean') {
      setAutoplay(msg.autoplayEnabled);
    }
    sendResponse({ ok: true });
    return false;
  });

  // ---------- 自动播放：监听 <video> 的 ended 事件 ----------
  function setAutoplay(enabled) {
    autoplayEnabled = Boolean(enabled);
    console.log('[ysjf-enhancer] 自动播放:', autoplayEnabled ? '开启' : '关闭');
    if (autoplayEnabled) {
      attachVideoListener();
    } else {
      detachVideoListener();
    }
  }

  function detachVideoListener() {
    if (currentVideo && videoEndedHandler) {
      currentVideo.removeEventListener('ended', videoEndedHandler);
    }
    currentVideo = null;
    videoEndedHandler = null;
    if (autoplayObserver) {
      autoplayObserver.disconnect();
      autoplayObserver = null;
    }
  }

  function attachVideoListener() {
    // 立即尝试一次
    tryAttachToVideo();

    // 用 MutationObserver 监听 <video> 标签出现（视频可能异步加载）
    if (!autoplayObserver) {
      autoplayObserver = new MutationObserver(() => {
        tryAttachToVideo();
      });
      autoplayObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function tryAttachToVideo() {
    // video.js 把 <video> 放在 .vjs-tech 类下，也兼容直接的 <video>
    const video = document.querySelector('video.vjs-tech') || document.querySelector('video');
    if (!video) return;
    if (video === currentVideo) return; // 已经绑定过了

    // 解绑旧的
    if (currentVideo && videoEndedHandler) {
      currentVideo.removeEventListener('ended', videoEndedHandler);
    }

    videoEndedHandler = () => {
      console.log('[ysjf-enhancer] 视频播放结束，触发自动下一节');
      // 模拟点击"下一个"按钮的逻辑
      handleNext();
    };
    video.addEventListener('ended', videoEndedHandler);
    currentVideo = video;
    console.log('[ysjf-enhancer] 已绑定 video ended 监听');
  }

  // "下一个"逻辑：从按钮处理中抽出来，自动播放复用
  async function handleNext() {
    if (switching) return;
    const lessons = collectLessons();
    const idx = findCurrentLessonIndex(lessons);
    if (idx < 0 || idx >= lessons.length - 1) {
      console.log('[ysjf-enhancer] 已经是最后一节，不再自动切换');
      return;
    }
    switching = true;
    lockButtons();
    const targetIdx = idx + 1;
    clickLesson(lessons[targetIdx]);
    console.log('[ysjf-enhancer] 自动点击下一个 (idx=' + targetIdx + ')');
    await waitForSwitch(targetIdx);
    switching = false;
    refreshButtonState();
  }

  // ---------- 主动查询 background 当前状态 ----------
  // content script 注入后立即问 background，background 回当前状态
  function queryStateAndMount() {
    try {
      chrome.runtime.sendMessage({ type: 'ysjf-get-state' }, (resp) => {
        if (chrome.runtime.lastError) {
          console.warn('[ysjf-enhancer] 查询 background 状态失败:', chrome.runtime.lastError.message);
          return;
        }
        if (resp) {
          if (resp.enhancerEnabled) {
            console.log('[ysjf-enhancer] 主动查询到 enhancerEnabled=true，挂载按钮');
            mount();
          }
          if (resp.autoplayEnabled) {
            console.log('[ysjf-enhancer] 主动查询到 autoplayEnabled=true，启用自动播放');
            setAutoplay(true);
          }
        }
      });
    } catch (e) {
      console.warn('[ysjf-enhancer] sendMessage 异常:', e.message);
    }
  }

  // 页面加载完成后主动查询一次
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', queryStateAndMount, { once: true });
  } else {
    queryStateAndMount();
  }
})();