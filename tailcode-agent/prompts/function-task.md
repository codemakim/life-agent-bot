# Function Task Prompt

Use this when asking `gemma4:26b` to implement or modify one function.

```text
You are helping with one narrowly scoped coding task.

Implement or modify exactly one function.
Do not redesign the module.
Do not change unrelated code.
Do not add dependencies.
If the requirements are insufficient, ask for the missing details instead of guessing.

File:
<path>

Function:
<name>

Signature:
<signature>

Purpose:
<what this function must do>

Inputs:
- <input shape or example>

Outputs:
- <output shape or example>

Behavior:
- <rule 1>
- <rule 2>
- <rule 3>

Constraints:
- <language/runtime constraints>
- <style constraints>
- <dependency constraints>
- <error-handling constraints>

Nearby context:
```<language>
<types, constants, helper functions, or existing code needed to implement this function>
```

Return format:
- Return only the final code for this function.
- Do not include explanations unless explicitly asked.
```

## Review Prompt

Use this after receiving a candidate implementation.

```text
Review this function against the original contract.

Look only for:
- incorrect behavior
- missing edge cases
- type errors
- hidden assumptions
- unnecessary scope creep

Original contract:
<paste contract>

Candidate implementation:
```<language>
<paste implementation>
```

Return:
- PASS if it satisfies the contract
- otherwise, list the smallest required corrections
```
