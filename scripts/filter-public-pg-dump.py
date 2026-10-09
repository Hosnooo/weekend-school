#!/usr/bin/env python3
"""Extract public-schema COPY blocks from an existing Supabase --use-copy data dump.

The original dump is never modified. pg_dump --data-only includes managed auth/
storage tables, while Supabase CLI's schema dump excludes managed schemas. Those
two dump scopes cannot be loaded indiscriminately into a fresh local Supabase
instance, whose managed Auth schema may have a different version.

The output is a PRIVATE local fixture for public-data migration parity ONLY;
it is not a replacement for a full disaster recovery backup or Auth restore.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

COPY = re.compile(r'^COPY\s+(?:"public"|public)\.(?:"([^"]+)"|([A-Za-z_]\w*))\s*\(')
SETVAL = re.compile(r"""^SELECT\s+pg_catalog\.setval\('(?:"?public"?\.)""")
REQUIRED = {
    "report_batches",
    "report_section_approvals",
    "report_student_overrides",
    "reports",
    "weekly_submission_students",
    "weekly_submissions",
}


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: filter-public-pg-dump.py SOURCE_data.sql PRIVATE_OUTPUT.sql", file=sys.stderr)
        return 2

    source, target = map(Path, sys.argv[1:])
    if source.resolve() == target.resolve():
        print("ERROR: Refusing to overwrite original database dump.", file=sys.stderr)
        return 2
    if not source.is_file() or target.exists():
        print("ERROR: Source missing or output already exists.", file=sys.stderr)
        return 2

    tables: set[str] = set()
    copy_mode = False
    keep = False
    public_copy_count = 0
    managed_copy_count = 0

    try:
        with source.open("r", encoding="utf-8", errors="strict") as reader, target.open("x", encoding="utf-8") as writer:
            writer.write("-- PRIVATE filtered public-only COPY fixture; source backup unchanged.\n")
            for line in reader:
                if copy_mode:
                    if keep:
                        writer.write(line)
                    if line.rstrip("\r\n") == r"\.":
                        copy_mode = False
                        keep = False
                    continue

                if line.startswith("COPY "):
                    match = COPY.match(line)
                    copy_mode = True
                    keep = match is not None
                    if keep:
                        tables.add(match.group(1) or match.group(2))
                        public_copy_count += 1
                        writer.write(line)
                    else:
                        managed_copy_count += 1
                    continue

                if line.startswith("SELECT pg_catalog.setval("):
                    if SETVAL.match(line):
                        writer.write(line)
                    continue

                # The backup was generated with --use-copy. Do not silently
                # discard potential INSERT-based public data in another format.
                if line.startswith(("INSERT INTO ", "UPDATE ", "DELETE FROM ")):
                    raise ValueError("Unexpected non-COPY DML in data export")

            if copy_mode:
                raise ValueError("Truncated COPY section in database export")
            if not REQUIRED.issubset(tables):
                raise ValueError("Essential public report tables absent from COPY export")
    except Exception:
        target.unlink(missing_ok=True)
        print("ERROR: Data dump could not be safely filtered; originals unchanged.", file=sys.stderr)
        return 1

    print(
        f"Private public-data fixture prepared: {public_copy_count} public tables; "
        f"{managed_copy_count} Supabase-managed/other table blocks excluded.",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
