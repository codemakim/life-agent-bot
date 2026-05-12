#!/usr/bin/env bash
set -euo pipefail

service_name="${SERVICE_NAME:-life-agent-bot}"
mode="user"

if [[ "${1:-}" == "--system" ]]; then
  mode="system"
elif [[ "${1:-}" == "--user" || "${1:-}" == "" ]]; then
  mode="user"
else
  echo "Usage: $0 [--user|--system]" >&2
  exit 1
fi

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
template="$repo_dir/deploy/life-agent-bot.service.template"
unit_file="$(mktemp)"

cleanup() {
  rm -f "$unit_file"
}
trap cleanup EXIT

if [[ ! -f "$repo_dir/.env" ]]; then
  echo "Missing .env in $repo_dir" >&2
  echo "Create it from .env.example before installing the service." >&2
  exit 1
fi

npm_bin="$(command -v npm)"
if [[ -z "$npm_bin" ]]; then
  echo "npm was not found in PATH." >&2
  exit 1
fi

node_bin="$(command -v node)"
if [[ -z "$node_bin" ]]; then
  echo "node was not found in PATH." >&2
  exit 1
fi
node_dir="$(dirname "$node_bin")"

if [[ ! -f "$template" ]]; then
  echo "Missing service template: $template" >&2
  exit 1
fi

user_line=""
if [[ "$mode" == "system" ]]; then
  user_line="User=$USER"
fi

install_target="default.target"
if [[ "$mode" == "system" ]]; then
  install_target="multi-user.target"
fi

sed \
  -e "s|{{USER_LINE}}|$user_line|g" \
  -e "s|{{WORKING_DIRECTORY}}|$repo_dir|g" \
  -e "s|{{NPM_BIN}}|$npm_bin|g" \
  -e "s|{{NODE_DIR}}|$node_dir|g" \
  -e "s|{{INSTALL_TARGET}}|$install_target|g" \
  "$template" > "$unit_file"

npm run build

if [[ "$mode" == "user" ]]; then
  unit_dir="$HOME/.config/systemd/user"
  mkdir -p "$unit_dir"
  install -m 0644 "$unit_file" "$unit_dir/$service_name.service"
  systemctl --user daemon-reload
  systemctl --user disable "$service_name" >/dev/null 2>&1 || true
  systemctl --user enable "$service_name"
  systemctl --user restart "$service_name"
  systemctl --user status "$service_name" --no-pager
else
  sudo install -m 0644 "$unit_file" "/etc/systemd/system/$service_name.service"
  sudo systemctl daemon-reload
  sudo systemctl enable "$service_name"
  sudo systemctl restart "$service_name"
  sudo systemctl status "$service_name" --no-pager
fi
