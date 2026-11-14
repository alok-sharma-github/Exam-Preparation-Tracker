import { test } from "node:test";
import assert from "node:assert/strict";
import { getPapers, getTopic, topicCount } from "./index";

test("CA Inter Group II has papers 4, 5, 6A and 6B with unique resolvable topics", () => {
  const papers = getPapers("intermediate", "group2");
  assert.deepEqual(papers.map((p) => p.code), ["P4", "P5", "P6A", "P6B"]);
  assert.equal(papers.reduce((s, p) => s + p.marks, 0), 300);
  const ids = papers.flatMap((p) => p.chapters.flatMap((c) => c.topics.map((t) => t.id)));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, topicCount(papers));
  for (const id of ids) assert.ok(getTopic(id), id);
});

test("unavailable syllabi return no papers", () => {
  assert.equal(getPapers("final", "group1").length, 0);
  assert.equal(getPapers("intermediate", "both").length, 4);
});
