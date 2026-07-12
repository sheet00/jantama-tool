"""Start Google Chrome with a remote debugging endpoint on Windows."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def find_chrome() -> Path:
    candidates = [
        Path(os.environ.get("ProgramFiles", ""))
        / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("ProgramFiles(x86)", ""))
        / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("LOCALAPPDATA", ""))
        / "Google/Chrome/Application/chrome.exe",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(
        "Windows Chrome が見つかりません。Chrome のインストール先を確認してください。"
    )


def run_command(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        check=False,
        capture_output=True,
        text=True,
        encoding="mbcs",
        errors="replace",
    )


def chrome_is_running() -> bool:
    result = run_command(["tasklist", "/FI", "IMAGENAME eq chrome.exe"])
    return "chrome.exe" in result.stdout.lower()


def stop_all_chrome() -> None:
    if not chrome_is_running():
        return
    print("既存のChromeを終了しています...")
    run_command(["taskkill", "/F", "/IM", "chrome.exe"])

    for _ in range(20):
        if not chrome_is_running():
            return
        time.sleep(0.25)
    raise RuntimeError(
        "Chromeを完全終了できませんでした。管理者権限や別ユーザーのChromeプロセスを確認してください。"
    )


def listening_pids(port: int) -> list[int]:
    result = run_command(["netstat", "-ano", "-p", "tcp"])
    pids: set[int] = set()
    for line in result.stdout.splitlines():
        fields = line.split()
        if len(fields) < 5 or fields[3].upper() != "LISTENING":
            continue
        local_address = fields[1]
        local_port = local_address.rsplit(":", 1)[-1]
        if local_port.isdigit() and int(local_port) == port:
            try:
                pids.add(int(fields[4]))
            except ValueError:
                pass
    return sorted(pid for pid in pids if pid > 0)


def clear_port(port: int) -> None:
    for pid in listening_pids(port):
        print(f"CDPポート {port} を使用中のPID {pid} を終了しています...")
        result = run_command(["taskkill", "/F", "/PID", str(pid)])
        if result.returncode != 0 and pid in listening_pids(port):
            detail = result.stderr.strip() or result.stdout.strip()
            raise RuntimeError(f"PID {pid} を終了できませんでした。{detail}")

    for _ in range(20):
        if not listening_pids(port):
            return
        time.sleep(0.25)
    raise RuntimeError(f"CDPポート {port} を解放できませんでした。")


def get_cdp_version(endpoint: str) -> str | None:
    try:
        with urllib.request.urlopen(endpoint, timeout=0.5) as response:
            return response.read().decode("utf-8")
    except (urllib.error.URLError, TimeoutError, OSError):
        return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Start Chrome with the remote debugging protocol enabled."
    )
    parser.add_argument("--port", type=int, default=9222)
    parser.add_argument("--profile-name", default="jantama-chrome")
    return parser.parse_args()


def main() -> int:
    if os.name != "nt":
        print("このスクリプトは Windows 用です。", file=sys.stderr)
        return 1

    args = parse_args()
    if not 1 <= args.port <= 65535:
        print("ポート番号は 1 から 65535 の範囲で指定してください。", file=sys.stderr)
        return 1
    if not args.profile_name.strip():
        print("プロファイル名を空にできません。", file=sys.stderr)
        return 1

    try:
        chrome = find_chrome()
        profile = (
            Path(os.environ.get("TEMP", os.environ.get("TMP", ""))) / args.profile_name
        )

        stop_all_chrome()
        clear_port(args.port)

        command = [
            str(chrome),
            f"--remote-debugging-port={args.port}",
            "--remote-debugging-address=0.0.0.0",
            f"--user-data-dir={profile}",
            "--no-first-run",
            "--no-default-browser-check",
            "--remote-allow-origins=*",
        ]

        print("Chromeを起動しています...")
        # Keep Chrome alive when the Python process is stopped by VS Code or Ctrl+C.
        creationflags = 0
        if os.name == "nt":
            creationflags = (
                subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
            )
        chrome_process = subprocess.Popen(
            command,
            creationflags=creationflags,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=True,
        )
        endpoint = f"http://127.0.0.1:{args.port}/json/version"
        version = None

        for _ in range(10):
            version = get_cdp_version(endpoint)
            if version:
                break
            if chrome_process.poll() is not None:
                break
            time.sleep(0.25)

        if not version:
            print(f"CDP に接続できません: {endpoint}", file=sys.stderr)
            print(f"Chrome PID: {chrome_process.pid}", file=sys.stderr)
            print(f"実際のコマンドライン: {' '.join(command)}", file=sys.stderr)
            print(f"ポート状態: {listening_pids(args.port)}", file=sys.stderr)
            return 1

        print(f"CDP is listening: {endpoint}")
        try:
            print(json.dumps(json.loads(version), ensure_ascii=False, indent=2))
        except json.JSONDecodeError:
            print(version)
        print(f"Chrome started: {chrome}")
        print(f"CDP endpoint: http://127.0.0.1:{args.port}")
        print(f"Profile: {profile}")
        return 0
    except (FileNotFoundError, RuntimeError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
