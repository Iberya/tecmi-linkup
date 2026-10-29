"""Datos de ejemplo para presentar Tecmi Link-Up (demo local y hosting de demostración)."""
import json, urllib.request

BASE = ["http://127.0.0.1:8000/api"]


def call(m, p, body=None, tok=None):
    r = urllib.request.Request(BASE[0] + p, method=m, data=json.dumps(body).encode() if body is not None else None,
                               headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + tok} if tok else {})})
    try:
        return json.loads(urllib.request.urlopen(r).read() or "null")
    except urllib.error.HTTPError:
        return None


P = [("AL01234567@tecmilenio.mx","Mariana","López","Las Torres","Ing. en Desarrollo de Software","5to semestre",["UX","Python","Startups"],["Python","Diseño UI"],["Marketing digital"],"brela"),
("AL02345678@tecmilenio.mx","Diego","Ramírez","Guadalajara Sur","Lic. en Mercadotecnia","3er semestre",["Marketing","Fotografía"],["Marketing digital","Fotografía"],["Python"],"halley"),
("AL03456789@tecmilenio.mx","Sofía","Hernández","Mérida","Lic. en Psicología","7mo semestre",["Bienestar","Liderazgo"],["Oratoria"],["Diseño UI"],"ikeya"),
("AL04567890@tecmilenio.mx","Jorge Alberto","Castañeda Villarreal","Cancún","Lic. en Administración de Empresas Turísticas","1er semestre",["Turismo","Idiomas"],["Inglés"],["Finanzas"],"araya"),
("AL05678901@tecmilenio.mx","Valeria","Torres","Puebla","Ing. Industrial","5to semestre",["Datos","Python"],["Excel avanzado","Finanzas"],["Python","Oratoria"],"brela")]


def seed(base):
    """Crea cuentas, invitaciones, chats y publicaciones de ejemplo usando la API (base = http://host:puerto/api)."""
    BASE[0] = base
    if call("POST", "/auth/login", {"email": P[0][0], "password": "Linkup2026"}):
        return  # ya se sembró antes
    T={}
    for e,n,a,c,car,sem,i,s,nd,com in P:
        r=call("POST","/auth/signup",{"email":e,"nombre":n,"apellido":a,"password":"Linkup2026","campus":c})
        T[n]=(r["token"],r["user"]["id"])
        call("PUT",f"/students/{r['user']['id']}",{"carrera":car,"semestre":sem,"intereses":i,"skills":s,"needs":nd,"avatar":f"https://i.pravatar.cc/160?u={e}","descripcion":f"Hola, soy {n}. Me encanta colaborar en proyectos entre campus."},T[n][0])
        call("POST","/cometa-quiz/submit",{"answers":[com]*6},T[n][0])
    adm=call("POST","/auth/signup",{"email":"laura.mendez@tecmilenio.mx","nombre":"Laura","apellido":"Méndez","password":"Linkup2026","campus":"Las Torres"})
    adm2=call("POST","/auth/signup",{"email":"carlos.ruiz@tecmilenio.mx","nombre":"Carlos","apellido":"Ruiz","password":"Linkup2026","campus":"Guadalajara Sur"})
    m,d,s,j,v=[T[k] for k in ["Mariana","Diego","Sofía","Jorge Alberto","Valeria"]]
    call("POST",f"/connections/{d[1]}",None,m[0])
    call("POST",f"/connections/{m[1]}",None,d[0])
    call("POST",f"/connections/{m[1]}",None,s[0])
    call("POST",f"/connections/{m[1]}",None,j[0])
    call("POST",f"/connections/{v[1]}",None,m[0])
    for who,txt in [(m,"¡Hola Diego! Vi que sabes de marketing digital, ¿te late armar algo juntos?"),(d,"¡Claro! Yo te ayudo con la campaña y tú con el prototipo 🙌"),(m,"Perfecto, ¿el jueves por videollamada?")]:
        other=d if who is m else m
        call("POST",f"/connections/{other[1]}/messages",{"contenido":txt},who[0])
    call("POST",f"/connections/{adm2['user']['id']}/messages",{"contenido":"Carlos, ¿revisamos la agenda del Meetup?"},adm["token"])
    call("POST","/staff/messages",{"contenido":"Buenos días, equipo docente. Recordatorio: el viernes cerramos la convocatoria de retos."},adm["token"])
    call("POST","/staff/messages",{"contenido":"Gracias Laura, ya lo compartí con mis grupos."},adm2["token"])
    p=call("POST","/feed",{"contenido":"Busco equipo para el hackathon intercampus 🚀 Necesitamos alguien de diseño.","categoria":"Oportunidades"},m[0])
    call("POST","/feed",{"contenido":"Hoy terminamos el taller de bienestar en Mérida, ¡gracias a todos!","categoria":"Comunidad"},s[0])
    if p:
        call("POST",f"/feed/{p['id']}/react",{"tipo":"like"},d[0]); call("POST",f"/feed/{p['id']}/comment",{"contenido":"¡Me apunto!"},d[0])
        call("POST",f"/feed/{p['id']}/report",{"motivo":"Spam","detalle":"Prueba de moderación"},j[0])
