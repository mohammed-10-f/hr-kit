const $=s=>document.querySelector(s);
let activeCategory="",allCategories=[],lastResources=[],firstLoad=true;

const iconSvg=(name)=>({'document':'<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 13h6M9 17h6"/></svg>','mail':'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>','folder':'<svg viewBox="0 0 24 24"><path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7a2 2 0 0 1 2-2h5l2 2"/></svg>','clipboard':'<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8 9h8M8 13h8M8 17h5"/></svg>','archive':'<svg viewBox="0 0 24 24"><path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6"/></svg>','users':'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M18 15c2.2.5 3 2 3 4"/></svg>','settings':'<svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="4"/></svg>','briefcase':'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5h8v2M3 12h18M10 12v2h4v-2"/></svg>','file':'<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4"/></svg>','calendar':'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6"/></svg>','clock':'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>','check':'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>','star':'<svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/></svg>','shield':'<svg viewBox="0 0 24 24"><path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>','lock':'<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>','globe':'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>','link':'<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>','chart':'<svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-6"/></svg>','book':'<svg viewBox="0 0 24 24"><path d="M4 5a3 3 0 0 1 3-2h5v17H7a3 3 0 0 0-3 2zM20 5a3 3 0 0 0-3-2h-5v17h5a3 3 0 0 1 3 2z"/></svg>','calculator':'<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2M8 18h8"/></svg>','edit':'<svg viewBox="0 0 24 24"><path d="m4 16-1 5 5-1L20 8l-4-4zM14 6l4 4"/></svg>','phone':'<svg viewBox="0 0 24 24"><path d="M7 3h3l2 5-2 2a13 13 0 0 0 4 4l2-2 5 2v3c0 1-1 2-2 2C11 19 5 13 5 5c0-1 1-2 2-2z"/></svg>','location':'<svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/></svg>','heart':'<svg viewBox="0 0 24 24"><path d="M20 8c0 5-8 11-8 11S4 13 4 8a4 4 0 0 1 7-2 4 4 0 0 1 7 2z"/></svg>','people':'<svg viewBox="0 0 24 24"><circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2.5 20c.5-3 2.5-5 5.5-5s5 2 5.5 5M10.5 20c.5-2.5 2.5-4 5.5-4 3 0 5 1.5 5.5 4"/></svg>','briefcase2':'<svg viewBox="0 0 24 24"><path d="M4 7h16v13H4z"/><path d="M8 7V4h8v3M4 12h16M10 12v2h4v-2"/></svg>','paperclip':'<svg viewBox="0 0 24 24"><path d="m9 12 6-6a4 4 0 0 1 6 6l-7 7a5 5 0 0 1-7-7l7-7a3 3 0 0 1 4 4l-7 7a1 1 0 0 1-2-2l6-6"/></svg>','upload':'<svg viewBox="0 0 24 24"><path d="M12 16V4M8 8l4-4 4 4M5 14v5h14v-5"/></svg>','download':'<svg viewBox="0 0 24 24"><path d="M12 4v12M8 12l4 4 4-4M5 20h14"/></svg>','filter':'<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>','search':'<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>','folder-open':'<svg viewBox="0 0 24 24"><path d="M3 7h7l2 2h9l-2 11H4z"/><path d="M3 7a2 2 0 0 1 2-2h5l2 2"/></svg>','file-text':'<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 12h6M9 16h6"/></svg>','file-spreadsheet':'<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 12h6M9 16h6M12 12v6"/></svg>','file-presentation':'<svg viewBox="0 0 24 24"><path d="M4 4h16v11H4z"/><path d="M12 15v5M8 20h8M8 8h8M8 11h5"/></svg>','folder-tree':'<svg viewBox="0 0 24 24"><path d="M5 5h6v5H5zM13 14h6v5h-6zM5 14h6v5H5zM11 7h2v9M7 10v4M13 16h-2"/></svg>','archive-box':'<svg viewBox="0 0 24 24"><path d="M4 8h16v12H4zM3 4h18v4H3zM9 12h6"/></svg>','bookmark':'<svg viewBox="0 0 24 24"><path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-3-6 3z"/></svg>','info':'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>','flag':'<svg viewBox="0 0 24 24"><path d="M6 21V4M6 5h11l-2 4 2 4H6"/></svg>','checklist':'<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg>','image':'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 18 5-5 4 4 3-3 4 4"/></svg>'}[name]||'<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 13h6M9 17h6"/></svg>');

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const escRegExp=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function highlight(text,q){const t=esc(text);if(!q)return t;try{const re=new RegExp('('+escRegExp(q)+')','ig');return t.replace(re,'<mark>$1</mark>')}catch{return t}}

function fileInfo(r){const n=(r.file_name||'').toLowerCase(),t=(r.file_type||'').toLowerCase();if(t.includes('spreadsheet')||t==='excel'||/\.(xlsx?|csv)$/.test(n))return ['XLSX','excel'];if(t.includes('pdf')||t==='pdf'||/\.pdf$/.test(n))return ['PDF','pdf'];if(t.includes('word')||t==='word'||/\.docx?$/.test(n))return ['DOCX','doc'];if(t.includes('presentation')||t==='powerpoint'||/\.pptx?$/.test(n))return ['PPT','ppt'];if(t.includes('zip')||/\.zip$/.test(n))return ['ZIP','zip'];if(t.includes('image')||/\.(png|jpe?g|webp|gif)$/.test(n))return ['IMG','image'];return ['FILE','file']}
function fileIconMark(cls){if(cls==='excel')return '<img src="/assets/excel.svg" alt="" loading="lazy">';const map={pdf:'file-text',doc:'document',ppt:'file-presentation',zip:'archive-box',image:'image',file:'file'};return iconSvg(map[cls]||'file')}

async function getJSON(url,opts={}){const r=await fetch(url,opts);if(!r.ok){let d={};try{d=await r.json()}catch{}throw Object.assign(new Error(d.error||'تعذر تحميل البيانات'),{status:r.status})}return r.json()}

function applySettings(s){[['#header-x',s.x],['#footer-x',s.x],['#header-linkedin',s.linkedin],['#footer-linkedin',s.linkedin]].forEach(([id,url])=>{const e=$(id);if(!e)return;e.hidden=!url;e.href=url||'#'});const email=$('#footer-email');if(email){email.hidden=!s.email;email.textContent=s.email||''};['#suggestion-link'].forEach(id=>{const e=$(id);if(e){e.href=s.suggestion||'#';e.classList.toggle('disabled-link',!s.suggestion)}});$('#year').textContent=new Date().getFullYear()}
async function loadSettings(){try{applySettings(await getJSON('/api/settings'))}catch{applySettings({})}}

function skeletonCategories(n){return Array.from({length:n}).map(()=>'<div class="category-card skeleton"><span class="category-icon skel-block"></span><span><strong class="skel-line" style="width:70%"></strong><small class="skel-line" style="width:40%"></small></span></div>').join('')}
function skeletonList(n){return Array.from({length:n}).map(()=>'<article class="public-list-item skeleton"><span class="file-icon skel-block"></span><div class="public-list-main"><strong class="skel-line" style="width:65%"></strong><small class="skel-line" style="width:35%"></small></div></article>').join('')}
function skeletonCards(n){return Array.from({length:n}).map(()=>'<article class="resource-card skeleton"><span class="file-icon skel-block"></span><strong class="skel-line" style="width:80%"></strong><small class="skel-line" style="width:50%"></small></article>').join('')}

async function loadCategories(){
 if(firstLoad)$('#categories-list').innerHTML=skeletonCategories(6);
 allCategories=await getJSON('/api/categories');
 $('#categories-list').innerHTML=allCategories.length?allCategories.map(c=>`<button class="category-card ${activeCategory===c.slug?'active':''}" data-cat="${esc(c.slug)}" type="button" aria-pressed="${activeCategory===c.slug}"><span class="category-icon">${iconSvg(c.icon||'folder')}</span><span><strong>${esc(c.name)}</strong><small>${Number(c.resource_count||0).toLocaleString('ar-SA')} ملف</small></span></button>`).join(''):'<p class="muted-note">لا توجد أقسام متاحة حاليًا.</p>';
 document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{activeCategory=activeCategory===b.dataset.cat?'':b.dataset.cat;loadCategories();loadResources();document.querySelector('#resources').scrollIntoView({behavior:'smooth',block:'start'})});
}

function updateLibraryHeading(q){
 const title=$('#results-title'),count=$('#results-count'),clear=$('#clear-filter');
 if(activeCategory){const cat=allCategories.find(c=>c.slug===activeCategory);title.textContent=cat?.name||'ملفات القسم';count.textContent=lastResources.length?`${lastResources.length.toLocaleString('ar-SA')} ملف${q?' مطابق للبحث':''}`:'لا توجد ملفات في هذا القسم';clear.textContent=q?'مسح البحث':'العودة إلى جميع الأقسام';}
 else if(q){title.textContent='نتائج البحث';count.textContent=lastResources.length?`${lastResources.length.toLocaleString('ar-SA')} ملف مطابق`:'لم يتم العثور على ملفات';clear.textContent='مسح البحث';}
 else{title.textContent='أحدث الملفات';count.textContent=lastResources.length?`${lastResources.length.toLocaleString('ar-SA')} ملف`:'أحدث الملفات';clear.textContent='عرض جميع الأقسام';}
}

function visitorId(){let id=localStorage.getItem('hr_reference_visitor_id');if(!id){id=crypto.randomUUID?crypto.randomUUID():(Date.now()+'-'+Math.random().toString(36).slice(2));localStorage.setItem('hr_reference_visitor_id',id)}return id}
function reactionMarkup(r){const likes=Number(r.reaction_likes||0),dislikes=Number(r.reaction_dislikes||0);return `<div class="reactions" data-reaction-id="${r.id}"><button type="button" class="reaction-btn like" data-reaction="like" aria-label="إعجاب">👍 <b>${likes.toLocaleString('en-US')}</b></button><button type="button" class="reaction-btn dislike" data-reaction="dislike" aria-label="لم يعجبني">👎 <b>${dislikes.toLocaleString('en-US')}</b></button></div>`}
async function submitReaction(id,reaction,root){try{const d=await getJSON('/api/resources/'+id+'/reaction',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reaction,visitor_id:visitorId()})});root.querySelector('.like b').textContent=Number(d.likes||0).toLocaleString('en-US');root.querySelector('.dislike b').textContent=Number(d.dislikes||0).toLocaleString('en-US');root.querySelectorAll('.reaction-btn').forEach(b=>b.classList.toggle('selected',b.dataset.reaction===d.my_reaction));}catch(e){if(root)root.title=e.message||'تعذر حفظ التقييم'}}
function bindReactions(){document.querySelectorAll('[data-reaction-id]').forEach(root=>{root.querySelectorAll('.reaction-btn').forEach(b=>b.addEventListener('click',()=>submitReaction(Number(root.dataset.reactionId),b.dataset.reaction,root)))})}
function trackViews(){const seen=window._hrkitViewedResources||(window._hrkitViewedResources=new Set());document.querySelectorAll('[data-view-id]').forEach(el=>{const id=Number(el.dataset.viewId);if(seen.has(id))return;const io=new IntersectionObserver(entries=>{if(entries.some(x=>x.isIntersecting)){seen.add(id);fetch('/api/resources/'+id+'/view',{method:'POST'}).catch(()=>{});io.disconnect()}},{threshold:.35});io.observe(el)})}
function resourceCard(r,q){const [type,cls]=fileInfo(r);return `<article class="resource-card" data-view-id="${r.id}"><div class="file-icon ${cls}">${fileIconMark(cls)}</div><div class="resource-top"><span class="tag">${esc(r.category_names||'عام')}</span>${r.featured?`<span class="featured-mark" title="ملف مختار" aria-label="ملف مختار">${iconSvg('star')}</span>`:''}</div><h3>${highlight(r.title,q)}</h3><p>${highlight(r.description||'ملف من مرجع الموارد البشرية.',q)}</p><div class="meta">الإصدار ${esc(r.version||'1.0')} · ${Number(r.downloads||0).toLocaleString('ar-SA')} تحميل · ${Number(r.views||0).toLocaleString('ar-SA')} زيارة</div>${reactionMarkup(r)}<a class="download" href="/api/download/${encodeURIComponent(r.id)}"><span>تحميل الملف</span><span class="download-icon">${iconSvg('download')}</span></a></article>`}

function publicList(r,q){const [type,cls]=fileInfo(r);return `<article class="public-list-item" data-view-id="${r.id}"><div class="file-icon ${cls}">${fileIconMark(cls)}</div><div class="public-list-main"><strong>${highlight(r.title,q)}</strong><small>${esc(r.category_names||'عام')} · الإصدار ${esc(r.version||'1.0')}</small></div>${reactionMarkup(r)}<a class="list-download" href="/api/download/${encodeURIComponent(r.id)}" aria-label="تحميل ${esc(r.title)}"><span>تحميل</span><span class="download-icon">${iconSvg('download')}</span></a></article>`}

async function loadResources(){
 const q=$('#search').value.trim();
 if(firstLoad){$('#resources-list').innerHTML=skeletonList(6);$('#featured').innerHTML=skeletonCards(4)}
 const data=await getJSON(`/api/resources?q=${encodeURIComponent(q)}&category=${encodeURIComponent(activeCategory)}`);
 lastResources=data;updateLibraryHeading(q);
 $('#search').placeholder=activeCategory?(allCategories.find(c=>c.slug===activeCategory)?.name?`ابحث داخل ${allCategories.find(c=>c.slug===activeCategory).name}...`:'ابحث داخل القسم...'):'ابحث عن نموذج، سياسة، لائحة، ملف...';
 $('#resources-list').innerHTML=lastResources.map(r=>publicList(r,q)).join('');bindReactions();trackViews();
 $('#empty').classList.toggle('hidden',lastResources.length>0);
 const showFeatured=!q&&!activeCategory;
 if(showFeatured){const featured=await getJSON('/api/resources?featured=1');$('#featured').innerHTML=featured.map(r=>resourceCard(r,'')).join('');bindReactions();trackViews();$('#featured-section').classList.toggle('hidden',featured.length===0)}else $('#featured-section').classList.add('hidden');
 firstLoad=false;
}

function openNav(){$('#main-nav').classList.add('open');$('#nav-toggle').setAttribute('aria-expanded','true');$('#nav-backdrop').hidden=false;document.body.classList.add('no-scroll')}
function closeNav(){$('#main-nav').classList.remove('open');$('#nav-toggle').setAttribute('aria-expanded','false');$('#nav-backdrop').hidden=true;document.body.classList.remove('no-scroll')}

$('#search').addEventListener('input',()=>{clearTimeout(window._t);window._t=setTimeout(loadResources,180)});
$('#clear-filter').onclick=()=>{
 if(activeCategory){
  if($('#search').value.trim()){$('#search').value='';loadResources();return}
  activeCategory='';loadCategories();loadResources();document.querySelector('#categories').scrollIntoView({behavior:'smooth',block:'start'});return;
 }
 $('#search').value='';loadResources();window.scrollTo({top:0,behavior:'smooth'});
};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeNav()}});

$('#nav-toggle').addEventListener('click',()=>{$('#main-nav').classList.contains('open')?closeNav():openNav()});
$('#nav-backdrop').addEventListener('click',closeNav);
document.querySelectorAll('#main-nav a').forEach(a=>a.addEventListener('click',closeNav));

$('#header-search-btn').addEventListener('click',()=>{document.querySelector('#top').scrollIntoView({behavior:'smooth'});setTimeout(()=>$('#search').focus(),400)});
$('#cta-search').addEventListener('click',()=>$('#search').focus());
$('#cta-explore').addEventListener('click',()=>$('#categories').scrollIntoView({behavior:'smooth',block:'start'}));
$('#featured-view-all').addEventListener('click',()=>$('#resources').scrollIntoView({behavior:'smooth',block:'start'}));

let lastScroll=0;
window.addEventListener('scroll',()=>{const y=window.scrollY;document.querySelector('.site-header').classList.toggle('scrolled',y>10);lastScroll=y},{passive:true});

Promise.all([loadSettings(),loadCategories(),loadResources()]).catch(()=>{$('#resources-list').innerHTML='<div class="empty-state"><div class="empty-mark">!</div><strong>تعذر تحميل الملفات</strong><p>تأكد من اتصال الموقع بقاعدة البيانات.</p></div>'});
