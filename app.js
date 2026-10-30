'use strict';
const API='https://biquote.io/api/XAUUSD';
const TFS={'5m':300,'15m':900};

/* ---------- المؤشرات ---------- */
function ema(a,p){const k=2/(p+1),r=[];let e=null;a.forEach((v,i)=>{if(i<p-1){r.push(null);return}
e=e===null?a.slice(0,p).reduce((x,y)=>x+y,0)/p:v*k+e*(1-k);r.push(e)});return r}
function rsi(c,p=14){const r=new Array(c.length).fill(null);if(c.length<=p)return r;let g=0,l=0;
for(let i=1;i<=p;i++){const d=c[i]-c[i-1];d>0?g+=d:l-=d}g/=p;l/=p;r[p]=l===0?100:100-100/(1+g/l);
for(let i=p+1;i<c.length;i++){const d=c[i]-c[i-1];g=(g*(p-1)+Math.max(d,0))/p;l=(l*(p-1)+Math.max(-d,0))/p;r[i]=l===0?100:100-100/(1+g/l)}return r}
function atr(cs,p=14){const r=new Array(cs.length).fill(null);if(cs.length<=p)return r;
const tr=cs.map((x,i)=>i?Math.max(x.h-x.l,Math.abs(x.h-cs[i-1].c),Math.abs(x.l-cs[i-1].c)):x.h-x.l);
let a=0;for(let i=1;i<=p;i++)a+=tr[i];a/=p;r[p]=a;for(let i=p+1;i<cs.length;i++){a=(a*(p-1)+tr[i])/p;r[i]=a}return r}
function levels(cs,price){const hi=[],lo=[],n=cs.length;
for(let i=3;i<n-3;i++){let h=true,l=true;for(let j=1;j<=3;j++){
if(cs[i].h<=cs[i-j].h||cs[i].h<=cs[i+j].h)h=false;if(cs[i].l>=cs[i-j].l||cs[i].l>=cs[i+j].l)l=false}
if(h)hi.push(cs[i].h);if(l)lo.push(cs[i].l)}
const res=hi.filter(x=>x>price).sort((a,b)=>a-b)[0]??null;
const sup=lo.filter(x=>x<price).sort((a,b)=>b-a)[0]??null;return{res,sup}}

/* ---------- تحليل وإشارة (v2: سيناريوهات شراء وبيع متماثلة، بدون مطاردة السعر) ---------- */
function marketOpen(d){const day=d.getUTCDay(),h=d.getUTCHours();
if(day===6)return false;if(day===5&&h>=22)return false;if(day===0&&h<22)return false;
if(day>=1&&day<=4&&h===22)return false;return true}
function stoch(cs,p=14){const K=[];for(let i=p-1;i<cs.length;i++){let h=-1e9,l=1e9;for(let j=i-p+1;j<=i;j++){h=Math.max(h,cs[j].h);l=Math.min(l,cs[j].l)}K.push(h===l?50:(cs[i].c-l)/(h-l)*100)}return K}
function macd(c){const a=ema(c,12),b=ema(c,26),m=[];for(let i=25;i<c.length;i++)m.push(a[i]-b[i]);return{m,s:ema(m,9)}}
function boll(c,p=20,k=2){const w=c.slice(-p),mu=w.reduce((x,y)=>x+y,0)/p,sd=Math.sqrt(w.reduce((x,y)=>x+(y-mu)**2,0)/p);return{u:mu+k*sd,l:mu-k*sd}}
function decide(cs,price,htf){
const c=cs.map(x=>x.c),e20=ema(c,20),e50=ema(c,50),rs=rsi(c),at=atr(cs),n=cs.length-1;
const A=at[n],R=rs[n],E20=e20[n],E50=e50[n];
if([A,R,E20,E50,e20[n-3]].some(v=>v==null)||n<30)return null;
const lv=levels(cs,price),last=cs[n-1],p2=cs[n-2],body=last.c-last.o,ba=Math.abs(body)/A;
const ind={ema20:E20,ema50:E50,rsi:R,atr:A,res:lv.res,sup:lv.sup,body,bodyAtr:ba,htf,
trend:E20>E50&&price>E50?'صاعد':E20<E50&&price<E50?'هابط':'عرضي',
mom:R>=60?'زخم صاعد قوي':R>=52?'زخم صاعد':R<=40?'زخم هابط قوي':R<=48?'زخم هابط':'محايد'};
const up=E20>E50&&price>E50,dn=E20<E50&&price<E50,near=Math.abs(price-E20)<=0.8*A;
const rMin=Math.min(...rs.slice(-4)),rMax=Math.max(...rs.slice(-4));
const V=[],vote=(n,v)=>V.push({n,v});
vote('الاتجاه (EMA20/50)',up?1:dn?-1:0);
vote('اتجاه 15 دقيقة',htf==='up'?1:htf==='down'?-1:0);
vote('ارتداد EMA20',up&&near&&price>=E20-0.3*A&&body>0&&ba>=0.2&&R>=40&&R<=62?1:dn&&near&&price<=E20+0.3*A&&body<0&&ba>=0.2&&R>=38&&R<=60?-1:0);
vote('انعكاس RSI',rMin<=30&&body>0&&R>rMin?1:rMax>=70&&body<0&&R<rMax?-1:0);
const M=macd(c),mi=M.m.length-1,h0=M.m[mi]-M.s[mi],h1=M.m[mi-1]-M.s[mi-1];
vote('MACD',h0>0&&h0>h1?1:h0<0&&h0<h1?-1:0);
const bb=boll(c);vote('بولينجر',price<=bb.l+0.15*A&&body>0?1:price>=bb.u-0.15*A&&body<0?-1:0);
const K=stoch(cs),kN=K[K.length-1],kP=K[K.length-2];vote('ستوكاستك',kN<25&&kN>kP?1:kN>75&&kN<kP?-1:0);
const hh=Math.max(...cs.slice(-22,-2).map(x=>x.h)),ll=Math.min(...cs.slice(-22,-2).map(x=>x.l));
vote('اختراق 20 شمعة',last.c>hh&&price>hh&&ba>=0.5?1:last.c<ll&&price<ll&&ba>=0.5?-1:0);
const b2=p2.c-p2.o,rng=last.h-last.l||1,lw=Math.min(last.o,last.c)-last.l,uw=last.h-Math.max(last.o,last.c),bd=Math.abs(body)||0.01;
vote('أنماط الشموع',(b2<0&&body>0&&last.o<=p2.c&&last.c>=p2.o)||(lw>=2*bd&&lw>=0.5*rng&&body>=0)?1:(b2>0&&body<0&&last.o>=p2.c&&last.c<=p2.o)||(uw>=2*bd&&uw>=0.5*rng&&body<=0)?-1:0);
vote('دعم/مقاومة',lv.sup!=null&&price-lv.sup<=0.5*A&&body>0?1:lv.res!=null&&lv.res-price<=0.5*A&&body<0?-1:0);
const N=V.length,b=V.filter(x=>x.v>0).length,s=V.filter(x=>x.v<0).length;
let sig='WAIT',why=[];
const need=d=>((d>0?(dn||htf==='down'):(up||htf==='up'))?4:3);
if(b>=need(1)&&b-s>=2&&body>0&&ba>=0.15)sig='BUY';else if(s>=need(-1)&&s-b>=2&&body<0&&ba>=0.15)sig='SELL';
let block=null;
if(sig==='BUY'){if(price-E20>2*A)block='السعر مبتعد عن EMA20 (مطاردة)';else if(R>75)block='RSI تشبع شرائي';else if(lv.res!=null&&lv.res-price<0.4*A)block='مقاومة ملاصقة للدخول'}
if(sig==='SELL'){if(E20-price>2*A)block='السعر مبتعد عن EMA20 (مطاردة)';else if(R<25)block='RSI تشبع بيعي';else if(lv.sup!=null&&price-lv.sup<0.4*A)block='دعم ملاصق للدخول'}
if(block){sig='WAIT';why=[block]}
let trade=null,setup='توافق: شراء '+b+' / بيع '+s+' من '+N;
if(sig!=='WAIT'){const B=sig==='BUY',d=B?1:-1;
const sw=B?Math.min(...cs.slice(-6).map(x=>x.l)):Math.max(...cs.slice(-6).map(x=>x.h));
const risk=Math.min(Math.max(Math.abs(price-sw)+0.2*A,A),2*A);
trade={entry:price,sl:price-d*risk,tp1:price+d*1.5*risk,tp2:price+d*2.5*risk,risk,rr1:1.5,rr2:2.5};
why=V.filter(x=>B?x.v>0:x.v<0).map(x=>x.n);const lvl=B?lv.res:lv.sup;if(lvl!=null&&Math.abs(lvl-price)<1.5*risk)why.push('تنبيه: '+(B?'مقاومة':'دعم')+' عند '+lvl.toFixed(2)+' قد يعيق الوصول إلى TP1');
why.push('SL حسب آخر قاع/قمة، الأهداف 1.5R و2.5R')}
else if(!why.length)why=['لا يوجد توافق كافٍ بين الاستراتيجيات: الأفضل الانتظار'];
return{sig,setup,why,trade,conf:Math.max(b,s)/N,ind,votes:V}}
function analyze(cs,price,tfSec,now,open,htf){
const out={signal:'WAIT',reasons:[],score:null,trade:null,ind:null,setup:''};
if(!cs||cs.length<60){out.reasons.push('بيانات الشموع ناقصة (أقل من 60 شمعة)');return out}
if(!Number.isFinite(price)){out.reasons.push('السعر الحالي غير متوفر');return out}
const d=decide(cs,price,htf);if(!d){out.reasons.push('تعذر حساب المؤشرات');return out}
out.ind=d.ind;out.votes=d.votes;out.setup=d.setup;const A=d.ind.atr;
if(!open){out.reasons.push('السوق مغلق (تقديري)');return out}
const age=now-cs[cs.length-1].t;if(age>tfSec*1000*3){out.reasons.push('البيانات قديمة: آخر شمعة قبل '+Math.round(age/60000)+' دقيقة');return out}
if(Math.abs(price-cs[cs.length-1].c)>2*A){out.reasons.push('تضارب: السعر الحالي بعيد عن آخر شمعة');return out}
out.signal=d.sig;out.setup=d.setup;out.trade=d.trade;out.score=d.sig==='WAIT'?null:d.conf;
out.reasons=d.why;
return out}
function backtest(cs){let w=0,l=0,o=0,i=60;
while(i<cs.length-1){const d=decide(cs.slice(0,i+1),cs[i].c,null);
if(d&&d.sig!=='WAIT'){const t=d.trade,B=d.sig==='BUY';let r=null;
for(let j=i+1;j<cs.length&&j<=i+30;j++){const k=cs[j],sl=B?k.l<=t.sl:k.h>=t.sl,tp=B?k.h>=t.tp1:k.l<=t.tp1;
if(sl){r='L';i=j;break}if(tp){r='W';i=j;break}}
if(r==='W')w++;else if(r==='L')l++;else{o++;i+=30}}
i++}
return{w,l,o,n:w+l}}

/* ---------- تحليل استجابة API (دفاعي: الحقول غير مؤكدة) ---------- */
const pick=(o,k)=>{for(const x of k)if(o[x]!=null)return o[x]};
const toMs=t=>{if(typeof t==='string'&&isNaN(+t))return Date.parse(t);t=+t;return t<1e11?t*1000:t};
function parseCandles(j){const a=Array.isArray(j)?j:Object.values(j||{}).find(Array.isArray);
if(!a)throw new Error('شكل استجابة الشموع غير معروف');
const cs=a.map(x=>Array.isArray(x)?{t:toMs(x[0]),o:+x[1],h:+x[2],l:+x[3],c:+x[4]}:
{t:toMs(pick(x,['t','time','timestamp','ts','openTime','date'])),o:+pick(x,['o','open']),h:+pick(x,['h','high']),l:+pick(x,['l','low']),c:+pick(x,['c','close'])})
.filter(x=>[x.t,x.o,x.h,x.l,x.c].every(Number.isFinite)).sort((a,b)=>a.t-b.t);
if(!cs.length)throw new Error('لا توجد شموع صالحة في الاستجابة');return cs}
function parseTick(j){j=j&&j.data&&!Array.isArray(j.data)?j.data:j;if(Array.isArray(j))j=j[0];
const bid=+pick(j,['bid']),ask=+pick(j,['ask']);let p=+pick(j,['mid']);
if(!Number.isFinite(p)&&Number.isFinite(bid)&&Number.isFinite(ask))p=(bid+ask)/2;
if(!Number.isFinite(p))throw new Error('تعذر قراءة السعر من الاستجابة');
const tt=pick(j,['time','timestamp','ts','t']);
return{price:p,bid,ask,pct:+pick(j,['dayDiffPercent']),t:tt!=null?toMs(tt):null}}

if(typeof module!=='undefined')module.exports={ema,rsi,atr,levels,analyze,decide,backtest,parseCandles,parseTick,marketOpen};

/* ---------- الواجهة ---------- */
if(typeof document!=='undefined'){
const $=id=>document.getElementById(id);
const S=Object.assign({tf:'5m',cap:30,risk:2,cs:'',notify:false},JSON.parse((()=>{try{return localStorage.getItem('gatp')||'{}'}catch(e){return'{}'}})()));
const save=()=>{try{localStorage.setItem('gatp',JSON.stringify(S))}catch(e){}};
let candles=[],htf=null,bt=null,tick=null,res=null,prevSig=null,lastOk=null,netErr=null;
const f=(v,d=2)=>Number.isFinite(v)?v.toFixed(d):'--';
const libya=d=>d.toLocaleTimeString('en-GB',{timeZone:'Africa/Tripoli',hour:'2-digit',minute:'2-digit',second:'2-digit'});

async function getJSON(u){const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
async function load(){
try{const [t,c]=await Promise.all([getJSON(API),getJSON(API+'/ohlc?interval='+S.tf+'&limit=180')]);
tick=parseTick(t);candles=parseCandles(c);lastOk=Date.now();netErr=null;htf=null;
if(S.tf==='5m'){try{const h=parseCandles(await getJSON(API+'/ohlc?interval=15m&limit=180')).map(k=>k.c),a=ema(h,20).pop(),b=ema(h,50).pop();
if(a!=null&&b!=null)htf=a>b&&h[h.length-1]>b?'up':a<b&&h[h.length-1]<b?'down':'flat'}catch(e){htf=null}}}
catch(e){netErr=navigator.onLine?'تعذر جلب البيانات: '+e.message+' (قد يكون المصدر متوقفاً أو يمنع الطلبات من المتصفح CORS). لا تُعرض أسعار بديلة وهمية.':'لا يوجد اتصال بالإنترنت.'}
bt=candles.length?backtest(candles):null;compute();render()}
let busy=false;
async function fast(){if(busy||netErr&&!candles.length)return;busy=true;
try{tick=parseTick(await getJSON(API));lastOk=Date.now();netErr=null;
const k=candles[candles.length-1];if(k&&Date.now()<k.t+TFS[S.tf]*1000){k.c=tick.price;k.h=Math.max(k.h,tick.price);k.l=Math.min(k.l,tick.price)}
compute();render()}catch(e){netErr=navigator.onLine?'انقطع تحديث السعر: '+e.message:'لا يوجد اتصال بالإنترنت.';compute();render()}finally{busy=false}}
function compute(){if(netErr||!tick||!candles.length){res=null;return}
res=analyze(candles,tick.price,TFS[S.tf],Date.now(),marketOpen(new Date()),htf);
logUpdate()}
let LOG=[];try{LOG=JSON.parse(localStorage.getItem('gatp_log')||'[]')}catch(e){}
const saveLog=()=>{try{localStorage.setItem('gatp_log',JSON.stringify(LOG.slice(-200)))}catch(e){}};
let sc=0,lastS='';
function logUpdate(){if(!res||!tick||!candles.length)return;
LOG.forEach(e=>{if(e.r)return;if(!e.exitBy){e.r='T';return}const B=e.sig==='BUY',chk=(h,l)=>{if(e.r)return;const sl=B?l<=e.sl:h>=e.sl,tp=B?h>=e.tp1:l<=e.tp1;if(sl)e.r='L';else if(tp)e.r='W'};
candles.forEach(k=>{if(k.t>e.t0)chk(k.h,k.l)});chk(tick.price,tick.price);if(!e.r&&Date.now()>e.exitBy)e.r='T'});
if(res.signal===lastS)sc++;else{sc=1;lastS=res.signal}
const key=candles.length>1?candles[candles.length-2].t:0;
if(res.signal!=='WAIT'&&res.trade&&!LOG.some(e=>!e.r)&&sc>=3&&!LOG.some(e=>e.key===key&&e.tf===S.tf)){const t=res.trade,T=TFS[S.tf]*1000;
LOG.push({key,tf:S.tf,t0:candles[candles.length-1].t,at:Date.now(),sig:res.signal,setup:res.setup,entry:t.entry,sl:t.sl,tp1:t.tp1,tp2:t.tp2,why:res.reasons.slice(),enterUntil:Date.now()+3*T,exitBy:Date.now()+12*T,r:null});alertSig(res.signal)}
saveLog();renderLog()}
function renderLog(){const el=$('log');if(!el)return;const w=LOG.filter(e=>e.r==='W').length,l=LOG.filter(e=>e.r==='L').length,o=LOG.filter(e=>!e.r).length;
$('logStat').textContent='رابحة (TP1): '+w+' · خاسرة: '+l+' · مفتوحة: '+o+(w+l?' · نسبة النجاح الفعلية: '+Math.round(w/(w+l)*100)+'%':'');
el.innerHTML='';LOG.slice(-10).reverse().forEach(e=>{const d=document.createElement('div');d.className='ses';
d.textContent=new Date(e.at).toLocaleTimeString('en-GB',{timeZone:'Africa/Tripoli',hour:'2-digit',minute:'2-digit'})+' '+e.sig+' '+e.tf+' @'+e.entry.toFixed(2);
const r=document.createElement('span');r.textContent=e.r==='W'?'✔ ربح':e.r==='L'?'✖ خسارة':e.r==='T'?'⏱ انتهى الوقت':'… مفتوحة';r.style.color=e.r==='W'?'#26a69a':e.r==='L'?'#ef5350':'#999';d.appendChild(r);el.appendChild(d)})}
function alertSig(s){const m='إشارة جديدة: '+(s==='BUY'?'شراء BUY':'بيع SELL')+' على XAUUSD '+S.tf;
document.title=m;try{navigator.vibrate&&navigator.vibrate(200)}catch(e){}
if(S.notify){try{const a=new (window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator();o.connect(a.destination);o.frequency.value=880;o.start();o.stop(a.currentTime+.25)}catch(e){}
try{if(Notification.permission==='granted')new Notification('GOLD AI TRADER PRO',{body:m})}catch(e){}}}

const lt=ms=>new Date(ms).toLocaleTimeString('en-GB',{timeZone:'Africa/Tripoli',hour:'2-digit',minute:'2-digit'});
function planView(p,r){const A=(r.ind&&r.ind.atr)||0,now=Date.now(),px=tick?tick.price:p.entry;let st;
if(now<=p.enterUntil)st=Math.abs(px-p.entry)<=0.3*A?'ادخل الآن عند Entry أو ضع أمراً معلقاً عليه. نافذة الدخول حتى '+lt(p.enterUntil)+' (ليبيا)':'السعر ابتعد عن الدخول: لا تطارد، انتظر عودته قبل '+lt(p.enterUntil);
else st='انتهت نافذة الدخول، لا تدخل متأخراً.';
return{signal:p.sig,setup:p.setup+' · مثبّتة منذ '+lt(p.at),reasons:['الحالة: '+st,'الخروج: عند TP1/TP2 أو الوقف، وإلا خروج زمني عند '+lt(p.exitBy)].concat(p.why||[]),score:null,
trade:{entry:p.entry,sl:p.sl,tp1:p.tp1,tp2:p.tp2,rr1:1.5,rr2:2.5},ind:r.ind,votes:r.votes}}
function render(){
const open=marketOpen(new Date());
$('market').textContent=open?'السوق مفتوح (تقديري)':'السوق مغلق (تقديري)';$('market').className='pill '+(open?'ok':'bad');
$('net').textContent=netErr?'غير متصل / خطأ':'متصل';$('net').className='pill '+(netErr?'bad':'ok');
$('err').hidden=!netErr;$('err').textContent=netErr||'';
document.querySelectorAll('.tf button').forEach(b=>b.classList.toggle('on',b.dataset.tf===S.tf));
if(tick&&!netErr){$('price').textContent=f(tick.price);
$('chg').textContent=Number.isFinite(tick.pct)?(tick.pct>0?'+':'')+tick.pct.toFixed(2)+'%':'--';
$('chg').style.color=tick.pct>0?'#26a69a':tick.pct<0?'#ef5350':'';
$('spread').textContent=Number.isFinite(tick.ask-tick.bid)?f(tick.ask-tick.bid):'غير متوفر';
$('upd').textContent=libya(new Date(lastOk))}else{$('price').textContent='--';$('chg').textContent='--';$('spread').textContent='--'}
let r=res||{signal:'WAIT',reasons:[netErr||'لا توجد بيانات'],score:null,trade:null,ind:null};const plan=LOG.find(e=>!e.r);if(plan)r=planView(plan,r);
$('sig').textContent=r.signal;$('sig').className='sig '+r.signal;
$('sigAr').textContent={BUY:'شراء',SELL:'بيع',WAIT:'انتظار'}[r.signal];
$('score').textContent=r.setup||'--';
$('votes').innerHTML='';(r.votes||[]).forEach(v=>{const d=document.createElement('div');d.className='ses';d.textContent=v.n;const x=document.createElement('span');x.textContent=v.v>0?'▲ شراء':v.v<0?'▼ بيع':'— محايد';x.style.color=v.v>0?'#26a69a':v.v<0?'#ef5350':'#777';d.appendChild(x);$('votes').appendChild(d)});
$('bt').textContent=bt?(bt.n?'اختبار رجعي على آخر '+candles.length+' شمعة: '+bt.n+' صفقة، بلغت TP1 قبل الوقف في '+bt.w+' ('+Math.round(bt.w/bt.n*100)+'%). عينة صغيرة، لا تضمن المستقبل. نقطة التعادل لهذا R/R حوالي 40%.':'الاختبار الرجعي: لم تظهر صفقات في البيانات المتاحة.'):'';
$('reasons').innerHTML='';r.reasons.forEach(t=>{const li=document.createElement('li');li.textContent=t;$('reasons').appendChild(li)});
const t=r.trade;$('entry').textContent=t?f(t.entry):'--';$('sl').textContent=t?f(t.sl):'--';$('tp1').textContent=t?f(t.tp1):'--';
$('tp2').textContent=t?f(t.tp2):'--';$('rr1').textContent=t?'1 : '+t.rr1:'--';$('rr2').textContent=t?'1 : '+t.rr2:'--';
const i=r.ind;$('ind').innerHTML='';
if(i)[['EMA 20',f(i.ema20)],['EMA 50',f(i.ema50)],['RSI 14',f(i.rsi,1)],['ATR 14',f(i.atr)],['الاتجاه',i.trend],['اتجاه 15د',{up:'صاعد',down:'هابط',flat:'عرضي'}[i.htf]||'—'],['الزخم',i.mom],
['الدعم',i.sup!=null?f(i.sup):'—'],['المقاومة',i.res!=null?f(i.res):'—'],['اتجاه الشمعة',i.body>0?'صاعدة':'هابطة'],['حجم الشمعة',f(i.bodyAtr,2)+' ATR']]
.forEach(([k,v])=>{const d=document.createElement('div');d.textContent=k;const b=document.createElement('b');b.textContent=v;d.appendChild(b);$('ind').appendChild(d)});
calc(t);draw(t)}

function calc(t){const cap=+S.cap,rk=+S.risk,rusd=cap*rk/100,rows=[['مبلغ المخاطرة','$'+f(rusd)],['أقصى خسارة','-$'+f(rusd)],
['ربح TP1',t?'+$'+f(rusd*t.rr1):'--'],['ربح TP2',t?'+$'+f(rusd*t.rr2):'--']];
const cs=+S.cs;let lot='يلزم إدخال حجم العقد';
if(t&&cs>0)lot=f(rusd/(Math.abs(t.entry-t.sl)*cs),3)+' لوت';else if(!t&&cs>0)lot='بانتظار إشارة';
rows.push(['حجم اللوت',lot]);$('calc').innerHTML='';
rows.forEach(([k,v])=>{const d=document.createElement('div');d.textContent=k;const b=document.createElement('b');b.textContent=v;d.appendChild(b);$('calc').appendChild(d)})}

function draw(t){const cv=$('chart'),dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=300;cv.width=W*dpr;cv.height=H*dpr;
const x=cv.getContext('2d');x.scale(dpr,dpr);x.clearRect(0,0,W,H);
if(!candles.length||netErr){x.fillStyle='#777';x.font='14px sans-serif';x.textAlign='center';x.fillText('لا توجد بيانات للعرض',W/2,H/2);return}
const N=Math.min(70,candles.length),v=candles.slice(-N),c=candles.map(k=>k.c),e20=ema(c,20).slice(-N),e50=ema(c,50).slice(-N);
let hi=Math.max(...v.map(k=>k.h)),lo=Math.min(...v.map(k=>k.l));
if(t)[t.sl,t.tp1,t.tp2,t.entry].forEach(p=>{hi=Math.max(hi,p);lo=Math.min(lo,p)});
const pad=(hi-lo)*.05||1;hi+=pad;lo-=pad;const pw=52,cw=(W-pw)/N,Y=p=>H-(p-lo)/(hi-lo)*H;
x.font='11px sans-serif';x.textAlign='left';x.fillStyle='#777';x.strokeStyle='#222';
for(let g=0;g<5;g++){const p=lo+(hi-lo)*g/4;x.beginPath();x.moveTo(0,Y(p));x.lineTo(W-pw,Y(p));x.stroke();x.fillText(p.toFixed(1),W-pw+4,Y(p)-2)}
v.forEach((k,i)=>{const cx=i*cw+cw/2,up=k.c>=k.o;x.strokeStyle=x.fillStyle=up?'#26a69a':'#ef5350';
x.beginPath();x.moveTo(cx,Y(k.h));x.lineTo(cx,Y(k.l));x.stroke();x.fillRect(cx-cw*.35,Math.min(Y(k.o),Y(k.c)),cw*.7,Math.max(1,Math.abs(Y(k.o)-Y(k.c))))});
[[e20,'#d4af37'],[e50,'#4fc3f7']].forEach(([e,col])=>{x.strokeStyle=col;x.lineWidth=1.5;x.beginPath();let s=false;
e.forEach((p,i)=>{if(p==null)return;const px=i*cw+cw/2;s?x.lineTo(px,Y(p)):(x.moveTo(px,Y(p)),s=true)});x.stroke();x.lineWidth=1});
if(t)[['Entry',t.entry,'#ffffff'],['SL',t.sl,'#ef5350'],['TP1',t.tp1,'#26a69a'],['TP2',t.tp2,'#66bb6a']].forEach(([n,p,col])=>{
x.strokeStyle=col;x.setLineDash([5,4]);x.beginPath();x.moveTo(0,Y(p));x.lineTo(W-pw,Y(p));x.stroke();x.setLineDash([]);x.fillStyle=col;x.fillText(n,4,Y(p)-3)});
x.fillStyle='#d4af37';x.fillText('EMA20',4,12);x.fillStyle='#4fc3f7';x.fillText('EMA50',50,12)}

function sessions(){const h=new Date().getUTCHours()+new Date().getUTCMinutes()/60,L=n=>String((n+2)%24).padStart(2,'0')+':00';
const S2=[['آسيا',0,9],['أوروبا',7,16],['أمريكا',13,22]];$('sessions').innerHTML='';
S2.forEach(([n,a,b])=>{const on=marketOpen(new Date())&&h>=a&&h<b,d=document.createElement('div');d.className='ses'+(on?' on':'');
d.textContent=n+(on?' ● نشطة':'');const s=document.createElement('span');s.textContent=L(a)+' – '+L(b);d.appendChild(s);$('sessions').appendChild(d)})}
function tick1s(){const n=new Date(),sec=TFS[S.tf],rem=Math.ceil(sec-(n.getTime()/1000)%sec);
$('timer').textContent=String(Math.floor(rem/60)).padStart(2,'0')+':'+String(rem%60).padStart(2,'0');$('clock').textContent=libya(n)}

document.querySelectorAll('.tf button').forEach(b=>b.onclick=()=>{S.tf=b.dataset.tf;save();prevSig=null;load()});
$('refresh').onclick=load;
$('cap').value=S.cap;$('risk').value=S.risk;$('riskV').textContent=S.risk;$('cs').value=S.cs;$('notify').checked=S.notify;
$('cap').oninput=e=>{S.cap=e.target.value;save();calc(res&&res.trade)};
$('risk').oninput=e=>{S.risk=e.target.value;$('riskV').textContent=S.risk;save();calc(res&&res.trade)};
$('cs').oninput=e=>{S.cs=e.target.value;save();calc(res&&res.trade)};
$('notify').onchange=e=>{S.notify=e.target.checked;save();if(S.notify&&window.Notification&&Notification.permission==='default')Notification.requestPermission()};
window.addEventListener('online',load);window.addEventListener('offline',load);window.addEventListener('resize',()=>draw(res&&res.trade));
$('clearLog').onclick=()=>{if(confirm('مسح السجل؟')){LOG=[];saveLog();renderLog()}};renderLog();sessions();tick1s();setInterval(tick1s,1000);setInterval(sessions,60000);setInterval(load,15000);setInterval(fast,1000);load()}
