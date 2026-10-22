/* The entrance is separate from camera control. Nothing here requests a camera. */
(() => {
  'use strict';
  const app = window.TheatreApp;
  if (!app) return;
  const params = new URLSearchParams(location.search);
  if (params.get('test') === '1' && params.get('entry') !== '1') {
    app.ready.then(() => { app.pause(false); document.body.classList.remove('entry-active'); });
    return;
  }
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const introDuration = 4400;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const copy = {
    zh: { enter: '进入游戏', guide: '玩法说明', settings: '设置', choose: '选择你的布偶', chooseHint: '同一根线，两种灵魂。', back: '返回', confirm: '牵起它', selected: '已选择', ready: '准备进入', loading: '正在整理牵线…', loadError: '场景加载失败，请刷新页面重试。', changeError: '角色暂时未能载入，请再试一次。', skip: '跳过动画', menu: '返回首页', change: '切换角色', lang: '中文 / EN', close: '关闭', hint: '选择角色后进入，摄像头由你手动开启。', guideTitle: '牵起第一根线', guideLead: '可以使用鼠标排演，也可以在进入后开启体感。', handTitle: '右手 · 牵线', handBody: '移动掌心带动布偶。弯曲大拇指、小拇指控制双臂；食指、无名指轻轻带动双腿。', magicTitle: '左手 · 施法', magicBody: '半握手掌蓄力，握拳释放魔法。转动张开的手掌控制远近。', mouseTitle: '鼠标 · 排演', mouseBody: '移动鼠标牵线，按住蓄力，松开投掷。Q / E 抬臂，Z / C 抬腿，A / D 扭曲，滚轮控制远近。', privacy: '摄像头只在你点击“开启体感”后启动，影像仅在本机识别。', sensitivity: '牵线灵敏度', intensity: '魔法强度', gentle: '柔和模式', gentleHint: '减弱闪光与震动', swap: '交换左右手识别', settingsHint: '设置会立即用于这次排演。', roleLabel: '布偶角色', introLabel: '正在进入蓝雾中的剧场', opening: '牵线已就绪', roleClown: '红发女孩', roleWood: '木质人偶', descClown: '瓷白关节 · 绯红发辫', descWood: '旧木纹理 · 赤色悬线' },
    en: { enter: 'Enter Game', guide: 'How to Play', settings: 'Settings', choose: 'Choose your puppet', chooseHint: 'One thread. Two souls.', back: 'Back', confirm: 'Take the Strings', selected: 'Selected', ready: 'Ready to enter', loading: 'Preparing the strings…', loadError: 'The scene could not load. Refresh to try again.', changeError: 'This character could not load. Please try again.', skip: 'Skip Intro', menu: 'Main Menu', change: 'Change Puppet', lang: '中文 / EN', close: 'Close', hint: 'Choose a puppet to enter. Enable your camera when you are ready.', guideTitle: 'Take the first thread', guideLead: 'Rehearse with your mouse, or enable motion control after entering.', handTitle: 'Right hand · Strings', handBody: 'Move your palm to guide the puppet. Bend your thumb / little finger to raise its arms, and your index / ring finger to gently move its legs.', magicTitle: 'Left hand · Magic', magicBody: 'Half-close your palm to charge; make a fist to cast. Rotate your open palm to change distance.', mouseTitle: 'Mouse · Rehearsal', mouseBody: 'Move to guide, hold to charge, release to cast. Q / E raise the arms, Z / C move the legs, A / D twist, and scroll changes distance.', privacy: 'Your camera starts only when you choose Start Motion. Frames are processed on your device.', sensitivity: 'Movement sensitivity', intensity: 'Spell intensity', gentle: 'Gentle mode', gentleHint: 'Softer flashes and movement', swap: 'Swap left / right hand tracking', settingsHint: 'Changes apply to your current rehearsal.', roleLabel: 'Puppet characters', introLabel: 'Entering the theatre in the blue mist', opening: 'The strings are ready', roleClown: 'Scarlet Doll', roleWood: 'Wooden Puppet', descClown: 'Porcelain joints · Scarlet braids', descWood: 'Weathered wood · Crimson strings' }
  };
  let language = window.TheatreI18n?.language === 'en' ? 'en' : 'zh';
  let screen = 'menu', selected = app.getCharacter?.() || 'clown', isReady = false, entering = false, timer = 0, lastFocus = null, operation = 0;
  try { const saved = localStorage.getItem('stringkeeper-character'); if (app.characters.some(character => character.id === saved)) selected = saved; } catch {}
  const t = key => copy[language][key] || key;

  const eye = `<svg class="entry-eye-svg" viewBox="0 0 500 680" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="entryShell" gradientUnits="userSpaceOnUse" cx="221" cy="351" r="270"><stop stop-color="#243bb3"/><stop offset=".53" stop-color="#141a76"/><stop offset="1" stop-color="#040b37"/></radialGradient>
      <radialGradient id="entryIris"><stop offset=".15" stop-color="#210309"/><stop offset=".52" stop-color="#710b1c"/><stop offset=".85" stop-color="#ad2036"/><stop offset="1" stop-color="#35030d"/></radialGradient>
      <radialGradient id="entrySclera"><stop stop-color="#e9ebed"/><stop offset=".66" stop-color="#bec4dc"/><stop offset="1" stop-color="#72799e"/></radialGradient>
      <clipPath id="entryEyeOpening"><path d="M93 404 Q165 304 250 307 Q337 304 407 404 Q331 506 250 504 Q168 506 93 404Z"/></clipPath>
      <filter id="entryEyeHalo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="13"/></filter>
    </defs>
    <g class="entry-eye-echo entry-eye-echo-far"><use href="#entryEyeArtwork"/></g>
    <g class="entry-eye-echo entry-eye-echo-near"><use href="#entryEyeArtwork"/></g>
    <g class="entry-pendulum"><g id="entryEyeArtwork">
    <g class="entry-cord" fill="none" stroke="#444c9b" stroke-width="1.8"><path d="M251-50 C246 33 258 94 250 155 S253 203 247 225"/><path d="M246-50 C242 31 253 109 245 164 S249 204 243 225" opacity=".4"/></g>
    <g class="entry-eye-talisman">
      <circle class="entry-eye-halo" cx="250" cy="404" r="168" fill="#3b40cf" opacity=".23" filter="url(#entryEyeHalo)"/>
      <path d="M244 224 Q227 226 233 211 Q239 201 242 189 Q247 211 250 205 Q261 187 263 207 Q268 222 255 228Z" fill="#121858" stroke="#070a20" stroke-width="2"/>
      <path d="M251 220 C339 223 421 294 434 382 C449 485 383 580 285 594 C186 614 86 554 67 452 C44 345 107 250 203 228 Q226 221 251 220Z" fill="url(#entryShell)" stroke="#090d29" stroke-width="3"/>
      <g fill="none" stroke="#9299d0" opacity=".23" stroke-linecap="round">
        <path d="M239 230 C155 231 84 303 77 378 M217 240 C148 248 98 300 88 352 M202 237 Q134 258 105 304 M263 231 C350 236 415 307 425 387 M285 243 Q365 257 406 333 M295 240 Q355 256 383 292 M78 427 C89 521 171 587 260 587 M88 451 Q114 545 201 569 M278 585 C359 576 414 513 427 438 M302 575 Q375 553 405 487"/>
        <path d="M109 317l-8 14m-3 9-4 14m295-37 8 12m5 9 5 15M113 504l8 13m7 10 9 10m226-4 10-11m5-8 8-12"/>
      </g>
      <g fill="none" stroke="#080c2d" stroke-linecap="round" stroke-width="1.5" opacity=".9">
        <path d="M238 235 Q143 247 94 337 M221 237 Q171 245 129 282 M269 235 Q366 247 409 342 M296 241 Q348 255 375 284 M90 457 Q125 558 211 580 M110 495 Q146 550 198 569 M416 455 Q386 550 294 581 M396 496 Q363 552 311 568"/>
        <path d="M93 373l-5 20m9-41-6 13m315 2 5 23m-7-36 5 11M126 545l16 10m10 6 14 7m201-23-13 10m-13 7-14 6"/>
      </g>
      <g fill="none" stroke="#070b2a" stroke-width="1.4"><circle cx="250" cy="271" r="7"/><path d="M250 255v5m0 22v5m-16-16h5m22 0h5m-27-11 4 4m14 14 4 4m0-22-4 4m-14 14-4 4"/><circle cx="250" cy="537" r="8"/><circle cx="250" cy="559" r="3"/><circle cx="250" cy="575" r="2"/><circle cx="250" cy="291" r="2"/></g>
      <path class="entry-eye-outline" d="M91 404 Q163 302 250 304 Q339 302 409 404 Q332 508 250 507 Q167 509 91 404Z" fill="#050711" stroke="#080b24" stroke-width="5"/>
      <g class="entry-eye-ball" clip-path="url(#entryEyeOpening)">
        <rect x="80" y="298" width="340" height="214" fill="url(#entrySclera)"/>
        <g class="entry-eye-gaze"><circle cx="250" cy="404" r="98" fill="url(#entryIris)" stroke="#16040c" stroke-width="3"/><g class="entry-iris-grain" stroke="#310510" stroke-width="2" opacity=".8">${Array.from({length:44}, (_, i) => { const angle = i*Math.PI*2/44, r1=62+(i%4)*4, r2=87+(i%3)*3; return `<path d="M${250+Math.cos(angle)*r1} ${404+Math.sin(angle)*r1}L${250+Math.cos(angle)*r2} ${404+Math.sin(angle)*r2}"/>`; }).join('')}</g><circle class="entry-pupil" cx="250" cy="404" r="43" fill="#03040a"/><circle cx="228" cy="369" r="5" fill="#ecdce4" opacity=".32"/></g>
        <path class="entry-upper-lid" d="M73 290H427V411 Q250 413 73 411Z" fill="url(#entryShell)"/>
        <path class="entry-lower-lid" d="M73 516H427V401 Q250 400 73 401Z" fill="url(#entryShell)"/>
      </g>
      <path class="entry-open-contour" d="M101 398 Q169 308 250 310 Q334 308 400 398 M103 413 Q177 497 250 499 Q328 497 398 414" fill="none" stroke="#d9e2ed" stroke-width="1.8" opacity=".48"/>
      <path d="M94 403 Q77 401 73 395 M407 403 Q423 400 428 395 M131 327q12-9 24-11m197 12-22-12M155 487q17 13 38 17m114 0q20-6 39-18" fill="none" stroke="#040820" stroke-width="3" stroke-linecap="round"/>
      <path class="entry-closed-seam" d="M94 404 Q250 463 407 404" fill="none" stroke="#030616" stroke-width="4" stroke-linecap="round"/>
    </g>
    </g></g>
  </svg>`;

  const root = document.createElement('section');
  root.id = 'entryScreen'; root.className = 'entry-screen'; root.setAttribute('data-no-i18n', ''); root.setAttribute('aria-label', '进入界面');
  root.innerHTML = `<div class="entry-atmosphere" aria-hidden="true"><div class="entry-glow"></div><div class="entry-fog entry-fog-back"></div><svg class="entry-cloud-texture" viewBox="0 0 1600 700" preserveAspectRatio="none"><defs><filter id="entryCloudNoise" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .014" numOctaves="4" seed="23"/><feColorMatrix values="0 0 0 0 .07 0 0 0 0 .16 0 0 0 0 .58 1.8 0 0 0 -.59"/><feGaussianBlur stdDeviation=".7"/></filter></defs><rect width="1600" height="700" filter="url(#entryCloudNoise)"/></svg><div class="entry-fog entry-fog-front"></div><div class="entry-vignette"></div><div class="entry-grain"></div></div>
    <div class="entry-eye-wrap">${eye}</div>
    <div class="entry-menu" id="entryMenu"><button class="entry-enter" id="entryEnter" data-text="enter" disabled></button><button class="entry-menu-link" id="entryGuide" data-text="guide"></button><button class="entry-menu-link" id="entrySettings" data-text="settings"></button><p class="entry-load-status" id="entryLoadStatus" role="status" aria-live="polite"></p></div>
    <section class="entry-role-screen" id="entryRoles" hidden aria-labelledby="entryRoleTitle"><button class="entry-back" id="entryBack"><span aria-hidden="true">←</span> <span data-text="back"></span></button><div class="entry-role-heading"><span class="entry-small-ornament" aria-hidden="true">◇</span><h2 id="entryRoleTitle" data-text="choose"></h2><p data-text="chooseHint"></p></div><div class="entry-role-grid" id="entryRoleGrid" role="group"></div><button class="entry-role-confirm" id="entryConfirm" data-text="confirm"></button><p class="entry-role-hint" data-text="hint"></p><p id="entryRoleStatus" class="entry-role-status" role="status" aria-live="polite"></p></section>
    <button class="entry-language" id="entryLanguage" data-text="lang"></button><button class="entry-skip" id="entrySkip" data-text="skip" hidden></button><p class="entry-intro-caption" id="entryIntroCaption" data-text="opening" aria-live="polite"></p>`;
  root.style.setProperty('--entry-intro-duration', introDuration+'ms');
  document.body.append(root);
  const toolbar = document.createElement('div');
  toolbar.className = 'entry-game-toolbar'; toolbar.hidden = true; toolbar.setAttribute('data-no-i18n', '');
  toolbar.innerHTML = `<button id="entryReturn"><span aria-hidden="true">⌂</span><span data-text="menu"></span></button><i aria-hidden="true"></i><button id="entryChange"><span aria-hidden="true">◇</span><span data-text="change"></span></button>`;
  document.body.append(toolbar);
  const dialog = document.createElement('dialog');
  dialog.className = 'entry-dialog'; dialog.setAttribute('data-no-i18n', '');
  dialog.innerHTML = '<button class="entry-dialog-close" id="entryDialogClose">×</button><div id="entryDialogContent"></div>';
  document.body.append(dialog);
  const roleGrid = $('#entryRoleGrid', root);
  app.characters.forEach(character => {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'entry-role-card'; card.dataset.character = character.id; card.setAttribute('aria-pressed', 'false');
    const image = document.createElement('img'); image.src = character.image; image.alt = ''; image.draggable = false; image.addEventListener('error', () => { image.hidden = true; card.classList.add('entry-no-portrait'); });
    const portrait = document.createElement('span'); portrait.className = 'entry-role-portrait'; portrait.append(image);
    card.append(portrait);
    card.insertAdjacentHTML('beforeend', `<span class="entry-role-name"></span><span class="entry-role-desc"></span><span class="entry-selected"><span aria-hidden="true">◇</span> <span data-text="selected"></span></span>`);
    card.addEventListener('click', () => { if (entering) return; selected = character.id; updateRoles(); });
    roleGrid.append(card);
  });

  function setPaused(paused) {
    app.pause(paused);
    const theatre = $('#theatre');
    if (theatre) { theatre.inert = paused; theatre.setAttribute('aria-hidden', String(paused)); }
    document.body.classList.toggle('entry-active', paused);
  }
  function updateRoles() {
    [...roleGrid.children].forEach(card => {
      const character = app.characters.find(item => item.id === card.dataset.character);
      const active = character.id === selected;
      card.classList.toggle('is-selected', active); card.setAttribute('aria-pressed', String(active));
      $('.entry-role-name', card).textContent = language === 'en' ? character.nameEn : character.nameZh;
      $('.entry-role-desc', card).textContent = t(character.id === 'wood' ? 'descWood' : 'descClown');
    });
    roleGrid.setAttribute('aria-label', t('roleLabel'));
  }
  function localize() {
    language = window.TheatreI18n?.language === 'en' ? 'en' : 'zh';
    for (const scope of [root, toolbar]) for (const node of scope.querySelectorAll('[data-text]')) node.textContent = t(node.dataset.text);
    root.setAttribute('aria-label', screen === 'intro' ? t('introLabel') : t('enter'));
    $('#entryLoadStatus', root).textContent = isReady ? '' : t('loading');
    $('#entryDialogClose', dialog).setAttribute('aria-label', t('close'));
    updateRoles();
    if (dialog.open) renderDialog(dialog.dataset.kind);
  }
  function openMenu() {
    ++operation; clearTimeout(timer); entering = false; screen = 'menu';
    setPaused(true); toolbar.hidden = true; root.hidden = false; root.className = 'entry-screen';
    $('#entryMenu', root).hidden = false; $('#entryRoles', root).hidden = true; $('#entrySkip', root).hidden = true; $('#entryLanguage', root).hidden = false;
    $('#entryEnter', root).disabled = !isReady;
    requestAnimationFrame(() => $('#entryEnter', root).focus({preventScroll:true}));
  }
  function chooseCharacter() {
    if (!isReady || entering) return;
    ++operation; setPaused(true); toolbar.hidden = true; root.hidden = false; root.className = 'entry-screen is-choosing'; screen = 'roles';
    $('#entryMenu', root).hidden = true; $('#entryRoles', root).hidden = false; $('#entrySkip', root).hidden = true; $('#entryLanguage', root).hidden = false;
    $('#entryConfirm', root).disabled = false; $('#entryRoleStatus', root).textContent = '';
    updateRoles(); requestAnimationFrame(() => $(`[data-character="${selected}"]`, roleGrid)?.focus({preventScroll:true}));
  }
  function finishIntro() {
    if (!entering) return;
    clearTimeout(timer); entering = false; screen = 'game'; root.hidden = true; root.className = 'entry-screen'; toolbar.hidden = false;
    $('#entrySkip', root).hidden = true; setPaused(false); $('#scene')?.focus({preventScroll:true});
    window.dispatchEvent(new CustomEvent('theatre-entered', {detail:{character:selected}}));
  }
  async function start() {
    if (entering || !isReady) return;
    const currentOperation = ++operation;
    entering = true; $('#entryConfirm', root).disabled = true; $('#entryRoleStatus', root).textContent = t('loading');
    try { await app.setCharacter(selected); }
    catch (error) { if (currentOperation !== operation) return; console.error('Character loading failed:', error); entering = false; $('#entryConfirm', root).disabled = false; $('#entryRoleStatus', root).textContent = t('changeError'); return; }
    if (currentOperation !== operation) return;
    try { localStorage.setItem('stringkeeper-character', selected); } catch {}
    const gentle = reducedMotion.matches || Boolean($('#gentle')?.checked);
    screen = 'intro'; root.className = 'entry-screen is-intro' + (gentle ? ' is-gentle' : ''); root.setAttribute('aria-label', t('introLabel'));
    $('#entryMenu', root).hidden = true; $('#entryRoles', root).hidden = true; $('#entryLanguage', root).hidden = true; $('#entrySkip', root).hidden = false;
    $('#entrySkip', root).focus({preventScroll:true});
    // Start the fallback clock with the actual animation, and ignore a skipped
    // or replaced entrance before the queued frames have run.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!entering || screen !== 'intro' || operation !== currentOperation) return;
      root.classList.add('is-opening');
      timer = setTimeout(finishIntro, (gentle ? 350 : introDuration) + 150);
    }));
  }
  function renderDialog(kind) {
    const content = $('#entryDialogContent', dialog); dialog.dataset.kind = kind;
    if (kind === 'guide') {
      content.innerHTML = `<p class="entry-dialog-symbol" aria-hidden="true">◇</p><h2>${t('guideTitle')}</h2><p class="entry-dialog-lead">${t('guideLead')}</p><div class="entry-guide-list">${['hand','magic','mouse'].map(key => `<section><h3>${t(key+'Title')}</h3><p>${t(key+'Body')}</p></section>`).join('')}</div><p class="entry-privacy">${t('privacy')}</p>`;
    } else {
      content.innerHTML = `<p class="entry-dialog-symbol" aria-hidden="true">◇</p><h2>${t('settings')}</h2><p class="entry-dialog-lead">${t('settingsHint')}</p><div class="entry-settings-fields"><label>${t('sensitivity')}<output id="entrySensitivityValue"></output><input id="entrySensitivity" type="range" min="0.5" max="1.8" step="0.1"></label><label>${t('intensity')}<output id="entryIntensityValue"></output><input id="entryIntensity" type="range" min="0.2" max="1" step="0.1"></label><label class="entry-check"><input id="entryGentle" type="checkbox"><span>${t('gentle')}<small>${t('gentleHint')}</small></span></label><label class="entry-check"><input id="entrySwap" type="checkbox"><span>${t('swap')}</span></label></div>`;
      [['entrySensitivity','sensitivity','entrySensitivityValue'],['entryIntensity','intensity','entryIntensityValue'],['entryGentle','gentle'],['entrySwap','swapHands']].forEach(([id, originalId, outputId]) => {
        const input=$('#'+id, dialog), original=$('#'+originalId); if (!original) return;
        const checkbox=input.type==='checkbox'; if (checkbox) input.checked=original.checked; else input.value=original.value;
        const showValue=()=>{ if (outputId) $('#'+outputId,dialog).textContent=id==='entryIntensity'?Math.round(Number(input.value)*100)+'%':Number(input.value).toFixed(1); };
        showValue(); input.addEventListener(checkbox?'change':'input',()=>{if(checkbox)original.checked=input.checked;else original.value=input.value;original.dispatchEvent(new Event(checkbox?'change':'input',{bubbles:true}));showValue();});
      });
    }
    dialog.setAttribute('aria-label', t(kind === 'guide' ? 'guide' : 'settings'));
  }
  function openDialog(kind) { lastFocus = document.activeElement; renderDialog(kind); dialog.showModal(); $('#entryDialogClose', dialog).focus(); }
  $('#entryDialogClose', dialog).addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => lastFocus?.focus({preventScroll:true}));
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect=dialog.getBoundingClientRect(); if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close(); } });
  $('#entryEnter', root).addEventListener('click', chooseCharacter);
  $('#entryBack', root).addEventListener('click', openMenu);
  $('#entryConfirm', root).addEventListener('click', start);
  $('#entrySkip', root).addEventListener('click', finishIntro);
  root.addEventListener('animationend', event => {
    if (event.target === root && ['entry-stage-reveal','entry-gentle-reveal','entry-reduced-reveal'].includes(event.animationName)) finishIntro();
  });
  $('#entryGuide', root).addEventListener('click', () => openDialog('guide'));
  $('#entrySettings', root).addEventListener('click', () => openDialog('settings'));
  $('#entryLanguage', root).addEventListener('click', () => { if (window.TheatreI18n) window.TheatreI18n.setLanguage(language === 'en' ? 'zh' : 'en'); else { language = language === 'en' ? 'zh' : 'en'; localize(); } });
  $('#entryReturn', toolbar).addEventListener('click', openMenu);
  $('#entryChange', toolbar).addEventListener('click', chooseCharacter);
  window.addEventListener('theatre-language-change', localize);
  root.addEventListener('keydown', event => {
    if (dialog.open) return;
    if (event.key === 'Escape') { event.preventDefault(); if (screen === 'intro') finishIntro(); else if (screen === 'roles') openMenu(); }
    if (event.key === 'Tab') {
      const buttons=[...root.querySelectorAll('button:not([disabled])')].filter(node=>node.getClientRects().length>0);
      if(!buttons.length)return; const first=buttons[0],last=buttons[buttons.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  // Gaze is deliberately subtle: the eye follows the cursor without moving the menu.
  root.addEventListener('pointermove', event => { if (screen !== 'menu' || reducedMotion.matches) return; root.style.setProperty('--gaze-x', ((event.clientX / innerWidth - .5) * 9).toFixed(1)+'px'); root.style.setProperty('--gaze-y', ((event.clientY / innerHeight - .5) * 6).toFixed(1)+'px'); });
  root.addEventListener('pointerleave', () => { root.style.setProperty('--gaze-x','0px'); root.style.setProperty('--gaze-y','0px'); });
  setPaused(true); localize();
  app.ready.then(() => { isReady = true; $('#entryEnter', root).disabled = false; $('#entryLoadStatus', root).textContent = ''; }).catch(error => { console.error('Theatre loading failed:', error); $('#entryLoadStatus', root).textContent = t('loadError'); });
  window.TheatreEntry = { openMenu, chooseCharacter, start, skip:finishIntro, get state(){return {screen,selected,isReady,entering};} };
})();
