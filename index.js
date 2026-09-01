const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{"content-type":"application/json; charset=utf-8"}});
const cors=r=>{r.headers.set("Access-Control-Allow-Origin","*");r.headers.set("Access-Control-Allow-Headers","Content-Type, Authorization");r.headers.set("Access-Control-Allow-Methods","GET, POST, PATCH, DELETE, OPTIONS");return r};
function slugify(t){return t.trim().toLowerCase().replace(/[^\u0600-\u06FFa-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||crypto.randomUUID()}
const bad=(m,s=400)=>json({error:m},s);
const DEFAULT_PASSWORD="1234";
let schemaReadyPromise;
async function sha256(value){const data=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",data);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("")}
async function ensureSchema(env){
  if(schemaReadyPromise)return schemaReadyPromise;
  schemaReadyPromise=(async()=>{
    const catCols=await env.DB.prepare("PRAGMA table_info(categories)").all();
    const resourceCols=await env.DB.prepare("PRAGMA table_info(resources)").all();
    const hasCatVisible=(catCols.results||[]).some(c=>c.name==='is_visible');
    const hasFeatured=(resourceCols.results||[]).some(c=>c.name==='featured');
    const stmts=[];
    if(!hasCatVisible)stmts.push(env.DB.prepare("ALTER TABLE categories ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 1"));
    if(!hasFeatured)stmts.push(env.DB.prepare("ALTER TABLE resources ADD COLUMN featured INTEGER NOT NULL DEFAULT 0"));
    if(stmts.length)await env.DB.batch(stmts);
    await env.DB.batch([
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_resources_featured ON resources(featured)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_categories_visible ON categories(is_visible)"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)"),
      env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('admin_password_hash',?)").bind(await sha256(DEFAULT_PASSWORD)),
      env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('social_x','')"),
      env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('social_linkedin','')"),
      env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('suggestion_url','')"),
      env.DB.prepare("UPDATE categories SET is_visible=0 WHERE slug IN ('guides','regulations','recruitment','payroll','leaves','offboarding')"),
      env.DB.prepare("UPDATE categories SET name='ملفات', icon='📁', sort_order=3 WHERE slug='excel' AND NOT EXISTS (SELECT 1 FROM categories WHERE slug='files')"),
      env.DB.prepare("UPDATE categories SET slug='files' WHERE name='ملفات' AND slug='excel' AND NOT EXISTS (SELECT 1 FROM categories WHERE slug='files')")
    ]);
    await env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at<?").bind(Date.now()).run();
  })().catch(e=>{schemaReadyPromise=null;throw e});
  return schemaReadyPromise;
}
async function getSetting(env,key){const row=await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(key).first();return row?.value||""}
async function setSetting(env,key,value){await env.DB.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key,value).run()}
async function createSession(env){const token=crypto.randomUUID()+"-"+crypto.randomUUID();const hash=await sha256(token);await env.DB.prepare("INSERT INTO admin_sessions(token_hash,expires_at) VALUES(?,?)").bind(hash,Date.now()+1000*60*60*24*7).run();return token}
async function isAdmin(req,env){const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();if(!token)return false;const hash=await sha256(token);const row=await env.DB.prepare("SELECT token_hash FROM admin_sessions WHERE token_hash=? AND expires_at>? ").bind(hash,Date.now()).first();return !!row}
async function admin(req,env,fn){if(!(await isAdmin(req,env)))return cors(bad("Unauthorized",401));try{await ensureSchema(env);return cors(await fn())}catch(e){return cors(json({error:e.message||"Server error"},500))}}
function inferFileName(url){try{const u=new URL(url);const last=decodeURIComponent(u.pathname.split('/').pop()||'');return /\.[a-z0-9]{2,6}$/i.test(last)?last:""}catch{return ""}}
function inferFileType(name){const ext=(name.match(/\.([a-z0-9]{2,6})$/i)||[])[1]?.toLowerCase();return ({pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}[ext]||"")}

export default {async fetch(request,env){
  if(request.method==="OPTIONS")return cors(new Response(null,{status:204}));
  const url=new URL(request.url);
  try{
    await ensureSchema(env);
    if(url.pathname==="/api/settings"&&request.method==="GET")return cors(json({x:await getSetting(env,"social_x"),linkedin:await getSetting(env,"social_linkedin"),suggestion:await getSetting(env,"suggestion_url")}));
    if(url.pathname==="/api/admin/login"&&request.method==="POST"){
      const b=await request.json();const password=String(b.password||"");if(!password)return cors(bad("كلمة المرور مطلوبة"));
      const stored=await getSetting(env,"admin_password_hash");
      if(!stored||await sha256(password)!==stored)return cors(bad("كلمة المرور غير صحيحة",401));
      return cors(json({ok:true,token:await createSession(env)}));
    }
    if(url.pathname==="/api/categories"&&request.method==="GET"){
      const {results}=await env.DB.prepare(`SELECT c.id,c.name,c.slug,c.icon,c.sort_order,COUNT(r.id) resource_count FROM categories c LEFT JOIN resources r ON r.category_id=c.id AND r.status!='archived' WHERE c.is_visible=1 GROUP BY c.id ORDER BY c.sort_order,c.name`).all();
      return cors(json(results));
    }
    if(url.pathname==="/api/resources"&&request.method==="GET"){
      const q=(url.searchParams.get("q")||"").trim(),cat=url.searchParams.get("category")||"",featured=url.searchParams.get("featured")||"";
      let sql=`SELECT r.id,r.title,r.slug,r.description,r.file_url,r.file_name,r.file_type,r.keywords,r.version,r.downloads,r.featured,r.created_at,r.updated_at,c.name category_name,c.slug category_slug,c.icon FROM resources r LEFT JOIN categories c ON c.id=r.category_id WHERE r.status='published' AND c.is_visible=1`;
      const b=[];if(q){sql+=" AND (r.title LIKE ? OR r.description LIKE ? OR r.keywords LIKE ? OR r.file_name LIKE ?)";const x=`%${q}%`;b.push(x,x,x,x)}if(cat){sql+=" AND c.slug = ?";b.push(cat)}if(featured==="1")sql+=" AND r.featured=1";sql+=featured==="1"?" ORDER BY r.downloads DESC,r.updated_at DESC LIMIT 6":" ORDER BY r.updated_at DESC LIMIT 100";
      const {results}=await env.DB.prepare(sql).bind(...b).all();return cors(json(results));
    }
    if(url.pathname.startsWith("/api/download/")&&request.method==="GET"){
      const id=Number(url.pathname.split("/").pop());const item=await env.DB.prepare("SELECT file_url FROM resources WHERE id=? AND status='published'").bind(id).first();if(!item?.file_url)return new Response("File link not found",{status:404});await env.DB.prepare("UPDATE resources SET downloads=downloads+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();return Response.redirect(item.file_url,302);
    }
    if(url.pathname==="/api/admin/check"&&request.method==="GET")return admin(request,env,async()=>json({ok:true}));
    if(url.pathname==="/api/admin/logout"&&request.method==="POST")return admin(request,env,async()=>{const t=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(await sha256(t)).run();return json({ok:true})});
    if(url.pathname==="/api/admin/password"&&request.method==="POST")return admin(request,env,async()=>{const b=await request.json(),oldPassword=String(b.old_password||""),newPassword=String(b.new_password||"");if(newPassword.length<4)return bad("كلمة المرور الجديدة يجب ألا تقل عن 4 أحرف أو أرقام");const stored=await getSetting(env,"admin_password_hash");if(await sha256(oldPassword)!==stored)return bad("كلمة المرور الحالية غير صحيحة",401);await setSetting(env,"admin_password_hash",await sha256(newPassword));await env.DB.prepare("DELETE FROM admin_sessions").run();return json({ok:true})});
    if(url.pathname==="/api/admin/settings"&&request.method==="GET")return admin(request,env,async()=>json({x:await getSetting(env,"social_x"),linkedin:await getSetting(env,"social_linkedin"),suggestion:await getSetting(env,"suggestion_url")}));
    if(url.pathname==="/api/admin/settings"&&request.method==="PATCH")return admin(request,env,async()=>{const b=await request.json();for(const [k,key] of [["x","social_x"],["linkedin","social_linkedin"],["suggestion","suggestion_url"]])if(b[k]!==undefined)await setSetting(env,key,String(b[k]||"").trim());return json({ok:true})});

    if(url.pathname==="/api/admin/categories"&&request.method==="GET")return admin(request,env,async()=>{const {results}=await env.DB.prepare(`SELECT c.id,c.name,c.slug,c.icon,c.sort_order,c.is_visible,COUNT(r.id) resource_count FROM categories c LEFT JOIN resources r ON r.category_id=c.id AND r.status!='archived' GROUP BY c.id ORDER BY c.sort_order,c.name`).all();return json(results)});
    if(url.pathname==="/api/admin/categories"&&request.method==="POST")return admin(request,env,async()=>{const b=await request.json(),name=String(b.name||"").trim();if(!name)return bad("اسم القسم مطلوب");const slug=slugify(name)+"-"+Date.now();try{const r=await env.DB.prepare("INSERT INTO categories(name,slug,icon,sort_order,is_visible) VALUES(?,?,?,?,?)").bind(name,slug,String(b.icon||"📄"),Number(b.sort_order||0),b.is_visible===false?0:1).run();return json({ok:true,id:r.meta.last_row_id},201)}catch(e){return bad(e.message)}});
    const catMatch=url.pathname.match(/^\/api\/admin\/categories\/(\d+)$/);
    if(catMatch&&request.method==="PATCH")return admin(request,env,async()=>{const id=Number(catMatch[1]),b=await request.json(),sets=[],vals=[];if(b.name!==undefined){sets.push("name=?");vals.push(String(b.name).trim())}if(b.icon!==undefined){sets.push("icon=?");vals.push(String(b.icon||"📄"))}if(b.sort_order!==undefined){sets.push("sort_order=?");vals.push(Number(b.sort_order)||0)}if(b.is_visible!==undefined){sets.push("is_visible=?");vals.push(b.is_visible?1:0)}if(!sets.length)return bad("لا توجد تغييرات");vals.push(id);await env.DB.prepare(`UPDATE categories SET ${sets.join(",")} WHERE id=?`).bind(...vals).run();return json({ok:true})});
    if(catMatch&&request.method==="DELETE")return admin(request,env,async()=>{const id=Number(catMatch[1]),n=await env.DB.prepare("SELECT COUNT(*) n FROM resources WHERE category_id=? AND status!='archived'").bind(id).first();if(Number(n?.n)>0)return bad("لا يمكن حذف قسم يحتوي على ملفات. انقل الملفات أولًا.");await env.DB.prepare("DELETE FROM categories WHERE id=?").bind(id).run();return json({ok:true})});

    if(url.pathname==="/api/admin/resources"&&request.method==="GET")return admin(request,env,async()=>{const {results}=await env.DB.prepare(`SELECT r.*,c.name category_name,c.icon FROM resources r LEFT JOIN categories c ON c.id=r.category_id ORDER BY CASE r.status WHEN 'published' THEN 1 WHEN 'hidden' THEN 2 ELSE 3 END,r.updated_at DESC`).all();return json(results)});
    if(url.pathname==="/api/admin/resources"&&request.method==="POST")return admin(request,env,async()=>{const b=await request.json(),title=String(b.title||"").trim(),fileUrl=String(b.file_url||"").trim();if(!title||!fileUrl)return bad("اسم الملف ورابطه مطلوبان");const slug=slugify(title)+"-"+Date.now(),fileName=String(b.file_name||inferFileName(fileUrl)),fileType=String(b.file_type||inferFileType(fileName));const r=await env.DB.prepare(`INSERT INTO resources(title,slug,description,category_id,file_url,file_name,file_type,keywords,version,status,featured,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(title,slug,b.description||"",b.category_id||null,fileUrl,fileName,fileType,b.keywords||"",b.version||"1.0","published",b.featured?1:0).run();return json({ok:true,id:r.meta.last_row_id},201)});
    const resMatch=url.pathname.match(/^\/api\/admin\/resources\/(\d+)$/);
    if(resMatch&&request.method==="PATCH")return admin(request,env,async()=>{const id=Number(resMatch[1]),b=await request.json(),allowed={title:"title",description:"description",category_id:"category_id",file_url:"file_url",keywords:"keywords",version:"version",status:"status",featured:"featured"},sets=[],vals=[];for(const k in allowed)if(b[k]!==undefined){sets.push(`${allowed[k]}=?`);vals.push(k==='featured'?(b[k]?1:0):b[k])}if(b.file_url!==undefined){const n=inferFileName(String(b.file_url));if(n){sets.push("file_name=?");vals.push(n);sets.push("file_type=?");vals.push(inferFileType(n))}}if(!sets.length)return bad("لا توجد تغييرات");sets.push("updated_at=CURRENT_TIMESTAMP");vals.push(id);await env.DB.prepare(`UPDATE resources SET ${sets.join(",")} WHERE id=?`).bind(...vals).run();return json({ok:true})});
    if(resMatch&&request.method==="DELETE")return admin(request,env,async()=>{await env.DB.prepare("DELETE FROM resources WHERE id=?").bind(Number(resMatch[1])).run();return json({ok:true})});
    return env.ASSETS.fetch(request);
  }catch(e){return cors(json({error:"Server error",message:e.message},500))}
}};
