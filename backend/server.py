from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from pathlib import Path
from typing import Optional, List, Literal
from datetime import datetime, timezone, timedelta
import os, uuid, re, secrets, hashlib, hmac
try:
    import bcrypt
except ImportError:  # algunos Python de Windows no cargan la DLL de bcrypt: se usa PBKDF2 (también es hash con sal)
    bcrypt = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
app = FastAPI(title="Tecmi Link-Up API")
api = APIRouter(prefix="/api")

DEFAULT_PASSWORD = "UTMtorres"  # contraseña temporal para cuentas creadas antes del sistema de contraseñas
PRIVATE_FIELDS = ("_id", "password_hash")

def now(): return datetime.now(timezone.utc).isoformat()
def clean(doc):
    if not doc: return None
    for k in PRIVATE_FIELDS: doc.pop(k, None)
    return doc
def hash_password(pw: str) -> str:
    if bcrypt: return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
    salt=secrets.token_hex(16)
    return f"pbkdf2${salt}${hashlib.pbkdf2_hmac('sha256', pw.encode(), salt.encode(), 310_000).hex()}"
def check_password(pw: str, hashed: Optional[str]) -> bool:
    if not hashed: return False
    if hashed.startswith("pbkdf2$"):
        _, salt, digest = hashed.split("$")
        return hmac.compare_digest(hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 310_000).hex(), digest)
    return bool(bcrypt) and bcrypt.checkpw(pw.encode(), hashed.encode())
def password_problem(pw: str) -> Optional[str]:
    if len(pw) < 8: return "La contraseña necesita al menos 8 caracteres"
    if not re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]", pw) or not re.search(r"\d", pw): return "La contraseña necesita al menos una letra y un número"
    return None
def level_for(xp: int) -> int: return 1 + max(0, xp) // 100
def conv_id(a: str, b: str) -> str: return "|".join(sorted([a, b]))
def full_name(u): return f"{u.get('nombre','')} {u.get('apellido','')}".strip()

async def current_user(authorization: Optional[str] = Header(default=None)) -> str:
    token = authorization[7:] if authorization and authorization.startswith("Bearer ") else None
    session = await db.sessions.find_one({"token": token}, {"_id": 0}) if token else None
    if not session: raise HTTPException(401, "Tu sesión expiró. Inicia sesión de nuevo.")
    return session["user_id"]

async def current_admin(user_id: str = Depends(current_user)) -> str:
    me = await db.students.find_one({"id": user_id}, {"_id": 0, "rol": 1})
    if not me or me.get("rol") != "administrador": raise HTTPException(403, "Solo para docentes y administradores")
    return user_id

async def get_me(user_id: str):
    me = await db.students.find_one({"id": user_id}, {"_id": 0})
    if not me: raise HTTPException(401, "Sesión inválida")
    return me

async def notify(user_id, tipo, titulo, subtitulo="", avatar=None, link=None):
    await db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": user_id, "tipo": tipo, "titulo": titulo, "subtitulo": subtitulo[:80], "avatar": avatar, "link": link, "leida": False, "created_at": now()})

class SignupIn(BaseModel):
    email: str
    nombre: str
    apellido: str
    password: str
    campus: Optional[str] = None
class LoginIn(BaseModel):
    email: str
    password: str
class PasswordChange(BaseModel):
    actual: str
    nueva: str

class ProfileUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    campus: Optional[str] = None
    certificado: Optional[str] = None
    intereses: Optional[List[str]] = None
    skills: Optional[List[str]] = None
    needs: Optional[List[str]] = None
    semestre: Optional[str] = None
    carrera: Optional[str] = None
    tipo_admin: Optional[Literal["lider", "docente", "ejecutivo", "administrador"]] = None
    descripcion: Optional[str] = Field(default=None, max_length=600)
    avatar: Optional[str] = Field(default=None, max_length=400_000)  # ~300 KB; el frontend reduce la foto antes de subirla
    certificados_cursados: Optional[List[str]] = None
class CommunityCreate(BaseModel):
    nombre: str = Field(min_length=3, max_length=60)
    categoria: str
    descripcion: str = Field(max_length=280)
class EventCreate(BaseModel):
    titulo: str
    descripcion: str
    tipo: str = "nacional"
    modalidad: str = "en_linea"
    fecha_inicio: str
    fecha_fin: str
    campus: Optional[str] = None
class CatalogCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = ""
    categoria: Optional[str] = None
    proveedor: Optional[str] = None
    estado: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_connect: Optional[bool] = None
    imagen: Optional[str] = None
class CampusUpdate(BaseModel):
    nombre: Optional[str] = None
    estado: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_connect: Optional[bool] = None
    imagen: Optional[str] = None
class MessageCreate(BaseModel):
    contenido: str = Field(min_length=1, max_length=2000)
class StatusUpdate(BaseModel):
    activo: bool
class MissionCreate(BaseModel):
    nombre: str
    descripcion: str = ""
    puntos_xp: int = Field(default=10, ge=1, le=500)
    meta_progreso: int = Field(default=1, ge=1, le=50)
class PostCreate(BaseModel):
    contenido: str = Field(min_length=1, max_length=2000)
    categoria: Literal["Comunidad", "Noticias", "Oportunidades"] = "Comunidad"
class ReportCreate(BaseModel):
    motivo: str
    detalle: str = ""
class ReportResolve(BaseModel):
    accion: Literal["ocultar", "descartar"]
class QuizSubmit(BaseModel):
    answers: List[str]
class CommentCreate(BaseModel):
    contenido: str = Field(min_length=1, max_length=1000)

QUIZ = [
    {"q":"¿Qué te mueve cuando enfrentas un reto?","opts":[["Tomar la iniciativa sin miedo","brela"],["Apoyar al equipo y mantener la unión","halley"],["Buscar una idea nueva o creativa","ikeya"],["Analizar y encontrar la respuesta correcta","araya"]]},
    {"q":"En un proyecto grupal preferirías...","opts":[["Liderar la ejecución","brela"],["Coordinar y motivar al grupo","halley"],["Diseñar la propuesta creativa","ikeya"],["Investigar y validar los datos","araya"]]},
    {"q":"Tu fortaleza más natural es...","opts":[["Valentía","brela"],["Amabilidad","halley"],["Creatividad","ikeya"],["Juicio","araya"]]},
    {"q":"Un tiempo libre ideal sería...","opts":[["Un reto físico o deportivo","brela"],["Estar con personas queridas","halley"],["Crear, dibujar o inventar","ikeya"],["Leer o aprender algo nuevo","araya"]]},
    {"q":"Frase con la que te identificas más:","opts":[["No esperes, haz que suceda","brela"],["Nadie llega tan lejos como cuando caminamos juntos","halley"],["Todo comenzó como una idea","ikeya"],["Aprender es descubrir lo que podemos ser","araya"]]},
    {"q":"En Tecmilenio te ves aportando...","opts":[["Liderazgo y acción","brela"],["Comunidad y empatía","halley"],["Ideas nuevas y experiencias","ikeya"],["Conocimiento y perspectiva","araya"]]},
]

async def seed():
    if await db.students.count_documents({}) > 0: return
    students = [
        {"id":"student-mar","nombre":"Mar","apellido":"Espino","email":"mar@tecmi.mx","campus":"Monterrey","certificado":"Negocios Internacionales","intereses":["Moda","Emprendimiento","Viajes"],"skills":["Marketing","Storytelling","Comunicación"],"needs":["Diseño","Finanzas"],"cometa":"brela","nivel":4,"xp":360,"connections":18,"communities":3,"events":6,"active":True,"avatar":"https://i.pravatar.cc/100?img=47"},
        {"id":"student-ana","nombre":"Ana","apellido":"Torres","email":"ana@tecmi.mx","campus":"Guadalajara","certificado":"Negocios Internacionales","intereses":["Moda","Viajes","Emprendimiento"],"skills":["Finanzas","Estrategia","Ventas"],"needs":["Marketing","Diseño"],"cometa":"halley","nivel":3,"xp":245,"connections":12,"communities":2,"events":3,"active":True,"avatar":"https://i.pravatar.cc/100?img=32"},
        {"id":"student-diego","nombre":"Diego","apellido":"Ramírez","email":"diego@tecmi.mx","campus":"Puebla","certificado":"Ingeniería en Sistemas","intereses":["Gaming","Tecnología","Innovación"],"skills":["Programación","Datos","Automatización"],"needs":["Diseño","Marketing"],"cometa":"araya","nivel":2,"xp":180,"connections":9,"communities":1,"events":2,"active":True,"avatar":"https://i.pravatar.cc/100?img=12"},
        {"id":"student-sofia","nombre":"Sofía","apellido":"López","email":"sofia@tecmi.mx","campus":"CDMX","certificado":"Diseño Gráfico","intereses":["Arte","Fotografía","Creatividad"],"skills":["Diseño","Ilustración","Branding"],"needs":["Programación","Estrategia"],"cometa":"ikeya","nivel":4,"xp":420,"connections":22,"communities":4,"events":5,"active":True,"avatar":"https://i.pravatar.cc/100?img=44"},
    ]
    await db.students.insert_many(students)
    await db.certificates.insert_many([{"id":"cert-1","nombre":"Negocios Internacionales","descripcion":"Liderazgo y visión global"},{"id":"cert-2","nombre":"Ingeniería en Sistemas","descripcion":"Tecnología e innovación"},{"id":"cert-3","nombre":"Diseño Gráfico","descripcion":"Creatividad aplicada"}])
    await db.interests.insert_many([{"id":str(uuid.uuid4()),"nombre":x} for x in ["Moda","Viajes","Emprendimiento","Arte","Gaming","Tecnología","Fotografía","Sostenibilidad"]])
    await db.communities.insert_many([
        {"id":"com-moda","nombre":"Club de Moda","categoria":"Arte y Cultura","descripcion":"Ideas, tendencias y proyectos creativos.","members":482,"campuses":12,"joined":False,"color":"#e45e98"},
        {"id":"com-gaming","nombre":"Gaming","categoria":"Tecnología","descripcion":"Conecta, juega y crea experiencias digitales.","members":320,"campuses":8,"joined":True,"color":"#7069db"},
        {"id":"com-foto","nombre":"Fotografía","categoria":"Arte y Cultura","descripcion":"Captura historias desde tu campus.","members":312,"campuses":4,"joined":False,"color":"#e39a35"},
        {"id":"com-emprende","nombre":"Emprendimiento","categoria":"Negocios","descripcion":"Construye el futuro con otros talentos.","members":615,"campuses":7,"joined":False,"color":"#3aa878"},
    ])
    await db.events.insert_many([
        {"id":"event-1","titulo":"Semana Tecmi 2025","descripcion":"Conecta · Aprende · Vive","tipo":"nacional","modalidad":"en_linea","fecha_inicio":"2025-04-21","fecha_fin":"2025-04-25","campus":"Todos","registered":False,"attendees":2842},
        {"id":"event-2","titulo":"Reto de Innovación","descripcion":"Soluciones para transformar tu comunidad.","tipo":"nacional","modalidad":"en_linea","fecha_inicio":"2025-05-08","fecha_fin":"2025-05-08","campus":"Todos","registered":False,"attendees":543},
        {"id":"event-3","titulo":"Taller de Fotografía","descripcion":"Aprende a contar historias con tu cámara.","tipo":"local","modalidad":"presencial","fecha_inicio":"2025-05-15","fecha_fin":"2025-05-15","campus":"Monterrey","registered":False,"attendees":78},
    ])
    await db.missions.insert_many([
        {"id":"mission-1","titulo":"Conoce otro campus","descripcion":"Haz una conexión con alguien de otro campus.","progress":0,"goal":1,"xp":20,"color":"#46bd8b"},
        {"id":"mission-2","titulo":"Rompe la burbuja","descripcion":"Conecta con alguien de un certificado diferente.","progress":0,"goal":1,"xp":30,"color":"#7667db"},
        {"id":"mission-3","titulo":"Forma un equipo","descripcion":"Crea un equipo con 3 personas de diferentes campus.","progress":0,"goal":3,"xp":50,"color":"#e8ad45"},
    ])

async def ensure_extensions():
    await db.students.update_one({"id":"student-mar","semestre":{"$exists":False}},{"$set":{
        "semestre":"6º semestre","descripcion":"Conecto personas, ideas y oportunidades para construir algo que importe.",
        "certificados_cursados":["Negocios Internacionales","Liderazgo Consciente"],"avatar":"https://i.pravatar.cc/160?img=47"}})
    cometas=[
        {"id":"brela","nombre":"Brela","lema":"Atrévete a ir más allá","descripcion":"Valentía, entusiasmo y ganas de hacer que las cosas sucedan. Iniciativa y liderazgo para convertir ideas en acción.","fortalezas":["Valentía","Persistencia","Vitalidad","Liderazgo","Inteligencia social","Autorregulación"],"cita":"No esperes a que algo suceda. Haz que suceda.","color":"#2F6FD0","gradient":"linear-gradient(135deg,#3EA6E0,#3E4B80)","icon":"flame","miembros":248},
        {"id":"halley","nombre":"Halley","lema":"Juntos hacemos comunidad","descripcion":"Comunidad, unidad y crecer junto a los demás. Escuchamos, apoyamos y compartimos.","fortalezas":["Amor","Amabilidad","Trabajo en equipo","Perdón","Humildad","Gratitud"],"cita":"Nadie llega tan lejos como cuando caminamos juntos.","color":"#E2711D","gradient":"linear-gradient(135deg,#F29A2E,#962A1E)","icon":"heart","miembros":312},
        {"id":"ikeya","nombre":"Ikeya","lema":"Imagina lo que todavía no existe","descripcion":"Creación y esperanza. Imaginar, experimentar y encontrar belleza e inspiración.","fortalezas":["Creatividad","Curiosidad","Apreciación por la belleza","Esperanza","Sentido del humor","Espiritualidad"],"cita":"Todo lo que existe alguna vez comenzó como una idea.","color":"#8E3FB8","gradient":"linear-gradient(135deg,#A54FD0,#4B2765)","icon":"sparkles","miembros":195},
        {"id":"araya","nombre":"Araya","lema":"Aprende, cuestiona y descubre","descripcion":"Razón y aprendizaje. Preguntar, descubrir y usar el conocimiento para aportar.","fortalezas":["Juicio","Amor por el aprendizaje","Perspectiva","Prudencia","Justicia","Honestidad"],"cita":"Aprender es descubrir todo lo que todavía podemos llegar a ser.","color":"#2C9C6E","gradient":"linear-gradient(135deg,#3DBA7E,#1F5A43)","icon":"book","miembros":221},
    ]
    # Los colores oficiales de cada Cometa se reescriben siempre; el resto se respeta si ya existe
    for c in cometas:
        await db.cometas.update_one({"id":c["id"]},{"$setOnInsert":{k:v for k,v in c.items() if k not in ("color","gradient")},"$set":{"color":c["color"],"gradient":c["gradient"]}},upsert=True)
    extra=[
        {"id":"mission-4","titulo":"Anfitrión de comunidad","descripcion":"Únete a una comunidad y participa en su conversación.","progress":0,"goal":1,"xp":25,"color":"#38a8d1"},
        {"id":"mission-5","titulo":"Perfil con propósito","descripcion":"Completa tu descripción y agrega tres intereses.","progress":0,"goal":1,"xp":15,"color":"#e76d93"},
        {"id":"mission-6","titulo":"Conexión constante","descripcion":"Envía tres solicitudes a estudiantes afines.","progress":0,"goal":3,"xp":60,"color":"#8a66d6"},
    ]
    for mission in extra: await db.missions.update_one({"id":mission["id"]},{"$setOnInsert":mission},upsert=True)
    cometa_missions=[
        {"id":"cm-brela","titulo":"Reto Brela: lidera un pitch","descripcion":"Presenta una idea en tu Cometa y súbela al feed.","progress":0,"goal":1,"xp":40,"color":"#2F6FD0","cometa":"brela"},
        {"id":"cm-halley","titulo":"Reto Halley: círculo de escucha","descripcion":"Organiza un espacio de escucha con 3 compañeros.","progress":0,"goal":3,"xp":40,"color":"#E2711D","cometa":"halley"},
        {"id":"cm-ikeya","titulo":"Reto Ikeya: proyecto creativo","descripcion":"Comparte un prototipo o boceto original.","progress":0,"goal":1,"xp":45,"color":"#8E3FB8","cometa":"ikeya"},
        {"id":"cm-araya","titulo":"Reto Araya: comparte aprendizaje","descripcion":"Publica un resumen de algo que estudiaste esta semana.","progress":0,"goal":1,"xp":45,"color":"#2C9C6E","cometa":"araya"},
    ]
    for m in cometa_missions: await db.missions.update_one({"id":m["id"]},{"$setOnInsert":{k:v for k,v in m.items() if k!="color"},"$set":{"color":m["color"]}},upsert=True)
    await db.community_messages.update_one({"id":"welcome-gaming"},{"$setOnInsert":{"id":"welcome-gaming","community_id":"com-gaming","author":"Mar Espino","avatar":"https://i.pravatar.cc/80?img=47","contenido":"¡Bienvenidos al club! Comparte qué estás jugando o creando esta semana.","created_at":now()}},upsert=True)
    await db.direct_messages.update_one({"id":"dm-welcome"},{"$setOnInsert":{"id":"dm-welcome","conversation_id":"student-mar-student-ana","author_id":"student-ana","author":"Ana Torres","avatar":"https://i.pravatar.cc/80?img=32","contenido":"¡Hola Mar! Vi que también te interesa el emprendimiento.","created_at":now()}},upsert=True)
    await db.students.update_many({"skills":{"$exists":False}},{"$set":{"skills":["Comunicación","Colaboración"],"needs":["Diseño","Tecnología"],"projects":[]}})
    await db.students.update_many({"cometa":{"$exists":False}},{"$set":{"cometa":"halley"}})
    # Campus Tecmilenio con coordenadas reales (lat, lng); el mapa del frontend los proyecta sobre el vector de México.
    CAMPUSES=[
        ("Aguascalientes","Aguascalientes",False,21.88,-102.29),
        ("Baja California","Tijuana Río",True,32.52,-117.02),
        ("Coahuila","Laguna",False,25.54,-103.41),
        ("Coahuila","Saltillo",True,25.42,-100.99),
        ("Chihuahua","Chihuahua",False,28.63,-106.07),
        ("Chihuahua","Ciudad Juárez",False,31.69,-106.42),
        ("Ciudad de México","Ferrería",False,19.50,-99.18),
        ("Ciudad de México","Mítikah Coyoacán",True,19.36,-99.17),
        ("Ciudad de México","Reforma",True,19.43,-99.17),
        ("Ciudad de México","Santa Fe",True,19.36,-99.26),
        ("Durango","Durango",False,24.02,-104.66),
        ("Estado de México","Cuautitlán Izcalli",False,19.65,-99.21),
        ("Estado de México","Toluca",False,19.29,-99.65),
        ("Estado de México","Las Américas",True,19.60,-99.03),
        ("Estado de México","Satélite",True,19.51,-99.24),
        ("Guanajuato","León",True,21.12,-101.68),
        ("Jalisco","Guadalajara Norte — Zapopan",False,20.72,-103.39),
        ("Jalisco","Guadalajara Sur",False,20.62,-103.38),
        ("Michoacán","Morelia",False,19.70,-101.19),
        ("Morelos","Cuernavaca",False,18.92,-99.23),
        ("Nuevo León","Cumbres",False,25.73,-100.40),
        ("Nuevo León","Las Torres",False,25.62,-100.27),
        ("Nuevo León","Guadalupe",False,25.68,-100.25),
        ("Nuevo León","San Nicolás",False,25.75,-100.29),
        ("Puebla","Puebla",False,19.04,-98.21),
        ("Querétaro","Querétaro",False,20.59,-100.39),
        ("Quintana Roo","Cancún",False,21.16,-86.85),
        ("San Luis Potosí","San Luis Potosí",False,22.15,-100.98),
        ("Sinaloa","Culiacán",False,24.81,-107.39),
        ("Sinaloa","Los Mochis",False,25.79,-108.99),
        ("Sinaloa","Mazatlán",False,23.25,-106.41),
        ("Sonora","Hermosillo",False,29.07,-110.96),
        ("Sonora","Ciudad Obregón",False,27.49,-109.94),
        ("Tabasco","Villahermosa",False,17.99,-92.93),
        ("Tamaulipas","Nuevo Laredo",False,27.48,-99.52),
        ("Tamaulipas","Reynosa",False,26.09,-98.28),
        ("Tamaulipas","Tampico",True,22.23,-97.86),
        ("Veracruz","Veracruz",False,19.17,-96.13),
        ("Yucatán","Mérida",False,20.97,-89.62),
        ("Zacatecas","Zacatecas",False,22.77,-102.58),
    ]
    CAMPUS_PHOTOS={"Aguascalientes": "/campus/aguascalientes.webp", "Cancún": "/campus/cancun.webp", "Chihuahua": "/campus/chihuahua.webp", "Ciudad Juárez": "/campus/ciudad-juarez.webp", "Ciudad Obregón": "/campus/ciudad-obregon.webp", "Cuautitlán Izcalli": "/campus/cuautitlan-izcalli.webp", "Cuernavaca": "/campus/cuernavaca.webp", "Culiacán": "/campus/culiacan.webp", "Cumbres": "/campus/cumbres.webp", "Durango": "/campus/durango.webp", "Ferrería": "/campus/ferreria.webp", "Guadalajara Norte — Zapopan": "/campus/guadalajara-norte-zapopan.webp", "Guadalajara Sur": "/campus/guadalajara-sur.webp", "Guadalupe": "/campus/guadalupe.webp", "Hermosillo": "/campus/hermosillo.webp", "Laguna": "/campus/laguna.webp", "Las Américas": "/campus/las-americas.webp", "Las Torres": "/campus/las-torres.webp", "León": "/campus/leon.webp", "Los Mochis": "/campus/los-mochis.webp", "Mazatlán": "/campus/mazatlan.webp", "Morelia": "/campus/morelia.webp", "Mérida": "/campus/merida.webp", "Mítikah Coyoacán": "/campus/mitikah-coyoacan.webp", "Nuevo Laredo": "/campus/nuevo-laredo.webp", "Puebla": "/campus/puebla.webp", "Querétaro": "/campus/queretaro.webp", "Reforma": "/campus/reforma.webp", "Reynosa": "/campus/reynosa.webp", "Saltillo": "/campus/saltillo.webp", "San Luis Potosí": "/campus/san-luis-potosi.webp", "San Nicolás": "/campus/san-nicolas.webp", "Santa Fe": "/campus/santa-fe.webp", "Satélite": "/campus/satelite.webp", "Tampico": "/campus/tampico.webp", "Tijuana Río": "/campus/tijuana-rio.webp", "Toluca": "/campus/toluca.webp", "Veracruz": "/campus/veracruz.webp", "Villahermosa": "/campus/villahermosa.webp", "Zacatecas": "/campus/zacatecas.webp"}
    meta_key, current_ver = "campuses_v", "v4"
    meta = await db.meta.find_one({"key":meta_key},{"_id":0})
    if not meta or meta.get("value") != current_ver:
        # upsert por nombre para conservar imágenes y campus que los admins agregaron
        for i,(e,n,c,lat,lng) in enumerate(CAMPUSES):
            await db.campuses.update_one({"nombre":n},{"$set":{"estado":e,"is_connect":c,"lat":lat,"lng":lng},"$unset":{"x":"","y":""},"$setOnInsert":{"id":f"camp-v3-{i}","nombre":n,"imagen":""}},upsert=True)
        await db.campuses.delete_many({"lat":{"$exists":False},"nombre":{"$in":["Monterrey","Guadalajara","CDMX","Tijuana"]}})  # semilla vieja sin ubicación
        await db.campuses.delete_many({"nombre":"Artz Pedregal"})  # sin foto oficial: se retiró del mapa
        # Fotos de las instalaciones (frontend/public/campus); no se pisan las que un admin ya cambió
        for n,img in CAMPUS_PHOTOS.items():
            await db.campuses.update_one({"nombre":n,"$or":[{"imagen":""},{"imagen":None},{"imagen":{"$exists":False}}]},{"$set":{"imagen":img}})
        await db.meta.update_one({"key":meta_key},{"$set":{"key":meta_key,"value":current_ver}},upsert=True)
    # Certificados Tecmilenio categorizados
    CERTS=[
        ("Tecnología e ingeniería","Solid Edge","Siemens"),
        ("Tecnología e ingeniería","Supply Chain","LinkedIn Learning"),
        ("Tecnología e ingeniería","LSSGB","SigmaPro"),
        ("Tecnología e ingeniería","Desarrollo con Swift","LinkedIn Learning"),
        ("Tecnología e ingeniería","Plant Simulation","Siemens"),
        ("Tecnología e ingeniería","Cybersecurity","LinkedIn Learning"),
        ("Tecnología e ingeniería","Minitab","LinkedIn Learning"),
        ("Tecnología e ingeniería","Green Belt","SigmaPro"),
        ("Tecnología e ingeniería","Excel","LinkedIn Learning · Empleabilidad Tecmilenio"),
        ("Negocios","Finanzas personales","BBVA"),
        ("Negocios","Social Media Marketing","HubSpot"),
        ("Negocios","Inbound Marketing","HubSpot"),
        ("Negocios","Software de ventas de HubSpot","HubSpot"),
        ("Negocios","Content Marketing","HubSpot"),
        ("Negocios","Inbound Sales","HubSpot"),
        ("Negocios","Digital Marketing","HubSpot"),
        ("Negocios","Competitive Market Analysis","LinkedIn Learning"),
        ("Negocios","Design Thinking","LinkedIn Learning"),
        ("Negocios","Software Marketing","HubSpot"),
        ("Negocios","Corporate Financial Statement Creation","LinkedIn Learning"),
        ("Negocios","Search Google Ads","Google"),
        ("Negocios","Display Google Ads","Google"),
        ("Negocios","Implementing Supply Chain Management","LinkedIn Learning"),
        ("Negocios","Google Analytics Individual Qualification","Google"),
        ("Negocios","Email Marketing","HubSpot"),
        ("Negocios","Digital Advertising","HubSpot"),
        ("Negocios","Job Structure and Design","LinkedIn Learning"),
        ("Negocios","Strategic Human Resources","LinkedIn Learning"),
        ("Negocios","Employee Engagement","LinkedIn Learning"),
        ("Negocios","Corporate Finance Foundations","LinkedIn Learning"),
        ("Negocios","Certification Prep: Professional in Human Resources (PHR)","LinkedIn Learning"),
        ("Negocios","Recruiting Foundations: In-House Recruiters","LinkedIn Learning"),
        ("Negocios","Human Resources: Leadership and Strategic Impact","LinkedIn Learning"),
        ("Industrias creativas","Animate CC para animación","LinkedIn Learning"),
        ("Industrias creativas","Maya Character Rigging","LinkedIn Learning"),
        ("Industrias creativas","Técnicas de representación gráfica","Tecmilenio"),
        ("Industrias creativas","Estrategias de diseño instruccional","Tecnológico de Monterrey"),
        ("Bienestar y salud","Yellow Belt","SigmaPro"),
        ("Bienestar y salud","Maya Render Setup System","LinkedIn Learning"),
        ("Bienestar y salud","Desarrollo de proyecto bajo metodología Scrum","LinkedIn Learning"),
        ("Bienestar y salud","Gestión de entrevista","LinkedIn Learning"),
        ("Bienestar y salud","Tecnología educativa","LinkedIn Learning · Empleabilidad Tecmilenio"),
    ]
    if await db.certificates.count_documents({}) < 20:
        await db.certificates.delete_many({})
        await db.certificates.insert_many([{"id":f"cert-{i}","categoria":cat,"nombre":n,"proveedor":p,"descripcion":f"{cat} · Certificación con {p}."} for i,(cat,n,p) in enumerate(CERTS)])
    # Carreras Tecmilenio
    CARRERAS=[
        ("Negocios y administración","Licenciatura en Administración de Empresas"),
        ("Negocios y administración","Licenciatura en Administración y Finanzas"),
        ("Negocios y administración","Licenciatura en Administración y Desarrollo del Talento"),
        ("Negocios y administración","Licenciatura en Comercio y Negocios Internacionales"),
        ("Negocios y administración","Licenciatura en Comercio Internacional"),
        ("Negocios y administración","Licenciatura en Contabilidad y Estrategia Financiera"),
        ("Negocios y administración","Licenciatura en Creación y Desarrollo de Empresas"),
        ("Negocios y administración","Licenciatura en Mercadotecnia"),
        ("Derecho y ciencias sociales","Licenciatura en Derecho"),
        ("Derecho y ciencias sociales","Licenciatura en Psicología"),
        ("Tecnología e ingeniería","Ingeniería en Desarrollo de Software"),
        ("Tecnología e ingeniería","Ingeniería en Mecatrónica"),
        ("Tecnología e ingeniería","Ingeniería Industrial"),
        ("Tecnología e ingeniería","Ingeniería en Sistemas de Computación Administrativa"),
        ("Tecnología e ingeniería","Ingeniería en Tecnología y Transformación Digital"),
        ("Diseño y creatividad","Licenciatura en Diseño Gráfico y Animación"),
        ("Salud","Licenciatura en Enfermería"),
        ("Salud","Licenciatura en Nutrición"),
        ("Gastronomía y turismo","Licenciatura en Gastronomía Internacional"),
        ("Gastronomía y turismo","Licenciatura en Gastronomía"),
        ("Gastronomía y turismo","Licenciatura en Administración Hotelera y Turística"),
        ("Educación","Licenciatura en Educación"),
    ]
    if await db.careers.count_documents({}) == 0:
        await db.careers.insert_many([{"id":f"car-{i}","categoria":cat,"nombre":n} for i,(cat,n) in enumerate(CARRERAS)])
    await db.feed_posts.update_one({"id":"feed-welcome"},{"$setOnInsert":{"id":"feed-welcome","author":"Comunidad Tecmi","avatar":"https://i.pravatar.cc/80?img=12","contenido":"Bienvenidos a Tecmi Link-Up: comparte una oportunidad, proyecto o logro con tu comunidad.","categoria":"Noticias","reactions":18,"reported":False,"created_at":now()}},upsert=True)
    seed_posts=[
        {"id":"feed-oportunidad","author":"Programa Emprende","avatar":"https://i.pravatar.cc/80?img=64","contenido":"Convocatoria abierta: Reto Emprende Tecmi 2026. Aplica hasta el 30 de febrero y gana mentoría personalizada.","categoria":"Oportunidades","reactions":42,"reported":False,"created_at":now()},
        {"id":"feed-comunidad","author":"Ana Torres","avatar":"https://i.pravatar.cc/80?img=32","contenido":"¿Alguien del certificado de Negocios Internacionales quiere formar equipo para un pitch de sostenibilidad? DM abierto.","categoria":"Comunidad","reactions":14,"reported":False,"created_at":now()},
        {"id":"feed-logro","author":"Diego Ramírez","avatar":"https://i.pravatar.cc/80?img=12","contenido":"Terminé mi primera integración con IA para un club de gaming. Gracias a todo el Cometa Araya por las ideas.","categoria":"Comunidad","reactions":27,"reported":False,"created_at":now()},
        {"id":"feed-evento","author":"Cometa Halley","avatar":"https://i.pravatar.cc/80?img=44","contenido":"Únete al meetup nacional de comunidades este viernes. 4 campus conectados en vivo.","categoria":"Noticias","reactions":33,"reported":False,"created_at":now()},
    ]
    for p in seed_posts: await db.feed_posts.update_one({"id":p["id"]},{"$setOnInsert":p},upsert=True)
    seed_cometa_msgs=[
        ("brela","cm-brela-1","Diego Ramírez","https://i.pravatar.cc/80?img=12","¡Vamos con todo con el reto de campus abierto este viernes!"),
        ("brela","cm-brela-2","Mar Espino","https://i.pravatar.cc/80?img=47","Cuenten conmigo. ¿A qué hora nos vemos?"),
        ("halley","cm-halley-1","Ana Torres","https://i.pravatar.cc/80?img=32","Organicemos un círculo de escucha entre certificados. ¿Quién se apunta?"),
        ("ikeya","cm-ikeya-1","Sofía López","https://i.pravatar.cc/80?img=44","Tengo una idea para un mural digital colaborativo, comparto brief mañana."),
        ("araya","cm-araya-1","Diego Ramírez","https://i.pravatar.cc/80?img=12","Comparto artículo sobre IA aplicada a educación. Comentarios bienvenidos."),
    ]
    for cid,mid,author,avatar,contenido in seed_cometa_msgs:
        await db.cometa_messages.update_one({"id":mid},{"$setOnInsert":{"id":mid,"cometa_id":cid,"author":author,"avatar":avatar,"contenido":contenido,"created_at":now()}},upsert=True)
    seed_notifs=[
        {"id":"notif-1","user_id":"student-mar","tipo":"conexion","titulo":"Ana Torres aceptó tu solicitud","subtitulo":"Ahora pueden conversar por mensajes directos","avatar":"https://i.pravatar.cc/80?img=32","leida":False,"created_at":now()},
        {"id":"notif-2","user_id":"student-mar","tipo":"comentario","titulo":"Diego comentó tu publicación","subtitulo":"«Me interesa mucho, cuéntame más»","avatar":"https://i.pravatar.cc/80?img=12","leida":False,"created_at":now()},
        {"id":"notif-3","user_id":"student-mar","tipo":"cometa","titulo":"Sofía se unió al Cometa Ikeya","subtitulo":"Descubre lo que están creando esta semana","avatar":"https://i.pravatar.cc/80?img=44","leida":True,"created_at":now()},
    ]
    for n in seed_notifs: await db.notifications.update_one({"id":n["id"]},{"$setOnInsert":n},upsert=True)
    # --- Migraciones del revamp (idempotentes) ---
    # Misiones que se completan solas al hacer la acción real
    await db.missions.update_many({"id":{"$in":["mission-1","mission-2","mission-4","mission-5","mission-6"]}},{"$set":{"auto":True}})
    # Cuentas creadas antes de las contraseñas reciben la contraseña temporal (con hash) y se les pide cambiarla
    if await db.students.count_documents({"password_hash":{"$exists":False}}):
        await db.students.update_many({"password_hash":{"$exists":False}},{"$set":{"password_hash":hash_password(DEFAULT_PASSWORD),"must_change_password":True}})
    # Mensajes directos viejos: el id de conversación era "emisor-receptor"; ahora es el mismo para ambos
    async for m in db.direct_messages.find({"to_id":{"$exists":False}},{"_id":0}):
        cid, author = m.get("conversation_id",""), m.get("author_id","")
        if cid.startswith(author+"-"):
            other = cid[len(author)+1:]
            await db.direct_messages.update_one({"id":m["id"]},{"$set":{"to_id":other,"conversation_id":conv_id(author,other)}})
    await db.students.update_many({"created_at":{"$exists":False}},{"$set":{"created_at":"2026-09-01T00:00:00+00:00"}})

def affinity(me, other):
    def s(x): return set(x or [])
    mi=s(me.get("intereses"))|s(me.get("skills"))|s(me.get("needs"))
    ot=s(other.get("intereses"))|s(other.get("skills"))|s(other.get("needs"))
    if not mi or not ot: return 40
    base=int(round(len(mi&ot)/max(1,len(mi|ot))*100))
    # boost cruzado: mis skills ∩ tus needs y viceversa
    cross=len((s(me.get("skills"))&s(other.get("needs")))|(s(me.get("needs"))&s(other.get("skills"))))
    same_certificado=15 if me.get("certificado") and me.get("certificado")==other.get("certificado") else 0
    return min(99, max(40, base + cross*7 + same_certificado))

async def my_connections(user_id):
    """Conexiones donde participo, en ambas direcciones, con datos de la otra persona."""
    rows=await db.connections.find({"$or":[{"from_id":user_id},{"to_id":user_id}]},{"_id":0}).sort("created_at",-1).to_list(1000)
    ids=list({r["to_id"] if r["from_id"]==user_id else r["from_id"] for r in rows})
    people={p["id"]:p for p in await db.students.find({"id":{"$in":ids}},{"_id":0,"id":1,"nombre":1,"apellido":1,"avatar":1,"campus":1,"carrera":1,"rol":1}).to_list(1000)}
    out=[]
    for r in rows:
        sent=r["from_id"]==user_id
        other=people.get(r["to_id"] if sent else r["from_id"])
        if not other: continue
        out.append({"id":r["id"],"estado":r.get("estado","pendiente"),"direction":"sent" if sent else "received","created_at":r.get("created_at"),"other":other})
    return out

def status_map(conns):
    m={}
    for c in conns:
        st="connected" if c["estado"]=="aceptada" else ("sent" if c["direction"]=="sent" else "received") if c["estado"]=="pendiente" else "none"
        m[c["other"]["id"]]={"connection_status":st,"connection_id":c["id"]}
    return m

async def enrich_matches(others, me, conns):
    sm=status_map(conns)
    result=[]
    for s in others:
        c=clean(s)
        c["match_score"]=affinity(me,s)
        c["shared_interests"]=sorted(set(me.get("intereses") or [])&set(s.get("intereses") or []))
        c["shared_skills"]=sorted(set(me.get("skills") or [])&set(s.get("skills") or []))
        c.update(sm.get(s["id"],{"connection_status":"none","connection_id":None}))
        result.append(c)
    result.sort(key=lambda x:x["match_score"],reverse=True)
    return result

async def award(user_id, mission_id, inc=1, force=False):
    """Suma progreso a una misión del usuario y entrega XP una sola vez al llegar a la meta."""
    mission=await db.missions.find_one({"id":mission_id},{"_id":0})
    if not mission: return None
    goal=mission.get("goal",1)
    row=await db.mission_progress.find_one({"user_id":user_id,"mission_id":mission_id},{"_id":0}) or {"progress":0}
    if row.get("completed"): return {"completed":True,"already_completed":True,"xp":0}
    progress=goal if force else min(goal,row["progress"]+inc)
    done=progress>=goal
    await db.mission_progress.update_one({"user_id":user_id,"mission_id":mission_id},{"$set":{"progress":progress,"completed":done,"updated_at":now()}},upsert=True)
    if done:
        me=await db.students.find_one({"id":user_id},{"_id":0,"xp":1}) or {}
        xp=me.get("xp",0)+mission["xp"]
        await db.students.update_one({"id":user_id},{"$set":{"xp":xp,"nivel":level_for(xp)}})
        await notify(user_id,"mision",f"Completaste «{mission['titulo']}»",f"+{mission['xp']} XP para ti y tu Cometa")
    return {"completed":done,"already_completed":False,"xp":mission["xp"] if done else 0,"progress":progress}

async def unread_messages(user_id):
    reads={r["conv_id"]:r["at"] for r in await db.conv_reads.find({"user_id":user_id},{"_id":0}).to_list(1000)}
    convs=await db.direct_messages.distinct("conversation_id",{"to_id":user_id})
    out={}
    for cid in convs:
        q={"conversation_id":cid,"to_id":user_id}
        if cid in reads: q["created_at"]={"$gt":reads[cid]}
        n=await db.direct_messages.count_documents(q)
        if n: out[cid]=n
    return out

@app.on_event("startup")
async def startup():
    await seed()
    await ensure_extensions()

@api.get("/bootstrap")
async def bootstrap(user_id: str = Depends(current_user)):
    me = await get_me(user_id)
    is_admin = me.get("rol")=="administrador"
    conns = await my_connections(user_id)
    others = await db.students.find({"id":{"$ne":user_id},"rol":{"$ne":"administrador"}},{"_id":0}).to_list(500)
    students = await enrich_matches(others, me, conns)
    me["connections"]=sum(1 for c in conns if c["estado"]=="aceptada")
    memberships={m["community_id"] for m in await db.memberships.find({"user_id":user_id},{"_id":0}).to_list(500)}
    registrations={r["event_id"] for r in await db.registrations.find({"user_id":user_id},{"_id":0}).to_list(500)}
    me["communities"]=len(memberships); me["events"]=len(registrations); me["nivel"]=level_for(me.get("xp",0))
    progress={p["mission_id"]:p for p in await db.mission_progress.find({"user_id":user_id},{"_id":0}).to_list(500)}
    missions=[]
    for m in await db.missions.find({}, {"_id":0}).to_list(200):
        if not is_admin and m.get("cometa") and m["cometa"]!=me.get("cometa"): continue
        p=progress.get(m["id"],{})
        missions.append({**m,"progress":m.get("goal",1) if p.get("completed") else p.get("progress",0)})
    communities=[{**c,"joined":c["id"] in memberships} for c in await db.communities.find({}, {"_id":0}).to_list(200)]
    events=[{**e,"registered":e["id"] in registrations} for e in await db.events.find({}, {"_id":0}).sort("fecha_inicio",1).to_list(200)]
    cometas=[clean(x) for x in await db.cometas.find({}, {"_id":0}).to_list(10)]
    for c in cometas: c["miembros"]=await db.students.count_documents({"cometa":c["id"],"rol":{"$ne":"administrador"}})
    reacted={r["post_id"] for r in await db.reactions.find({"user_id":user_id},{"_id":0}).to_list(2000)}
    counts={x["_id"]:x["n"] for x in await db.comments.aggregate([{"$group":{"_id":"$post_id","n":{"$sum":1}}}]).to_list(2000)}
    feed=[{**p,"my_reaction":p["id"] in reacted,"comments_count":counts.get(p["id"],0)} for p in await db.feed_posts.find({"hidden":{"$ne":True}}, {"_id":0}).sort("created_at",-1).to_list(100)]
    notifs_items=await db.notifications.find({"user_id":user_id},{"_id":0}).sort("created_at",-1).to_list(50)
    insignias=[{"cometa":me.get("cometa"),"nombre":n,"xp_req":x} for x,n in [(100,"Aspirante"),(300,"Guardián"),(600,"Estrella")] if me.get("cometa") and me.get("xp",0)>=x]
    staff=[clean(s) for s in await db.students.find({"rol":"administrador","id":{"$ne":user_id}},{"_id":0,"password_hash":0}).to_list(200)] if is_admin else []
    return {"student":clean(me),"students":students,"daily_matches":[s for s in students if s["connection_status"]=="none"][:3],
            "connections":conns,"staff":staff,
            "notifications":{"items":notifs_items,"unread":sum(1 for n in notifs_items if not n.get("leida"))},
            "cometas_ranking":await cometas_ranking(),"insignias":insignias,"communities":communities,"events":events,"missions":missions,
            "campuses":[clean(x) for x in await db.campuses.find({}, {"_id":0}).to_list(200)],
            "certificates":[clean(x) for x in await db.certificates.find({}, {"_id":0}).to_list(200)],
            "interests":[clean(x) for x in await db.interests.find({}, {"_id":0}).to_list(200)],
            "cometas":cometas,"careers":[clean(x) for x in await db.careers.find({}, {"_id":0}).to_list(100)],"feed":feed}

@api.get("/pulse")
async def pulse(user_id: str = Depends(current_user)):
    """Lo que el frontend consulta cada pocos segundos: notificaciones, mensajes sin leer e invitaciones."""
    items=await db.notifications.find({"user_id":user_id},{"_id":0}).sort("created_at",-1).to_list(50)
    unread=await unread_messages(user_id)
    return {"notifications":{"items":items,"unread":sum(1 for n in items if not n.get("leida"))},
            "unread_messages":sum(unread.values()),"unread_by_conversation":unread,
            "pending_invitations":await db.connections.count_documents({"to_id":user_id,"estado":"pendiente"})}

# ---------- Autenticación ----------
async def open_session(user):
    token=secrets.token_urlsafe(32)
    await db.sessions.insert_one({"token":token,"user_id":user["id"],"created_at":now()})
    return {"user":clean(user),"token":token}

def valid_email(email):
    email=email.strip().lower()
    if not re.fullmatch(r"[a-z0-9._%+-]+@tecmilenio\.mx", email): raise HTTPException(400,"Usa tu correo @tecmilenio.mx")
    return email

@api.post("/auth/signup")
async def auth_signup(data: SignupIn):
    email=valid_email(data.email)
    if not data.nombre.strip() or not data.apellido.strip(): raise HTTPException(400,"Escribe tu nombre y apellido")
    problem=password_problem(data.password)
    if problem: raise HTTPException(400,problem)
    if await db.students.find_one({"email":email},{"_id":0,"id":1}):
        raise HTTPException(409,"Ya existe una cuenta con ese correo. Inicia sesión.")
    campus=(data.campus or "").strip()
    if campus and not await db.campuses.find_one({"nombre":campus},{"_id":0,"id":1}): raise HTTPException(400,"Elige un campus de la lista")
    rol = "estudiante" if email.split("@")[0].upper().startswith("AL0") else "administrador"
    doc={"id":f"user-{uuid.uuid4().hex[:12]}","nombre":data.nombre.strip(),"apellido":data.apellido.strip(),"email":email,"rol":rol,"campus":campus,"certificado":"","intereses":[],"skills":["Comunicación","Colaboración"],"needs":["Diseño","Tecnología"],"cometa":"halley","nivel":1,"xp":0,"active":True,"avatar":f"https://i.pravatar.cc/160?u={uuid.uuid4()}","semestre":"1er semestre","descripcion":"","certificados_cursados":[],"password_hash":hash_password(data.password),"must_change_password":False,"created_at":now()}
    await db.students.insert_one(doc)
    out=await open_session(doc)
    return {**out,"created":True}

@api.post("/auth/login")
async def auth_login(data: LoginIn):
    email=valid_email(data.email)
    user = await db.students.find_one({"email":email},{"_id":0})
    if not user or not check_password(data.password, user.get("password_hash")): raise HTTPException(401,"Correo o contraseña incorrectos")
    if user.get("active") is False: raise HTTPException(403,"Tu cuenta está desactivada. Contacta a tu campus.")
    return await open_session(user)

@api.get("/campuses")
async def public_campuses():
    """Lista pública para el formulario de registro."""
    return await db.campuses.find({},{"_id":0,"id":1,"nombre":1,"estado":1}).sort("nombre",1).to_list(300)

@api.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.startswith("Bearer "): await db.sessions.delete_one({"token":authorization[7:]})
    return {"ok":True}

@api.post("/auth/password")
async def change_password(data: PasswordChange, user_id: str = Depends(current_user)):
    me=await get_me(user_id)
    if not check_password(data.actual, me.get("password_hash")): raise HTTPException(400,"Tu contraseña actual no coincide")
    problem=password_problem(data.nueva)
    if problem: raise HTTPException(400,problem)
    await db.students.update_one({"id":user_id},{"$set":{"password_hash":hash_password(data.nueva),"must_change_password":False}})
    return {"ok":True}

# ---------- Perfil ----------
@api.post("/me/tour-done")
async def tour_done(user_id: str = Depends(current_user)):
    # el recorrido de bienvenida solo se muestra una vez por cuenta (sin el campo = pendiente)
    await db.students.update_one({"id":user_id},{"$set":{"tour_done":True}})
    return {"ok":True}

@api.put("/students/{student_id}")
async def update_student(student_id: str, data: ProfileUpdate, user_id: str = Depends(current_user)):
    if student_id != user_id: raise HTTPException(403,"Solo puedes editar tu propio perfil")
    changes={k:v for k,v in data.model_dump().items() if v is not None}
    if "nombre" in changes and not changes["nombre"].strip(): changes.pop("nombre")
    if "apellido" in changes and not changes["apellido"].strip(): changes.pop("apellido")
    await db.students.update_one({"id":student_id},{"$set":changes})
    me=await get_me(student_id)
    if (me.get("descripcion") or "").strip() and len(me.get("intereses") or [])>=3: await award(student_id,"mission-5")
    return clean(me)

# ---------- Invitaciones y conexiones ----------
@api.post("/connections/{student_id}")
async def connect(student_id: str, user_id: str = Depends(current_user)):
    if student_id==user_id: raise HTTPException(400,"No puedes conectar contigo")
    target=await db.students.find_one({"id":student_id},{"_id":0})
    if not target: raise HTTPException(404,"Estudiante no encontrado")
    existing=await db.connections.find_one({"$or":[{"from_id":user_id,"to_id":student_id},{"from_id":student_id,"to_id":user_id}]},{"_id":0})
    if existing and existing.get("estado")=="aceptada": return {"ok":True,"already":True,"status":"aceptada"}
    if existing and existing.get("estado")=="pendiente":
        if existing["to_id"]==user_id:  # la otra persona ya me había invitado: aceptar
            return await accept_connection(existing["id"], user_id)
        return {"ok":True,"already":True,"status":"pendiente"}
    me=await get_me(user_id)
    if existing:  # rechazada antes: se puede volver a invitar
        await db.connections.update_one({"id":existing["id"]},{"$set":{"from_id":user_id,"to_id":student_id,"estado":"pendiente","created_at":now()}})
        cid=existing["id"]
    else:
        cid=str(uuid.uuid4())
        await db.connections.insert_one({"id":cid,"from_id":user_id,"to_id":student_id,"estado":"pendiente","created_at":now()})
    await notify(student_id,"invitacion",f"{full_name(me)} quiere conectar contigo","Revisa tus invitaciones para aceptar o rechazar",me.get("avatar"),"Invitaciones")
    await award(user_id,"mission-6")
    return {"ok":True,"already":False,"status":"pendiente","id":cid,"message":"Invitación enviada"}

@api.post("/match/{student_id}/connect")
async def match_connect(student_id: str, user_id: str = Depends(current_user)):
    return await connect(student_id, user_id)

@api.get("/connections")
async def list_connections(user_id: str = Depends(current_user)):
    return await my_connections(user_id)

async def respond(conn_id, user_id, estado):
    conn=await db.connections.find_one({"id":conn_id},{"_id":0})
    if not conn: raise HTTPException(404,"Invitación no encontrada")
    if conn["to_id"]!=user_id: raise HTTPException(403,"Solo quien recibe la invitación puede responderla")
    if conn.get("estado")!="pendiente": return conn
    await db.connections.update_one({"id":conn_id},{"$set":{"estado":estado,"responded_at":now()}})
    return {**conn,"estado":estado}

@api.post("/connections/{conn_id}/accept")
async def accept_connection(conn_id: str, user_id: str = Depends(current_user)):
    conn=await respond(conn_id,user_id,"aceptada")
    me=await get_me(user_id); other=await get_me(conn["from_id"])
    await notify(other["id"],"conexion",f"{full_name(me)} aceptó tu invitación","Ya pueden conversar por mensajes directos",me.get("avatar"),"Mensajes")
    for a,b in ((me,other),(other,me)):
        if a.get("campus") and b.get("campus") and a["campus"]!=b["campus"]: await award(a["id"],"mission-1")
        ka,kb=a.get("carrera") or a.get("certificado"),b.get("carrera") or b.get("certificado")
        if ka and kb and ka!=kb: await award(a["id"],"mission-2")
    return {"ok":True,"estado":"aceptada"}

@api.post("/connections/{conn_id}/reject")
async def reject_connection(conn_id: str, user_id: str = Depends(current_user)):
    await respond(conn_id,user_id,"rechazada")
    return {"ok":True,"estado":"rechazada"}

@api.delete("/connections/{conn_id}")
async def cancel_connection(conn_id: str, user_id: str = Depends(current_user)):
    """Cancela una invitación que envié y sigue pendiente."""
    r=await db.connections.delete_one({"id":conn_id,"from_id":user_id,"estado":"pendiente"})
    if not r.deleted_count: raise HTTPException(404,"No hay una invitación pendiente que cancelar")
    return {"ok":True}

# ---------- Mensajes directos ----------
async def can_message(me, other_id):
    other=await db.students.find_one({"id":other_id},{"_id":0})
    if not other: raise HTTPException(404,"Persona no encontrada")
    if me.get("rol")=="administrador" and other.get("rol")=="administrador": return other
    ok=await db.connections.find_one({"estado":"aceptada","$or":[{"from_id":me["id"],"to_id":other_id},{"from_id":other_id,"to_id":me["id"]}]},{"_id":0,"id":1})
    if not ok: raise HTTPException(403,"Conecta primero: el chat se abre cuando aceptan tu invitación")
    return other

@api.get("/connections/{student_id}/messages")
async def direct_messages(student_id: str, user_id: str = Depends(current_user)):
    me=await get_me(user_id); await can_message(me, student_id)
    cid=conv_id(user_id,student_id)
    await db.conv_reads.update_one({"user_id":user_id,"conv_id":cid},{"$set":{"at":now()}},upsert=True)
    return [clean(x) for x in await db.direct_messages.find({"conversation_id":cid},{"_id":0}).sort("created_at",1).to_list(500)]

@api.post("/connections/{student_id}/messages")
async def create_direct_message(student_id: str, data: MessageCreate, user_id: str = Depends(current_user)):
    me=await get_me(user_id); await can_message(me, student_id)
    item={"id":str(uuid.uuid4()),"conversation_id":conv_id(user_id,student_id),"author_id":user_id,"to_id":student_id,"author":full_name(me),"avatar":me.get("avatar"),"contenido":data.contenido.strip(),"created_at":now()}
    await db.direct_messages.insert_one(item)
    await db.conv_reads.update_one({"user_id":user_id,"conv_id":item["conversation_id"]},{"$set":{"at":item["created_at"]}},upsert=True)
    return clean(item)

@api.get("/conversations")
async def conversations(user_id: str = Depends(current_user)):
    """Bandeja de mensajes: conexiones aceptadas (y otros docentes si soy docente) con su último mensaje."""
    me=await get_me(user_id)
    people=[c["other"] for c in await my_connections(user_id) if c["estado"]=="aceptada"]
    if me.get("rol")=="administrador":
        seen={p["id"] for p in people}
        people+= [s for s in await db.students.find({"rol":"administrador","id":{"$ne":user_id}},{"_id":0,"id":1,"nombre":1,"apellido":1,"avatar":1,"campus":1,"rol":1,"tipo_admin":1}).to_list(200) if s["id"] not in seen]
    unread=await unread_messages(user_id)
    out=[]
    for p in people:
        cid=conv_id(user_id,p["id"])
        last=await db.direct_messages.find({"conversation_id":cid},{"_id":0}).sort("created_at",-1).to_list(1)
        out.append({"person":p,"last":last[0] if last else None,"unread":unread.get(cid,0)})
    out.sort(key=lambda x:(x["last"] or {}).get("created_at",""),reverse=True)
    return out

# ---------- Sala de docentes ----------
@api.get("/staff/messages")
async def staff_messages(user_id: str = Depends(current_admin)):
    return await db.staff_messages.find({},{"_id":0}).sort("created_at",1).to_list(300)

@api.post("/staff/messages")
async def create_staff_message(data: MessageCreate, user_id: str = Depends(current_admin)):
    me=await get_me(user_id)
    item={"id":str(uuid.uuid4()),"author_id":user_id,"author":full_name(me),"avatar":me.get("avatar"),"tipo_admin":me.get("tipo_admin"),"contenido":data.contenido.strip(),"created_at":now()}
    await db.staff_messages.insert_one(item)
    return clean(item)

# ---------- Notificaciones ----------
@api.get("/notifications")
async def list_notifications(user_id: str = Depends(current_user)):
    items=await db.notifications.find({"user_id":user_id},{"_id":0}).sort("created_at",-1).to_list(100)
    return {"items":items,"unread":sum(1 for n in items if not n.get("leida"))}

@api.post("/notifications/read-all")
async def mark_all_read(user_id: str = Depends(current_user)):
    await db.notifications.update_many({"user_id":user_id,"leida":False},{"$set":{"leida":True}})
    return {"ok":True}

@api.post("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, user_id: str = Depends(current_user)):
    result=await db.notifications.update_one({"id":notif_id,"user_id":user_id},{"$set":{"leida":True}})
    if result.matched_count==0: raise HTTPException(404,"Notificación no encontrada")
    return {"ok":True}

# ---------- Cometas ----------
@api.get("/cometas/ranking")
async def cometas_ranking():
    rows=[]
    for c in await db.cometas.find({},{"_id":0}).to_list(10):
        pipe=[{"$match":{"cometa":c["id"],"rol":{"$ne":"administrador"}}},{"$group":{"_id":None,"total":{"$sum":"$xp"},"members":{"$sum":1}}}]
        agg=await db.students.aggregate(pipe).to_list(1)
        rows.append({"id":c["id"],"nombre":c["nombre"],"color":c["color"],"gradient":c["gradient"],"total_xp":agg[0]["total"] if agg else 0,"members":agg[0]["members"] if agg else 0})
    max_xp=max((r["total_xp"] for r in rows),default=1) or 1
    for r in rows: r["percent"]=int(round(r["total_xp"]/max_xp*100))
    rows.sort(key=lambda x:x["total_xp"],reverse=True)
    return rows

@api.get("/cometas")
async def list_cometas():
    return [clean(x) for x in await db.cometas.find({}, {"_id":0}).to_list(10)]

@api.get("/cometas/{cometa_id}/messages")
async def cometa_messages(cometa_id: str, user_id: str = Depends(current_user)):
    return [clean(x) for x in await db.cometa_messages.find({"cometa_id":cometa_id},{"_id":0}).sort("created_at",1).to_list(200)]

@api.post("/cometas/{cometa_id}/messages")
async def create_cometa_message(cometa_id: str, data: MessageCreate, user_id: str = Depends(current_user)):
    cometa=await db.cometas.find_one({"id":cometa_id},{"_id":0})
    if not cometa: raise HTTPException(404,"Cometa no encontrado")
    me=await get_me(user_id)
    if me.get("rol")!="administrador" and me.get("cometa")!=cometa_id: raise HTTPException(403,"Solo los miembros de este Cometa pueden escribir aquí")
    item={"id":str(uuid.uuid4()),"cometa_id":cometa_id,"author_id":user_id,"author":full_name(me),"avatar":me.get("avatar"),"contenido":data.contenido.strip(),"created_at":now()}
    await db.cometa_messages.insert_one(item)
    return clean(item)

@api.get("/cometas/{cometa_id}/members")
async def cometa_members(cometa_id: str, campus: Optional[str] = None, skill: Optional[str] = None, user_id: str = Depends(current_user)):
    q={"cometa":cometa_id,"rol":{"$ne":"administrador"}}
    if campus and campus != "Todos": q["campus"]=campus
    if skill and skill != "Todos": q["skills"]={"$in":[skill]}
    return [clean(m) for m in await db.students.find(q,{"_id":0}).to_list(300)]

@api.get("/cometa-quiz")
async def get_quiz():
    return QUIZ

@api.post("/cometa-quiz/submit")
async def submit_quiz(data: QuizSubmit, user_id: str = Depends(current_user)):
    if len(data.answers)!=len(QUIZ): raise HTTPException(400,"Responde todas las preguntas")
    counts={"brela":0,"halley":0,"ikeya":0,"araya":0}
    for a in data.answers:
        if a in counts: counts[a]+=1
    top=max(counts, key=counts.get)
    await db.students.update_one({"id":user_id},{"$set":{"cometa":top,"quiz_done":True}})
    return {"cometa":top,"detalle":clean(await db.cometas.find_one({"id":top},{"_id":0})),"scores":counts}

# ---------- Match ----------
@api.get("/match")
async def get_matches(user_id: str = Depends(current_user)):
    me=await get_me(user_id)
    others=await db.students.find({"id":{"$ne":user_id},"rol":{"$ne":"administrador"}},{"_id":0}).to_list(500)
    return await enrich_matches(others, me, await my_connections(user_id))

@api.get("/match/daily")
async def get_daily_matches(user_id: str = Depends(current_user)):
    return [m for m in await get_matches(user_id) if m["connection_status"]=="none"][:3]

# ---------- Feed ----------
@api.get("/feed")
async def list_feed(categoria: Optional[str] = None):
    q={"hidden":{"$ne":True}}
    if categoria and categoria!="Todos": q["categoria"]=categoria
    return [clean(x) for x in await db.feed_posts.find(q,{"_id":0}).sort("created_at",-1).to_list(100)]

@api.post("/feed")
async def create_post(data: PostCreate, user_id: str = Depends(current_user)):
    me=await get_me(user_id)
    item={"id":str(uuid.uuid4()),"author":full_name(me),"author_id":user_id,"avatar":me.get("avatar"),"contenido":data.contenido.strip(),"categoria":data.categoria,"reactions":0,"reported":False,"created_at":now()}
    await db.feed_posts.insert_one(item)
    return {**clean(item),"my_reaction":False,"comments_count":0}

@api.post("/feed/{post_id}/react")
async def react_post(post_id: str, user_id: str = Depends(current_user)):
    """Alterna mi reacción: una por persona."""
    if not await db.feed_posts.find_one({"id":post_id},{"_id":0,"id":1}): raise HTTPException(404,"Publicación no encontrada")
    removed=await db.reactions.delete_one({"post_id":post_id,"user_id":user_id})
    if removed.deleted_count: await db.feed_posts.update_one({"id":post_id},{"$inc":{"reactions":-1}})
    else:
        await db.reactions.insert_one({"post_id":post_id,"user_id":user_id,"created_at":now()})
        await db.feed_posts.update_one({"id":post_id},{"$inc":{"reactions":1}})
    post=clean(await db.feed_posts.find_one({"id":post_id},{"_id":0}))
    return {**post,"my_reaction":not removed.deleted_count}

@api.post("/feed/{post_id}/report")
async def report_post(post_id: str, data: ReportCreate, user_id: str = Depends(current_user)):
    if not await db.feed_posts.find_one({"id":post_id},{"_id":0,"id":1}): raise HTTPException(404,"Publicación no encontrada")
    await db.reports.insert_one({"id":str(uuid.uuid4()),"post_id":post_id,"reporter_id":user_id,"motivo":data.motivo,"detalle":data.detalle,"estado":"pendiente","created_at":now()})
    await db.feed_posts.update_one({"id":post_id},{"$set":{"reported":True}})
    return {"ok":True,"status":"pendiente"}

@api.post("/feed/{post_id}/comment")
async def comment_post(post_id: str, data: CommentCreate, user_id: str = Depends(current_user)):
    post=await db.feed_posts.find_one({"id":post_id},{"_id":0})
    if not post: raise HTTPException(404,"Publicación no encontrada")
    me=await get_me(user_id)
    item={"id":str(uuid.uuid4()),"post_id":post_id,"author_id":user_id,"author":full_name(me),"avatar":me.get("avatar"),"contenido":data.contenido.strip(),"created_at":now()}
    await db.comments.insert_one(item)
    target=post.get("author_id")
    if not target:  # posts semilla sin author_id: resolver por nombre
        doc=await db.students.find_one({"$expr":{"$eq":[{"$concat":["$nombre"," ",{"$ifNull":["$apellido",""]}]}, post.get("author","")]}}, {"_id":0,"id":1})
        target=doc["id"] if doc else None
    if target and target!=user_id:
        await notify(target,"comentario",f"{full_name(me)} comentó tu publicación",item["contenido"],me.get("avatar"),"Feed")
    return clean(item)

@api.get("/feed/{post_id}/comments")
async def list_comments(post_id: str):
    return [clean(x) for x in await db.comments.find({"post_id":post_id},{"_id":0}).sort("created_at",1).to_list(200)]

# ---------- Comunidades ----------
@api.post("/communities")
async def create_community(data: CommunityCreate, user_id: str = Depends(current_user)):
    palette=["#00534C","#7069db","#e45e98","#e39a35","#3aa878","#38a8d1"]
    item={"id":str(uuid.uuid4()),"nombre":data.nombre.strip(),"categoria":data.categoria,"descripcion":data.descripcion.strip(),"members":1,"campuses":1,"color":secrets.choice(palette),"owner_id":user_id,"created_at":now()}
    await db.communities.insert_one(item)
    await db.memberships.insert_one({"user_id":user_id,"community_id":item["id"],"created_at":now()})
    return {**clean(item),"joined":True}

async def set_membership(community_id, user_id, join):
    if not await db.communities.find_one({"id":community_id},{"_id":0,"id":1}): raise HTTPException(404,"Comunidad no encontrada")
    exists=await db.memberships.find_one({"user_id":user_id,"community_id":community_id},{"_id":0})
    if join and not exists:
        await db.memberships.insert_one({"user_id":user_id,"community_id":community_id,"created_at":now()})
        await db.communities.update_one({"id":community_id},{"$inc":{"members":1}})
    if not join and exists:
        await db.memberships.delete_one({"user_id":user_id,"community_id":community_id})
        await db.communities.update_one({"id":community_id,"members":{"$gt":0}},{"$inc":{"members":-1}})
    return {**clean(await db.communities.find_one({"id":community_id},{"_id":0})),"joined":join}

@api.post("/communities/{community_id}/join")
async def join_community(community_id: str, user_id: str = Depends(current_user)):
    return await set_membership(community_id,user_id,True)

@api.post("/communities/{community_id}/leave")
async def leave_community(community_id: str, user_id: str = Depends(current_user)):
    return await set_membership(community_id,user_id,False)

@api.get("/communities/{community_id}/members")
async def community_members(community_id: str, user_id: str = Depends(current_user)):
    ids=[m["user_id"] for m in await db.memberships.find({"community_id":community_id},{"_id":0}).to_list(1000)]
    return [clean(s) for s in await db.students.find({"id":{"$in":ids}},{"_id":0,"password_hash":0}).to_list(1000)]

@api.get("/communities/{community_id}/messages")
async def community_messages(community_id: str, user_id: str = Depends(current_user)):
    return [clean(x) for x in await db.community_messages.find({"community_id":community_id},{"_id":0}).sort("created_at",1).to_list(200)]

@api.post("/communities/{community_id}/messages")
async def create_community_message(community_id: str, data: MessageCreate, user_id: str = Depends(current_user)):
    me=await get_me(user_id)
    member=await db.memberships.find_one({"user_id":user_id,"community_id":community_id},{"_id":0})
    if not member and me.get("rol")!="administrador": raise HTTPException(403,"Únete a la comunidad para escribir")
    item={"id":str(uuid.uuid4()),"community_id":community_id,"author_id":user_id,"author":full_name(me),"avatar":me.get("avatar"),"contenido":data.contenido.strip(),"created_at":now()}
    await db.community_messages.insert_one(item)
    if member: await award(user_id,"mission-4")
    return clean(item)

# ---------- Eventos y misiones ----------
@api.post("/events/{event_id}/register")
async def register_event(event_id: str, user_id: str = Depends(current_user)):
    if not await db.events.find_one({"id":event_id},{"_id":0,"id":1}): raise HTTPException(404,"Evento no encontrado")
    removed=await db.registrations.delete_one({"user_id":user_id,"event_id":event_id})
    if removed.deleted_count:
        await db.events.update_one({"id":event_id,"attendees":{"$gt":0}},{"$inc":{"attendees":-1}})
        return {"registered":False}
    await db.registrations.insert_one({"user_id":user_id,"event_id":event_id,"created_at":now()})
    await db.events.update_one({"id":event_id},{"$inc":{"attendees":1}})
    return {"registered":True}

@api.post("/missions/{mission_id}/complete")
async def complete_mission(mission_id: str, user_id: str = Depends(current_user)):
    mission=await db.missions.find_one({"id":mission_id},{"_id":0})
    if not mission: raise HTTPException(404,"Misión no encontrada")
    if mission.get("auto"): raise HTTPException(400,"Esta misión se completa sola cuando haces la acción")
    return {"ok":True,**await award(user_id,mission_id,force=True)}

# ---------- Administración (docentes y administradores) ----------
@api.get("/admin/metrics")
async def metrics(user_id: str = Depends(current_admin)):
    return {"usuarios_activos":await db.students.count_documents({"active":True,"rol":{"$ne":"administrador"}}),
            "campus_conectados":await db.campuses.count_documents({}),
            "espacios_connect":await db.campuses.count_documents({"is_connect":True}),
            "certificados_activos":await db.certificates.count_documents({}),
            "conexiones_realizadas":await db.connections.count_documents({"estado":"aceptada"}),
            "retos_completados":await db.mission_progress.count_documents({"completed":True}),
            "comunidades":await db.communities.count_documents({}),"eventos":await db.events.count_documents({}),
            "publicaciones":await db.feed_posts.count_documents({}),"reportes_pendientes":await db.reports.count_documents({"estado":"pendiente"})}

@api.get("/admin/overview")
async def admin_overview(user_id: str = Depends(current_admin)):
    students=await db.students.find({"rol":{"$ne":"administrador"}},{"_id":0,"id":1,"nombre":1,"apellido":1,"avatar":1,"campus":1,"carrera":1,"certificado":1,"created_at":1}).to_list(5000)
    by_id={s["id"]:s for s in students}
    def top(key):
        counts={}
        for s in students:
            k=s.get(key) or None
            if k: counts[k]=counts.get(k,0)+1
        return sorted(([k,v] for k,v in counts.items()),key=lambda x:-x[1])[:6]
    accepted=await db.connections.find({"estado":"aceptada"},{"_id":0}).to_list(5000)
    total_conns=await db.connections.count_documents({"estado":{"$in":["aceptada","rechazada"]}})
    def pct(cond):
        pairs=[(by_id.get(c["from_id"]),by_id.get(c["to_id"])) for c in accepted]
        pairs=[p for p in pairs if p[0] and p[1]]
        return round(100*sum(1 for a,b in pairs if cond(a,b))/len(pairs)) if pairs else 0
    today=datetime.now(timezone.utc).date()
    days=[(today-timedelta(days=i)).isoformat() for i in range(13,-1,-1)]
    trend={d:{"mensajes":0,"conexiones":0,"publicaciones":0} for d in days}
    since=days[0]
    for coll,key in (("direct_messages","mensajes"),("connections","conexiones"),("feed_posts","publicaciones")):
        for row in await db[coll].find({"created_at":{"$gte":since}},{"_id":0,"created_at":1}).to_list(20000):
            d=row["created_at"][:10]
            if d in trend: trend[d][key]+=1
    activity=[]
    for p in await db.feed_posts.find({},{"_id":0}).sort("created_at",-1).to_list(6):
        activity.append({"texto":f"{p['author']} publicó en {p['categoria']}","avatar":p.get("avatar"),"at":p["created_at"]})
    for c in await db.connections.find({"estado":"aceptada"},{"_id":0}).sort("responded_at",-1).to_list(6):
        a,b=by_id.get(c["from_id"]),by_id.get(c["to_id"])
        if a and b: activity.append({"texto":f"{full_name(a)} y {full_name(b)} conectaron","avatar":b.get("avatar"),"at":c.get("responded_at") or c["created_at"]})
    for s in sorted(students,key=lambda s:s.get("created_at",""),reverse=True)[:6]:
        activity.append({"texto":f"{full_name(s)} se unió a Tecmi Link-Up","avatar":s.get("avatar"),"at":s.get("created_at")})
    activity.sort(key=lambda x:x.get("at") or "",reverse=True)
    week=(datetime.now(timezone.utc)-timedelta(days=7)).isoformat()
    return {"top_campus":top("campus"),"top_carreras":top("carrera") or top("certificado"),
            "impact":{"aceptacion":round(100*len(accepted)/total_conns) if total_conns else 0,
                      "entre_campus":pct(lambda a,b:a.get("campus")!=b.get("campus")),
                      "entre_carreras":pct(lambda a,b:(a.get("carrera") or a.get("certificado"))!=(b.get("carrera") or b.get("certificado"))),
                      "publicaciones_semana":await db.feed_posts.count_documents({"created_at":{"$gte":week}})},
            "trend":[{"dia":d,**trend[d]} for d in days],"activity":activity[:10]}

@api.get("/admin/students")
async def admin_students(user_id: str = Depends(current_admin)):
    return [clean(s) for s in await db.students.find({},{"_id":0,"password_hash":0}).sort("nombre",1).to_list(5000)]

@api.patch("/admin/students/{student_id}/status")
async def update_student_status(student_id: str, data: StatusUpdate, user_id: str = Depends(current_admin)):
    if student_id==user_id: raise HTTPException(400,"No puedes desactivar tu propia cuenta")
    result=await db.students.update_one({"id":student_id},{"$set":{"active":data.activo}})
    if result.matched_count == 0: raise HTTPException(404,"Estudiante no encontrado")
    if not data.activo: await db.sessions.delete_many({"user_id":student_id})
    return clean(await db.students.find_one({"id":student_id},{"_id":0}))

@api.post("/admin/students/{student_id}/reset-password")
async def reset_password(student_id: str, user_id: str = Depends(current_admin)):
    """Restablece a la contraseña temporal; la persona deberá cambiarla al entrar."""
    result=await db.students.update_one({"id":student_id},{"$set":{"password_hash":hash_password(DEFAULT_PASSWORD),"must_change_password":True}})
    if result.matched_count==0: raise HTTPException(404,"Usuario no encontrado")
    await db.sessions.delete_many({"user_id":student_id})
    return {"ok":True}

@api.post("/admin/events")
async def admin_create_event(data: EventCreate, user_id: str = Depends(current_admin)):
    if not data.titulo.strip(): raise HTTPException(400,"El evento necesita título")
    if data.fecha_fin < data.fecha_inicio: raise HTTPException(400,"La fecha de fin no puede ser antes del inicio")
    item={"id":str(uuid.uuid4()),**data.model_dump(),"attendees":0,"created_at":now()}
    await db.events.insert_one(item)
    return {**clean(item),"registered":False}

@api.get("/admin/events/{event_id}/registrations")
async def event_registrations(event_id: str, user_id: str = Depends(current_admin)):
    ids=[r["user_id"] for r in await db.registrations.find({"event_id":event_id},{"_id":0}).to_list(5000)]
    return [clean(s) for s in await db.students.find({"id":{"$in":ids}},{"_id":0,"password_hash":0}).to_list(5000)]

@api.post("/admin/events/{event_id}/attendance")
async def record_attendance(event_id: str, user_id: str = Depends(current_admin)):
    result=await db.events.update_one({"id":event_id},{"$set":{"attendance_recorded":True}})
    if result.matched_count == 0: raise HTTPException(404,"Evento no encontrado")
    return {"ok":True,"attendance_recorded":True}

@api.post("/admin/missions")
async def admin_create_mission(data: MissionCreate, user_id: str = Depends(current_admin)):
    item={"id":str(uuid.uuid4()),"nombre":data.nombre,"titulo":data.nombre,"descripcion":data.descripcion,"goal":data.meta_progreso,"xp":data.puntos_xp,"color":"#78D64B"}
    await db.missions.insert_one(item)
    return {**clean(item),"progress":0}

@api.get("/admin/reports")
async def admin_reports(user_id: str = Depends(current_admin)):
    reports=await db.reports.find({"estado":"pendiente"},{"_id":0}).sort("created_at",-1).to_list(500)
    posts={p["id"]:p for p in await db.feed_posts.find({"id":{"$in":[r["post_id"] for r in reports]}},{"_id":0}).to_list(500)}
    return [{**r,"post":posts.get(r["post_id"])} for r in reports]

@api.post("/admin/reports/{report_id}")
async def resolve_report(report_id: str, data: ReportResolve, user_id: str = Depends(current_admin)):
    report=await db.reports.find_one({"id":report_id},{"_id":0})
    if not report: raise HTTPException(404,"Reporte no encontrado")
    estado="resuelto" if data.accion=="ocultar" else "descartado"
    # una decisión cierra todos los reportes pendientes de la misma publicación
    await db.reports.update_many({"post_id":report["post_id"],"estado":"pendiente"},{"$set":{"estado":estado,"resolved_by":user_id,"resolved_at":now()}})
    await db.feed_posts.update_one({"id":report["post_id"]},{"$set":{"hidden":data.accion=="ocultar","reported":False}})
    return {"ok":True,"estado":estado}

@api.patch("/admin/campuses/{campus_id}")
async def update_campus(campus_id: str, data: CampusUpdate, user_id: str = Depends(current_admin)):
    changes={k:v for k,v in data.model_dump().items() if v is not None}
    result=await db.campuses.update_one({"id":campus_id},{"$set":changes})
    if result.matched_count==0: raise HTTPException(404,"Campus no encontrado")
    return clean(await db.campuses.find_one({"id":campus_id},{"_id":0}))

@api.post("/admin/{collection}")
async def admin_create(collection: str, data: CatalogCreate, user_id: str = Depends(current_admin)):
    allowed={"campuses","certificates","interests","missions"}
    if collection not in allowed: raise HTTPException(400,"Catálogo no permitido")
    if not data.nombre.strip(): raise HTTPException(400,"Escribe un nombre")
    item={"id":str(uuid.uuid4()),**{k:v for k,v in data.model_dump().items() if v is not None}}
    if collection=="campuses":
        if not data.estado or data.lat is None or data.lng is None: raise HTTPException(400,"El campus necesita estado y coordenadas")
        item.setdefault("is_connect",False); item.setdefault("imagen","")
    if collection=="certificates": item.setdefault("categoria","General")
    if collection=="missions": item.update({"titulo":data.nombre,"goal":1,"xp":10,"color":"#78D64B"})
    await db[collection].insert_one(item)
    return clean(item)

app.include_router(api)
app.add_middleware(CORSMiddleware,allow_credentials=True,allow_origins=os.environ.get("CORS_ORIGINS","*").split(","),allow_methods=["*"],allow_headers=["*"])
@app.on_event("shutdown")
async def shutdown(): client.close()
