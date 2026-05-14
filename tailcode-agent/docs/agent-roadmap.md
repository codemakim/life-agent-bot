# Agent Roadmap

Start with direct tool-to-Ollama access. Add the harness only after repeated
failure patterns are visible.

## Phase 1: Direct Remote Ollama

Use Tailscale or SSH tunneling so MacBook tools can call home Ollama directly.

Expected tools:

- OpenCode
- aider
- Continue
- curl or small local scripts

Expected model usage:

- Function-level implementation
- Test-case generation for one function
- Focused refactor suggestions
- Error explanation for a small failing test

## Phase 2: Prompt Discipline

Standardize the request shape before adding server code.

Every request should include:

- File path
- Function name
- Function signature
- Required behavior
- Input examples
- Output examples
- Constraints
- Nearby types or helper functions
- Desired output format

## Phase 3: Server-Side Agent

Add a small HTTP service only when direct usage shows repeated pain.

Possible responsibilities:

- Reject vague requests that are not function-scoped.
- Rewrite requests into the canonical function-task format.
- Inject stable system prompts.
- Route easy requests to a fast model and hard requests to `gemma4:26b`.
- Strip unsupported Markdown or extract only the requested code block.
- Run a second model pass for self-review.
- Store prompt, response, model, duration, and manual outcome notes.

## Phase 4: Tool Compatibility Endpoint

If OpenCode or another tool needs a standard API shape, expose an
OpenAI-compatible endpoint that proxies to Ollama after applying the harness.

Keep this narrow:

- Chat completions only at first.
- One configured coding model.
- No public internet exposure.
- Tailscale-only access.

## Non-Goals

- Do not build a full coding agent before direct remote Ollama has been tested.
- Do not expose local models to the public internet.
- Do not make the model edit large areas of a repository without human review.
