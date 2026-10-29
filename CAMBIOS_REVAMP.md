# Tecmi Link-Up · Revamp (octubre 2026)

## Cómo subirlo a Emergent
1. Abre tu proyecto en Emergent y reemplaza las carpetas `backend/` y `frontend/` con las de este .zip (o súbelo a GitHub y conéctalo al proyecto, si así lo trabajan).
2. No hace falta agregar variables de entorno nuevas: se siguen usando `MONGO_URL`, `DB_NAME` y `REACT_APP_BACKEND_URL`.
3. El backend instala `bcrypt` (ya venía en `requirements.txt`). Reinicia backend y frontend después de subirlo.
4. Al arrancar, el backend migra solo la base de datos: pone contraseña a las cuentas viejas, actualiza los campus y ajusta los mensajes antiguos.

## Demo en vivo en internet (gratis)
La carpeta `hosting-render/` publica la app en Render (gratis) con la base de datos en MongoDB Atlas (gratis), y los datos no se borran. Los pasos están en `Guia_publicar_Tecmi_Link-Up.docx`. No toca la versión de Emergent: son dos copias con bases separadas.

## Probarla en tu computadora (demo local)
La carpeta `demo-local/` levanta la app completa en http://localhost:8765 con datos de ejemplo, sin MongoDB ni Emergent. Necesita Python 3.10+.
- Windows: doble clic en `demo-local/INICIAR_WINDOWS.bat`
- Mac/Linux: doble clic en `demo-local/iniciar_mac_linux.command`
- Cuentas: `AL01234567@tecmilenio.mx` (estudiante) y `laura.mendez@tecmilenio.mx` (docente), contraseña `Linkup2026`.
- La base vive en memoria: al cerrarla se reinicia. Detalles en `demo-local/LEEME.txt`.
- Al subir a Emergent puedes omitir esta carpeta.

## Ajustes del feedback del equipo
- Los popups centrales (test de Cometa, reportes, perfiles, crear comunidad, restablecer contraseña, etc.) se abren al centro de la pantalla en escritorio y celular.
- Cada tipo de certificado tiene su color: Negocios (dorado), Tecnología e ingeniería (azul), Industrias creativas (rosa) y Bienestar y salud (verde).
- Colores oficiales de los Cometas: Halley naranja/rojo, Brela azul, Ikeya morado y Araya verde. Se actualizan solos en la base al arrancar.

## Fotos de campus y recorrido de bienvenida
- Los 40 campus del mapa muestran su foto (vienen en `frontend/public/campus/`). Se quitó Artz Pedregal porque no hubo foto. Si un docente cambia una foto desde Catálogos › Campus, se respeta su cambio.
- La primera vez que un estudiante entra a Inicio (cuenta nueva o que ya existía) primero sale el test de Cometa (si aún no lo ha hecho) y, al terminarlo o cerrarlo, el recorrido que oscurece la pantalla y resalta cada botón con su explicación. El recorrido se puede saltar en cualquier momento y no vuelve a salir para esa cuenta. Los docentes no lo ven.
- Si los pop-ups siguen saliendo abajo, el navegador está abriendo una versión vieja: recarga con Ctrl+F5 (Cmd+Shift+R en Mac) y en Emergent asegúrate de que el frontend se haya vuelto a construir. Abajo del botón "Cerrar sesión" se ve la versión (`v28-oct-2026 c`); si no aparece, no es la versión nueva.
- Se corrigió un error que impedía entrar con una cuenta existente desde "Iniciar sesión".
- Cada cuenta nueva ve el test y el recorrido aunque en el mismo navegador ya se haya registrado otra cuenta antes.

## Contraseñas
- Las cuentas que ya existían entran con la contraseña temporal **UTMtorres**. La app les muestra un aviso para cambiarla en Mi perfil.
- Las cuentas nuevas eligen su contraseña al registrarse: mínimo 8 caracteres, con al menos una letra y un número.
- Todas las contraseñas, incluida la temporal, se guardan cifradas (bcrypt). Nunca se guarda el texto.
- Si alguien la olvida, un docente la restablece desde Usuarios (botón de llave) y la persona vuelve a entrar con UTMtorres.
- Correo que empieza con `AL0` = estudiante. Cualquier otro correo @tecmilenio.mx = docente/admin.

## Qué cambió
- **Diseño:** tipografías Bricolage Grotesque + Onest, fondos con textura sutil, animaciones suaves (se apagan si el sistema pide menos movimiento), barra inferior en celular y menú lateral agrupado con la sección "Explora" colapsable.
- **Errores visuales:** el % de match ya no se corta y la flecha de enviar del chat está centrada. Los nombres largos y textos ya no se parten.
- **Logo nuevo:** dos eslabones (tú + tu comunidad) con la estrella de la marca. También es el ícono de la pestaña.
- **Match e invitaciones reales:** Conectar envía una invitación. La otra persona la acepta o la rechaza en Invitaciones, y quien la envió puede cancelarla. El chat se abre cuando ambos están conectados.
- **Chats:** bandeja de mensajes con conversaciones, no leídos y notificaciones.
- **Docentes:** mensajes uno a uno entre docentes y la "Sala de docentes" (chat global).
- **Mapa:** está redibujado con coordenadas reales de cada campus, así que los pines ya caen sobre su estado. Incluye 40 campus, cada uno con su foto. Al elegir un campus se ve su foto y la lista de estudiantes de ese campus.
- **Botones:** todos tienen función. Ejemplos: comentarios y reportes en el Feed, moderación en Reportes, inscripción a eventos, entrar o salir de comunidades, editar campus y restablecer contraseñas.
- **Seguridad:** cada petición usa un token de sesión. Antes, cualquiera podía hacerse pasar por otra persona cambiando un encabezado.

## Cambiar la foto de un campus
1. Entra como docente.
2. Ve a Catálogos › Campus › Editar.
3. Pega la URL de la imagen del campus (clic derecho sobre la foto en tecmilenio.mx › "Copiar dirección de imagen").

## Pruebas
Las pruebas viejas de `backend/tests` usaban el encabezado inseguro `X-User-Id` y se reemplazaron por `backend/tests/test_revamp.py` (11 pruebas, todas pasan).
