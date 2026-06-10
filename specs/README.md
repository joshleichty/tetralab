# Specs

One file per big task, produced by an interview session
("interview me about X, then write `specs/<name>.md`"), executed by fresh
sessions one milestone at a time. Each spec belongs to a work stream
(WORKSTREAMS.md) and says which at the top; its sessions log progress to
that stream's file in `progress/`.

A spec must be self-contained: a fresh agent executes it with no other
context. Shape:

- **Goal** — what this builds and why (one paragraph, tie to VISION.md)
- **Out of scope** — explicit non-goals
- **Design** — files, interfaces, key decisions from the interview
- **Milestones** — checklist; each item has its own pass/fail done-condition
- **Verification** — how to prove the whole thing works end-to-end

Rules:
- Vision shifts mid-task → rewrite the spec in a new interview; don't steer a
  long session.
- When a spec ships: promote durable knowledge to `docs/`, then archive or
  delete the spec. Specs are disposable; docs compound.
