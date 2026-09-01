const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });

const cors = (response) => {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  return response;
};

function slugify(text) {
  return text.trim().toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || crypto.randomUUID();
}

function isAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  return env.ADMIN_PASSWORD && auth === `Bearer ${env.ADMIN_PASSWORD}`;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/categories" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT id, name, slug, icon FROM categories ORDER BY sort_order, name"
        ).all();
        return cors(json(results));
      }

      if (url.pathname === "/api/resources" && request.method === "GET") {
        const q = (url.searchParams.get("q") || "").trim();
        const category = url.searchParams.get("category") || "";
        let sql = `
          SELECT r.id, r.title, r.slug, r.description, r.file_name, r.file_type,
                 r.file_size, r.keywords, r.version, r.downloads,
                 r.created_at, r.updated_at, c.name AS category_name, c.slug AS category_slug, c.icon
          FROM resources r
          LEFT JOIN categories c ON c.id = r.category_id
          WHERE r.status = 'published'
        `;
        const binds = [];
        if (q) {
          sql += " AND (r.title LIKE ? OR r.description LIKE ? OR r.keywords LIKE ?)";
          const like = `%${q}%`;
          binds.push(like, like, like);
        }
        if (category) {
          sql += " AND c.slug = ?";
          binds.push(category);
        }
        sql += " ORDER BY r.updated_at DESC LIMIT 100";
        const stmt = env.DB.prepare(sql);
        const { results } = await stmt.bind(...binds).all();
        return cors(json(results));
      }

      if (url.pathname.startsWith("/api/download/") && request.method === "GET") {
        const id = Number(url.pathname.split("/").pop());
        const item = await env.DB.prepare(
          "SELECT file_key, file_name, file_type FROM resources WHERE id = ? AND status = 'published'"
        ).bind(id).first();
        if (!item || !item.file_key) return new Response("File not found", { status: 404 });

        const object = await env.FILES.get(item.file_key);
        if (!object) return new Response("File not found", { status: 404 });

        await env.DB.prepare(
          "UPDATE resources SET downloads = downloads + 1 WHERE id = ?"
        ).bind(id).run();

        const headers = new Headers();
        headers.set("Content-Type", item.file_type || "application/octet-stream");
        headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(item.file_name || "download")}`);
        return new Response(object.body, { headers });
      }

      if (url.pathname === "/api/admin/resources" && request.method === "POST") {
        if (!isAdmin(request, env)) return cors(json({ error: "Unauthorized" }, 401));
        const body = await request.json();
        const title = String(body.title || "").trim();
        if (!title) return cors(json({ error: "title is required" }, 400));

        const slug = slugify(title) + "-" + Date.now();
        const result = await env.DB.prepare(`
          INSERT INTO resources
          (title, slug, description, category_id, file_key, file_name, file_type, file_size, keywords, version, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          title,
          slug,
          body.description || "",
          body.category_id || null,
          body.file_key || null,
          body.file_name || null,
          body.file_type || null,
          Number(body.file_size || 0),
          body.keywords || "",
          body.version || "1.0",
          body.status || "published"
        ).run();

        return cors(json({ ok: true, id: result.meta.last_row_id }, 201));
      }

      if (url.pathname === "/api/admin/upload" && request.method === "POST") {
        if (!isAdmin(request, env)) return cors(json({ error: "Unauthorized" }, 401));
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File)) return cors(json({ error: "file is required" }, 400));

        const safeName = file.name.replace(/[^\u0600-\u06FFa-zA-Z0-9._-]+/g, "_");
        const key = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
        await env.FILES.put(key, file.stream(), {
          httpMetadata: { contentType: file.type || "application/octet-stream" }
        });
        return cors(json({ ok: true, key, file_name: file.name, file_type: file.type, file_size: file.size }));
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      return cors(json({ error: "Server error", message: error.message }, 500));
    }
  }
};