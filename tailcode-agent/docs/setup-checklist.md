# Setup Checklist

This checklist is for connecting a MacBook coding tool to Ollama running on the
home machine.

## Home Machine

1. Install and log in to Tailscale.
2. Confirm the model exists:

   ```bash
   ollama list
   ```

3. Make Ollama reachable from the tailnet.

   For a one-off test:

   ```bash
   OLLAMA_HOST=0.0.0.0:11434 ollama serve
   ```

   For a persistent setup, add `OLLAMA_HOST=0.0.0.0:11434` to the service
   environment used by Ollama on the home machine.

4. Do not port-forward `11434` from the router.
5. Prefer a firewall rule that allows `11434` only from the Tailscale interface.

## MacBook

1. Install and log in to Tailscale.
2. Find the home machine name or tailnet IP:

   ```bash
   tailscale status
   ```

3. Test Ollama tags:

   ```bash
   curl http://home-machine:11434/api/tags
   ```

4. If a tool requires an OpenAI-compatible endpoint, use:

   ```text
   http://home-machine:11434/v1
   ```

5. If avoiding direct tailnet exposure, use an SSH tunnel instead:

   ```bash
   ssh -N -L 11434:localhost:11434 home-machine
   ```

   Then point tools at:

   ```text
   http://127.0.0.1:11434
   http://127.0.0.1:11434/v1
   ```

## Success Criteria

- MacBook can run `curl http://home-machine:11434/api/tags`.
- A coding tool can select or call `gemma4:26b`.
- Ollama is not exposed to the public internet.
- Function-level prompts produce usable code candidates.
