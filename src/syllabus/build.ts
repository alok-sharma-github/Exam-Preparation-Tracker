import type { Paper } from "./types";

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

type ChapterSpec = [name: string, topics: string[]];

export function buildPaper(spec: Omit<Paper, "chapters"> & { chapters: ChapterSpec[] }): Paper {
  const seen = new Set<string>();
  return {
    ...spec,
    chapters: spec.chapters.map(([name, topics]) => {
      const chapterId = `${spec.id}.${slugify(name)}`;
      return {
        id: chapterId,
        name,
        topics: topics.map((t) => {
          const id = `${chapterId}.${slugify(t)}`;
          if (seen.has(id)) throw new Error(`Duplicate topic id ${id}`);
          seen.add(id);
          return { id, name: t };
        }),
      };
    }),
  };
}
