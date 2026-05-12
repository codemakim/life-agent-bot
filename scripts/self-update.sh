#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <telegram-chat-id>" >&2
  exit 2
fi

chat_id="$1"
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
update_ready_path="$repo_dir/.update-ready"

cd "$repo_dir"

before_branch="$(git branch --show-current 2>/dev/null || true)"

if [[ "${LIFE_AGENT_SKIP_GIT_PULL:-false}" != "true" ]]; then
  git pull --ff-only
fi

install_output="$(mktemp)"
build_output="$(mktemp)"

cleanup() {
  rm -f "$install_output" "$build_output"
}
trap cleanup EXIT

npm install --include=dev >"$install_output" 2>&1
npm run build >"$build_output" 2>&1

after_branch="$(git branch --show-current 2>/dev/null || true)"
after_commit="$(git rev-parse --short HEAD 2>/dev/null || true)"
branch="${after_branch:-${before_branch:-unknown}}"
commit="${after_commit:-unknown}"

{
  echo "LIFE_AGENT_UPDATE_READY"
  echo "chatId=$chat_id"
  echo "branch=$branch"
  echo "commit=$commit"
} > "$update_ready_path"

cat <<EOF
업데이트 완료. 프로세스를 재시작합니다.
재시작이 끝나면 이 채팅으로 준비 완료 메시지를 보냅니다.

Branch: $branch
Commit: $commit

npm install:
$(tail -c 1200 "$install_output")

npm run build:
$(tail -c 1200 "$build_output")
EOF
