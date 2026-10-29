"""Tecmi Link-Up en un solo servicio: la API (/api) y la página web desde el mismo dominio.

Pensado para Render (gratis) + MongoDB Atlas (gratis). Variables de entorno:
  MONGO_URL  cadena de conexión de Atlas (mongodb+srv://...)
  DB_NAME    nombre de la base, por ejemplo tecmi_linkup
  SEED_DEMO  "1" para crear las cuentas de ejemplo la primera vez
"""
import os, sys, threading, time, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "backend"))
os.environ.setdefault("DB_NAME", "tecmi_linkup")

import server  # noqa: E402
from demo_data import seed  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

app = server.app
app.mount("/", StaticFiles(directory=HERE / "web", html=True), name="web")


@app.middleware("http")
async def no_cache_html(request, call_next):
    # index.html sin caché: si no, el navegador puede seguir abriendo una versión vieja de la app
    response = await call_next(request)
    if not request.url.path.startswith(("/static/", "/api/", "/campus/")):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


def _seed_when_ready():
    base = f"http://127.0.0.1:{os.environ.get('PORT', '8000')}/api"
    for _ in range(120):
        try:
            urllib.request.urlopen(base + "/campuses", timeout=5)
            break
        except Exception:
            time.sleep(1)
    try:
        seed(base)
    except Exception as e:  # la app sigue funcionando aunque falle la semilla
        print("No se pudieron crear los datos de ejemplo:", e)


@app.on_event("startup")
async def demo_data():
    if os.environ.get("SEED_DEMO") == "1":
        threading.Thread(target=_seed_when_ready, daemon=True).start()
