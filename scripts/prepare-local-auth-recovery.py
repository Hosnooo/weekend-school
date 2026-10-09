#!/usr/bin/env python3
"""Prepare *only* auth.users and auth.identities from a private CLI COPY backup.

The caller must already have created an isolated local Supabase database and
checked backup SHA256SUMS. Never connect to a database or echo user records.
Do not project away columns when the local managed Auth schema differs.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

COPY = re.compile(
    r'^COPY\s+(?:"?auth"?\.)("?[\w]+"?)\s*\(([^)]*)\)\s+FROM stdin;$'
)
WANTED = ("auth.users", "auth.identities")


def main() -> int:
    if len(sys.argv) != 4:
        print("ERROR: Auth-recovery fixture requires source, local schema and private output.", file=sys.stderr)
        return 2

    source, schema_file, output = map(Path, sys.argv[1:])
    if not source.is_file() or not schema_file.is_file() or output.exists():
        print("ERROR: Expected existing private sources and a new output path.", file=sys.stderr)
        return 2

    schema = json.loads(schema_file.read_text(encoding="utf-8"))
    selected: dict[str, list[str]] = {}
    counts: dict[str, int] = {}
    other_nonempty: set[str] = set()
    current: str | None = None
    lines: list[str] = []
    rows = 0

    def finish() -> None:
        nonlocal current, lines, rows
        if current is None:
            return
        if current in WANTED:
            if current in selected:
                raise ValueError("Duplicate Auth COPY block")
            selected[current] = lines[:]
            counts[current] = rows
        elif rows:
            other_nonempty.add(current)
        current, lines, rows = None, [], 0

    try:
        with source.open("r", encoding="utf-8") as dump:
            for raw in dump:
                line = raw.rstrip("\r\n")
                if current is not None:
                    lines.append(raw)
                    if line == r"\.":
                        finish()
                    else:
                        rows += 1
                    continue

                if not line.startswith("COPY "):
                    continue
                match = COPY.fullmatch(line)
                if not match:
                    # pg_dump data-only contains other schemas too.
                    continue
                table = "auth." + match.group(1).strip('"')
                if table not in WANTED:
                    current, lines, rows = table, [raw], 0
                    continue
                columns = [part.strip().strip('"') for part in match.group(2).split(",")]
                local_columns = schema.get(table)
                if not isinstance(local_columns, list) or not local_columns:
                    raise ValueError("Local Auth table is missing")
                if len(columns) != len(set(columns)) or not set(columns).issubset(set(local_columns)):
                    raise ValueError("Source Auth columns do not match local managed Auth schema")
                current, lines, rows = table, [raw], 0
        if current is not None:
            raise ValueError("Truncated Auth COPY data")
        if set(selected) != set(WANTED) or any(counts.get(table) != 6 for table in WANTED):
            raise ValueError("Auth user/identity blocks missing or counts differ from the verified six")

        # Import users before identities for the local GoTrue identity relation.
        with output.open("x", encoding="utf-8") as private:
            for table in WANTED:
                private.writelines(selected[table])
        output.chmod(0o600)
    except (OSError, ValueError, UnicodeError, json.JSONDecodeError):
        output.unlink(missing_ok=True)
        print("FAIL: Incompatible managed Auth COPY data; no partial Auth restore attempted.", file=sys.stderr)
        return 1

    print("PASS: Auth users/identities each contain 6 records and source columns are compatible.")
    if other_nonempty:
        print("LIMIT: Additional populated managed Auth tables exist in backup; full Auth recovery is NOT verified.")
    else:
        print("LIMIT: Session tokens and other managed Auth tables were not replayed; users must sign in anew.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
