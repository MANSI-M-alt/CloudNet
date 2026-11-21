import os
import sys
from pathlib import Path

# Add project root to sys.path so modules and packages resolve cleanly
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    os.chdir(str(ROOT_DIR))
except Exception:
    pass

from web_dashboard.server import app

# Vercel entrypoint exposes 'app'
