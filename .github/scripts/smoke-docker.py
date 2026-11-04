#!/usr/bin/env python3
"""Check the built application image against a disposable PostgreSQL database."""

import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True, stderr=subprocess.STDOUT).strip()


def wait_for(check, description, timeout=120):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            result = check()
            if result:
                return result
        except (subprocess.CalledProcessError, urllib.error.URLError, ConnectionError, TimeoutError):
            pass
        time.sleep(1)
    raise RuntimeError(f"Timed out waiting for {description}")


def main():
    root = Path(__file__).resolve().parents[2]
    image = sys.argv[1] if len(sys.argv) > 1 else "controla:ci"
    node_version = (root / "frontend/.nvmrc").read_text().strip()
    npm_version = json.loads((root / "frontend/package.json").read_text())["packageManager"].removeprefix("npm@")
    assert docker("run", "--rm", "--entrypoint", "node", image, "--version") == f"v{node_version}"
    assert docker("run", "--rm", "--entrypoint", "npm", image, "--version") == npm_version

    prefix = f"controla-smoke-{uuid.uuid4().hex[:10]}"
    network, database, app = prefix, f"{prefix}-db", f"{prefix}-app"
    try:
        docker("network", "create", network)
        docker("run", "--detach", "--name", database, "--network", network,
               "--env", "POSTGRES_DB=controla", "--env", "POSTGRES_USER=controla",
               "--env", "POSTGRES_PASSWORD=smoke-fixture-only", "postgres:16-alpine")
        wait_for(lambda: docker("exec", database, "pg_isready", "-U", "controla"), "PostgreSQL")
        docker("run", "--detach", "--name", app, "--network", network,
               "--publish", "127.0.0.1::3000", "--env", "HOSTNAME=0.0.0.0",
               "--env", f"SPRING_DATASOURCE_URL=jdbc:postgresql://{database}:5432/controla",
               "--env", "SPRING_DATASOURCE_USERNAME=controla", "--env", "SPRING_DATASOURCE_PASSWORD=smoke-fixture-only",
               "--env", "MAIL_HOST=localhost", "--env", "MAIL_PORT=2525",
               "--env", "MAIL_USERNAME=smoke", "--env", "MAIL_PASSWORD=smoke", image)
        base = "http://" + docker("port", app, "3000/tcp").splitlines()[0]

        def request(path, data=None, token=None):
            headers = {"Content-Type": "application/json"}
            if token:
                headers["Authorization"] = f"Bearer {token}"
            req = urllib.request.Request(base + path, headers=headers,
                                         data=json.dumps(data).encode() if data is not None else None)
            with urllib.request.urlopen(req, timeout=10) as response:
                return response.read()

        license_info = wait_for(lambda: json.loads(request("/api/license")), "Next.js API rewrite and backend")
        assert license_info["edition"] == "Community Edition"

        # The application creates these credentials only in this disposable database.
        # Keep the generated password and JWT out of CI output.
        def initial_password():
            match = re.search(r"Password: ([^\r\n]+)", docker("logs", app))
            return match.group(1).strip() if match else None

        password = wait_for(initial_password, "admin initialization")
        login = json.loads(request("/api/auth/login", {"username": "admin", "password": password}))
        token = login["token"]
        assert token and login["username"] == "admin"
        assert json.loads(request("/api/auth/me", token=token))["username"] == "admin"
        assert json.loads(request("/api/instances", token=token)) == []

        try:
            request("/api/auth/me")
        except urllib.error.HTTPError as error:
            assert error.code in (401, 403), error.code
        else:
            raise AssertionError("Protected endpoint accepted an unauthenticated request")

        html = request("/login").decode()
        assert "Controla" in html
        assets = re.findall(r'(?:src|href)="(/_next/static/[^"?]+\.(?:js|css))', html)
        assert any(path.endswith(".js") for path in assets), "Missing JavaScript assets"
        assert any(path.endswith(".css") for path in assets), "Missing CSS assets"
        for asset in dict.fromkeys(assets):
            assert request(asset), f"Empty asset: {asset}"
        print(f"Docker smoke passed: Node {node_version}, npm {npm_version}, PostgreSQL 16, "
              f"login, protected API, rewrite, standalone server and {len(set(assets))} static assets")
    except Exception as error:
        if isinstance(error, subprocess.CalledProcessError):
            print(re.sub(r"Password: [^\r\n]+", "Password: [redacted]", error.output), file=sys.stderr)
        try:
            logs = docker("logs", app)
            print(re.sub(r"Password: [^\r\n]+", "Password: [redacted]", logs), file=sys.stderr)
        except subprocess.CalledProcessError:
            pass
        raise
    finally:
        for name in (app, database):
            subprocess.run(["docker", "rm", "--force", "--volumes", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["docker", "network", "rm", network], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == "__main__":
    main()
