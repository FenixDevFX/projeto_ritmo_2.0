var cur={mode:"",query:"",lista:[]};
var cv=document.getElementById("cv"),cx=cv.getContext("2d"),mic=document.getElementById("mic"),st=document.getElementById("status"),res=document.getElementById("res"),list=document.getElementById("list"),hist=[];
var rec=null,chunks=[],level=0,listening=false,timer=null,t0=0;

function draw(t){
  cx.clearRect(0,0,cv.width,cv.height);
  var n=44,w=cv.width/n,cs=getComputedStyle(document.documentElement).getPropertyValue("--acc");
  for(var i=0;i<n;i++){
    var amp=listening?(0.15+level*0.85)*(0.4+0.6*Math.abs(Math.sin(t/260+i*0.55))):0.05;
    var h=Math.max(4,amp*cv.height*0.9);
    cx.fillStyle=cs;cx.globalAlpha=listening?1:.35;
    cx.fillRect(i*w+2,(cv.height-h)/2,w-4,h);
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

async function start(){
  var stream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}
  catch(e){st.textContent="Preciso da permissão do microfone para ouvir.";return}
  var ac=new (window.AudioContext||window.webkitAudioContext)(),an=ac.createAnalyser();
  an.fftSize=256;ac.createMediaStreamSource(stream).connect(an);
  var buf=new Uint8Array(an.fftSize);
  var iv=setInterval(function(){an.getByteTimeDomainData(buf);var s=0;for(var i=0;i<buf.length;i++){var v=(buf[i]-128)/128;s+=v*v}level=Math.min(1,Math.sqrt(s/buf.length)*5)},80);
  chunks=[];rec=new MediaRecorder(stream);
  rec.ondataavailable=function(e){chunks.push(e.data)};
  rec.onstop=function(){clearInterval(iv);stream.getTracks().forEach(function(t){t.stop()});ac.close();send(new Blob(chunks,{type:rec.mimeType}))};
  rec.start();listening=true;t0=Date.now();mic.classList.add("on");res.style.display="none";
  st.textContent="Ouvindo… toque de novo quando terminar";
  timer=setTimeout(stop,12000);
}
function stop(){
  clearTimeout(timer);
  if(rec&&rec.state==="recording"){listening=false;level=0;mic.classList.remove("on");rec.stop()}
}
mic.onclick=function(){listening?stop():start()};

async function toWav(blob){
  var ac=new (window.AudioContext||window.webkitAudioContext)();
  var b=await ac.decodeAudioData(await blob.arrayBuffer());ac.close();
  var oc=new OfflineAudioContext(1,Math.ceil(b.duration*16000),16000),src=oc.createBufferSource();
  src.buffer=b;src.connect(oc.destination);src.start();
  var d=(await oc.startRendering()).getChannelData(0),o=new DataView(new ArrayBuffer(44+d.length*2));
  function w(p,s){for(var i=0;i<s.length;i++)o.setUint8(p+i,s.charCodeAt(i))}
  w(0,"RIFF");o.setUint32(4,36+d.length*2,true);w(8,"WAVEfmt ");o.setUint32(16,16,true);o.setUint16(20,1,true);o.setUint16(22,1,true);o.setUint32(24,16000,true);o.setUint32(28,32000,true);o.setUint16(32,2,true);o.setUint16(34,16,true);w(36,"data");o.setUint32(40,d.length*2,true);
  for(var i=0;i<d.length;i++)o.setInt16(44+i*2,Math.max(-1,Math.min(1,d[i]))*32767,true);
  return new Blob([o],{type:"audio/wav"});
}

async function send(blob){
  if(Date.now()-t0<3000){st.textContent="Cantarole um pouco mais (uns 8 a 12 segundos).";return}
  st.textContent="Analisando a melodia…";
  var wav;
  try{wav=await toWav(blob)}catch(e){st.textContent="Não consegui processar o áudio gravado neste navegador.";return}
  try{
    var r=await fetch("/api/identify",{method:"POST",headers:{"Content-Type":"application/octet-stream"},body:wav});
    var tx=await r.text(),j;
    try{j=JSON.parse(tx)}catch(e){st.textContent="O servidor respondeu "+r.status+" sem JSON. Confira a pasta api/ e os logs da Vercel.";return}
    if(!r.ok||!j.results||!j.results.length){st.textContent=j.error||"Não encontrei essa música. Tente cantarolar o refrão com mais calma.";if(r.ok)show([],"melodia","");return}
    show(j.results,"melodia","");st.textContent="Veja as possibilidades abaixo ou tente de novo";
  }catch(e){st.textContent="Falha de rede: "+(e.message||e)}
}

function show(r,mode,query){
  cur={mode:mode,query:query||"",lista:r.map(function(x){return (x.title||"")+" - "+(x.artist||"")})};
  list.innerHTML="";
  r.forEach(function(x){
    var d=document.createElement("div");d.className="song";
    d.innerHTML='<div class="mrow"><img class="cover" alt=""><div><div class="t"></div><div class="a"></div></div></div><div class="tags"></div><div class="actions"><button class="ok">É essa</button><button class="p">Salvar</button></div>';
    d.querySelector(".t").textContent=x.title||"";
    d.querySelector(".a").textContent=x.artist||"";
    var img=d.querySelector(".cover");
    if(x.cover&&x.cover.indexOf("https://")===0)img.src=x.cover;else img.style.display="none";
    [x.album,x.year].forEach(function(v){if(v){var s=document.createElement("span");s.textContent=v;d.querySelector(".tags").appendChild(s)}});
    if(x.preview&&x.preview.indexOf("https://")===0){var a=document.createElement("audio");a.controls=true;a.preload="none";a.src=x.preview;d.insertBefore(a,d.querySelector(".actions"))}
    if(x.link&&x.link.indexOf("https://")===0){var l=document.createElement("a");l.href=x.link;l.target="_blank";l.rel="noopener";l.textContent="Ouvir no Deezer";d.insertBefore(l,d.querySelector(".actions"))}
    if(x.fonte&&x.fonte.indexOf("https://")===0){var v=document.createElement("a");v.href=x.fonte;v.target="_blank";v.rel="noopener";v.textContent="Ver letra";v.style.marginLeft="12px";d.insertBefore(v,d.querySelector(".actions"))}
    d.querySelector(".ok").onclick=function(){feedback("acertou",(x.title||"")+" - "+(x.artist||""),"");this.textContent="Valeu! \u2713";this.disabled=true};
    d.querySelector(".p").onclick=function(){addHist(x);this.textContent="Salva \u2713";this.disabled=true};
    list.appendChild(d);
  });
  var old=res.querySelector(".fb");if(old)old.remove();
  var fb=document.createElement("div");fb.className="fb";
  fb.innerHTML='<button class="none">Nenhuma dessas</button><div class="ask" style="display:none"><input type="text" maxlength="120" placeholder="Qual era a música? (opcional)"><button class="send">Enviar</button></div>';
  fb.querySelector(".none").onclick=function(){this.style.display="none";fb.querySelector(".ask").style.display="flex"};
  fb.querySelector(".send").onclick=function(){feedback("nenhuma","",fb.querySelector("input").value);fb.textContent="Obrigado! Isso ajuda a melhorar o app."};
  res.appendChild(fb);
  res.style.display="block";
}

function feedback(resultado,escolhida,esperada){
  fetch("/api/feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({modo:cur.mode,consulta:cur.query,resultado:resultado,escolhida:escolhida,esperada:esperada,lista:cur.lista})}).catch(function(){});
}

function addHist(x){
  hist.unshift(x);
  var h=document.getElementById("hist");h.innerHTML="";
  hist.forEach(function(y){
    var d=document.createElement("div");d.className="song";
    d.innerHTML='<div class="t"></div><div class="a"></div>';
    d.querySelector(".t").textContent=y.title||"";
    d.querySelector(".a").textContent=(y.artist||"")+(y.year?" · "+y.year:"");
    h.appendChild(d);
  });
}

document.getElementById("qb").onclick=async function(){
  var q=document.getElementById("q").value.trim();
  if(q.length<4){st.textContent="Digite um trecho um pouco maior da letra.";return}
  st.textContent="Buscando pela letra…";
  try{
    var r=await fetch("/api/letra?q="+encodeURIComponent(q)),tx=await r.text(),j;
    try{j=JSON.parse(tx)}catch(e){st.textContent="O servidor respondeu "+r.status+" sem JSON. Confira a pasta api/ e os logs da Vercel.";return}
    if(!r.ok||!j.results||!j.results.length){st.textContent=j.error||"Não achei músicas com esse trecho.";if(r.ok)show([],"letra",q);return}
    show(j.results,"letra",q);st.textContent="Veja as possibilidades abaixo";
  }catch(e){st.textContent="Falha de rede: "+(e.message||e)}
};
document.getElementById("q").addEventListener("keydown",function(e){if(e.key==="Enter")document.getElementById("qb").click()});
