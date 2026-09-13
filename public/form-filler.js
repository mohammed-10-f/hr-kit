
async function loadExternalScript(urls, label){
  if(label==='PDF.js' && window.pdfjsLib) return window.pdfjsLib;
  if(label==='PDF-Lib' && window.PDFLib) return window.PDFLib;
  let last;
  for(const url of urls){
    try{
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        let done=false;
        const timer=setTimeout(()=>{if(done)return;done=true;script.remove();reject(new Error('انتهت مهلة تحميل '+label));},8000);
        script.onload=()=>{if(done)return;done=true;clearTimeout(timer);resolve()};
        script.onerror=()=>{if(done)return;done=true;clearTimeout(timer);script.remove();reject(new Error('تعذر تحميل '+label))};
        script.src=url;script.async=true;document.head.appendChild(script);
      });
      if(label==='PDF.js' && window.pdfjsLib) return window.pdfjsLib;
      if(label==='PDF-Lib' && window.PDFLib) return window.PDFLib;
      throw new Error('تم تحميل '+label+' لكن المكتبة غير متاحة');
    }catch(e){last=e}
  }
  throw last||new Error('تعذر تحميل '+label);
}
async function ensurePdfJs(){
  if(window.pdfjsLib) return window.pdfjsLib;
  const lib=await loadExternalScript([
    '/api/pdf-engine/pdfjs',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'
  ],'PDF.js');
  if(lib.GlobalWorkerOptions) lib.GlobalWorkerOptions.workerSrc='';
  return lib;
}
const $=s=>document.querySelector(s);
const qs=new URLSearchParams(location.search),resourceId=Number(qs.get('id'));
if(!resourceId){document.body.innerHTML='<main class="loading-state">رابط النموذج غير صحيح.</main>';throw new Error('Missing resource id')}
const state={data:null,pdf:null,pages:[],scale:1,values:{},rendered:false};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const draftKey='hrkit_form_draft_'+resourceId;
function toast(msg,type=''){const el=$('#toast');el.textContent=msg;el.className='fb-toast show '+type;clearTimeout(window._toast);window._toast=setTimeout(()=>el.className='fb-toast',2800)}
function fieldKey(f){return String(f.id)}
function getValue(f){return state.values[fieldKey(f)]??''}
function setValue(f,v){state.values[fieldKey(f)]=v;saveDraft();updateSummary();const el=document.querySelector(`[data-field-id="${CSS.escape(fieldKey(f))}"]`);if(el&&f.type!=='static'&&f.type!=='signature')updateFieldDisplay(f,el)}
function displayValue(f,v){if(f.type==='date'&&v){const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:v}return String(v??'')}
function loadDraft(){try{const d=JSON.parse(localStorage.getItem(draftKey)||'{}');if(d&&typeof d==='object')state.values=d.values||{}}catch{}}
function saveDraft(){try{localStorage.setItem(draftKey,JSON.stringify({values:state.values,savedAt:new Date().toISOString()}));$('#draft-state').textContent='محفوظ محليًا الآن'}catch{ $('#draft-state').textContent='الحفظ المحلي غير متاح'}}
function updateSummary(){const wrap=$('#field-summary');wrap.innerHTML=state.data.fields.filter(f=>!['static','signature'].includes(f.type)).sort((a,b)=>(a.tab_order||0)-(b.tab_order||0)).map(f=>`<button type="button" class="${f.required?'required':''}" data-jump="${esc(f.id)}">${esc(f.name)}</button>`).join('')||'<span class="side-note">لا توجد حقول تعبئة.</span>';wrap.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{const el=document.querySelector(`[data-field-id="${CSS.escape(b.dataset.jump)}"]`);el?.scrollIntoView({behavior:'smooth',block:'center'});el?.focus()})}
function pageFieldValues(page){return state.data.fields.filter(f=>Number(f.page)===page)}
function wrapText(ctx,text,maxWidth){const words=String(text||'').split(/\s+/);const lines=[];let line='';for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width<=maxWidth||!line)line=test;else{lines.push(line);line=word}}if(line)lines.push(line);return lines}
function makeTextCanvas(text,f,forPreview=false){const ratio=forPreview?1:2,pad=Math.max(2,Math.round(f.font_size*.18)),w=Math.max(20,Math.ceil(f.width*ratio)),h=Math.max(12,Math.ceil(f.height*ratio));const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.clearRect(0,0,w,h);const size=Math.max(6,f.font_size)*ratio;ctx.font=`${size}px "IBM Plex Sans Arabic", Tahoma, Arial, sans-serif`;ctx.fillStyle='#111';ctx.textBaseline='top';ctx.direction=f.direction||'rtl';ctx.textAlign=f.align||'right';const x=f.align==='left'?pad:f.align==='center'?w/2:w-pad;const lineH=size*1.28;const lines=f.type==='long_text'?wrapText(ctx,text,w-pad*2):[String(text||'')];const maxLines=Math.max(1,Math.floor((h-pad*2)/lineH));const visible=lines.slice(0,maxLines);visible.forEach((line,i)=>ctx.fillText(line,x,pad+i*lineH,Math.max(1,w-pad*2)));return c}
function updateFieldDisplay(f,el){if(f.type==='checkbox'){el.textContent=getValue(f)?'✓':'☐';return}if(f.type==='signature'){return}if(f.type==='static'){el.textContent=f.static_value||'';return}if(el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.tagName==='SELECT')return}
function createInput(f,scale){const v=getValue(f),w=f.width*scale,h=f.height*scale;let el;
 if(f.type==='static'){el=document.createElement('div');el.className='fill-field static';el.textContent=f.static_value||''}
 else if(f.type==='signature'){el=document.createElement('div');el.className='fill-field fill-signature';el.textContent='مكان التوقيع'}
 else if(f.type==='checkbox'){el=document.createElement('button');el.type='button';el.className='fill-field fill-checkbox';el.textContent=v?'✓':'☐';el.setAttribute('aria-label',f.name);el.onclick=()=>setValue(f,!getValue(f))}
 else if(f.type==='select'){el=document.createElement('select');el.className='fill-field';const empty=document.createElement('option');empty.value='';empty.textContent=f.placeholder||'اختر…';el.appendChild(empty);(f.options||[]).forEach(o=>{const op=document.createElement('option');op.value=o;op.textContent=o;el.appendChild(op)});el.value=v;el.oninput=()=>setValue(f,el.value)}
 else if(f.type==='radio'){el=document.createElement('select');el.className='fill-field';const empty=document.createElement('option');empty.value='';empty.textContent=f.placeholder||'اختر…';el.appendChild(empty);(f.options||[]).forEach(o=>{const op=document.createElement('option');op.value=o;op.textContent=o;el.appendChild(op)});el.value=v;el.oninput=()=>setValue(f,el.value)}
 else {el=document.createElement(f.type==='long_text'?'textarea':'input');el.className='fill-field '+(f.type==='long_text'?'long':'');el.value=v;el.placeholder=f.placeholder||'';el.dir=f.direction||'rtl';el.style.textAlign=f.align||'right';el.style.fontSize=Math.max(8,f.font_size*scale)+'px';if(f.type==='number')el.inputMode='numeric';if(f.type==='date')el.type='date';if(f.max_length)el.maxLength=f.max_length;el.oninput=()=>{if(f.type==='number'&&el.value&&!/^[0-9٠-٩]*$/.test(el.value))el.value=el.value.replace(/[^\d٠-٩]/g,'');setValue(f,el.value)}}
 el.dataset.fieldId=fieldKey(f);el.style.left=f.x*scale+'px';el.style.top=f.y*scale+'px';el.style.width=w+'px';el.style.height=h+'px';el.style.fontSize=Math.max(8,f.font_size*scale)+'px';el.style.fontFamily='"IBM Plex Sans Arabic", Tahoma, Arial, sans-serif';return el}
async function renderPages(){const ws=$('#fill-workspace');ws.innerHTML='';for(let i=1;i<=state.pdf.numPages;i++){const page=state.pages[i-1];const wrap=document.createElement('div');wrap.className='pdf-page-wrap';if(!page){wrap.classList.add('pdf-page-loading');wrap.style.width='794px';wrap.style.minHeight='1123px';wrap.innerHTML='<div class="loading-state">جاري تجهيز الصفحة…</div>';ws.appendChild(wrap);continue}wrap.style.width=page.width*state.scale+'px';wrap.style.height=page.height*state.scale+'px';const c=document.createElement('canvas');c.width=page.canvas.width;c.height=page.canvas.height;c.style.width='100%';c.style.height='100%';c.getContext('2d').drawImage(page.canvas,0,0);wrap.appendChild(c);const overlay=document.createElement('div');overlay.className='pdf-page-overlay';pageFieldValues(i).forEach(f=>overlay.appendChild(createInput(f,state.scale)));wrap.appendChild(overlay);ws.appendChild(wrap)}state.rendered=true}
async function loadPage(index){if(state.pages[index])return state.pages[index];state.pagePromises=state.pagePromises||{};if(state.pagePromises[index])return state.pagePromises[index];state.pagePromises[index]=(async()=>{const p=await state.pdf.getPage(index+1),vp=p.getViewport({scale:1}),dpr=Math.min(2,window.devicePixelRatio||1),c=document.createElement('canvas');c.width=Math.ceil(vp.width*dpr);c.height=Math.ceil(vp.height*dpr);await p.render({canvasContext:c.getContext('2d'),viewport:p.getViewport({scale:dpr})}).promise;return state.pages[index]={width:vp.width,height:vp.height,canvas:c}})().finally(()=>delete state.pagePromises[index]);return state.pagePromises[index]}
async function fetchArrayBufferWithTimeout(url, options={}, timeoutMs=20000){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetch(url,{...options,signal:controller.signal,cache:'no-store'});
  if(!response.ok)throw new Error('تعذر تحميل ملف PDF الأصلي ('+response.status+')');
  const bytes=await response.arrayBuffer();
  if(!bytes.byteLength)throw new Error('ملف PDF فارغ أو غير صالح');
  return bytes;
 }catch(e){
  if(e.name==='AbortError')throw new Error('انتهت مهلة تحميل ملف PDF. تحقق من رابط الملف أو حجم الملف ثم أعد المحاولة.');
  throw e;
 }finally{clearTimeout(timer)}
}
async function loadPdf(){
 try{ await ensurePdfJs(); }catch(e){ throw new Error('تعذر تشغيل محرك PDF: '+e.message); }
 try{
  $('#fill-workspace').innerHTML='<div class="loading-state">1/3 — جاري الاتصال بملف النموذج…<br><small>يتم التحقق من ملف PDF</small></div>';
  const directUrl=String(state.data?.resource?.file_url||'').trim();
  if(!directUrl)throw new Error('رابط ملف PDF غير موجود في بيانات النموذج');
  let bytes;
  try{
   // Prefer the original public file URL. This avoids proxying a large GitHub release through the Worker.
   bytes=await fetchArrayBufferWithTimeout(directUrl,{mode:'cors'},20000);
  }catch(directError){
   $('#fill-workspace').innerHTML='<div class="loading-state">2/3 — جاري استخدام مسار التحميل الآمن…<br><small>المسار المباشر لم يستجب، تتم المحاولة عبر الموقع</small></div>';
   bytes=await fetchArrayBufferWithTimeout('/api/forms/'+resourceId+'/source',{},20000);
  }
  $('#fill-workspace').innerHTML='<div class="loading-state">3/3 — جاري تجهيز الصفحة الأولى…<br><small>يتم تحليل ملف PDF</small></div>';
  state.pdf=await pdfjsLib.getDocument({data:new Uint8Array(bytes),disableAutoFetch:true,disableStream:true,disableRange:true,disableWorker:true}).promise;
  if(!state.pdf.numPages)throw new Error('ملف PDF لا يحتوي على صفحات');
  state.pages=new Array(state.pdf.numPages);state.pagePromises={};
  const first=await loadPage(0);
  if(first){const available=Math.min(900,document.querySelector('.fill-main').clientWidth-20);state.scale=Math.min(1.4,Math.max(.65,available/first.width));}
  await renderPages();
  for(let i=1;i<state.pdf.numPages;i++)loadPage(i).then(()=>renderPages()).catch(()=>{});
 }catch(e){throw e}
}
function normalizeDigits(v){return String(v||'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))}
function validateField(f){const v=getValue(f);if(f.required&&(!String(v).trim()||v===false))return `الحقل "${f.name}" مطلوب`;if(v===false||v==='')return '';if(f.min_length&&String(v).length<f.min_length)return `الحقل "${f.name}" يجب ألا يقل عن ${f.min_length} أحرف`;if(f.max_length&&String(v).length>f.max_length)return `الحقل "${f.name}" تجاوز الحد المسموح`;if(f.type==='number'&&!/^\d+$/.test(normalizeDigits(v)))return `الحقل "${f.name}" يقبل الأرقام فقط`;if(f.type==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(v))return `التاريخ في "${f.name}" غير صحيح`;return ''}
function validateAll(){document.querySelectorAll('.fill-field').forEach(e=>e.classList.remove('invalid'));for(const f of state.data.fields){const err=validateField(f);if(err){const el=document.querySelector(`[data-field-id="${CSS.escape(fieldKey(f))}"]`);el?.classList.add('invalid');el?.scrollIntoView({behavior:'smooth',block:'center'});el?.focus?.();return err}}return ''}
async function generatePdf(){
 try{ if(!window.PDFLib){ await loadExternalScript(['/api/pdf-engine/pdf-lib','https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js','https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'],'PDF-Lib'); } }catch(e){ toast('تعذر تشغيل محرك إنشاء PDF: '+e.message,'error'); return; }
 const err=validateAll();if(err){toast(err,'error');return}
 const btn=$('#generate-btn');btn.disabled=true;btn.textContent='جاري إنشاء PDF…';
 try{await document.fonts?.ready;const bytes=await (async()=>{try{return await fetchArrayBufferWithTimeout(String(state.data.resource.file_url||''),{mode:'cors'},20000)}catch(e){return await fetchArrayBufferWithTimeout('/api/forms/'+resourceId+'/source',{},20000)}})();const doc=await PDFLib.PDFDocument.load(bytes);const pages=doc.getPages();
 for(const f of state.data.fields){const value=f.type==='static'?f.static_value:getValue(f);if(f.type==='signature'||value===''||value===false)continue;const page=pages[f.page-1];if(!page)continue;let text=displayValue(f,value);if(f.type==='checkbox')text='✓';const c=makeTextCanvas(text,f,false);const img=await doc.embedPng(c.toDataURL('image/png'));const ph=page.getHeight();page.drawImage(img,{x:f.x,y:ph-f.y-f.height,width:f.width,height:f.height})}
 const out=await doc.save();const blob=new Blob([out],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');const base=(state.data.resource.file_name||state.data.resource.title||'form').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'-');a.href=url;a.download=base+'-filled-'+Date.now()+'.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('تم إنشاء النموذج بنجاح','success')
 }catch(e){console.error(e);toast('تعذر إنشاء PDF. حاول مرة أخرى.','error')}finally{btn.disabled=false;btn.textContent='إنشاء النموذج'}}
$('#generate-btn').onclick=generatePdf;
$('#reset-btn').onclick=()=>{if(!confirm('سيتم مسح جميع البيانات المدخلة في هذا النموذج. هل تريد المتابعة؟'))return;state.values={};localStorage.removeItem(draftKey);renderPages();updateSummary();toast('تمت إعادة تعيين النموذج','success')};
window.addEventListener('resize',()=>{clearTimeout(window._resize);window._resize=setTimeout(()=>{if(state.rendered)renderPages()},250)});
async function load(){try{ $('#fill-workspace').innerHTML='<div class="loading-state">جاري تحميل بيانات النموذج…</div>'; const d=await fetchArrayBufferWithTimeout('/api/forms/'+resourceId,{headers:{Accept:'application/json'}},15000); const x=JSON.parse(new TextDecoder().decode(d)); if(!x||!x.resource)throw new Error('تعذر تحميل بيانات النموذج'); state.data=x;$('#form-title').textContent=x.resource.title;$('#heading').textContent=x.resource.title;loadDraft();await loadPdf();updateSummary()}catch(e){$('#fill-workspace').innerHTML=`<div class="loading-state">${esc(e.message)}</div>`;toast(e.message,'error')}}
load();