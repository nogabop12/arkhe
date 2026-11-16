const list = text => text.split("|");
const field = (key, label, kind = "text", extra = {}) => ({ key, label, kind, ...extra });
const option = (key, label, values, extra = {}) => field(key, label, "select", {options:list(values), ...extra});
const story = (key, label, extra = {}) => field(key, label, "textarea", extra);
const optional = { optional:true };
const sensitive = { sensitive:true };
export const sectors = "Primario|Secundario|Comercial|Granjero|Gastronómico|Mágico|Servicios|Estado|Ilegal|Otros";
export const groups = [
    "Carisma/Persuasión|Voluntad de Hierro|Liderazgo|Justicia|Optimismo|Solidaridad|Puntual|Discreto",
    "Amabilidad|Empatía|Inteligencia emocional|Generosidad/Bondad|Compañerismo|Cooperación/Trabajo en equipo|Reciprocidad|Prudente",
    "Creatividad|Curiosidad|Capacidad analítica|Estratega|Proactividad|Asertividad|Compasión|Romántico/a",
    "Disciplina|Perseverancia|Responsabilidad|Paciencia|Resiliencia|Tolerancia|Astucia|Sociable",
    "Escucha activa|Honestidad|Lealtad|Respeto|Integridad|Valentía|Cordial|Mente Abierta",
    "Impulsividad|Iracundo/Agresivo|Terquedad/Obstinación|Autoritarismo|Soberbia|Egocentrismo|Falta de concentración|Fanatismo",
    "Ansiedad|Cobardía|Baja Autoestima|Evasión de problemas|Perfeccionismo|Rigidez|Falta de Autocontrol|Mentiroso/a",
    "Codicia/Avaricia|Envidia|Manipulación|Egoísmo|Corrupción|Deshonestidad|Irrespeto|Dependencia Emocional",
    "Procrastinación|Impuntualidad|Falta de disciplina/Organización|Irresponsabilidad|Desinterés/Pereza|Aislamiento|Dificultad para comunicarse|Pesimismo",
    "Indiscreto|Falta de creatividad|Deslealtad|Falta de empatía|Intolerancia|Individualismo|Vengativo|Manipulable"
].map(list);
export const steps = [
    ["Introducción", []],
    ["Datos fuera de rol", [
        field("discord","Usuario de Discord"), field("minecraft","Nickname de Minecraft"), field("nacimiento","Fecha de nacimiento","date"),
        field("generoJugador","Género del jugador"), field("pronombresJugador","Pronombres del jugador"),
        field("plataformas","Plataformas de streaming (o «No hago streaming»)"),
        story("canales","Enlaces de streaming, uno por línea", optional),
        field("compartirRedes","Autorizo a mostrar los enlaces de streaming y YouTube que indico aquí","check", optional),
        option("videos","¿Harás videos de la serie?","Sí|No|Todavía no lo sé"),
        field("youtube","Enlace de YouTube","url",{when:["videos","Sí"]}),
        option("tipoSkin","¿Cómo vas a entregar tu skin?","Enlace en 2D y 3D|Adjuntar una imagen"),
        field("skinEnlace","Enlace donde se vea la skin en 2D y 3D","url",{when:["tipoSkin","Enlace en 2D y 3D"]}),
        field("skin","Skin de Minecraft (PNG o JPG)","file",{when:["tipoSkin","Adjuntar una imagen"]})
    ]],
    ["Datos biográficos del personaje", [
        field("nombre","Nombre completo"), field("alias","Alias", "text", optional),
        option("raza","Raza","Humano/a|Elfo/a|Morfago|Antropomorfo|Orco|Duende|Hada de la Flor"),
        field("edad","Edad"), field("altura","Altura"), field("genero","Género"), field("pronombres","Pronombres"),
        option("sector","Sector laboral",sectors), field("oficio","Oficio específico"),
        option("segundo","¿Tiene un segundo trabajo activo?","No|Sí"),
        option("sector2","Sector del segundo trabajo",sectors,{when:["segundo","Sí"]}),
        field("oficio2","Segundo oficio","text",{when:["segundo","Sí"]}),
        story("horarios","¿Cómo se reparte entre ambos trabajos?",{when:["segundo","Sí"]}),
        story("origen","Origen (si es Hada de la Flor, indicá aquí la flor)"),
        field("flor","Nombre de la flor","text",{when:["raza","Hada de la Flor"]}),
        field("nacionalidad","Nacionalidad"), option("clase","Clase social","Indigente|Clase Baja|Clase Media|Clase Media Alta"),
        field("salud","Estado de salud")
    ]],
    ["Aspectos narrativos", [
        option("nativo","¿Nació en el Reino de Arkhe?","Sí|No"),
        story("motivoLlegada","¿Por qué llegó a Arkhe?",{when:["nativo","No"]}),
        story("llegada","¿Cómo llegó? Si nació en el Reino, contá qué se sabe de su nacimiento allí."),
        story("evento","¿Qué acontecimiento cambió su vida?"),
        story("amigos","Amigos y su importancia en la historia"),
        story("familia","Familiares y su importancia en la historia"),
        story("enemigos","Enemigos y su importancia en la historia"),
        story("secretos","Secretos del personaje",sensitive), story("detonante","¿Qué haría que rompa sus límites?",sensitive)
    ]],
    ["Perfil psicológico y creencias", [
        story("personalidad","Personalidad"), option("culto","Culto","Iglesia del Sol|Neutral|Culto de la Luna"),
        story("postura","¿Por qué sostiene esa postura?"),
        story("objetivo","Objetivo público"), story("motivacion","Motivación oculta",sensitive),
        story("miedos","¿Cuáles son sus miedos o fobias?"), story("reaccion","¿Cómo actúa ante ellos?")
    ]],
    ["Fortalezas y defectos", groups.map((options, i) => field("rasgo"+i,(i < 5 ? "Virtud" : "Defecto") + " · Grupo " + (i % 5 + 1),"radio",{options}))],
    ["Atributos, aspecto y mecánicas", [
        story("debilidad1","Primera debilidad narrativa o física"), story("debilidad2","Segunda debilidad narrativa o física"),
        story("masDebilidades","Otras debilidades",optional),
        story("atributos","Habilidades o atributos (sujetos a revisión de Administración)"),
        option("tipoRetrato","¿Cómo vas a presentar su aspecto?","Adjuntar una ilustración|Describir la apariencia"),
        field("retrato","Ilustración del personaje (PNG o JPG)","file",{when:["tipoRetrato","Adjuntar una ilustración"]}),
        story("apariencia","Describí su apariencia, vestimenta y colores",{when:["tipoRetrato","Describir la apariencia"]}),
        field("idiomas","Idiomas o dialectos"), story("habitos","Hábitos"), story("extras","Detalles extra (podés escribir «Ninguno»)")
    ]]
];
export const fields = steps.flatMap(([_, fields], index) => fields.map(f => ({ ...f, private:index === 1 })));
export const publicFields = fields.filter(f => !f.private && !["nativo","segundo","tipoRetrato"].includes(f.key));
export const files = ["retrato","skin"];

