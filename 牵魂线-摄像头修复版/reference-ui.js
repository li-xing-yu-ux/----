(() => {
  const $ = id => document.getElementById(id);
  const original = element => window.TheatreI18n?.sourceText(element) ?? element.textContent;
  const speaker = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 12h6l8-7v22l-8-7H4z" fill="currentColor" stroke="none"/><path d="M23 10q6 6 0 12M27 6q10 10 0 20"/></svg>';
  const sound = $('soundButton');
  function updateSound() {
    const on = sound.getAttribute('aria-pressed') === 'true';
    sound.innerHTML = '<span class="sr-only">' + (on ? '声音开启' : '声音关闭') + '</span>';
    sound.classList.toggle('sound-off', !on);
    sound.setAttribute('aria-label', on ? '关闭声音' : '开启声音');
  }
  new MutationObserver(updateSound).observe(sound, {attributes:true, attributeFilter:['aria-pressed']});
  updateSound();
  $('fullscreenButton').innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 4H4v7M21 4h7v7M28 21v7h-7M11 28H4v-7"/></svg>';
  const hud = $('referenceHud');
  function sizeHud() {
    const rect = $('theatre').getBoundingClientRect();
    hud.style.setProperty('--hud-scale', Math.min(rect.width / 1672, rect.height / 940));
  }
  new ResizeObserver(sizeHud).observe($('theatre'));
  sizeHud();
  function syncCameraLabel() {
    const label = original($('cameraText'));
    $('cameraButton').dataset.liveLabel = String(label !== '开启体感' || window.TheatreI18n?.language === 'en');
    $('cameraButton').setAttribute('aria-label', $('cameraText').textContent);
    $('cameraButton').dataset.longLabel = String($('cameraText').textContent.length > 14 || (label.length > 5 && window.TheatreI18n?.language !== 'en'));
  }
  new MutationObserver(syncCameraLabel).observe($('cameraText'), {childList:true, subtree:true});
  syncCameraLabel();
  $('modeLabel').textContent = '等待连接';
  const charge = $('chargeBar');
  function updateCharge() {
    const value = Math.max(0, Math.min(100, parseFloat(charge.style.width) || 0));
    $('chargePercent').textContent = String(Math.round(value)).padStart(2, '0') + '%';
    $('chargeReadout').style.setProperty('--charge', value + '%');
    $('chargeReadout').classList.toggle('charging', value > 0);
    $('chargeReadout').style.setProperty('--charge-glow', String(value / 100));
    $('chargeReadout').setAttribute('aria-label', '蓄力 ' + Math.round(value) + '%');
  }
  new MutationObserver(updateCharge).observe(charge, {attributes:true, attributeFilter:['style']});
  updateCharge();
  const chargeHint = $('chargeHint');
  function updateCameraHint() {
    const inCamera = original($('modeLabel')).includes('体感');
    const hand = original($('rightStatus'));
    chargeHint.hidden = !inCamera || !hand.includes('—');
    chargeHint.textContent = chargeHint.hidden ? '' : '左手未识别';
  }
  new MutationObserver(updateCameraHint).observe($('modeLabel'), {childList:true, subtree:true});
  new MutationObserver(updateCameraHint).observe($('rightStatus'), {childList:true, subtree:true});
  updateCameraHint();
  function updateQuest() {
    const items = [...document.querySelectorAll('.ritual li')];
    const next = items.findIndex(item => !item.classList.contains('done'));
    items.forEach((item, i) => { const active = i === (next < 0 ? 2 : next); if (item.classList.contains('active') !== active) item.classList.toggle('active', active); });
  }
  document.querySelectorAll('.ritual li').forEach(item => new MutationObserver(updateQuest).observe(item, {attributes:true, attributeFilter:['class']}));
  // Avoid observer feedback: classList toggles only when the state differs.
  updateQuest();
  $('mouseModeButton').onclick = () => {
    if (original($('cameraText')) !== '开启体感') $('cameraButton').click();
    $('modeLabel').textContent = '鼠标排演';
    $('scene').focus();
  };
  window.addEventListener('theatre-language-change', () => { syncCameraLabel(); updateCameraHint(); updateCharge(); });
  $('referenceSettings').onclick = () => { $('guide').close(); $('settingsButton').click(); };
  $('referenceReset').onclick = () => { $('guide').close(); $('resetButton').click(); };
  $('referenceImmersive').onclick = () => { $('guide').close(); $('hideUiButton').click(); };
})();
