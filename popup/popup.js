document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startSelect');
  const selectorBtn = document.getElementById('selectBySelector');
  const selectorInput = document.getElementById('selectorInput');
  const statusEl = document.getElementById('status');
  const qualitySlider = document.getElementById('quality');
  const qualityValue = document.getElementById('qualityValue');
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  qualitySlider.addEventListener('input', () => {
    qualityValue.textContent = qualitySlider.value + '%';
  });

  function showStatus(message, type = 'info') {
    statusEl.textContent = message;
    statusEl.className = `status show ${type}`;
  }

  function getOptions() {
    const format = document.querySelector('input[name="format"]:checked').value;
    const quality = parseInt(qualitySlider.value) / 100;
    return { format, quality };
  }

  async function injectScripts(tabId) {
    // Inject CSS first
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/content.css']
    });

    // Inject snapdom library
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['lib/snapdom.min.js']
    });

    // Inject content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/content.js']
    });
  }

  async function executeAction(action, extraData = {}) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        showStatus('无法获取当前标签页', 'error');
        return;
      }

      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
        showStatus('无法在此页面使用', 'error');
        return;
      }

      const options = getOptions();

      showStatus('正在加载...', 'info');

      await injectScripts(tab.id);

      // Small delay to ensure scripts are loaded
      await new Promise(r => setTimeout(r, 100));

      chrome.tabs.sendMessage(tab.id, {
        action,
        options,
        ...extraData
      }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus('错误: ' + chrome.runtime.lastError.message, 'error');
        } else if (action === 'startSelection') {
          showStatus('请在页面上选择要截图的元素', 'info');
          setTimeout(() => window.close(), 800);
        } else if (action === 'captureBySelector') {
          showStatus('正在查找元素...', 'info');
        }
      });

    } catch (error) {
      console.error('Error:', error);
      showStatus('发生错误: ' + error.message, 'error');
    }
  }

  // Mouse selection
  startBtn.addEventListener('click', () => {
    executeAction('startSelection');
  });

  // CSS selector
  selectorBtn.addEventListener('click', () => {
    const selector = selectorInput.value.trim();
    if (!selector) {
      showStatus('请输入 CSS 选择器', 'error');
      return;
    }
    executeAction('captureBySelector', { selector });
  });

  // Enter key for selector input
  selectorInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      selectorBtn.click();
    }
  });
});
