const $=s=>document.querySelector(s);
const token=sessionStorage.getItem('hrkit_admin_token');
const qs=new URLSearchParams(location.search), resourceId=Number(qs.get('id'));
if(!token||!resourceId){location.href='/admin.html';throw new Error('Missing admin session/resource');}
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const state={resource:null,form:null,fields:[],pdf:null,pages:[],page:1,scale:1,addMode:false,selected:null,history:[],future:[],saving:false,saveTimer:null};
async function api(url,opts={}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
 try{const r=await fetch(url,{...opts,signal:controller.signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(opts.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok){if(r.status===401){sessionStorage.removeItem('hrkit_admin_token');location.href='/admin.html';}throw new Error(d.error||'تعذر تنفيذ العملية');}return d}
 catch(e){if(e.name==='AbortError')throw new Error('انتهت مهلة الاتصال بالخادم. أعد المحاولة.');throw e}
 finally{clearTimeout(timer)}
}
function toast(msg,type=''){const el=$('#toast');el.textContent=msg;el.className='fb-toast show '+type;clearTimeout(window._toast);window._toast=setTimeout(()=>el.className='fb-toast',2600)}
function setSave(text,kind=''){const el=$('#save-state');el.textContent=text;el.className='save-state '+kind}
function snapshot(){return JSON.stringify(state.fields.map(f=>({...f})))}
function restore(s){state.fields=JSON.parse(s);state.selected=null;renderCurrentPage();updateProperties();updateHistoryButtons()}
function commitHistory(){const s=snapshot();if(state.history[state.history.length-1]!==s)state.history.push(s);if(state.history.length>50)state.history.shift();state.future=[];updateHistoryButtons();scheduleSave()}
function updateHistoryButtons(){$('#undo-btn').disabled=state.history.length<2;$('#redo-btn').disabled=!state.future.length;$('#copy-field').disabled=!state.selected;$('#delete-field').disabled=!state.selected}
function undo(){if(state.history.length<2)return;const current=state.history.pop();state.future.push(current);restore(state.history[state.history.length-1]);scheduleSave()}
function redo(){if(!state.future.length)return;const s=state.future.pop();state.history.push(s);restore(s);scheduleSave()}
function fieldDefault(page,x,y){return{id:'f-'+crypto.randomUUID(),name:'حقل جديد',type:'short_text',page,x,y,width:180,height:32,font_size:12,font_family:'IBM Plex Sans Arabic',align:'right',direction:'rtl',required:false,max_length:null,min_length:null,options:[],tab_order:state.fields.length,placeholder:'',static_value:'',settings:{}}}
function fieldLabel(f){return f.name||'حقل'}
function renderPageList(){const pages=$('#page-list');pages.innerHTML=Array.from({length:state.pdf?.numPages||0},(_,i)=>`<button class="page-chip ${state.page===i+1?'active':''}" data-page="${i+1}">صفحة ${i+1}</button>`).join('');pages.querySelectorAll('[data-page]').forEach(b=>b.onclick=async()=>{state.page=Number(b.dataset.page);renderPageList();await renderCurrentPage()})}
async function loadPage(index){
 if(state.pages[index])return state.pages[index];
 if(state.pagePromises?.[index])return state.pagePromises[index];
 state.pagePromises=state.pagePromises||{};
 state.pagePromises[index]=(async()=>{const p=await state.pdf.getPage(index+1);const vp=p.getViewport({scale:1});const c=document.createElement('canvas');const dpr=Math.min(2,window.devicePixelRatio||1);c.width=Math.ceil(vp.width*dpr);c.height=Math.ceil(vp.height*dpr);await p.render({canvasContext:c.getContext('2d'),viewport:p.getViewport({scale:dpr})}).promise;const page={width:vp.width,height:vp.height,canvas:c};state.pages[index]=page;return page})().finally(()=>delete state.pagePromises[index]);
 return state.pagePromises[index];
}
async function renderCurrentPage(){
 const workspace=$('#pdf-workspace');const page=await loadPage(state.page-1);if(!page)return;
 $('#page-label').textContent='الصفحة '+state.page;$('#page-size').textContent=`${Math.round(page.width)} × ${Math.round(page.height)} pt`;
 workspace.innerHTML='';const wrap=document.createElement('div');wrap.className='pdf-page-wrap';wrap.style.width=(page.width*state.scale)+'px';wrap.style.height=(page.height*state.scale)+'px';
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(page.canvas.width);canvas.height=Math.ceil(page.canvas.height);canvas.style.width='100%';canvas.style.height='100%';canvas.getContext('2d').drawImage(page.canvas,0,0);wrap.appendChild(canvas);
 const overlay=document.createElement('div');overlay.className='pdf-page-overlay';wrap.appendChild(overlay);workspace.appendChild(wrap);
 if(state.addMode)workspace.classList.add('add-mode');else workspace.classList.remove('add-mode');
 overlay.addEventListener('pointerdown',e=>{if(e.target!==overlay||!state.addMode)return;const r=overlay.getBoundingClientRect();const x=(e.clientX-r.left)/state.scale,y=(e.clientY-r.top)/state.scale;const f=fieldDefault(state.page,Math.max(0,x-90),Math.max(0,y-16));state.fields.push(f);state.selected=f.id;state.addMode=false;$('#add-field').classList.remove('active');commitHistory();renderCurrentPage();updateProperties();});
 state.fields.filter(f=>Number(f.page)===state.page).forEach(f=>renderField(overlay,f));
}
function renderField(overlay,f){
 const el=document.createElement('div');el.className='field-box '+(f.type==='checkbox'?'checkbox':'')+(f.type==='signature'?' signature':'')+(state.selected===f.id?' selected':'');
 el.style.left=(f.x*state.scale)+'px';el.style.top=(f.y*state.scale)+'px';el.style.width=(f.width*state.scale)+'px';el.style.height=(f.height*state.scale)+'px';
 const lab=document.createElement('span');lab.className='field-label';lab.textContent=fieldLabel(f);el.appendChild(lab);
 const prev=document.createElement('span');prev.className='preview-text';prev.dir=f.direction;prev.style.textAlign=f.align;prev.style.fontSize=(f.font_size*state.scale)+'px';prev.textContent=f.type==='signature'?'مكان التوقيع':f.type==='checkbox'?'☐':f.type==='static'?(f.static_value||'نص ثابت'):(f.placeholder||f.name||'نص الحقل');el.appendChild(prev);
 const handle=document.createElement('span');handle.className='resize-handle';el.appendChild(handle);
 el.addEventListener('pointerdown',e=>{e.stopPropagation();state.selected=f.id;updateProperties();if(e.target===handle){startResize(e,el,f)}else startMove(e,el,f)});
}
function startMove(e,el,f){el.setPointerCapture(e.pointerId);const sx=e.clientX,sy=e.clientY,ox=f.x,oy=f.y;const page=state.pages[state.page-1];const move=ev=>{f.x=Math.max(0,Math.min(page.width-f.width,ox+(ev.clientX-sx)/state.scale));f.y=Math.max(0,Math.min(page.height-f.height,oy+(ev.clientY-sy)/state.scale));el.style.left=f.x*state.scale+'px';el.style.top=f.y*state.scale+'px'};const up=()=>{el.releasePointerCapture(e.pointerId);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);commitHistory()};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)}
function startResize(e,el,f){el.setPointerCapture(e.pointerId);const sx=e.clientX,sy=e.clientY,ow=f.width,oh=f.height;const page=state.pages[state.page-1];const move=ev=>{f.width=Math.max(20,Math.min(page.width-f.x,ow+(sx-ev.clientX)/state.scale));f.height=Math.max(12,Math.min(page.height-f.y,oh+(ev.clientY-sy)/state.scale));el.style.width=f.width*state.scale+'px';el.style.height=f.height*state.scale+'px'};const up=()=>{el.releasePointerCapture(e.pointerId);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);commitHistory()};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)}
function selectedField(){return state.fields.find(f=>f.id===state.selected)}
function updateProperties(){
 const f=selectedField(),none=$('#no-selection'),p=$('#properties');none.classList.toggle('hidden',!!f);p.classList.toggle('hidden',!f);if(!f){updateHistoryButtons();return}
 $('#prop-name').value=f.name;$('#prop-type').value=f.type;$('#prop-font').value=f.font_size;$('#prop-align').value=f.align;$('#prop-dir').value=f.direction;$('#prop-tab').value=f.tab_order;$('#prop-required').checked=f.required;$('#prop-min').value=f.min_length??'';$('#prop-max').value=f.max_length??'';$('#prop-placeholder').value=f.placeholder||'';$('#prop-options').value=(f.options||[]).join('\n');$('#prop-static').value=f.static_value||'';
 $('#options-wrap').classList.toggle('hidden',!['select','radio'].includes(f.type));$('#static-wrap').classList.toggle('hidden',f.type!=='static');updateHistoryButtons();
}
function refreshSelectedVisual(){const f=selectedField(),el=document.querySelector('.field-box.selected');if(!f||!el)return;el.style.left=f.x*state.scale+'px';el.style.top=f.y*state.scale+'px';el.style.width=f.width*state.scale+'px';el.style.height=f.height*state.scale+'px';const lab=el.querySelector('.field-label'),prev=el.querySelector('.preview-text');if(lab)lab.textContent=fieldLabel(f);if(prev){prev.dir=f.direction;prev.style.textAlign=f.align;prev.style.fontSize=(f.font_size*state.scale)+'px';prev.textContent=f.type==='signature'?'مكان التوقيع':f.type==='checkbox'?'☐':f.type==='static'?(f.static_value||'نص ثابت'):(f.placeholder||f.name||'نص الحقل')}} 
function bindProp(id,fn,event='input'){const el=$(id);el.addEventListener(event,()=>{const f=selectedField();if(!f)return;fn(f,el);if(event==='change'&&id==='#prop-type')renderCurrentPage();else refreshSelectedVisual();updateHistoryButtons();clearTimeout(state.saveTimer);state.saveTimer=setTimeout(()=>commitHistory(),500)})}
bindProp('#prop-name',(f,e)=>f.name=e.value);
bindProp('#prop-type',(f,e)=>f.type=e.value,'change');
bindProp('#prop-font',(f,e)=>f.font_size=Number(e.value)||12);
bindProp('#prop-align',(f,e)=>f.align=e.value,'change');
bindProp('#prop-dir',(f,e)=>f.direction=e.value,'change');
bindProp('#prop-tab',(f,e)=>f.tab_order=Math.max(0,Number(e.value)||0));
bindProp('#prop-required',(f,e)=>f.required=e.checked,'change');
bindProp('#prop-min',(f,e)=>f.min_length=e.value===''?null:Number(e.value));
bindProp('#prop-max',(f,e)=>f.max_length=e.value===''?null:Number(e.value));
bindProp('#prop-placeholder',(f,e)=>f.placeholder=e.value);
bindProp('#prop-options',(f,e)=>f.options=e.value.split(/\n/).map(x=>x.trim()).filter(Boolean).slice(0,100));
bindProp('#prop-static',(f,e)=>f.static_value=e.value);
$('#add-field').onclick=()=>{state.addMode=!state.addMode;$('#add-field').classList.toggle('active',state.addMode);toast(state.addMode?'انقر داخل الـPDF لتحديد مكان الحقل':'تم إلغاء الإضافة')};
$('#delete-field').onclick=()=>{if(!state.selected)return;state.fields=state.fields.filter(f=>f.id!==state.selected);state.selected=null;commitHistory();renderCurrentPage();updateProperties()};
$('#copy-field').onclick=()=>{const f=selectedField();if(!f)return;const c={...f,id:'f-'+crypto.randomUUID(),x:f.x+12,y:f.y+12,name:f.name+' — نسخة'};state.fields.push(c);state.selected=c.id;commitHistory();renderCurrentPage();updateProperties()};
$('#undo-btn').onclick=undo;$('#redo-btn').onclick=redo;
$('#zoom-in').onclick=()=>{state.scale=Math.min(2.5,state.scale+.1);renderCurrentPage();$('#zoom-value').textContent=Math.round(state.scale*100)+'%'};
$('#zoom-out').onclick=()=>{state.scale=Math.max(.55,state.scale-.1);renderCurrentPage();$('#zoom-value').textContent=Math.round(state.scale*100)+'%'};
async function fetchPdfBytes(url,options={},timeoutMs=20000){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const r=await fetch(url,{...options,signal:controller.signal,cache:'no-store'});
  if(!r.ok)throw new Error('تعذر تحميل ملف PDF الأصلي ('+r.status+')');
  const b=await r.arrayBuffer();if(!b.byteLength)throw new Error('ملف PDF فارغ أو غير صالح');return b;
 }catch(e){if(e.name==='AbortError')throw new Error('انتهت مهلة تحميل ملف PDF. تحقق من رابط الملف أو حجم الملف ثم أعد المحاولة.');throw e}
 finally{clearTimeout(timer)}
}
async function loadPdf(){
 $('#pdf-workspace').innerHTML='<div class="loading-state">1/3 — جاري الاتصال بملف النموذج…<br><small>يتم التحقق من ملف PDF</small></div>';
 try{
  const directUrl=String(state.resource?.file_url||'').trim();if(!directUrl)throw new Error('رابط ملف PDF غير موجود في بيانات الملف');
  let bytes;
  try{bytes=await fetchPdfBytes(directUrl,{mode:'cors'},20000)}
  catch(e){$('#pdf-workspace').innerHTML='<div class="loading-state">2/3 — جاري استخدام مسار التحميل الآمن…<br><small>المسار المباشر لم يستجب، تتم المحاولة عبر الموقع</small></div>';bytes=await fetchPdfBytes('/api/admin/forms/'+resourceId+'/source',{headers:{Authorization:'Bearer '+token}},20000)}
  $('#pdf-workspace').innerHTML='<div class="loading-state">3/3 — جاري تجهيز الصفحة الأولى…<br><small>يتم تحليل ملف PDF</small></div>';
  state.pdf=await pdfjsLib.getDocument({data:new Uint8Array(bytes),disableAutoFetch:true,disableStream:true,disableRange:true,disableWorker:true}).promise;
  if(!state.pdf.numPages)throw new Error('ملف PDF لا يحتوي على صفحات');
  state.pages=new Array(state.pdf.numPages);state.pagePromises={};renderPageList();await renderCurrentPage();
  for(let i=1;i<state.pdf.numPages;i++)loadPage(i).catch(()=>{});
 }catch(e){throw e}
}
async function load(){
 try{$('#pdf-workspace').innerHTML='<div class="loading-state">جاري تحميل بيانات الملف…</div>';const d=await api('/api/admin/forms/'+resourceId);state.resource=d.resource;state.form=d.form;state.fields=(d.fields||[]).map(f=>({...f,id:String(f.id),options:f.options||[],settings:f.settings||{}}));$('#form-title').textContent=state.resource.title;state.history=[snapshot()];updateHistoryButtons();await loadPdf();setSave('لم يتم تعديل شيء');}
 catch(e){$('#pdf-workspace').innerHTML=`<div class="loading-state">${esc(e.message)}</div>`;toast(e.message,'error')}
}
function scheduleSave(){clearTimeout(state.saveTimer);state.saveTimer=setTimeout(save,900);setSave('حفظ تلقائي قريب…')}
async function save(){
 if(state.saving)return;state.saving=true;setSave('جاري الحفظ…');
 try{const d=await api('/api/admin/forms/'+resourceId,{method:'PUT',body:JSON.stringify({enabled:true,fields:state.fields.map((f,i)=>({...f,tab_order:Number(f.tab_order)||i}))})});state.form=d.form;state.fields=(d.fields||[]).map(f=>({...f,id:String(f.id),options:f.options||[],settings:f.settings||{}}));state.history=[snapshot()];state.future=[];updateHistoryButtons();setSave('تم الحفظ','success');toast('تم حفظ تصميم النموذج','success')}
 catch(e){setSave('فشل الحفظ','error');toast(e.message,'error')}
 finally{state.saving=false}
}

$('#copy-form-btn').onclick=async()=>{if(!confirm('سيتم إنشاء ملف جديد كمسودة مع نفس ملف PDF وتصميم الحقول. هل تريد المتابعة؟'))return;try{const d=await api('/api/admin/forms/'+resourceId+'/copy',{method:'POST'});toast('تم إنشاء النسخة كمسودة','success');setTimeout(()=>location.href='/form-designer.html?id='+encodeURIComponent(d.id),700)}catch(e){toast(e.message,'error')}};

$('#save-btn').onclick=save;
$('#preview-btn').onclick=()=>window.open('/form-fill.html?id='+encodeURIComponent(resourceId),'_blank','noopener');
window.addEventListener('beforeunload',e=>{if(state.history.length>1&&state.saveTimer){e.preventDefault();e.returnValue='';}});
load();
