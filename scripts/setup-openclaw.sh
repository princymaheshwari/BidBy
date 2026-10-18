#!/usr/bin/env bash
# Registers BidBy's six OpenClaw agents, copies their playbooks from this repo
# into native WSL workspaces, applies openclaw/config.patch.json, and lists the
# Gateway's agent targets.
#
# Why copies: OpenClaw refuses symlinked bootstrap files, and workspaces on
# /mnt/c (the Windows drive) make every agent call ~10x slower. So workspaces
# live under OpenClaw's own workspace root, and repo edits reach the agents
# with a re-sync.
#
# Idempotent. Run it inside WSL, where OpenClaw and its Gateway live:
#   bash scripts/setup-openclaw.sh                    # full setup (briefly restarts the Gateway)
#   bash scripts/setup-openclaw.sh --force-restart    # same, from a non-interactive shell
#   bash scripts/setup-openclaw.sh --sync             # only copy playbooks + aid docs (no restart)
# See specs/01-openclaw-setup.md.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENTS=(extractor aid credit subs money_in coordinator)
PATCH="$REPO/openclaw/config.patch.json"
SYNC_ONLY=0
STOP_FLAGS=()
for arg in "$@"; do
  case "$arg" in
    --sync) SYNC_ONLY=1 ;;
    --force-restart) STOP_FLAGS=(--force) ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

die() { echo "setup-openclaw: $*" >&2; exit 1; }
command -v openclaw >/dev/null || die "openclaw is not on PATH. Run this in the WSL shell where OpenClaw is installed."
command -v node >/dev/null || die "node is not on PATH."

ROOT="$(openclaw config get agents.defaults.workspace)"
[ -n "$ROOT" ] || die "could not read agents.defaults.workspace from OpenClaw config"
workspace_dir() { echo "$ROOT/bidby-$1"; }

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

# Copies one agent's playbook (and aid's docs) from the repo into its workspace.
sync_agent() {
  local id="$1" ws
  ws="$(workspace_dir "$id")"
  mkdir -p "$ws"
  rm -f "$ws/AGENTS.md" "$ws/BOOTSTRAP.md"   # AGENTS.md may be an old symlink; BOOTSTRAP.md is the first-run ritual
  cp "$REPO/openclaw/agents/$id/AGENTS.md" "$ws/AGENTS.md"
  if [ "$id" = aid ]; then
    rm -rf "${ws:?}/docs"
    cp -r "$REPO/openclaw/agents/aid/docs" "$ws/docs"
    rm -f "$ws/docs/.gitkeep"
  fi
  echo "   $id: $ws"
}

# The shared Gateway token, read from the active config file. Never printed.
read_token() {
  node -e '
    const c = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const t = c && c.gateway && c.gateway.auth && c.gateway.auth.token;
    if (typeof t !== "string" || t === "") process.exit(2);
    process.stdout.write(t);' "$(openclaw config file)"
}

if [ "$SYNC_ONLY" = 1 ]; then
  echo "== sync playbooks"
  for id in "${AGENTS[@]}"; do sync_agent "$id"; done
  echo "   done; the next agent call reads the new playbooks"
  exit 0
fi

# --- 1. agents ---------------------------------------------------------------
echo "== 1/6 agents"
load_workspaces
RELOCATE=()
for id in "${AGENTS[@]}"; do
  ws="$(workspace_dir "$id")"
  if [ -z "${WS[$id]:-}" ]; then
    openclaw agents add "$id" --workspace "$ws" --non-interactive --json >/dev/null
    echo "   + $id"
  elif [ "${WS[$id]}" != "$ws" ]; then
    RELOCATE+=("$id")
    echo "   ~ $id (workspace moves to $ws)"
  else
    echo "   = $id"
  fi
done

# --- 2. playbooks --------------------------------------------------------------
echo "== 2/6 playbooks"
for id in "${AGENTS[@]}"; do sync_agent "$id"; done

# --- 3. config (needs the Gateway stopped) -------------------------------------
echo "== 3/6 config"
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

# --- 4. verify workspaces ------------------------------------------------------
echo "== 4/6 workspaces"
load_workspaces
for id in "${AGENTS[@]}"; do
  [ "${WS[$id]:-}" = "$(workspace_dir "$id")" ] || die "$id workspace is ${WS[$id]:-unset}, expected $(workspace_dir "$id")"
done
echo "   all six point at $ROOT/bidby-<id>"

# --- 5. agent targets ----------------------------------------------------------
echo "== 5/6 GET /v1/models"
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

# --- 6. .env token -------------------------------------------------------------
echo "== 6/6 .env"
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
