# Spec 05 — F3: Head start

**Time box:** 45 min · **Depends on:** 04 · **Design refs:** SYSTEM_DESIGN §3 (use cases), §9.2 (`write_head_start`), §10 flow C

## Goal

Before BidBy interrupts the user about an item, the item's domain agent has already done the first step: a checklist, the relevant local files found, a drafted message, and (when money is short or aid is at risk) the school resource that helps. Build **one playbook deeply** (verification); the others stay shallow.

## Build

1. **Local documents** in `openclaw/agents/aid/docs/` (fake but realistic; no real personal data):
   - `resume.pdf` or `.md`, `2025_tax_return_transcript_PLACEHOLDER.md`, `verification_worksheet_v1_blank.md`, `student_id_scan_PLACEHOLDER.md`.
   - `school_resources.md`: payment plan, emergency grant, aid appeal / special circumstances process, aid office email. Mark clearly as demo content for "GT-like State University".
2. **`aid` playbook addition** (in its `AGENTS.md`): for verification items, list workspace files, match them to the required documents, mark missing ones, draft a short email to the aid office (subject + body, under 120 words, plain language, asks one concrete question), and add relevant resources from `school_resources.md`. Never invent a document that isn't in the folder.
3. **Shallow playbooks:** `credit` (pay-in-full vs minimum explanation, due date vs next pay date, payment link placeholder), `subs` (keep or cancel question + cancel-link placeholder), `money_in` (checklist + one-paragraph draft). Same tool.
4. **`pipeline/headstart.ts`** — `headStart(obligationId)`: `callAgent(<domain>, {obligation, now}, write_head_start)` → insert `head_starts` → `emit("headstart.ready", {obligation_id, found_files, missing})`. Cache: one head start per obligation unless its fields changed.
5. **Wire-up:** spec 04's notify rule calls `headStart()` before sending; reply `1` sends `draft_text`, reply `2` sends `checklist` with ✓ for found files and ✗ for missing.

## Acceptance checks

- [ ] For the verification item, `found_files` lists only files that exist in the folder; at least one required document is reported missing.
- [ ] The draft names the specific documents and asks one question; ≤ 120 words.
- [ ] `resources` includes the appeal or emergency grant entry from `school_resources.md`.
- [ ] Deleting a file from the folder and re-running changes `found_files` (it really reads the workspace).
- [ ] No head start text includes a link in the first message of a conversation.

## Out of scope

Submitting anything, uploading to portals, filling PDFs.
