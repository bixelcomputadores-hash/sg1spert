# SIG Portal — Sistema de Licencias
## Guía de configuración completa

---

## ARCHIVOS DEL SISTEMA

| Archivo | Para quién | Descripción |
|---------|-----------|-------------|
| `SIG_Panel_Licencias.html` | Solo tú (admin) | Panel para gestionar todas las empresas |
| `servidor_licencias.js` | Tu servidor online | Verifica licencias cuando los clientes abren el programa |
| `sig_licencia.js` | Dentro del portal del cliente | Módulo que activa, avisa y bloquea |
| `portal_sig_integrado_v8.html` | El cliente | El programa completo con licencias integradas |

---

## PASO 1 — CONFIGURAR TU NÚMERO DE WHATSAPP

En `sig_licencia.js`, línea 10:
```
whatsapp: '573001234567',  ← Cambia esto por tu número real (con código país 57)
```

En `SIG_Panel_Licencias.html`:
- Abre el panel → Configuración → WhatsApp Soporte → escribe tu número → Guardar

---

## PASO 2 — DESPLEGAR EL SERVIDOR (5 minutos, gratis)

### Opción A: Railway (recomendado, gratis hasta cierto uso)
1. Ve a https://railway.app y crea cuenta
2. Nuevo proyecto → Deploy from GitHub o "Empty project"
3. Sube los archivos o conecta tu repositorio
4. Variable de entorno: `ADMIN_KEY=tu_clave_secreta_aqui`
5. Railway te da una URL tipo: `https://sig-licencias.railway.app`

### Opción B: Render (también gratis)
1. Ve a https://render.com
2. New Web Service → conecta GitHub o sube archivos
3. Build command: `npm install`
4. Start command: `node servidor_licencias.js`
5. Variable de entorno: `ADMIN_KEY=tu_clave_secreta`

### Opción C: VPS propio (DigitalOcean ~$4/mes)
```bash
# En tu servidor:
git clone tu_repo o sube los archivos
npm install
ADMIN_KEY=tu_clave node servidor_licencias.js
# Para que corra siempre:
pm2 start servidor_licencias.js --name sig-licencias
```

---

## PASO 3 — ACTUALIZAR LA URL EN EL MÓDULO DEL CLIENTE

En `sig_licencia.js`, línea 9:
```javascript
servidor: 'https://TU-URL-DE-RAILWAY.railway.app',  ← tu URL real
```

---

## PASO 4 — INTEGRAR EL MÓDULO AL PORTAL

Agrega estas 2 líneas justo antes del `</body>` en `portal_sig_integrado_v8.html`:

```html
<script src="sig_licencia.js"></script>
```

O si vas a entregar un solo archivo, pega el contenido de `sig_licencia.js`
dentro de una etiqueta `<script>` al final del portal.

---

## PASO 5 — CREAR TU PRIMERA LICENCIA

### Desde el Panel (recomendado):
1. Abre `SIG_Panel_Licencias.html`
2. Contraseña: `sig2026` (cámbiala en Configuración)
3. Ir a "Nueva licencia"
4. Llenar datos de la empresa
5. Clic en "Crear licencia y activar"
6. El sistema genera el código: `SIG-XXXX-XXXX`
7. Envía ese código al cliente por WhatsApp

### Desde el servidor (API):
```bash
curl -X POST https://tu-servidor.railway.app/admin/nueva \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: tu_clave" \
  -d '{
    "empresa": "Pepe Pescados SAS",
    "nit": "900.123.456",
    "ciudad": "Bogotá",
    "responsable": "Juan Pérez",
    "tel": "3101234567",
    "tarifa": "150000",
    "dias": 30
  }'
```

---

## PASO 6 — LO QUE VE EL CLIENTE

### Primera vez (sin licencia):
- Aparece pantalla de activación con campo para el código
- Ingresa el código `SIG-XXXX-XXXX` que tú le diste
- El programa se activa automáticamente

### Con licencia activa (más de 7 días):
- Ningún aviso — trabaja normal
- En el sidebar se ve: "✅ Vence en X días"

### Faltan 7 días:
- Banner amarillo en la parte superior: "⚠️ Tu licencia vence en X días"
- Botón directo a tu WhatsApp para renovar

### Licencia vencida (dentro de los 5 días de gracia):
- Banner naranja: "🔴 Vencida hace X días — tienes Y días de gracia"
- El programa sigue funcionando

### Pasados los 5 días de gracia:
- Pantalla de bloqueo con candado 🔒
- Botón de WhatsApp para contactarte
- El programa NO funciona hasta que renueves

### Cuando tú renuevas desde el panel:
- El cliente abre el programa (o lo cierra y abre)
- Automáticamente detecta la renovación
- El bloqueo desaparece sin que el cliente haga nada

---

## RENOVAR UNA LICENCIA

### Desde tu panel:
1. Busca la empresa en "Licencias"
2. Clic en "🔄 +30d"
3. Listo — se activa en minutos en el computador del cliente

### Desde el servidor:
```bash
curl -X POST https://tu-servidor.railway.app/admin/renovar \
  -H "X-Admin-Key: tu_clave" \
  -H "Content-Type: application/json" \
  -d '{"codigo": "SIG-A4F7-B2K9", "dias": 30}'
```

---

## SUSPENDER UNA LICENCIA (cliente no pagó)

### Desde el panel:
- Busca la empresa → botón "⏸"
- El cliente verá la pantalla de bloqueo la próxima vez que abra el programa

---

## BACKUP DE TUS DATOS

El panel tiene botón de **Exportar JSON** — descarga toda tu base de datos.
Hazlo mínimo 1 vez al mes.

El servidor guarda en `licencias_db.json` — respáldalo también.

---

## PREGUNTAS FRECUENTES

**¿El cliente puede usar el programa sin internet?**
Sí — funciona offline. Solo necesita internet cuando abre el programa por primera vez o cada 6 horas para verificar la licencia. Si no hay internet, usa la verificación guardada localmente.

**¿Qué pasa si el cliente desinstala y reinstala?**
Al reinstalar el programa le pedirá el código nuevamente. Tú le das el mismo código que ya tiene — sigue funcionando si la licencia está vigente.

**¿Puedo cambiar la tarifa por cliente?**
Sí — cada licencia tiene su propia tarifa registrada en el panel. Puedes cobrar diferente por empresa según los módulos contratados.

**¿El cliente puede ver el código fuente y quitar la verificación?**
Con Electron empaquetado el código está minificado y protegido. No es 100% inviolable pero es suficiente para uso comercial normal. Si necesitas protección máxima se puede agregar ofuscación adicional.

---

## PRÓXIMO PASO — INSTALADOR ELECTRON

Para empaquetar todo en un `.exe` instalable:
1. Instalar: `npm install -g electron electron-builder`
2. Envolver el portal HTML en Electron
3. Incluir el módulo de licencias
4. Generar instalador con: `electron-builder --win`
5. Resultado: `PortalSIG_Setup_1.0.0.exe` listo para distribuir
