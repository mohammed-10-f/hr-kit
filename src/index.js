const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8'}});
const cors=r=>{r.headers.set('Access-Control-Allow-Origin','*');r.headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');r.headers.set('Access-Control-Allow-Methods','GET, POST, PATCH, DELETE, OPTIONS');return r};
const bad=(m,s=400)=>json({error:m},s);
const DEFAULT_PASSWORD='1234'; let schemaReadyPromise;
function slugify(t){return t.trim().toLowerCase().replace(/[^\u0600-\u06FFa-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||crypto.randomUUID()}
function normalizeArabic(value){return String(value||'').toLowerCase().normalize('NFKC').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ة/g,'ه')}
function normalizedSqlExpression(column){let e=column;for(const [from,to] of [['أ','ا'],['إ','ا'],['آ','ا'],['ٱ','ا'],['ى','ي'],['ؤ','و'],['ئ','ي'],['ة','ه'],['ـ',''],['َ',''],['ً',''],['ُ',''],['ٌ',''],['ِ',''],['ٍ',''],['ْ',''],['ّ','']])e=`REPLACE(${e},'${from}','${to}')`;return `LOWER(${e})`}
async function sha256(value){const data=new TextEncoder().encode(value);const digest=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function ensureSchema(env){
 if(schemaReadyPromise)return schemaReadyPromise;
 schemaReadyPromise=(async()=>{
  const catCols=await env.DB.prepare('PRAGMA table_info(categories)').all(); const resCols=await env.DB.prepare('PRAGMA table_info(resources)').all(); const cs=catCols.results||[],rs=resCols.results||[]; const stmts=[];
  if(!cs.some(c=>c.name==='is_visible'))stmts.push(env.DB.prepare('ALTER TABLE categories ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 1'));
  if(!rs.some(c=>c.name==='featured'))stmts.push(env.DB.prepare('ALTER TABLE resources ADD COLUMN featured INTEGER NOT NULL DEFAULT 0'));
  if(!rs.some(c=>c.name==='views'))stmts.push(env.DB.prepare('ALTER TABLE resources ADD COLUMN views INTEGER NOT NULL DEFAULT 0'));
  if(stmts.length)await env.DB.batch(stmts);
  await env.DB.batch([
   env.DB.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT \'\')'),
   env.DB.prepare('CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)'),
   env.DB.prepare('CREATE TABLE IF NOT EXISTS resource_categories (resource_id INTEGER NOT NULL, category_id INTEGER NOT NULL, PRIMARY KEY(resource_id,category_id), FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE, FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE)'),
   env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_resource_categories_resource ON resource_categories(resource_id)'),
   env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_resource_categories_category ON resource_categories(category_id)'),
   env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_resources_featured ON resources(featured)'),
   env.DB.prepare('CREATE TABLE IF NOT EXISTS resource_ratings (resource_id INTEGER NOT NULL, visitor_hash TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(resource_id,visitor_hash), FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE)'),
   env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_resource_ratings_resource ON resource_ratings(resource_id)'),
   env.DB.prepare("CREATE TABLE IF NOT EXISTS resource_reactions (resource_id INTEGER NOT NULL, visitor_hash TEXT NOT NULL, reaction TEXT NOT NULL CHECK(reaction IN ('like','dislike')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(resource_id,visitor_hash), FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE)"),
   env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_resource_reactions_resource ON resource_reactions(resource_id)'),
   env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_categories_visible ON categories(is_visible)'),
   env.DB.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(\'admin_password_hash\',?)').bind(await sha256(DEFAULT_PASSWORD)),
   env.DB.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(\'social_x\',\'\')'),
   env.DB.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(\'social_linkedin\',\'\')'),
   env.DB.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(\'suggestion_url\',\'\')'),
   env.DB.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(\'contact_email\',\'\')'),
   env.DB.prepare('UPDATE categories SET is_visible=0 WHERE slug IN (\'guides\',\'regulations\',\'recruitment\',\'payroll\',\'leaves\',\'offboarding\')'),
   env.DB.prepare('UPDATE categories SET name=\'ملفات\', slug=\'files\', icon=\'▦\', sort_order=3 WHERE slug=\'excel\' AND NOT EXISTS (SELECT 1 FROM categories WHERE slug=\'files\')'),
   env.DB.prepare('INSERT OR IGNORE INTO resource_categories(resource_id,category_id) SELECT id,category_id FROM resources WHERE category_id IS NOT NULL')
  ]);
  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at<?').bind(Date.now()).run();
 })().catch(e=>{schemaReadyPromise=null;throw e}); return schemaReadyPromise;
}
async function getSetting(env,key){const r=await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();return r?.value||''}
async function setSetting(env,key,value){await env.DB.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,value).run()}
async function createSession(env){const token=crypto.randomUUID()+'-'+crypto.randomUUID();await env.DB.prepare('INSERT INTO admin_sessions(token_hash,expires_at) VALUES(?,?)').bind(await sha256(token),Date.now()+7*24*60*60*1000).run();return token}
async function isAdmin(req,env){const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();if(!token)return false;const r=await env.DB.prepare('SELECT 1 FROM admin_sessions WHERE token_hash=? AND expires_at>?').bind(await sha256(token),Date.now()).first();return !!r}
async function admin(req,env,fn){if(!(await isAdmin(req,env)))return cors(bad('Unauthorized',401));try{return cors(await fn())}catch(e){return cors(json({error:e.message||'Server error'},500))}}
function inferFileName(url){try{const u=new URL(url);const n=decodeURIComponent(u.pathname.split('/').pop()||'');return /\.[a-z0-9]{2,6}$/i.test(n)?n:''}catch{return ''}}
function inferFileType(name){const ext=(name.match(/\.([a-z0-9]{2,6})$/i)||[])[1]?.toLowerCase();return ({pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}[ext]||'')}

async function githubConfig(env){
  // Runtime variables are authoritative. The D1 settings remain only as a
  // backwards-compatible fallback for installations that have not migrated yet.
  const owner=String(env.GITHUB_OWNER||await getSetting(env,'github_owner')).trim();
  const repo=String(env.GITHUB_REPO||await getSetting(env,'github_repo')).trim();
  const tag=String(env.GITHUB_RELEASE_TAG||await getSetting(env,'github_release_tag')||'files-v1').trim();
  return {owner,repo,tag,token:String(env.GITHUB_TOKEN||'').trim()};
}

class GitHubApiError extends Error{
  constructor(status,detail,data={}){
    super(detail);
    this.name='GitHubApiError';
    this.status=status;
    this.githubResponse=data;
  }
}

function githubErrorHint(status,detail){
  if(status===401)return 'رمز GitHub غير صالح أو منتهي الصلاحية. تحقق من GITHUB_TOKEN.';
  if(status===403)return 'رفض GitHub الطلب. تحقق من User-Agent وصلاحيات Fine-grained token للمستودع Contents: Read and write، وأي سياسات إدارية للمؤسسة/المستودع.';
  if(status===404)return 'المستودع أو Release المطلوب غير موجود، أو أن الرمز لا يملك صلاحية رؤية المستودع.';
  if(status===422)return 'رفض GitHub بيانات الطلب (Validation error). راجع اسم الملف أو بيانات Release/Asset.';
  return `فشل طلب GitHub بحالة HTTP ${status}.`;
}

async function githubRequest(env,path,options={},host='https://api.github.com'){
  const {token}=await githubConfig(env);
  if(!token) throw new GitHubApiError(500,'لم يتم إعداد GITHUB_TOKEN في Cloudflare Secrets.');
  const headers={
    ...(options.headers||{}),
    Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'User-Agent':'HR-Reference-Cloudflare',
    Authorization:`Bearer ${token}`
  };
  const r=await fetch(host+path,{...options,headers});
  const text=await r.text();
  let data={};
  if(text){
    try{data=JSON.parse(text)}
    catch{data={message:text}}
  }
  if(!r.ok){
    const detail=String(data.message||text||`GitHub API ${r.status}`).trim();
    console.error('[GitHub] request failed',{
      status:r.status,
      path,
      host,
      message:detail,
      documentation_url:data.documentation_url||null,
      errors:Array.isArray(data.errors)?data.errors:null
    });
    throw new GitHubApiError(r.status,detail,data);
  }
  return data;
}

async function ensureGitHubRelease(env){
  const {owner,repo,tag}=await githubConfig(env);
  if(!owner||!repo)throw new GitHubApiError(500,'أكمل إعداد مستودع GitHub: GITHUB_OWNER و GITHUB_REPO.');
  try{
    return await githubRequest(
      env,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/tags/${encodeURIComponent(tag)}`
    );
  }catch(e){
    if(!(e instanceof GitHubApiError)||e.status!==404)throw e;
    return await githubRequest(
      env,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`,
      {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          tag_name:tag,
          name:'HR Reference Files',
          body:'Files storage for HR Reference',
          draft:false,
          prerelease:false
        })
      }
    );
  }
}

function safeAssetName(name){
  const clean=String(name||'file').split(/[\\/]/).pop().trim().replace(/[\u0000-\u001f<>:"|?*]/g,'-');
  return clean.slice(0,180)||`file-${Date.now()}`;
}

async function uploadToGitHub(env,file){
  const release=await ensureGitHubRelease(env);
  const {owner,repo}=await githubConfig(env);
  const name=safeAssetName(file.name);
  const old=Array.isArray(release.assets)?release.assets.find(a=>a.name===name):null;

  if(old){
    await githubRequest(
      env,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/assets/${old.id}`,
      {method:'DELETE'}
    );
  }

  const body=await file.arrayBuffer();
  const contentType=file.type||inferFileType(name)||'application/octet-stream';

  // GitHub returns an upload_url on the Release itself. Use it when available;
  // never send a binary asset to api.github.com.
  let uploadUrl=String(release.upload_url||'').replace(/\{\?name,label\}$/,'');
  if(!uploadUrl){
    uploadUrl=`https://uploads.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/${release.id}/assets`;
  }
  const uploadHost=new URL(uploadUrl).origin;
  if(uploadHost!=='https://uploads.github.com'){
    throw new GitHubApiError(500,'عنوان رفع Release غير صالح؛ يجب أن يستخدم uploads.github.com.');
  }
  const uploadPath=new URL(uploadUrl).pathname;
  const asset=await githubRequest(
    env,
    `${uploadPath}?name=${encodeURIComponent(name)}`,
    {
      method:'POST',
      headers:{
        'Content-Type':contentType,
        'Content-Length':String(body.byteLength)
      },
      body
    },
    uploadHost
  );

  return {
    url:asset.browser_download_url,
    file_name:asset.name,
    file_type:file.type||inferFileType(asset.name)||'application/octet-stream',
    size:asset.size,
    github_asset_id:asset.id
  };
}

async function testGitHub(env){
  const {owner,repo,tag,token}=await githubConfig(env);
  const repository=`${owner}/${repo}`;
  const result={
    ok:false,
    github:false,
    repository,
    release:tag,
    release_exists:false
  };

  if(!owner||!repo){
    result.error='إعدادات GitHub ناقصة: GITHUB_OWNER و GITHUB_REPO.';
    result.hint='تحقق من Cloudflare Runtime Variables.';
    return result;
  }
  if(!token){
    result.error='GITHUB_TOKEN غير مضبوط.';
    result.hint='أضف GITHUB_TOKEN كـ Secret في Cloudflare Workers.';
    return result;
  }

  try{
    const release=await githubRequest(
      env,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/tags/${encodeURIComponent(tag)}`
    );
    result.ok=true;
    result.github=true;
    result.release_exists=true;
    result.release_id=release.id;
    result.message='تم الاتصال بـ GitHub والعثور على Release.';
    return result;
  }catch(e){
    result.http_status=e.status||500;
    result.github_response=e.githubResponse||{message:e.message};
    result.error=e.message;
    result.hint=githubErrorHint(e.status,e.message);
    if(e.status===401)result.token_problem=true;
    if(e.status===403)result.permission_problem=true;
    if(e.status===404)result.repository_or_release_missing=true;
    if(e.status===422)result.validation_error=true;
    return result;
  }
}

function parseIds(v){
  return [...new Set((Array.isArray(v)?v:[v])
    .map(Number)
    .filter(Number.isInteger)
    .filter(x=>x>0))]
}
function parseIdsInput(v){
  if(Array.isArray(v)) return parseIds(v);
  const raw=String(v??'').trim();
  if(!raw) return [];
  try{
    const parsed=JSON.parse(raw);
    return parseIds(parsed);
  }catch{
    return parseIds(raw.split(',').map(x=>x.trim()).filter(Boolean));
  }
}
async function syncCategories(env,resourceId,ids){await env.DB.prepare('DELETE FROM resource_categories WHERE resource_id=?').bind(resourceId).run();if(!ids.length)return;await env.DB.batch(ids.map(cid=>env.DB.prepare('INSERT OR IGNORE INTO resource_categories(resource_id,category_id) VALUES(?,?)').bind(resourceId,cid)))}
function hydrateResources(rows){return (rows||[]).map(r=>({...r,category_ids:r.category_ids?String(r.category_ids).split(',').filter(Boolean).map(Number):[],category_names:r.category_names||'',reaction_likes:Number(r.reaction_likes||0),reaction_dislikes:Number(r.reaction_dislikes||0),views:Number(r.views||0),downloads:Number(r.downloads||0)}))}

export default {async fetch(request,env){
 if(request.method==='OPTIONS')return cors(new Response(null,{status:204})); const url=new URL(request.url);
 try{await ensureSchema(env);
  if(url.pathname==='/api/settings'&&request.method==='GET')return cors(json({x:await getSetting(env,'social_x'),linkedin:await getSetting(env,'social_linkedin'),suggestion:await getSetting(env,'suggestion_url'),email:await getSetting(env,'contact_email'),github_owner:await getSetting(env,'github_owner'),github_repo:await getSetting(env,'github_repo'),github_release_tag:await getSetting(env,'github_release_tag')}));
  if(url.pathname==='/api/admin/login'&&request.method==='POST'){const b=await request.json();const p=String(b.password||'');if(!p)return cors(bad('كلمة المرور مطلوبة'));if(await sha256(p)!==await getSetting(env,'admin_password_hash'))return cors(bad('كلمة المرور غير صحيحة',401));return cors(json({ok:true,token:await createSession(env)}))}
  if(url.pathname==='/api/categories'&&request.method==='GET'){
   const {results}=await env.DB.prepare(`SELECT c.id,c.name,c.slug,c.icon,c.sort_order,COUNT(DISTINCT CASE WHEN r.status!='archived' THEN r.id END) resource_count FROM categories c LEFT JOIN resource_categories rc ON rc.category_id=c.id LEFT JOIN resources r ON r.id=rc.resource_id WHERE c.is_visible=1 GROUP BY c.id ORDER BY c.sort_order,c.name`).all();return cors(json(results));
  }
  if(url.pathname==='/api/resources'&&request.method==='GET'){
   const q=normalizeArabic(url.searchParams.get('q')||''),cat=url.searchParams.get('category')||'',featured=url.searchParams.get('featured')||'';let sql=`SELECT r.id,r.title,r.slug,r.description,r.file_url,r.file_name,r.file_type,r.keywords,r.version,r.downloads,r.views,r.featured,r.created_at,r.updated_at, GROUP_CONCAT(DISTINCT c.name) category_names, GROUP_CONCAT(DISTINCT c.slug) category_slugs, COALESCE((SELECT SUM(CASE WHEN rr.reaction='like' THEN 1 ELSE 0 END) FROM resource_reactions rr WHERE rr.resource_id=r.id),0) reaction_likes, COALESCE((SELECT SUM(CASE WHEN rr.reaction='dislike' THEN 1 ELSE 0 END) FROM resource_reactions rr WHERE rr.resource_id=r.id),0) reaction_dislikes FROM resources r LEFT JOIN resource_categories rc ON rc.resource_id=r.id LEFT JOIN categories c ON c.id=rc.category_id AND c.is_visible=1 WHERE r.status='published'`;
   const b=[];if(q){const fields=['r.title','r.description','r.keywords','r.file_name'].map(normalizedSqlExpression);sql+=` AND (${fields.map(f=>f+' LIKE ?').join(' OR ')})`;const x=`%${normalizeArabic(q)}%`;b.push(x,x,x,x)}if(cat){sql+=` AND EXISTS(SELECT 1 FROM resource_categories xrc JOIN categories xc ON xc.id=xrc.category_id WHERE xrc.resource_id=r.id AND xc.slug=? AND xc.is_visible=1)`;b.push(cat)}if(featured==='1')sql+=' AND r.featured=1';sql+=' GROUP BY r.id ORDER BY '+(featured==='1'?'r.downloads DESC,r.updated_at DESC':'r.updated_at DESC')+' LIMIT 100';const {results}=await env.DB.prepare(sql).bind(...b).all();return cors(json(hydrateResources(results)));
  }
  if(url.pathname.startsWith('/api/resources/')&&request.method==='POST'&&url.pathname.endsWith('/view')){const id=Number(url.pathname.split('/')[3]);const item=await env.DB.prepare("SELECT id FROM resources WHERE id=? AND status='published'").bind(id).first();if(!item)return cors(bad('File not found',404));await env.DB.prepare('UPDATE resources SET views=views+1 WHERE id=?').bind(id).run();return cors(json({ok:true}))}
  if(url.pathname.startsWith('/api/resources/')&&request.method==='POST'&&url.pathname.endsWith('/reaction')){const id=Number(url.pathname.split('/')[3]);const b=await request.json();const reaction=String(b.reaction||'').trim();const visitor=String(b.visitor_id||'').trim();if(!visitor||!['like','dislike'].includes(reaction))return cors(bad('بيانات التقييم غير صحيحة'));const item=await env.DB.prepare("SELECT id FROM resources WHERE id=? AND status='published'").bind(id).first();if(!item)return cors(bad('File not found',404));const vh=await sha256(visitor);const existing=await env.DB.prepare('SELECT reaction FROM resource_reactions WHERE resource_id=? AND visitor_hash=?').bind(id,vh).first();if(existing?.reaction===reaction){await env.DB.prepare('DELETE FROM resource_reactions WHERE resource_id=? AND visitor_hash=?').bind(id,vh).run()}else{await env.DB.prepare('INSERT INTO resource_reactions(resource_id,visitor_hash,reaction) VALUES(?,?,?) ON CONFLICT(resource_id,visitor_hash) DO UPDATE SET reaction=excluded.reaction,updated_at=CURRENT_TIMESTAMP').bind(id,vh,reaction).run()}const stats=await env.DB.prepare("SELECT SUM(CASE WHEN reaction='like' THEN 1 ELSE 0 END) likes,SUM(CASE WHEN reaction='dislike' THEN 1 ELSE 0 END) dislikes FROM resource_reactions WHERE resource_id=?").bind(id).first();return cors(json({ok:true,likes:Number(stats?.likes||0),dislikes:Number(stats?.dislikes||0),my_reaction:existing?.reaction===reaction?'':reaction}))}
  if(url.pathname.startsWith('/api/download/')&&request.method==='GET'){const id=Number(url.pathname.split('/').pop());const item=await env.DB.prepare("SELECT file_url FROM resources WHERE id=? AND status='published'").bind(id).first();if(!item?.file_url)return new Response('File link not found',{status:404});await env.DB.prepare('UPDATE resources SET downloads=downloads+1 WHERE id=?').bind(id).run();return Response.redirect(item.file_url,302)}
  if(url.pathname==='/api/admin/check'&&request.method==='GET')return admin(request,env,async()=>json({ok:true}));
  if(url.pathname==='/api/admin/github/test'&&request.method==='GET')return admin(request,env,async()=>json(await testGitHub(env)));
  if(url.pathname==='/api/admin/logout'&&request.method==='POST')return admin(request,env,async()=>{const t=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await sha256(t)).run();return json({ok:true})});
  if(url.pathname==='/api/admin/password'&&request.method==='POST')return admin(request,env,async()=>{const b=await request.json(),oldP=String(b.old_password||''),newP=String(b.new_password||'');if(newP.length<4)return bad('كلمة المرور الجديدة يجب ألا تقل عن 4 أحرف أو أرقام');if(await sha256(oldP)!==await getSetting(env,'admin_password_hash'))return bad('كلمة المرور الحالية غير صحيحة',401);await setSetting(env,'admin_password_hash',await sha256(newP));await env.DB.prepare('DELETE FROM admin_sessions').run();return json({ok:true})});
  if(url.pathname==='/api/admin/settings'&&request.method==='GET')return admin(request,env,async()=>{const gh=await githubConfig(env);return json({x:await getSetting(env,'social_x'),linkedin:await getSetting(env,'social_linkedin'),suggestion:await getSetting(env,'suggestion_url'),email:await getSetting(env,'contact_email'),github_owner:gh.owner,github_repo:gh.repo,github_release_tag:gh.tag})});
  if(url.pathname==='/api/admin/settings'&&request.method==='PATCH')return admin(request,env,async()=>{const b=await request.json();for(const [k,key] of [['x','social_x'],['linkedin','social_linkedin'],['suggestion','suggestion_url'],['email','contact_email'],['github_owner','github_owner'],['github_repo','github_repo'],['github_release_tag','github_release_tag']])if(b[k]!==undefined)await setSetting(env,key,String(b[k]||'').trim());return json({ok:true})});
  if(url.pathname==='/api/admin/categories'&&request.method==='GET')return admin(request,env,async()=>{const {results}=await env.DB.prepare(`SELECT c.id,c.name,c.slug,c.icon,c.sort_order,c.is_visible,COUNT(DISTINCT CASE WHEN r.status!='archived' THEN r.id END) resource_count FROM categories c LEFT JOIN resource_categories rc ON rc.category_id=c.id LEFT JOIN resources r ON r.id=rc.resource_id GROUP BY c.id ORDER BY c.sort_order,c.name`).all();return json(results)});
  if(url.pathname==='/api/admin/categories'&&request.method==='POST')return admin(request,env,async()=>{const b=await request.json(),name=String(b.name||'').trim();if(!name)return bad('اسم القسم مطلوب');try{const r=await env.DB.prepare('INSERT INTO categories(name,slug,icon,sort_order,is_visible) VALUES(?,?,?,?,?)').bind(name,slugify(name)+'-'+Date.now(),String(b.icon||'▤'),Number(b.sort_order||0),b.is_visible===false?0:1).run();return json({ok:true,id:r.meta.last_row_id},201)}catch(e){return bad(e.message)}});
  const cm=url.pathname.match(/^\/api\/admin\/categories\/(\d+)$/);if(cm&&request.method==='PATCH')return admin(request,env,async()=>{const id=Number(cm[1]),b=await request.json(),sets=[],vals=[];if(b.name!==undefined){sets.push('name=?');vals.push(String(b.name).trim())}if(b.icon!==undefined){sets.push('icon=?');vals.push(String(b.icon||'▤'))}if(b.sort_order!==undefined){sets.push('sort_order=?');vals.push(Number(b.sort_order)||0)}if(b.is_visible!==undefined){sets.push('is_visible=?');vals.push(b.is_visible?1:0)}if(!sets.length)return bad('لا توجد تغييرات');vals.push(id);await env.DB.prepare(`UPDATE categories SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();return json({ok:true})});if(cm&&request.method==='DELETE')return admin(request,env,async()=>{const id=Number(cm[1]),n=await env.DB.prepare("SELECT COUNT(*) n FROM resource_categories rc JOIN resources r ON r.id=rc.resource_id WHERE rc.category_id=? AND r.status!='archived'").bind(id).first();if(Number(n?.n)>0)return bad('لا يمكن حذف قسم يحتوي على ملفات.');await env.DB.prepare('DELETE FROM resource_categories WHERE category_id=?').bind(id).run();await env.DB.prepare('DELETE FROM categories WHERE id=?').bind(id).run();return json({ok:true})});
  if(url.pathname==='/api/admin/resources'&&request.method==='GET')return admin(request,env,async()=>{const {results}=await env.DB.prepare(`SELECT r.*,GROUP_CONCAT(DISTINCT c.name) category_names,GROUP_CONCAT(DISTINCT c.id) category_ids,SUM(CASE WHEN rx.reaction='like' THEN 1 ELSE 0 END) reaction_likes,SUM(CASE WHEN rx.reaction='dislike' THEN 1 ELSE 0 END) reaction_dislikes FROM resources r LEFT JOIN resource_categories rc ON rc.resource_id=r.id LEFT JOIN categories c ON c.id=rc.category_id LEFT JOIN resource_reactions rx ON rx.resource_id=r.id GROUP BY r.id ORDER BY CASE r.status WHEN 'published' THEN 1 WHEN 'hidden' THEN 2 ELSE 3 END,r.updated_at DESC`).all();return json(hydrateResources(results))});
  if(url.pathname==='/api/admin/github/upload'&&request.method==='POST')return admin(request,env,async()=>{const form=await request.formData(),file=form.get('file');if(!(file instanceof File))return bad('اختر ملفًا أولًا.');if(file.size>2*1024*1024*1024)return bad('حجم الملف يتجاوز 2GB.');return json(await uploadToGitHub(env,file))});
  if(url.pathname==='/api/admin/resources'&&request.method==='POST')return admin(request,env,async()=>{let b={},uploaded=null;const ct=request.headers.get('content-type')||'';if(ct.includes('multipart/form-data')){const form=await request.formData();const file=form.get('file');b={title:form.get('title'),category_ids:parseIdsInput(form.get('category_ids')),description:form.get('description'),keywords:form.get('keywords'),version:form.get('version'),file_type:form.get('file_type'),featured:String(form.get('featured'))==='true'};if(file instanceof File){if(file.size>2*1024*1024*1024)return bad('حجم الملف يتجاوز 2GB.');uploaded=await uploadToGitHub(env,file);b.file_url=uploaded.url;b.file_name=uploaded.file_name;b.file_type=uploaded.file_type}else b.file_url=form.get('file_url')}else b=await request.json();const title=String(b.title||'').trim(),fileUrl=String(b.file_url||'').trim(),ids=parseIds(b.category_ids||b.category_id);if(!title||!fileUrl)return bad('اسم الملف والملف مطلوبان');if(!ids.length)return bad('اختر قسمًا واحدًا على الأقل');const fileName=String(b.file_name||uploaded?.file_name||inferFileName(fileUrl)),fileType=String((!b.file_type||b.file_type==='auto')?(uploaded?.file_type||inferFileType(fileName)):b.file_type);const r=await env.DB.prepare(`INSERT INTO resources(title,slug,description,category_id,file_url,file_name,file_type,keywords,version,status,featured,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(title,slugify(title)+'-'+Date.now(),b.description||'',ids[0],fileUrl,fileName,fileType,b.keywords||'',b.version||'1.0','published',b.featured?1:0).run();await syncCategories(env,r.meta.last_row_id,ids);return json({ok:true,id:r.meta.last_row_id,file_url:fileUrl,file_name:fileName,file_type:fileType},201)});
  const rm=url.pathname.match(/^\/api\/admin\/resources\/(\d+)$/);if(rm&&request.method==='PATCH')return admin(request,env,async()=>{const id=Number(rm[1]),sets=[],vals=[];let b={},uploaded=null;const ct=request.headers.get('content-type')||'';if(ct.includes('multipart/form-data')){const form=await request.formData();const file=form.get('file');b={title:form.get('title'),category_ids:parseIdsInput(form.get('category_ids')),description:form.get('description'),keywords:form.get('keywords'),version:form.get('version'),file_type:form.get('file_type'),featured:String(form.get('featured'))==='true'};if(file instanceof File){if(file.size>2*1024*1024*1024)return bad('حجم الملف يتجاوز 2GB.');uploaded=await uploadToGitHub(env,file);b.file_url=uploaded.url;b.file_name=uploaded.file_name;b.file_type=uploaded.file_type}}else b=await request.json();const allowed=['title','description','file_url','file_type','keywords','version','status','featured'];for(const k of allowed)if(b[k]!==undefined){sets.push(`${k}=?`);vals.push(k==='featured'?(b[k]?1:0):b[k])}if(b.file_url!==undefined){const n=String(b.file_name||uploaded?.file_name||inferFileName(String(b.file_url)));if(n){sets.push('file_name=?','file_type=?');vals.push(n,String((!b.file_type||b.file_type==='auto')?(uploaded?.file_type||inferFileType(n)):b.file_type))}}const ids=b.category_ids!==undefined?parseIds(b.category_ids):null;if(ids&&!ids.length)return bad('اختر قسمًا واحدًا على الأقل');if(ids){sets.push('category_id=?');vals.push(ids[0])}if(!sets.length&&ids===null)return bad('لا توجد تغييرات');if(sets.length){sets.push('updated_at=CURRENT_TIMESTAMP');vals.push(id);await env.DB.prepare(`UPDATE resources SET ${sets.join(',')} WHERE id=?`).bind(...vals).run()}if(ids)await syncCategories(env,id,ids);return json({ok:true,file_url:uploaded?.url||b.file_url||undefined})});if(rm&&request.method==='DELETE')return admin(request,env,async()=>{const id=Number(rm[1]);await env.DB.prepare('DELETE FROM resource_categories WHERE resource_id=?').bind(id).run();await env.DB.prepare('DELETE FROM resources WHERE id=?').bind(id).run();return json({ok:true})});
  return env.ASSETS.fetch(request);
 }catch(e){return cors(json({error:'Server error',message:e.message},500))}
}};
