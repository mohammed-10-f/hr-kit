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
  if(t.includes("spreadsheet")||/\.xlsx?$/.test(n)) return "▦";
  if(t.includes("pdf")||/\.pdf$/.test(n)) return "PDF";
  if(/\.docx?$/.test(n)||t.includes("word")) return "W";
  return "▤";
}

async function loadCategories(){
  allCategories = await getJSON("/api/categories");
  $("#categories").innerHTML = allCategories.map(c => `
    <button class="category-card ${activeCategory===c.slug?"active":""}" data-cat="${escapeHTML(c.slug)}" type="button">
      <span class="category-icon">${escapeHTML(c.icon||"▤")}</span>
      <span><strong>${escapeHTML(c.name)}</strong><small>${Number(c.resource_count||0)} ملف</small></span>
    </button>`).join("");
  document.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{
    activeCategory = activeCategory===b.dataset.cat ? "" : b.dataset.cat;
    loadCategories();
    loadResources();
  });
}

function resourceHTML(r){return `
  <article class="resource-card">
    <div class="file-icon">${escapeHTML(fileIcon(r))}</div>
    <div class="resource-body">
      <div class="resource-top">
        <span class="tag">${escapeHTML(r.icon||"▤")} ${escapeHTML(r.category_name||"عام")}</span>
        ${r.featured ? '<span class="featured-badge">★ مميز</span>':''}
      </div>
      <h3>${escapeHTML(r.title)}</h3>
      <p>${escapeHTML(r.description||"لا يوجد وصف لهذا الملف.")}</p>
      <div class="meta">${escapeHTML(r.file_name||"ملف")} · الإصدار ${escapeHTML(r.version||"1.0")} · ${Number(r.downloads||0)} تحميل</div>
      <a class="download" href="/api/download/${encodeURIComponent(r.id)}">فتح / تحميل الملف <span>↓</span></a>
    </div>
  </article>`}

async function loadResources(){
  const q=$("#search").value.trim();
  const url=`/api/resources?q=${encodeURIComponent(q)}&category=${encodeURIComponent(activeCategory)}`;
  const data=await getJSON(url);
  $("#results-title").textContent=q||activeCategory?"نتائج البحث":"آخر التحديثات";
  $("#results-count").textContent=data.length?`${data.length} ملف`:"";
  $("#resources").innerHTML=data.map(resourceHTML).join("");
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
Promise.all([loadCategories(),loadResources()]).catch(()=>{
  $("#resources").innerHTML='<div class="empty"><strong>تعذر تحميل الملفات</strong><p>تأكد من اتصال الموقع بقاعدة البيانات.</p></div>';
});
