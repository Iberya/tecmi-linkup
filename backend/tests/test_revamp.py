"""Pruebas locales del backend (sin servidor ni Mongo real): usan mongomock-motor en memoria.
Correr: pip install mongomock-motor httpx && pytest backend/tests -n 0
"""
import os, sys, uuid
import pytest

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "tecmi_test")
import mongomock_motor, motor.motor_asyncio
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

PW = "Linkup2026"

@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as client:
        yield client

def signup(c, prefix="AL0", campus="Las Torres", **extra):
    email = f"{prefix}{uuid.uuid4().hex[:8]}@tecmilenio.mx"
    r = c.post("/api/auth/signup", json={"email": email, "nombre": "Ana", "apellido": prefix, "password": PW, "campus": campus, **extra})
    assert r.status_code == 200, r.text
    body = r.json()
    return {"id": body["user"]["id"], "email": email, "h": {"Authorization": f"Bearer {body['token']}"}}

def test_requires_session(c):
    assert c.get("/api/bootstrap").status_code == 401
    assert c.get("/api/bootstrap", headers={"X-User-Id": "student-mar"}).status_code == 401

def test_password_rules_and_login(c):
    r = c.post("/api/auth/signup", json={"email": "AL0weak1@tecmilenio.mx", "nombre": "A", "apellido": "B", "password": "corta"})
    assert r.status_code == 400
    u = signup(c)
    assert c.post("/api/auth/signup", json={"email": u["email"], "nombre": "A", "apellido": "B", "password": PW}).status_code == 409
    assert c.post("/api/auth/login", json={"email": u["email"], "password": "Incorrecta1"}).status_code == 401
    r = c.post("/api/auth/login", json={"email": u["email"], "password": PW})
    assert r.status_code == 200 and "password_hash" not in r.json()["user"]
    assert c.post("/api/auth/signup", json={"email": "x@gmail.com", "nombre": "A", "apellido": "B", "password": PW}).status_code == 400

def test_legacy_accounts_get_default_password(c):
    # la migración corre al iniciar; la repetimos a mano dentro del loop del cliente
    c.portal.call(lambda: server.db.students.insert_one({"id": "legacy-1", "nombre": "Leo", "apellido": "Viejo", "email": "al0legacy@tecmilenio.mx", "rol": "estudiante", "active": True}))
    c.portal.call(server.ensure_extensions)
    doc = c.portal.call(lambda: server.db.students.find_one({"id": "legacy-1"}))
    assert doc["password_hash"] != "UTMtorres" and doc["must_change_password"] is True
    r = c.post("/api/auth/login", json={"email": "al0legacy@tecmilenio.mx", "password": "UTMtorres"})
    assert r.status_code == 200
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    assert c.post("/api/auth/password", json={"actual": "UTMtorres", "nueva": "Nueva2026x"}, headers=h).status_code == 200
    assert c.post("/api/auth/login", json={"email": "al0legacy@tecmilenio.mx", "password": "Nueva2026x"}).json()["user"]["must_change_password"] is False

def test_invitations_and_direct_messages(c):
    a, b = signup(c, campus="Las Torres"), signup(c, campus="Puebla")
    assert c.post(f"/api/connections/{b['id']}/messages", json={"contenido": "hola"}, headers=a["h"]).status_code == 403
    inv = c.post(f"/api/connections/{b['id']}", headers=a["h"]).json()
    assert inv["status"] == "pendiente"
    assert c.post(f"/api/connections/{inv['id']}/accept", headers=a["h"]).status_code == 403  # solo el destinatario
    received = [x for x in c.get("/api/connections", headers=b["h"]).json() if x["direction"] == "received"]
    assert received and received[0]["other"]["id"] == a["id"]
    assert c.get("/api/pulse", headers=b["h"]).json()["pending_invitations"] == 1
    assert c.post(f"/api/connections/{inv['id']}/accept", headers=b["h"]).json()["estado"] == "aceptada"
    c.post(f"/api/connections/{b['id']}/messages", json={"contenido": "¡Hola B!"}, headers=a["h"])
    c.post(f"/api/connections/{a['id']}/messages", json={"contenido": "¡Hola A!"}, headers=b["h"])
    thread_a = [m["contenido"] for m in c.get(f"/api/connections/{b['id']}/messages", headers=a["h"]).json()]
    assert thread_a == ["¡Hola B!", "¡Hola A!"]
    assert c.get("/api/pulse", headers=b["h"]).json()["unread_messages"] == 0  # al responder, B marcó el hilo como leído
    boot = c.get("/api/bootstrap", headers=a["h"]).json()
    assert boot["student"]["connections"] == 1
    mission1 = next(m for m in boot["missions"] if m["id"] == "mission-1")
    assert mission1["progress"] == mission1["goal"]  # conectó con otro campus

def test_reject_and_reinvite(c):
    a, b = signup(c), signup(c)
    inv = c.post(f"/api/connections/{b['id']}", headers=a["h"]).json()
    assert c.post(f"/api/connections/{inv['id']}/reject", headers=b["h"]).json()["estado"] == "rechazada"
    assert c.post(f"/api/connections/{b['id']}", headers=a["h"]).json()["status"] == "pendiente"

def test_missions_events_communities_are_per_user(c):
    a, b = signup(c), signup(c)
    assert c.post("/api/missions/mission-3/complete", headers=a["h"]).json()["xp"] == 50
    assert c.post("/api/missions/mission-3/complete", headers=a["h"]).json()["already_completed"] is True
    assert c.post("/api/missions/mission-3/complete", headers=b["h"]).json()["xp"] == 50
    assert c.post("/api/missions/mission-1/complete", headers=a["h"]).status_code == 400  # automática
    assert c.post("/api/events/event-1/register", headers=a["h"]).json()["registered"] is True
    ev_b = next(e for e in c.get("/api/bootstrap", headers=b["h"]).json()["events"] if e["id"] == "event-1")
    assert ev_b["registered"] is False
    c.post("/api/communities/com-moda/join", headers=a["h"])
    com_b = next(x for x in c.get("/api/bootstrap", headers=b["h"]).json()["communities"] if x["id"] == "com-moda")
    assert com_b["joined"] is False
    assert c.post("/api/communities/com-moda/messages", json={"contenido": "hola"}, headers=b["h"]).status_code == 403

def test_profile_only_self(c):
    a, b = signup(c), signup(c)
    assert c.put(f"/api/students/{b['id']}", json={"descripcion": "hack"}, headers=a["h"]).status_code == 403
    r = c.put(f"/api/students/{a['id']}", json={"nombre": "Nuevo", "descripcion": "Hola", "intereses": ["A", "B", "C"]}, headers=a["h"])
    assert r.json()["nombre"] == "Nuevo"

def test_admin_guard_staff_chat_and_reports(c):
    st, doc1, doc2 = signup(c), signup(c, prefix="docente"), signup(c, prefix="lider")
    assert c.get("/api/admin/metrics", headers=st["h"]).status_code == 403
    assert c.get("/api/staff/messages", headers=st["h"]).status_code == 403
    c.post("/api/staff/messages", json={"contenido": "Junta a las 5"}, headers=doc1["h"])
    assert c.get("/api/staff/messages", headers=doc2["h"]).json()[-1]["contenido"] == "Junta a las 5"
    assert c.post(f"/api/connections/{doc2['id']}/messages", json={"contenido": "hola colega"}, headers=doc1["h"]).status_code == 200
    post = c.post("/api/feed", json={"contenido": "spam", "categoria": "Comunidad"}, headers=st["h"]).json()
    c.post(f"/api/feed/{post['id']}/report", json={"motivo": "Información falsa"}, headers=doc1["h"])
    rep = c.get("/api/admin/reports", headers=doc1["h"]).json()[0]
    assert rep["motivo"] == "Información falsa"
    c.post(f"/api/admin/reports/{rep['id']}", json={"accion": "ocultar"}, headers=doc1["h"])
    assert post["id"] not in [p["id"] for p in c.get("/api/bootstrap", headers=st["h"]).json()["feed"]]
    m = c.get("/api/admin/metrics", headers=doc1["h"]).json()
    assert m["campus_conectados"] >= 40 and m["espacios_connect"] >= 9
    ov = c.get("/api/admin/overview", headers=doc1["h"]).json()
    assert len(ov["trend"]) == 14
    assert c.patch(f"/api/admin/students/{doc1['id']}/status", json={"activo": False}, headers=doc1["h"]).status_code == 400
    c.patch(f"/api/admin/students/{st['id']}/status", json={"activo": False}, headers=doc1["h"])
    assert c.get("/api/bootstrap", headers=st["h"]).status_code == 401
    assert c.post("/api/auth/login", json={"email": st["email"], "password": PW}).status_code == 403

def test_feed_reaction_toggle_and_comments(c):
    a, b = signup(c), signup(c)
    post = c.post("/api/feed", json={"contenido": "Mi logro", "categoria": "Comunidad"}, headers=a["h"]).json()
    assert c.post(f"/api/feed/{post['id']}/react", headers=b["h"]).json()["reactions"] == 1
    assert c.post(f"/api/feed/{post['id']}/react", headers=b["h"]).json()["reactions"] == 0
    c.post(f"/api/feed/{post['id']}/comment", json={"contenido": "¡Felicidades!"}, headers=b["h"])
    assert c.get(f"/api/feed/{post['id']}/comments").json()[0]["contenido"] == "¡Felicidades!"
    notifs = c.get("/api/notifications", headers=a["h"]).json()["items"]
    assert any(n["tipo"] == "comentario" for n in notifs)

def test_campuses_have_coordinates(c):
    u = signup(c)
    camps = c.get("/api/bootstrap", headers=u["h"]).json()["campuses"]
    assert all(isinstance(x.get("lat"), float) and isinstance(x.get("lng"), float) for x in camps)
    assert len(camps) == 40 and not any(x["nombre"] == "Artz Pedregal" for x in camps)
    assert all(x["imagen"].startswith("/campus/") for x in camps)  # cada campus del mapa tiene foto

def test_public_campuses_and_password_reset(c):
    assert any(x["nombre"] == "Las Torres" for x in c.get("/api/campuses").json())
    st, doc = signup(c), signup(c, prefix="coord")
    assert c.post(f"/api/admin/students/{st['id']}/reset-password", headers=st["h"]).status_code == 403
    assert c.post(f"/api/admin/students/{st['id']}/reset-password", headers=doc["h"]).status_code == 200
    r = c.post("/api/auth/login", json={"email": st["email"], "password": "UTMtorres"})
    assert r.status_code == 200 and r.json()["user"]["must_change_password"] is True
