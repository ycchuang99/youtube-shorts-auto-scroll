// Render the real popup with Chrome API fixtures for store screenshots.
(async () => {
  const copy = {
    en: {
      headline: 'Shorts, at your pace.',
      description: 'Keep watching with simple controls for your Shorts feed.',
      features: ['Automatic next Short', 'Optional Shorts ad-card skipping', 'Playback speed from 0.5× to 2×'],
      note: 'Only on Shorts. Regular videos and their ads are unaffected.',
      panel: 'EXTENSION CONTROLS · ENGLISH'
    },
    zh_TW: {
      headline: '照你的節奏，<br>觀看 Shorts。',
      description: '自動切換下一部短片，<br>輕鬆調整觀看步調。',
      features: ['自動捲動到下一部 Shorts', '可選擇略過 Shorts 廣告卡片', '0.5 倍至 2 倍播放速度'],
      note: '僅作用於 Shorts，不更動一般影片及其廣告。',
      panel: '擴充功能控制面板 · 繁體中文'
    },
    zh_CN: {
      headline: '按你的节奏，<br>观看 Shorts。',
      description: '自动切换下一条短视频，<br>轻松调整观看节奏。',
      features: ['自动滚动到下一条 Shorts', '可选择跳过 Shorts 广告卡片', '0.5 倍至 2 倍播放速度'],
      note: '仅作用于 Shorts，不更改普通视频及其广告。',
      panel: '扩展程序控制面板 · 简体中文'
    }
  };
  const requested = new URLSearchParams(location.search).get('lang');
  const locale = Object.hasOwn(copy, requested) ? requested : 'en';
  const text = copy[locale];
  document.documentElement.lang = locale.replace('_', '-');
  document.getElementById('headline').innerHTML = text.headline;
  document.getElementById('description').innerHTML = text.description;
  document.getElementById('features').innerHTML = text.features.map(item => `<li>${item}</li>`).join('');
  document.getElementById('note').textContent = text.note;
  document.getElementById('panel-label').textContent = text.panel;
  const [html, messages] = await Promise.all([
    fetch('../src/popup/popup.html').then(response => response.text()),
    fetch(`../_locales/${locale}/messages.json`).then(response => response.json())
  ]);
  const fixture = `<base href="/src/popup/"><script>
    const messages = ${JSON.stringify(messages)};
    window.chrome = {
      i18n: { getMessage: (key, speed) => key === '@@ui_locale' ? '${locale}' :
        (messages[key]?.message || '').replace('$speed$', speed || '') },
      storage: { sync: { get: async () => ({enabled:true, adSkipEnabled:true, playbackSpeed:1}),
        set: async () => {} } },
      tabs: { query: async () => [], sendMessage: async () => {} }
    };
  <\/script>`;
  const frame = document.querySelector('iframe');
  frame.srcdoc = html.replace('<head>', () => `<head>${fixture}`);
  frame.addEventListener('load', () => {
    frame.style.height = `${frame.contentDocument.documentElement.scrollHeight}px`;
  });
})();
