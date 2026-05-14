# Tailcode Agent

Tailcode Agent is the working project for using a home Ollama machine as a
fallback coding model from a MacBook. The first version is intentionally small:
document the network setup, keep reusable function-task prompts, and leave a
clear path toward a server-side agent if direct Ollama access proves too raw.

## Goal

Use `gemma4:26b` on the home machine for tightly scoped coding work when Codex is
rate-limited or unavailable, especially function-level implementation tasks with
explicit inputs, outputs, and constraints.

## Current Architecture

```text
MacBook coding tool
  -> Tailscale or SSH tunnel
  -> Home Ollama
  -> gemma4:26b
```

The initial setup should keep Ollama off the public internet. Expose it only over
Tailscale or through an SSH tunnel.

## Future Architecture

```text
MacBook coding tool
  -> Tailscale or SSH tunnel
  -> Tailcode Agent server
  -> Ollama
  -> gemma4:26b
```

The agent can later add prompt normalization, function-task validation,
response cleanup, model routing, logging, and self-review passes.

## Project Contents

- `docs/setup-checklist.md`: first-pass MacBook to home Ollama setup.
- `docs/agent-roadmap.md`: when and how to add a server-side agent.
- `prompts/function-task.md`: reusable function-level coding request template.
- `configs/opencode-ollama.md`: notes for using OpenCode with the remote Ollama endpoint.

## Operating Principle

Do not ask the local model to act like a full Codex replacement at first. Give it
one function at a time, with a clear signature, examples, constraints, and nearby
context. Treat the output as a patch candidate that still needs review and tests.
