import type { CaGroup, CaLevel, Paper, TopicRef } from "./types";
import { caInterGroup2 } from "./ca-inter-group2";

export * from "./types";

/**
 * Registry of available syllabi. Add more (e.g. inter group1, final) as new files and list them here;
 * students then pick them during onboarding.
 */
const registry: Record<string, Paper[]> = {
  "intermediate:group2": caInterGroup2,
};

export const LEVEL_LABELS: Record<CaLevel, string> = {
  foundation: "CA Foundation",
  intermediate: "CA Intermediate",
  final: "CA Final",
};

export const GROUP_LABELS: Record<CaGroup, string> = {
  group1: "Group I",
  group2: "Group II",
  both: "Both groups",
};

export function isSyllabusAvailable(level: CaLevel, group: CaGroup): boolean {
  return getPapers(level, group).length > 0;
}

export function getPapers(level: CaLevel, group: CaGroup): Paper[] {
  if (level === "foundation") return registry["foundation:all"] ?? [];
  if (group === "both") {
    return [...(registry[`${level}:group1`] ?? []), ...(registry[`${level}:group2`] ?? [])];
  }
  return registry[`${level}:${group}`] ?? [];
}

const allPapers = Object.values(registry).flat();
const topicIndex = new Map<string, TopicRef>();
for (const paper of allPapers) {
  for (const chapter of paper.chapters) {
    for (const topic of chapter.topics) topicIndex.set(topic.id, { topic, chapter, paper });
  }
}

export function getTopic(id: string): TopicRef | undefined {
  return topicIndex.get(id);
}

export function topicCount(papers: Paper[]): number {
  return papers.reduce((n, p) => n + p.chapters.reduce((m, c) => m + c.topics.length, 0), 0);
}

export function availableSyllabi(): string[] {
  return Object.keys(registry);
}
