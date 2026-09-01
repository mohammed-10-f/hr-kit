const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{"content-type":"application/json; charset=utf-8"}});
const cors=r=>{r.headers.set("Access-Control-Allow-Origin","*");r.headers.set("Access-Control-Allow-Headers","Content-Type, Authorization");r.headers.set("Access-Control-Allow-Methods","GET, POST, PATCH, DELETE, OPTIONS");return r};
function slugify(t){return t.trim().toLowerCase().replace(/[^\u0600-\u06FFa-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||crypto.randomUUID()}
function isAdmin(req,env){return !!env.ADMIN_PASSWORD&&(req.headers.get("Authorization")||"")===`Bearer ${env.ADMIN_PASSWORD}`}
const bad=(m,s=400)=>json({error:m},s);
async function admin(req,env,fn){if(!isAdmin(req,env))return cors(bad("Unauthorized",401));try{return cors(await fn())}catch(e){return cors(json({error:e.message||"Server error"},500))}}

export default {async fetch(request,env){
  if(request.method==="OPTIONS")return cors(new Response(null,{status:204}));
  const url=new URL(request.url);
  try{
    if(url.pathname==="/api/categories"&&request.method==="GET"){
      const {results}=await env.DB.prepare(`SELECT c.id,c.name,c.slug,c.icon,c.sort_order,COUNT(r.id) resource_count FROM categories c LEFT JOIN resources r ON r.category_id=c.id AND r.status!='archived' WHERE c.is_visible=1 GROUP BY c.id ORDER BY c.sort_order,c.name`).all();
      return cors(json(results));
    }
    if(url.pathname==="/api/resources"&&request.method==="GET"){
      const q=(url.searchParams.get("q")||"").trim(),cat=url.searchParams.get("category")||"",featured=url.searchParams.get("featured")||"";
      let sql=`SELECT r.id,r.title,r.slug,r.description,r.file_url,r.file_name,r.file_type,r.keywords,r.version,r.downloads,r.featured,r.created_at,r.updated_at,c.name category_name,c.slug category_slug,c.icon FROM resources r LEFT JOIN categories c ON c.id=r.category_id WHERE r.status='published' AND c.is_visible=1`;
      const b=[];
      if(q){sql+=" AND (r.title LIKE ? OR r.description LIKE ? OR r.keywords LIKE ? OR r.file_name LIKE ?)";const x=`%${q}%`;b.push(x,x,x,x)}
      if(cat){sql+=" AND c.slug = ?";b.push(cat)}
      if(featured==="1")sql+=" AND r.featured=1";
      sql+=featured==="1"?" ORDER BY r.downloads DESC,r.updated_at DESC LIMIT 6":" ORDER BY r.updated_at DESC LIMIT 100";
      const {results}=await env.DB.prepare(sql).bind(...b).all();return cors(json(results));
    }
    if(url.pathname.startsWith("/api/download/")&&request.method==="GET"){
      const id=Number(url.pathname.split("/").pop());
      const item=await env.DB.prepare("SELECT file_url FROM resources WHERE id=? AND status='published'").bind(id).first();
      if(!item?.file_url)return new Response("File link not found",{status:404});
      await env.DB.prepare("UPDATE resources SET downloads=downloads+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
      return Response.redirect(item.file_url,302);
    }
    if(url.pathname==="/api/admin/check"&&request.method==="GET")return admin(request,env,async()=>json({ok:true}));

    if(url.pathname==="/api/admin/categories"&&request.method==="GET")return admin(request,env,async()=>{const {results}=await env.DB.prepare(`SELECT c.id,c.name,c.slug,c.icon,c.sort_order,c.is_visible,COUNT(r.id) resource_count FROM categories c LEFT JOIN resources r ON r.category_id=c.id AND r.status!='archived' GROUP BY c.id ORDER BY c.sort_order,c.name`).all();return json(results)});
    if(url.pathname==="/api/admin/categories"&&request.method==="POST")return admin(request,env,async()=>{const b=await request.json();const name=String(b.name||"").trim();if(!name)return bad("اسم القسم مطلوب");const slug=slugify(name)+"-"+Date.now();try{const r=await env.DB.prepare("INSERT INTO categories(name,slug,icon,sort_order,is_visible) VALUES(?,?,?,?,?)").bind(name,slug,String(b.icon||"📄"),Number(b.sort_order||0),b.is_visible===false?0:1).run();return json({ok:true,id:r.meta.last_row_id},201)}catch(e){return bad(e.message)}});
    const catMatch=url.pathname.match(/^\/api\/admin\/categories\/(\d+)$/);
    if(catMatch&&request.method==="PATCH")return admin(request,env,async()=>{const id=Number(catMatch[1]),b=await request.json(),sets=[],vals=[];if(b.name!==undefined){sets.push("name=?");vals.push(String(b.name).trim())}if(b.icon!==undefined){sets.push("icon=?");vals.push(String(b.icon||"📄"))}if(b.sort_order!==undefined){sets.push("sort_order=?");vals.push(Number(b.sort_order)||0)}if(b.is_visible!==undefined){sets.push("is_visible=?");vals.push(b.is_visible?1:0)}if(!sets.length)return bad("لا توجد تغييرات");vals.push(id);await env.DB.prepare(`UPDATE categories SET ${sets.join(",")} WHERE id=?`).bind(...vals).run();return json({ok:true})});
    if(catMatch&&request.method==="DELETE")return admin(request,env,async()=>{const id=Number(catMatch[1]),n=await env.DB.prepare("SELECT COUNT(*) n FROM resources WHERE category_id=? AND status!='archived'").bind(id).first();if(Number(n?.n)>0)return bad("لا يمكن حذف قسم يحتوي على ملفات. انقل الملفات أولًا.");await env.DB.prepare("DELETE FROM categories WHERE id=?").bind(id).run();return json({ok:true})});

    if(url.pathname==="/api/admin/resources"&&request.method==="GET")return admin(request,env,async()=>{const {results}=await env.DB.prepare(`SELECT r.*,c.name category_name,c.icon FROM resources r LEFT JOIN categories c ON c.id=r.category_id ORDER BY CASE r.status WHEN 'published' THEN 1 WHEN 'hidden' THEN 2 ELSE 3 END,r.updated_at DESC`).all();return json(results)});
    if(url.pathname==="/api/admin/resources"&&request.method==="POST")return admin(request,env,async()=>{const b=await request.json(),title=String(b.title||"").trim(),fileUrl=String(b.file_url||"").trim();if(!title||!fileUrl)return bad("اسم الملف ورابطه مطلوبان");const slug=slugify(title)+"-"+Date.now();const r=await env.DB.prepare(`INSERT INTO resources(title,slug,description,category_id,file_url,file_name,file_type,keywords,version,status,featured,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(title,slug,b.description||"",b.category_id||null,fileUrl,b.file_name||"",b.file_type||"",b.keywords||"",b.version||"1.0","published",b.featured?1:0).run();return json({ok:true,id:r.meta.last_row_id},201)});
    const resMatch=url.pathname.match(/^\/api\/admin\/resources\/(\d+)$/);
    if(resMatch&&request.method==="PATCH")return admin(request,env,async()=>{const id=Number(resMatch[1]),b=await request.json(),allowed={title:"title",description:"description",category_id:"category_id",file_url:"file_url",file_name:"file_name",file_type:"file_type",keywords:"keywords",version:"version",status:"status",featured:"featured"},sets=[],vals=[];for(const k in allowed){if(b[k]!==undefined){sets.push(`${allowed[k]}=?`);vals.push(k==='featured'?(b[k]?1:0):b[k])}}if(!sets.length)return bad("لا توجد تغييرات");sets.push("updated_at=CURRENT_TIMESTAMP");vals.push(id);await env.DB.prepare(`UPDATE resources SET ${sets.join(",")} WHERE id=?`).bind(...vals).run();return json({ok:true})});
    if(resMatch&&request.method==="DELETE")return admin(request,env,async()=>{await env.DB.prepare("DELETE FROM resources WHERE id=?").bind(Number(resMatch[1])).run();return json({ok:true})});

    return env.ASSETS.fetch(request);
  }catch(e){return cors(json({error:"Server error",message:e.message},500))}
}};
