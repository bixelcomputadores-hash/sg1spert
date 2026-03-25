// ═══════════════════════════════════════════════════════════════════
// SIG PORTAL — SERVIDOR DE LICENCIAS v1.0
// Node.js · Puerto 3000
// Deploy en Railway, Render, o cualquier VPS con Node
// ═══════════════════════════════════════════════════════════════════
// 
// INSTALACIÓN:
//   npm install express cors
//   node servidor_licencias.js
//
// VARIABLES DE ENTORNO (.env):
//   ADMIN_KEY=tu_clave_secreta_admin
//   PORT=3000
// ═══════════════════════════════════════════════════════════════════

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ── CONFIGURACIÓN ────────────────────────────────────────────────
const PORT       = process.env.PORT || 3000;
const ADMIN_KEY  = process.env.ADMIN_KEY || 'admin-sig-2026';  // CAMBIAR en producción
const DB_FILE    = path.join(__dirname, 'licencias_db.json');
const APP_ID     = 'SIG-PORTAL-2026';

// ── BASE DE DATOS (archivo JSON local) ───────────────────────────
function leerDB(){
  try { return JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }
  catch(e){ return []; }
}

function guardarDB(arr){
  fs.writeFileSync(DB_FILE, JSON.stringify(arr, null, 2));
}

function buscarLicencia(codigo){
  return leerDB().find(l => l.codigo === codigo.toUpperCase());
}

function diasRestantes(fechaVence){
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const v   = new Date(fechaVence); v.setHours(0,0,0,0);
  return Math.round((v - hoy) / 86400000);
}

// ── CORS HEADERS ─────────────────────────────────────────────────
function setCORS(res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
}

// ── PARSEAR BODY ─────────────────────────────────────────────────
function parseBody(req){
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body||'{}')); }
      catch(e){ resolve({}); }
    });
    req.on('error', reject);
  });
}

// ── RESPUESTAS ────────────────────────────────────────────────────
function ok(res, data){ res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(data)); }
function err(res, msg, code=400){ res.writeHead(code,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:false,error:msg})); }

// ── SERVIDOR ──────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCORS(res);

  if(req.method === 'OPTIONS'){ res.writeHead(204); res.end(); return; }

  const url = req.url.split('?')[0];

  // ── POST /verificar — El portal del cliente verifica su licencia ──
  if(req.method === 'POST' && url === '/verificar'){
    const { codigo, appId } = await parseBody(req);

    if(!codigo)            return err(res, 'Código requerido');
    if(appId !== APP_ID)   return err(res, 'App no autorizada', 403);

    const lic = buscarLicencia(codigo);
    if(!lic)               return ok(res, { ok: false, error: 'Licencia no encontrada' });

    const dias = diasRestantes(lic.vence);

    // Registrar última verificación
    const db  = leerDB();
    const idx = db.findIndex(l => l.codigo === lic.codigo);
    if(idx >= 0){
      db[idx].ultima_verificacion_servidor = new Date().toISOString();
      guardarDB(db);
    }

    return ok(res, {
      ok: true,
      licencia: {
        codigo:     lic.codigo,
        empresa:    lic.empresa,
        vence:      lic.vence,
        suspendida: lic.suspendida || false,
        dias:       dias,
      }
    });
  }

  // ── POST /admin/nueva — Crear licencia desde el panel ────────────
  if(req.method === 'POST' && url === '/admin/nueva'){
    if(req.headers['x-admin-key'] !== ADMIN_KEY) return err(res, 'No autorizado', 403);

    const body = await parseBody(req);
    const { empresa, nit, ciudad, responsable, tel, correo, tarifa, dias=30, notas } = body;

    if(!empresa) return err(res, 'Empresa requerida');

    const codigo = body.codigo_override || generarCodigo();
    const vence  = new Date(); vence.setDate(vence.getDate() + parseInt(dias));

    const lic = {
      id:         crypto.randomBytes(6).toString('hex'),
      codigo,
      empresa,
      nit:         nit||'',
      ciudad:      ciudad||'',
      responsable: responsable||'',
      tel:         tel||'',
      correo:      correo||'',
      tarifa:      tarifa||'',
      notas:       notas||'',
      vence:       vence.toISOString().split('T')[0],
      creado:      new Date().toISOString().split('T')[0],
      suspendida:  false,
      historial:   [{ accion:'Creación', fecha: new Date().toISOString().split('T')[0], dias }]
    };

    const db = leerDB();
    db.push(lic);
    guardarDB(db);

    return ok(res, { ok: true, licencia: lic });
  }

  // ── POST /admin/renovar — Renovar desde el panel ─────────────────
  if(req.method === 'POST' && url === '/admin/renovar'){
    if(req.headers['x-admin-key'] !== ADMIN_KEY) return err(res, 'No autorizado', 403);

    const { codigo, dias=30 } = await parseBody(req);
    const db  = leerDB();
    const idx = db.findIndex(l => l.codigo === codigo?.toUpperCase());
    if(idx < 0) return err(res, 'Licencia no encontrada');

    const lic   = db[idx];
    const hoy   = new Date(); hoy.setHours(0,0,0,0);
    const base  = new Date(lic.vence); base.setHours(0,0,0,0);
    const desde = base > hoy ? base : hoy;
    desde.setDate(desde.getDate() + parseInt(dias));

    lic.vence      = desde.toISOString().split('T')[0];
    lic.suspendida = false;
    lic.historial  = lic.historial || [];
    lic.historial.push({ accion: `Renovación +${dias}d`, fecha: new Date().toISOString().split('T')[0], dias });

    guardarDB(db);
    return ok(res, { ok: true, licencia: lic });
  }

  // ── POST /admin/suspender ─────────────────────────────────────────
  if(req.method === 'POST' && url === '/admin/suspender'){
    if(req.headers['x-admin-key'] !== ADMIN_KEY) return err(res, 'No autorizado', 403);

    const { codigo } = await parseBody(req);
    const db  = leerDB();
    const idx = db.findIndex(l => l.codigo === codigo?.toUpperCase());
    if(idx < 0) return err(res, 'Licencia no encontrada');

    db[idx].suspendida = true;
    db[idx].historial  = db[idx].historial || [];
    db[idx].historial.push({ accion: 'Suspensión', fecha: new Date().toISOString().split('T')[0] });
    guardarDB(db);

    return ok(res, { ok: true });
  }

  // ── POST /admin/reactivar — Reactivar licencia suspendida ──────────
  if(req.method === 'POST' && url === '/admin/reactivar'){
    if(req.headers['x-admin-key'] !== ADMIN_KEY) return err(res, 'No autorizado', 403);
    const { codigo } = await parseBody(req);
    const db  = leerDB();
    const idx = db.findIndex(l => l.codigo === codigo?.toUpperCase());
    if(idx < 0) return err(res, 'Licencia no encontrada');
    db[idx].suspendida = false;
    db[idx].historial  = db[idx].historial || [];
    db[idx].historial.push({ accion: 'Reactivación', fecha: new Date().toISOString().split('T')[0] });
    guardarDB(db);
    return ok(res, { ok: true, licencia: db[idx] });
  }

  // ── GET /admin/lista — Listar todas las licencias ─────────────────
  if(req.method === 'GET' && url === '/admin/lista'){
    if(req.headers['x-admin-key'] !== ADMIN_KEY) return err(res, 'No autorizado', 403);
    return ok(res, { ok: true, licencias: leerDB() });
  }

  // ── GET /health — Healthcheck ─────────────────────────────────────
  if(url === '/health'){
    return ok(res, { ok: true, version: '1.0', app: APP_ID, timestamp: new Date().toISOString() });
  }

  err(res, 'Ruta no encontrada', 404);
});

// ── GENERAR CÓDIGO ÚNICO ──────────────────────────────────────────
function generarCodigo(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SIG-';
  for(let i=0;i<4;i++) code += chars[Math.floor(Math.random()*chars.length)];
  code += '-';
  for(let i=0;i<4;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}

// ── ARRANQUE ──────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   SIG Portal — Servidor de Licencias     ║');
  console.log(`║   Puerto: ${PORT}                            ║`);
  console.log(`║   Admin Key: ${ADMIN_KEY.slice(0,4)}${'*'.repeat(ADMIN_KEY.length-4)}              ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('Endpoints:');
  console.log(`  POST /verificar         → Verificar licencia (clientes)`);
  console.log(`  POST /admin/nueva       → Crear licencia`);
  console.log(`  POST /admin/renovar     → Renovar licencia`);
  console.log(`  POST /admin/suspender   → Suspender licencia`);
  console.log(`  GET  /admin/lista       → Listar licencias`);
  console.log(`  GET  /health            → Estado del servidor`);
  console.log('');
  if(!fs.existsSync(DB_FILE)){
    fs.writeFileSync(DB_FILE, '[]');
    console.log('Base de datos creada: licencias_db.json');
  } else {
    const db = leerDB();
    console.log(`Base de datos: ${db.length} licencias registradas`);
  }
});

module.exports = server;
