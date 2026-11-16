import { steps, fields } from "./esquema.mjs";
export const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const paragraphs = v => esc(v).replace(/\r?\n/g,"<br>");
export const normalize = v => String(v ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s*\/\s*/g, "/");
const list = v => (v || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
export const initial = v => (v || "").trim().split(/\s+/).slice(0,2).map(s => [...s][0]).join("").toLocaleUpperCase("es");

export function input(f, data, helps = {}, hasFile = false) {
    const k = f.key;
    const value = data[k];
    const required = f.optional || (f.kind === "file" && hasFile) ? "" : " required";
    const condition = f.when ? ' data-cond-key="'+f.when[0]+'" data-cond-value="'+esc(f.when[1])+'"' : "";
    const label = '<label for="campo-'+k+'">'+esc(f.label)+(f.optional ? ' <small>Opcional</small>' : '')+'</label>';
    const attr = ' name="'+k+'" id="campo-'+k+'"'+required;
    let node;
    if (f.kind === "select") {
        node = '<select'+attr+'><option value="">Elegí una opción</option>'+f.options.map(o => '<option'+(value === o ? ' selected' : '')+'>'+esc(o)+'</option>').join("")+'</select>';
    } else if (f.kind === "radio") {
        return '<fieldset class="ficha-rasgos"><legend>'+esc(f.label)+'</legend>'+f.options.map(o => '<label><input type="radio" name="'+k+'" value="'+esc(o)+'"'+required+(value === o ? ' checked' : '')+'><span><strong>'+esc(o)+'</strong><small>'+esc(helps[normalize(o)] || "")+'</small></span></label>').join("")+'</fieldset>';
    } else if (f.kind === "check") {
        return '<label class="ficha-check"><input type="checkbox" name="'+k+'" value="1"'+(value === "1" ? " checked" : "")+'> '+esc(f.label)+'</label>';
    } else if (f.kind === "textarea") {
        node = '<textarea rows="4" maxlength="3000"'+attr+'>'+esc(value)+'</textarea>';
    } else if (f.kind === "file") {
        node = '<input type="file" accept="image/png,image/jpeg"'+attr+'><small>'+(hasFile ? 'Ya hay una imagen adjunta. Podés reemplazarla.' : 'Máximo 4 MB.')+'</small>';
    } else {
        node = '<input type="'+f.kind+'" maxlength="240"'+attr+' value="'+esc(value)+'">';
    }
    return '<div class="ficha-campo"'+condition+'>'+label+node+'</div>';
}

export function wizard({action="/api/arkhe/fichas", data={}, attachments={}, helps={}, correction=""} = {}) {
    return '<section id="enviar-ficha" class="ficha-workflow" aria-labelledby="titulo-enviar"><h2 id="titulo-enviar">Enviar ficha</h2>'+
    (correction ? '<p class="ficha-aviso"><strong>Cambios solicitados:</strong> '+paragraphs(correction)+'</p>' : '')+
    '<div class="ficha-progreso"><label for="ficha-pasos">Progreso de la ficha</label><progress id="ficha-pasos" value="1" max="7">1 de 7</progress><p data-paso aria-live="polite"></p></div>'+
    '<noscript><p>Activá JavaScript para completar y enviar la ficha por pasos.</p></noscript>'+
    '<form data-ficha-form action="'+esc(action)+'" method="post" enctype="multipart/form-data" hidden autocomplete="off">'+
    steps.map(([title,group], i) => '<section class="ficha-paso" data-ficha-paso><h3 tabindex="-1">'+esc(title)+'</h3>'+
        (i === 0 ? '<p>Reservá aproximadamente 45 minutos. Lo que escribas sobre el personaje debe reflejarse en el rol. Si cambia de forma drástica, avisá a Administración.</p><p>Administración revisará tu ficha y sus imágenes. Solo se publicarán los datos del personaje que apruebe y los enlaces de redes que autorices. Tus datos fuera de rol y tu skin quedan privados. Los secretos y las motivaciones ocultas se reservan salvo aprobación explícita durante la revisión.</p>' : '')+
        (i === 5 ? '<p>Elegí una opción por grupo. Las descripciones sirven como guía para elegir.</p>' : '')+
        '<div class="ficha-campos">'+group.map(f => input(f,data,helps,Boolean(attachments[f.key]))).join("")+'</div></section>').join("")+
    '<p data-ficha-error class="ficha-error" role="alert" hidden></p><div class="ficha-acciones">'+
    '<button type="button" data-atras>Atrás</button><button type="button" data-continuar>Continuar</button><button type="submit" data-enviar>Enviar a Administración</button></div></form></section>';
}

export function shell(title, main) {
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+esc(title)+' · Arkhe</title><link rel="icon" href="/arkhe.png"><link rel="stylesheet" href="/style.css">'+
    '<link rel="stylesheet" href="/arkhe-compartido.css"><link rel="stylesheet" href="/fichas-flujo.css"></head><body class="ficha-portal">'+
    '<main class="ficha-contenedor">'+main+'</main><script src="/fichas-flujo.js" defer></script></body></html>';
}
const pair = (label,value) => value ? '<p><strong>'+esc(label)+':</strong> '+paragraphs(value)+'</p>' : "";
const section = (className,label,body) => body ? '<section class="seccion '+className+'"><h2>'+label+'</h2>'+body+'</section>' : "";
const attribute = (p,item) => '<div class="atributos-grid">'+item.map(k => p[k] ? '<div class="atributo">'+esc(p[k])+'</div>' : "").join("")+'</div>';
const card = (title,value) => value ? '<div class="tarjeta"><h3>'+title+'</h3><p>'+paragraphs(value)+'</p></div>' : "";
const cards = children => children ? '<div class="tarjetas">'+children+'</div>' : "";
const listing = children => children ? '<div class="lista">'+children+'</div>' : "";

export function profile(template, p, slug) {
    const photo = p.retrato ? '<img src="/retratos/'+slug+'.png" alt="Retrato de '+esc(p.nombre)+'">' :
        '<div class="retrato-pendiente" aria-hidden="true"><span class="retrato-iniciales">'+esc(initial(p.nombre))+'</span></div>';
    const bio = [["Nombre","nombre"],["Alias","alias"],["Raza","raza"],["Edad","edad"],["Altura","altura"],["Género","genero"],["Pronombres","pronombres"],["Origen","origen"],["Flor","flor"],["Nacionalidad","nacionalidad"],["Clase social","clase"],["Sector laboral","sector"],["Oficio","oficio"],["Segundo sector","sector2"],["Segundo oficio","oficio2"],["Organización del trabajo","horarios"],["Culto","culto"],["Idiomas","idiomas"],["Estado de salud","salud"]];
    const body = '<section class="datos-biograficos"><div class="imagen-personaje">'+photo+'</div><div class="informacion-biografica"><h1>'+esc(p.nombre)+'</h1>'+
        bio.map(([l,k]) => pair(l,p[k])).join("")+'</div></section>'+
        section("historia","HISTORIA PASADA",pair("Motivo de llegada",p.motivoLlegada)+pair("Llegada",p.llegada)+pair("Acontecimiento clave",p.evento))+
        section("personalidad","PERSONALIDAD",pair("Personalidad",p.personalidad)+pair("Postura",p.postura))+
        section("miedos","MIEDOS Y FOBIAS",cards(card("Miedos",p.miedos)+card("Reacción",p.reaccion)))+
        section("relaciones","RELACIONES INTERPERSONALES",listing(pair("Amigos",p.amigos)+pair("Familia",p.familia)+pair("Enemigos",p.enemigos)))+
        section("objetivo","OBJETIVO",pair("Objetivo público",p.objetivo)+pair("Motivación",p.motivacion))+
        (p.rasgo0 || p.rasgo1 || p.rasgo2 || p.rasgo3 || p.rasgo4 ? section("atributos","VIRTUDES",attribute(p,["rasgo0","rasgo1","rasgo2","rasgo3","rasgo4"])) : "")+
        (p.rasgo5 || p.rasgo6 || p.rasgo7 || p.rasgo8 || p.rasgo9 ? section("atributos","DEFECTOS",attribute(p,["rasgo5","rasgo6","rasgo7","rasgo8","rasgo9"])) : "")+
        section("habilidades","HABILIDADES Y DEBILIDADES",cards(card("Habilidades",p.atributos)+card("Primera debilidad",p.debilidad1)+card("Segunda debilidad",p.debilidad2)+card("Otras debilidades",p.masDebilidades)))+
        section("habitos","HÁBITOS",listing(pair("Hábitos",p.habitos)))+
        section("detalles","DETALLES EXTRAS",listing(pair("Apariencia",p.apariencia)+pair("Otros detalles",p.extras)))+
        section("secreto","TEMAS PERSONALES",pair("Secretos",p.secretos)+pair("Detonante",p.detonante))+
        section("detalles","REDES AUTORIZADAS",p.redes?.map(url => '<p><a rel="nofollow noopener noreferrer" href="'+esc(url)+'">'+esc(url)+'</a></p>').join(""))+
        '<p class="regreso-ficha"><a class="volver-catalogo" href="/personajes.html">← Volver a todos los personajes</a></p>';
    return template.replace(/<title>.*?<\/title>/s, () => '<title>Arkhe | '+esc(p.nombre)+'</title>')
        .replace(/<meta name="description"[^>]*>/, () => '<meta name="description" content="Ficha pública de '+esc(p.nombre)+' en el archivo de Arkhe.">')
        .replace(/(<main\b[^>]*>)[\s\S]*?<\/main>/, (_,opening) => opening + body + '</main>')
        .replace(/(\b(?:href|src)=")(?!#|\/|[a-z]+:)/gi,"$1/");
}

export function catalogCard(p,slug) {
    const art = p.retrato ? '<div class="imagen"><img src="/retratos/'+slug+'.png" alt="" loading="lazy"></div>' :
        '<div class="imagen imagen-placeholder" aria-hidden="true"><span>'+esc(initial(p.nombre))+'</span></div>';
    return '<a class="personaje" href="/personajes/'+slug+'.html">'+art+'<div class="info"><h2>'+esc(p.nombre)+'</h2><span class="ver-mas">VER FICHA →</span></div></a>';
}
export function redes(data) { return [...new Set([...list(data.canales), data.youtube].filter(Boolean))]; }
export function answers(data) {
    return fields.filter(f => data[f.key] && f.kind !== "file").map(f=> '<dt>'+esc(f.label)+'</dt><dd>'+paragraphs(data[f.key])+'</dd>').join("");
}

