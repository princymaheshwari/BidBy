import assert from "node:assert/strict";
import { test } from "node:test";
import { blankFor, covers, docStatus, keepExisting, missingDocs } from "./docs.js";

const files = [
  "docs/2025_tax_return_transcript_PLACEHOLDER.md",
  "docs/verification_worksheet_v1_blank.md",
  "docs/student_id_scan_PLACEHOLDER.md",
];

test("the transcript file satisfies the transcript requirement", () => {
  assert.ok(covers("2025 IRS Tax Return Transcript", files[0]!));
});

test("a blank worksheet does not satisfy a signed worksheet", () => {
  assert.equal(covers("2026-27 Verification Worksheet (signed)", files[1]!), false);
  assert.ok(covers("Verification Worksheet", files[1]!));
});

test("verification: the signed worksheet is reported missing", () => {
  const required = ["2025 IRS Tax Return Transcript", "2026-27 Verification Worksheet (signed)"];
  assert.deepEqual(missingDocs(required, files), ["2026-27 Verification Worksheet (signed)"]);
  assert.deepEqual(docStatus(required, files).map((d) => d.file), [files[0], null]);
});

test("deleting the transcript makes it missing too", () => {
  const required = ["2025 IRS Tax Return Transcript", "2026-27 Verification Worksheet (signed)"];
  assert.equal(missingDocs(required, files.slice(1)).length, 2);
});

test("unrelated files do not match", () => {
  assert.equal(covers("Photo ID", "docs/resume.md"), false);
  assert.equal(covers("", files[0]!), false);
});

test("invented files are dropped; real ones are normalized to docs/<name>", () => {
  const available = ["2025_tax_return_transcript_PLACEHOLDER.md", "resume.md"];
  const { kept, dropped } = keepExisting(
    ["2025_tax_return_transcript_PLACEHOLDER.md", "docs/resume.md", "docs/w2_2025.pdf", "resume.md"],
    available,
  );
  assert.deepEqual(kept, ["docs/2025_tax_return_transcript_PLACEHOLDER.md", "docs/resume.md"]);
  assert.deepEqual(dropped, ["docs/w2_2025.pdf"]);
});

test("a blank form is reported for a signed-form requirement, never as the form itself", () => {
  const pdfs = ["2025 IRS Tax Return Transcript.pdf", "2026-27 Verification Worksheet (blank).pdf", "Student ID.pdf"];
  assert.equal(blankFor("2026-27 Verification Worksheet (signed)", pdfs), "2026-27 Verification Worksheet (blank).pdf");
  assert.equal(blankFor("2025 IRS Tax Return Transcript", pdfs), null);
  assert.deepEqual(missingDocs(["2026-27 Verification Worksheet (signed)"], pdfs), ["2026-27 Verification Worksheet (signed)"]);
  assert.ok(covers("2025 IRS Tax Return Transcript", pdfs[0]!));
});
