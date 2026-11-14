import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

/** What the student is preparing for. Chosen during onboarding, editable in settings. */
export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  level: text("level").notNull(), // CaLevel
  group: text("group").notNull(), // CaGroup
  attemptMonth: integer("attempt_month").notNull(), // 1, 5 or 9 (Jan / May / Sept)
  attemptYear: integer("attempt_year").notNull(),
  examDate: date("exam_date"), // first paper date once ICAI announces it
  dailyTargetMinutes: integer("daily_target_minutes").notNull().default(480),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One logged study session — the student's *claim* of what they studied. */
export const studySessions = pgTable(
  "study_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studiedOn: date("studied_on").notNull(),
    sessionType: text("session_type").notNull(), // SessionType
    source: text("source").notNull(),
    itemsCovered: text("items_covered").notNull().default(""),
    durationMinutes: integer("duration_minutes").notNull(),
    practiceAttempted: integer("practice_attempted"),
    practiceCorrect: integer("practice_correct"),
    summary: text("summary").notNull(),
    confidence: integer("confidence").notNull(), // 1..5
    doubts: text("doubts").notNull().default(""),
    summaryScore: integer("summary_score"), // 0..10, AI assessed
    summaryFeedback: text("summary_feedback"),
    createdAt: createdAt(),
  },
  (t) => [index("study_sessions_user_idx").on(t.userId, t.studiedOn)],
);

export const sessionTopics = pgTable(
  "session_topics",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => studySessions.id, { onDelete: "cascade" }),
    topicId: text("topic_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.topicId] })],
);

export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => studySessions.id, { onDelete: "set null" }),
    kind: text("kind").notNull(), // "instant" | "retest"
    topicIds: jsonb("topic_ids").$type<string[]>().notNull(),
    status: text("status").notNull().default("ready"), // "ready" | "submitted"
    provider: text("provider"), // which AI produced it
    scorePercent: real("score_percent"),
    createdAt: createdAt(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (t) => [index("quizzes_user_idx").on(t.userId, t.createdAt)],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    topicId: text("topic_id").notNull(),
    type: text("type").notNull(), // "mcq" | "numeric" | "short"
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>(),
    correctIndex: integer("correct_index"),
    numericAnswer: real("numeric_answer"),
    tolerancePercent: real("tolerance_percent"),
    unit: text("unit"),
    modelAnswer: text("model_answer").notNull().default(""),
    rubric: jsonb("rubric").$type<string[]>(),
    explanation: text("explanation").notNull().default(""),
    marks: integer("marks").notNull(),
    studentAnswer: text("student_answer"),
    awardedMarks: real("awarded_marks"),
    feedback: text("feedback"),
    /** Student reported the question/answer key as wrong — excluded from scoring. */
    flagged: boolean("flagged").notNull().default(false),
  },
  (t) => [index("questions_quiz_idx").on(t.quizId, t.position)],
);

/** Per-student, per-topic state: claimed vs verified, spaced re-test schedule, calibration. */
export const topicMastery = pgTable(
  "topic_mastery",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topicId: text("topic_id").notNull(),
    status: text("status").notNull().default("claimed"), // MasteryStatus
    studyMinutes: integer("study_minutes").notNull().default(0),
    sessionsCount: integer("sessions_count").notNull().default(0),
    revisionCount: integer("revision_count").notNull().default(0),
    lastConfidence: integer("last_confidence"),
    lastStudiedAt: date("last_studied_at"),
    testsTaken: integer("tests_taken").notNull().default(0),
    lastScore: real("last_score"),
    bestScore: real("best_score"),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    reviewStage: integer("review_stage").notNull().default(0),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.topicId] })],
);

export const doubts = pgTable("doubts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => studySessions.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: createdAt(),
});
