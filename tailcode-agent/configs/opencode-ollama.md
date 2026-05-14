# OpenCode With Remote Ollama

Use OpenCode as a fallback coding worker when Codex is rate-limited. Keep the
task scope narrow and function-level.

## Endpoint Choices

Direct Tailscale endpoint:

```text
http://home-machine:11434
http://home-machine:11434/v1
```

SSH tunnel endpoint:

```text
http://127.0.0.1:11434
http://127.0.0.1:11434/v1
```

Use the `/v1` endpoint when a tool expects an OpenAI-compatible API.

## Working Style

OpenCode should be treated as a function implementation worker, not as an
unbounded repo agent.

Start prompts with:

```text
Work only on the function described below.
Do not make broad repository changes.
If you need surrounding context, ask for it or inspect only the named file.
If you edit files, keep changes limited to the named function and its direct tests.
```

Then paste the function task from `../prompts/function-task.md`.

## Verification

After any OpenCode-assisted change:

```bash
git diff
npm test
npm run build
```

Use the commands that match the target repository. Do not treat a local model
answer as complete until the relevant tests and type checks pass.
