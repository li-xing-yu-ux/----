(() => {
  const dictionary = {
    '牵魂线':'THE STRINGKEEPER','开启体感':'Start Motion','关闭体感':'Stop Motion',
    '连接中 · 可取消':'Connecting · Cancel','加载本地识别 · 可取消':'Loading · Cancel',
    '兼容模式加载中 · 可取消':'Loading · Cancel',
    '鼠标排演':'Mouse Play','等待连接':'Ready to connect',
    '体感演出':'Motion mode','体感演出 · 兼容模式':'Motion mode · Compatibility',
    '牵引':'Pull','唤醒':'Awaken','挣脱':'Break Free',
    '左手未识别':'Left hand not detected','等待一缕魔法':'Waiting for magic',
    '法球 · 向你飞来':'Spell · In flight','魔法 · 爆散':'Magic · Burst',
    '声音开启':'Sound on','声音关闭':'Sound off','开启声音':'Turn sound on','关闭声音':'Mute sound',
    '玩法手记':'How to play','切换全屏':'Toggle fullscreen','开启或关闭声音':'Toggle sound',
    '剧场工具':'Theatre controls','识别状态':'Tracking status','今夜的仪式':'Tonight’s ritual',
    '清空进度并重新排演':'Reset progress and rehearse again','调校':'Settings',
    '关闭提示':'Dismiss message','关闭调校':'Close settings','关闭玩法手记':'Close guide',
    '隐藏界面，按 H 恢复':'Hide interface; press H to restore','显示界面 · H':'Show interface · H',
    '沉浸':'Immersive','沉浸模式 · H':'Immersive mode · H','进入雾中':'Enter the Mist',
    '交互调校':'Interaction settings','牵线调校':'Motion settings','重新排演':'Start over',
    '牵线灵敏度':'Movement sensitivity','爆散强度':'Spell intensity',
    '柔和模式（减弱闪光与震动）':'Gentle mode (less flashing and shaking)',
    '交换左右手识别':'Swap left and right hand tracking',
    '重新校准头部与转掌':'Recalibrate head and palm rotation',
    '身体坐正，双手完整入镜。校准后张开左手，顺时针转掌靠近，逆时针转掌远离。布偶的左右以画面为准。':'Sit upright with both hands fully in view. After calibration, open your left hand: turn it clockwise to bring the puppet closer, or counterclockwise to move it away. Puppet left and right refer to the screen.',
    '摄像头影像仅在本机识别，不显示、不录制、不上传。':'Camera frames are processed on your device. They are not displayed, recorded, or uploaded.',
    '先牵起它，再唤醒魔法。':'Pull the strings. Awaken the magic.',
    '浓雾里的人牵着布偶，更深处的线又牵着他。你可以自由排演，也可以完成三段小仪式。':'A figure in the mist holds the puppet’s strings, while other strings hold him. Rehearse freely or complete the three rituals.',
    '右手 · 牵线':'Right hand · Strings',
    '移动右手掌心，带动布偶上下左右移动。弯曲大拇指，抬起布偶画面左臂；弯曲小拇指，抬起画面右臂。伸直对应手指，手臂放下。':'Move your right palm to guide the puppet. Bend your thumb to raise its screen-left arm, or your little finger to raise its screen-right arm. Straighten the finger to lower that arm.',
    '左手 · 施法与远近':'Left hand · Spells and distance',
    '张开手掌并在画面内转动：顺时针靠近，逆时针远离。手指弯到半握、像捧球一样，开始蓄力；再握紧拳头，法球飞向屏幕并爆散。保持拳头不会连发。':'Open your palm and rotate it in view: clockwise brings the puppet closer, counterclockwise moves it away. Half-close your hand as if holding a ball to charge. Close your fist to cast. Holding a fist will not cast repeatedly.',
    '头部 · 扭曲':'Head · Twist',
    '向肩膀侧歪头，木偶四肢会连带扭转。摆正头部，关节缓缓恢复。点击“调校”可重新设置中立姿态。':'Tilt your head toward a shoulder to twist the puppet’s limbs. Return upright to relax the joints. Use Settings to recalibrate your neutral pose.',
    '鼠标 · 自由排演':'Mouse · Free rehearsal',
    '移动鼠标牵线，按住鼠标或空格蓄力，松开投掷。Q / E 分别抬起两臂，A / D 模拟歪头，滚轮或 [ / ] 控制远近。手机可在舞台拖动并长按蓄力。':'Move the mouse to guide the puppet. Hold the mouse button or Space to charge, then release to cast. Q / E raise the arms; A / D twist the body. Scroll or press [ / ] to change distance. On touchscreens, drag to move and hold to charge.',
    '用浏览器打开本地网页，开启体感并允许摄像头。首次加载识别组件可能需要片刻。没有摄像头时也能完整游玩；画面里始终不会出现摄像头窗口。':'Open the page in your browser, start Motion mode, and allow camera access. The first load may take a moment. You can also play with a mouse. Camera footage never appears on the stage.',
    '正在唤醒雾中的剧场…':'Waking the theatre in the mist…',
    '场景素材未能加载。请确认 script.js 文件完整，重新解压后再打开。':'Scene assets could not load. Check that script.js is complete, then extract the project again.',
    '你牵动它。又是谁，牵动你？':'You pull its strings. Who pulls yours?',
    '右手牵线，左手施法。':'Right hand: strings. Left hand: magic.',
    '它在蓝雾中，等你牵起第一根线。':'In the blue mist, she waits for you to pull the first string.',
    '中立姿态已记住。试着侧歪头，牵动四肢。':'Neutral pose saved. Tilt your head to move the limbs.',
    '蓄满的魔法越过牵线，在你眼前绽开。':'Fully charged magic crosses the strings and blooms before you.',
    '法球穿过蓝雾，向屏幕爆散。':'The spell travels through the mist and bursts toward the screen.',
    '三段仪式已完成。她仍牵在线上，却开始跳自己的舞。':'All three rituals are complete. Still on her strings, she begins her own dance.',
    '线重新绷紧。今夜的排演，从你开始。':'The strings are ready. Tonight’s rehearsal begins with you.',
    '请坐正，双手放松。头部识别后会重新记住中立姿态。':'Sit upright and relax your hands. Head tracking will save a new neutral pose.',
    '识别就绪。请坐正，双手完整入镜，等待头部校准。':'Tracking ready. Sit upright with both hands in view while your head pose is calibrated.',
    '正在使用与上一版相同的页面内识别方式…':'Starting in-page tracking…',
    '当前窗口无法全屏，可在独立浏览器中打开。':'Fullscreen is unavailable in this window. Open the page in a browser.',
    '当前浏览器无法开启声音，仍可继续排演。':'Sound is unavailable in this browser. You can continue playing.',
    '没有获得摄像头权限。请在浏览器地址栏允许摄像头后再开启；鼠标模式仍可完整排演。':'Camera access was denied. Allow camera access in your browser’s address bar, then try again. Mouse mode is still available.',
    '没有找到摄像头。请连接设备，或先用鼠标排演。':'No camera was found. Connect one or use Mouse Play.',
    '摄像头无法打开，可能被其他软件占用。关闭占用后重试。':'The camera could not open. It may be in use by another app. Close that app and try again.',
    '请通过 VS Code Live Server 的 localhost / 127.0.0.1 地址打开网页，以使用摄像头。':'To use your camera, open this page at localhost / 127.0.0.1 through VS Code Live Server.',
    '鼠标排演：移动牵线，按住蓄力，松开投掷':'Mouse Play: move to guide, hold to charge, release to cast',
    '蓝雾布偶场景。移动鼠标控制布偶，Q和E抬起两臂，A和D扭曲四肢，滚轮控制远近，按住空格蓄力、松开投掷。':'Puppet stage. Move the mouse to guide; Q and E raise the arms; A and D twist; scroll to change distance; hold Space to charge and release to cast.',
    '移动 · 分别抬起双臂':'Move · Raise each arm','蓄力投掷':'Charge and cast','转掌远近 · 歪头扭曲':'Rotate palm · Tilt head',
    '右手牵线 · 左手施法':'Right hand: strings · Left hand: magic',
    '移动鼠标牵线':'Move to guide','按住蓄力，松开投掷':'Hold to charge; release to cast',
    '分别抬臂':'Raise arms','歪头扭曲':'Twist','远近':'Distance','空格':'Space',
    '今夜的仪式':'Tonight’s ritual','／ 雾中的操偶者':'/ The puppeteer in the mist',
    '你牵动它。':'You pull its strings.','又是谁，':'Who, then,','牵动你？':'pulls yours?',
  };
  let language='zh';
  try{language=localStorage.getItem('stringkeeper-language')==='en'?'en':'zh';}catch{}
  const records=new WeakMap(), attributes=new WeakMap();
  function english(text){
    const key=text.trim();
    let result=dictionary[key];
    if(result===undefined){
      if(/^蓄力 \d+%/.test(key)) result=key.replace('蓄力 ','Charge ').replace(' · 握拳释放',' · Close your fist to cast');
      else if(/^(左手|右手|头部) /.test(key)) result=key.replace('左手','Left hand').replace('右手','Right hand').replace('头部','Head').replace('校准中','Calibrating').replace('半握','Half-closed').replace('张开','Open').replace('张掌','Open').replace('握拳','Fist').replace('等待','Waiting').replace('蓄力','Charging');
      else if(key.startsWith('摄像头连接失败：')) result=key.replace('摄像头连接失败：','Camera connection failed: ').replace('。鼠标模式可以继续使用。','. Mouse Play is still available.');
      else if(key.startsWith('手部体感已开启，头部识别暂不可用：')) result=key.replace('手部体感已开启，头部识别暂不可用：','Hand tracking is active, but head tracking is unavailable: ').replace('。可在独立 Chrome / Edge 中重试。','. Try again in Chrome or Edge.');
      else if(key.startsWith('手部识别继续运行；头部识别中断：')) result=key.replace('手部识别继续运行；头部识别中断：','Hand tracking continues; head tracking stopped: ');
      else if(key.startsWith('摄像头已连接，但')) result=key.replace('摄像头已连接，但','Camera connected, but ').replace('失败：',' failed: ').replace('。请在独立的 Chrome / Edge 中通过 Live Server 打开页面；如仍失败，请把这段详细提示发给我。','. Open the page through Live Server in Chrome or Edge. If it still fails, share this error message.');
      else result=key;
    }
    return text.replace(key,result);
  }
  function source(node){
    const record=records.get(node);
    return record&&node.data===record.rendered?record.source:node.data;
  }
  function sourceText(element){return [...element.childNodes].map(n=>n.nodeType===3?source(n):n.textContent).join('');}
  function translateNode(node){
    if(!node.parentElement||node.parentElement.closest('script,style,svg,[data-no-i18n]'))return;
    const original=source(node), rendered=language==='en'?english(original):original;
    records.set(node,{source:original,rendered});
    if(node.data!==rendered)node.data=rendered;
  }
  function translateAttribute(element,name){
    const current=element.getAttribute(name);if(current===null)return;
    const record=attributes.get(element)||{};
    const original=record[name]&&record[name].rendered===current?record[name].source:current;
    const rendered=language==='en'?english(original):original;
    record[name]={source:original,rendered};attributes.set(element,record);
    if(current!==rendered)element.setAttribute(name,rendered);
  }
  function refresh(root=document.body){
    if(root.nodeType===3){translateNode(root);return;}
    if(root.nodeType!==1)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(walker.nextNode())translateNode(walker.currentNode);
    for(const element of [root,...root.querySelectorAll('[title],[aria-label]')])
      for(const name of ['title','aria-label'])translateAttribute(element,name);
  }
  function setLanguage(next){
    language=next;document.documentElement.lang=next==='en'?'en':'zh-CN';
    document.title=next==='en'?'The Stringkeeper · Puppet Theatre':'牵魂线 · 雾中的操偶者';
    const button=document.getElementById('languageButton');
    button.textContent=next==='en'?'中文':'EN';
    button.setAttribute('aria-label',next==='en'?'切换到中文':'Switch to English');
    button.title=next==='en'?'切换到中文':'Switch to English';
    refresh();
    try{localStorage.setItem('stringkeeper-language',next);}catch{}
    window.dispatchEvent(new Event('theatre-language-change'));
  }
  window.TheatreI18n={get language(){return language;},sourceText,setLanguage};
  document.getElementById('languageButton').onclick=()=>setLanguage(language==='en'?'zh':'en');
  new MutationObserver(mutations=>{
    for(const m of mutations){
      if(m.type==='characterData')translateNode(m.target);
      else if(m.type==='attributes'&&!m.target.hasAttribute('data-no-i18n'))translateAttribute(m.target,m.attributeName);
      else if(m.type==='childList')for(const node of m.addedNodes)refresh(node);
    }
  }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label']});
  setLanguage(language);
})();
