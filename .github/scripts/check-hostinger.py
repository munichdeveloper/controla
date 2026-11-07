#!/usr/bin/env python3
"""Validate the public deployment contract without starting any containers."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]


def main():
    with tempfile.TemporaryDirectory(prefix="controla-config-") as directory:
        target = Path(directory) / "credentials.env"
        command = [sys.executable, str(ROOT / "deploy/hostinger-env.py"),
                   "controla.example.test", "--output", str(target)]
        subprocess.run(command, check=True, capture_output=True)
        original = target.read_bytes()
        assert subprocess.run(command, capture_output=True).returncode != 0
        assert target.read_bytes() == original, "Generator overwrote persistent keys"
        invalid = command.copy()
        invalid[2] = "https://controla.example.test/path"
        assert subprocess.run(invalid, capture_output=True).returncode != 0
        values = dict(line.split("=", 1) for line in target.read_text().splitlines())
        for key in ("POSTGRES_PASSWORD", "CONTROLA_SECURITY_MASTER_KEY", "JWT_SECRET"):
            assert len(values[key]) == 64
        assert len({values[key] for key in ("POSTGRES_PASSWORD", "CONTROLA_SECURITY_MASTER_KEY", "JWT_SECRET")}) == 3

        env = {**os.environ, **values}
        compose = ["docker", "compose", "--env-file", str(target),
                   "-f", str(ROOT / "docker-compose.hostinger.yml")]
        for project in ("controla-a", "controla-b"):
            env["COMPOSE_PROJECT_NAME"] = project
            result = subprocess.run([*compose, "config", "--format", "json"],
                                    env=env, text=True, capture_output=True, check=True)
            model = json.loads(result.stdout)
            for service in model["services"].values():
                assert not service.get("ports"), "Production service publishes a host port"
                assert not service.get("container_name"), "Fixed container name breaks multiple installs"
            app = model["services"]["controla"]
            assert "build" not in app
            assert app["restart"] == "unless-stopped"
            settings = app["environment"]
            assert settings["CONTROLA_DEBUG_ENABLED"] == "false"
            assert settings["NEXT_PUBLIC_BACKEND_BASE_URL"] == "/api"
            assert settings["BACKEND_URL"] == "http://localhost:8081/api"
            assert settings["FRONTEND_URL"] == settings["CORS_ALLOWED_ORIGINS"] == "https://controla.example.test"
            assert settings["SPRING_DATASOURCE_PASSWORD"] == model["services"]["postgres"]["environment"]["POSTGRES_PASSWORD"]
            labels = app["labels"]
            assert labels["traefik.enable"] == "true"
            assert labels["traefik.docker.network"] == f"{project}_default"
            assert labels[f"traefik.http.routers.{project}.rule"] == "Host(`controla.example.test`)"
            assert labels[f"traefik.http.services.{project}.loadbalancer.server.port"] == "3000"
            assert model["volumes"]["postgres_data"]["name"] == f"{project}_postgres_data"
        # Empty values must also be rejected, not silently replaced with dev defaults.
        for key in ("POSTGRES_PASSWORD", "CONTROLA_SECURITY_MASTER_KEY", "JWT_SECRET", "CONTROLA_HOST"):
            result = subprocess.run([*compose, "config", "--quiet"],
                                    env={**env, key: ""}, capture_output=True)
            assert result.returncode != 0, f"Missing {key} was accepted"
    print("Hostinger config passed: private credentials, required settings, routing, ports and project isolation")


if __name__ == "__main__":
    main()
