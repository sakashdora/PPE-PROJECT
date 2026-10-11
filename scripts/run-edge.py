"""Project-local entry point for the compatible inference/forensics runtime."""
import os
import runpy
import sys
from pathlib import Path
root = Path(__file__).resolve().parents[1]
runtime = root / ".runtime" / "python"
if runtime.exists():
    sys.path.insert(0, str(runtime))
sys.path.insert(0, str(root / "edge"))
for source in [root / "server" / ".env", root / ".env"]:
    if source.exists():
        for line in source.read_text(encoding="utf-8-sig").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                if key.strip() in {"EDGE_API_KEY", "SERVER_URL"}:
                    os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
os.environ.setdefault("MODEL_PATH", str(root / "models" / "best_s5.onnx"))
if "--forensics" in sys.argv:
    sys.argv.remove("--forensics")
    runpy.run_module("app.forensics_server", run_name="__main__")
else:
    runpy.run_module("app.main", run_name="__main__")
