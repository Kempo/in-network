# Review PR

## When to Use

- Reviewing local changes or a PR branch before submission.
- Code review requested by a teammate.

## Required Inputs

- Branch name or diff to review

## Workflow

The review runs in six phases. Phases 2 and 4 launch the same five subagents in parallel; phases 3 and 5 apply fixes; phase 6 runs all linters.

### Phase 1 — Gather the diff

```bash
git diff main...HEAD          # all changes vs main
git diff --stat main...HEAD   # file-level summary
git log --oneline main..HEAD  # commit history
```

Note the list of touched files and the diff scope. Both will be passed into every subagent.

### Phase 2 — Parallel subagent review (Pass 1)

Launch all five subagents in a **single message** using the `Task` tool with `subagent_type: "explore"` so they run concurrently. Use the prompts in the [Subagent Prompts](#subagent-prompts) appendix verbatim, substituting the diff scope and touched-file list at the top.

The five subagents:

1. `code-quality` — Compliance with `CLAUDE.md` chain plus the in-skill review criteria:
- Is decomposition high quality? Any bloated components or function that should be broken up?
- Any opportunities for better code sharing?
- Any opportunities for cleaner or simpler solutions that still lean into good patterns in the codebase?
- Any preemptive defensive programming?
2. `react-effects` — Unnecessary `useEffect` calls.
3. `useless-functions` — Unused, dead, or trivially-extracted helpers that should be inlined.
4. `module-size` — Files at or over 700 lines, with a concrete decomposition proposal.
5. `duplication` — New code that duplicates an existing utility or pattern.

Every subagent must return findings as: `file path`, `line range`, `severity` (Blocker / Suggestion / Question), and a `concrete suggested fix`.

### Phase 3 — Apply fixes (Pass 1)

Aggregate all subagent findings, dedupe overlaps, then make edits. Skip Questions until clarified by the author. Keep edits scoped to the items each subagent surfaced; do not refactor unrelated code.

### Phase 4 — Parallel subagent review (Pass 2)

Re-launch the same five subagents on the post-fix diff, again in a single message. The goal is to catch issues introduced by the fixes themselves and any items the first pass missed.

### Phase 5 — Apply fixes (Pass 2)

Apply the new findings the same way. **Do not loop further** — the cap is two subagent passes total.

### Phase 6 — Run all linters

From the repo root:

```bash
./format.sh
cd typescript && pnpm typecheck
```

`./format.sh` runs `ruff format`, `ruff check --fix`, and `pnpm format`. Fix any errors surfaced by typecheck before reporting.

## Output

Make edits that improve the code, then produce this summary:

```markdown
## Review Summary

### Blockers
- ...

### Suggestions
- ...

### Questions
- ...

### Subagent Findings (Pass 1 / Pass 2)
- code-quality: <count> findings, <count> fixed
- react-effects: <count> findings, <count> fixed
- useless-functions: <count> findings, <count> fixed
- module-size: <count> findings, <count> fixed
- duplication: <count> findings, <count> fixed

### Validation
- [ ] Subagent Pass 1 complete
- [ ] Pass 1 fixes applied
- [ ] Subagent Pass 2 complete
- [ ] Pass 2 fixes applied
- [ ] `./format.sh` clean
- [ ] `pnpm typecheck` clean
- [ ] No obvious regressions
```

Also call out any of the following if present in the diff:

- New environment variables or secrets
- Database migration needed
- Breaking API changes
- New dependencies

## Guardrails

- **Launch all five subagents in a single message** for true parallelism. Sequential calls defeat the purpose.
- **Two subagent passes only.** Do not loop further even if Pass 2 surfaces new findings; record them as follow-ups instead.
- The 700-line module threshold is a **flag-and-discuss trigger**, not an automatic split. Propose a decomposition; do not silently shard a module without buy-in.
- Do not modify code unrelated to subagent findings.
- Do not skip phase 6 — linters run after the second fix pass, not before.

## Subagent Prompts

Paste these verbatim into each `Task` call. Each prompt is self-contained so a fresh subagent does not need to re-derive the criteria from other files.

### `code-quality`

```text
You are reviewing a PR diff for code quality. Diff scope: <paste git diff main...HEAD output or file list>.

Audit every changed file against TWO sources of truth:

(1) The repo's CLAUDE.md chain:
- Root: CLAUDE.md (general coding rules, architecture and domain rules, data and contract rules)
- Language scopes: typescript/CLAUDE.md, python/CLAUDE.md
- Nearest scoped CLAUDE.md to each touched file (e.g. typescript/server/src/services/CLAUDE.md, typescript/server/src/controllers/CLAUDE.md, typescript/frontend/CLAUDE.md, typescript/frontend/app/components/CLAUDE.md, typescript/shared/src/dtos/CLAUDE.md)

Read the relevant CLAUDE.md files first. Common violations to flag:
- Domain ownership: logic placed in an orchestrating service that belongs in a domain service
- Command/query mixing: read-looking functions that mutate state (e.g. getOrCreateX)
- IO hidden in low-level helpers, mappers, or formatters
- Loose Record<string, unknown> or dict[str, Any] payloads at boundaries that should be named typed contracts
- Vague names like process, handle, resolve; missing get/find distinction; map names not joined by "to"
- Raw string statuses where a const-backed value set is expected
- Quiet None/null fallbacks where a typed error should be raised
- Missing or weak normalization/validation of external (LLM, webhook, user, third-party) input
- Default arguments added to low-level functions instead of at the policy layer
- Aliased imports (`import { X as Y }`) without a real naming conflict
- Indexed access types where a named type should exist

(2) The review criteria documented in this skill (review-pr/SKILL.md), which are NOT all duplicated in CLAUDE.md:
- Correctness — does the logic do what it claims?
- Regression risk — could this break existing behavior?
- Missing tests — is changed behavior covered?
- Type safety — are types specific and correct?
- Security / data handling — secrets exposure, SQL injection, XSS, auth bypasses
- DX — naming clarity, function size, unnecessary complexity
- Style and maintainability — preemptive defensive programming, concise high-information-density docstrings, whether ARCHITECTURE.md needs updating, opportunities for cleaner/simpler solutions that lean into existing patterns

Do NOT flag:
- Module size or decomposition concerns (handled by the `module-size` subagent)
- Reuse / duplication concerns (handled by the `duplication` subagent)
- Unnecessary React effects (handled by the `react-effects` subagent)
- Useless or dead functions (handled by the `useless-functions` subagent)

For each finding return: file path, line range, severity (Blocker / Suggestion / Question), the rule or criterion violated, and a concrete suggested fix.
```

### `react-effects`

```text
You are reviewing a PR diff for unnecessary React effects. Diff scope: <paste diff or file list>.

Read every changed .tsx and .ts file that contains React components or hooks. For each useEffect, decide whether it is justified or whether it falls into one of the "you might not need an effect" anti-patterns from https://react.dev/learn/you-might-not-need-an-effect:

- Effect that computes derived state from props/state — should be a plain calculation during render
- Effect that caches an expensive computation — should be useMemo
- Effect that resets state when a prop changes — should be a key on the component or a derived value
- Effect that updates state when a prop changes — should be derived during render
- Effect that runs on a user event — should be in the event handler instead
- Effect that fetches data — should usually use the project's data-fetching pattern (React Router loader, React Query, etc.) instead of a hand-rolled effect
- Effect that subscribes to an external store — should be useSyncExternalStore
- Chained effects that update each other — should be a single calculation or one event handler

Also flag:
- Missing or unnecessary dependencies in the dependency array
- Effects that mutate refs or DOM during render
- Effects whose cleanup is missing or wrong

For each finding return: file path, line range, severity (Blocker / Suggestion / Question), which anti-pattern it matches, and the concrete refactor (the actual replacement code shape, not just a label).
```

### `useless-functions`

```text
You are reviewing a PR diff for useless, unused, or over-extracted functions. Diff scope: <paste diff or file list>.

For every newly added or touched function, method, hook, or helper:

1. Search the codebase to confirm it is actually called. Flag any unused exports or unused private helpers.
2. If called from exactly one site, evaluate whether the extraction earns its name. Per CLAUDE.md: "Do not extract a helper function only because a few lines can be named. If a helper is only used once, has a tiny body, and makes the reader jump away from straightforward logic, prefer keeping the logic inline."
3. Flag one-off map helpers that only reorganize fields without applying domain logic or normalization. These should be inlined at the call site.
4. Flag thin pass-through wrappers that add no behavior over the function they delegate to.
5. Flag dead code paths — branches that can never be reached given the type signatures or upstream guards.

Do NOT flag:
- Helpers that are reused across multiple call sites
- Helpers that capture meaningful domain behavior, isolate complexity, or give the code a useful test surface
- Helpers added specifically to satisfy command/query separation or domain ownership rules

For each finding return: file path, line range, severity (Blocker / Suggestion / Question), why the function does not earn its keep, and the concrete fix (inline at call site / delete / merge with sibling).
```

### `module-size`

```text
You are reviewing a PR diff for oversized modules. Diff scope: <paste diff or file list>.

For every file touched in the diff, run `wc -l <file>` to get its current line count.

Flag any file where the post-diff line count is at or over 700 lines. The 700-line threshold is a flag-and-discuss trigger, NOT an automatic split — but every flagged file MUST come with a concrete decomposition proposal that names:
- Which responsibilities live in the file today
- Which responsibilities should move out, and into which new file
- What the new file's name and location should be (matching existing repo conventions)
- Whether any types, helpers, or constants need to move along with the responsibility

Also flag, as Suggestions:
- Files that grew by more than 200 lines in this diff even if still under 700
- Functions or methods longer than ~80 lines that mix multiple responsibilities
- React components longer than ~200 lines that should be split into subcomponents

Do NOT propose splits that would create circular imports or cross domain ownership boundaries (consult the nearest CLAUDE.md to confirm).

For each finding return: file path, current line count, severity (Blocker / Suggestion / Question), and the decomposition proposal.
```

### `duplication`

```text
You are reviewing a PR diff for reuse and duplication opportunities. Diff scope: <paste diff or file list>.

For every newly added function, type, hook, service, helper, or pattern in the diff, search the monorepo for an existing equivalent. Use grep, glob, and semantic search across:
- typescript/server/src
- typescript/frontend/app
- typescript/shared/src
- python/packages

Per CLAUDE.md: "Before adding a new type, service, helper, endpoint, or workflow, search for an equivalent or similar implementation. Reuse the existing implementation when it represents the same concept. If reuse is awkward because the existing code lives in the wrong layer or module, refactor or move it instead of duplicating the behavior."

Specifically check:
- New DTOs that duplicate an existing DTO in typescript/shared/src/dtos
- New Python types that duplicate an existing DTO that should be derived via the JSON schema pipeline (per python/CLAUDE.md)
- New enums or value sets that duplicate an existing const-backed value set
- New helpers that duplicate an existing utility under a slightly different name
- New service methods that re-implement logic that already lives in another service

For each finding return: file path, line range of the new code, severity (Blocker / Suggestion / Question), the file path and line range of the existing equivalent, and a concrete recommendation (reuse directly / refactor existing into a shared location and reuse / consolidate into the existing implementation).
```