#!/usr/bin/env bash
# Registers BidBy's six OpenClaw agents with their workspaces in this repo
# (openclaw/agents/<id>/, so AGENTS.md edits reach the live agent), applies
# openclaw/config.patch.json, and lists the Gateway's agent targets.
# OpenClaw refuses symlinked bootstrap files, which is why the workspace is the repo folder itself.
# Idempotent. Run it inside WSL, where OpenClaw and its Gateway live:
#   bash scripts/setup-openclaw.sh                    # interactive shell
#   bash scripts/setup-openclaw.sh --force-restart    # non-interactive: lets OpenClaw stop its own service
# Applying the config briefly stops and restarts the Gateway.
# See specs/01-openclaw-setup.md.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTS=(extractor aid credit subs money_in coordinator)
PATCH="$REPO/openclaw/config.patch.json"
STOP_FLAGS=()
[ "${1:-}" = "--force-restart" ] && STOP_FLAGS=(--force)

die() { echo "setup-openclaw: $*" >&2; exit 1; }
command -v openclaw >/dev/null || die "openclaw is not on PATH. Run this in the WSL shell where OpenClaw is installed."
command -v node >/dev/null || die "node is not on PATH."

workspace_dir() { echo "$REPO/openclaw/agents/$1"; }

# Prints "<id>\t<workspace>" for every agent, from OpenClaw's own agent list.
list_workspaces() {
  openclaw agents list --json | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      for (const a of JSON.parse(s)) console.log(`${a.id}\t${a.workspace}`);
    });'
}

declare -A WS
load_workspaces() {
  WS=()
  while IFS=$'\t' read -r id ws; do WS["$id"]="$ws"; done < <(list_workspaces)
}

# The shared Gateway token, read from the active config file. Never printed.
read_token() {
  node -e '
    const c = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const t = c && c.gateway && c.gateway.auth && c.gateway.auth.token;
    if (typeof t !== "string" || t === "") process.exit(2);
    process.stdout.write(t);' "$(openclaw config file)"
}

# --- 1. agents ---------------------------------------------------------------
echo "== 1/5 agents"
load_workspaces
RELOCATE=()
for id in "${AGENTS[@]}"; do
  ws="$(workspace_dir "$id")"
  [ -f "$ws/AGENTS.md" ] || die "missing playbook $ws/AGENTS.md"
  # An empty .git keeps OpenClaw from running `git init` inside this repo folder.
  mkdir -p "$ws/.git"
  if [ -z "${WS[$id]:-}" ]; then
    openclaw agents add "$id" --workspace "$ws" --non-interactive --json >/dev/null
    echo "   + $id"
  elif [ "${WS[$id]}" != "$ws" ]; then
    RELOCATE+=("$id")
    echo "   ~ $id (workspace moves to the repo)"
  else
    echo "   = $id"
  fi
done

# --- 2. config (needs the Gateway stopped) -------------------------------------
echo "== 2/5 config"
port="$(openclaw config get gateway.port)"
# Exit 0 if something accepts TCP connections on the Gateway port.
gateway_up() {
  node -e '
    const s = require("net").connect(Number(process.argv[1]), "127.0.0.1");
    s.on("connect", () => process.exit(0)).on("error", () => process.exit(1));' "$port"
}
openclaw gateway stop "${STOP_FLAGS[@]}" || true
for _ in $(seq 1 15); do gateway_up || break; sleep 1; done
gateway_up && die "the Gateway is still running, so the config was not applied. Rerun from an interactive WSL shell, or with --force-restart."
trap 'echo "   restarting Gateway after failure" >&2; openclaw gateway start >/dev/null || true' EXIT
for id in "${RELOCATE[@]}"; do
  openclaw config set "agents.entries.$id.workspace" "$(node -p 'JSON.stringify(process.argv[1])' "$(workspace_dir "$id")")" --strict-json >/dev/null
  echo "   $id workspace -> $(workspace_dir "$id")"
done
openclaw config patch --file "$PATCH" --dry-run >/dev/null || die "config patch dry run failed: $PATCH"
openclaw config patch --file "$PATCH" >/dev/null
trap - EXIT
openclaw gateway start >/dev/null
echo "   applied $PATCH"

# --- 3. verify workspaces ------------------------------------------------------
echo "== 3/5 workspaces"
load_workspaces
for id in "${AGENTS[@]}"; do
  [ "${WS[$id]:-}" = "$(workspace_dir "$id")" ] || die "$id workspace is ${WS[$id]:-unset}, expected $(workspace_dir "$id")"
  # BOOTSTRAP.md is OpenClaw's first-run ritual; it would derail structured tool calls.
  rm -f "$(workspace_dir "$id")/BOOTSTRAP.md"
  echo "   $id: $(workspace_dir "$id")"
done

# --- 4. agent targets ----------------------------------------------------------
echo "== 4/5 GET /v1/models"
token="$(read_token)" || die "gateway.auth.token is not a plain string in OpenClaw config"
BIDBY_GW_TOKEN="$token" BIDBY_GW_URL="http://127.0.0.1:$port/v1/models" BIDBY_AGENTS="${AGENTS[*]}" node -e '
  const url = process.env.BIDBY_GW_URL;
  const headers = { Authorization: `Bearer ${process.env.BIDBY_GW_TOKEN}` };
  (async () => {
    let res;
    for (let i = 0; i < 30; i++) {
      try { res = await fetch(url, { headers }); if (res.ok) break; } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!res || !res.ok) { console.error(`   Gateway did not answer ${url} (HTTP ${res ? res.status : "none"})`); process.exit(1); }
    const ids = (await res.json()).data.map((m) => m.id);
    console.log(ids.map((id) => `   ${id}`).join("\n"));
    const missing = process.env.BIDBY_AGENTS.split(" ").filter((a) => !ids.includes(`openclaw/${a}`));
    if (missing.length) { console.error(`   missing targets: ${missing.join(", ")}`); process.exit(1); }
    console.log("   all six BidBy agents are listed");
  })();'

# --- 5. .env token -------------------------------------------------------------
echo "== 5/5 .env"
env_file="$REPO/.env"
if [ ! -f "$env_file" ]; then
  echo "   no .env yet: copy .env.example to .env, then rerun to fill OPENCLAW_GATEWAY_TOKEN"
elif grep -qE '^OPENCLAW_GATEWAY_TOKEN=[[:space:]]*(#.*)?$' "$env_file"; then
  BIDBY_GW_TOKEN="$token" node -e '
    const fs = require("fs"), f = process.argv[1];
    const out = fs.readFileSync(f, "utf8")
      .replace(/^OPENCLAW_GATEWAY_TOKEN=.*$/m, `OPENCLAW_GATEWAY_TOKEN=${process.env.BIDBY_GW_TOKEN}`);
    fs.writeFileSync(f, out);' "$env_file"
  echo "   filled OPENCLAW_GATEWAY_TOKEN in .env (value not shown)"
else
  echo "   OPENCLAW_GATEWAY_TOKEN already set in .env (left unchanged)"
fi
