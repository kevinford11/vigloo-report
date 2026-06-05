'use strict';

/* ============ i18n ============ */
const I18N = {
  zh:{
    brand:'手游日报', brandTag:'VIGLOO · 投放数据', navOverview:'总览', navDetail:'明细',
    autoSync:'每日自动同步', updatedAt:'更新于', pageTitle:'投放总览', dataRange:'数据范围',
    fDate:'日期', p7:'7日', p14:'14日', pAll:'全部', fCountry:'国家', fDevice:'设备',
    fSource:'来源', sBoth:'两者对比', fRoas:'ADJUST 回报口径',
    cMainTitle:'花费 × 回报趋势', cMainSub:'柱 = 花费(左轴) · 线 = ROAS(右轴) · 未成熟回报自动断线',
    cBreakTitle:'花费构成', cBreakSub:'按 国家 / 设备 分段堆叠',
    cRoasTitle:'回报对比', cRoasSub:'所选口径下,各分段 ROAS', cTableTitle:'明细数据',
    footSrc:'来源:飞书「手游日报」· 每日自动抓取', footImm:'未成熟的 D3/D7 回报以 — 表示,不计入趋势线',
    kpiTotalSpend:'区间总花费 · ADJUST', kpiDaySpend:'最新一天花费', kpiD0:'最新 D0 ROAS', kpiD7:'最新成熟 D7 ROAS',
    daysTotal:n=>`${n} 天合计`, maturedAt:d=>`成熟于 ${d}`, noMatured:'暂无成熟数据',
    spend:'花费', tDate:'日期', tCountry:'国家', tDevice:'设备',
    tableNote:(n,a,b)=>`${n} 行 · ${a} → ${b}`, locale:'zh-CN',
  },
  ko:{
    brand:'게임 일일 리포트', brandTag:'VIGLOO · 광고 데이터', navOverview:'개요', navDetail:'상세',
    autoSync:'매일 자동 동기화', updatedAt:'업데이트', pageTitle:'광고 개요', dataRange:'데이터 범위',
    fDate:'날짜', p7:'7일', p14:'14일', pAll:'전체', fCountry:'국가', fDevice:'기기',
    fSource:'소스', sBoth:'둘 다', fRoas:'ADJUST ROAS 기준',
    cMainTitle:'지출 × ROAS 추이', cMainSub:'막대 = 지출(좌측) · 선 = ROAS(우측) · 미확정 ROAS 자동 끊김',
    cBreakTitle:'지출 구성', cBreakSub:'국가 / 기기별 누적',
    cRoasTitle:'ROAS 비교', cRoasSub:'선택 기준의 분기별 ROAS', cTableTitle:'상세 데이터',
    footSrc:'출처: Feishu 「手游日报」· 매일 자동 수집', footImm:'미확정 D3/D7 은 — 로 표시, 추이선 제외',
    kpiTotalSpend:'기간 총 지출 · ADJUST', kpiDaySpend:'최근일 지출', kpiD0:'최근 D0 ROAS', kpiD7:'최근 확정 D7 ROAS',
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
const state={from:null,to:null,countries:new Set(),devices:new Set(),source:'adjust',roas:'d0_roas'};
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
  buildControls(); applyPreset(7);
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
  $('#date-from').addEventListener('change',e=>{state.from=e.target.value;markPreset(null);render();});
  $('#date-to').addEventListener('change',e=>{state.to=e.target.value;markPreset(null);render();});
  document.querySelectorAll('.preset').forEach(b=>b.addEventListener('click',()=>applyPreset(+b.dataset.days,b)));
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
function applyPreset(days,btn){
  const max=DATA.meta.date_max,min=DATA.meta.date_min;
  state.to=max; state.from = days===0?min:(isoAdd(max,-(days-1))<min?min:isoAdd(max,-(days-1)));
  $('#date-from').value=state.from; $('#date-to').value=state.to;
  markPreset(btn||[...document.querySelectorAll('.preset')].find(b=>+b.dataset.days===days));
  if(DATA&&charts.main) render();
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
  charts.main=echarts.init($('#chart-main'));
  charts.breakdown=echarts.init($('#chart-breakdown'));
  charts.roas=echarts.init($('#chart-roas'));
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
      params.forEach(p=>{
        const isRoas = kind==='roas' || (kind==='mixed' && /ROAS/.test(p.seriesName));
        const v=(p.value==null)?'—':(isRoas?(p.value*100).toFixed(2)+'%':'$'+Math.round(p.value).toLocaleString('en-US'));
        s+=`<div style="display:flex;justify-content:space-between;gap:18px"><span>${p.marker} ${p.seriesName}</span><b>${v}</b></div>`;
      });
      return s;
    }};}
function legend(data){return{top:4,right:2,icon:'roundRect',itemWidth:11,itemHeight:11,
  textStyle:{color:cssVar('--muted'),fontSize:11},data};}
const baseGrid={left:8,right:8,top:46,bottom:26,containLabel:true};
const dShort=v=>v.slice(5);

function render(){ if(!DATA)return; renderKpis(); renderMain(); renderBreakdown(); renderRoas(); renderTable(); }

function renderKpis(){
  const recs=filtered(),dates=sortedDates(recs);
  const last=dates[dates.length-1],prev=dates[dates.length-2];
  const day=d=>recs.filter(r=>r.date===d);
  const sLast=last?sum(day(last),'adjust_spend'):null, sPrev=prev?sum(day(prev),'adjust_spend'):null;
  const d0L=last?wRoas(day(last),'adjust_spend','d0_roas'):null, d0P=prev?wRoas(day(prev),'adjust_spend','d0_roas'):null;
  let d7d=null; for(let i=dates.length-1;i>=0;i--){ if(wRoas(day(dates[i]),'adjust_spend','d7_roas')!=null){d7d=dates[i];break;} }
  const d7=d7d?wRoas(day(d7d),'adjust_spend','d7_roas'):null;
  const cards=[
    {label:t('kpiTotalSpend'),val:fmtMoney(sum(recs,'adjust_spend')),sub:t('daysTotal')(dates.length)},
    {label:t('kpiDaySpend'),val:fmtMoney(sLast),sub:last||'—',delta:pctDelta(sLast,sPrev)},
    {cls:'k-roas',label:t('kpiD0'),val:fmtRoas(d0L),sub:last||'—',delta:ptsDelta(d0L,d0P)},
    {cls:'k-roas',label:t('kpiD7'),val:fmtRoas(d7),sub:d7d?t('maturedAt')(d7d):t('noMatured')},
  ];
  $('#kpis').innerHTML=cards.map(c=>`<div class="kpi ${c.cls||''}"><div class="kpi-label">${c.label}</div>
    <div class="kpi-val">${c.val}</div><div class="kpi-sub">${c.sub}${c.delta||''}</div></div>`).join('');
}
function pctDelta(c,p){if(c==null||p==null||p===0)return'';const x=(c-p)/p*100,u=x>=0;return`<span class="delta ${u?'up':'down'}">${u?'▲':'▼'} ${Math.abs(x).toFixed(1)}%</span>`;}
function ptsDelta(c,p){if(c==null||p==null)return'';const x=c-p,u=x>=0;return`<span class="delta ${u?'up':'down'}">${u?'▲':'▼'} ${(Math.abs(x)*100).toFixed(2)}pp</span>`;}

function renderMain(){
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
  charts.main.setOption({
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
function renderRoas(){
  const recs=filtered(),dates=sortedDates(recs),ax=axisStyle(),rl=ROAS_LABEL[state.roas];
  const segs=[...new Set(recs.map(rawSeg))].sort();
  const series=segs.map((sg,i)=>({name:segLabelFromKey(sg),type:'line',connectNulls:false,smooth:.35,symbol:'circle',symbolSize:5,
    data:dates.map(d=>round(wRoas(recs.filter(r=>r.date===d&&rawSeg(r)===sg),'adjust_spend',state.roas),3)),
    lineStyle:{width:2.4,color:SEG_COLORS[i%SEG_COLORS.length]},itemStyle:{color:SEG_COLORS[i%SEG_COLORS.length]}}));
  charts.roas.setOption({
    tooltip:tip('roas'), legend:legend(series.map(s=>s.name)), grid:baseGrid,
    xAxis:{type:'category',data:dates,axisLine:ax.axisLine,axisTick:ax.axisTick,axisLabel:{color:ax.muted,fontSize:11,formatter:dShort}},
    yAxis:{type:'value',name:`ADJUST ${rl}`,nameTextStyle:{color:ax.muted,fontSize:10},axisLine:ax.axisLine,splitLine:ax.splitLine,axisLabel:{color:ax.muted,fontSize:11,formatter:v=>(v*100).toFixed(0)+'%'}},
    series,
  },true);
}
function segLabelFromKey(k){const[c,d]=k.split('__');return `${tv('country',c)} · ${tv('device',d)}`;}

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
