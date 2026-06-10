python3 - <<'PY'
from pathlib import Path
import re

p = Path("apps/breason/app/api/resonance-trends/route.ts")
s = p.read_text()

# 1) Fix tuple type for replacements: allow string OR replacement function.
s = s.replace(
    "const TRANSLATION_REPLACEMENTS: Array<[RegExp, string]> = [",
    "const TRANSLATION_REPLACEMENTS: Array<[RegExp, string | ((substring: string, ...args: string[]) => string)]> = ["
)

# In case the constant has another name but same wrong type.
s = re.sub(
    r":\s*Array<\[RegExp,\s*string\]>\s*=\s*\[",
    ": Array<[RegExp, string | ((substring: string, ...args: string[]) => string)]> = [",
    s,
    count=1
)

# 2) Next route files must not export arbitrary helpers/types/constants.
# Keep only valid Next route exports.
allowed = {
    "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
    "runtime", "dynamic", "revalidate", "fetchCache", "preferredRegion",
    "maxDuration", "config", "generateStaticParams",
}

def unexport_invalid(match: re.Match) -> str:
    kind = match.group(1)
    name = match.group(2)
    if name in allowed:
        return match.group(0)
    return f"{kind} {name}"

patterns = [
    r"export\s+(async\s+function)\s+([A-Za-z0-9_]+)",
    r"export\s+(function)\s+([A-Za-z0-9_]+)",
    r"export\s+(const)\s+([A-Za-z0-9_]+)",
    r"export\s+(let)\s+([A-Za-z0-9_]+)",
    r"export\s+(var)\s+([A-Za-z0-9_]+)",
    r"export\s+(class)\s+([A-Za-z0-9_]+)",
    r"export\s+(type)\s+([A-Za-z0-9_]+)",
    r"export\s+(interface)\s+([A-Za-z0-9_]+)",
]

for pat in patterns:
    s = re.sub(pat, unexport_invalid, s)

p.write_text(s)
PY

rm -rf apps/breason/.next .next
npm run type-check