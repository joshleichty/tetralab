# How leading practitioners structure long-running, agent-driven projects

> Deep-research report, 2026-06-09. 102 agents, 20 sources, 25 claims put through 3-vote
> adversarial verification — 24 confirmed, 1 refuted. Focus: Peter Steinberger (OpenClaw),
> the Claude Code team (Boris Cherny), and Anthropic's long-horizon harness research,
> distilled into patterns for tetra (Tetris client + RL bot training, solo, evolving vision).

## TL;DR

The two best-documented practitioners land on opposite process styles but agree on one
thing: **the unit of long-running agent work is not a task list — it's a closed
verification loop plus externalized state.** Steinberger gets continuity through living
docs and conversation; Anthropic's research gets it through progress files, feature lists,
and fresh-session handoffs. Both say the highest-leverage move is making everything
checkable by the agent itself, headlessly. Your vision living in your head (or a stale
roadmap) is the failure mode; your vision living in short, rewritable artifacts that any
fresh agent can pick up is the goal.

## Peter Steinberger (OpenClaw)

Aggressively anti-process, and explicitly scoped to solo work:

- **Memory = global AGENTS.md + per-project `docs/` folder.** Docs for each
  subsystem/feature, with a script ([agent-scripts](https://github.com/steipete/agent-scripts),
  `docs-list.ts`) adding `summary`/`read_when` front matter so agents are forced to read
  the relevant doc before touching a topic. Pays off more the larger the project gets.
- **No issue tracker, no plan files.** Bugs get prompted the moment he finds one; new
  ideas get queued into the agent pipeline. Planning happens as *dialogue* — long
  back-and-forth with the agent ("let's discuss," "give me options"), challenge it, then
  kick off — not as documents. Vision evolution: "circling a mountain, not going straight
  up." Build, play with it, see how it feels, refine.
- **Main-only commits, no worktrees, never reverts** — if an agent does something wrong,
  ask it to fix it rather than rolling back. 5–10 agents run in parallel on *different
  features* while he stays in flow.
- **Verification replaces review.** "Whatever I wanna build, it starts as CLI. Agents can
  call it directly and verify output — closing the loop." Agents compile, lint, and test
  locally ("local CI beats remote CI"). 6,600+ commits in January 2026, mostly unread —
  he watches the stream, reserving his attention for architecture and
  database/business-logic code.

## The Claude Code team (Boris Cherny)

Caveat from verification: surviving claims trace to Anthropic's official docs and
engineering blog rather than Boris's personal interviews — this is the team's doctrine
more than his desk setup. More structured than Steinberger:

- **CLAUDE.md kept ruthlessly short** — loaded in full every session; bloated ones cause
  the agent to ignore instructions. Test for each line: "would removing this cause
  mistakes? If not, cut it." Everything else is retrieved just-in-time via glob/grep.
- **The single highest-leverage practice: give the agent a runnable pass/fail check**
  (test suite, build exit code, screenshot diff). Converts a session you watch into one
  you walk away from. Escalation ladder: in-prompt iteration → `/goal` conditions →
  Stop hooks → fresh-context verifier subagents so the worker isn't grading its own work.
- **For big features: interview → SPEC.md → fresh session.** The agent interviews *you*
  until the spec is complete (files, interfaces, out-of-scope, an end-to-end verification
  step), then executes in a brand-new session with clean context. This is also their
  mechanism for vision changes: rewrite the spec in dialogue, execute clean — don't steer
  a long, drifting context.
- **Parallelism via worktrees + Writer/Reviewer**: a fresh context reviews less biasedly
  than the one that wrote the code; an adversarial reviewer checks the diff against the
  plan before unattended work counts as done (limit findings to correctness/requirements —
  adversarial reviewers over-report).

## Anthropic's long-horizon harness research

The most relevant material for "agents pick up work and carry it toward a goal across
sessions":

1. **Compaction alone is not enough.** Agents need *external structured state*: each new
   session reads a progress file + git log, runs a smoke test, makes incremental
   progress, and leaves structured updates. An "initializer" agent sets this scaffolding
   up once; every later agent is "incremental."
2. **An immutable, machine-readable feature list** — JSON specifically, because agents
   are less likely to mangle JSON than Markdown — with instructions forbidding deletion,
   prevents agents from prematurely declaring the project done.
3. **Agents verify poorly end-to-end unless explicitly handed runtime tools** (browser
   automation, app harnesses) and told to use them; doing so "dramatically improved"
   bug-finding.
4. **Per-chunk "done" contracts**: before each chunk of work, generator and evaluator
   agree what done means — bridging a deliberately high-level vision to testable work
   without premature over-specification.

Refuted in verification (1–2 vote): the oft-repeated "three-agent
Planner/Generator/Evaluator with 10–16 feature specs and Playwright hard thresholds"
framing — only the generator/evaluator sprint-contract element held up. Also note the
context-reset finding was Sonnet-4.5-specific ("context anxiety") and matters less on
newer models.

## What this means for tetra

The project is unusually well-suited: RL training and headless Tetris simulation are
*natively* machine-checkable — reward curves, win rates, lines cleared.

1. **Keep CLAUDE.md tiny; put subsystem knowledge in `docs/`** — one doc each for the
   engine internals, the headless API, and the RL training design, with a one-line
   "read when" hint at the top of each. Makes a fresh agent useful in minute one.
2. **Make the RL phase CLI-first from day one.** `tetra-sim`-style commands: run N games
   headlessly, score a bot, dump training metrics. The single highest-leverage move per
   *both* camps — any agent can close its own loop without you watching.
3. **Externalize the chain state, not the task list.** A `PROGRESS.md` (append-style log
   of what was done/decided) plus a `features.json` of milestones with pass/fail status
   and a no-delete rule. Each new session starts: read progress + git log, run smoke
   test, pick up work. This — not task/subtask decomposition — is the validated mechanism
   for "agents picking up work toward a goal."
4. **Treat vision changes as spec rewrites, not course corrections.** When the RL
   approach shifts, run an interview session that rewrites a short SPEC.md, then execute
   in a fresh session. Don't drag an old context along.
5. **Stay main-only and low-process while solo** (Steinberger-validated); escalate to
   worktrees + a fresh-context reviewer only for genuinely parallel feature agents or
   unattended overnight runs — and gate those with a pass/fail check before counting
   them done.

## Open gap

Nobody's published material directly addresses workloads where the verification signal is
*slow and stochastic* (RL reward curves over hours) rather than a fast deterministic
test. Likely adaptation: cheap proxy checks (training runs 100 steps without NaN, bot
beats random baseline) as the agent-facing pass/fail, with real reward curves reserved
for human judgment.

## Caveats

- Boris Cherny's *personal* practices are represented only indirectly via official
  Anthropic docs; Simon Willison, Thorsten Ball, and Geoffrey Huntley were searched but
  no claims about them survived verification.
- Steinberger's workflow descriptions are self-reported (commit counts
  journalist-observed, not audited), evolve fast (Clawdbot → Moltbot → OpenClaw), and
  are explicitly scoped to solo work. "Ships code he doesn't read" excludes
  database/business-logic code, which he still reviews.
- Anthropic's harness results come from one experiment class (full-stack web app clones)
  and may generalize imperfectly to an RL training workload.

## Primary sources

- Steinberger, [Shipping at inference speed](https://steipete.me/posts/2025/shipping-at-inference-speed)
- Steinberger, [Just talk to it](https://steipete.me/posts/just-talk-to-it)
- Pragmatic Engineer, ["I ship code I don't read"](https://newsletter.pragmaticengineer.com/p/the-creator-of-clawd-i-ship-code)
- Anthropic, [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- Anthropic, [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Anthropic, [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Anthropic, [Harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- Steinberger, [agent-scripts repo](https://github.com/steipete/agent-scripts)
