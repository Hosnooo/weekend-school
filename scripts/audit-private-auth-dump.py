#!/usr/bin/env python3
"""Offline, read-only inventory of managed Auth COPY blocks in a private SQL dump.

Never displays record values, credentials, identifiers, or token contents.
Never writes any files or connects to any database.
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

HEADER = re.compile(r'^COPY\s+(?:"?auth"?\.)("?[\w]+"?)\s*\([^)]*\)\s+FROM stdin;$')
SENSITIVE = {
    "users", "identities", "sessions", "refresh_tokens", "flow_state",
    "one_time_tokens", "mfa_factors", "mfa_challenges", "mfa_amr_claims",
    "mfa_recovery_code_sets", "mfa_recovery_codes", "audit_log_entries",
    "schema_migrations", "sso_providers", "oauth_clients", "webauthn_credentials"
}

def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/audit-private-auth-dump.py /private/path/data.sql", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    if not path.is_file():
        print("FAIL: Private dump not found.", file=sys.stderr)
        return 2
    counts: dict[str, int] = {}
    current: str | None = None
    rows = 0
    try:
        with path.open(encoding="utf-8") as handle:
            for raw in handle:
                line = raw.rstrip("\r\n")
                if current is not None:
                    if line == r"\.":
                        if current in counts:
                            raise ValueError("Duplicate Auth table COPY")
                        counts[current] = rows
                        current, rows = None, 0
                    else:
                        rows += 1
                    continue
                if not line.startswith("COPY "):
                    continue
                match = HEADER.fullmatch(line)
                if match:
                    current = match.group(1).strip('"')
                    rows = 0
        if current is not None:
            raise ValueError("Unterminated COPY block")
    except (OSError, ValueError, UnicodeError):
        print("FAIL: Private Auth dump cannot be safely inventoried.", file=sys.stderr)
        return 1

    print("Private Auth dump inventory — aggregate COPY row counts only")
    for table in sorted(set(counts) | SENSITIVE):
        state = str(counts[table]) if table in counts else "not present in dump"
        print(f"auth.{table}: {state}")

    if counts.get("users") != 6 or counts.get("identities") != 6:
        print("FAIL: User/identity counts differ from previously verified backup.", file=sys.stderr)
        return 1
    print("PASS: Six Auth users and six Auth identities are present.")
    print("LIMIT: Inclusion and counts do not demonstrate restore compatibility, usable sessions, or complete disaster recovery.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
