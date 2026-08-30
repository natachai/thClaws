"""Run the copied 2032 Trip Generation fixture without installing anything."""

from pathlib import Path
import sys

ENGINE_ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ENGINE_ROOT / "src"))

from thclaws_transport.runner import main

if __name__ == "__main__":
    # The convenience launcher intentionally fixes the writable root to this copy.
    if any(argument == "--workspace" or argument.startswith("--workspace=") for argument in sys.argv[1:]):
        raise SystemExit("This launcher only runs inside transport-engine; --workspace cannot be overridden.")
    arguments = ["--workspace", str(ENGINE_ROOT)]
    if not sys.argv[1:]:
        arguments += ["--request", str(ENGINE_ROOT / "examples" / "trip-generation-2032.json")]
    else:
        arguments += sys.argv[1:]
    raise SystemExit(main(arguments))
