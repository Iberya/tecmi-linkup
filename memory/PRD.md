# PRD — Tecmi Quest / Tecmi Connect

## Problema original
Red académica gamificada para que estudiantes Tecmilenio conecten, descubran comunidades, participen en eventos y progresen; administradores gestionan catálogos, usuarios, comunidades, eventos, misiones y métricas.

## Decisiones de arquitectura
- Frontend React con navegación por rol y componentes visuales enfocados en tareas.
- Backend FastAPI con endpoints REST bajo `/api`.
- MongoDB usando exclusivamente `MONGO_URL` y `DB_NAME` existentes.
- Demo sin autenticación, con selector persistente de experiencia estudiante/administrador.
- Datos demo sembrados automáticamente para hacer la plataforma comprobable desde el primer acceso.

## Personas usuarias
- Estudiante: busca conexiones, comunidades, eventos y progreso personal.
- Administrador: supervisa la participación y mantiene los catálogos de la red.

## Requisitos principales
- Perfil académico con campus, certificado e intereses editables.
- Conexiones con estudiantes afines.
- Comunidades explorables, creación y membresía.
- Eventos filtrables, inscripción y cancelación.
- Misiones, XP, niveles e insignias/progreso.
- Dashboard administrativo con indicadores, mapa conceptual y actividad reciente.

## Implementado
### 2026-09-14
- Se reemplazó el starter por la experiencia completa de Tecmi Quest en estudiante y administrador.
- Se agregaron modelos demo y persistencia MongoDB para estudiantes, campus, certificados, intereses, comunidades, eventos y misiones.
- Se implementaron endpoints para bootstrap, perfil, conexiones, comunidades, eventos, misiones y métricas administrativas.
- Se aplicó identidad Tecmilenio: verde #00534C, verde lima #78D64B, Outfit/DM Sans, fondos atmosféricos, tarjetas de alta legibilidad y diseño responsive.
- Se validaron flujos principales con pruebas API y Playwright: carga, cambio de rol, conexiones, comunidad, evento, misión y perfil.
- Se añadió estado de carga de métricas y aviso global para errores de operaciones.

### 2026-09-17
- Se amplió el pasaporte con avatar por URL, descripción personal, semestre/tetramestre, intereses personalizados y certificaciones cursadas.
- Se añadieron chats globales por comunidad, entrada/salida libre y mensajes directos desde la red académica.
- Se agregaron misiones extra y se hizo idempotente la entrega de XP para impedir recompensas duplicadas.
- Se validaron los flujos de perfil, chats, membresías, misiones y cambio de rol con pruebas API y navegador.

### 2026-09-19
- Se restauró el dashboard administrativo completo con métricas, mapa, tendencias, actividad, participación por certificado, impacto y últimos eventos.
- Se añadieron vistas funcionales de usuarios, certificados, campus, comunidades, eventos, retos/misiones y reportes.
- Se agregaron acciones persistentes para activar/desactivar usuarios, crear catálogos, publicar eventos, registrar asistencia y crear misiones con XP.
- Se validó la experiencia admin completa y se confirmó que los flujos de estudiante, perfil y chats permanecen funcionando.

## Backlog priorizado
- P0: mantener los flujos demo y persistencia estables.
- P1: CRUD visual completo para catálogos y eventos desde el panel administrador.
- P1: gestión de miembros, solicitudes aceptadas/rechazadas y detalle de comunidades.
- P1: insignias persistentes y feed social.
- P2: autenticación real y permisos por rol.
- P2: analítica histórica con gráficas y exportación de reportes.

## Próximas tareas
1. Crear formularios administrativos para editar y desactivar campus, certificados e intereses.
2. Agregar vista de detalle de evento con lista de inscritos y registro de asistencia.
3. Incorporar insignias obtenidas al pasaporte del estudiante.
4. Añadir feed social y publicaciones por comunidad.
## Iteration 8 (Feb 2026)
- **Match ≡ Red Académica unificados**: eliminado tab "Explorar"; vista Match ahora tiene búsqueda, filtros de campus, filtros de aporte/necesidad + tarjetas con skills/needs. Home apunta "Explorar estudiantes" a Match.
- **Fix backend HIGH**: `ensure_extensions()` ya no sobreescribe campos del perfil (semestre, descripcion, avatar, certificados_cursados) en cada llamada a `/api/bootstrap`. Ahora usa filtro condicional `{semestre:{$exists:false}}`.
- **Fix backend menor**: `POST /api/admin/missions` responde con `nombre` + `titulo` para consistencia con catálogo genérico.
- **Tests**: 16/16 pytest verdes.

## Iteration 9 (Feb 2026) — Ecosistema Link-Up completo
- **Afinidad Real**: `affinity()` calcula % con Jaccard sobre intereses+skills+needs, boost cruzado (mis skills ∩ tus needs) y +15 si mismo certificado. Ana obtiene 89% real con Mar
- **Match Diario**: `GET /api/match/daily` (top 3) + sección "Tecmi Match · Hoy" en Home con `data-testid="daily-matches"`
- **Historial de Conexiones**: nueva colección `connections` con estados pendiente/aceptada, endpoints GET /connections, POST /connections/{id}/accept, pestaña "Conexiones" en nav
- **Feed con Categorías**: chips `Todos / Comunidad / Noticias / Oportunidades` + selector de categoría al publicar + query param `?categoria=`
- **Cometas**: BRELA, HALLEY, IKEYA, ARAYA como sociedades tipo casas de Harry Potter. Cada estudiante tiene `cometa`. Vista dedicada con fortalezas, cita y detalle visual
- **Historia reescrita** con la narrativa completa "¿Qué es Tecmi Link-Up?"
- Tests: **24/24 verdes** (16 regresión + 8 nuevos)

## Iteration 10 (Feb 2026) — Cometas vivos + notificaciones
- **Notificaciones**: colección `notifications`, campana con badge de no leídas y panel con click-outside. Auto-generación al aceptar conexión y al comentar
- **Chat Cometa**: colección `cometa_messages` + endpoints GET/POST /api/cometas/{id}/messages, con seeds y UI de chat lateral estilo Discord
- **Ranking semanal**: /api/cometas/ranking agrega XP total y miembros por Cometa, barra con % relativo al top. Se recalcula tras el quiz
- **Test de Cometa**: 6 preguntas, /api/cometa-quiz + /submit reasigna `student.cometa` y actualiza badge "Tu Cometa" en vivo
- Tests: **31/31 verdes** (24 regresión + 7 nuevos)

## Iteration 12 (Feb 2026) — Auth + Insignias + Miembros + Retos + Push
- **Login/Sign up** por correo `@tecmilenio.mx` (sin contraseña): `AL0*` → estudiante, resto → administrador. Rechaza otros dominios. Persistencia via `localStorage.tecmi_user_id` + interceptor axios `X-User-Id`
- **Refactor backend**: dependency `current_user` en todos los endpoints mutantes; sin más "student-mar" hardcoded. Admins en misma colección con `rol='administrador'` (excluidos del ranking y de member listings)
- **Insignias por Cometa**: 100 XP → Aspirante, 300 XP → Guardián, 600 XP → Estrella. Visibles en la sección Cometas del estudiante
- **Explorar Miembros**: `/api/cometas/{id}/members` con filtros de campus y skill; UI con selects + cards
- **Retos Cometa**: `cm-brela`, `cm-halley`, `cm-ikeya`, `cm-araya` con XP directo al ranking. UI con botón "Completar" y visualización estilo pill
- **Push real-time**: polling de `/api/notifications` cada 8s en app + chat de cometa refresca cada 5s. Al enviar mensaje de cometa se notifica a otros miembros
- Tests: **48/48 verdes** (31 regresión + 17 nuevos)

## Iteration 13 (Feb 2026) — Rebranding + Onboarding + Perfil Público + Recuperar Sesión
- **Rebranding a "Tecmi Link-Up"**: sidebar, auth hero, `<title>` HTML, eyebrow Home, admin dashboard, backend FastAPI title
- **Auth screen limpio**: eliminados textos "hint" (AL0 explicación) y "footer" (aviso sin contraseña) por petición del usuario
- **Onboarding Cometa**: tras signup exitoso, sessionStorage flag `tecmi_open_quiz='1'` hace que el primer paso del estudiante sea abrir el test de Cometa automáticamente en la vista Cometas
- **Recuperar sesión**: botón "¿Olvidaste tu correo?" muestra hasta 5 emails recientes guardados en `localStorage.tecmi_recent_emails` con nombre y auto-fill al click
- **Perfil Público**: modal accesible desde Match (avatar/nombre/botón "Ver perfil") y desde Miembros del Cometa, mostrando avatar grande, campus, semestre, cometa, match %, bio, skills, needs, intereses, certificados y acciones Conectar/Chat
- Tests: **48/48 backend verdes** (regresión pura tras rename)

## Iteration 15 (Feb 2026) — Catálogos Tecmilenio reales
- **40 campus reales** por estado con flag `is_connect` para Espacios Connect (Tijuana Río, Saltillo, Mítikah, Reforma, Santa Fe, Las Américas, Satélite, León, Tampico) y coordenadas SVG para el mapa
- **42 certificaciones categorizadas** en Tecnología e ingeniería, Negocios, Industrias creativas y Bienestar y salud con proveedor (Siemens, LinkedIn Learning, HubSpot, Google, BBVA, SigmaPro, Tecmilenio, Tecnológico de Monterrey)
- **22 carreras** agrupadas por área expuestas en `/api/bootstrap.careers`; ProfileUpdate acepta `carrera` (Pydantic field agregado)
- **Mapa SVG de México real** en pantalla Mapa Tecmi con pins por estado que muestran cantidad de campus; click revela lista de campus con badge Espacio Connect
- **Perfil**: dropdown Campus (40 opciones) + dropdown Carrera (22 opciones agrupadas) + certificados en grupos por categoría
- **Certificados page**: filtro por categoría (chips) con banner categorizado
- Tests: **59/59 verdes** (48 regresión + 11 nuevos de extensiones Tecmilenio)

## Iteration 16 (Feb 2026) — Bug fix Certificates + Admin profile personalizado
- **Fix runtime crash**: certificados sin `categoria` ya no rompen la app; UI hace fallback a "General"
- **Admin greeting dinámico**: saludo usa nombre real del admin en vez de "Directora"
- **AdminProfile**: nueva pestaña "Mi perfil" para admins con edición de avatar (upload/URL) + rol administrativo (Líder / Docente / Ejecutivo / Administrador) que aparece en el eyebrow del dashboard
- **Backend**: `ProfileUpdate.tipo_admin: Optional[str]` con partial update seguro (no borra por omisión)
- Tests: **65/65 verdes** (59 regresión + 6 nuevos de tipo_admin + integridad de categorias)

## Iteration 17 (Feb 2026) — Mapa Tecmi con imagen real de México
- Reemplazado el SVG stylized por la imagen `image.png` real proporcionada por el usuario
- Pins re-calibrados con coordenadas ajustadas al mapa referencia (x,y en %)
- Meta collection para version-bumps de campuses (`meta.campuses_v='v2'`)
