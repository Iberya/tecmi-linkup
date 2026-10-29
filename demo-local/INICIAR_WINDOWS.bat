@echo off
cd /d "%~dp0"
echo Preparando Tecmi Link-Up (la primera vez tarda un par de minutos)...
if not exist .venv (
  py -3 -m venv .venv 2>nul || python -m venv .venv
)
if not exist .venv\Scripts\python.exe (
  echo No se encontro Python. Instalalo desde https://www.python.org/downloads/ marcando "Add Python to PATH" y vuelve a abrir este archivo.
  pause
  exit /b 1
)
.venv\Scripts\python.exe -m pip install -q --disable-pip-version-check --upgrade pip
.venv\Scripts\python.exe -m pip install -q --disable-pip-version-check -r requirements-demo.txt
.venv\Scripts\python.exe servidor_demo.py
pause
