const json=(d,s=200,extra={})=>new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8',...extra}});
const securityHeaders=(r,req)=>{
  const origin=new URL(req.url).origin;
  r.headers.set('Access-Control-Allow-Origin',origin);
  r.headers.set('Vary','Origin');
  r.headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');
  r.headers.set('Access-Control-Allow-Methods','GET, POST, PATCH, DELETE, OPTIONS');
  r.headers.set('X-Content-Type-Options','nosniff');
  r.headers.set('X-Frame-Options','DENY');
  r.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  r.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  r.headers.set('Content-Security-Policy',"frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
  return r;
};
const cors=(r,req)=>securityHeaders(r,req);
const bad=(m,s=400)=>json({error:m},s);
let schemaReadyPromise;
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
  if(!rs.some(c=>c.name==='github_asset_id'))stmts.push(env.DB.prepare('ALTER TABLE resources ADD COLUMN github_asset_id INTEGER'));
  if(stmts.length)await env.DB.batch(stmts);
  await env.DB.batch([
   env.DB.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT \'\')'),
   env.DB.prepare('CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)'),
   env.DB.prepare('CREATE TABLE IF NOT EXISTS admin_login_attempts (ip_hash TEXT PRIMARY KEY, failed_attempts INTEGER NOT NULL DEFAULT 0, window_started_at INTEGER NOT NULL, blocked_until INTEGER NOT NULL DEFAULT 0)'),
   env.DB.prepare('CREATE TABLE IF NOT EXISTS resource_categories (resource_id INTEGER NOT NULL, category_id INTEGER NOT NULL, PRIMARY KEY(resource_id,category_id), FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE, FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE)'),
   env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_resource_categories_resource ON resource_categories(resource_id)'),
   env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_resource_categories_category ON resource_categories(category_id)'),
   env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_resources_featured ON resources(featured)'),
   env.DB.prepare('CREATE TABLE IF NOT EXISTS resource_ratings (resource_id INTEGER NOT NULL, visitor_hash TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(resource_id,visitor_hash), FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE)'),
   env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_resource_ratings_resource ON resource_ratings(resource_id)'),
   env.DB.prepare("CREATE TABLE IF NOT EXISTS resource_reactions (resource_id INTEGER NOT NULL, visitor_hash TEXT NOT NULL, reaction TEXT NOT NULL CHECK(reaction IN ('like','dislike')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(resource_id,visitor_hash), FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE)"),
   env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_resource_reactions_resource ON resource_reactions(resource_id)'),
   env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_categories_visible ON categories(is_visible)'),
   env.DB.prepare('CREATE TABLE IF NOT EXISTS search_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)'),
   env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_search_logs_created ON search_logs(created_at)'),
   env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_search_logs_query ON search_logs(query)'),
   env.DB.prepare("CREATE TABLE IF NOT EXISTS resource_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, resource_id INTEGER NOT NULL, reason TEXT NOT NULL DEFAULT '', details TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE)"),
   env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_resource_reports_status ON resource_reports(status)'),
   env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_resource_reports_resource ON resource_reports(resource_id)'),
   
   env.DB.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(\'social_x\',\'\')'),
   env.DB.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(\'social_linkedin\',\'\')'),
   env.DB.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(\'suggestion_url\',\'\')'),
   env.DB.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(\'contact_email\',\'\')'),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('site_title','HR Reference | مرجع الموارد البشرية')"),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('site_description','مرجعك الموحد للنماذج والسياسات والأدلة والملفات الخاصة بالموارد البشرية.')"),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('seo_keywords','الموارد البشرية, نماذج HR, موارد بشرية, HR Reference')"),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('og_image','/assets/logo.png')"),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('twitter_card','summary_large_image')"),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('canonical_url','')"),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('robots','index,follow')"),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('favicon_url','/assets/logo.png')"),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('home_hero','1')"),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('home_search','1')"),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('home_categories','1')"),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('home_latest','1')"),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('home_featured','1')"),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('home_suggestion','1')"),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('privacy_content','سياسة الخصوصية\n\nنحترم خصوصيتك ونستخدم البيانات اللازمة لتشغيل الموقع وتحسين تجربة الاستخدام. لا نطلب بيانات شخصية غير ضرورية.')"),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('terms_content','الشروط والأحكام\n\nباستخدامك للموقع فإنك توافق على استخدامه للأغراض النظامية والمشروعة.')"),
   env.DB.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('disclaimer_content','إخلاء المسؤولية\n\nالمحتوى المنشور في الموقع مرجعي وتثقيفي ولا يغني عن الرجوع إلى المصادر والأنظمة الرسمية عند الحاجة.')"),
   env.DB.prepare('UPDATE categories SET is_visible=0 WHERE slug IN (\'guides\',\'regulations\',\'recruitment\',\'payroll\',\'leaves\',\'offboarding\')'),
   env.DB.prepare('UPDATE categories SET name=\'ملفات\', slug=\'files\', icon=\'▦\', sort_order=3 WHERE slug=\'excel\' AND NOT EXISTS (SELECT 1 FROM categories WHERE slug=\'files\')'),
   env.DB.prepare('INSERT OR IGNORE INTO resource_categories(resource_id,category_id) SELECT id,category_id FROM resources WHERE category_id IS NOT NULL')
  ]);
  if(!(await getSetting(env,'admin_password_hash')) && env.ADMIN_INITIAL_PASSWORD) await setAdminPassword(env,String(env.ADMIN_INITIAL_PASSWORD));
  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at<?').bind(Date.now()).run();
 })().catch(e=>{schemaReadyPromise=null;throw e}); return schemaReadyPromise;
}
const PBKDF2_ITERATIONS=50000;
async function passwordHash(password,saltBytes){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:saltBytes,iterations:PBKDF2_ITERATIONS,hash:'SHA-256'},key,256);return [...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function bytesToHex(bytes){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')}
function hexToBytes(hex){const out=new Uint8Array(hex.length/2);for(let i=0;i<out.length;i++)out[i]=parseInt(hex.slice(i*2,i*2+2),16);return out}
async function setAdminPassword(env,password){const salt=crypto.getRandomValues(new Uint8Array(16));const hash=await passwordHash(password,salt);await setSetting(env,'admin_password_hash',hash);await setSetting(env,'admin_password_salt',bytesToHex(salt));await setSetting(env,'admin_password_scheme','pbkdf2-sha256');}
async function verifyAdminPassword(env,password){const stored=await getSetting(env,'admin_password_hash');if(!stored)return false;const scheme=await getSetting(env,'admin_password_scheme');if(scheme==='pbkdf2-sha256'){const salt=await getSetting(env,'admin_password_salt');if(!salt)return false;return (await passwordHash(password,hexToBytes(salt)))===stored;}return (await sha256(password))===stored;}
async function getSetting(env,key){const r=await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();return r?.value||''}
async function setSetting(env,key,value){await env.DB.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,value).run()}
async function createSession(env){const token=crypto.randomUUID()+'-'+crypto.randomUUID();await env.DB.prepare('INSERT INTO admin_sessions(token_hash,expires_at) VALUES(?,?)').bind(await sha256(token),Date.now()+7*24*60*60*1000).run();return token}
async function loginGuard(env,req){const ip=req.headers.get('CF-Connecting-IP')||'unknown';const key=await sha256('hrkit-login:'+ip);const now=Date.now();const windowMs=15*60*1000;const maxAttempts=5;const row=await env.DB.prepare('SELECT failed_attempts,window_started_at,blocked_until FROM admin_login_attempts WHERE ip_hash=?').bind(key).first();if(!row)return {key,allowed:true};if(Number(row.blocked_until)>now)return {key,allowed:false,retryAfter:Math.max(1,Math.ceil((Number(row.blocked_until)-now)/1000))};if(now-Number(row.window_started_at)>windowMs){await env.DB.prepare('DELETE FROM admin_login_attempts WHERE ip_hash=?').bind(key).run();return {key,allowed:true};}return {key,allowed:Number(row.failed_attempts||0)<maxAttempts};}
async function recordFailedLogin(env,key){const now=Date.now(),windowMs=15*60*1000,maxAttempts=5;const row=await env.DB.prepare('SELECT failed_attempts,window_started_at FROM admin_login_attempts WHERE ip_hash=?').bind(key).first();if(!row||now-Number(row.window_started_at)>windowMs){await env.DB.prepare('INSERT INTO admin_login_attempts(ip_hash,failed_attempts,window_started_at,blocked_until) VALUES(?,?,?,0) ON CONFLICT(ip_hash) DO UPDATE SET failed_attempts=1,window_started_at=excluded.window_started_at,blocked_until=0').bind(key,1,now).run();return 1;}const attempts=Number(row.failed_attempts||0)+1;const blockedUntil=attempts>=maxAttempts?now+15*60*1000:0;await env.DB.prepare('UPDATE admin_login_attempts SET failed_attempts=?,blocked_until=? WHERE ip_hash=?').bind(attempts,blockedUntil,key).run();return attempts;}
async function clearLoginAttempts(env,key){await env.DB.prepare('DELETE FROM admin_login_attempts WHERE ip_hash=?').bind(key).run();}
async function isAdmin(req,env){const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();if(!token)return false;const r=await env.DB.prepare('SELECT 1 FROM admin_sessions WHERE token_hash=? AND expires_at>?').bind(await sha256(token),Date.now()).first();return !!r}
async function admin(req,env,fn){if(!(await isAdmin(req,env)))return cors(bad('Unauthorized',401),req);try{return cors(await fn(),req)}catch(e){if(e?.message==='RELEASE_IMMUTABLE'||e?.status===409)return cors(json({error:'لا يمكن رفع الملفات حاليًا لأن Release التخزين مقفل في GitHub. يجب إلغاء خاصية Immutable لهذا الـRelease من GitHub دون إنشاء Release جديد.'},409),req);return cors(json({error:'تعذر إتمام العملية حاليًا. حاول مرة أخرى.'},500),req)}}
function inferFileName(url){try{const u=new URL(url);const n=decodeURIComponent(u.pathname.split('/').pop()||'');return /\.[a-z0-9]{2,6}$/i.test(n)?n:''}catch{return ''}}
const BLOCKED_UPLOAD_EXTENSIONS=new Set(['exe','dll','com','scr','bat','cmd','ps1','sh','bash','zsh','fish','vbs','vbe','ws','wsc','wsf','msi','msp','msix','appx','jar','war','ear','php','php3','php4','php5','phtml','phar','cgi','pl','py','pyc','rb','asp','aspx','jsp','jspx','js','mjs','cjs','html','htm','xhtml','svg']);
function validateUploadFile(file){const name=safeAssetName(file.name);const ext=(name.match(/\.([a-z0-9]{2,10})$/i)||[])[1]?.toLowerCase();if(ext&&BLOCKED_UPLOAD_EXTENSIONS.has(ext))return 'نوع الملف غير مسموح به لأسباب أمنية.';return ''}
function validateExternalUrl(value){try{const u=new URL(String(value||'').trim());return (u.protocol==='https:'||u.protocol==='http:')?u.href:''}catch{return ''}}
function inferFileType(name){const ext=(name.match(/\.([a-z0-9]{2,6})$/i)||[])[1]?.toLowerCase();return ({pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}[ext]||'')}

async function githubConfig(env){
  // Runtime variables are authoritative. The D1 settings remain only as a
  // backwards-compatible fallback for installations that have not migrated yet.
  const owner=String(env.GITHUB_OWNER||await getSetting(env,'github_owner')).trim();
  const repo=String(env.GITHUB_REPO||await getSetting(env,'github_repo')).trim();
  const tag=String(env.GITHUB_RELEASE_TAG||await getSetting(env,'github_release_tag')||'files-v2').trim();
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
  if(!owner||!repo)throw new GitHubApiError(500,'إعداد تخزين الملفات غير مكتمل.');
  if(tag!=='files-v2')throw new GitHubApiError(500,'إعداد Release غير صحيح.');
  // IMPORTANT: never create or replace a Release here. The existing files-v2
  // release is the storage container for this application.
  return await githubRequest(
    env,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/tags/${encodeURIComponent(tag)}`
  );
}

function safeAssetName(name){
  const clean=String(name||'file').split(/[\\/]/).pop().trim().replace(/[\u0000-\u001f<>:"|?*]/g,'-');
  return clean.slice(0,180)||`file-${Date.now()}`;
}

async function uploadToGitHub(env,file){
  const release=await ensureGitHubRelease(env);
  const {owner,repo}=await githubConfig(env);
  if(release.tag_name!=='files-v2')throw new GitHubApiError(500,'Release التخزين المطلوب غير صحيح.');
  if(release.immutable===true)throw new GitHubApiError(409,'RELEASE_IMMUTABLE','Release files-v2 is immutable.',{message:'Release files-v2 is immutable'});
  const uploadError=validateUploadFile(file);if(uploadError)throw new GitHubApiError(400,uploadError);const name=safeAssetName(file.name);
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

async function listGitHubReleaseAssets(env){
  const release=await ensureGitHubRelease(env);
  const {owner,repo}=await githubConfig(env);
  const assets=[];
  for(let page=1;page<=10;page++){
    const batch=await githubRequest(env,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/${release.id}/assets?per_page=100&page=${page}`);
    if(!Array.isArray(batch)||!batch.length)break;
    assets.push(...batch);
    if(batch.length<100)break;
  }
  return {release,assets};
}
async function githubStorageStats(env){
  const {release,assets}=await listGitHubReleaseAssets(env);
  const usedBytes=assets.reduce((sum,a)=>sum+Number(a.size||0),0);
  return {ok:true,release:release.tag_name||'files-v2',assets_count:assets.length,assets_limit:1000,assets_remaining:Math.max(0,1000-assets.length),used_bytes:usedBytes,used_gb:usedBytes/1024/1024/1024,max_file_bytes:2*1024*1024*1024,total_release_limit_bytes:null,total_release_limit_label:'غير محدود وفق حدود GitHub الحالية'};
}

async function githubOrphanAssets(env){
  const {release,assets}=await listGitHubReleaseAssets(env);
  const {results}=await env.DB.prepare('SELECT id,file_name,file_url,github_asset_id,status FROM resources').all();
  const linkedIds=new Set();
  const linkedNames=new Set();
  const linkedUrls=new Set();
  for(const r of (results||[])){
    const id=Number(r.github_asset_id||0); if(id)linkedIds.add(id);
    if(r.file_name)linkedNames.add(String(r.file_name));
    if(r.file_url)linkedUrls.add(String(r.file_url));
  }
  const {owner,repo}=await githubConfig(env);
  const prefix=`https://github.com/${owner}/${repo}/releases/download/`;
  const orphans=assets.filter(a=>{
    if(linkedIds.has(Number(a.id)))return false;
    if(linkedUrls.has(String(a.browser_download_url||'')))return false;
    if(String(a.browser_download_url||'').startsWith(prefix) && linkedNames.has(String(a.name||'')))return false;
    return true;
  }).map(a=>({id:Number(a.id),name:String(a.name||''),size:Number(a.size||0),created_at:a.created_at,updated_at:a.updated_at,browser_download_url:a.browser_download_url}));
  return {ok:true,release:release.tag_name||'files-v2',orphans,orphan_count:orphans.length};
}

async function cleanupGitHubOrphans(env){
  const {orphans}=await githubOrphanAssets(env);
  const {owner}=await githubConfig(env);
  const deleted=[]; const failed=[];
  for(const a of orphans){
    try{
      await githubRequest(env,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent((await githubConfig(env)).repo)}/releases/assets/${a.id}`,{method:'DELETE'});
      deleted.push(a);
    }catch(e){failed.push({asset:a,error:e.message||'تعذر الحذف'});}
  }
  return {ok:failed.length===0,deleted_count:deleted.length,failed_count:failed.length,deleted,failed};
}
async function deleteGitHubAssetForResource(env,resource){
  if(!resource?.file_url)return false;
  const url=String(resource.file_url);
  if(!url.startsWith('https://github.com/'))return false;
  const {owner,repo}=await githubConfig(env);
  let assetId=Number(resource.github_asset_id||0);
  if(!assetId){
    try{
      const {assets}=await listGitHubReleaseAssets(env);
      const expectedPrefix=`https://github.com/${owner}/${repo}/releases/download/`;const match=assets.find(a=>String(a.browser_download_url||'')===url || (url.startsWith(expectedPrefix) && resource.file_name && a.name===resource.file_name));
      assetId=Number(match?.id||0);
    }catch(e){console.error('[GitHub] unable to resolve asset for deletion',e);return false;}
  }
  if(!assetId)return false;
  await githubRequest(env,`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/assets/${assetId}`,{method:'DELETE'});
  return true;
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
 if(request.method==='OPTIONS')return cors(new Response(null,{status:204}),request); const url=new URL(request.url);
 try{await ensureSchema(env);
  if(url.pathname==='/api/settings'&&request.method==='GET')return cors(json({x:await getSetting(env,'social_x'),linkedin:await getSetting(env,'social_linkedin'),suggestion:await getSetting(env,'suggestion_url'),email:await getSetting(env,'contact_email'),title:await getSetting(env,'site_title'),description:await getSetting(env,'site_description'),keywords:await getSetting(env,'seo_keywords'),og_image:await getSetting(env,'og_image'),twitter_card:await getSetting(env,'twitter_card'),canonical:await getSetting(env,'canonical_url'),robots:await getSetting(env,'robots'),favicon:await getSetting(env,'favicon_url'),home:{hero:await getSetting(env,'home_hero')==='1',search:await getSetting(env,'home_search')==='1',categories:await getSetting(env,'home_categories')==='1',latest:await getSetting(env,'home_latest')==='1',featured:await getSetting(env,'home_featured')==='1',suggestion:await getSetting(env,'home_suggestion')==='1'}}),request);
  if(url.pathname==='/api/admin/login'&&request.method==='POST'){const guard=await loginGuard(env,request);if(!guard.allowed)return cors(json({error:'تم إيقاف محاولات تسجيل الدخول مؤقتًا. حاول بعد قليل.'},429,{'Retry-After':String(guard.retryAfter||900)}),request);const b=await request.json();const p=String(b.password||'');if(!p)return cors(bad('كلمة المرور مطلوبة'),request);if(!(await verifyAdminPassword(env,p))){await recordFailedLogin(env,guard.key);return cors(bad('كلمة المرور غير صحيحة',401),request)}await clearLoginAttempts(env,guard.key);return cors(json({ok:true,token:await createSession(env)}),request)}
  if(url.pathname==='/api/search'&&request.method==='POST'){const b=await request.json().catch(()=>({}));const q=normalizeArabic(String(b.query||'').trim()).slice(0,120);if(q)await env.DB.prepare('INSERT INTO search_logs(query) VALUES(?)').bind(q).run();return cors(json({ok:true}),request)}
  const reportMatch=url.pathname.match(/^\/api\/resources\/(\d+)\/report$/);if(reportMatch&&request.method==='POST'){const id=Number(reportMatch[1]);const exists=await env.DB.prepare("SELECT 1 FROM resources WHERE id=? AND status!='archived'").bind(id).first();if(!exists)return cors(bad('الملف غير موجود',404),request);const b=await request.json().catch(()=>({}));const reason=String(b.reason||'مشكلة في الملف').trim().slice(0,100);const details=String(b.details||'').trim().slice(0,1000);await env.DB.prepare('INSERT INTO resource_reports(resource_id,reason,details) VALUES(?,?,?)').bind(id,reason,details).run();return cors(json({ok:true}),request)}
  if(url.pathname==='/api/categories'&&request.method==='GET'){
   const {results}=await env.DB.prepare(`SELECT c.id,c.name,c.slug,c.icon,c.sort_order,COUNT(DISTINCT CASE WHEN r.status='published' THEN r.id END) resource_count FROM categories c LEFT JOIN resource_categories rc ON rc.category_id=c.id LEFT JOIN resources r ON r.id=rc.resource_id WHERE c.is_visible=1 GROUP BY c.id ORDER BY c.sort_order,c.name`).all();return cors(json(results),request);
  }
  if(url.pathname==='/api/resources'&&request.method==='GET'){
   const q=normalizeArabic(url.searchParams.get('q')||''),cat=url.searchParams.get('category')||'',featured=url.searchParams.get('featured')||'';let sql=`SELECT r.id,r.title,r.slug,r.description,r.file_url,r.file_name,r.file_type,r.keywords,r.version,r.downloads,r.views,r.featured,r.created_at,r.updated_at,(SELECT COUNT(*) FROM resource_reactions rx1 WHERE rx1.resource_id=r.id AND rx1.reaction='like') reaction_likes,(SELECT COUNT(*) FROM resource_reactions rx2 WHERE rx2.resource_id=r.id AND rx2.reaction='dislike') reaction_dislikes, GROUP_CONCAT(DISTINCT c.name) category_names, GROUP_CONCAT(DISTINCT c.slug) category_slugs FROM resources r LEFT JOIN resource_categories rc ON rc.resource_id=r.id LEFT JOIN categories c ON c.id=rc.category_id AND c.is_visible=1 WHERE r.status='published'`;
   const b=[];if(q){const fields=['r.title','r.description','r.keywords','r.file_name'].map(normalizedSqlExpression);sql+=` AND (${fields.map(f=>f+' LIKE ?').join(' OR ')})`;const x=`%${normalizeArabic(q)}%`;b.push(x,x,x,x)}if(cat){sql+=` AND EXISTS(SELECT 1 FROM resource_categories xrc JOIN categories xc ON xc.id=xrc.category_id WHERE xrc.resource_id=r.id AND xc.slug=? AND xc.is_visible=1)`;b.push(cat)}if(featured==='1')sql+=' AND r.featured=1';sql+=' GROUP BY r.id ORDER BY '+(featured==='1'?'r.downloads DESC,r.updated_at DESC':'r.updated_at DESC')+' LIMIT 100';const {results}=await env.DB.prepare(sql).bind(...b).all();return cors(json(hydrateResources(results)),request);
  }
  if(url.pathname.startsWith('/api/resources/')&&request.method==='POST'&&url.pathname.endsWith('/view')){const id=Number(url.pathname.split('/')[3]);const item=await env.DB.prepare("SELECT id FROM resources WHERE id=? AND status='published'").bind(id).first();if(!item)return cors(bad('File not found',404),request);await env.DB.prepare('UPDATE resources SET views=views+1 WHERE id=?').bind(id).run();return cors(json({ok:true}),request)}
  if(url.pathname.startsWith('/api/resources/')&&request.method==='POST'&&url.pathname.endsWith('/reaction')){try{await env.DB.batch([env.DB.prepare("CREATE TABLE IF NOT EXISTS resource_reactions (resource_id INTEGER NOT NULL, visitor_hash TEXT NOT NULL, reaction TEXT NOT NULL CHECK(reaction IN ('like','dislike')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(resource_id,visitor_hash), FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE)"),env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_resource_reactions_resource ON resource_reactions(resource_id)')]);const id=Number(url.pathname.split('/')[3]);if(!Number.isInteger(id)||id<1)return cors(bad('الملف غير صحيح'),request);const b=await request.json();const reaction=String(b.reaction||'').trim();const visitor=String(b.visitor_id||'').trim();if(!visitor||!['like','dislike'].includes(reaction))return cors(bad('بيانات التقييم غير صحيحة'),request);const item=await env.DB.prepare("SELECT id FROM resources WHERE id=? AND status='published'").bind(id).first();if(!item)return cors(bad('File not found',404),request);const vh=await sha256(visitor);const existing=await env.DB.prepare('SELECT reaction FROM resource_reactions WHERE resource_id=? AND visitor_hash=?').bind(id,vh).first();if(existing?.reaction===reaction){await env.DB.prepare('DELETE FROM resource_reactions WHERE resource_id=? AND visitor_hash=?').bind(id,vh).run()}else{await env.DB.prepare('INSERT OR REPLACE INTO resource_reactions(resource_id,visitor_hash,reaction,created_at) VALUES(?,?,?,CURRENT_TIMESTAMP)').bind(id,vh,reaction).run()}const stats=await env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN reaction='like' THEN 1 ELSE 0 END),0) likes,COALESCE(SUM(CASE WHEN reaction='dislike' THEN 1 ELSE 0 END),0) dislikes FROM resource_reactions WHERE resource_id=?").bind(id).first();const mine=await env.DB.prepare('SELECT reaction FROM resource_reactions WHERE resource_id=? AND visitor_hash=?').bind(id,vh).first();return cors(json({ok:true,likes:Number(stats?.likes||0),dislikes:Number(stats?.dislikes||0),my_reaction:mine?.reaction||''}),request)}catch(e){console.error('reaction error',e);return cors(json({error:e?.message||'Server error'},500),request)}}
  if(url.pathname.startsWith('/api/download/')&&request.method==='GET'){const id=Number(url.pathname.split('/').pop());const item=await env.DB.prepare("SELECT file_url FROM resources WHERE id=? AND status='published'").bind(id).first();if(!item?.file_url)return new Response('File link not found',{status:404});await env.DB.prepare('UPDATE resources SET downloads=downloads+1 WHERE id=?').bind(id).run();return Response.redirect(item.file_url,302)}
  if(url.pathname==='/api/admin/check'&&request.method==='GET')return admin(request,env,async()=>json({ok:true}));
  if(url.pathname==='/api/admin/analytics'&&request.method==='GET')return admin(request,env,async()=>{const totals=await env.DB.prepare("SELECT COUNT(*) total,COALESCE(SUM(downloads),0) downloads,COALESCE(SUM(views),0) views,COALESCE(SUM(CASE WHEN featured=1 THEN 1 ELSE 0 END),0) featured FROM resources WHERE status!='archived'").first();const popular=await env.DB.prepare("SELECT id,title,downloads,views FROM resources WHERE status!='archived' ORDER BY downloads DESC,views DESC LIMIT 10").all();const searches=await env.DB.prepare("SELECT query,COUNT(*) count FROM search_logs WHERE created_at>=datetime('now','-30 day') GROUP BY query ORDER BY count DESC,query LIMIT 10").all();const reports=await env.DB.prepare("SELECT COUNT(*) count FROM resource_reports WHERE status='new'").first();return json({totals,popular:popular.results||[],searches:searches.results||[],new_reports:Number(reports?.count||0)});});
  if(url.pathname==='/api/admin/broken-links'&&request.method==='GET')return admin(request,env,async()=>{const {results}=await env.DB.prepare("SELECT id,title,file_url,file_name,status FROM resources WHERE file_url IS NOT NULL AND TRIM(file_url)!='' AND status!='archived' ORDER BY updated_at DESC LIMIT 100").all();const broken=[];for(const r of results||[]){let status=0,ok=false,error='';try{let res=await fetch(String(r.file_url),{method:'HEAD',redirect:'follow'});status=res.status;if(!res.ok&&[403,405,429].includes(res.status))res=await fetch(String(r.file_url),{method:'GET',headers:{Range:'bytes=0-0'},redirect:'follow'});status=res.status;ok=res.ok;}catch(e){error=e.message||'تعذر الوصول للرابط'}if(!ok)broken.push({id:r.id,title:r.title,file_name:r.file_name,status,error,url:r.file_url})}return json({ok:true,checked:(results||[]).length,broken_count:broken.length,broken});});
  if(url.pathname==='/api/admin/resources/bulk'&&request.method==='POST')return admin(request,env,async()=>{const b=await request.json(),ids=parseIds(b.ids),action=String(b.action||'');if(!ids.length)return bad('اختر ملفًا واحدًا على الأقل');const allowedActions=['publish','hide','draft','archive'];if(!allowedActions.includes(action))return bad('الإجراء غير صالح');const status={publish:'published',hide:'hidden',draft:'draft',archive:'archived'}[action];const placeholders=ids.map(()=>'?').join(',');await env.DB.prepare(`UPDATE resources SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).bind(status,...ids).run();return json({ok:true,count:ids.length,status});});
  if(url.pathname==='/api/admin/github/test'&&request.method==='GET')return admin(request,env,async()=>json(await testGitHub(env)));
  if(url.pathname==='/api/admin/github/storage'&&request.method==='GET')return admin(request,env,async()=>json(await githubStorageStats(env)));
  if(url.pathname==='/api/admin/github/orphans'&&request.method==='GET')return admin(request,env,async()=>json(await githubOrphanAssets(env)));
  if(url.pathname==='/api/admin/github/orphans/cleanup'&&request.method==='POST')return admin(request,env,async()=>json(await cleanupGitHubOrphans(env)));
  if(url.pathname==='/api/admin/logout'&&request.method==='POST')return admin(request,env,async()=>{const t=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await sha256(t)).run();return json({ok:true})});
  if(url.pathname==='/api/admin/password'&&request.method==='POST')return admin(request,env,async()=>{const b=await request.json(),oldP=String(b.old_password||''),newP=String(b.new_password||'');if(newP.length<8)return bad('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف أو أرقام');if(!(await verifyAdminPassword(env,oldP)))return bad('كلمة المرور الحالية غير صحيحة',401);await setAdminPassword(env,newP);await env.DB.prepare('DELETE FROM admin_sessions').run();return json({ok:true})});
  if(url.pathname==='/api/admin/settings'&&request.method==='GET')return admin(request,env,async()=>{const gh=await githubConfig(env);const keys=['social_x','social_linkedin','suggestion_url','contact_email','site_title','site_description','seo_keywords','og_image','twitter_card','canonical_url','robots','favicon_url','privacy_content','terms_content','disclaimer_content','home_hero','home_search','home_categories','home_latest','home_featured','home_suggestion'];const out={};for(const k of keys)out[k]=await getSetting(env,k);return json({...out,github_owner:gh.owner,github_repo:gh.repo,github_release_tag:gh.tag})});
  if(url.pathname==='/api/admin/settings'&&request.method==='PATCH')return admin(request,env,async()=>{const b=await request.json();const map=[['x','social_x'],['linkedin','social_linkedin'],['suggestion','suggestion_url'],['email','contact_email'],['site_title','site_title'],['site_description','site_description'],['seo_keywords','seo_keywords'],['og_image','og_image'],['twitter_card','twitter_card'],['canonical_url','canonical_url'],['robots','robots'],['favicon_url','favicon_url'],['privacy_content','privacy_content'],['terms_content','terms_content'],['disclaimer_content','disclaimer_content'],['github_owner','github_owner'],['github_repo','github_repo'],['github_release_tag','github_release_tag']];for(const [k,key] of map)if(b[k]!==undefined)await setSetting(env,key,String(b[k]??'').trim());const homes=b.home||{};for(const [k,key] of [['hero','home_hero'],['search','home_search'],['categories','home_categories'],['latest','home_latest'],['featured','home_featured'],['suggestion','home_suggestion']])if(homes[k]!==undefined)await setSetting(env,key,homes[k]?'1':'0');return json({ok:true})});
  if(url.pathname==='/api/admin/categories'&&request.method==='GET')return admin(request,env,async()=>{const {results}=await env.DB.prepare(`SELECT c.id,c.name,c.slug,c.icon,c.sort_order,c.is_visible,COUNT(DISTINCT CASE WHEN r.status='published' THEN r.id END) resource_count FROM categories c LEFT JOIN resource_categories rc ON rc.category_id=c.id LEFT JOIN resources r ON r.id=rc.resource_id GROUP BY c.id ORDER BY c.sort_order,c.name`).all();return json(results)});
  if(url.pathname==='/api/admin/categories'&&request.method==='POST')return admin(request,env,async()=>{const b=await request.json(),name=String(b.name||'').trim();if(!name)return bad('اسم القسم مطلوب');try{const r=await env.DB.prepare('INSERT INTO categories(name,slug,icon,sort_order,is_visible) VALUES(?,?,?,?,?)').bind(name,slugify(name)+'-'+Date.now(),String(b.icon||'▤'),Number(b.sort_order||0),b.is_visible===false?0:1).run();return json({ok:true,id:r.meta.last_row_id},201)}catch(e){return bad(e.message)}});
  const cm=url.pathname.match(/^\/api\/admin\/categories\/(\d+)$/);if(cm&&request.method==='PATCH')return admin(request,env,async()=>{const id=Number(cm[1]),b=await request.json(),sets=[],vals=[];if(b.name!==undefined){sets.push('name=?');vals.push(String(b.name).trim())}if(b.icon!==undefined){sets.push('icon=?');vals.push(String(b.icon||'▤'))}if(b.sort_order!==undefined){sets.push('sort_order=?');vals.push(Number(b.sort_order)||0)}if(b.is_visible!==undefined){sets.push('is_visible=?');vals.push(b.is_visible?1:0)}if(!sets.length)return bad('لا توجد تغييرات');vals.push(id);await env.DB.prepare(`UPDATE categories SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();return json({ok:true})});if(cm&&request.method==='DELETE')return admin(request,env,async()=>{const id=Number(cm[1]),n=await env.DB.prepare("SELECT COUNT(*) n FROM resource_categories rc JOIN resources r ON r.id=rc.resource_id WHERE rc.category_id=? AND r.status!='archived'").bind(id).first();if(Number(n?.n)>0)return bad('لا يمكن حذف قسم يحتوي على ملفات.');await env.DB.prepare('DELETE FROM resource_categories WHERE category_id=?').bind(id).run();await env.DB.prepare('DELETE FROM categories WHERE id=?').bind(id).run();return json({ok:true})});
  if(url.pathname==='/api/admin/reports'&&request.method==='GET')return admin(request,env,async()=>{const {results}=await env.DB.prepare("SELECT rr.id,rr.resource_id,rr.reason,rr.details,rr.status,rr.created_at,r.title FROM resource_reports rr LEFT JOIN resources r ON r.id=rr.resource_id ORDER BY rr.created_at DESC LIMIT 100").all();return json(results||[])});
  if(url.pathname==='/api/admin/resources'&&request.method==='GET')return admin(request,env,async()=>{const {results}=await env.DB.prepare(`SELECT r.*,GROUP_CONCAT(DISTINCT c.name) category_names,GROUP_CONCAT(DISTINCT c.id) category_ids,(SELECT COUNT(*) FROM resource_reactions rx1 WHERE rx1.resource_id=r.id AND rx1.reaction='like') reaction_likes,(SELECT COUNT(*) FROM resource_reactions rx2 WHERE rx2.resource_id=r.id AND rx2.reaction='dislike') reaction_dislikes FROM resources r LEFT JOIN resource_categories rc ON rc.resource_id=r.id LEFT JOIN categories c ON c.id=rc.category_id GROUP BY r.id ORDER BY CASE r.status WHEN 'published' THEN 1 WHEN 'hidden' THEN 2 ELSE 3 END,r.updated_at DESC`).all();return json(hydrateResources(results))});
  if(url.pathname==='/api/admin/github/upload'&&request.method==='POST')return admin(request,env,async()=>{const form=await request.formData(),file=form.get('file');if(!(file instanceof File))return bad('اختر ملفًا أولًا.');if(file.size>2*1024*1024*1024)return bad('حجم الملف يتجاوز 2GB.');return json(await uploadToGitHub(env,file))});
  if(url.pathname==='/api/admin/resources'&&request.method==='POST')return admin(request,env,async()=>{let b={},uploaded=null;const ct=request.headers.get('content-type')||'';if(ct.includes('multipart/form-data')){const form=await request.formData();const file=form.get('file');b={title:form.get('title'),category_ids:parseIdsInput(form.get('category_ids')),description:form.get('description'),keywords:form.get('keywords'),version:form.get('version'),file_type:form.get('file_type'),featured:String(form.get('featured'))==='true',status:form.get('status')};if(file instanceof File){if(file.size>2*1024*1024*1024)return bad('حجم الملف يتجاوز 2GB.');uploaded=await uploadToGitHub(env,file);b.file_url=uploaded.url;b.file_name=uploaded.file_name;b.file_type=uploaded.file_type}else b.file_url=form.get('file_url')}else b=await request.json();const title=String(b.title||'').trim(),fileUrl=String(b.file_url||'').trim(),ids=parseIds(b.category_ids||b.category_id);if(!title||!fileUrl)return bad('اسم الملف والملف مطلوبان');const safeFileUrl=validateExternalUrl(fileUrl);if(!safeFileUrl)return bad('رابط الملف يجب أن يبدأ بـ http:// أو https://');if(!ids.length)return bad('اختر قسمًا واحدًا على الأقل');const fileName=String(b.file_name||uploaded?.file_name||inferFileName(safeFileUrl)),fileType=String((!b.file_type||b.file_type==='auto')?(uploaded?.file_type||inferFileType(fileName)):b.file_type);const r=await env.DB.prepare(`INSERT INTO resources(title,slug,description,category_id,file_url,file_name,file_type,keywords,version,status,featured,github_asset_id,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(title,slugify(title)+'-'+Date.now(),b.description||'',ids[0],safeFileUrl,fileName,fileType,b.keywords||'',b.version||'1.0',['published','hidden','draft'].includes(String(b.status))?String(b.status):'published',b.featured?1:0,Number(uploaded?.github_asset_id||0)||null).run();await syncCategories(env,r.meta.last_row_id,ids);return json({ok:true,id:r.meta.last_row_id,file_url:safeFileUrl,file_name:fileName,file_type:fileType},201)});
  const rm=url.pathname.match(/^\/api\/admin\/resources\/(\d+)$/);if(rm&&request.method==='PATCH')return admin(request,env,async()=>{const id=Number(rm[1]),sets=[],vals=[];const previous=await env.DB.prepare('SELECT * FROM resources WHERE id=?').bind(id).first();if(!previous)return bad('الملف غير موجود',404);let b={},uploaded=null;const ct=request.headers.get('content-type')||'';if(ct.includes('multipart/form-data')){const form=await request.formData();const file=form.get('file');b={title:form.get('title'),category_ids:parseIdsInput(form.get('category_ids')),description:form.get('description'),keywords:form.get('keywords'),version:form.get('version'),file_type:form.get('file_type'),featured:String(form.get('featured'))==='true',status:form.get('status')};if(file instanceof File){if(file.size>2*1024*1024*1024)return bad('حجم الملف يتجاوز 2GB.');uploaded=await uploadToGitHub(env,file);b.file_url=uploaded.url;b.file_name=uploaded.file_name;b.file_type=uploaded.file_type}}else b=await request.json();if(b.file_url!==undefined){const safeUrl=validateExternalUrl(String(b.file_url));if(!safeUrl)return bad('رابط الملف يجب أن يبدأ بـ http:// أو https://');b.file_url=safeUrl}const allowed=['title','description','file_url','file_type','keywords','version','status','featured'];if(b.status!==undefined&&!['published','hidden','draft','archived'].includes(String(b.status)))return bad('حالة الملف غير صالحة');for(const k of allowed)if(b[k]!==undefined){sets.push(`${k}=?`);vals.push(k==='featured'?(b[k]?1:0):b[k])}if(b.file_url!==undefined){const n=String(b.file_name||uploaded?.file_name||inferFileName(String(b.file_url)));if(n){sets.push('file_name=?','file_type=?');vals.push(n,String((!b.file_type||b.file_type==='auto')?(uploaded?.file_type||inferFileType(n)):b.file_type));if(uploaded?.github_asset_id){sets.push('github_asset_id=?');vals.push(Number(uploaded.github_asset_id))}}}const ids=b.category_ids!==undefined?parseIds(b.category_ids):null;if(ids&&!ids.length)return bad('اختر قسمًا واحدًا على الأقل');if(ids){sets.push('category_id=?');vals.push(ids[0])}if(!sets.length&&ids===null)return bad('لا توجد تغييرات');if(sets.length){sets.push('updated_at=CURRENT_TIMESTAMP');vals.push(id);await env.DB.prepare(`UPDATE resources SET ${sets.join(',')} WHERE id=?`).bind(...vals).run()}if(ids)await syncCategories(env,id,ids);if(uploaded?.github_asset_id && previous.file_url && previous.file_url!==uploaded.url){try{await deleteGitHubAssetForResource(env,previous)}catch(e){console.error('[GitHub] old asset cleanup failed',e)}}return json({ok:true,file_url:uploaded?.url||b.file_url||undefined})});if(rm&&request.method==='DELETE')return admin(request,env,async()=>{const id=Number(rm[1]);const resource=await env.DB.prepare('SELECT * FROM resources WHERE id=?').bind(id).first();if(!resource)return bad('الملف غير موجود',404);let githubDeleted=false;if(resource.file_url){try{githubDeleted=await deleteGitHubAssetForResource(env,resource)}catch(e){return bad('تعذر حذف الملف من GitHub. لم يتم حذف السجل من الموقع حتى لا يبقى ملف يتيم في التخزين.',502)}}await env.DB.prepare('DELETE FROM resource_categories WHERE resource_id=?').bind(id).run();await env.DB.prepare('DELETE FROM resources WHERE id=?').bind(id).run();return json({ok:true,github_deleted:githubDeleted})});
  if(url.pathname==='/robots.txt'&&request.method==='GET'){const base=url.origin;const robots=await getSetting(env,'robots')||'index,follow';return securityHeaders(new Response(`User-agent: *\nAllow: /\nDisallow: /admin.html\nSitemap: ${base}/sitemap.xml\n`,{headers:{'content-type':'text/plain; charset=utf-8'}}),request)}
  if(url.pathname==='/sitemap.xml'&&request.method==='GET'){const {results}=await env.DB.prepare("SELECT slug,updated_at FROM resources WHERE status='published' ORDER BY updated_at DESC LIMIT 5000").all();const base=url.origin;const urls=[`${base}/`,`${base}/privacy`,`${base}/terms`,`${base}/disclaimer`];const xml=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${u.replace(/&/g,'&amp;')}</loc></url>`).join('')}</urlset>`;return securityHeaders(new Response(xml,{headers:{'content-type':'application/xml; charset=utf-8'}}),request)}
  if((url.pathname==='/privacy'||url.pathname==='/terms'||url.pathname==='/disclaimer')&&request.method==='GET'){const key=url.pathname==='/privacy'?'privacy_content':url.pathname==='/terms'?'terms_content':'disclaimer_content';const title=url.pathname==='/privacy'?'سياسة الخصوصية':url.pathname==='/terms'?'الشروط والأحكام':'إخلاء المسؤولية';const content=await getSetting(env,key)||title;const escHtml=v=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title)} — HR Reference</title><link rel="icon" href="${escHtml(await getSetting(env,'favicon_url')||'/assets/logo.png')}"><style>body{margin:0;font-family:Arial,sans-serif;background:#f6f8fc;color:#102a56}main{max-width:900px;margin:60px auto;padding:40px;background:#fff;border-radius:20px;box-shadow:0 10px 40px rgba(8,43,99,.08)}h1{margin-top:0}p{line-height:2;white-space:pre-wrap;color:#475467}a{color:#0b3b7a}</style></head><body><main><a href="/">← العودة للرئيسية</a><h1>${escHtml(title)}</h1><p>${escHtml(content)}</p></main></body></html>`;return securityHeaders(new Response(html,{headers:{'content-type':'text/html; charset=utf-8'}}),request)}
  let assetResponse=await env.ASSETS.fetch(request);if(url.pathname==='/'&&request.method==='GET'&&assetResponse.ok){const escHtml=v=>String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));const title=await getSetting(env,'site_title')||'HR Reference | مرجع الموارد البشرية';const desc=await getSetting(env,'site_description')||'';const keywords=await getSetting(env,'seo_keywords')||'';const og=await getSetting(env,'og_image')||'/assets/logo.png';const robots=await getSetting(env,'robots')||'index,follow';const card=await getSetting(env,'twitter_card')||'summary_large_image';const canonical=await getSetting(env,'canonical_url')||'';const fav=await getSetting(env,'favicon_url')||'/assets/logo.png';let html=await assetResponse.text();html=html.replace(/<title>.*?<\/title>/i,`<title>${escHtml(title)}</title>`).replace(/<meta name="description" content="[^"]*">/i,`<meta name="description" content="${escHtml(desc)}">`).replace(/<meta name="keywords" content="[^"]*">/i,`<meta name="keywords" content="${escHtml(keywords)}">`).replace(/<meta name="robots" content="[^"]*">/i,`<meta name="robots" content="${escHtml(robots)}">`).replace(/<meta property="og:title" content="[^"]*">/i,`<meta property="og:title" content="${escHtml(title)}">`).replace(/<meta property="og:description" content="[^"]*">/i,`<meta property="og:description" content="${escHtml(desc)}">`).replace(/<meta property="og:image" content="[^"]*">/i,`<meta property="og:image" content="${escHtml(og)}">`).replace(/<meta name="twitter:card" content="[^"]*">/i,`<meta name="twitter:card" content="${escHtml(card)}">`).replace(/<link rel="icon" type="image\/png" href="[^"]*">/i,`<link rel="icon" type="image/png" href="${escHtml(fav)}">`);if(canonical){if(/<link rel="canonical"/i.test(html))html=html.replace(/<link rel="canonical"[^>]*>/i,`<link rel="canonical" href="${escHtml(canonical)}">`);else html=html.replace('</head>',`<link rel="canonical" href="${escHtml(canonical)}"></head>`)}assetResponse=new Response(html,{status:assetResponse.status,headers:assetResponse.headers})}if(assetResponse.status===404&&!url.pathname.startsWith('/api/')){const favicon=await getSetting(env,'favicon_url')||'/assets/logo.png';const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>الصفحة غير موجودة — HR Reference</title><link rel="icon" href="${String(favicon).replace(/"/g,'&quot;')}"><style>body{margin:0;font-family:Arial,sans-serif;background:#f6f8fc;color:#102a56;display:grid;place-items:center;min-height:100vh;text-align:center}main{padding:40px}h1{font-size:72px;margin:0}a{display:inline-block;margin-top:20px;padding:12px 22px;background:#082b63;color:#fff;border-radius:10px;text-decoration:none}</style></head><body><main><h1>404</h1><h2>الصفحة غير موجودة</h2><p>يبدو أن الرابط الذي فتحته غير صحيح أو لم يعد متاحًا.</p><a href="/">العودة للرئيسية</a></main></body></html>`;return securityHeaders(new Response(html,{status:404,headers:{'content-type':'text/html; charset=utf-8'}}),request)}
  return assetResponse;
 }catch(e){return cors(json({error:'Server error',message:e.message},500),request)}
}};
