const $=s=>document.querySelector(s);
let activeCategory="",allCategories=[],lastResources=[],firstLoad=true;

const iconSvg=(name)=>({'document':'<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 13h6M9 17h6"/></svg>','files':'<svg viewBox="0 0 24 24"><path d="M7 7V4a1 1 0 0 1 1-1h9l4 4v12a1 1 0 0 1-1 1h-3"/><path d="M3 8h9l3 3v9H3z"/><path d="M12 8v4h3"/></svg>','book':'<svg viewBox="0 0 24 24"><path d="M4 5a3 3 0 0 1 3-2h5v17H7a3 3 0 0 0-3 2zM20 5a3 3 0 0 0-3-2h-5v17h5a3 3 0 0 1 3 2z"/></svg>','book-open':'<svg viewBox="0 0 24 24"><path d="M3 5a3 3 0 0 1 3-2h6v17H6a3 3 0 0 0-3 2zM21 5a3 3 0 0 0-3-2h-6v17h6a3 3 0 0 1 3 2z"/></svg>','clipboard':'<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8 9h8M8 13h8M8 17h5"/></svg>','clipboard-check':'<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8 12l2 2 4-4"/></svg>','file-signature':'<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v8"/><path d="M15 3v5h5M6 21h13M7 18c1.5-1.5 3-1.5 4.5 0M4 21c0-2 1-3 3-3"/><path d="m12 15 6-6 2 2-6 6-3 1z"/></svg>','file-text':'<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 12h6M9 16h6"/></svg>','scale':'<svg viewBox="0 0 24 24"><path d="M12 4v16M7 20h10M5 7h14M8 7l-3 6h6zM16 7l-3 6h6z"/></svg>','briefcase':'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5h8v2M3 12h18M10 12v2h4v-2"/></svg>','users':'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M18 15c2.2.5 3 2 3 4"/></svg>','user':'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 21c0-4 2.8-6 7-6s7 2 7 6"/></svg>','user-plus':'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 21c0-4 2.5-6 6.5-6 2 0 3.6.5 4.8 1.5M18 13v7M14.5 16.5h7"/></svg>','calendar':'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6"/></svg>','calendar-check':'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15l2 2 4-4"/></svg>','clock':'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>','wallet':'<svg viewBox="0 0 24 24"><path d="M4 6h16a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14"/><path d="M16 13h6M16 13a2 2 0 1 0 0 4h6v-4"/></svg>','badge':'<svg viewBox="0 0 24 24"><path d="M8 4h8l2 3v13H6V7z"/><path d="M9 4v-1h6v1M9 10h6M9 14h4"/></svg>','graduation-cap':'<svg viewBox="0 0 24 24"><path d="m3 9 9-5 9 5-9 5z"/><path d="M7 11v5c2 2 8 2 10 0v-5M21 10v5"/></svg>','award':'<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="5"/><path d="m9 13-1 8 4-2 4 2-1-8"/></svg>','chart':'<svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-6"/></svg>','target':'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>','shield':'<svg viewBox="0 0 24 24"><path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z"/></svg>','shield-check':'<svg viewBox="0 0 24 24"><path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>','megaphone':'<svg viewBox="0 0 24 24"><path d="M3 11v2h4l10 5V6L7 11z"/><path d="M7 13l2 7h3l-2-6M17 9a4 4 0 0 1 0 6"/></svg>','mail':'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>','archive':'<svg viewBox="0 0 24 24"><path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6"/></svg>','folder':'<svg viewBox="0 0 24 24"><path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7a2 2 0 0 1 2-2h5l2 2"/></svg>','building':'<svg viewBox="0 0 24 24"><path d="M5 21V4h10v17M15 9h4v12M3 21h18"/><path d="M8 7h2M8 11h2M8 15h2M17 13h1M17 17h1"/></svg>','settings':'<svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="4"/></svg>'}[name]||'<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 13h6M9 17h6"/></svg>');

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

function visitorId(){let id='';try{id=localStorage.getItem('hr_reference_visitor_id')||''}catch{}if(!id){try{id=(crypto&&typeof crypto.randomUUID==='function')?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);localStorage.setItem('hr_reference_visitor_id',id)}catch{id=Date.now()+'-'+Math.random().toString(36).slice(2)}}return id}
function reactionMarkup(r){const likes=Number(r.reaction_likes||0),dislikes=Number(r.reaction_dislikes||0);return `<div class="reactions" data-reaction-id="${r.id}"><button type="button" class="reaction-btn like" data-reaction="like" aria-label="إعجاب">👍 <b>${likes.toLocaleString('en-US')}</b></button><button type="button" class="reaction-btn dislike" data-reaction="dislike" aria-label="لم يعجبني">👎 <b>${dislikes.toLocaleString('en-US')}</b></button></div>`}
async function submitReaction(id,reaction,root,button){if(!root||root.dataset.busy==='1')return;root.dataset.busy='1';button?.setAttribute('aria-busy','true');try{const d=await getJSON('/api/resources/'+id+'/reaction',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reaction,visitor_id:visitorId()})});const like=root.querySelector('.like b'),dislike=root.querySelector('.dislike b');if(like)like.textContent=String(Number(d.likes||0));if(dislike)dislike.textContent=String(Number(d.dislikes||0));root.querySelectorAll('.reaction-btn').forEach(b=>b.classList.toggle('selected',b.dataset.reaction===d.my_reaction));}catch(e){console.error('Reaction failed',e);alert(e.message||'تعذر حفظ التقييم')}finally{root.dataset.busy='';button?.removeAttribute('aria-busy')}}
function bindReactions(){if(window._hrReactionBound)return;window._hrReactionBound=true;document.addEventListener('click',e=>{const button=e.target.closest?.('.reaction-btn');if(!button)return;e.preventDefault();e.stopPropagation();const root=button.closest('[data-reaction-id]');if(!root)return;submitReaction(Number(root.dataset.reactionId),button.dataset.reaction,root,button)})}
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
