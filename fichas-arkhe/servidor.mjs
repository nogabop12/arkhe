import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile, mkdir, realpath } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fields, publicFields, files } from "./esquema.mjs";
import { answers, catalogCard, esc, normalize, profile, redes, shell, wizard } from "./vistas.mjs";

const require = createRequire(import.meta.url);
const folder = dirname(fileURLToPath(import.meta.url));
const type = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".mp4":"video/mp4", ".webp":"image/webp" };
const states = {pending:"Pendiente de revisión",changes:"Cambios solicitados",approved:"Publicada"};
const digest = v => createHash("sha256").update(v).digest("hex");
const token = () => randomBytes(32).toString("base64url");
const validToken = /^[A-Za-z0-9_-]{43}$/;
const slugPattern = /^[a-z0-9-]{3,90}$/;
const imageLimit = 4 * 1024 * 1024;
const named = Object.fromEntries(fields.map(f=>[f.key,f]));
const labels = Object.fromEntries(publicFields.map(f=>[f.key,f.label]));
const safeDefault = new Set(["nombre","alias","raza","edad","altura","genero","pronombres","origen","flor","nacionalidad","clase","sector","oficio","sector2","oficio2","culto","idiomas","salud","personalidad","objetivo","habitos",...Array.from({length:10},(_,i)=>"rasgo"+i)]);
const bad = (message, status=400) => Object.assign(new Error(message),{status});
const json = (res, data, status=200) => send(res,status,JSON.stringify(data),"application/json; charset=utf-8");
const send = (res,status,body,kind="text/html; charset=utf-8") => {
    res.writeHead(status,{"Content-Type":kind});
    res.end(body);
};
const go = (res, url) => { res.writeHead(303,{Location:url}); res.end(); };
const fieldError = f => bad("Revisá el campo «"+f.label+"».");
const parse = value => JSON.parse(value || "{}");
const form = (action, content) => '<form method="post" action="'+action+'">'+content+'</form>';
const input = (name,value,kind="hidden") => '<input type="'+kind+'" name="'+name+'" value="'+esc(value)+'">';
const button = text => '<button type="submit">'+text+'</button>';
const checked = on => on ? " checked" : "";
const idPath = /^\/administracion\/([0-9a-f-]{36})(?:\/(previa|seleccion|cambios|aprobar|skin|retrato))?$/;
const isWithin = (parent, child) => {
    const rel = relative(parent,child);
    return rel === "" || (!rel.startsWith("..") && !resolve(parent,rel).startsWith("..") && !/^[A-Za-z]:/.test(rel));
};
function urlValue(value,f) {
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password) throw new Error();
        if (f.key === "youtube" && !["youtube.com","www.youtube.com","m.youtube.com","youtu.be"].includes(url.hostname)) throw new Error();
        return url.href;
    } catch { throw fieldError(f); }
}
function dateValue(value,f) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw fieldError(f);
    const date = new Date(value+"T00:00:00Z");
    if (!Number.isFinite(+date) || date.toISOString().slice(0,10) !== value || date > Date.now()) throw fieldError(f);
    return value;
}
async function readForm(req, limit) {
    if (!/^(multipart\/form-data;|application\/x-www-form-urlencoded(?:;|$))/i.test(req.headers["content-type"] || "")) throw bad("Formato de formulario inválido.",415);
    if (Number(req.headers["content-length"]) > limit) { req.resume(); throw bad("El envío supera el tamaño permitido.",413); }
    let total = 0;
    const parts = [];
    for await (const part of req.iterator({destroyOnReturn:false})) {
        total += part.length;
        if (total > limit) { req.resume(); throw bad("El envío supera el tamaño permitido.",413); }
        parts.push(part);
    }
    try { return await new Response(Buffer.concat(parts),{headers:{"Content-Type":req.headers["content-type"]}}).formData(); }
    catch { throw bad("No se pudo leer el formulario."); }
}
async function parsePlayer(data, previous, sharp) {
    const cleaned = {};
    const images = {};
    for (const f of fields) {
        if (f.when && cleaned[f.when[0]] !== f.when[1]) continue;
        if (data.getAll(f.key).length > 1) throw fieldError(f);
        const value = data.get(f.key);
        if (f.kind === "file") {
            if (!value || !value.size) {
                if (previous[f.key]) { images[f.key] = previous[f.key]; continue; }
                throw fieldError(f);
            }
            if (typeof value === "string" || value.size > imageLimit) throw fieldError(f);
            try {
                const source = sharp(Buffer.from(await value.arrayBuffer()),{limitInputPixels:12_000_000, failOn:"warning"});
                const meta = await source.metadata();
                if (!["png","jpeg"].includes(meta.format) || (meta.pages && meta.pages !== 1)) throw new Error();
                // Re-encoding strips embedded metadata before any image can become public.
                images[f.key] = await source.rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true}).png().toBuffer();
            } catch { throw bad("«"+f.label+"» debe ser un PNG o JPG estático válido de hasta 4 MB."); }
            continue;
        }
        if (value !== null && typeof value !== "string") throw fieldError(f);
        const val = (value || "").trim();
        if (!val) { if (!f.optional) throw fieldError(f); continue; }
        if (val.length > (f.kind === "textarea" ? 3000 : 240)) throw fieldError(f);
        if (f.options && !f.options.includes(val)) throw fieldError(f);
        if (f.kind === "check" && val !== "1") throw fieldError(f);
        cleaned[f.key] = f.kind === "url" ? urlValue(val,f) : f.kind === "date" ? dateValue(val,f) : val;
        if (f.key === "canales") {
            const channels = val.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
            if (channels.length > 12 || channels.some(s=>s.length > 240)) throw fieldError(f);
            cleaned[f.key] = channels.map(s=>urlValue(s,f)).join("\n");
        }
    }
    return {cleaned,images};
}
function projection(row, keys) {
    const data = parse(row.data);
    const publicData = Object.create(null);
    for (const key of keys) {
        if (key === "retrato" && row.retrato) publicData.retrato = true;
        else if (key === "redes" && data.compartirRedes === "1") publicData.redes = redes(data);
        else if (labels[key] && data[key]) publicData[key] = data[key];
    }
    if (!publicData.nombre) throw bad("Seleccioná el nombre del personaje.");
    return publicData;
}

export async function makeServer(config) {
    if (!config.password || [...config.password].length < 16) throw new Error("ARKHE_ADMIN_PASSWORD debe tener al menos 16 caracteres aleatorios.");
    const origin = new URL(config.origin);
    if (origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password ||
        (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost","127.0.0.1"].includes(origin.hostname)))) throw new Error("Configurá el origen HTTPS exacto de la web.");
    const site = await realpath(config.siteDir);
    const requestedPrivate = resolve(config.dataDir);
    if (isWithin(site,requestedPrivate)) throw new Error("El almacenamiento privado debe estar fuera de la web.");
    await mkdir(requestedPrivate,{recursive:true, mode:0o700});
    const privateDir = await realpath(requestedPrivate);
    if (isWithin(site,privateDir)) throw new Error("El almacenamiento privado debe estar fuera de la web.");
    const sharp = require("sharp");
    const template = await readFile(join(site,"stellvt.html"),"utf8");
    if (!/<main\b[^>]*>[\s\S]*?<\/main>/.test(template)) throw new Error("No se encontró la estructura base de StellVT.");
    const helps = JSON.parse(await readFile(join(folder,"rasgos-ayuda.json"),"utf8"));
    const db = new DatabaseSync(join(privateDir,"fichas.sqlite"),{timeout:5000});
    db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF;");
    db.exec("CREATE TABLE IF NOT EXISTS fichas(id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, player TEXT UNIQUE NOT NULL, status TEXT NOT NULL, rev INTEGER NOT NULL, data TEXT NOT NULL, skin BLOB, retrato BLOB, note TEXT, draft TEXT, published TEXT, created TEXT NOT NULL, updated TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, expiry INTEGER NOT NULL);");
    const get = db.prepare("SELECT * FROM fichas WHERE id=?");
    const byPlayer = db.prepare("SELECT * FROM fichas WHERE player=?");
    const approved = db.prepare("SELECT slug,published FROM fichas WHERE status='approved' ORDER BY updated DESC");
    const bySlug = db.prepare("SELECT published,retrato FROM fichas WHERE slug=? AND status='approved'");
    const sessions = db.prepare("SELECT expiry FROM sessions WHERE id=? AND expiry>?");
    const loginHash = Buffer.from(digest(config.password),"hex");
    const cookie = origin.protocol === "https:" ? "__Host-arkhe_admin" : "arkhe_admin";
    const cookieToken = req => (req.headers.cookie || "").split(";").map(v=>v.trim()).find(v=>v.startsWith(cookie+"="))?.slice(cookie.length+1) || "";
    const isAdmin = req => { const session = cookieToken(req); return validToken.test(session) && Boolean(sessions.get(digest(session),Date.now())); };
    const cookieConfig = "; Path=/; HttpOnly; SameSite=Strict"+(origin.protocol === "https:" ? "; Secure" : "");
    const limits = new Map();
    function rate(req,kind,max) {
        const now = Date.now();
        for (const [key,value] of limits) if (value.until < now) limits.delete(key);
        const key = kind+"/"+req.socket.remoteAddress;
        const state = limits.get(key) || {count:0,until:now+600_000};
        if (++state.count > max || limits.size >= 4000) throw bad("Demasiados intentos. Volvé a intentar más tarde.",429);
        limits.set(key,state);
    }
    const login = () => shell("Administración de fichas", '<h1>Administración de fichas</h1>'+form("/administracion/entrar",'<label>Contraseña de Administración<input name="password" type="password" required maxlength="256" autocomplete="current-password"></label><div class="ficha-acciones">'+button("Entrar")+'</div>'));
    const playerPath = key => "/ficha-recibida/"+key;
    const adminPath = row => "/administracion/"+row.id;
    const showAttachments = row => files.filter(k=>row[k]).map(k=>'<p><a href="'+adminPath(row)+'/'+k+'">'+(k==="skin" ? "Ver skin privada" : "Ver ilustración adjunta")+'</a></p>').join("");
    const readSafe = async (base,name) => {
        const path = await realpath(join(base,name));
        if (dirname(path) !== base) throw bad("Archivo no encontrado.",404);
        return readFile(path);
    };
    function review(row) {
        const data = parse(row.data);
        const allowed = publicFields.filter(f=>f.kind === "file" ? row[f.key] : data[f.key]).map(f=>f.key);
        if (data.compartirRedes === "1" && redes(data).length) allowed.push("redes");
        const selected = row.draft ? new Set(parse(row.draft)) : safeDefault;
        const choices = allowed.filter(k=>k!=="nombre").map(k=>'<label class="ficha-check"><input type="checkbox" name="campo" value="'+k+'"'+checked(selected.has(k))+'> '+esc(labels[k] || "Redes autorizadas")+(named[k]?.sensitive ? ' (reservado por defecto)' : '')+'</label>').join("");
        const heading = '<p><a href="/administracion">← Volver a Administración</a></p><h1>'+esc(data.nombre)+'</h1><p>'+states[row.status]+'</p>';
        const body = '<section><h2>Respuestas del envío</h2><dl>'+answers(data)+'</dl>'+showAttachments(row)+'</section>';
        const rev = input("rev",row.rev);
        const editable = '<section><h2>Qué se publicará</h2><p>El nombre es obligatorio. Guardá la selección y revisá la vista previa antes de aprobar.</p>'+
            form(adminPath(row)+"/seleccion",rev+choices+'<div class="ficha-acciones">'+button("Guardar y actualizar vista previa")+'</div>')+
            (row.draft ? '<h3>Vista previa de la ficha pública</h3><iframe title="Vista previa exacta de la ficha" src="'+adminPath(row)+'/previa"></iframe>'+
                form(adminPath(row)+"/aprobar",rev+'<div class="ficha-acciones">'+button("Aprobar y publicar")+'</div>') : '')+
            '<h3>Pedir correcciones</h3>'+form(adminPath(row)+"/cambios",rev+'<label>Mensaje al jugador<textarea name="nota" required maxlength="3000" rows="4">'+esc(row.note)+'</textarea></label><div class="ficha-acciones">'+button("Solicitar cambios")+'</div>')+
            '</section>';
        return shell(data.nombre,heading+(row.status==="approved" ? '<p><a href="/personajes/'+row.slug+'.html">Abrir ficha pública</a></p>'+body :
            '<div class="ficha-admin-grid">'+body+(row.status==="pending" ? editable : '<section><h2>Correcciones solicitadas</h2><p>'+esc(row.note)+'</p><p>El jugador puede corregirla desde el enlace privado que recibió al enviarla.</p></section>')+'</div>'));
    }
    const server = createServer(async (req,res) => {
        res.setHeader("Cache-Control","no-store");
        res.setHeader("Referrer-Policy","no-referrer");
        res.setHeader("X-Content-Type-Options","nosniff");
        res.setHeader("X-Frame-Options","SAMEORIGIN");
        res.setHeader("Content-Security-Policy","default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'");
        if (origin.protocol === "https:") res.setHeader("Strict-Transport-Security","max-age=31536000");
        let here;
        try {
            here = decodeURIComponent(new URL(req.url,origin).pathname);
            // Native POST navigation omits Origin under no-referrer in some browsers.
            // Admin forms stay same-origin while receipt tokens retain no-referrer.
            if (here === "/administracion" || here.startsWith("/administracion/")) res.setHeader("Referrer-Policy","same-origin");
            if (!["GET","POST"].includes(req.method)) throw bad("Método no disponible.",405);
            if (req.method === "POST" && req.headers.origin !== origin.origin) throw bad("Origen de solicitud inválido.",403);
            if (req.method === "POST" && here === "/administracion/entrar") {
                rate(req,"login",8);
                const payload = await readForm(req,16384);
                const password = String(payload.get("password") || "");
                if (password.length > 256 || !timingSafeEqual(loginHash,Buffer.from(digest(password),"hex"))) throw bad("Credenciales inválidas.",401);
                const session = token();
                db.prepare("DELETE FROM sessions WHERE expiry<=?").run(Date.now());
                db.prepare("INSERT INTO sessions VALUES(?,?)").run(digest(session),Date.now()+8*3600_000);
                res.setHeader("Set-Cookie",cookie+"="+session+cookieConfig+"; Max-Age=28800");
                return go(res,"/administracion");
            }
            if (here === "/administracion" || here.startsWith("/administracion/")) {
                if (!isAdmin(req)) {
                    if (req.method === "GET" && here === "/administracion") return send(res,200,login());
                    throw bad("Acceso exclusivo de Administración.",403);
                }
                if (req.method === "POST" && here === "/administracion/salir") {
                    db.prepare("DELETE FROM sessions WHERE id=?").run(digest(cookieToken(req)));
                    res.setHeader("Set-Cookie",cookie+"="+cookieConfig+"; Max-Age=0");
                    return go(res,"/administracion");
                }
                if (req.method === "GET" && here === "/administracion") {
                    const page = Number(new URL(req.url,origin).searchParams.get("pagina") || "1");
                    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw bad("Página inválida.");
                    const recent = db.prepare("SELECT id,status,data FROM fichas ORDER BY (status='pending') DESC, updated DESC LIMIT 51 OFFSET ?").all((page-1)*50);
                    const list = recent.slice(0,50).map(r=>'<li><a href="'+adminPath(r)+'">'+esc(parse(r.data).nombre)+'</a> · '+states[r.status]+'</li>').join("");
                    return send(res,200,shell("Administración",'<h1>Fichas de Arkhe</h1>'+form("/administracion/salir",button("Cerrar sesión"))+
                        (list ? '<ul>'+list+'</ul>' : '<p>No hay fichas en esta página.</p>')+
                        (page>1 ? '<p><a href="?pagina='+(page-1)+'">Página anterior</a></p>' : '')+
                        (recent.length>50 ? '<p><a href="?pagina='+(page+1)+'">Página siguiente</a></p>' : '')));
                }
                const match = here.match(idPath);
                const row = match && get.get(match[1]);
                if (!row) throw bad("No se encontró el envío.",404);
                const action = match[2];
                if (req.method==="GET" && !action) return send(res,200,review(row));
                if (req.method==="GET" && files.includes(action) && row[action]) return send(res,200,row[action],"image/png");
                if (req.method==="GET" && action==="previa" && row.draft && row.status==="pending") {
                    const html = profile(template,projection(row,parse(row.draft)),row.slug);
                    return send(res,200,html.replace('/retratos/'+row.slug+'.png',adminPath(row)+'/retrato'));
                }
                if (req.method!=="POST" || !["seleccion","cambios","aprobar"].includes(action)) throw bad("Ruta de Administración no disponible.",404);
                const data = await readForm(req,48*1024);
                const expected = String(data.get("rev"));
                const current = get.get(row.id);
                if (action==="aprobar" && current.status==="approved") return go(res,adminPath(row));
                if (current.status!=="pending" || String(current.rev)!==expected) throw bad("La ficha cambió. Volvé al envío y revisá la versión actual.",409);
                const now = new Date().toISOString();
                if (action==="seleccion") {
                    const keys = [...new Set(["nombre",...data.getAll("campo").filter(k=>k==="redes" || Object.hasOwn(labels,k))])];
                    projection(current,keys);
                    db.prepare("UPDATE fichas SET draft=?, rev=rev+1, updated=? WHERE id=?").run(JSON.stringify(keys),now,row.id);
                } else if (action==="cambios") {
                    const note = String(data.get("nota")||"").trim();
                    if (!note || note.length>3000) throw bad("Escribí los cambios que necesita la ficha.");
                    db.prepare("UPDATE fichas SET status='changes',note=?,draft=NULL,rev=rev+1,updated=? WHERE id=?").run(note,now,row.id);
                } else {
                    if (!current.draft) throw bad("Guardá y revisá la vista previa antes de aprobar.",409);
                    const snapshot = projection(current,parse(current.draft));
                    db.prepare("UPDATE fichas SET status='approved',published=?,note=NULL,rev=rev+1,updated=? WHERE id=?").run(JSON.stringify(snapshot),now,row.id);
                }
                return go(res,adminPath(row));
            }
            const player = here.match(/^\/ficha-recibida\/([A-Za-z0-9_-]{43})$/);
            if (req.method==="GET" && player) {
                const row = byPlayer.get(digest(player[1]));
                if (!row) throw bad("No se encontró la ficha.",404);
                const result = '<h1>Ficha recibida</h1><p role="status">'+states[row.status]+'</p><p>Guardá este enlace privado para consultar la ficha y ver si Administración pide cambios.</p>';
                const correction = row.status==="changes" ? wizard({action:"/api/arkhe/fichas/"+player[1],data:parse(row.data),attachments:row,helps,correction:row.note}) : "";
                return send(res,200,shell("Estado de tu ficha",result+correction+(row.status==="approved" ? '<p><a href="/personajes/'+row.slug+'.html">Ver ficha pública</a></p>' : '')+'<p><a href="/personajes.html">Volver a Personajes</a></p>'));
            }
            const playerSubmit = here.match(/^\/api\/arkhe\/fichas(?:\/([A-Za-z0-9_-]{43}))?$/);
            if (req.method==="POST" && playerSubmit) {
                rate(req,"ficha",20);
                const previous = playerSubmit[1] ? byPlayer.get(digest(playerSubmit[1])) : null;
                if (playerSubmit[1] && (!previous || previous.status!=="changes")) throw bad("La ficha no está abierta para correcciones.",409);
                const payload = await readForm(req,9*1024*1024);
                const {cleaned,images} = await parsePlayer(payload,previous || {},sharp);
                const now = new Date().toISOString();
                const key = playerSubmit[1] || token();
                if (previous) {
                    const changed = db.prepare("UPDATE fichas SET status='pending',rev=rev+1,data=?,skin=?,retrato=?,note=NULL,draft=NULL,updated=? WHERE id=? AND rev=? AND status='changes'").run(JSON.stringify(cleaned),images.skin||null,images.retrato||null,now,previous.id,previous.rev);
                    if (!changed.changes) throw bad("La ficha ya cambió. Recargá tu enlace.",409);
                } else {
                    const id = randomUUID();
                    const prefix = normalize(cleaned.nombre).replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,56).replace(/-+$/,"") || "personaje";
                    db.prepare("INSERT INTO fichas(id,slug,player,status,rev,data,skin,retrato,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id,prefix+"-"+id.slice(0,12),digest(key),"pending",1,JSON.stringify(cleaned),images.skin||null,images.retrato||null,now,now);
                }
                return json(res,{location:playerPath(key),estado:states.pending},201);
            }
            if (req.method==="POST") throw bad("Ruta no disponible.",404);
            const newProfile = here.match(/^\/personajes\/([a-z0-9-]+)\.html$/);
            const photo = here.match(/^\/retratos\/([a-z0-9-]+)\.png$/);
            if (newProfile || photo) {
                const slug = (newProfile || photo)[1];
                const row = slugPattern.test(slug) && bySlug.get(slug);
                if (!row) throw bad("Ficha no encontrada.",404);
                const data = parse(row.published);
                if (newProfile) return send(res,200,profile(template,data,slug));
                if (!data.retrato || !row.retrato) throw bad("Retrato no publicado.",404);
                return send(res,200,row.retrato,"image/png");
            }
            if (here === "/personajes.html") {
                const html = await readSafe(site,"personajes.html");
                const link = '<p class="ficha-workflow"><a class="volver-catalogo" href="#enviar-ficha">Enviar ficha</a></p>';
                const deck = approved.all().map(item=>catalogCard(parse(item.published),item.slug)).join("");
                const result = html.toString()
                    .replace("</head>",'<link rel="stylesheet" href="/fichas-flujo.css"></head>')
                    .replace(/<main\b[^>]*>/, opening=>opening+link)
                    .replace(/<section class="personajes">/, opening=>opening+deck)
                    .replace("</main>",wizard({helps})+"</main>")
                    .replace("</body>",'<script src="/fichas-flujo.js" defer></script></body>');
                return send(res,200,result);
            }
            if (here === "/fichas-flujo.js" || here === "/fichas-flujo.css") return send(res,200,await readSafe(folder,basename(here)),type[extname(here)]);
            const name = here === "/" ? "index.html" : here.slice(1);
            if (!name || name !== basename(name) || !Object.hasOwn(type,extname(name).toLowerCase())) throw bad("Página no encontrada.",404);
            return send(res,200,await readSafe(site,name),type[extname(name).toLowerCase()]);
        } catch (error) {
            const status = error.status || (error.code === "ENOENT" ? 404 : 500);
            const message = error.status ? error.message : status === 404 ? "Página no encontrada." : "No se pudo completar la operación.";
            if (status === 500) console.error("Arkhe: error interno",error.code || error.name);
            if (here?.startsWith("/api/arkhe/")) return json(res,{message},status);
            return send(res,status,shell("Arkhe",'<h1>'+esc(message)+'</h1><p><a href="/personajes.html">Volver a Personajes</a></p>'));
        }
    });
    server.on("close",()=>db.close());
    return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const port = Number(process.env.PORT || 8888);
    const {ARKHE_ADMIN_PASSWORD:password, ARKHE_DATA_DIR:dataDir, ARKHE_SITE_DIR:siteDir} = process.env;
    if (!dataDir || !siteDir) throw new Error("Configurá ARKHE_DATA_DIR y ARKHE_SITE_DIR.");
    const server = await makeServer({siteDir,dataDir,password,origin:process.env.ARKHE_ORIGIN || "http://127.0.0.1:"+port});
    server.listen(port,process.env.ARKHE_BIND || "127.0.0.1",()=>console.log("Servidor de fichas de Arkhe en puerto "+port));
}

