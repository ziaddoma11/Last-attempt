'use strict';
const API='https://biquote.io/api/XAUUSD';
const TWIN='XAGUSD';
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
function analyze(cs,price,tfSec,now,open,htf,twin,mode,gate){
const out={signal:'WAIT',reasons:[],score:null,trade:null,ind:null,setup:''};
if(!cs||cs.length<60){out.reasons.push('بيانات الشموع ناقصة (أقل من 60 شمعة)');return out}
if(!Number.isFinite(price)){out.reasons.push('السعر الحالي غير متوفر');return out}
const d=decideAny(cs,price,htf,twin,mode||'classic');if(!d){out.reasons.push('تعذر حساب المؤشرات');return out}
out.ind=d.ind;out.votes=d.votes;out.setup=d.setup;const A=d.ind.atr;
if(!open){out.reasons.push('السوق مغلق (تقديري)');return out}
const age=now-cs[cs.length-1].t;if(age>tfSec*1000*3){out.reasons.push('البيانات قديمة: آخر شمعة قبل '+Math.round(age/60000)+' دقيقة');return out}
if(Math.abs(price-cs[cs.length-1].c)>2*A){out.reasons.push('تضارب: السعر الحالي بعيد عن آخر شمعة');return out}
out.signal=d.sig;out.setup=d.setup;out.trade=d.trade;out.score=d.sig==='WAIT'?null:d.conf;
out.reasons=d.why;
if(out.signal!=='WAIT'&&gate&&gate.min>0&&gate.bt){const b=gate.bt;
if(b.n>=5){const wr=Math.round(b.w/b.n*100);if(wr<gate.min){out.signal='WAIT';out.trade=null;out.score=null;out.reasons=['فلتر الأداء: نسبة النجاح التاريخية لهذه الاستراتيجية '+wr+'% (من '+b.n+' صفقة) أقل من الحد '+gate.min+'%، فلا إشارة.']}
else out.reasons=['نسبة النجاح التاريخية '+wr+'% من '+b.n+' صفقة (اختبار رجعي، لا يضمن المستقبل)'].concat(out.reasons)}
else out.reasons=['تنبيه: عينة الاختبار الرجعي صغيرة ('+b.n+' صفقة)، النسبة غير موثقة'].concat(out.reasons)}
return out}
function backtest(cs,mode){let w=0,l=0,o=0,i=60;
while(i<cs.length-1){const d=decideAny(cs.slice(0,i+1),cs[i].c,null,null,mode||'classic');
if(d&&d.sig!=='WAIT'){const t=d.trade,B=d.sig==='BUY';let r=null;
for(let j=i+1;j<cs.length&&j<=i+30;j++){const k=cs[j],sl=B?k.l<=t.sl:k.h>=t.sl,tp=B?k.h>=t.tp1:k.l<=t.tp1;
if(sl){r='L';i=j;break}if(tp){r='W';i=j;break}}
if(r==='W')w++;else if(r==='L')l++;else{o++;i+=30}}
i++}
return{w,l,o,n:w+l}}

/* ---------- SMC: هيكل، سيولة، FVG/iFVG، OB، فيبو، CISD، SMT ---------- */
function swings(cs,k=3){const H=[],L=[];for(let i=k;i<cs.length-k;i++){let h=true,l=true;
for(let j=1;j<=k;j++){if(cs[i].h<=cs[i-j].h||cs[i].h<=cs[i+j].h)h=false;if(cs[i].l>=cs[i-j].l||cs[i].l>=cs[i+j].l)l=false}
if(h)H.push({i,p:cs[i].h});if(l)L.push({i,p:cs[i].l})}return{H,L}}
function smt(cs,tw){if(!tw||tw.length<30)return 0;const m=new Map(tw.map(x=>[x.t,x])),g=cs.slice(-30).filter(x=>m.has(x.t));
if(g.length<24)return 0;const s=g.map(x=>m.get(x.t)),c=g.length-8,mx=(a,f)=>Math.max(...a.map(f)),mn=(a,f)=>Math.min(...a.map(f));
const gh=mx(g.slice(c),x=>x.h)>mx(g.slice(0,c),x=>x.h),sh=mx(s.slice(c),x=>x.h)>mx(s.slice(0,c),x=>x.h);
const gl=mn(g.slice(c),x=>x.l)<mn(g.slice(0,c),x=>x.l),sl=mn(s.slice(c),x=>x.l)<mn(s.slice(0,c),x=>x.l);
return gh&&!sh?-1:gl&&!sl?1:0}
function smc(cs,price,A,twin){
const k=3,n=cs.length-1,{H,L}=swings(cs,k);let st=0,ev=[],bH=-1,bL=-1;
for(let t=k+1;t<=n-1;t++){const sh=H.filter(x=>x.i+k<=t).pop(),sl=L.filter(x=>x.i+k<=t).pop();
if(sh&&sh.i!==bH&&cs[t].c>sh.p){ev.push({t,dir:1,lvl:sh.p,li:sh.i,type:st===-1?'CHoCH':'BOS',oi:sl?sl.i:Math.max(0,t-5)});bH=sh.i;st=1}
else if(sl&&sl.i!==bL&&cs[t].c<sl.p){ev.push({t,dir:-1,lvl:sl.p,li:sl.i,type:st===1?'CHoCH':'BOS',oi:sh?sh.i:Math.max(0,t-5)});bL=sl.i;st=-1}}
const h2=H.slice(-2),l2=L.slice(-2),struct=h2.length===2&&l2.length===2?(h2[1].p>h2[0].p&&l2[1].p>l2[0].p?'HH/HL صاعد':h2[1].p<h2[0].p&&l2[1].p<l2[0].p?'LH/LL هابط':'متذبذب'):'—';
const cc=cs.map(x=>x.c),E20=ema(cc,20)[n],E50=ema(cc,50)[n],emaV=E20>E50?1:E20<E50?-1:0;
const e=ev[ev.length-1],fresh=!!e&&n-e.t<=40,d=fresh?e.dir:0,sv=smt(cs,twin);
let sweep=null;for(let j=n-1;j>=Math.max(k+1,n-30)&&!sweep;j--){
for(const s of H)if(s.i+k<=j-1&&cs[j].h>s.p&&cs[j].c<s.p){sweep={j,dir:-1,lvl:s.p,wick:cs[j].h};break}
if(!sweep)for(const s of L)if(s.i+k<=j-1&&cs[j].l<s.p&&cs[j].c>s.p){sweep={j,dir:1,lvl:s.p,wick:cs[j].l};break}}
const fv=[];for(let i=Math.max(2,n-60);i<=n-1;i++){let f=null;
if(cs[i-2].h<cs[i].l)f={dir:1,lo:cs[i-2].h,hi:cs[i].l};else if(cs[i-2].l>cs[i].h)f={dir:-1,lo:cs[i].h,hi:cs[i-2].l};
if(!f)continue;f.i=i;let ok=true;for(let m=i+1;m<=n-1;m++){
if(f.dir===1){if(cs[m].c<f.lo){f.dir=-1;f.inv=true}else if(!f.inv&&cs[m].l<f.lo){ok=false;break}}
else{if(cs[m].c>f.hi){f.dir=1;f.inv=true}else if(!f.inv&&cs[m].h>f.hi){ok=false;break}}}
if(ok)fv.push(f)}
let ob=null,leg=null;
if(fresh){const oi=Math.max(0,e.oi),opp=j=>d===1?cs[j].c<cs[j].o:cs[j].c>cs[j].o;let q=oi;
for(let j=oi;j<e.t;j++){if(opp(j)&&j+1<=e.t&&Math.abs(cs[j+1].c-cs[j+1].o)>=0.6*A&&(d===1?cs[j+1].c>cs[j+1].o:cs[j+1].c<cs[j+1].o)){q=j;break}}
ob={lo:cs[q].l,hi:cs[q].h,q};
for(let j=e.t;j<=n-1;j++)if(d===1?cs[j].c<ob.lo:cs[j].c>ob.hi){ob=null;break}
const sl2=cs.slice(oi,n+1);const o=d===1?cs[oi].l:cs[oi].h,ext=d===1?Math.max(...sl2.map(x=>x.h)):Math.min(...sl2.map(x=>x.l)),sz=Math.abs(ext-o);
if(sz>1.5*A)leg={o,ext,sz,z1:d===1?ext-0.786*sz:ext+0.5*sz,z2:d===1?ext-0.5*sz:ext+0.786*sz}}
const tol=0.1*A,obHit=!!(ob&&price>=ob.lo-tol&&price<=ob.hi+tol&&(d===1?price>ob.lo-0.3*A:price<ob.hi+0.3*A));
const fz=fv.find(f=>f.dir===d&&price>=f.lo-tol&&price<=f.hi+tol),fvgHit=!!(d&&fz),fibHit=!!(leg&&price>=leg.z1&&price<=leg.z2);
let cisd=false;if(d&&n>=4){const c=cs[n-1];if(d===1){let j=n-2;while(j>0&&cs[j].c<cs[j].o)j--;cisd=c.c>c.o&&(j<n-2?c.c>cs[j+1].o:(c.c-c.o)>=0.2*A)}
else{let j=n-2;while(j>0&&cs[j].c>cs[j].o)j--;cisd=c.c<c.o&&(j<n-2?c.c<cs[j+1].o:(c.o-c.c)>=0.2*A)}}
const sw=!!(sweep&&sweep.dir===d&&d),sm=sv===d&&d!==0,body=cs[n-1].c-cs[n-1].o;
const votes=[{n:'هيكل السوق: '+struct,v:struct.includes('صاعد')?1:struct.includes('هابط')?-1:0},
{n:'آخر كسر: '+(e?e.type+(e.dir>0?' صاعد':' هابط'):'—'),v:fresh?e.dir:0},
{n:'سحب السيولة '+(sweep?(sweep.dir>0?'SSL':'BSL'):'—'),v:sweep?sweep.dir:0},
{n:'Order Block',v:obHit?d:0},{n:'FVG / iFVG',v:fvgHit?d:0},{n:'فيبوناتشي 0.5–0.786',v:fibHit?d:0},{n:'CISD',v:cisd?d:0},{n:'SMT (XAGUSD)',v:sv},{n:'فلتر EMA20/50',v:emaV}];
const info={struct,last:e?e.type+(e.dir>0?' صاعد':' هابط')+(fresh?'':' (قديم)'):'—',sweep:sweep?(sweep.dir>0?'SSL @':'BSL @')+sweep.lvl.toFixed(1):'—',
ob:ob?ob.lo.toFixed(1)+'–'+ob.hi.toFixed(1):'—',fvg:fz?(fz.inv?'iFVG ':'FVG ')+fz.lo.toFixed(1)+'–'+fz.hi.toFixed(1):'—',smt:twin?(sv>0?'صاعد':sv<0?'هابط':'لا تباعد'):'غير متاح'};
info.z={fv:fv.slice(-4),ob:ob&&{lo:ob.lo,hi:ob.hi,q:ob.q},leg:leg&&{z1:leg.z1,z2:leg.z2},ev:ev.slice(-3),H:H.slice(-3),L:L.slice(-3),sweep:sweep&&{j:sweep.j,dir:sweep.dir,wick:sweep.wick}};
const out={sig:'WAIT',setup:'SMC: '+struct,why:[],trade:null,conf:0,votes,info};
if(!fresh){out.why=['لا يوجد كسر هيكل حديث (BOS/CHoCH)'];return out}
const mk=(ep,sl0)=>{let slp=sl0,risk=Math.abs(ep-slp);if(risk<0.5*A){risk=0.5*A;slp=ep-d*risk}if(risk>3*A)return null;
const sz=leg?leg.sz:risk*2,o=leg?leg.o:ep,f14=o+d*1.414*sz;let tp1=o+d*1.272*sz,s1='فيبو 1.272';
if((tp1-ep)*d<1.5*risk){const blk=(d===1?H:L).map(x=>x.p).filter(p=>(p-ep)*d>0).sort((a,b)=>d===1?a-b:b-a)[0];
if(blk!=null&&(blk-ep)*d<1.5*risk)return null;tp1=ep+d*1.5*risk;s1='R/R 1:1.5'}
const dol=(d===1?H:L).map(x=>x.p).filter(p=>(p-tp1)*d>0).sort((a,b)=>d===1?a-b:b-a)[0];
let tp2=dol!=null?dol:f14,s2=dol!=null?'سيولة DOL':'فيبو 1.414';
if((tp2-ep)*d<2.5*risk){tp2=ep+d*2.5*risk;s2='R/R 1:2.5'}
return{entry:ep,sl:slp,tp1,tp2,risk,s1,s2,rr1:(tp1-ep)*d/risk,rr2:(tp2-ep)*d/risk}};
const modelA=obHit&&(fvgHit||cisd),modelB=fibHit&&cisd,entryOk=modelA||modelB;
const pts=1+(sw?1:0)+(obHit?1:0)+(fvgHit?1:0)+(fibHit?1:0)+(cisd?1:0)+(sm?1:0);out.conf=pts/7;
out.setup='SMC: '+e.type+(d>0?' صاعد':' هابط')+' · نقاط '+pts+'/7';
if(!entryOk){const zs=[];if(ob&&(d===1?ob.hi<price:ob.lo>price))zs.push({k:'Order Block',lo:ob.lo,hi:ob.hi});
fv.filter(f=>f.dir===d&&(d===1?f.hi<price:f.lo>price)).slice(-1).forEach(f=>zs.push({k:f.inv?'iFVG':'FVG',lo:f.lo,hi:f.hi}));
if(leg&&(d===1?leg.z2<price:leg.z1>price))zs.push({k:'فيبو 0.5–0.786',lo:Math.min(leg.z1,leg.z2),hi:Math.max(leg.z1,leg.z2)});
zs.sort((a,b)=>Math.abs((a.lo+a.hi)/2-price)-Math.abs((b.lo+b.hi)/2-price));const z=zs[0];
if(z&&emaV===d){const tr=mk((z.lo+z.hi)/2,d===1?z.lo-0.15*A:z.hi+0.15*A);if(tr)out.info.watch=Object.assign({dir:d,k:z.k,lo:z.lo,hi:z.hi},tr)}
out.why=['بانتظار عودة السعر لمنطقة الدخول: OB مع FVG/CISD أو فيبو 0.5–0.786 مع CISD'];return out}
if(!(d===1?body>0:body<0)){out.why=['شمعة التأكيد عكس الاتجاه'];return out}
if(pts<4){out.why=['توافق SMC غير كافٍ ('+pts+'/7)'];return out}
if(emaV!==d){out.why=['فلتر EMA20/50: اتجاه المتوسطات لا يوافق الصفقة'];return out}
const R2=[];if(obHit)R2.push(d===1?ob.lo:ob.hi);if(fvgHit)R2.push(d===1?fz.lo:fz.hi);if(fibHit)R2.push(d===1?leg.z1:leg.z2);if(sw)R2.push(sweep.wick);R2.push(d===1?cs[n-1].l:cs[n-1].h);
const slp=d===1?Math.min(...R2)-0.15*A:Math.max(...R2)+0.15*A,tr=mk(price,slp);
if(!tr){out.why=['الوقف المرجعي بعيد (أكثر من 3 ATR) أو الهدف 1.272 قريب (R/R أقل من 1)'];return out}
out.sig=d===1?'BUY':'SELL';out.trade=tr;
out.why=votes.filter(v=>v.v===d).map(v=>v.n).concat(['SL خلف منطقة الدخول/القاع المرجعي','TP1 = '+tr.s1+'، TP2 = '+tr.s2+' ('+tr.tp2.toFixed(1)+')']);
return out}
function decideAny(cs,price,htf,twin,mode){const cl=decide(cs,price,htf);if(!cl||mode==='classic')return cl;
const sm=smc(cs,price,cl.ind.atr,twin);cl.ind.smc=sm.info;
if(mode==='smc'||sm.sig!=='WAIT')return{sig:sm.sig,setup:sm.setup,why:sm.why,trade:sm.trade,conf:sm.conf,ind:cl.ind,votes:sm.votes};return cl}

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

if(typeof module!=='undefined')module.exports={ema,rsi,atr,levels,analyze,decide,decideAny,smc,swings,backtest,parseCandles,parseTick,marketOpen};

/* ---------- الواجهة ---------- */
if(typeof document!=='undefined'){
const $=id=>document.getElementById(id);
const S=Object.assign({tf:'5m',mode:'smc',minwr:70,cs:'100',txt:1,lay:{fvg:1,ob:1,liq:1,bos:1,fib:0,ema:1},cap:30,risk:2,cs:'',notify:false},JSON.parse((()=>{try{return localStorage.getItem('gatp')||'{}'}catch(e){return'{}'}})()));
const save=()=>{try{localStorage.setItem('gatp',JSON.stringify(S))}catch(e){}};
let lastT=null,candles=[],twinC=null,htf=null,bt=null,tick=null,res=null,prevSig=null,lastOk=null,netErr=null;
const f=(v,d=2)=>Number.isFinite(v)?v.toFixed(d):'--';
const libya=d=>d.toLocaleTimeString('en-GB',{timeZone:'Africa/Tripoli',hour:'2-digit',minute:'2-digit',second:'2-digit'});

async function getJSON(u){const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
async function load(){
try{const [t,c]=await Promise.all([getJSON(API),getJSON(API+'/ohlc?interval='+S.tf+'&limit=300').catch(()=>getJSON(API+'/ohlc?interval='+S.tf+'&limit=180'))]);
tick=parseTick(t);candles=parseCandles(c);lastOk=Date.now();netErr=null;htf=null;
if(S.tf==='5m'){try{const h=parseCandles(await getJSON(API+'/ohlc?interval=15m&limit=180')).map(k=>k.c),a=ema(h,20).pop(),b=ema(h,50).pop();
if(a!=null&&b!=null)htf=a>b&&h[h.length-1]>b?'up':a<b&&h[h.length-1]<b?'down':'flat'}catch(e){htf=null}}
try{twinC=parseCandles(await getJSON('https://biquote.io/api/'+TWIN+'/ohlc?interval='+S.tf+'&limit=180'))}catch(e){twinC=null}}
catch(e){netErr=navigator.onLine?'تعذر جلب البيانات: '+e.message+' (قد يكون المصدر متوقفاً أو يمنع الطلبات من المتصفح CORS). لا تُعرض أسعار بديلة وهمية.':'لا يوجد اتصال بالإنترنت.'}
bt=candles.length?backtest(candles,S.mode):null;compute();render()}
let busy=false;
async function fast(){if(busy||netErr&&!candles.length)return;busy=true;
try{tick=parseTick(await getJSON(API));lastOk=Date.now();netErr=null;
const k=candles[candles.length-1];if(k&&Date.now()<k.t+TFS[S.tf]*1000){k.c=tick.price;k.h=Math.max(k.h,tick.price);k.l=Math.min(k.l,tick.price)}
compute();render()}catch(e){netErr=navigator.onLine?'انقطع تحديث السعر: '+e.message:'لا يوجد اتصال بالإنترنت.';compute();render()}finally{busy=false}}
function compute(){if(netErr||!tick||!candles.length){res=null;return}
res=analyze(candles,tick.price,TFS[S.tf],Date.now(),marketOpen(new Date()),htf,twinC,S.mode,{bt,min:+S.minwr});
logUpdate()}
let LOG=[];try{LOG=JSON.parse(localStorage.getItem('gatp_log')||'[]')}catch(e){}
const saveLog=()=>{try{localStorage.setItem('gatp_log',JSON.stringify(LOG.slice(-200)))}catch(e){}};
function stepSize(){const v=candles.slice(-21);let t=0;for(let i=1;i<v.length;i++)t+=Math.abs(v[i].c-v[i-1].c);return t/Math.max(1,v.length-1)}
const etaN=d=>Math.min(36,Math.max(3,Math.ceil((d/(stepSize()||1))**2)));
let sc=0,lastS='';
function logUpdate(){if(!res||!tick||!candles.length)return;
LOG.forEach(e=>{if(!e.r&&(e.mode||'classic')!==S.mode)e.r='T'});
LOG.forEach(e=>{if(e.r)return;if(!e.exitBy){e.r='T';return}const B=e.sig==='BUY',chk=(h,l)=>{if(e.r)return;const sl=B?l<=e.sl:h>=e.sl,tp=B?h>=e.tp1:l<=e.tp1;if(sl)e.r='L';else if(tp)e.r='W'};
candles.forEach(k=>{if(k.t>e.t0)chk(k.h,k.l)});chk(tick.price,tick.price);if(!e.r&&Date.now()>e.exitBy)e.r='T'});
if(res.signal===lastS)sc++;else{sc=1;lastS=res.signal}
const key=candles.length>1?candles[candles.length-2].t:0;
if(res.signal!=='WAIT'&&res.trade&&!LOG.some(e=>!e.r)&&sc>=3&&!LOG.some(e=>e.key===key&&e.tf===S.tf)){const t=res.trade,T=TFS[S.tf]*1000;
LOG.push({mode:S.mode,key,tf:S.tf,t0:candles[candles.length-1].t,at:Date.now(),sig:res.signal,setup:res.setup,entry:t.entry,sl:t.sl,tp1:t.tp1,tp2:t.tp2,rr1:t.rr1,rr2:t.rr2,why:res.reasons.slice(),enterUntil:Date.now()+3*T,e1:etaN(Math.abs(t.tp1-t.entry)),e2:etaN(Math.abs(t.tp2-t.entry)),exitBy:Date.now()+Math.min(36,Math.max(6,Math.ceil(etaN(Math.abs(t.tp2-t.entry))*1.5)))*T,r:null});alertSig(res.signal)}
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
return{signal:p.sig,setup:p.setup+' · مثبّتة منذ '+lt(p.at),reasons:['الحالة: '+st,'الخروج: عند TP1/TP2 أو الوقف، وإلا خروج زمني عند '+lt(p.exitBy)].concat(p.e1?['المدة المتوقعة (تقدير إحصائي من حركة آخر 20 شمعة): TP1 ≈ '+lt(p.at+p.e1*TFS[p.tf]*1000)+' · TP2 ≈ '+lt(p.at+p.e2*TFS[p.tf]*1000)]:[]).concat(p.why||[]),score:null,
trade:{entry:p.entry,sl:p.sl,tp1:p.tp1,tp2:p.tp2,rr1:p.rr1||1.5,rr2:p.rr2||2.5},ind:r.ind,votes:r.votes}}
function narrate(r,plan){const m=res&&res.ind&&res.ind.smc;if(S.mode==='classic'||!m)return 'اختر وضع SMC من القائمة لعرض تحليل المحلل المؤسسي.';
const L=['الهيكل: '+m.struct+' · آخر كسر: '+m.last+'.','السيولة: '+(m.sweep!=='—'?'تم سحب '+m.sweep:'لا يوجد سحب سيولة حديث')+'.','المناطق: OB '+m.ob+' · FVG/iFVG '+m.fvg+' · SMT '+m.smt+'.'];
if(plan){L.push('التنفيذ: '+(plan.sig==='BUY'?'شراء':'بيع')+' عند '+plan.entry.toFixed(2)+'، نافذة الدخول حتى '+lt(plan.enterUntil)+' (ليبيا).');
L.push('الخروج: عند TP1 '+plan.tp1.toFixed(2)+' أغلق جزءاً وحرّك الوقف للدخول، والباقي عند TP2 '+plan.tp2.toFixed(2)+'. الوقف '+plan.sl.toFixed(2)+'. وإن لم يتحقق شيء فاخرج عند '+lt(plan.exitBy)+'.'+(plan.e1?' المدة المتوقعة: TP1 ≈ '+lt(plan.at+plan.e1*TFS[plan.tf]*1000)+'، TP2 ≈ '+lt(plan.at+plan.e2*TFS[plan.tf]*1000)+'.':''))}
else if(m.watch){const w=m.watch,B=w.dir>0;L.push('السيناريو: '+(B?'شراء':'بيع')+' محتمل. ينتظر المحلل عودة السعر إلى '+w.k+' ('+w.lo.toFixed(2)+' – '+w.hi.toFixed(2)+').');
L.push('أمر معلّق مقترح: '+(B?'BUY LIMIT':'SELL LIMIT')+' عند '+w.entry.toFixed(2)+' · SL '+w.sl.toFixed(2)+' · TP1 '+w.tp1.toFixed(2)+' · TP2 '+w.tp2.toFixed(2)+' (R/R 1:'+w.rr1.toFixed(1)+').');
L.push('ألغِ الأمر إن لم يُنفَّذ حتى '+lt(Date.now()+12*TFS[S.tf]*1000)+' أو إذا أغلقت شمعة '+(B?'تحت ':'فوق ')+(B?w.lo:w.hi).toFixed(2)+'.')}
else L.push('السيناريو: لا توجد منطقة دخول واضحة الآن. الأفضل الانتظار.');
return L.join('\n')}
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
$('score').textContent=r.setup||'--';$('verdict').textContent=verdict(r,plan);$('analyst').textContent=narrate(r,plan);
$('votes').innerHTML='';(r.votes||[]).forEach(v=>{const d=document.createElement('div');d.className='ses';d.textContent=v.n;const x=document.createElement('span');x.textContent=v.v>0?'▲ شراء':v.v<0?'▼ بيع':'— محايد';x.style.color=v.v>0?'#26a69a':v.v<0?'#ef5350':'#777';d.appendChild(x);$('votes').appendChild(d)});
$('bt').textContent=bt?(bt.n?'اختبار رجعي على آخر '+candles.length+' شمعة: '+bt.n+' صفقة، بلغت TP1 قبل الوقف في '+bt.w+' ('+Math.round(bt.w/bt.n*100)+'%). عينة صغيرة، لا تضمن المستقبل. نقطة التعادل لهذا R/R حوالي 40%.':'الاختبار الرجعي: لم تظهر صفقات في البيانات المتاحة.'):'';
$('reasons').innerHTML='';r.reasons.forEach(t=>{const li=document.createElement('li');li.textContent=t;$('reasons').appendChild(li)});
const t=r.trade;$('entry').textContent=t?f(t.entry):'--';$('sl').textContent=t?f(t.sl):'--';$('tp1').textContent=t?f(t.tp1):'--';
$('tp2').textContent=t?f(t.tp2):'--';$('rr1').textContent=t?'1 : '+(+t.rr1).toFixed(2):'--';$('rr2').textContent=t?'1 : '+(+t.rr2).toFixed(2):'--';
const i=r.ind;$('ind').innerHTML='';
if(i)[['EMA 20',f(i.ema20)],['EMA 50',f(i.ema50)],['RSI 14',f(i.rsi,1)],['ATR 14',f(i.atr)],['الاتجاه',i.trend],['اتجاه 15د',{up:'صاعد',down:'هابط',flat:'عرضي'}[i.htf]||'—'],['الزخم',i.mom],
['الدعم',i.sup!=null?f(i.sup):'—'],['المقاومة',i.res!=null?f(i.res):'—'],['اتجاه الشمعة',i.body>0?'صاعدة':'هابطة'],['حجم الشمعة',f(i.bodyAtr,2)+' ATR']].concat(i.smc?[['هيكل SMC',i.smc.struct],['آخر كسر',i.smc.last],['سحب السيولة',i.smc.sweep],['Order Block',i.smc.ob],['FVG/iFVG',i.smc.fvg],['SMT (XAGUSD)',i.smc.smt]]:[])
.forEach(([k,v])=>{const d=document.createElement('div');d.textContent=k;const b=document.createElement('b');b.textContent=v;d.appendChild(b);$('ind').appendChild(d)});
lastT=t;calc(t);redraw()}

function calc(t){const cap=+S.cap,rk=+S.risk,rusd=cap*rk/100,rows=[['مبلغ المخاطرة','$'+f(rusd)],['أقصى خسارة','-$'+f(rusd)],
['ربح TP1',t?'+$'+f(rusd*t.rr1):'--'],['ربح TP2',t?'+$'+f(rusd*t.rr2):'--']];
const cs=+S.cs;let lot='يلزم إدخال حجم العقد';
if(t&&cs>0){const dist=Math.abs(t.entry-t.sl),raw=rusd/(dist*cs);lot=raw>=0.01?f(raw,2)+' لوت':'0.01 لوت (أدنى حجم) · الخسارة الفعلية عند الوقف $'+f(0.01*dist*cs)}else if(!t&&cs>0)lot='بانتظار إشارة';
rows.push(['حجم اللوت',lot]);$('calc').innerHTML='';
rows.forEach(([k,v])=>{const d=document.createElement('div');d.textContent=k;const b=document.createElement('b');b.textContent=v;d.appendChild(b);$('calc').appendChild(d)})}

function verdict(r,plan){const m=res&&res.ind&&res.ind.smc;
if(netErr)return 'تعذر جلب البيانات حالياً';
if(!marketOpen(new Date()))return 'السوق مغلق الآن. يعمل التحليل تلقائياً عند فتحه.';
if(plan)return (plan.sig==='BUY'?'شراء':'بيع')+' · Entry '+plan.entry.toFixed(2)+' · SL '+plan.sl.toFixed(2)+' · TP1 '+plan.tp1.toFixed(2);
if(m&&m.watch)return 'انتظار: راقب '+m.watch.k+' عند '+m.watch.lo.toFixed(1)+'–'+m.watch.hi.toFixed(1)+' لإشارة '+(m.watch.dir>0?'شراء':'بيع');
return 'لا توجد فرصة واضحة الآن، الأفضل الانتظار.'}
const view={n:70,shift:0};let fsOpen=false;
function redraw(){draw(lastT);if(fsOpen)draw(lastT,$('chartFS'))}
function draw(t,cv){cv=cv||$('chart');const dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight||320;if(!W)return;
cv.width=W*dpr;cv.height=H*dpr;const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
if(!candles.length||netErr){x.fillStyle='#777';x.font='14px sans-serif';x.textAlign='center';x.fillText('لا توجد بيانات للعرض',W/2,H/2);return}
const len=candles.length,N=Math.max(20,Math.min(view.n,len));view.n=N;view.shift=Math.max(0,Math.min(view.shift,len-N));
const end=len-view.shift,off=end-N,v=candles.slice(off,end),c=candles.map(k=>k.c),e20=ema(c,20).slice(off,end),e50=ema(c,50).slice(off,end);
let hi=Math.max(...v.map(k=>k.h)),lo=Math.min(...v.map(k=>k.l));
if(t)[t.sl,t.tp1,t.tp2,t.entry].forEach(p=>{hi=Math.max(hi,p);lo=Math.min(lo,p)});
const pad=(hi-lo)*.06||1;hi+=pad;lo-=pad;const pw=56,R=W-pw,H2=H-18,cw=R/N,Y=p=>H2-(p-lo)/(hi-lo)*H2,X=i=>(i-off)*cw+cw/2,L=S.lay,TX=S.txt!==0;
x.font='10px sans-serif';x.textAlign='left';x.fillStyle='#777';x.strokeStyle='#222';x.lineWidth=1;
for(let g=0;g<=5;g++){const p=lo+(hi-lo)*g/5;x.beginPath();x.moveTo(0,Y(p));x.lineTo(R,Y(p));x.stroke();x.fillText(p.toFixed(1),R+4,Y(p)+3)}
for(let g=0;g<4;g++){const i=Math.floor(g*(N-1)/3),k=v[i];if(k)x.fillText(lt(k.t),Math.min(R-30,Math.max(0,X(off+i)-14)),H-4)}
const sm=res&&res.ind&&res.ind.smc&&S.mode!=='classic'?res.ind.smc:null,px=tick?tick.price:v[v.length-1].c;
if(sm&&sm.z){const z=sm.z;
const box=(a,b,i0,fill,stroke,label)=>{const y1=Math.max(0,Y(b)),y2=Math.min(H2,Y(a));if(y2<=y1)return;const x0=Math.max(0,X(i0)-cw/2);if(x0>=R)return;
x.fillStyle=fill;x.fillRect(x0,y1,R-x0,y2-y1);if(stroke){x.strokeStyle=stroke;x.setLineDash([3,3]);x.strokeRect(x0,y1,R-x0,y2-y1);x.setLineDash([])}
x.fillStyle=stroke||'#bbb';x.font='9px sans-serif';x.textAlign='left';if(TX&&y2-y1>11)x.fillText(label,x0+3,y1+10)};
if(L.fib&&z.leg)box(Math.min(z.leg.z1,z.leg.z2),Math.max(z.leg.z1,z.leg.z2),off,'rgba(212,175,55,.10)','#d4af37','فيبو 0.5–0.786');
if(L.fvg)z.fv.forEach(f=>box(f.lo,f.hi,f.i-2,f.dir>0?'rgba(38,166,154,.18)':'rgba(239,83,80,.18)',f.inv?'#b388ff':null,f.inv?'iFVG':'FVG'));
if(L.ob&&z.ob)box(z.ob.lo,z.ob.hi,z.ob.q,'rgba(79,195,247,.20)','#4fc3f7','OB');
if(sm.watch)box(sm.watch.lo,sm.watch.hi,off,'rgba(255,255,255,.07)','#ffffff','مراقبة '+sm.watch.k);
if(L.liq){const a=z.H.filter(s=>s.p>px).sort((p,q)=>p.p-q.p)[0],b=z.L.filter(s=>s.p<px).sort((p,q)=>q.p-p.p)[0];
[[a,'BSL'],[b,'SSL']].forEach(([s,lab])=>{if(!s||s.p<lo||s.p>hi)return;x.strokeStyle='#ff9800';x.setLineDash([2,3]);x.beginPath();x.moveTo(Math.max(0,X(s.i)),Y(s.p));x.lineTo(R,Y(s.p));x.stroke();x.setLineDash([]);
if(TX){x.fillStyle='#ff9800';x.font='10px sans-serif';x.textAlign='right';x.fillText(lab+' '+s.p.toFixed(1),R-3,Y(s.p)-3);x.textAlign='left'}});
if(z.sweep&&z.sweep.j>=off&&z.sweep.j<end){const sx=X(z.sweep.j),sy=Y(z.sweep.wick),u=z.sweep.dir>0?1:-1;x.fillStyle='#ff9800';x.beginPath();x.arc(sx,sy+6*u,4,0,6.3);x.fill();if(TX){x.font='bold 10px sans-serif';x.fillText('Sweep',sx-14,sy+(u>0?20:-12))}}}
if(L.bos)z.ev.slice(-2).forEach(e=>{if(e.li<off||e.t>=end||e.lvl<lo||e.lvl>hi)return;const col=e.dir>0?'#26a69a':'#ef5350';x.strokeStyle=col;x.beginPath();x.moveTo(X(e.li),Y(e.lvl));x.lineTo(X(e.t),Y(e.lvl));x.stroke();
if(TX){x.fillStyle=col;x.font='bold 10px sans-serif';x.fillText(e.type,(X(e.li)+X(e.t))/2-10,Y(e.lvl)+(e.dir>0?-3:11))}})}
v.forEach((k,i)=>{const cx=i*cw+cw/2,up=k.c>=k.o;x.strokeStyle=x.fillStyle=up?'#26a69a':'#ef5350';
x.beginPath();x.moveTo(cx,Y(k.h));x.lineTo(cx,Y(k.l));x.stroke();x.fillRect(cx-cw*.35,Math.min(Y(k.o),Y(k.c)),cw*.7,Math.max(1,Math.abs(Y(k.o)-Y(k.c))))});
if(L.ema)[[e20,'#d4af37'],[e50,'#4fc3f7']].forEach(([e,col])=>{x.strokeStyle=col;x.lineWidth=1.5;x.beginPath();let s=false;
e.forEach((p,i)=>{if(p==null)return;const q=i*cw+cw/2;s?x.lineTo(q,Y(p)):(x.moveTo(q,Y(p)),s=true)});x.stroke();x.lineWidth=1});
if(t)[['Entry',t.entry,'#ffffff'],['SL',t.sl,'#ef5350'],['TP1',t.tp1,'#26a69a'],['TP2',t.tp2,'#66bb6a']].forEach(([n,p,col])=>{
x.strokeStyle=col;x.setLineDash([5,4]);x.beginPath();x.moveTo(0,Y(p));x.lineTo(R,Y(p));x.stroke();x.setLineDash([]);x.fillStyle=col;x.font='10px sans-serif';x.textAlign='left';x.fillText(TX?n+' '+p.toFixed(2):n,4,Y(p)-3)});
const py=Y(px);if(py>0&&py<H2){x.fillStyle='#d4af37';x.fillRect(R,py-8,pw,16);x.fillStyle='#000';x.font='bold 10px sans-serif';x.fillText(px.toFixed(2),R+3,py+4)}}
const LAYDEF=[['fvg','FVG'],['ob','OB'],['liq','سيولة'],['bos','BOS/CHoCH'],['fib','فيبو'],['ema','EMA']];
function buildLayers(){const c=$('layers');c.innerHTML='';
const add=(n,on,fn)=>{const b=document.createElement('button');b.textContent=n;b.className='chip'+(on?' on':'');b.onclick=fn;c.appendChild(b)};
add('النصوص',S.txt!==0,()=>{S.txt=S.txt===0?1:0;save();buildLayers();redraw()});
LAYDEF.forEach(([k,n])=>add(n,S.lay[k],()=>{S.lay[k]=S.lay[k]?0:1;save();buildLayers();redraw()}))}
function attach(cv){const P=new Map();let d0=1,n0=70,x0=0,s0=0;cv.style.touchAction='none';
cv.addEventListener('pointerdown',e=>{try{cv.setPointerCapture(e.pointerId)}catch(_){}P.set(e.pointerId,e.clientX);
if(P.size===1){x0=e.clientX;s0=view.shift}if(P.size===2){const a=[...P.values()];d0=Math.abs(a[0]-a[1])||1;n0=view.n}});
cv.addEventListener('pointermove',e=>{if(!P.has(e.pointerId))return;P.set(e.pointerId,e.clientX);
if(P.size===2){const a=[...P.values()],d=Math.abs(a[0]-a[1])||1;view.n=Math.max(20,Math.min(160,Math.round(n0*d0/d)))}
else{const cw=(cv.clientWidth-56)/view.n;view.shift=Math.max(0,Math.min(candles.length-20,s0+Math.round((e.clientX-x0)/cw)))}redraw()});
const up=e=>{P.delete(e.pointerId);if(P.size===1){x0=[...P.values()][0];s0=view.shift}};
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('wheel',e=>{e.preventDefault();view.n=Math.max(20,Math.min(160,view.n+(e.deltaY>0?6:-6)));redraw()},{passive:false})}
async function openFS(){fsOpen=true;$('fs').hidden=false;document.body.style.overflow='hidden';
try{await document.documentElement.requestFullscreen()}catch(e){}try{await screen.orientation.lock('landscape')}catch(e){}setTimeout(redraw,200)}
function closeFS(){fsOpen=false;$('fs').hidden=true;document.body.style.overflow='';try{screen.orientation.unlock()}catch(e){}
try{if(document.fullscreenElement)document.exitFullscreen()}catch(e){}setTimeout(redraw,100)}
function initChartUI(){attach($('chart'));buildLayers()}
function sessions(){const h=new Date().getUTCHours()+new Date().getUTCMinutes()/60,L=n=>String((n+2)%24).padStart(2,'0')+':00';
const S2=[['آسيا',0,9],['أوروبا',7,16],['أمريكا',13,22]];$('sessions').innerHTML='';
S2.forEach(([n,a,b])=>{const on=marketOpen(new Date())&&h>=a&&h<b,d=document.createElement('div');d.className='ses'+(on?' on':'');
d.textContent=n+(on?' ● نشطة':'');const s=document.createElement('span');s.textContent=L(a)+' – '+L(b);d.appendChild(s);$('sessions').appendChild(d)})}
function tick1s(){const n=new Date(),sec=TFS[S.tf],rem=Math.ceil(sec-(n.getTime()/1000)%sec);
$('timer').textContent=String(Math.floor(rem/60)).padStart(2,'0')+':'+String(rem%60).padStart(2,'0');$('clock').textContent=libya(n)}

document.querySelectorAll('.tf button').forEach(b=>b.onclick=()=>{S.tf=b.dataset.tf;save();prevSig=null;load()});
$('refresh').onclick=load;$('minwr').value=S.minwr;$('minwr').onchange=e=>{S.minwr=e.target.value;save();compute();render()};$('mode').value=S.mode;$('mode').onchange=e=>{S.mode=e.target.value;save();bt=candles.length?backtest(candles,S.mode):null;compute();render()};
$('cap').value=S.cap;$('risk').value=S.risk;$('riskV').textContent=S.risk;$('cs').value=S.cs;$('notify').checked=S.notify;
$('cap').oninput=e=>{S.cap=e.target.value;save();calc(res&&res.trade)};
$('risk').oninput=e=>{S.risk=e.target.value;$('riskV').textContent=S.risk;save();calc(res&&res.trade)};
$('cs').oninput=e=>{S.cs=e.target.value;save();calc(res&&res.trade)};
$('notify').onchange=e=>{S.notify=e.target.checked;save();if(S.notify&&window.Notification&&Notification.permission==='default')Notification.requestPermission()};
window.addEventListener('online',load);window.addEventListener('offline',load);window.addEventListener('resize',()=>setTimeout(redraw,100));window.addEventListener('orientationchange',()=>setTimeout(redraw,300));
initChartUI();$('clearLog').onclick=()=>{if(confirm('مسح السجل؟')){LOG=[];saveLog();renderLog()}};renderLog();sessions();tick1s();setInterval(tick1s,1000);setInterval(sessions,60000);setInterval(load,15000);setInterval(fast,1000);load()}
