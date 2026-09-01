const $ = s => document.querySelector(s);
let activeCategory = "";

async function getJSON(url){ const r=await fetch(url); return r.json(); }

async function loadCategories(){
  const cats = await getJSON("/api/categories");
  $("#categories").innerHTML = cats.map(c => `
    <button class="category-card ${activeCategory===c.slug?"active":""}" data-cat="${c.slug}">
      <span>${c.icon}</span><strong>${c.name}</strong>
    </button>`).join("");
  document.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{
    activeCategory = activeCategory===b.dataset.cat ? "" : b.dataset.cat;
    loadCategories(); loadResources();
  });
}

async function loadResources(){
  const q = $("#search").value.trim();
  const url = `/api/resources?q=${encodeURIComponent(q)}&category=${encodeURIComponent(activeCategory)}`;
  const data = await getJSON(url);
  $("#results-title").textContent = q || activeCategory ? "نتائج البحث" : "أحدث الموارد";
  $("#results-count").textContent = data.length ? `${data.length} مورد` : "";
  $("#resources").innerHTML = data.map(r=>`
    <article class="resource-card">
      <div class="file-icon">${r.file_type?.includes("spreadsheet") || r.file_name?.match(/\.xlsx?$/i) ? "📊" : r.file_name?.match(/\.pdf$/i) ? "📕" : "📄"}</div>
      <div class="resource-body">
        <div class="tag">${r.icon||"📄"} ${r.category_name||"عام"}</div>
        <h3>${escapeHTML(r.title)}</h3>
        <p>${escapeHTML(r.description||"لا يوجد وصف لهذا المورد.")}</p>
        <div class="meta">${escapeHTML(r.file_name||"ملف")} · ${escapeHTML(r.version||"1.0")} · ${r.downloads||0} تحميل</div>
        <a class="download" href="/api/download/${r.id}">تحميل الملف <span>↓</span></a>
      </div>
    </article>`).join("");
  $("#empty").classList.toggle("hidden", data.length>0);
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
let timer;
$("#search").addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(loadResources,220);});
loadCategories(); loadResources();