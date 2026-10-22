import { test } from "node:test";
import assert from "node:assert/strict";
import { hasVerifiedCredit, initials, normalizeInterest, safeExternalUrl, safeNext, splitSkills } from "../src/lib/domain.ts";

test("only accepted work in a completed project receives completed credit", () => {
  assert.equal(hasVerifiedCredit("completed","accepted"),true);
  for (const status of ["submitted","changes_requested",undefined] as const) assert.equal(hasVerifiedCredit("completed",status),false);
  assert.equal(hasVerifiedCredit("in_progress","accepted"),false);
  assert.equal(hasVerifiedCredit("open","accepted"),false);
});
test("external evidence links reject executable schemes, credentials, and malformed input", () => {
  for (const url of ["javascript:alert(1)","data:text/html,hello","//evil.test","https://user:pass@example.com","https://example.com/a b","not a link","https://"]) assert.equal(safeExternalUrl(url),false,url);
  for (const url of ["https://example.com/work?q=python#result","http://example.test/project","https://example.com:8443/work"]) assert.equal(safeExternalUrl(url),true,url);
});
test("redirect targets cannot leave the application", () => {
  for (const path of ["https://evil.test","//evil.test","/\\evil.test","/\n//evil.test",null]) assert.equal(safeNext(path),"/");
  assert.equal(safeNext("/projects?skill=Python"),"/projects?skill=Python");
});
test("skill entry deduplicates case-insensitively without losing readable names", () => {
  assert.deepEqual(splitSkills(" Python, SQL, python, ,SQL, Design "),["Python","SQL","Design"]);
  assert.deepEqual(splitSkills(""),[]);
});
test("interest search uses known phrases and preserves unfamiliar interests", () => {
  assert.equal(normalizeInterest("I want to learn Python"),"Python");
  assert.equal(normalizeInterest("Build a website"),"Web development");
  assert.equal(normalizeInterest("  Practice   data engineering "),"Data engineering");
  assert.equal(normalizeInterest("  Public speaking  "),"Public speaking");
});
test("initials support missing and multi-word names", () => {
  assert.equal(initials("Alex Rowan"),"AR");
  assert.equal(initials(" Alex  River Smith "),"AR");
  assert.equal(initials(""),"?");
});
