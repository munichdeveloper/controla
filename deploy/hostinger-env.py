#!/usr/bin/env python3
"""Create a private environment file for a NEW Hostinger installation only."""
import argparse
import os
import re
import secrets
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("hostname", help="Public DNS hostname, without https:// or a path")
    parser.add_argument("--output", default=".env.hostinger")
    parser.add_argument("--project", default="controla")
    args = parser.parse_args()
    hostname = args.hostname.lower()
    label = r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
    if len(hostname) > 253 or not re.fullmatch(rf"{label}(?:\.{label})+", hostname):
        parser.error("Provide a valid DNS hostname without scheme, port or path")
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", args.project):
        parser.error("Project must use lowercase letters, digits, dashes or underscores")
    values = {"CONTROLA_HOST": hostname, "COMPOSE_PROJECT_NAME": args.project,
              "POSTGRES_PASSWORD": secrets.token_hex(32),
              "CONTROLA_SECURITY_MASTER_KEY": secrets.token_hex(32),
              "JWT_SECRET": secrets.token_hex(32)}
    # Exclusive creation: never rotate keys or replace an existing installation.
    try:
        fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        parser.error("Output already exists; preserve the existing credentials")
    with os.fdopen(fd, "w", newline="\n") as stream:
        stream.write("".join(f"{key}={value}\n" for key, value in values.items()))
    print(f"Created {Path(args.output).name}; keep it private and back it up with the database.")


if __name__ == "__main__":
    main()
