"""Tecmi Link-Up en modo demo local.

Levanta la app completa en http://localhost:8765 con una base de datos en memoria
(se reinicia cada vez que cierras la ventana) y datos de ejemplo.
"""
import json, os, sys, threading, time, urllib.request, webbrowser
from pathlib import Path

HERE = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", "8765"))
B = f"http://127.0.0.1:{PORT}/api"
os.environ.setdefault("MONGO_URL", "mongodb://demo")
os.environ.setdefault("DB_NAME", "tecmi_demo")

# Base de datos en memoria: no hace falta instalar MongoDB
import mongomock_motor, motor.motor_asyncio
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
sys.path.insert(0, str(HERE.parent / "backend"))
import server  # noqa: E402
from demo_data import seed  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
import uvicorn  # noqa: E402

server.app.mount("/", StaticFiles(directory=HERE / "web", html=True), name="web")


@server.app.middleware("http")
async def no_cache_html(request, call_next):
    # index.html sin caché: si no, el navegador puede seguir abriendo una versión vieja de la app
    response = await call_next(request)
    if not request.url.path.startswith(("/static/", "/api/", "/campus/")):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


def boot():
    for _ in range(60):
        try:
            urllib.request.urlopen(B + "/campuses"); break
        except Exception:
            time.sleep(0.5)
    seed(B)
    url = f"http://localhost:{PORT}"
    print("\n  Tecmi Link-Up listo en " + url)
    print("  Estudiante: AL01234567@tecmilenio.mx  /  Linkup2026")
    print("  Docente:    laura.mendez@tecmilenio.mx /  Linkup2026")
    print("  Cierra esta ventana para apagar la app.\n")
    webbrowser.open(url)


if __name__ == "__main__":
    threading.Thread(target=boot, daemon=True).start()
    uvicorn.run(server.app, host="127.0.0.1", port=PORT, log_level="warning")
