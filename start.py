#!/usr/bin/env python3
"""Start (or restart) all LegalEagle services: client, server, and extractor."""

import os
import signal
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.abspath(__file__))

SERVICES = [
    {
        "name": "server",
        "cmd": ["npx", "tsx", "watch", "src/index.ts"],
        "cwd": os.path.join(ROOT, "server"),
        "port": 3001,
    },
    {
        "name": "client",
        "cmd": ["npx", "vite", "--port", "3002"],
        "cwd": os.path.join(ROOT, "client"),
        "port": 3002,
    },
    {
        "name": "extractor",
        "cmd": [
            os.path.join(ROOT, "extractor", ".venv", "bin", "python"),
            "-m", "uvicorn", "main:app",
            "--host", "127.0.0.1", "--port", "8321", "--reload",
        ],
        "cwd": os.path.join(ROOT, "extractor"),
        "port": 8321,
    },
]


def kill_port(port: int) -> None:
    """Kill any process listening on the given port."""
    try:
        out = subprocess.check_output(
            ["lsof", "-ti", f":{port}"], stderr=subprocess.DEVNULL, text=True
        )
        for pid in out.strip().splitlines():
            try:
                os.kill(int(pid), signal.SIGTERM)
            except (ProcessLookupError, ValueError):
                pass
    except subprocess.CalledProcessError:
        pass  # nothing on that port


def wait_for_port(port: int, timeout: float = 15.0) -> bool:
    """Wait until something is listening on port, return True if ready."""
    import socket
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) == 0:
                return True
        time.sleep(0.3)
    return False


def main() -> None:
    # Kill anything already on our ports
    print("Stopping existing services...")
    for svc in SERVICES:
        kill_port(svc["port"])
    time.sleep(1)

    # Load .env so child processes inherit it
    env = os.environ.copy()
    env_file = os.path.join(ROOT, ".env")
    if os.path.isfile(env_file):
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, val = line.partition("=")
                    env[key.strip()] = val.strip()

    procs: list[tuple[str, subprocess.Popen]] = []

    for svc in SERVICES:
        print(f"Starting {svc['name']} (port {svc['port']})...")
        proc = subprocess.Popen(
            svc["cmd"],
            cwd=svc["cwd"],
            env=env,
            stdout=sys.stdout,
            stderr=sys.stderr,
        )
        procs.append((svc["name"], proc))

    # Wait for each service to be ready
    for svc in SERVICES:
        if wait_for_port(svc["port"]):
            print(f"  {svc['name']} ready on port {svc['port']}")
        else:
            print(f"  {svc['name']} did not start on port {svc['port']} (may still be loading)")

    print("\nAll services launched. Press Ctrl+C to stop.\n")

    try:
        # Wait for any child to exit
        while True:
            for name, proc in procs:
                ret = proc.poll()
                if ret is not None:
                    print(f"\n{name} exited with code {ret}")
                    raise KeyboardInterrupt
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down...")
        for name, proc in procs:
            proc.terminate()
        for name, proc in procs:
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
        print("All services stopped.")


if __name__ == "__main__":
    main()
