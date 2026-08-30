"""Standard-library test launcher; no installation or source-tree cache writes."""

from pathlib import Path
import sys
import unittest

ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ENGINE_ROOT / "src"))

if __name__ == "__main__":
    suite = unittest.defaultTestLoader.discover(str(ENGINE_ROOT / "tests"))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(0 if result.wasSuccessful() else 1)
