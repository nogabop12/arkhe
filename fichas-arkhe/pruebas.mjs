import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { fields } from "./esquema.mjs";
import { makeServer } from "./servidor.mjs";

const sharp = createRequire(import.meta.url)("sharp");
const pixel = await sharp({create:{width:4,height:4,channels:3,background:"#8565a1"}}).png().toBuffer();
const port = process.env.ARKHE_TEST_PORT || "18984";
const origin = "http://127.0.0.1:"+port;
const privateData = {discord:"discord-ficticio-privado",minecraft:"mc-ficticio-privado",nacimiento:"2000-05-15",generoJugador:"dato-de-jugador-privado",pronombresJugador:"pronombres-personales-privados",secretos:"secreto-ficticio-privado",motivacion:"motivacion-ficticia-privada",detonante:"detonante-ficticio-privado"};
function fictional(overrides={}) {
    const values = {...privateData, nombre:"Ada Senda de Prueba", tipoSkin:"Adjuntar una imagen", tipoRetrato:"Adjuntar una ilustración",
        compartirRedes:"1", canales:"https://example.org/arkhe-ficticio", videos:"Sí", youtube:"https://www.youtube.com/@prueba-arkhe",
        nativo:"Sí", raza:"Hada de la Flor", segundo:"Sí", extras:"Ninguno",...overrides};
    const data = new FormData();
    for (const f of fields) {
        if (f.kind!=="file") data.set(f.key,values[f.key] ?? f.options?.[0] ?? "Texto ficticio para "+f.key);
    }
    for (const k of ["skin","retrato"]) data.set(k,new Blob([pixel],{type:"image/png"}),k+".png");
    return data;
}
const get = (path, headers={}) => fetch(origin+path,{headers});
const post = (path,body,headers={},siteOrigin=origin) => fetch(origin+path,{method:"POST",headers:{origin:siteOrigin,...headers},body,redirect:"manual"});
const params = data => new URLSearchParams(data);
async function text(response,status) {
    const body = await response.text();
    assert.equal(response.status,status,response.status === status ? undefined : body);
    return body;
}

test("recepción, correcciones, aprobación idempotente y frontera privada", async () => {
    const dataDir = await mkdtemp(join(tmpdir(),"arkhe-test-"));
    const password = randomBytes(24).toString("base64url");
    const siteDir = process.env.ARKHE_SITE_DIR || new URL("../web/",import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/,"");
    const config = {origin,password,dataDir,siteDir};
    let server;
    function matchRev(html) { return html.match(/name="rev" value="(\d+)"/)?.[1]; }
    async function start() {
        const started = await makeServer(config);
        started.listen(Number(port),"127.0.0.1");
        await once(started,"listening");
        return started;
    }
    try {
        server = await start();
        const home = await text(await get("/personajes.html"),200);
        assert.match(home,/Enviar ficha/);
        assert.equal((home.match(/<section class="ficha-paso"/g)||[]).length,7);
        assert.match(home,/Compromiso inquebrantable con la equidad/);
        const wrong = fictional();
        wrong.set("rasgo0","Rasgo inválido");
        assert.equal((await post("/api/arkhe/fichas",wrong)).status,400);
        const invalidImage = fictional();
        invalidImage.set("skin",new Blob(["no es una imagen"],{type:"image/png"}),"imagen.png");
        assert.equal((await post("/api/arkhe/fichas",invalidImage)).status,400);
        assert.equal((await post("/api/arkhe/fichas",fictional(),{},"https://otra.example")).status,403);
        const sub = await post("/api/arkhe/fichas",fictional());
        const receipt = JSON.parse(await text(sub,201));
        assert.equal(receipt.estado,"Pendiente de revisión");
        assert.match(await text(await get(receipt.location),200),/Pendiente de revisión/);
        assert.doesNotMatch(await text(await get("/personajes.html"),200),/Ada Senda de Prueba/);
        assert.doesNotMatch(await text(await get("/administracion"),200),/Ada Senda de Prueba/);
        const auth = await post("/administracion/entrar",params({password}));
        assert.equal(auth.status,303);
        const headers = {Cookie:auth.headers.get("set-cookie").split(";")[0]};
        const admin = await text(await get("/administracion",headers),200);
        const record = admin.match(/href="(\/administracion\/[0-9a-f-]{36})"/)[1];
        assert.equal((await get(record)).status,403);
        assert.equal((await get(record+"/skin")).status,403);
        assert.equal((await get(record+"/skin",headers)).headers.get("content-type"),"image/png");
        assert.equal((await post(record+"/aprobar",params({rev:1}))).status,403);
        const first = await text(await get(record,headers),200);
        assert.match(first,/discord-ficticio-privado/);
        assert.equal((await post(record+"/aprobar",params({rev:matchRev(first)}),headers)).status,409);
        const note = "Aclarar el oficio, por favor.";
        assert.equal((await post(record+"/cambios",params({rev:matchRev(first),nota:note}),headers)).status,303);
        assert.match(await text(await get(receipt.location),200),/Cambios solicitados/);
        assert.match(await text(await get(receipt.location),200),/Aclarar el oficio/);
        const revised = fictional({oficio:"Encuadernadora de prueba",apariencia:"datos no incluidos"});
        revised.delete("skin");
        revised.delete("retrato");
        assert.equal((await post(receipt.location.replace("/ficha-recibida/","/api/arkhe/fichas/"),revised)).status,201);
        const rev = matchRev(await text(await get(record,headers),200));
        const selection = new URLSearchParams([["rev",rev],["campo","oficio"],["campo","retrato"],["campo","redes"],["campo","discord"],["campo","skin"]]);
        assert.equal((await post(record+"/seleccion",selection,headers)).status,303);
        const review = await text(await get(record,headers),200);
        assert.equal((await get(record+"/previa")).status,403);
        const preview = await text(await get(record+"/previa",headers),200);
        assert.match(preview,/Encuadernadora de prueba/);
        assert.match(preview,/example.org\/arkhe-ficticio/);
        for (const value of Object.values(privateData)) assert(!preview.includes(value));
        assert.match(preview,/src="\/administracion\/.*\/retrato"/);
        // An approval made from a stale revision is rejected.
        assert.equal((await post(record+"/aprobar",params({rev}),headers)).status,409);
        const finalRev = matchRev(review);
        assert.equal((await post(record+"/aprobar",params({rev:finalRev}),headers)).status,303);
        assert.equal((await post(record+"/aprobar",params({rev:finalRev}),headers)).status,303);
        const catalog = await text(await get("/personajes.html"),200);
        assert.equal((catalog.match(/Ada Senda de Prueba/g)||[]).length,1);
        const path = catalog.match(/href="(\/personajes\/ada-senda-de-prueba-[^"]+)"/)[1];
        const html = await text(await get(path),200);
        const art = html.match(/src="(\/retratos\/[^"]+)"/)[1];
        assert.equal(html,preview.replace(record+"/retrato",art));
        assert.equal((await get(art)).headers.get("content-type"),"image/png");
        for (const page of [catalog,html]) for (const value of Object.values(privateData)) assert(!page.includes(value));
        assert.equal((await get("/fichas.sqlite")).status,404);
        assert.equal((await get("/servidor.mjs")).status,404);
        await new Promise(resolve=>server.close(resolve));
        server = await start();
        assert.match(await text(await get(path),200),/Ada Senda de Prueba/);
        assert.equal((await get(record+"/skin")).status,403);
        assert.equal((await post("/administracion/salir",params({}),headers)).status,303);
        assert.equal((await get(record+"/skin",headers)).status,403);

        // Consent is enforced independently of the moderator's checkbox.
        const noConsent = fictional({nombre:"Sin permiso de redes",compartirRedes:""});
        const consentResponse = await post("/api/arkhe/fichas",noConsent);
        assert.equal(consentResponse.status,201);
        const authAgain = await post("/administracion/entrar",params({password}));
        const headersAgain = {Cookie:authAgain.headers.get("set-cookie").split(";")[0]};
        const second = (await text(await get("/administracion",headersAgain),200)).match(/href="(\/administracion\/[0-9a-f-]{36})"[^>]*>Sin permiso de redes/)[1];
        assert.equal((await post(second+"/seleccion",new URLSearchParams([["rev",1],["campo","redes"],["campo","secretos"]]),headersAgain)).status,303);
        const secondPreview = await text(await get(second+"/previa",headersAgain),200);
        assert.doesNotMatch(secondPreview,/example.org\/arkhe-ficticio|youtube.com/);
        assert.match(secondPreview,/secreto-ficticio-privado/);
    } finally {
        if (server?.listening) await new Promise(resolve=>server.close(resolve));
        await rm(dataDir,{recursive:true,force:true});
    }
});

