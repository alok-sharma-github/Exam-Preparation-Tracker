export type CaLevel = "foundation" | "intermediate" | "final";
export type CaGroup = "group1" | "group2" | "both";

/** How a paper is examined — drives the mix of generated questions. */
export type PaperStyle = "numerical" | "theory";

export interface Topic {
  /** Stable id, e.g. "inter.p4.material-cost.eoq". Never change once students have data on it. */
  id: string;
  name: string;
}

export interface Chapter {
  id: string;
  name: string;
  topics: Topic[];
}

export interface Paper {
  id: string; // e.g. "inter.p4"
  code: string; // e.g. "P4", "P6A"
  name: string;
  marks: number;
  style: PaperStyle;
  /** Guidance for the question generator about what ICAI asks in this paper. */
  examHint: string;
  chapters: Chapter[];
}

export interface TopicRef {
  topic: Topic;
  chapter: Chapter;
  paper: Paper;
}
