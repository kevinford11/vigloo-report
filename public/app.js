'use strict';

/* ---------- palette / fonts shared with CSS ---------- */
const C = {
  ink:'#17140E', soft:'#48433A', muted:'#8A8275', line:'#E3DFD3', paper:'#F6F4ED',
  accent:'#1C6B57', accent2:'#BD5F36', meta:'#3C5871',
  mono:'"IBM Plex Mono",monospace', sans:'"Noto Sans SC",sans-serif',
};
const SEG_COLORS = ['#1C6B57','#3C5871','#BD5F36','#C79A2E','#7A6B9A','#4E7C59'];
const ROAS_LABEL = {d0_roas:'D0', d3_roas:'D3', d7_roas:'D7'};

/* ---------- state ---------- */
let DATA = null;
const state = {
  from:null, to:null,
  countries:new Set(), devices:new Set(),
  source:'both', roas:'d0_roas',
};
const charts = {};

/* ---------- utils ---------- */
const $ = s => document.querySelector(s);
const segKey = r => `${r.country} · ${r.device}`;
const isoAdd = (iso,days)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
const fmtMoney = n => n==null ? '—' : '$'+Math.round(n).toLocaleString('en-US');
const fmtRoas = n => n==null ? '—' : n.toFixed(2)+'×';
const fmtPct = n => n==null ? '—' : (n*100).toFixed(1)+'%';

function inRange(rec){ return rec.date>=state.from && rec.date<=state.to; }
function passFilter(rec){
  return inRange(rec) && state.countries.has(rec.country) && state.devices.has(rec.device);
}
function filtered(){ return DATA.records.filter(passFilter); }

// spend-weighted ROAS over a list, ignoring nulls
function wRoas(recs, spendKey, roasKey){
  let num=0, den=0;
  for(const r of recs){
    const s=r[spendKey], v=r[roasKey];
    if(s!=null && v!=null){ num+=s*v; den+=s; }
  }
  return den>0 ? num/den : null;
}
const sum = (recs,key)=>recs.reduce((a,r)=>a+(r[key]||0),0);
function sortedDates(recs){ return [...new Set(recs.map(r=>r.date))].sort(); }

/* ---------- init ---------- */
fetch('data.json').then(r=>r.json()).then(d=>{
  DATA = d;
  buildControls();
  applyPreset(7);
  $('#m-range').textContent = `${d.meta.date_min} → ${d.meta.date_max}`;
  $('#m-updated').textContent = new Date(d.meta.updated).toLocaleString('zh-CN',{hour12:false});
  initCharts();
  render();
  setTimeout(()=>$('#loading').classList.add('hide'),150);
}).catch(e=>{ $('#loading').textContent='数据加载失败:'+e; });

function buildControls(){
  // chips
  const cc=$('#country-chips'), dc=$('#device-chips');
  DATA.meta.countries.forEach(v=>{ state.countries.add(v); cc.appendChild(chip(v,state.countries)); });
  DATA.meta.devices.forEach(v=>{ state.devices.add(v); dc.appendChild(chip(v,state.devices)); });
  // dates
  $('#date-from').addEventListener('change',e=>{state.from=e.target.value;markPreset(null);render();});
  $('#date-to').addEventListener('change',e=>{state.to=e.target.value;markPreset(null);render();});
  document.querySelectorAll('.preset').forEach(b=>b.addEventListener('click',()=>applyPreset(+b.dataset.days,b)));
  // segmented
  seg('#source-seg', v=>{state.source=v;render();});
  seg('#roas-seg',   v=>{state.roas=v;render();});
}
function chip(label,set){
  const el=document.createElement('button');
  el.className='chip on'; el.textContent=label;
  el.addEventListener('click',()=>{
    if(set.has(label)){ if(set.size>1){set.delete(label);el.classList.remove('on');} }
    else { set.add(label); el.classList.add('on'); }
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
  const max=DATA.meta.date_max, min=DATA.meta.date_min;
  state.to=max;
  state.from = days===0 ? min : (isoAdd(max,-(days-1))<min ? min : isoAdd(max,-(days-1)));
  $('#date-from').value=state.from; $('#date-to').value=state.to;
  markPreset(btn || [...document.querySelectorAll('.preset')].find(b=>+b.dataset.days===days));
  if(DATA && charts.main) render();
}
function markPreset(btn){
  document.querySelectorAll('.preset').forEach(b=>b.classList.remove('on'));
  if(btn) btn.classList.add('on');
}

/* ---------- charts ---------- */
function initCharts(){
  charts.main = echarts.init($('#chart-main'));
  charts.breakdown = echarts.init($('#chart-breakdown'));
  charts.roas = echarts.init($('#chart-roas'));
  window.addEventListener('resize',()=>Object.values(charts).forEach(c=>c.resize()));
}

const baseGrid = {left:8,right:8,top:48,bottom:28,containLabel:true};
const axisCommon = {
  axisLine:{lineStyle:{color:C.line}},
  axisTick:{show:false},
  axisLabel:{color:C.muted,fontFamily:C.mono,fontSize:11},
  splitLine:{lineStyle:{color:'#EFECE3'}},
};
function tip(){return{trigger:'axis',backgroundColor:'#fff',borderColor:C.line,borderWidth:1,
  padding:[10,13],textStyle:{color:C.ink,fontFamily:C.mono,fontSize:12},
  axisPointer:{type:'shadow',shadowStyle:{color:'rgba(23,20,14,.04)'}}};}
function legend(){return{top:6,right:4,icon:'roundRect',itemWidth:11,itemHeight:11,
  textStyle:{color:C.soft,fontFamily:C.mono,fontSize:11}};}

function render(){
  if(!DATA) return;
  renderKpis();
  renderMain();
  renderBreakdown();
  renderRoas();
  renderTable();
}

/* KPI cards */
function renderKpis(){
  const recs=filtered(), dates=sortedDates(recs);
  const last=dates[dates.length-1], prev=dates[dates.length-2];
  const dayRecs=d=>recs.filter(r=>r.date===d);
  const spendLast=last?sum(dayRecs(last),'adjust_spend'):null;
  const spendPrev=prev?sum(dayRecs(prev),'adjust_spend'):null;
  const d0Last=last?wRoas(dayRecs(last),'adjust_spend','d0_roas'):null;
  const d0Prev=prev?wRoas(dayRecs(prev),'adjust_spend','d0_roas'):null;
  // latest matured D7
  let d7day=null;
  for(let i=dates.length-1;i>=0;i--){ if(wRoas(dayRecs(dates[i]),'adjust_spend','d7_roas')!=null){d7day=dates[i];break;} }
  const d7=d7day?wRoas(dayRecs(d7day),'adjust_spend','d7_roas'):null;

  const cards=[
    {cls:'',label:`区间总花费 · ADJUST`,val:fmtMoney(sum(recs,'adjust_spend')),sub:`${dates.length} 天合计`},
    {cls:'',label:`最新一天花费`,val:fmtMoney(spendLast),sub:last||'—',delta:pctDelta(spendLast,spendPrev)},
    {cls:'k-roas',label:`最新 D0 ROAS`,val:fmtRoas(d0Last),sub:last||'—',delta:ptsDelta(d0Last,d0Prev)},
    {cls:'k-roas',label:`最新成熟 D7 ROAS`,val:fmtRoas(d7),sub:d7day?`成熟于 ${d7day}`:'暂无成熟数据'},
  ];
  $('#kpis').innerHTML = cards.map(c=>`
    <div class="kpi ${c.cls}">
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-val">${c.val}</div>
      <div class="kpi-sub">${c.sub}${c.delta||''}</div>
    </div>`).join('');
}
function pctDelta(cur,prev){
  if(cur==null||prev==null||prev===0) return '';
  const p=(cur-prev)/prev*100, up=p>=0;
  return `<span class="delta ${up?'up':'down'}">${up?'▲':'▼'} ${Math.abs(p).toFixed(1)}%</span>`;
}
function ptsDelta(cur,prev){
  if(cur==null||prev==null) return '';
  const d=cur-prev, up=d>=0;
  return `<span class="delta ${up?'up':'down'}">${up?'▲':'▼'} ${Math.abs(d).toFixed(2)}×</span>`;
}

/* main combo: spend bars + ROAS lines, per source */
function renderMain(){
  const recs=filtered(), dates=sortedDates(recs);
  const day=d=>recs.filter(r=>r.date===d);
  const series=[], legendData=[];
  const wantMeta=state.source!=='adjust', wantAdj=state.source!=='meta';
  const rlabel=ROAS_LABEL[state.roas];

  if(wantAdj){
    series.push(bar('花费 · ADJUST', dates.map(d=>round(sum(day(d),'adjust_spend'))), C.accent));
    series.push(line(`ROAS · ADJUST ${rlabel}`, dates.map(d=>round(wRoas(day(d),'adjust_spend',state.roas),3)), C.accent2));
    legendData.push('花费 · ADJUST',`ROAS · ADJUST ${rlabel}`);
  }
  if(wantMeta){
    series.push(bar('花费 · META', dates.map(d=>round(sum(day(d),'meta_spend'))), C.meta));
    series.push(line('ROAS · META', dates.map(d=>round(wRoas(day(d),'meta_spend','meta_roas'),3)), '#9C8B5A'));
    legendData.push('花费 · META','ROAS · META');
  }
  charts.main.setOption({
    color:[C.accent,C.accent2,C.meta,'#9C8B5A'],
    tooltip:Object.assign(tip(),{valueFormatter:null}),
    legend:Object.assign(legend(),{data:legendData}),
    grid:baseGrid,
    xAxis:{type:'category',data:dates,...axisCommon,axisLabel:{...axisCommon.axisLabel,formatter:v=>v.slice(5)}},
    yAxis:[
      {type:'value',name:'花费',nameTextStyle:{color:C.muted,fontFamily:C.mono,fontSize:10,align:'left'},
       ...axisCommon,axisLabel:{...axisCommon.axisLabel,formatter:v=>'$'+(v>=1000?(v/1000)+'k':v)}},
      {type:'value',name:'ROAS',nameTextStyle:{color:C.muted,fontFamily:C.mono,fontSize:10,align:'right'},
       ...axisCommon,splitLine:{show:false},axisLabel:{...axisCommon.axisLabel,formatter:v=>v+'×'}},
    ],
    series,
  },true);
}
function bar(name,data,color){
  return {name,type:'bar',data,yAxisIndex:0,barMaxWidth:26,
    itemStyle:{color,borderRadius:[3,3,0,0]},emphasis:{itemStyle:{color}}};
}
function line(name,data,color){
  return {name,type:'line',data,yAxisIndex:1,connectNulls:false,smooth:.35,symbol:'circle',symbolSize:6,
    lineStyle:{width:2.5,color},itemStyle:{color},
    z:5};
}
const round=(n,p=0)=> n==null?null:(p?Number(n.toFixed(p)):Math.round(n));

/* breakdown: stacked spend by segment over time */
function renderBreakdown(){
  const recs=filtered(), dates=sortedDates(recs);
  const segs=[...new Set(recs.map(segKey))].sort();
  const series=segs.map((sg,i)=>({
    name:sg,type:'bar',stack:'sp',data:dates.map(d=>round(sum(recs.filter(r=>r.date===d&&segKey(r)===sg),'adjust_spend'))),
    itemStyle:{color:SEG_COLORS[i%SEG_COLORS.length]},barMaxWidth:30,
  }));
  charts.breakdown.setOption({
    tooltip:tip(),legend:Object.assign(legend(),{data:segs}),grid:baseGrid,
    xAxis:{type:'category',data:dates,...axisCommon,axisLabel:{...axisCommon.axisLabel,formatter:v=>v.slice(5)}},
    yAxis:{type:'value',...axisCommon,axisLabel:{...axisCommon.axisLabel,formatter:v=>'$'+(v>=1000?(v/1000)+'k':v)}},
    series,
  },true);
}

/* roas comparison: line per segment for selected metric */
function renderRoas(){
  const recs=filtered(), dates=sortedDates(recs);
  const segs=[...new Set(recs.map(segKey))].sort();
  const rlabel=ROAS_LABEL[state.roas];
  const series=segs.map((sg,i)=>({
    name:sg,type:'line',connectNulls:false,smooth:.35,symbol:'circle',symbolSize:5,
    data:dates.map(d=>round(wRoas(recs.filter(r=>r.date===d&&segKey(r)===sg),'adjust_spend',state.roas),3)),
    lineStyle:{width:2.2,color:SEG_COLORS[i%SEG_COLORS.length]},itemStyle:{color:SEG_COLORS[i%SEG_COLORS.length]},
  }));
  charts.roas.setOption({
    tooltip:tip(),legend:Object.assign(legend(),{data:segs}),grid:baseGrid,
    xAxis:{type:'category',data:dates,...axisCommon,axisLabel:{...axisCommon.axisLabel,formatter:v=>v.slice(5)}},
    yAxis:{type:'value',name:`ADJUST ${rlabel} ROAS`,nameTextStyle:{color:C.muted,fontFamily:C.mono,fontSize:10},
      ...axisCommon,axisLabel:{...axisCommon.axisLabel,formatter:v=>v+'×'}},
    series,
  },true);
}

/* detail table */
function renderTable(){
  const recs=filtered().slice().sort((a,b)=> a.date<b.date?1:a.date>b.date?-1: segKey(a).localeCompare(segKey(b)));
  $('#table-note').textContent = `${recs.length} 行 · ${state.from} → ${state.to}`;
  $('#detail-table thead').innerHTML =
    `<tr><th>日期</th><th>国家</th><th>设备</th><th>META 花费</th><th>META ROAS</th>
     <th>ADJUST 花费</th><th>D0</th><th>D3</th><th>D7</th></tr>`;
  const cell=(v,f)=> v==null?'<td class="imm">—</td>':`<td>${f(v)}</td>`;
  $('#detail-table tbody').innerHTML = recs.map(r=>`
    <tr>
      <td>${r.date}</td><td><span class="badge">${r.country}</span></td><td>${r.device}</td>
      ${cell(r.meta_spend,fmtMoney)}${cell(r.meta_roas,fmtRoas)}
      ${cell(r.adjust_spend,fmtMoney)}${cell(r.d0_roas,fmtRoas)}${cell(r.d3_roas,fmtRoas)}${cell(r.d7_roas,fmtRoas)}
    </tr>`).join('');
}
