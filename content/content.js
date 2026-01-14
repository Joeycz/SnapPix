(() => {
  // Prevent multiple injections
  if (window.__nodeScreenshotInjected) {
    return;
  }
  window.__nodeScreenshotInjected = true;

  let highlightedElement = null;
  let isSelecting = false;
  let captureOptions = { format: 'png', quality: 1 };

  // Highlight element
  function highlight(element) {
    if (highlightedElement && highlightedElement !== element) {
      highlightedElement.classList.remove('node-screenshot-highlight');
    }
    if (element) {
      element.classList.add('node-screenshot-highlight');
      highlightedElement = element;
    }
  }

  function clearHighlight() {
    if (highlightedElement) {
      highlightedElement.classList.remove('node-screenshot-highlight');
      highlightedElement = null;
    }
  }

  // Event handlers
  function handleMouseMove(e) {
    if (!isSelecting) return;
    const target = e.target;
    if (target &&
        !target.classList.contains('node-screenshot-notification') &&
        !target.closest('.node-screenshot-notification')) {
      highlight(target);
    }
  }

  function handleClick(e) {
    if (!isSelecting) return;
    e.preventDefault();
    e.stopPropagation();

    const element = e.target;
    clearHighlight();
    stopSelection();
    captureElement(element);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape' && isSelecting) {
      stopSelection();
      showNotification('已取消选择', 'info');
      setTimeout(hideNotification, 1500);
    }
  }

  // Selection mode
  function startSelection(options = {}) {
    captureOptions = { ...captureOptions, ...options };
    isSelecting = true;
    document.body.style.cursor = 'crosshair';
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    showNotification('移动鼠标选择元素，点击截图，按 ESC 取消');
  }

  function stopSelection() {
    isSelecting = false;
    document.body.style.cursor = '';
    clearHighlight();
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
  }

  // Capture by CSS selector
  function captureBySelector(selector, options = {}) {
    captureOptions = { ...captureOptions, ...options };

    try {
      const element = document.querySelector(selector);
      if (!element) {
        showNotification(`未找到元素: ${selector}`, 'error');
        setTimeout(hideNotification, 2000);
        return;
      }

      // Briefly highlight the found element
      highlight(element);
      showNotification('已找到元素，正在截图...');

      setTimeout(() => {
        clearHighlight();
        captureElement(element);
      }, 300);
    } catch (e) {
      showNotification(`选择器语法错误: ${e.message}`, 'error');
      setTimeout(hideNotification, 2000);
    }
  }

  // Core capture function using snapdom
  async function captureElement(element) {
    showNotification('正在截图...');

    try {
      // Check if snapdom is available
      if (typeof window.snapdom === 'undefined') {
        throw new Error('snapdom 库未加载');
      }

      const isJpeg = captureOptions.format === 'jpeg';

      // snapdom options
      const options = {
        scale: window.devicePixelRatio || 1,
        backgroundColor: isJpeg ? '#ffffff' : null,
        quality: captureOptions.quality,
        cache: 'soft'
      };

      // Use snapdom to capture element
      const result = await window.snapdom(element, options);

      // Get canvas and convert to dataURL
      const canvas = await result.toCanvas();

      const mimeType = isJpeg ? 'image/jpeg' : 'image/png';
      const quality = isJpeg ? captureOptions.quality : undefined;
      const dataUrl = canvas.toDataURL(mimeType, quality);
      const extension = isJpeg ? 'jpg' : 'png';

      // Send to background for download
      chrome.runtime.sendMessage({
        action: 'downloadImage',
        dataUrl: dataUrl,
        filename: `screenshot-${Date.now()}.${extension}`
      }, (response) => {
        if (chrome.runtime.lastError) {
          showNotification('保存失败: ' + chrome.runtime.lastError.message, 'error');
        } else if (response && response.success) {
          showNotification('截图已保存!', 'success');
        } else {
          showNotification('保存失败: ' + (response?.error || '未知错误'), 'error');
        }
        setTimeout(hideNotification, 2000);
      });

    } catch (error) {
      console.error('Screenshot error:', error);
      showNotification('截图失败: ' + error.message, 'error');
      setTimeout(hideNotification, 2000);
    }
  }

  // Notification UI
  let notificationEl = null;

  function showNotification(message, type = 'info') {
    if (!notificationEl) {
      notificationEl = document.createElement('div');
      notificationEl.className = 'node-screenshot-notification';
      document.body.appendChild(notificationEl);
    }
    notificationEl.textContent = message;
    notificationEl.className = `node-screenshot-notification ${type}`;
    notificationEl.style.display = 'block';
  }

  function hideNotification() {
    if (notificationEl) {
      notificationEl.style.display = 'none';
    }
  }

  // Message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startSelection') {
      startSelection(message.options || {});
      sendResponse({ success: true });
    } else if (message.action === 'captureBySelector') {
      captureBySelector(message.selector, message.options || {});
      sendResponse({ success: true });
    }
    return true;
  });
})();
