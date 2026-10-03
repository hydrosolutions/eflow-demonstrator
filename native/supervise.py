"""Bound a child process by elapsed time and resident process-tree memory."""

import argparse
import json
import logging
import subprocess
import sys
import time
from pathlib import Path

import psutil


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--seconds", type=int, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("command", nargs=argparse.REMAINDER)
    a = p.parse_args()
    command = a.command[1:] if a.command and a.command[0] == "--" else a.command
    a.output.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    peak = 0
    reason = None
    with (a.output / "process.log").open("w") as log:
        child = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT)
        process = psutil.Process(child.pid)
        while child.poll() is None:
            try:
                processes = [process]  # Child is native Python/Rust threads, not a subprocess tree.
                rss = sum(p.memory_info().rss for p in processes if p.is_running())
            except psutil.NoSuchProcess:
                rss = 0
            peak = max(peak, rss)
            if time.monotonic() - started > a.seconds:
                reason = "timeout"
            if rss > 2 * 1024**3:
                reason = "memory_limit"
            if reason:
                for proc in reversed(processes):
                    try:
                        proc.kill()
                    except psutil.NoSuchProcess:
                        pass
                child.wait()
                break
            time.sleep(0.1)
    outcome = {
        "status": reason or ("passed" if child.returncode == 0 else "failed"),
        "returncode": child.returncode,
        "elapsedSeconds": time.monotonic() - started,
        "peakRssBytes": peak,
        "limitSeconds": a.seconds,
        "limitRssBytes": 2 * 1024**3,
        "command": command,
        "memoryScope": "Single native child process including Rust threads; no process-tree enumeration permitted by host sandbox",
    }
    (a.output / "supervisor.json").write_text(json.dumps(outcome, indent=2) + "\n")
    logging.warning("%s", outcome)
    if outcome["status"] != "passed":
        sys.exit(1)


if __name__ == "__main__":
    main()
