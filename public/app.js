'use strict';

/* ============ i18n ============ */
const I18N = {
  zh:{
    brand:'手游日报', brandTag:'VIGLOO · 投放数据', navOverview:'总览', navDetail:'明细',
    autoSync:'每日自动同步', updatedAt:'更新于', pageTitle:'投放总览', dataRange:'数据范围',
    fDate:'日期', today:'今日', yesterday:'昨日', p7:'7日', p14:'14日', p30:'30日', pAll:'全部', fCountry:'国家', fDevice:'设备',
    fSource:'来源', sBoth:'两者对比', fRoas:'ADJUST 回报口径',
    cMatTitle:'ADJUST 回本曲线 (D0 → D3 → D7)', cMatSub:'ROAS 随天数成熟 · 100% = 回本线 · 虚线 = 预测(乘子模型)',
    cMetaTitle:'META 回本曲线(模拟)', cMetaSub:'META 仅单值(D0);D3/D7 按 ADJUST 增长形态模拟,虚线 · 100% = 回本线',
    cMainTitle:'花费 × 每日收支比', cMainSub:'柱 = 花费(左轴) · 线 = 收支比 ROAS(右轴)',
    cBreakTitle:'花费构成', cBreakSub:'按 国家 / 设备 分段堆叠', cTableTitle:'明细数据',
    breakLine:'回本线 100%', avg:'平均', breakEven:'已回本', notBreakEven:'未回本',
    spendLabel:'总花费', revLabel:'总回收', ratioLabel:'收支比',
    footSrc:'来源:飞书「手游日报」· 每日自动抓取', footImm:'未成熟的 D3/D7 回报以 — 表示,不计入趋势线',
    kpiTotalSpend:'区间总花费 · ADJUST', kpiRevenue:'区间总回收', kpiRatio:'区间收支比', kpiD7:'最新成熟 D7 回本',
    byMetric:d=>`按 ${d} 口径`, revFromSpend:'回收 / 花费',
    daysTotal:n=>`${n} 天合计`, maturedAt:d=>`成熟于 ${d}`, noMatured:'暂无成熟数据',
    spend:'花费', tDate:'日期', tCountry:'国家', tDevice:'设备',
    tableNote:(n,a,b)=>`${n} 行 · ${a} → ${b}`, locale:'zh-CN',
  },
  ko:{
    brand:'게임 일일 리포트', brandTag:'VIGLOO · 광고 데이터', navOverview:'개요', navDetail:'상세',
    autoSync:'매일 자동 동기화', updatedAt:'업데이트', pageTitle:'광고 개요', dataRange:'데이터 범위',
    fDate:'날짜', today:'오늘', yesterday:'어제', p7:'7일', p14:'14일', p30:'30일', pAll:'전체', fCountry:'국가', fDevice:'기기',
    fSource:'소스', sBoth:'둘 다', fRoas:'ADJUST ROAS 기준',
    cMatTitle:'ADJUST 회수 곡선 (D0 → D3 → D7)', cMatSub:'ROAS 일자별 성숙 · 100% = 손익분기선 · 점선 = 예측(배수모델)',
    cMetaTitle:'META 회수 곡선 (시뮬레이션)', cMetaSub:'META 단일값(D0); D3/D7 은 ADJUST 성장형태로 시뮬레이션(점선) · 100% = 손익분기',
    cMainTitle:'지출 × 일일 수익비', cMainSub:'막대 = 지출(좌측) · 선 = 수익비 ROAS(우측)',
    cBreakTitle:'지출 구성', cBreakSub:'국가 / 기기별 누적', cTableTitle:'상세 데이터',
    breakLine:'손익분기 100%', avg:'평균', breakEven:'회수 완료', notBreakEven:'미회수',
    spendLabel:'총 지출', revLabel:'총 회수', ratioLabel:'수익비',
    footSrc:'출처: Feishu 「手游日报」· 매일 자동 수집', footImm:'미확정 D3/D7 은 — 로 표시, 추이선 제외',
    kpiTotalSpend:'기간 총 지출 · ADJUST', kpiRevenue:'기간 총 회수', kpiRatio:'기간 수익비', kpiD7:'최근 확정 D7 회수',
    byMetric:d=>`${d} 기준`, revFromSpend:'회수 / 지출',
    daysTotal:n=>`${n}일 합계`, maturedAt:d=>`확정일 ${d}`, noMatured:'확정 데이터 없음',
    spend:'지출', tDate:'날짜', tCountry:'국가', tDevice:'기기',
    tableNote:(n,a,b)=>`${n}행 · ${a} → ${b}`, locale:'ko-KR',
  },
};
const VMAP = {
  country:{'韩国':{zh:'韩国',ko:'한국'}, '台湾':{zh:'台湾',ko:'대만'}},
  device:{'安卓':{zh:'安卓',ko:'안드로이드'}, 'ios':{zh:'iOS',ko:'iOS'}},
};
let LANG = 'zh';
const t = k => { const v=I18N[LANG][k]; return v; };
const tv = (kind,val)=>{ const m=VMAP[kind]?.[val]; return m? m[LANG] : val; };

/* ============ palette (theme-independent brand colors) ============ */
const SERIES = { adjSpend:'#4578f9', adjRoas:'#f5a524', metaSpend:'#8b93a7', metaRoas:'#cb3eff' };
const SEG_COLORS = ['#4578f9','#43b430','#f5a524','#cb3eff','#7596ff','#ef4444'];
const ROAS_LABEL = {d0_roas:'D0', d3_roas:'D3', d7_roas:'D7'};

/* ============ state ============ */
let DATA=null;
const state={from:null,to:null,countries:new Set(),devices:new Set(),source:'both',roas:'d0_roas'};
const charts={};

/* ============ utils ============ */
const $=s=>document.querySelector(s);
const rawSeg=r=>`${r.country}__${r.device}`;
const segLabel=r=>`${tv('country',r.country)} · ${tv('device',r.device)}`;
const isoAdd=(iso,d)=>{const x=new Date(iso+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+d);return x.toISOString().slice(0,10);};
const fmtMoney=n=>n==null?'—':'$'+Math.round(n).toLocaleString('en-US');
const fmtRoas=n=>n==null?'—':(n*100).toFixed(2)+'%';
const cssVar=n=>getComputedStyle(document.body).getPropertyValue(n).trim();

function passFilter(r){return r.date>=state.from&&r.date<=state.to&&state.countries.has(r.country)&&state.devices.has(r.device);}
const filtered=()=>DATA.records.filter(passFilter);
function wRoas(recs,sk,rk){let n=0,d=0;for(const r of recs){const s=r[sk],v=r[rk];if(s!=null&&v!=null){n+=s*v;d+=s;}}return d>0?n/d:null;}
const sum=(recs,k)=>recs.reduce((a,r)=>a+(r[k]||0),0);
const sortedDates=recs=>[...new Set(recs.map(r=>r.date))].sort();
const round=(n,p=0)=>n==null?null:(p?Number(n.toFixed(p)):Math.round(n));

/* ============ init ============ */
fetch('data.json').then(r=>r.json()).then(d=>{
  DATA=d;
  initLang(); initTheme();
  buildControls(); applyPreset('7');
  initCharts(); applyStaticI18n(); refreshMeta(); render();
  watchTheme();
  setTimeout(()=>$('#loading').classList.add('hide'),150);
}).catch(e=>{$('#loading').textContent='加载失败 / Load failed: '+e;});

function refreshMeta(){
  $('#m-range').textContent=`${DATA.meta.date_min} → ${DATA.meta.date_max}`;
  $('#m-updated').textContent=new Date(DATA.meta.updated).toLocaleString(I18N[LANG].locale,{hour12:false});
}

/* ----- language ----- */
function initLang(){
  const q=new URLSearchParams(location.search).get('lang');
  let saved; try{saved=localStorage.getItem('sg_lang');}catch{}
  if(q==='zh'||q==='ko') LANG=q;
  else if(saved==='zh'||saved==='ko') LANG=saved;
  else LANG=(navigator.language||'').toLowerCase().startsWith('ko')?'ko':'zh';
  document.documentElement.lang = LANG==='ko'?'ko':'zh-CN';
  document.querySelectorAll('.lang-switch button').forEach(b=>{
    b.classList.toggle('on',b.dataset.lang===LANG);
    b.addEventListener('click',()=>setLang(b.dataset.lang));
  });
}
function setLang(l){
  if(l===LANG)return; LANG=l;
  try{localStorage.setItem('sg_lang',l);}catch{}
  document.documentElement.lang = l==='ko'?'ko':'zh-CN';
  document.querySelectorAll('.lang-switch button').forEach(b=>b.classList.toggle('on',b.dataset.lang===l));
  // rebuild chips labels
  document.querySelectorAll('#country-chips .chip').forEach(c=>c.textContent=tv('country',c.dataset.val));
  document.querySelectorAll('#device-chips .chip').forEach(c=>c.textContent=tv('device',c.dataset.val));
  applyStaticI18n(); refreshMeta(); render();
}
function applyStaticI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const v=I18N[LANG][el.dataset.i18n]; if(typeof v==='string') el.textContent=v;
  });
  document.title = LANG==='ko'?'게임 일일 리포트 · 광고 개요':'手游日报 · 投放总览';
}

/* ----- theme (AdPilot: auto / light / dark) ----- */
function initTheme(){
  const KEY='sg_theme', root=document.documentElement;
  const apply=m=>{ if(m==='light'||m==='dark')root.setAttribute('data-theme',m); else root.removeAttribute('data-theme'); };
  const setMode=m=>{ try{localStorage.setItem(KEY,m);}catch{} apply(m); render(); };
  const q=new URLSearchParams(location.search).get('theme');
  let saved='auto'; try{saved=localStorage.getItem(KEY)||'auto';}catch{}
  apply((q==='light'||q==='dark')?q:saved);
  $('#themeToggle').addEventListener('click',()=>{
    const cur=root.getAttribute('data-theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
    setMode(cur==='dark'?'light':'dark');
  });
  document.querySelectorAll('.theme-ico').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.theme)));
}
function watchTheme(){
  new MutationObserver(()=>render()).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{ if(!document.documentElement.getAttribute('data-theme')) render(); });
}

/* ----- controls ----- */
function buildControls(){
  const cc=$('#country-chips'), dc=$('#device-chips');
  DATA.meta.countries.forEach(v=>{state.countries.add(v);cc.appendChild(chip(v,'country',state.countries));});
  DATA.meta.devices.forEach(v=>{state.devices.add(v);dc.appendChild(chip(v,'device',state.devices));});
  const df=$('#date-from'), dt=$('#date-to');
  df.min=dt.min=DATA.meta.date_min; df.max=dt.max=DATA.meta.date_max;
  df.addEventListener('change',e=>{state.from=e.target.value;markPreset(null);render();});
  dt.addEventListener('change',e=>{state.to=e.target.value;markPreset(null);render();});
  document.querySelectorAll('.preset').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.preset,b)));
  seg('#source-seg',v=>{state.source=v;render();});
  seg('#roas-seg',v=>{state.roas=v;render();});
  document.querySelectorAll('.tab').forEach(tb=>tb.addEventListener('click',()=>switchPane(tb)));
}
function chip(val,kind,set){
  const el=document.createElement('button');
  el.className='chip on'; el.dataset.val=val; el.textContent=tv(kind,val);
  el.addEventListener('click',()=>{
    if(set.has(val)){ if(set.size>1){set.delete(val);el.classList.remove('on');} }
    else{ set.add(val); el.classList.add('on'); }
    render();
  });
  return el;
}
function seg(sel,cb){
  document.querySelectorAll(sel+' button').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll(sel+' button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); cb(b.dataset.v);
  }));
}
function applyPreset(key,btn){
  const min=DATA.meta.date_min, max=DATA.meta.date_max;
  const clamp=d=>d<min?min:(d>max?max:d);
  if(key==='today'||key==='yesterday'){
    const n=new Date();
    const todayISO=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
    const day=clamp(key==='today'?todayISO:isoAdd(todayISO,-1));
    state.from=day; state.to=day;
  } else if(key==='all'){ state.from=min; state.to=max; }
  else { const num=+key; state.to=max; state.from=clamp(isoAdd(max,-(num-1))); }
  $('#date-from').value=state.from; $('#date-to').value=state.to;
  markPreset(btn||[...document.querySelectorAll('.preset')].find(b=>b.dataset.preset===String(key)));
  if(DATA&&charts.mat) render();
}
function markPreset(btn){document.querySelectorAll('.preset').forEach(b=>b.classList.remove('on'));if(btn)btn.classList.add('on');}
function switchPane(tab){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  tab.classList.add('active');
  const p=tab.dataset.pane;
  document.querySelectorAll('.pane').forEach(el=>el.classList.toggle('hidden',el.dataset.pane!==p));
  if(p==='overview') setTimeout(()=>Object.values(charts).forEach(c=>c.resize()),0);
}

/* ============ charts ============ */
function initCharts(){
  charts.mat=echarts.init($('#chart-mat'));
  charts.meta=echarts.init($('#chart-meta'));
  charts.spend=echarts.init($('#chart-spend'));
  charts.breakdown=echarts.init($('#chart-breakdown'));
  window.addEventListener('resize',()=>Object.values(charts).forEach(c=>c.resize()));
}
function axisStyle(){
  const text=cssVar('--text'),muted=cssVar('--muted'),line=cssVar('--line-strong'),split=cssVar('--chart-split');
  return {muted,text,
    axisLine:{lineStyle:{color:line}}, axisTick:{show:false},
    axisLabel:{color:muted,fontSize:11}, splitLine:{lineStyle:{color:split}}};
}
function tip(kind){const surf=cssVar('--panel'),line=cssVar('--line-strong'),text=cssVar('--text');
  return{trigger:'axis',backgroundColor:surf,borderColor:line,borderWidth:1,padding:[10,13],
    textStyle:{color:text,fontSize:12},axisPointer:{type:'shadow',shadowStyle:{color:'rgba(120,120,140,.08)'}},
    formatter:params=>{
      const head=params[0].axisValueLabel||params[0].axisValue;
      let s=`<div style="font-weight:600;margin-bottom:4px">${head}</div>`;
      const seen=new Set();
      params.forEach(p=>{
        if(p.value==null) return;                 // 跳过空值,避免一条线在缺口处显示 —
        const key=p.seriesName+'@'+p.dataIndex; if(seen.has(key))return; seen.add(key);
        const isRoas = kind==='roas' || (kind==='mixed' && /ROAS/.test(p.seriesName));
        const v=isRoas?(p.value*100).toFixed(2)+'%':'$'+Math.round(p.value).toLocaleString('en-US');
        s+=`<div style="display:flex;justify-content:space-between;gap:18px"><span>${p.marker} ${p.seriesName}</span><b>${v}</b></div>`;
      });
      return s;
    }};}
function legend(data){return{top:4,right:2,icon:'roundRect',itemWidth:11,itemHeight:11,
  textStyle:{color:cssVar('--muted'),fontSize:11},data};}
const baseGrid={left:8,right:8,top:46,bottom:26,containLabel:true};
const dShort=v=>v.slice(5);

function render(){
  if(!DATA)return;
  const wantAdj=state.source!=='meta', wantMeta=state.source!=='adjust';
  $('#card-mat-adj').classList.toggle('hidden',!wantAdj);
  $('#card-mat-meta').classList.toggle('hidden',!wantMeta);
  renderKpis(); renderMaturation(); renderMetaCurve(); renderSpend(); renderBreakdown(); renderTable();
  requestAnimationFrame(()=>Object.values(charts).forEach(c=>c.resize()));
}

// 收入 = Σ(花费 × ROAS);只统计该口径有值的记录
function revenue(recs,sk,rk){let r=0;for(const x of recs){if(x[sk]!=null&&x[rk]!=null)r+=x[sk]*x[rk];}return r;}
function spendWith(recs,sk,rk){let s=0;for(const x of recs){if(x[sk]!=null&&x[rk]!=null)s+=x[sk];}return s;}
const beTag=v=>v==null?'':(v>=1?`<span class="delta up">${t('breakEven')}</span>`:`<span class="delta down">${t('notBreakEven')}</span>`);

function srcCards(prefix,cls,spendKey,roasKey,withMetric){
  const recs=filtered(),dates=sortedDates(recs);
  const sp=sum(recs,spendKey);
  const rev=revenue(recs,spendKey,roasKey);
  const den=spendWith(recs,spendKey,roasKey);
  const ratio=den>0?rev/den:null;
  const suf=withMetric?` · ${ROAS_LABEL[roasKey]}`:'';
  return [
    {cls,label:`${prefix} · ${t('spendLabel')}`,val:fmtMoney(sp),sub:t('daysTotal')(dates.length)},
    {cls,label:`${prefix} · ${t('revLabel')}${suf}`,val:fmtMoney(rev),sub:withMetric?t('byMetric')(ROAS_LABEL[roasKey]):t('revFromSpend')},
    {cls,label:`${prefix} · ${t('ratioLabel')}${suf}`,val:fmtRoas(ratio),sub:t('revFromSpend'),tag:beTag(ratio)},
  ];
}
function renderKpis(){
  const wantAdj=state.source!=='meta', wantMeta=state.source!=='adjust';
  let cards=[];
  if(wantAdj) cards=cards.concat(srcCards('ADJUST','k-adj','adjust_spend',state.roas,true));
  if(wantMeta) cards=cards.concat(srcCards('META','k-meta','meta_spend','meta_roas',false));
  $('#kpis').innerHTML=cards.map(c=>`<div class="kpi ${c.cls||''}"><div class="kpi-label">${c.label}</div>
    <div class="kpi-val">${c.val}</div><div class="kpi-sub">${c.sub}${c.delta||''}${c.tag||''}</div></div>`).join('');
}
function pctDelta(c,p){if(c==null||p==null||p===0)return'';const x=(c-p)/p*100,u=x>=0;return`<span class="delta ${u?'up':'down'}">${u?'▲':'▼'} ${Math.abs(x).toFixed(1)}%</span>`;}
function ptsDelta(c,p){if(c==null||p==null)return'';const x=c-p,u=x>=0;return`<span class="delta ${u?'up':'down'}">${u?'▲':'▼'} ${(Math.abs(x)*100).toFixed(2)}pp</span>`;}

function renderSpend(){
  const recs=filtered(),dates=sortedDates(recs),day=d=>recs.filter(r=>r.date===d);
  const ax=axisStyle(), series=[],ld=[];
  const wantMeta=state.source!=='adjust', wantAdj=state.source!=='meta', rl=ROAS_LABEL[state.roas];
  const sp=t('spend');
  if(wantAdj){
    const n1=`${sp} · ADJUST`, n2=`ROAS · ADJUST ${rl}`;
    series.push(barS(n1,dates.map(d=>round(sum(day(d),'adjust_spend'))),SERIES.adjSpend));
    series.push(lineS(n2,dates.map(d=>round(wRoas(day(d),'adjust_spend',state.roas),3)),SERIES.adjRoas));
    ld.push(n1,n2);
  }
  if(wantMeta){
    const n1=`${sp} · META`, n2='ROAS · META';
    series.push(barS(n1,dates.map(d=>round(sum(day(d),'meta_spend'))),SERIES.metaSpend));
    series.push(lineS(n2,dates.map(d=>round(wRoas(day(d),'meta_spend','meta_roas'),3)),SERIES.metaRoas));
    ld.push(n1,n2);
  }
  charts.spend.setOption({
    tooltip:tip('mixed'), legend:legend(ld), grid:baseGrid,
    xAxis:{type:'category',data:dates,axisLine:ax.axisLine,axisTick:ax.axisTick,splitLine:{show:false},axisLabel:{color:ax.muted,fontSize:11,formatter:dShort}},
    yAxis:[
      {type:'value',name:t('spend'),nameTextStyle:{color:ax.muted,fontSize:10},axisLine:ax.axisLine,axisLabel:{color:ax.muted,fontSize:11,formatter:v=>'$'+(v>=1000?(v/1000)+'k':v)},splitLine:ax.splitLine},
      {type:'value',name:'ROAS',nameTextStyle:{color:ax.muted,fontSize:10},axisLine:ax.axisLine,splitLine:{show:false},axisLabel:{color:ax.muted,fontSize:11,formatter:v=>(v*100).toFixed(0)+'%'}},
    ],
    series,
  },true);
}
function barS(name,data,color){return{name,type:'bar',data,yAxisIndex:0,barMaxWidth:26,itemStyle:{color,borderRadius:[4,4,0,0]}};}
function lineS(name,data,color){return{name,type:'line',data,yAxisIndex:1,connectNulls:false,smooth:.35,symbol:'circle',symbolSize:6,lineStyle:{width:2.6,color},itemStyle:{color},z:5};}

function renderBreakdown(){
  const recs=filtered(),dates=sortedDates(recs),ax=axisStyle();
  const segs=[...new Set(recs.map(rawSeg))].sort();
  const series=segs.map((sg,i)=>({name:segLabelFromKey(sg),type:'bar',stack:'sp',
    data:dates.map(d=>round(sum(recs.filter(r=>r.date===d&&rawSeg(r)===sg),'adjust_spend'))),
    itemStyle:{color:SEG_COLORS[i%SEG_COLORS.length]},barMaxWidth:30}));
  charts.breakdown.setOption({
    tooltip:tip('money'), legend:legend(series.map(s=>s.name)), grid:baseGrid,
    xAxis:{type:'category',data:dates,axisLine:ax.axisLine,axisTick:ax.axisTick,axisLabel:{color:ax.muted,fontSize:11,formatter:dShort}},
    yAxis:{type:'value',axisLine:ax.axisLine,splitLine:ax.splitLine,axisLabel:{color:ax.muted,fontSize:11,formatter:v=>'$'+(v>=1000?(v/1000)+'k':v)}},
    series,
  },true);
}
function segLabelFromKey(k){const[c,d]=k.split('__');return `${tv('country',c)} · ${tv('device',d)}`;}
function lerp(a,b,t_){const pa=[1,3,5].map(i=>parseInt(a.slice(i,i+2),16)),pb=[1,3,5].map(i=>parseInt(b.slice(i,i+2),16));
  const c=pa.map((x,i)=>Math.round(x+(pb[i]-x)*t_));return `rgb(${c[0]},${c[1]},${c[2]})`;}
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};

/* 成熟乘子模型:用历史已成熟 cohort 标定 D3/D0、D7/D0、D7/D3 的中位数比值(随当前国家/设备过滤),
   把"还没到 D3/D7"的近期天向后预测。中位数对异常日更稳健。 */
function maturationMultipliers(){
  const base=DATA.records.filter(r=>state.countries.has(r.country)&&state.devices.has(r.device));
  const r3=[],r7=[],r73=[];
  for(const r of base){
    if(r.d0_roas>0){ if(r.d3_roas!=null)r3.push(r.d3_roas/r.d0_roas); if(r.d7_roas!=null)r7.push(r.d7_roas/r.d0_roas); }
    if(r.d3_roas>0&&r.d7_roas!=null) r73.push(r.d7_roas/r.d3_roas);
  }
  return {r3:median(r3), r7:median(r7), r73:median(r73), n:r7.length};
}

/* 回本曲线:x = D0/D3/D7,横向 100% 回本线;近期未成熟天用乘子模型预测,虚线延展。 */
function renderMaturation(){
  const recs=filtered(),dates=sortedDates(recs),ax=axisStyle();
  const day=d=>recs.filter(r=>r.date===d);
  const xCats=['D0','D3','D7'];
  const m=maturationMultipliers();
  const series=[],ld=[];

  {
    const cohorts = dates.length>12 ? [] : dates;   // 天数过多时只画平均,避免杂乱
    cohorts.forEach((d,i)=>{
      const col=lerp('#b9ccff','#16357f', dates.length<=1?1:i/(dates.length-1));
      const d0=round(wRoas(day(d),'adjust_spend','d0_roas'),3);
      const d3=round(wRoas(day(d),'adjust_spend','d3_roas'),3);
      const d7=round(wRoas(day(d),'adjust_spend','d7_roas'),3);
      const actual=[d0,d3,d7], nm=`ADJUST ${d.slice(5)}`;
      series.push({name:nm,type:'line',data:actual,connectNulls:false,smooth:.3,symbol:'circle',symbolSize:6,
        lineStyle:{width:2,color:col},itemStyle:{color:col}});
      ld.push(nm);
      const pD3=d3!=null?d3:(d0!=null&&m.r3!=null?round(d0*m.r3,3):null);
      const pD7=d7!=null?d7:(pD3!=null&&m.r73!=null?round(pD3*m.r73,3):(d0!=null&&m.r7!=null?round(d0*m.r7,3):null));
      const lastIdx=d7!=null?2:d3!=null?1:d0!=null?0:-1;
      if(lastIdx>=0&&lastIdx<2&&pD7!=null){
        const pred=[null,null,null]; pred[lastIdx]=actual[lastIdx]; if(d3==null)pred[1]=pD3; pred[2]=pD7;
        series.push({name:nm,type:'line',data:pred,connectNulls:true,smooth:.3,symbol:'emptyCircle',symbolSize:6,
          lineStyle:{width:2,color:col,type:'dashed'},itemStyle:{color:col},z:3});  // 同名→图例联动
      }
    });
    const a0=round(wRoas(recs,'adjust_spend','d0_roas'),3),a3=round(wRoas(recs,'adjust_spend','d3_roas'),3),a7=round(wRoas(recs,'adjust_spend','d7_roas'),3);
    const nmA=`ADJUST ${t('avg')}`;
    series.push({name:nmA,type:'line',data:[a0,a3,a7],connectNulls:false,smooth:.3,symbol:'circle',symbolSize:8,
      lineStyle:{width:4,color:SERIES.adjSpend},itemStyle:{color:SERIES.adjSpend},z:6});
    ld.push(nmA);
    const pa3=a3!=null?a3:(a0!=null&&m.r3!=null?round(a0*m.r3,3):null);
    const pa7=a7!=null?a7:(pa3!=null&&m.r73!=null?round(pa3*m.r73,3):(a0!=null&&m.r7!=null?round(a0*m.r7,3):null));
    const aLast=a7!=null?2:a3!=null?1:a0!=null?0:-1;
    if(aLast>=0&&aLast<2&&pa7!=null){
      const pred=[null,null,null]; pred[aLast]=[a0,a3,a7][aLast]; if(a3==null)pred[1]=pa3; pred[2]=pa7;
      series.push({name:nmA,type:'line',data:pred,connectNulls:true,smooth:.3,symbol:'emptyCircle',symbolSize:8,
        lineStyle:{width:4,color:SERIES.adjSpend,type:'dashed'},itemStyle:{color:SERIES.adjSpend},z:6});
    }
  }
  attachBreakLine(series);
  charts.mat.setOption(matOption(xCats,ax,ld,series),true);
}

/* META 回本曲线(模拟):D0 实测,D3/D7 按 ADJUST 增长形态(乘子)模拟,虚线。 */
function renderMetaCurve(){
  const recs=filtered(),ax=axisStyle();
  const m=maturationMultipliers();
  const segs=[...new Set(recs.map(rawSeg))].sort();
  const xCats=['D0','D3','D7'];
  const series=[],ld=[];
  segs.forEach((sg,i)=>{
    const col=SEG_COLORS[i%SEG_COLORS.length];
    const d0=round(wRoas(recs.filter(r=>rawSeg(r)===sg),'meta_spend','meta_roas'),3);
    const nm=segLabelFromKey(sg);
    series.push({name:nm,type:'line',data:[d0,null,null],connectNulls:false,symbol:'circle',symbolSize:7,
      lineStyle:{width:2,color:col},itemStyle:{color:col}});
    ld.push(nm);
    if(d0!=null&&m.r3!=null&&m.r7!=null){
      series.push({name:nm,type:'line',data:[d0,round(d0*m.r3,3),round(d0*m.r7,3)],connectNulls:true,
        symbol:'emptyCircle',symbolSize:7,lineStyle:{width:2,color:col,type:'dashed'},itemStyle:{color:col},z:3});
    }
  });
  // META 平均(模拟)
  const mv=round(wRoas(recs,'meta_spend','meta_roas'),3), nmA=`META ${t('avg')}`;
  series.push({name:nmA,type:'line',data:[mv,null,null],symbol:'circle',symbolSize:8,
    lineStyle:{width:4,color:SERIES.metaRoas},itemStyle:{color:SERIES.metaRoas},z:6});
  if(mv!=null&&m.r3!=null&&m.r7!=null)
    series.push({name:nmA,type:'line',data:[mv,round(mv*m.r3,3),round(mv*m.r7,3)],connectNulls:true,
      symbol:'emptyCircle',symbolSize:8,lineStyle:{width:4,color:SERIES.metaRoas,type:'dashed'},itemStyle:{color:SERIES.metaRoas},z:6});
  ld.push(nmA);
  attachBreakLine(series);
  charts.meta.setOption(matOption(xCats,ax,ld,series),true);
}
function attachBreakLine(series){
  if(!series.length)return;
  series[0]=Object.assign({},series[0],{markLine:{silent:true,symbol:'none',
    lineStyle:{color:'#ef4444',type:'dashed',width:1.6},
    label:{formatter:t('breakLine'),color:'#ef4444',position:'insideEndTop',fontSize:11},
    data:[{yAxis:1}]}});
}
function matOption(xCats,ax,ld,series){
  return {
    tooltip:tip('roas'), legend:legend(ld), grid:{left:8,right:16,top:46,bottom:26,containLabel:true},
    xAxis:{type:'category',boundaryGap:false,data:xCats,axisLine:ax.axisLine,axisTick:ax.axisTick,axisLabel:{color:ax.muted,fontSize:12}},
    yAxis:{type:'value',name:'ROAS',nameTextStyle:{color:ax.muted,fontSize:10},axisLine:ax.axisLine,splitLine:ax.splitLine,axisLabel:{color:ax.muted,fontSize:11,formatter:v=>(v*100).toFixed(0)+'%'}},
    series,
  };
}

function renderTable(){
  const recs=filtered().slice().sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:rawSeg(a).localeCompare(rawSeg(b)));
  $('#table-note').textContent=t('tableNote')(recs.length,state.from,state.to);
  const sp=I18N[LANG].spend;
  $('#detail-table thead').innerHTML=`<tr><th>${t('tDate')}</th><th>${t('tCountry')}</th><th>${t('tDevice')}</th>
    <th>META ${sp}</th><th>META ROAS</th><th>ADJUST ${sp}</th><th>D0</th><th>D3</th><th>D7</th></tr>`;
  const cell=(v,f)=>v==null?'<td class="imm">—</td>':`<td>${f(v)}</td>`;
  $('#detail-table tbody').innerHTML=recs.map(r=>`<tr><td>${r.date}</td>
    <td><span class="badge">${tv('country',r.country)}</span></td><td>${tv('device',r.device)}</td>
    ${cell(r.meta_spend,fmtMoney)}${cell(r.meta_roas,fmtRoas)}
    ${cell(r.adjust_spend,fmtMoney)}${cell(r.d0_roas,fmtRoas)}${cell(r.d3_roas,fmtRoas)}${cell(r.d7_roas,fmtRoas)}</tr>`).join('');
}
