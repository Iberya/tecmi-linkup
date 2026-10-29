#!/bin/bash
cd "$(dirname "$0")"
echo "Preparando Tecmi Link-Up (la primera vez tarda un par de minutos)..."
if ! command -v python3 >/dev/null; then echo "Instala Python 3 desde https://www.python.org/downloads/"; read -r; exit 1; fi
[ -d .venv ] || python3 -m venv .venv
.venv/bin/python -m pip install -q --disable-pip-version-check --upgrade pip
.venv/bin/python -m pip install -q --disable-pip-version-check -r requirements-demo.txt
.venv/bin/python servidor_demo.py
