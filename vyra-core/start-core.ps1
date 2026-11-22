$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$python = Join-Path $root 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path $python)) { throw 'VYRA backend Python virtual environment not found.' }
& $python -m uvicorn app:app --app-dir $PSScriptRoot --host 127.0.0.1 --port 8002
