/*
 * 牵魂线 / THE STRINGKEEPER — 蓝雾交互版
 * index.html + style.css + script.js 即可运行。建议用 VS Code Live Server。
 * 手部 / 面部推理完全本地执行；独立线程失败时自动改用页面内识别；不上传影像。
 * embedded-assets-*.js 包含内嵌图像、MediaPipe 0.10.18、WASM 和官方模型，需先于本文件加载。
 * 五个课堂修改区以 ★ 标记。键位、阈值、速度集中在 CONFIG。
 */
'use strict';
(() => {
  const CONFIG = {
    width: 1672, height: 940, puppetSize: 462,
    moveSmooth: 9, jointSmooth: 12, armSmooth: 18, legSwing: .035, legBend: .12, chargeSeconds: 1.7,
    fireCooldown: .85, gestureStableMs: 170, minimumCharge: .16,
    openThreshold: .79, fistThreshold: .24,
    depthMin: .68, depthMax: 1.43, twistLimit: .65,
    inferenceInterval: 60, lostTimeout: 450
  };
  const $ = id => document.getElementById(id);
  const canvas = $('scene'), ctx = canvas.getContext('2d', {alpha:false});
  const W=CONFIG.width,H=CONFIG.height,TAU=Math.PI*2;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const smooth=(a,b,rate,dt)=>mix(a,b,1-Math.exp(-rate*dt));
  const normAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const rand=(a,b)=>a+Math.random()*(b-a);
  const storage={get(key,fallback){try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback}catch{return fallback}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}};
  const saved=storage.get('stringkeeper-v2-progress',null);
  const validSaved=saved&&Array.isArray(saved.flags)&&saved.flags.length===6&&saved.flags.every(v=>typeof v==='boolean')&&Number.isInteger(saved.casts)&&saved.casts>=0&&saved.casts<=3;
  const state={
    x:W*.5,y:527,tx:W*.5,ty:527,depth:1,targetDepth:1,
    paused:!(new URLSearchParams(location.search).get('test')==='1'&&new URLSearchParams(location.search).get('entry')!=='1'),pausePainted:false,
    armL:0,armR:0,targetArmL:0,targetArmR:0,legL:0,legR:0,targetLegL:0,targetLegR:0,tilt:0,targetTilt:0,
    charge:0,charging:false,spell:'idle',lastFire:-10,clock:0,recoil:0,
    mode:'mouse',phase:'off',handGesture:'none',candidate:'none',candidateAt:0,
    rollPrev:null,headNeutral:null,headSamples:[],faceTilt:0,
    lastLeft:0,lastRight:0,lastFace:0,seenLeft:false,seenRight:false,seenFace:false,
    fistLatched:false,pointerHeld:false,keys:new Set(),sound:false,immersive:false,
    progress:validSaved?{flags:[...saved.flags],casts:saved.casts}:{flags:[false,false,false,false,false,false],casts:0},
    sensitivity:1,intensity:.7,gentle:matchMedia('(prefers-reduced-motion: reduce)').matches,
    bounds:{scale:1,ox:0,oy:0},aim:{x:W*.5,y:H*.5}
  };
  const images={}, particles=[],waves=[],projectiles=[];
  let lastFrame=performance.now(), uiTime=0, messageTimer=0, winAnnounced=false;
  let surfaceW=0,surfaceH=0,pixelRatio=1,dragStart=null,audio=null,audioMaster=null,chargeHum=null;
  const fogCanvas=document.createElement('canvas');fogCanvas.width=256;fogCanvas.height=128;
  const fogCtx=fogCanvas.getContext('2d');
  const fogGradient=fogCtx.createRadialGradient(128,64,0,128,64,110);fogGradient.addColorStop(0,'rgba(146,184,218,.16)');fogGradient.addColorStop(1,'rgba(146,184,218,0)');fogCtx.fillStyle=fogGradient;fogCtx.fillRect(0,0,256,128);
  function message(text,duration=5000){$('message').textContent=text;clearTimeout(messageTimer);if(duration)messageTimer=setTimeout(()=>{$('message').textContent=state.mode==='camera'?'右手牵线，左手施法。':'你牵动它。又是谁，牵动你？';},duration);}
  function error(text){$('errorText').textContent=text;$('errorBanner').hidden=false;}
  function circle(x,y,r,fill){ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=fill;ctx.fill();}
  function line(a,b,color,width=1){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  function glow(x,y,r,color){if(r<=0)return;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');circle(x,y,r,g);}

  // ★ 1 / 关键点 → 手指伸展、转掌、头部倾斜。距离和夹角都已归一化。
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));}
  function jointAngle(a,b,c){const u=[a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0)],v=[c.x-b.x,c.y-b.y,(c.z||0)-(b.z||0)];return Math.acos(clamp(u.reduce((s,n,i)=>s+n*v[i],0)/(Math.hypot(...u)*Math.hypot(...v)||1),-1,1));}
  function extension(points,mcp,pip,tip){
    const angle=jointAngle(points[mcp],points[pip],points[tip]);
    const angleScore=clamp((angle-1.25)/1.55,0,1);
    const reach=dist(points[tip],points[mcp])/(dist(points[pip],points[mcp])+dist(points[tip],points[pip])||1);
    return clamp(angleScore*.75+clamp((reach-.45)/.5,0,1)*.25,0,1);
  }
  function validPoints(points){return Array.isArray(points)&&points.length===21&&points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z??0));}
  function bendCurve(value,start,end){const u=clamp((value-start)/(end-start),0,1);return u*u*(3-2*u);}
  function analyzeHand(points,worldPoints=null,aspect=1.6){
    // 世界坐标的三轴使用同一单位；后备坐标按画面宽高比还原，避免转掌改变弯曲程度。
    const geometry=validPoints(worldPoints)?worldPoints:points.map(p=>({x:p.x,y:p.y/aspect,z:p.z||0}));
    const flex=(a,b,c)=>Math.PI-jointAngle(geometry[a],geometry[b],geometry[c]);
    const palm=dist(geometry[0],geometry[9])||.1,width=dist(geometry[5],geometry[17])||palm;
    const curls=[[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]].map(([m,p,d,t])=>{
      const pip=flex(m,p,d),dip=flex(p,d,t),mcp=flex(0,m,p);
      const length=dist(geometry[m],geometry[p])+dist(geometry[p],geometry[d])+dist(geometry[d],geometry[t]);
      const compression=1-dist(geometry[m],geometry[t])/(length||1);
      return clamp(Math.max((pip+.45*dip-.22)/1.75,(mcp-.8)/1.55,(compression-.07)/.60),0,1);
    });
    // 大拇指分别测 MCP / IP，兼顾向掌心收拢；不再把自然并拢当作弯指。
    // 录屏对照发现世界坐标会把伸直的拇指估成弯曲；拇指改用宽高比校正的影像坐标及相对深度。
    const thumbGeometry=points.map(p=>({x:p.x,y:p.y/aspect,z:p.z||0}));
    const thumbFlex=(a,b,c)=>Math.PI-jointAngle(thumbGeometry[a],thumbGeometry[b],thumbGeometry[c]);
    const thumbJoints=clamp((.65*thumbFlex(1,2,3)+.55*thumbFlex(2,3,4)-.12)/.95,0,1);
    const thumbLength=dist(thumbGeometry[1],thumbGeometry[2])+dist(thumbGeometry[2],thumbGeometry[3])+dist(thumbGeometry[3],thumbGeometry[4]);
    const thumbWidth=dist(thumbGeometry[5],thumbGeometry[17])||palm;
    const palmFold=clamp((.8-dist(thumbGeometry[4],thumbGeometry[5])/(thumbLength||palm))/.65,0,1);
    // 从拇指根部向掌心折也算弯指，不要求指尖先到小指根部。
    const baseFold=clamp((thumbFlex(0,1,2)-.55)/1.15,0,1)*(.45+palmFold*.55);
    const opposition=clamp((1.15-dist(thumbGeometry[4],thumbGeometry[17])/thumbWidth)/.8,0,1);
    const thumbCurl=Math.max(thumbJoints,baseFold,opposition*.85);
    const fingers=curls.map(c=>1-c),openness=fingers.reduce((s,n)=>s+n,0)/4;
    const gesture=openness>CONFIG.openThreshold?'open':openness<CONFIG.fistThreshold?'fist':'half';
    return {fingers,thumb:1-thumbCurl,thumbStraight:1-thumbJoints,pinky:fingers[3],openness,gesture,
      curls:{thumb:thumbCurl,index:curls[0],middle:curls[1],ring:curls[2],pinky:curls[3]},
      x:1-points[9].x,y:points[9].y,roll:Math.atan2((points[9].y-points[0].y)/aspect,-(points[9].x-points[0].x))};
  }
  const fingerBindings={thumb:'targetArmL',pinky:'targetArmR',index:'targetLegL',ring:'targetLegR'};
  const fingerProfiles={
    thumb:{noise:.025,on:.14,off:.065,full:.46,rate:28,arm:true},
    pinky:{noise:.04,on:.18,off:.11,full:.62,rate:25,arm:true},
    index:{noise:.04,on:.25,off:.12,full:.78,rate:18,arm:false},
    ring:{noise:.04,on:.25,off:.12,full:.78,rate:18,arm:false}
  };
  const fingerControl={ready:false,calibrated:false,samples:[],channels:{},last:0,cadence:100,position:null};
  function resetFingerControl(){
    fingerControl.ready=false;fingerControl.calibrated=false;fingerControl.samples=[];fingerControl.channels={};fingerControl.last=0;fingerControl.cadence=100;fingerControl.position=null;
    Object.values(fingerBindings).forEach(key=>state[key]=0);
  }
  function releaseFingerControl(){
    for(const channel of Object.values(fingerControl.channels)){channel.history=[];channel.rest=[];channel.filtered=0;channel.active=false;channel.candidate=null;channel.count=0;}
    Object.values(fingerBindings).forEach(key=>state[key]=0);fingerControl.position=null;
  }
  function updateFingerControl(hand,now){
    const names=Object.keys(fingerBindings),elapsed=fingerControl.last?Math.max(1,now-fingerControl.last):60;
    if(fingerControl.last)fingerControl.cadence=mix(fingerControl.cadence,Math.min(elapsed,1200),.3);
    const dt=clamp(elapsed/1000,.015,.2);fingerControl.last=now;
    if(!fingerControl.ready){
      for(const name of names)fingerControl.channels[name]={baseline:Math.min(hand.curls[name],name==='thumb'?.5:.12),history:[],rest:[],filtered:0,active:false,candidate:null,since:0,count:0};
      fingerControl.ready=true;
    }
    if(!fingerControl.calibrated){
      const relaxed=['index','middle','ring','pinky'].every(name=>hand.curls[name]<.25)&&hand.curls.thumb<.65;
      if(relaxed){
        const samples=fingerControl.samples;samples.push({time:now,...hand.curls});if(samples.length>18)samples.shift();
        if(samples.length>=5&&now-samples[0].time>=350){
          // 只降低中立值；可选校准不能吞掉一个正在持续的轻弯动作。
          for(const name of names){const sorted=samples.map(s=>s[name]).sort((a,b)=>a-b);fingerControl.channels[name].baseline=Math.min(fingerControl.channels[name].baseline,sorted[Math.floor(sorted.length/2)]);}
          fingerControl.calibrated=true;fingerControl.samples=[];
        }
      }else fingerControl.samples=[];
    }
    for(const name of names){
      const channel=fingerControl.channels[name],profile=fingerProfiles[name],raw=hand.curls[name];
      // 一帧异常偏直也不能永久降低基线；连续几帧更直时才更新。
      channel.rest.push(raw);if(channel.rest.length>5)channel.rest.shift();
      if(channel.rest.length===5){const sorted=[...channel.rest].sort((a,b)=>a-b),rest=sorted[3];if(rest<channel.baseline-.025)channel.baseline=mix(channel.baseline,rest,.65);}
      const delta=clamp((raw-channel.baseline-profile.noise)/Math.max(.3,1-channel.baseline-profile.noise),0,1);
      channel.history.push(delta);if(channel.history.length>3)channel.history.shift();
      const sorted=[...channel.history].sort((a,b)=>a-b),median=sorted[Math.floor((sorted.length-1)/2)];
      channel.filtered=smooth(channel.filtered,median,profile.rate,dt);
      const next=channel.active?channel.filtered>profile.off:channel.filtered>profile.on;
      if(profile.arm){
        // 中值过滤本身已要求两帧确认；手臂不再叠加第二轮等待。
        if(!next)channel.active=false;
        else if(channel.history.length>=2)channel.active=true;
      }else if(next===channel.active){channel.candidate=null;channel.count=0;}
      else{
        if(channel.candidate!==next){channel.candidate=next;channel.since=now;channel.count=1;}else channel.count++;
        if(channel.count>=2&&now-channel.since>=45){channel.active=next;channel.candidate=null;channel.count=0;}
      }
      state[fingerBindings[name]]=channel.active?bendCurve(channel.filtered,profile.arm?.02:.08,profile.full):0;
    }
  }

  function decideGesture(gesture,now){
    if(gesture!==state.candidate){state.candidate=gesture;state.candidateAt=now;return;}
    if(now-state.candidateAt<CONFIG.gestureStableMs||state.handGesture===gesture)return;
    state.handGesture=gesture;
    if(gesture==='half'){state.fistLatched=false;state.charging=true;state.spell='charging';}
    else if(gesture==='fist'){
      state.charging=false;
      if(!state.fistLatched){fire(true);state.fistLatched=true;}
    }else{
      state.fistLatched=false;state.charging=false;
      if(gesture==='open')state.rollPrev=null;
    }
  }
  function processTracking(result,now=performance.now()){
    if(state.mode!=='camera'||state.paused)return;
    if(window.__theatreTest)window.__theatreTest.lastTracking=result;
    let left=null,right=null;
    (result.hands||[]).forEach(hand=>{
      // 推理画面已水平镜像：当前模型标签与使用者实际左右手相反，界面按实际手显示。
      if(!validPoints(hand.points))return;
      const wrist=hand.points[0],middle=hand.points[9];
      if(wrist.x<0||wrist.x>1||middle.x<.025||middle.x>.975||middle.y<.025||middle.y>.975||dist(wrist,middle)<.025)return;
      let side=String(hand.side||'').toLowerCase();if($('swapHands').checked)side=side==='left'?'right':'left';
      const data=analyzeHand(hand.points,hand.worldPoints,(result.videoWidth||640)/(result.videoHeight||400));
      if(side==='left')left=data;else if(side==='right')right=data;
    });
    state.seenLeft=Boolean(left);state.seenRight=Boolean(right);
    if(left){
      state.lastLeft=now;const s=state.sensitivity;
      // 输入已经镜像：analyzeHand 中的 1-x 在这里还原为画面坐标。
      state.tx=clamp(W*.5+((1-left.x)-.5)*W*.82*s,350,1320);
      state.ty=clamp(535+(left.y-.5)*H*.53*s,380,690);
      const position={x:left.x,y:left.y};
      if(fingerControl.position&&Math.hypot(position.x-fingerControl.position.x,position.y-fingerControl.position.y)>.28)releaseFingerControl();
      fingerControl.position=position;updateFingerControl(left,now);
      if(Math.abs(state.tx-W*.5)>65||Math.abs(state.ty-535)>50)mark(0);
      if(state.targetArmL>.7)mark(1);if(state.targetArmR>.7)mark(2);
    }
    if(right){
      state.lastRight=now;
      decideGesture(right.gesture,now);
      if(right.gesture==='open'&&state.handGesture==='open'){
        // 镜像输入：用实际屏幕方向的掌轴角，顺时针为正。
        const roll=Math.PI-right.roll;
        if(state.rollPrev!==null){const delta=normAngle(roll-state.rollPrev);if(Math.abs(delta)<.45&&Math.abs(delta)>.004){state.targetDepth=clamp(state.targetDepth+delta*.85,CONFIG.depthMin,CONFIG.depthMax);if(Math.abs(state.targetDepth-1)>.09)mark(3);}}
        state.rollPrev=roll;
      }else state.rollPrev=null;
    }else{state.rollPrev=null;state.charging=false;state.candidate='none';state.handGesture='none';state.fistLatched=false;}
    if(result.faceUpdated){
      state.seenFace=Boolean(result.face);
      if(result.face){
        state.lastFace=now;const a=result.face[33],b=result.face[263];
        // 始终从画面左眼指向右眼，消除左右标号造成的 π 跳变。
        const l=a.x<b.x?a:b,r=a.x<b.x?b:a;
        const roll=Math.atan2((r.y-l.y)*result.videoHeight,(r.x-l.x)*result.videoWidth);
        if(state.headNeutral===null){state.headSamples.push(roll);if(state.headSamples.length>=8){state.headNeutral=state.headSamples.reduce((s,n)=>s+n,0)/state.headSamples.length;message('中立姿态已记住。试着侧歪头，牵动四肢。');}}
        if(state.headNeutral!==null){const relative=normAngle(roll-state.headNeutral);state.targetTilt=clamp(Math.abs(relative)<.035?0:relative*1.5,-CONFIG.twistLimit,CONFIG.twistLimit);if(Math.abs(state.targetTilt)>.16)mark(4);}
      }
    }
    updateTrackingUI();
  }
  function updateTrackingUI(){
    $('leftStatus').textContent=state.seenLeft?'右手 ✓':'右手 —';
    const labels={open:'张掌',half:'半握 · 蓄力',fist:'握拳',none:'—'};
    $('rightStatus').textContent=state.seenRight?`左手 ${labels[state.handGesture]}`:'左手 —';
    $('faceStatus').textContent=state.seenFace?(state.headNeutral===null?'头部 校准中':'头部 ✓'):'头部 —';
  }
  function expireTracking(now){
    if(state.mode!=='camera')return;
    if(now-state.lastRight>CONFIG.lostTimeout){state.charging=false;state.handGesture='none';state.candidate='none';state.rollPrev=null;state.seenRight=false;}
    if(now-state.lastLeft>Math.max(900,fingerControl.cadence*2.5)){releaseFingerControl();state.seenLeft=false;}
    if(now-state.lastFace>800){state.targetTilt=0;state.seenFace=false;}
  }

  // ★ 2 / 分段关节。独立绘制手臂与腿部，避免裙摆被手指动作拉扯。
  const RIG={head:{x:500,y:245},leftShoulder:{x:375,y:350},rightShoulder:{x:625,y:350},leftElbow:{x:316,y:405},rightElbow:{x:684,y:405},leftHand:{x:155,y:500},rightHand:{x:845,y:500},leftHip:{x:435,y:620},rightHip:{x:565,y:620},leftKnee:{x:436,y:694},rightKnee:{x:564,y:694},leftFoot:{x:423,y:937},rightFoot:{x:577,y:937}};
  const bodyParts={};
  const armMask=[[349,344],[393,368],[386,374],[341,427],[279,465],[218,493],[185,537],[126,539],[84,524],[83,483],[127,477],[122,438],[176,439],[209,458],[275,400],[305,375]];
  // 接缝在球形关节内结束，关节两侧保留重叠；不再让直线裁切穿过关节外缘。
  const upperMask=[[349,344],[393,368],[386,374],[331,415],[316,421],[301,413],[299,400],[305,375]];
  const lowerMask=[[315,394],[331,405],[328,424],[279,465],[218,493],[185,537],[126,539],[84,524],[83,483],[127,477],[122,438],[176,439],[209,458],[275,400],[303,393]];
  const legMask=[[389,620],[482,620],[488,744],[474,857],[489,1000],[364,1000],[364,849],[373,735],[392,693]];
  const thighMask=[[390,598],[483,598],[476,657],[462,694],[436,709],[410,694],[399,661]];
  const shinMask=[[414,690],[436,679],[458,690],[474,710],[488,744],[474,857],[489,1000],[364,1000],[364,849],[373,735],[396,708]];
  const mirror=points=>points.map(([x,y])=>[1000-x,y]);
  function maskPath(c,poly){c.beginPath();poly.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
  function layer(poly,joint,radius=0){const c=document.createElement('canvas');c.width=c.height=1000;const g=c.getContext('2d');g.save();maskPath(g,poly);g.clip();g.drawImage(images.puppet,0,0,1000,1000);g.restore();if(joint){g.save();g.beginPath();g.arc(joint.x,joint.y,radius,0,TAU);g.clip();g.drawImage(images.puppet,0,0,1000,1000);g.restore();}return c;}
  function jointCap(point,rx,ry){
    const c=document.createElement('canvas');c.width=c.height=1000;const g=c.getContext('2d');
    g.beginPath();g.ellipse(point.x,point.y,rx,ry,0,0,TAU);g.clip();
    // 不透明的球窝位于原关节纹理下方，旋转时也不会透出蓝色背景。
    const shade=g.createRadialGradient(point.x-rx*.3,point.y-ry*.3,1,point.x,point.y,Math.max(rx,ry));
    shade.addColorStop(0,'#e0d2c0');shade.addColorStop(.7,'#b6a28f');shade.addColorStop(1,'#665349');
    g.fillStyle=shade;g.fillRect(point.x-rx,point.y-ry,rx*2,ry*2);
    g.drawImage(images.puppet,0,0,1000,1000);return c;
  }
  function shoulderSocket(point){
    const c=document.createElement('canvas');c.width=c.height=1000;const g=c.getContext('2d');
    g.beginPath();g.arc(point.x,point.y,25,0,TAU);g.clip();
    // 肩部在完整袖口下方转动；圆形木质接头填满旋转扇区，袖口始终由躯干覆盖。
    g.fillStyle='#c7b8a6';g.fillRect(point.x-25,point.y-25,50,50);
    g.drawImage(images.puppet,345,365,28,28,point.x-25,point.y-25,50,50);
    return c;
  }
  function buildMesh(){
    bodyParts.torso=document.createElement('canvas');bodyParts.torso.width=bodyParts.torso.height=1000;
    const c=bodyParts.torso.getContext('2d');c.drawImage(images.puppet,0,0,1000,1000);c.globalCompositeOperation='destination-out';
    for(const poly of [armMask,mirror(armMask),legMask,mirror(legMask)]){maskPath(c,poly);c.fill();}
    for(const side of ['left','right']){
      const flip=side==='left'?p=>p:mirror,elbow=RIG[side+'Elbow'],knee=RIG[side+'Knee'];
      bodyParts[side+'Upper']=layer(flip(upperMask),elbow,19);
      bodyParts[side+'Lower']=layer(flip(lowerMask),elbow,19);
      bodyParts[side+'Thigh']=layer(flip(thighMask),knee,27);
      bodyParts[side+'Shin']=layer(flip(shinMask),knee,27);
      bodyParts[side+'ElbowCap']=jointCap(elbow,19,19);
      bodyParts[side+'KneeCap']=jointCap(knee,27,29);
      bodyParts[side+'ShoulderSocket']=shoulderSocket(RIG[side+'Shoulder']);
    }
  }
  function rotate(p,pivot,angle){const x=p.x-pivot.x,y=p.y-pivot.y,c=Math.cos(angle),s=Math.sin(angle);return{x:pivot.x+x*c-y*s,y:pivot.y+x*s+y*c};}
  function rootAngle(){return state.tilt*.12+Math.sin(state.clock*.9)*.013+state.recoil*.035;}
  function armAngles(side){const left=side==='left',lift=left?state.armL:state.armR;return {shoulder:(left?1:-1)*lift*1.05+state.tilt*(left?1.1:-.85),elbow:(left?-1:1)*(lift*.2+Math.abs(state.tilt)*.7)};}
  function legAngles(side){const left=side==='left',lift=left?state.legL:state.legR,sign=left?1:-1;return{hip:clamp((left?-.65:.65)*state.tilt+sign*lift*CONFIG.legSwing,-.6,.6)+Math.sin(state.clock*1.7)*.018,knee:clamp(sign*(state.tilt*1.25+lift*CONFIG.legBend),-1.15,1.15)};}
  function toWorld(p){const q=rotate(p,{x:500,y:500},rootAngle()),size=CONFIG.puppetSize*state.depth;return{x:state.x+(q.x-500)*size/1000,y:state.y+(q.y-500)*size/1000};}
  function deform(p){
    if(activeCharacter==='wood')return toWorld(window.WoodCharacter.deform(p,woodenPose()));
    let q={...p};
    if(p===RIG.leftHand||p===RIG.rightHand){const left=p===RIG.leftHand,a=armAngles(left?'left':'right');q=rotate(rotate(p,left?RIG.leftElbow:RIG.rightElbow,a.elbow),left?RIG.leftShoulder:RIG.rightShoulder,a.shoulder);}
    if(p===RIG.leftKnee||p===RIG.rightKnee||p===RIG.leftFoot||p===RIG.rightFoot){const left=p===RIG.leftKnee||p===RIG.leftFoot,a=legAngles(left?'left':'right');if(p===RIG.leftFoot||p===RIG.rightFoot)q=rotate(q,left?RIG.leftKnee:RIG.rightKnee,a.knee);q=rotate(q,left?RIG.leftHip:RIG.rightHip,a.hip);}
    return toWorld(q);
  }
  function pivot(point,angle){ctx.translate(point.x,point.y);ctx.rotate(angle);ctx.translate(-point.x,-point.y);}
  function drawPuppet(){
    ctx.save();ctx.translate(state.x,848);ctx.scale(1,.18);glow(0,0,100*state.depth,'#0206129a');ctx.restore();
    const anchors=[{x:510,y:192},{x:607,y:217},{x:1018,y:231},{x:1140,y:236}];
    const attachments=[deform(RIG.leftHand),activeCharacter==='wood'?toWorld({x:RIG.head.x,y:22}):deform({x:500,y:22}),deform(RIG.rightHand),deform(RIG.rightKnee)];
    ctx.save();ctx.strokeStyle=activeCharacter==='wood'?'#d8875baf':'#97cce5b0';ctx.lineWidth=.95;
    attachments.forEach((end,i)=>{const start=anchors[i];ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.quadraticCurveTo((start.x+end.x)/2+Math.sin(state.clock+i)*2,(start.y+end.y)/2,end.x,end.y);ctx.stroke();});
    line({x:470,y:209},deform(RIG.leftKnee),'#91bce46b',.7);ctx.restore();
    ctx.save();ctx.translate(state.x,state.y);ctx.scale(CONFIG.puppetSize*state.depth/1000,CONFIG.puppetSize*state.depth/1000);ctx.rotate(rootAngle());ctx.translate(-500,-500);
    if(activeCharacter==='wood'){window.WoodCharacter.draw(ctx,woodenPose());ctx.restore();return;}
    for(const side of ['left','right']){
      const left=side==='left',a=legAngles(side);ctx.save();pivot(left?RIG.leftHip:RIG.rightHip,a.hip);ctx.drawImage(bodyParts[side+'KneeCap'],0,0);ctx.save();pivot(left?RIG.leftKnee:RIG.rightKnee,a.knee);ctx.drawImage(bodyParts[side+'Shin'],0,0);ctx.restore();ctx.drawImage(bodyParts[side+'Thigh'],0,0);ctx.drawImage(bodyParts[side+'KneeCap'],0,0);ctx.restore();
    }
    for(const side of ['left','right']){
      const left=side==='left',a=armAngles(side);ctx.drawImage(bodyParts[side+'ShoulderSocket'],0,0);ctx.save();pivot(left?RIG.leftShoulder:RIG.rightShoulder,a.shoulder);ctx.drawImage(bodyParts[side+'ElbowCap'],0,0);ctx.save();pivot(left?RIG.leftElbow:RIG.rightElbow,a.elbow);ctx.drawImage(bodyParts[side+'Lower'],0,0);ctx.restore();ctx.drawImage(bodyParts[side+'Upper'],0,0);ctx.drawImage(bodyParts[side+'ElbowCap'],0,0);ctx.restore();
    }
    ctx.drawImage(bodyParts.torso,0,0);ctx.restore();
  }

  // ★ 3 / 视频版魔法：双手银丝蓄力、双核汇聚、蓝黄流体扫满屏幕。
  const dust=Array.from({length:55},()=>({x:rand(100,W-100),y:rand(200,H-120),phase:rand(0,TAU),speed:rand(3,10),radius:rand(.5,1.7)}));
  const silverOrb=document.createElement('canvas'),blueOrb=document.createElement('canvas');
  silverOrb.width=silverOrb.height=blueOrb.width=blueOrb.height=768;
  function drawBackground(){
    ctx.drawImage(images.background,0,0,W,H);
    for(let i=0;i<7;i++){
      const x=((i*320+state.clock*(i%2?12:-9))%(W+600)+W+600)%(W+600)-300;
      ctx.globalAlpha=.28;ctx.drawImage(fogCanvas,x,690+Math.sin(state.clock*.15+i)*30,650,210);
    }ctx.globalAlpha=1;
    for(const p of dust){const x=p.x+Math.sin(state.clock*.22+p.phase)*20,y=(p.y-state.clock*p.speed+H*100)%H;circle(x,y,p.radius,'#a4cae935');}
  }
  function prepareMagicTextures(){
    for(const [target,image] of [[silverOrb,images.silverTexture],[blueOrb,images.magicTexture]]){
      const c=target.getContext('2d');c.clearRect(0,0,768,768);c.drawImage(image,0,0,768,768);
      c.globalCompositeOperation='destination-in';const g=c.createRadialGradient(384,384,255,384,384,380);g.addColorStop(0,'#fff');g.addColorStop(.72,'#fff');g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(0,0,768,768);c.globalCompositeOperation='source-over';
    }
  }
  function textureOrb(image,x,y,r,time,alpha=1,handed=1,blur=1.2){
    if(r<1||alpha<=0)return;ctx.save();ctx.translate(x,y);ctx.rotate(time*.24*handed);ctx.globalAlpha=alpha;ctx.globalCompositeOperation='screen';ctx.filter=`blur(${blur}px)`;ctx.drawImage(image,-r,-r,r*2,r*2);ctx.restore();
  }
  function orbitLines(x,y,r,time,alpha){
    ctx.save();ctx.translate(x,y);ctx.globalCompositeOperation='screen';ctx.globalAlpha=alpha;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,0,r*(1.05+i*.18),r*(.66+i*.1),time*.17+i*.8,-2.5,.75);ctx.strokeStyle=i===1?'#cbd09c':'#78bcd6';ctx.lineWidth=i===0?1.5:.8;ctx.stroke();}
    ctx.restore();
  }
  function pulseString(anchor,hand,time,power,offset=0){
    ctx.save();ctx.globalCompositeOperation='screen';line(anchor,hand,`rgba(102,177,219,${.13+power*.2})`,.8);
    for(let i=0;i<5;i++){const f=(time*.48+i*.2+offset)%1,x=mix(anchor.x,hand.x,f),y=mix(anchor.y,hand.y,f),a=Math.sin(Math.PI*f);glow(x,y,5+power*5,`rgba(${i%2?'104,194,230':'211,211,119'},${a*power*.18})`);circle(x,y,.7+power*.7,i%2?'#9dd9ec':'#dadd8b');}ctx.restore();
  }
  function drawField(age,power){
    const grow=clamp(age/.72,0,1),e=grow*grow*(3-2*grow),fade=1-clamp((age-2.05)/1.15,0,1),readable=mix(1,.46,clamp((age-.18)/.42,0,1));
    const width=mix(230,W*1.32,e),height=mix(230,H*1.42,e),full=clamp((age-.5)/.24,0,1);
    ctx.save();ctx.translate(W*.5,H*.48);ctx.rotate(Math.sin(age*1.3)*.025);
    ctx.globalAlpha=fade*readable*(1-full)*(.8+power*.2);ctx.globalCompositeOperation='screen';ctx.drawImage(blueOrb,-width/2,-height/2,width,height);
    ctx.globalAlpha=fade*readable*full*(.8+power*.2);ctx.globalCompositeOperation='source-over';ctx.drawImage(images.magicTexture,-width/2,-height/2,width,height);ctx.restore();
    return fade;
  }
  function beginCharge(){if(state.paused||state.spell==='flight')return;state.charging=true;state.spell='charging';}
  function stopCharge(release=false){state.charging=false;if(release)fire(false);}
  function fire(allowUncharged=false){
    if(state.paused)return;
    if(state.clock-state.lastFire<CONFIG.fireCooldown||projectiles.length)return false;
    if(state.charge<CONFIG.minimumCharge&&!allowUncharged){state.charge=0;state.spell='idle';return false;}
    const amount=Math.max(state.charge,allowUncharged ? .28 : 0),left=deform(RIG.leftHand),right=deform(RIG.rightHand);
    projectiles.push({age:0,charge:amount,left:{...left},right:{...right}});
    state.lastFire=state.clock;state.charging=false;state.charge=0;state.spell='flight';state.recoil=1;
    if(amount>=.55){state.progress.casts=clamp(state.progress.casts+1,0,3);saveProgress();}
    playSound('throw',amount);return true;
  }
  function explode(power){
    const count=Math.round((state.gentle?42:92)*state.intensity*(.7+power*.3));
    for(let i=0;i<count;i++){const a=rand(0,TAU),speed=rand(110,520)*(1+power*.35);particles.push({x:W*.5,y:H*.48,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:1,decay:rand(.55,1.15),length:rand(5,28),color:i%8===0?'#d4d68a':i%3===0?'#7ad3ed':'#557cd5'});}
    waves.push({age:0,power});playSound('impact',power);state.recoil=state.gentle ? .2 : 1.6;
    message(power>.8?'蓄满的魔法越过牵线，在你眼前绽开。':'法球穿过蓝雾，向屏幕爆散。',3500);
  }
  function drawMagic(dt){
    const left=deform(RIG.leftHand),right=deform(RIG.rightHand),t=state.clock,q=state.charge;
    if(q<=.01&&!state.charging&&state.spell==='idle'){
      // 参考图中的待机银丝；蓄力时由下面的真实蓄力特效接管。
      for(const [hand,side] of [[left,-1],[right,1]]){
        textureOrb(silverOrb,hand.x,hand.y,34*state.depth,t,.16,side,1.2);
        orbitLines(hand.x,hand.y,31*state.depth,t*side,.42);
      }
    }
    if(q>.01||state.charging){
      const power=Math.max(.08,q),r=(18+power*31)*state.depth,blue=clamp((power-.52)/.42,0,1);
      ctx.save();ctx.globalAlpha=1-blue;textureOrb(silverOrb,left.x,left.y,r,t,power,-1,1.35);textureOrb(silverOrb,right.x,right.y,r,-t,power,1,1.35);ctx.restore();
      if(blue>0){textureOrb(blueOrb,left.x,left.y,r,t,power*blue,-1,.8);textureOrb(blueOrb,right.x,right.y,r,-t,power*blue,1,.8);}
      orbitLines(left.x,left.y,r,t,power*.7);orbitLines(right.x,right.y,r,-t,power*.7);
      pulseString({x:510,y:192},left,t,power,0);pulseString({x:1018,y:231},right,t,power,.36);
    }
    for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.age+=dt;const u=clamp(p.age/.62,0,1),e=u*u,blue=clamp((u-.18)/.55,0,1),radius=mix(24,430,u*u*u);
      for(const [start,side] of [[p.left,-1],[p.right,1]]){const x=mix(start.x,W*.5,e),y=mix(start.y,H*.48,e)-Math.sin(u*Math.PI)*35,alpha=side<0?1-clamp((u-.56)/.25,0,1):1;textureOrb(silverOrb,x,y,radius,t,alpha*(1-blue),side,1.2);textureOrb(blueOrb,x,y,radius,t,alpha*blue,side,.7);}
      if(u===1){explode(p.charge);projectiles.splice(i,1);state.spell='burst';}
    }
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-.7*dt);p.vy*=Math.exp(-.7*dt);p.life-=p.decay*dt;if(p.life<=0){particles.splice(i,1);continue;}ctx.globalAlpha=p.life;const angle=Math.atan2(p.vy,p.vx);line(p,{x:p.x-Math.cos(angle)*p.length,y:p.y-Math.sin(angle)*p.length},p.color,1+p.life*1.4);}
    ctx.globalAlpha=1;
    for(let i=waves.length-1;i>=0;i--){const w=waves[i];w.age+=dt;const life=1-w.age/3.2;if(life<=0){waves.splice(i,1);continue;}const r=55+w.age*1000;
      ctx.restore();drawField(w.age,w.power);ctx.save();ctx.globalCompositeOperation='screen';
      ctx.globalAlpha=Math.max(0,1-w.age/.88)*.55*state.intensity;ctx.strokeStyle='#a8dceb';ctx.lineWidth=2+Math.max(0,1-w.age/.4)*5;ctx.beginPath();ctx.ellipse(W*.5,H*.48,r,r*.7,0,0,TAU);ctx.stroke();
      if(!state.gentle&&w.age<.13){ctx.globalAlpha=(1-w.age/.13)*.32*state.intensity;ctx.fillStyle='#c3e5f4';ctx.fillRect(0,0,W,H);}
      if(w.age>.22){ctx.restore();const reveal=clamp((w.age-.22)/.42,0,1);const focus=ctx.createRadialGradient(W*.5,H*.5,20,W*.5,H*.5,330);focus.addColorStop(0,`rgba(1,5,16,${reveal*.3})`);focus.addColorStop(1,'transparent');ctx.fillStyle=focus;ctx.fillRect(0,0,W,H);ctx.save();ctx.globalAlpha=reveal*.84;drawPuppet();ctx.restore();ctx.save();ctx.globalCompositeOperation='screen';}
    }ctx.restore();
    if(state.spell==='burst'&&!waves.length)state.spell='idle';
  }

  // ★ 4 / 仪式、鼠标与键盘。手势和鼠标都走同一套动画状态。
  function mark(index){if(!state.progress.flags[index]){state.progress.flags[index]=true;saveProgress();}}
  function saveProgress(){storage.set('stringkeeper-v2-progress',state.progress);updateProgress();}
  function updateProgress(){
    const flags=state.progress.flags;
    const done=[flags[0]&&flags[1]&&flags[2],state.progress.casts>=3,flags[3]&&flags[4]];
    done.forEach((value,i)=>{const li=$(`quest${i}`);li.classList.toggle('done',value);li.querySelector('b').textContent=value?'✓':'○';});
    $('castCount').textContent=`${state.progress.casts} / 3`;
    if(done.every(Boolean)&&!winAnnounced){winAnnounced=true;message('三段仪式已完成。她仍牵在线上，却开始跳自己的舞。',12000);playSound('win');}
  }
  function reset(){
    state.progress={flags:[false,false,false,false,false,false],casts:0};winAnnounced=false;state.x=state.tx=W*.5;state.y=state.ty=527;state.depth=state.targetDepth=1;state.targetTilt=state.tilt=0;state.armL=state.armR=state.legL=state.legR=0;resetFingerControl();state.charge=0;state.charging=false;state.spell='idle';state.keys.clear();state.pointerHeld=false;state.fistLatched=false;state.candidate=state.handGesture='none';state.lastFire=-10;projectiles.length=particles.length=waves.length=0;calibrate(false);saveProgress();message('线重新绷紧。今夜的排演，从你开始。');
  }
  function pointerPosition(event){const box=canvas.getBoundingClientRect();const b=state.bounds;return{x:(event.clientX-box.left-b.ox)/b.scale,y:(event.clientY-box.top-b.oy)/b.scale};}
  function movePointer(event){if(state.paused||state.mode==='camera'||$('guide').open)return;const p=pointerPosition(event);state.tx=clamp(p.x,350,1320);state.ty=clamp(p.y,380,690);state.aim=p;if(Math.abs(state.tx-W*.5)>65||Math.abs(state.ty-535)>50)mark(0);}
  canvas.addEventListener('pointermove',movePointer);
  canvas.addEventListener('pointerdown',event=>{if(state.paused||state.mode==='camera'||event.button!==0)return;canvas.focus({preventScroll:true});movePointer(event);canvas.setPointerCapture(event.pointerId);state.pointerHeld=true;dragStart=state.clock;beginCharge();});
  canvas.addEventListener('pointerup',()=>{if(state.pointerHeld){state.pointerHeld=false;stopCharge(true);}});
  canvas.addEventListener('pointercancel',()=>{state.pointerHeld=false;stopCharge();});
  canvas.addEventListener('wheel',event=>{if(state.paused||state.mode==='camera')return;event.preventDefault();state.targetDepth=clamp(state.targetDepth-event.deltaY*.001,CONFIG.depthMin,CONFIG.depthMax);if(Math.abs(state.targetDepth-1)>.09)mark(3);},{passive:false});
  document.addEventListener('keydown',event=>{
    const key=event.key.toLowerCase();if(state.paused)return;if(key==='h'&&!$('guide').open&&document.activeElement?.tagName!=='INPUT'){toggleImmersive();return;}
    if($('guide').open||['INPUT','BUTTON'].includes(document.activeElement?.tagName)||state.mode==='camera')return;
    if([' ','arrowup','arrowdown','arrowleft','arrowright','[',']'].includes(key))event.preventDefault();
    if(event.repeat)return;state.keys.add(key);
    if(key===' ')beginCharge();
    if(key==='q')mark(1);if(key==='e')mark(2);if(key==='a'||key==='d')mark(4);
  });
  document.addEventListener('keyup',event=>{const key=event.key.toLowerCase();state.keys.delete(key);if(key===' '&&state.mode==='mouse')stopCharge(true);});
  function keyboard(dt){if(state.paused||state.mode!=='mouse')return;
    state.targetArmL=state.keys.has('q')?1:0;state.targetArmR=state.keys.has('e')?1:0;
    state.targetLegL=state.keys.has('z')?1:0;state.targetLegR=state.keys.has('c')?1:0;
    state.targetTilt=(state.keys.has('d')?.5:0)-(state.keys.has('a')?.5:0);
    const dx=(state.keys.has('arrowright')?1:0)-(state.keys.has('arrowleft')?1:0),dy=(state.keys.has('arrowdown')?1:0)-(state.keys.has('arrowup')?1:0);
    if(dx||dy){state.tx=clamp(state.tx+dx*300*dt,350,1320);state.ty=clamp(state.ty+dy*200*dt,380,690);mark(0);}
    const z=(state.keys.has(']')?1:0)-(state.keys.has('[')?1:0);if(z){state.targetDepth=clamp(state.targetDepth+z*.5*dt,CONFIG.depthMin,CONFIG.depthMax);if(Math.abs(state.targetDepth-1)>.09)mark(3);}
  }
  function clearInput(){resetFingerControl();state.pointerHeld=false;state.keys.clear();state.charging=false;state.candidate=state.handGesture='none';state.fistLatched=false;state.rollPrev=null;}
  window.addEventListener('blur',clearInput);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(state.phase!=='off')stopCamera();audio?.suspend();}else if(state.sound)audio?.resume();});
  function toggleImmersive(){state.immersive=!state.immersive;$('theatre').classList.toggle('immersive',state.immersive);$('showUiButton').hidden=!state.immersive;canvas.focus({preventScroll:true});}
  function calibrate(notify=true){resetFingerControl();state.headNeutral=null;state.headSamples=[];state.rollPrev=null;state.targetTilt=0;state.targetDepth=1;if(notify)message('已重置。右手入镜即可控制；自然张掌片刻可优化手指识别。');}
  $('hideUiButton').onclick=$('showUiButton').onclick=toggleImmersive;
  $('resetButton').onclick=()=>{reset();canvas.focus({preventScroll:true});};
  $('guideButton').onclick=()=>{clearInput();$('guide').showModal();};
  $('closeGuide').onclick=$('startButton').onclick=()=>{$('guide').close();canvas.focus({preventScroll:true});};
  $('guide').addEventListener('close',clearInput);
  $('settingsButton').onclick=()=>{const open=$('settings').hidden;$('settings').hidden=!open;$('settingsButton').setAttribute('aria-expanded',String(open));};
  $('closeSettings').onclick=()=>{$('settings').hidden=true;$('settingsButton').setAttribute('aria-expanded','false');canvas.focus({preventScroll:true});};
  $('sensitivity').oninput=event=>{state.sensitivity=Number(event.target.value);$('sensitivityValue').value=state.sensitivity.toFixed(1);};
  $('intensity').oninput=event=>{state.intensity=Number(event.target.value);$('intensityValue').value=`${Math.round(state.intensity*100)}%`;};
  $('gentle').checked=state.gentle;$('gentle').onchange=event=>state.gentle=event.target.checked;
  $('swapHands').onchange=()=>{clearInput();calibrate();};$('calibrateButton').onclick=()=>calibrate();
  $('dismissError').onclick=()=>$('errorBanner').hidden=true;
  $('fullscreenButton').onclick=async()=>{try{document.fullscreenElement?await document.exitFullscreen():await $('theatre').requestFullscreen();}catch{message('当前窗口无法全屏，可在独立浏览器中打开。');}};

  // ★ 5 / 本地摄像头与识别 Worker。只传帧给本机 Worker，无任何上传接口。
  let cameraWorker=null,cameraStream=null,workerUrls=[],cameraToken=0,inFlight=false,lastInference=0,initTimer=null;
  let cameraEngine='off',mainHands=null,mainFace=null,mainTicks=0,modelUrls=null;
  const cameraDiagnostics=[];
  const mirrorCanvas=document.createElement('canvas');mirrorCanvas.width=640;mirrorCanvas.height=400;
  const mirrorCtx=mirrorCanvas.getContext('2d');
  const WORKER_SOURCE=String.raw`
    let hands,face,ticks=0,ready=false,stage='识别程序加载';
    self.onmessage=async event=>{
      const data=event.data;
      if(data.type==='init'){
        try{
          const {HandLandmarker,FaceLandmarker}=await import(data.bundle);
          const files={wasmLoaderPath:data.loader,wasmBinaryPath:data.wasm};
          const handOpts={baseOptions:{modelAssetBuffer:new Uint8Array(data.hand),delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.55,minHandPresenceConfidence:.55,minTrackingConfidence:.55};
          stage='手部模型初始化';hands=await HandLandmarker.createFromOptions(files,handOpts);
          self.postMessage({type:'status',text:'手部识别就绪，正在唤醒头部识别…'});
          stage='头部模型初始化';face=await FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetBuffer:new Uint8Array(data.face),delegate:'CPU'},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false});
          ready=true;self.postMessage({type:'ready'});
        }catch(error){self.postMessage({type:'error',stage,message:String(error.message||error)});}
      }else if(data.type==='frame'){
        if(!ready){data.bitmap.close();return;}
        try{
          const result=hands.detectForVideo(data.bitmap,data.time);
          const faceUpdated=ticks++%2===0;
          const f=faceUpdated?face.detectForVideo(data.bitmap,data.time):null;
          self.postMessage({type:'result',hands:result.landmarks.map((points,i)=>({points,worldPoints:result.worldLandmarks?.[i],side:result.handedness[i][0].categoryName,handednessScore:result.handedness[i][0].score})),faceUpdated,face:f?.faceLandmarks?.[0]||null,videoWidth:data.bitmap.width,videoHeight:data.bitmap.height});
        }catch(error){self.postMessage({type:'error',stage:'画面识别',message:String(error.message||error)});}finally{data.bitmap.close();}
      }
    };
  `;
  function decode(base64){const raw=atob(base64),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
  function blobUrl(bytes,type){const url=URL.createObjectURL(new Blob([bytes],{type}));workerUrls.push(url);return url;}
  function setCameraLabel(text){$('cameraText').textContent=text;}
  function closeDetector(detector){try{detector?.close();}catch{}}
  function recordCameraError(stage,err){const detail=String(err?.message||err||'未知错误');cameraDiagnostics.push({stage,detail});console.warn('[体感诊断]',stage,detail);return detail.replace(/\s+/g,' ').slice(0,240);}
  function cameraReady(token){
    if(token!==cameraToken)return;
    clearTimeout(initTimer);state.phase='ready';state.mode='camera';inFlight=false;lastInference=0;calibrate(false);setCameraLabel('关闭体感');$('tracking').hidden=false;$('statusDot').classList.add('live');$('modeLabel').textContent=cameraEngine==='main'?'体感演出 · 兼容模式':'体感演出';$('inputHint').textContent='右手牵线 · 左手施法';$('shortcutLine').hidden=true;message('识别就绪。右手入镜即可弯指控制四肢，左手负责施法。');
  }
  function cameraFailed(stage,err){
    const detail=recordCameraError(stage,err);stopCamera();
    error(`摄像头已连接，但${stage}失败：${detail}。请在独立的 Chrome / Edge 中通过 Live Server 打开页面；如仍失败，请把这段详细提示发给我。`);
  }
  async function startMainRecognition(token,reason){
    if(token!==cameraToken||cameraEngine==='main-loading'||cameraEngine==='main')return;
    if(reason)recordCameraError('独立线程，已转兼容模式',reason);
    cameraWorker?.terminate();cameraWorker=null;clearTimeout(initTimer);inFlight=false;cameraEngine='main-loading';state.phase='loading';
    setCameraLabel('兼容模式加载中 · 可取消');message('正在使用与上一版相同的页面内识别方式…',0);
    let localHands=null,localFace=null,stage='兼容识别程序加载';
    initTimer=setTimeout(()=>{if(token===cameraToken)cameraFailed('兼容识别初始化',new Error('等待超过 60 秒'));},60000);
    try{
      const {HandLandmarker,FaceLandmarker}=await import(modelUrls.bundle);
      if(token!==cameraToken)return;
      const files={wasmLoaderPath:modelUrls.loader,wasmBinaryPath:modelUrls.wasm};
      // 显式使用页面 Canvas。部分浏览器支持页面 WebGL，却不支持 Worker 内的 OffscreenCanvas WebGL。
      stage='手部模型初始化';
      localHands=await HandLandmarker.createFromOptions(files,{canvas:document.createElement('canvas'),baseOptions:{modelAssetBuffer:decode(ASSETS.hand),delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.55,minHandPresenceConfidence:.55,minTrackingConfidence:.55});
      if(token!==cameraToken){closeDetector(localHands);return;}
      stage='头部模型初始化';
      let faceError=null;
      try{localFace=await FaceLandmarker.createFromOptions(files,{canvas:document.createElement('canvas'),baseOptions:{modelAssetBuffer:decode(ASSETS.face),delegate:'CPU'},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false});}
      catch(err){faceError=recordCameraError(stage,err);}
      if(token!==cameraToken){closeDetector(localHands);closeDetector(localFace);return;}
      mainHands=localHands;mainFace=localFace;mainTicks=0;cameraEngine='main';cameraReady(token);
      if(faceError)error(`手部体感已开启，头部识别暂不可用：${faceError}。可在独立 Chrome / Edge 中重试。`);
    }catch(err){closeDetector(localHands);closeDetector(localFace);if(token===cameraToken)cameraFailed(stage,err);}
  }
  function stopCamera(){
    cameraToken++;clearTimeout(initTimer);cameraWorker?.terminate();cameraWorker=null;closeDetector(mainHands);closeDetector(mainFace);mainHands=mainFace=null;cameraEngine='off';modelUrls=null;cameraStream?.getTracks().forEach(track=>track.stop());cameraStream=null;$('cameraVideo').pause();$('cameraVideo').srcObject=null;workerUrls.forEach(url=>URL.revokeObjectURL(url));workerUrls=[];state.mode='mouse';state.phase='off';inFlight=false;clearInput();state.targetArmL=state.targetArmR=state.targetTilt=0;state.seenLeft=state.seenRight=state.seenFace=false;
    $('tracking').hidden=true;$('statusDot').classList.remove('live');$('modeLabel').textContent='鼠标排演';setCameraLabel('开启体感');$('inputHint').innerHTML='移动鼠标牵线 <span>·</span> 按住蓄力，松开投掷';$('shortcutLine').hidden=false;
  }
  async function startCamera(){
    if(state.paused)return;
    const token=++cameraToken;state.phase='loading';setCameraLabel('连接中 · 可取消');$('errorBanner').hidden=true;clearInput();
    try{
      if(!navigator.mediaDevices?.getUserMedia||!window.isSecureContext)throw Object.assign(new Error('需要安全页面'),{name:'InsecureContext'});
      const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:400},facingMode:'user'},audio:false});
      if(token!==cameraToken){stream.getTracks().forEach(t=>t.stop());return;}
      cameraStream=stream;const video=$('cameraVideo');video.srcObject=stream;await video.play();
      if(token!==cameraToken)return;
      setCameraLabel('加载本地识别 · 可取消');
      // 将内嵌资源转为本地 Blob URL。没有 CDN 请求，断网也能使用。
      const bundle=blobUrl(decode(ASSETS.vision),'text/javascript'),loader=blobUrl(decode(ASSETS.loader),'text/javascript'),wasm=blobUrl(decode(ASSETS.wasm),'application/wasm');
      modelUrls={bundle,loader,wasm};
      // 双击本地文件优先采用兼容路径；网络页面优先独立线程，出错自动回退。
      if(location.protocol==='file:'||typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||typeof createImageBitmap==='undefined')return await startMainRecognition(token);
      cameraEngine='worker';
      const hand=decode(ASSETS.hand).buffer,face=decode(ASSETS.face).buffer;
      const workerUrl=blobUrl(WORKER_SOURCE,'text/javascript');
      try{cameraWorker=new Worker(workerUrl);}catch(err){return await startMainRecognition(token,err);}
      initTimer=setTimeout(()=>{if(token===cameraToken)startMainRecognition(token,new Error('独立线程初始化超时'));},20000);
      cameraWorker.onmessage=event=>{
        if(token!==cameraToken||cameraEngine!=='worker')return;const data=event.data;
        if(data.type==='ready')cameraReady(token);
        else if(data.type==='status')message(data.text,0);
        else if(data.type==='result'){inFlight=false;processTracking(data);}
        else if(data.type==='error')startMainRecognition(token,`${data.stage||'识别'}：${data.message}`);
      };
      cameraWorker.onerror=event=>{if(token!==cameraToken||cameraEngine!=='worker')return;event.preventDefault();startMainRecognition(token,event.message||'独立线程无法启动');};
      cameraWorker.postMessage({type:'init',bundle,loader,wasm,hand,face},[hand,face]);
    }catch(err){if(token!==cameraToken)return;stopCamera();
      const messages={NotAllowedError:'没有获得摄像头权限。请在浏览器地址栏允许摄像头后再开启；鼠标模式仍可完整排演。',NotFoundError:'没有找到摄像头。请连接设备，或先用鼠标排演。',NotReadableError:'摄像头无法打开，可能被其他软件占用。关闭占用后重试。',InsecureContext:'请通过 VS Code Live Server 的 localhost / 127.0.0.1 地址打开网页，以使用摄像头。'};
      error(messages[err.name]||`摄像头连接失败：${err.message}。鼠标模式可以继续使用。`);
    }
  }
  async function queueInference(now){
    if(state.paused||state.phase!=='ready'||inFlight||now-lastInference<CONFIG.inferenceInterval||$('guide').open)return;
    const video=$('cameraVideo');if(video.readyState<2)return;
    inFlight=true;lastInference=now;const token=cameraToken;
    try{
      mirrorCtx.save();mirrorCtx.setTransform(-1,0,0,1,640,0);mirrorCtx.drawImage(video,0,0,640,400);mirrorCtx.restore();
      if(cameraEngine==='main'){
        const result=mainHands.detectForVideo(mirrorCanvas,now);const faceUpdated=mainTicks++%3===0;
        let faceResult=null;
        if(faceUpdated&&mainFace){try{faceResult=mainFace.detectForVideo(mirrorCanvas,now);}catch(err){const detail=recordCameraError('头部画面识别',err);closeDetector(mainFace);mainFace=null;error(`手部识别继续运行；头部识别中断：${detail}`);}}
        processTracking({hands:result.landmarks.map((points,i)=>({points,worldPoints:result.worldLandmarks?.[i],side:result.handedness[i][0].categoryName,handednessScore:result.handedness[i][0].score})),faceUpdated,face:faceResult?.faceLandmarks?.[0]||null,videoWidth:640,videoHeight:400},now);inFlight=false;return;
      }
      const bitmap=await createImageBitmap(mirrorCanvas);
      if(token!==cameraToken||!cameraWorker){bitmap.close();inFlight=false;return;}
      cameraWorker.postMessage({type:'frame',bitmap,time:now},[bitmap]);
    }catch(err){inFlight=false;if(cameraEngine==='worker')startMainRecognition(token,err);else cameraFailed('画面识别',err);}
  }
  $('cameraButton').onclick=()=>{if(!state.paused)state.phase==='off'?startCamera():stopCamera();};

  // 可选合成声音，没有外部音频文件。
  async function setupAudio(){
    if(!audio){audio=new(window.AudioContext||window.webkitAudioContext)();audioMaster=audio.createGain();audioMaster.gain.value=.22;audioMaster.connect(audio.destination);
      for(const freq of [65.41,98]){const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.value=.025;osc.connect(gain);gain.connect(audioMaster);osc.start();}
      const osc=audio.createOscillator();chargeHum=audio.createGain();osc.type='sine';osc.frequency.value=196;chargeHum.gain.value=0;osc.connect(chargeHum);chargeHum.connect(audioMaster);osc.start();
    }await audio.resume();
  }
  function playSound(type,power=.5){if(!state.sound||!audio)return;const start=audio.currentTime;const frequencies=type==='win'?[261.63,329.63,392]:type==='throw'?[320,640]:[90,180,360];
    frequencies.forEach((freq,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.type=type==='impact'?'triangle':'sine';o.frequency.setValueAtTime(freq,start);o.frequency.exponentialRampToValueAtTime(type==='impact'?freq*.3:freq*1.6,start+.5);g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(.13+power*.08,start+.025);g.gain.exponentialRampToValueAtTime(.001,start+1+i*.1);o.connect(g);g.connect(audioMaster);o.start(start+i*.03);o.stop(start+1.5);});
  }
  $('soundButton').onclick=async()=>{try{if(!state.sound){await setupAudio();state.sound=true;audioMaster.gain.value=.22;playSound('win',.1);}else{state.sound=false;audioMaster.gain.value=0;}$('soundButton').setAttribute('aria-pressed',String(state.sound));$('soundButton').querySelector('span').textContent=state.sound?'声音开启':'声音关闭';canvas.focus({preventScroll:true});}catch{error('当前浏览器无法开启声音，仍可继续排演。');}};

  function resize(){
    const rect=canvas.getBoundingClientRect();surfaceW=rect.width;surfaceH=rect.height;pixelRatio=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(surfaceW*pixelRatio);canvas.height=Math.round(surfaceH*pixelRatio);
    // 桌面保持构图；窄屏使用较宽的虚拟视野，让双手与布偶完整出现。
    const scale=surfaceW<650?Math.min(surfaceW/1050,(surfaceH-180)/H):Math.max(surfaceW/W,surfaceH/H);
    const ox=(surfaceW-W*scale)/2,oy=surfaceW<650?(surfaceH-H*scale)/2-15:(surfaceH-H*scale)/2;
    state.bounds={scale,ox,oy};state.pausePainted=false;
  }
  function paintScene(dt){
    ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);ctx.fillStyle='#071222';ctx.fillRect(0,0,surfaceW,surfaceH);
    const b=state.bounds;let shakeX=0,shakeY=0;if(waves.length&&!state.gentle){shakeX=Math.sin(state.clock*97)*state.recoil*3*state.intensity;shakeY=Math.cos(state.clock*89)*state.recoil*2*state.intensity;}
    ctx.translate(b.ox+shakeX,b.oy+shakeY);ctx.scale(b.scale,b.scale);
    drawBackground();drawPuppet();drawMagic(dt);
  }
  function draw(now){
    const dt=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
    if(state.paused){if(!state.pausePainted){paintScene(0);state.pausePainted=true;}requestAnimationFrame(draw);return;}
    state.pausePainted=false;state.clock+=dt;
    keyboard(dt);expireTracking(now);
    if($('guide').open){state.charging=false;state.pointerHeld=false;}
    if(state.charging&&state.spell!=='flight'){state.charge=clamp(state.charge+dt/CONFIG.chargeSeconds,0,1);state.spell='charging';}
    else if(state.charge>0)state.charge=Math.max(0,state.charge-dt*.6);
    if(state.charge===0&&state.spell==='charging'&&!state.charging)state.spell='idle';
    if(chargeHum&&audio)chargeHum.gain.setTargetAtTime(state.charging?state.charge*.1:0,audio.currentTime,.08);
    state.x=smooth(state.x,state.tx,CONFIG.moveSmooth,dt);state.y=smooth(state.y,state.ty+Math.sin(state.clock*1.1)*3,CONFIG.moveSmooth,dt);state.depth=smooth(state.depth,state.targetDepth,7,dt);
    state.legL=smooth(state.legL,state.targetLegL,CONFIG.jointSmooth,dt);state.legR=smooth(state.legR,state.targetLegR,CONFIG.jointSmooth,dt);
    state.armL=smooth(state.armL,state.targetArmL,CONFIG.armSmooth,dt);state.armR=smooth(state.armR,state.targetArmR,CONFIG.armSmooth,dt);state.tilt=smooth(state.tilt,state.targetTilt,9,dt);state.recoil=Math.max(0,state.recoil-dt*3);
    paintScene(dt);
    if(now-uiTime>80){uiTime=now;$('chargeBar').style.width=`${state.charge*100}%`;$('spellLabel').textContent=state.spell==='flight'?'法球 · 向你飞来':state.spell==='burst'?'魔法 · 爆散':state.charge>.01?`蓄力 ${Math.round(state.charge*100)}%${state.charge>.98?' · 握拳释放':''}`:'等待一缕魔法';if(state.mode==='camera')updateTrackingUI();}
    queueInference(now);requestAnimationFrame(draw);
  }
  async function boot(){
    try{
      await Promise.all(['background','puppet','magicTexture','silverTexture'].map(name=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{images[name]=img;resolve()};img.onerror=reject;img.src='data:image/webp;base64,'+ASSETS[name];})));
      prepareMagicTextures();buildMesh();resize();new ResizeObserver(resize).observe(canvas);updateProgress();
      try{await activateCharacter(activeCharacter);}catch(err){console.warn(err);await activateCharacter('clown');}
      $('loading').hidden=true;paintScene(0);state.pausePainted=state.paused;resolveAppReady();requestAnimationFrame(draw);
    }catch(err){rejectAppReady(err);console.error(err);$('loadingText').textContent='场景素材未能加载。请确认 script.js 文件完整，重新解压后再打开。';}
  }
  window.addEventListener('pagehide',()=>{stopCamera();audio?.close();});
  // 测试接口仅在 ?test=1 时启用，用合成关键点和本地视频验证交互。
  if(new URLSearchParams(location.search).has('test'))window.__theatreTest={state,analyzeHand,decideGesture,processTracking,deform,fire,reset,expireTracking,fingerControl,get RIG(){return RIG},legAngles,stopCamera,startCamera,boot,CONFIG,getCamera:()=>({worker:cameraWorker,stream:cameraStream,engine:cameraEngine,diagnostics:cameraDiagnostics}),setCameraMode:()=>{state.mode='camera';state.phase='test';},setMouseMode:()=>{state.mode='mouse';state.phase='off';}};


  const CLOWN_RIG=Object.fromEntries(Object.entries(RIG).map(([name,point])=>[name,{...point}]));
  let activeCharacter='clown',characterOperation=0,resolveAppReady,rejectAppReady;
  try{const saved=localStorage.getItem('stringkeeper-character');const id=saved?.startsWith('"')?JSON.parse(saved):saved;if(id==='wood')activeCharacter='wood';}catch{}
  const appReady=new Promise((resolve,reject)=>{resolveAppReady=resolve;rejectAppReady=reject;});
  // The landing overlay reports failures; this also avoids an unhandled rejection in direct tests.
  appReady.catch(()=>{});
  function woodenPose(){return {clock:state.clock,tilt:state.tilt,arms:{left:armAngles('left'),right:armAngles('right')},legs:{left:legAngles('left'),right:legAngles('right')}};}
  async function activateCharacter(id){
    if(!['clown','wood'].includes(id))throw new Error('Unknown puppet: '+id);
    if(id==='wood'){
      if(!window.WoodCharacter)throw new Error('Wooden character module did not load');
      await window.WoodCharacter.ready;
    }
    activeCharacter=id;
    Object.assign(RIG,id==='wood'?window.WoodCharacter.rig:CLOWN_RIG);
    state.pausePainted=false;
  }
  window.TheatreApp={
    ready:appReady,
    characters:[
      {id:'clown',nameZh:'红发女孩',nameEn:'Scarlet Doll',image:'character-clown.webp'},
      {id:'wood',nameZh:'木质人偶',nameEn:'Wooden Puppet',image:'character-wood.webp'}
    ],
    get paused(){return state.paused;},
    getCharacter(){return activeCharacter;},
    pause(paused){
      state.paused=Boolean(paused);state.pausePainted=false;lastFrame=performance.now();
      if(paused){
        if(state.phase!=='off')stopCamera();
        clearInput();state.charge=0;state.spell='idle';projectiles.length=particles.length=waves.length=0;
        $('chargeBar').style.width='0%';
      }
      if(audioMaster&&audio)audioMaster.gain.setTargetAtTime(!paused&&state.sound?.22:0,audio.currentTime,.08);
    },
    async setCharacter(id){
      const operation=++characterOperation;
      await appReady;
      if(id==='wood')await window.WoodCharacter.ready;
      if(operation!==characterOperation)return;
      await activateCharacter(id);
      clearInput();state.armL=state.armR=state.legL=state.legR=state.tilt=state.targetTilt=0;
      state.x=state.tx=W*.5;state.y=state.ty=527;state.depth=state.targetDepth=1;state.charge=0;state.spell='idle';
      projectiles.length=particles.length=waves.length=0;
      try{localStorage.setItem('stringkeeper-character',id);}catch{}
      if(state.paused){paintScene(0);state.pausePainted=true;}
      window.dispatchEvent(new CustomEvent('theatre-character-change',{detail:{character:id}}));
    }
  };

  /* Embedded third-party components: MediaPipe Tasks Vision 0.10.18 (Google LLC), Apache License 2.0. Official models: Google MediaPipe Hand Landmarker and Face Landmarker. Source: https://github.com/google-ai-edge/mediapipe ; License: https://www.apache.org/licenses/LICENSE-2.0 . The original notices are retained inside the packed JavaScript resources. Generated scene artwork is derived from the user's approved references using OpenAI image generation. */
/*

                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright [yyyy] [name of copyright owner]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

*/

const ASSETS=window.__STRINGKEEPER_ASSETS;
  boot();
})();
