#!/usr/bin/env python3
"""Exercise the production Compose file through an isolated local HTTPS proxy.

Uses only disposable projects. TLS uses Traefik's local test certificate; public
DNS and Let's Encrypt issuance still require a real deployment check.
"""
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import ssl
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("smoke", Path(__file__).with_name("smoke-docker.py"))
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)
docker, wait_for = smoke.docker, smoke.wait_for


def main():
    project = "controla-hostinger-test-" + uuid.uuid4().hex[:10]
    proxy = project + "-proxy"
    hostname = "controla.example.test"
    env = {**os.environ, "COMPOSE_PROJECT_NAME": project, "CONTROLA_HOST": hostname,
           "CONTROLA_IMAGE": sys.argv[1] if len(sys.argv) > 1 else "controla:ci",
           "POSTGRES_PASSWORD": secrets.token_hex(32),
           "CONTROLA_SECURITY_MASTER_KEY": secrets.token_hex(32),
           "JWT_SECRET": secrets.token_hex(32)}
    with tempfile.TemporaryDirectory(prefix="controla-proxy-test-") as directory:
        override = Path(directory) / "test.json"
        override.write_text(json.dumps({"services": {"controla": {"labels": {
            f"traefik.http.routers.{project}.tls.certresolver": ""
        }}}}))
        command = ["docker", "compose", "-f", str(ROOT / "docker-compose.hostinger.yml"),
                   "-f", str(override)]

        def compose(*args):
            return subprocess.check_output([*command, *args], env=env, text=True,
                                           stderr=subprocess.STDOUT).strip()

        try:
            compose("up", "--detach", "--pull", "never")
            app = compose("ps", "-q", "controla")
            wait_for(lambda: docker("inspect", "--format", "{{.State.Health.Status}}", app) == "healthy",
                     "production app health", timeout=180)
            # Proxy on the app bridge models a shared-network proxy. Its HTTP
            # routing is identical to the host-network topology used on the VPS.
            docker("run", "--detach", "--name", proxy, "--network", project + "_default",
                   "--publish", "127.0.0.1::443", "--volume", "/var/run/docker.sock:/var/run/docker.sock:ro",
                   "traefik:v3.7", "--providers.docker=true", "--providers.docker.exposedbydefault=false",
                   "--entrypoints.websecure.address=:443")
            base = "https://" + docker("port", proxy, "443/tcp").splitlines()[0]
            context = ssl._create_unverified_context()  # Isolated test fixture only.

            def request(path, data=None, token=None):
                headers = {"Host": hostname, "Origin": "https://" + hostname,
                           "Content-Type": "application/json"}
                if token:
                    headers["Authorization"] = "Bearer " + token
                req = urllib.request.Request(base + path, headers=headers,
                                             data=json.dumps(data).encode() if data is not None else None)
                with urllib.request.urlopen(req, timeout=8, context=context) as response:
                    return response.read()

            info = wait_for(lambda: json.loads(request("/api/license")), "HTTPS Host routing")
            assert info["edition"] == "Community Edition"
            assert "Controla" in request("/login").decode()
            match = re.search(r"Password: ([^\r\n]+)", docker("logs", app))
            assert match, "Initial admin was not created"
            password = match.group(1).strip()
            login = json.loads(request("/api/auth/login", {"username": "admin", "password": password}))
            token = login["token"]
            assert json.loads(request("/api/auth/me", token=token))["username"] == "admin"
            for path, data in (("/api/debug/user/admin", None),
                               ("/api/debug/verify-password", {"username": "admin", "password": password}),
                               ("/api/debug/generate-hash", {"password": password})):
                for auth in (None, token):
                    try:
                        request(path, data=data, token=auth)
                    except urllib.error.HTTPError as error:
                        # Spring Security may protect the /error dispatch of an
                        # unmapped route, returning 403 rather than 404.
                        assert error.code in (401, 403, 404), error.code
                    else:
                        raise AssertionError("Development debug endpoint exposed over HTTPS")
            # Recreate only the app: existing users and JWT signing key must survive.
            compose("up", "--detach", "--force-recreate", "--no-deps", "controla")
            app = compose("ps", "-q", "controla")
            wait_for(lambda: docker("inspect", "--format", "{{.State.Health.Status}}", app) == "healthy",
                     "recreated app health", timeout=180)
            assert json.loads(wait_for(lambda: request("/api/auth/me", token=token),
                                       "persisted login"))["username"] == "admin"
            assert json.loads(request("/api/auth/login", {"username": "admin", "password": password}))["token"]
            print("Hostinger smoke passed: production Compose, HTTPS Host routing, login, health, persistent DB and JWT key")
        except subprocess.CalledProcessError as error:
            # Do not dump app logs, credentials, or a complete resolved config.
            print("Hostinger smoke Docker operation failed (output withheld to protect credentials)", file=sys.stderr)
            raise RuntimeError("Hostinger smoke Docker operation failed") from None
        finally:
            subprocess.run(["docker", "rm", "--force", proxy], capture_output=True)
            subprocess.run([*command, "down", "--volumes"], env=env, capture_output=True)


if __name__ == "__main__":
    main()
