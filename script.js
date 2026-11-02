(function(){
  var $=function(id){return document.getElementById(id)};
  var logo=document.querySelector('h1'),foot=document.querySelector('.foot'),paper=$('paper'),txt=$('txt'),burn=$('burn'),done=$('done'),again=$('again'),snd=$('snd'),cv=$('fx'),ctx=cv.getContext('2d');
  var ICON_ON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',ICON_OFF='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6m0-6-5 6"/></svg>';
  var DUR=7500,STEP=6,soundOn=true,burning=false,dpr=1,W,H,N,off=[],maxOff,rect;
  var flames=[],embers=[],ac=null,sfx=null;
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function rnd(a,b){return a+Math.random()*(b-a)}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}

  function resize(){dpr=Math.min(window.devicePixelRatio||1,2);cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
  addEventListener('resize',resize);resize();

  txt.addEventListener('input',function(){burn.disabled=!/\S/.test(txt.value)});
  snd.addEventListener('click',function(){soundOn=!soundOn;snd.innerHTML=soundOn?ICON_ON:ICON_OFF;snd.setAttribute('aria-label',soundOn?'Sound on':'Sound off');snd.setAttribute('aria-pressed',soundOn);if(!soundOn)stopSound()});

  /* ---------- sound: filtered noise + random crackles ---------- */
  function noiseBuf(sec,brown){
    var n=ac.sampleRate*sec,b=ac.createBuffer(1,n,ac.sampleRate),d=b.getChannelData(0),last=0;
    for(var i=0;i<n;i++){var w=Math.random()*2-1;if(brown){last=(last+.02*w)/1.02;d[i]=last*3.5}else d[i]=w}
    return b;
  }
  function startSound(){
    if(!soundOn)return;
    try{
      ac=new (window.AudioContext||window.webkitAudioContext)();
      /* paper burning: airy rustle + faint low flutter + dense bursts of tiny crackles + occasional pops */
      var master=ac.createGain();master.gain.value=0;master.gain.linearRampToValueAtTime(.7,ac.currentTime+.8);master.connect(ac.destination);
      var wb=noiseBuf(2,false);
      function loop(buf,type,freq,q,vol){
        var s=ac.createBufferSource();s.buffer=buf;s.loop=true;
        var f=ac.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;
        var g=ac.createGain();g.gain.value=vol;s.connect(f);f.connect(g);g.connect(master);s.start();return g;
      }
      var hiss=loop(wb,'bandpass',3200,.5,.05),low=loop(noiseBuf(3,true),'lowpass',450,.7,.22);
      function click(t,amp,freq,len){
        var s=ac.createBufferSource();s.buffer=wb;
        var f=ac.createBiquadFilter();f.type='bandpass';f.frequency.value=freq;f.Q.value=1.4;
        var g=ac.createGain();g.gain.setValueAtTime(amp,t);g.gain.exponentialRampToValueAtTime(.0008,t+len);
        s.connect(f);f.connect(g);g.connect(master);s.start(t,rnd(0,1.5),len+.01);
      }
      var begin=ac.currentTime,tick=0;
      var timer=setInterval(function(){
        if(!ac)return;
        var t=ac.currentTime,e=Math.min((t-begin)/7.5,1),k=.35+.65*Math.sin(e*Math.PI);
        if(tick++%4===0){
          hiss.gain.setTargetAtTime(rnd(.025,.1)*k,t,.06);
          low.gain.setTargetAtTime(rnd(.08,.3)*k,t,.12);
        }
        if(Math.random()<.6*k){
          var n=1+((Math.random()*6)|0),at=t+.005;
          for(var i=0;i<n;i++){at+=rnd(.003,.022);click(at,rnd(.08,.4),rnd(1800,7000),rnd(.003,.014))}
        }
        if(Math.random()<.07*k)click(t+.01,rnd(.5,.9),rnd(700,1700),rnd(.02,.055));
      },30);
      sfx={g:master,timer:timer};
    }catch(e){ac=null}
  }
  function stopSound(){
    if(!ac||!sfx)return;
    var a=ac,s=sfx;ac=null;sfx=null;clearInterval(s.timer);
    try{s.g.gain.cancelScheduledValues(a.currentTime);s.g.gain.setValueAtTime(s.g.gain.value,a.currentTime);s.g.gain.linearRampToValueAtTime(0,a.currentTime+2)}catch(e){}
    setTimeout(function(){try{a.close()}catch(e){}},2200);
  }

  /* ---------- burn front ---------- */
  function prep(){
    rect=paper.getBoundingClientRect();W=rect.width;H=rect.height;N=Math.ceil(W/STEP)+1;
    var i1=rnd(.15,.85)*W,i2=rnd(.15,.85)*W,p1=rnd(0,6),p2=rnd(0,6),p3=rnd(0,6),min=1e9;
    for(var i=0;i<N;i++){
      var x=i*STEP,v=Math.min(Math.abs(x-i1)*.38,Math.abs(x-i2)*.38+30)+14*Math.sin(x*.03+p1)+9*Math.sin(x*.071+p2)+5*Math.sin(x*.17+p3);
      off[i]=v;if(v<min)min=v;
    }
    maxOff=0;for(i=0;i<N;i++){off[i]-=min;if(off[i]>maxOff)maxOff=off[i]}
  }
  function front(i,p,tm){return H+30-p*(H+30+maxOff)+off[i]+Math.sin(tm*.009+i*1.7)*2}

  function spawnFlame(x,y){flames.push({x:x,y:y,vx:rnd(-.5,.5),vy:rnd(-3.2,-1.2),life:0,max:rnd(.45,1),s:rnd(7,17)})}
  function spawnEmber(x,y){embers.push({x:x,y:y,vx:rnd(-.4,.9),vy:rnd(-2.2,-.6),life:0,max:rnd(2,5),s:rnd(.8,2.6),ph:rnd(0,6)})}

  var t0=0,last=0,finished=false;
  function frame(now){
    if(!t0){t0=now;last=now}
    var dt=Math.min((now-last)/1000,.05),el=now-t0,p=clamp(el/DUR,0,1);last=now;
    rect=paper.getBoundingClientRect();
    ctx.clearRect(0,0,innerWidth,innerHeight);

    var pts=[],y,i;
    for(i=0;i<N;i++)pts.push(front(i,p,now));

    if(p<1){
      var poly='0px 0px,'+W+'px 0px';
      for(i=N-1;i>=0;i--)poly+=','+Math.min(i*STEP,W)+'px '+clamp(pts[i],0,H)+'px';
      paper.style.clipPath='polygon('+poly+')';
      for(var k=0;k<9;k++){
        i=(Math.random()*N)|0;y=pts[i];
        if(y>2&&y<H)spawnFlame(rect.left+i*STEP+rnd(0,STEP),rect.top+y);
        if(k<2&&y>2&&y<H)spawnEmber(rect.left+i*STEP,rect.top+y-4);
      }
      drawChar(pts);
    }else if(!finished){
      finished=true;paper.style.visibility='hidden';stopSound();
      setTimeout(function(){done.classList.add('show');again.focus({preventScroll:true})},1500);
    }

    ctx.globalCompositeOperation='lighter';
    for(i=flames.length-1;i>=0;i--){
      var f=flames[i];f.life+=dt;if(f.life>f.max){flames.splice(i,1);continue}
      var u=f.life/f.max;f.x+=f.vx+Math.sin(now*.01+i)*.3;f.y+=f.vy;f.vy*=.985;
      var r=f.s*(1-u*.7),g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,r);
      g.addColorStop(0,'rgba(255,'+((235-u*110)|0)+',120,'+(.85*(1-u))+')');
      g.addColorStop(.5,'rgba(255,100,15,'+(.4*(1-u))+')');g.addColorStop(1,'rgba(200,40,0,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(f.x,f.y,r,0,6.283);ctx.fill();
    }
    for(i=embers.length-1;i>=0;i--){
      var e=embers[i];e.life+=dt;if(e.life>e.max){embers.splice(i,1);continue}
      var v=e.life/e.max;e.x+=e.vx+Math.sin(now*.003+e.ph)*.6;e.y+=e.vy;e.vy*=.995;
      var a=(1-v)*(.6+.4*Math.sin(now*.02+e.ph)),g2=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,e.s*3);
      g2.addColorStop(0,'rgba(255,200,90,'+a+')');g2.addColorStop(.4,'rgba(255,120,30,'+a*.5+')');g2.addColorStop(1,'rgba(255,80,0,0)');
      ctx.fillStyle=g2;ctx.beginPath();ctx.arc(e.x,e.y,e.s*3,0,6.283);ctx.fill();
    }
    ctx.globalCompositeOperation='source-over';

    if(!finished||flames.length||embers.length)requestAnimationFrame(frame);
    else burning=false;
  }

  function band(pts,a,b,color,blur,glow){
    var i,x,ya,yb,top=[],bot=[];
    ctx.beginPath();
    for(i=0;i<N;i++){x=rect.left+Math.min(i*STEP,W);yb=clamp(pts[i]-b,0,H);if(i)ctx.lineTo(x,rect.top+yb);else ctx.moveTo(x,rect.top+yb)}
    for(i=N-1;i>=0;i--){x=rect.left+Math.min(i*STEP,W);ya=clamp(pts[i]-a,0,H);ctx.lineTo(x,rect.top+ya)}
    ctx.closePath();ctx.shadowColor=glow;ctx.shadowBlur=blur;ctx.fillStyle=color;ctx.fill();ctx.shadowBlur=0;
  }
  function drawChar(pts){
    band(pts,18,0,'rgba(22,10,5,.88)',0,'transparent');   /* char above the front */
    band(pts,5,0,'rgba(255,110,20,.85)',22,'rgba(255,140,30,.9)'); /* glowing edge */
    band(pts,2,0,'rgba(255,220,130,.9)',10,'rgba(255,200,80,.9)'); /* hot core */
  }

  /* ---------- flow ---------- */
  burn.addEventListener('click',function(){
    if(burning||!txt.value.trim())return;
    burning=true;txt.readOnly=true;txt.blur();burn.classList.add('gone');burn.disabled=true;logo.classList.add('gone');foot.classList.add('gone');
    if(reduce){
      paper.style.transition='opacity 2.5s';paper.style.opacity='0';
      setTimeout(function(){done.classList.add('show');again.focus({preventScroll:true});burning=false},2800);return;
    }
    prep();startSound();t0=0;finished=false;flames.length=0;embers.length=0;
    requestAnimationFrame(frame);
  });

  again.addEventListener('click',function(){
    done.classList.remove('show');
    paper.style.transition='';paper.style.opacity='';paper.style.clipPath='';paper.style.visibility='visible';
    txt.value='';txt.readOnly=false;burn.classList.remove('gone');logo.classList.remove('gone');foot.classList.remove('gone');burn.disabled=true;burning=false;
    txt.focus();
  });
})();

if('serviceWorker' in navigator){
  addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})});
}
