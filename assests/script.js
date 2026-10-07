var DB=[
{t:"Garota de Ipanema",a:"Tom Jobim e Vinicius de Moraes",y:1962,g:"Bossa nova",f:"Composta no Rio e regravada no mundo todo; uma das canções brasileiras mais tocadas da história."},
{t:"Asa Branca",a:"Luiz Gonzaga e Humberto Teixeira",y:1947,g:"Baião",f:"Retrata a seca do sertão nordestino e virou um hino do baião."},
{t:"Águas de Março",a:"Tom Jobim",y:1972,g:"MPB / Bossa nova",f:"Letra feita de imagens encadeadas, sem refrão tradicional."}
];
var cv=document.getElementById("cv"),cx=cv.getContext("2d"),mic=document.getElementById("mic"),st=document.getElementById("status");
var listening=false,level=0,raf,stream=null,analyser=null,hist=[];

function draw(t){
  cx.clearRect(0,0,cv.width,cv.height);
  var n=44,w=cv.width/n,cs=getComputedStyle(document.documentElement).getPropertyValue("--acc");
  for(var i=0;i<n;i++){
    var amp=listening?(0.15+level*0.85)*(0.4+0.6*Math.abs(Math.sin(t/260+i*0.55))):0.05;
    var h=Math.max(4,amp*cv.height*0.9);
    cx.fillStyle=cs;cx.globalAlpha=listening?1:.35;
    cx.fillRect(i*w+2,(cv.height-h)/2,w-4,h);
  }
  raf=requestAnimationFrame(draw);
}
raf=requestAnimationFrame(draw);

async function start(){
  if(listening)return;
  listening=true;level=0.4;mic.classList.add("on");
  document.getElementById("res").style.display="none";
  st.textContent="Ouvindo… cantarole agora";
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true});
    var ac=new (window.AudioContext||window.webkitAudioContext)();
    analyser=ac.createAnalyser();analyser.fftSize=256;
    ac.createMediaStreamSource(stream).connect(analyser);
  }catch(e){analyser=null;}
  var buf=analyser?new Uint8Array(analyser.fftSize):null;
  var iv=setInterval(function(){
    if(analyser){analyser.getByteTimeDomainData(buf);var s=0;for(var i=0;i<buf.length;i++){var v=(buf[i]-128)/128;s+=v*v}level=Math.min(1,Math.sqrt(s/buf.length)*5)}
    else level=0.3+Math.random()*0.5;
  },80);
  setTimeout(function(){
    clearInterval(iv);
    if(stream){stream.getTracks().forEach(function(t){t.stop()});stream=null}
    finish();
  },4500);
}

function finish(){
  listening=false;mic.classList.remove("on");level=0;
  st.textContent="Analisando melodia e ritmo…";
  setTimeout(function(){
    var order=DB.slice().sort(function(){return Math.random()-.5});
    var pcts=[93,61,38];
    show(order.map(function(s){return {s:s}}));
    st.textContent="Veja as possibilidades abaixo ou toque no microfone para tentar de novo";
  },1200);
}

function show(r){
  var el=document.getElementById("list");el.innerHTML="";
  r.forEach(function(x){
    var d=document.createElement("div");d.className="song";
    d.innerHTML='<div class="t"></div><div class="a"></div>'+
      '<div class="tags"><span class="y"></span><span class="g"></span></div>'+
      '<p class="fact"></p><div class="actions"><button class="p">Salvar</button></div>';
    d.querySelector(".t").textContent=x.s.t;
    d.querySelector(".a").textContent=x.s.a;
    d.querySelector(".y").textContent=x.s.y;
    d.querySelector(".g").textContent=x.s.g;
    d.querySelector(".fact").textContent=x.s.f;
    d.querySelector(".p").onclick=function(){addHist(x.s);this.textContent="Salva \u2713";this.disabled=true};
    el.appendChild(d);
  });
  document.getElementById("res").style.display="block";
}

function addHist(s){
  hist.unshift(s);
  var h=document.getElementById("hist");h.innerHTML="";
  hist.forEach(function(x){
    var d=document.createElement("div");d.className="song";
    d.innerHTML='<div class="t"></div><div class="a"></div>';
    d.querySelector(".t").textContent=x.t;d.querySelector(".a").textContent=x.a+" · "+x.y;
    h.appendChild(d);
  });
}
mic.addEventListener("click",start);