const $ = s => document.querySelector(s);
let activeCategory = "";
let allCategories = [];

async function getJSON(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error("Request failed");
  return r.json();
}
function escapeHTML(s){return String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function fileIcon(r){
  const n=(r.file_name||"").toLowerCase(), t=(r.file_type||"").toLowerCase();
  if(t.includes("spreadsheet")||/\.(xlsx?|csv)$/.test(n)) return '<img class="file-type-logo excel-logo" src="/assets/excel.svg" alt="Excel">';
  if(t.includes("pdf")||/\.pdf$/.test(n)) return '<span class="file-type-text pdf-logo">PDF</span>';
  if(/\.docx?$/.test(n)||t.includes("word")) return '<span class="file-type-text word-logo">W</span>';
  if(/\.pptx?$/.test(n)||t.includes("presentation")) return '<span class="file-type-text ppt-logo">P</span>';
  return '<span class="file-type-text">▤</span>';
}
function applySettings(s){
  const links={x:["#header-x","#footer-x"],linkedin:["#header-linkedin","#footer-linkedin"]};
  for(const [key,ids] of Object.entries(links)) ids.forEach(id=>{const el=$(id);if(!el)return;const url=s[key]||"";el.hidden=!url;el.href=url||"#"});
  ["#suggestion-link","#footer-suggestion"].forEach(id=>{const el=$(id);if(el){el.href=s.suggestion||"#";el.classList.toggle("disabled-link",!s.suggestion)}});
  if(!s.suggestion){$("#header-suggestion").href="#suggestion";$("#suggestion-link").textContent="رابط النموذج غير مضاف بعد"}
  $("#year").textContent=new Date().getFullYear();
}
async function loadSettings(){try{applySettings(await getJSON("/api/settings"))}catch(e){applySettings({})}}
async function loadCategories(){
  allCategories = await getJSON("/api/categories");
  $("#categories-list").innerHTML = allCategories.map(c => `
    <button class="category-card ${activeCategory===c.slug?"active":""}" data-cat="${escapeHTML(c.slug)}" type="button">
      <span class="category-icon">${escapeHTML(c.icon||"▤")}</span>
      <span><strong>${escapeHTML(c.name)}</strong><small>${Number(c.resource_count||0)} ملف</small></span>
    </button>`).join("");
  document.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{
    activeCategory = activeCategory===b.dataset.cat ? "" : b.dataset.cat;
    loadCategories(); loadResources();
  });
}
function resourceHTML(r){const cats=(r.categories&&r.categories.length?r.categories:[{name:r.category_name||"عام",icon:r.icon||"▤"}]);return `
  <article class="resource-card">
    <div class="file-icon">${fileIcon(r)}</div>
    <div class="resource-body">
      <div class="resource-top">${cats.slice(0,3).map(c=>`<span class="tag">${escapeHTML(c.icon||"▤")} ${escapeHTML(c.name)}</span>`).join('')}${cats.length>3?`<span class="tag tag-more">+${cats.length-3}</span>`:''}${r.featured?'<span class="featured-badge">★ مميز</span>':''}</div>
      <h3>${escapeHTML(r.title)}</h3>
      <p>${escapeHTML(r.description||"لا يوجد وصف لهذا الملف.")}</p>
      <div class="meta">الإصدار ${escapeHTML(r.version||"1.0")} · ${Number(r.downloads||0)} تحميل</div>
      <a class="download" href="/api/download/${encodeURIComponent(r.id)}">فتح / تحميل الملف <span>↓</span></a>
    </div>
  </article>`}
async function loadResources(){
  const q=$("#search").value.trim();
  const url=`/api/resources?q=${encodeURIComponent(q)}&category=${encodeURIComponent(activeCategory)}`;
  const data=await getJSON(url);
  $("#results-title").textContent=q||activeCategory?"نتائج البحث":"آخر التحديثات";
  $("#results-count").textContent=data.length?`${data.length} ملف`:"";
  $("#resources-list").innerHTML=data.map(resourceHTML).join("");
  $("#empty").classList.toggle("hidden",data.length>0);
  $("#clear-search").classList.toggle("hidden",!q);
  if(!q&&!activeCategory) loadFeatured(); else $("#featured-section").classList.add("hidden");
}
async function loadFeatured(){
  const data=await getJSON("/api/resources?featured=1");
  $("#featured").innerHTML=data.map(resourceHTML).join("");
  $("#featured-section").classList.toggle("hidden",data.length===0);
}
let timer;
$("#search").addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(loadResources,180)});
$("#clear-search").onclick=()=>{$("#search").value="";activeCategory="";loadCategories();loadResources();$("#search").focus()};
Promise.all([loadSettings(),loadCategories(),loadResources()]).catch(()=>{$("#resources-list").innerHTML='<div class="empty"><strong>تعذر تحميل الملفات</strong><p>تأكد من اتصال الموقع بقاعدة البيانات.</p></div>'});
