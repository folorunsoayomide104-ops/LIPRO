import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2, "Full name required"),
  matricNumber: z.string().min(3, "Matric number required"),
  university: z.string().min(2, "University required"),
  faculty: z.string().min(2, "Faculty required"),
  department: z.string().min(2, "Department required"),
  level: z.enum(["100","200","300","400","500","600","Staff"]),
  semester: z.enum(["First","Second"]),
});

export const loginSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password required"),
});

export const courseSchema = z.object({
  code: z.string().min(2),
  title: z.string().min(2),
  description: z.string().min(5),
  faculty: z.string().min(2),
  department: z.string().min(2),
  level: z.string().min(1),
  semester: z.enum(["First","Second"]),
});

export const noteSchema = z.object({
  title: z.string().min(2),
  content: z.string().min(1),
  courseId: z.string().min(1),
  tags: z.string().optional(),
});

/**
 * Types accepted on WRITE. Reads deliberately treat `Question.type` as a plain
 * string — older rows may hold MATCHING/IMAGE, and the runner falls back to a
 * free-text input for any type it doesn't recognise.
 */
export const QUESTION_TYPES = ["MCQ", "TRUE_FALSE", "FILL_BLANK", "THEORY", "ESSAY"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Accepts a real array or an already-serialised JSON string; always stores a string. */
const optionsField = z
  .union([z.array(z.string().min(1)).min(2), z.string().min(1), z.null()])
  .optional()
  .transform((v) => (Array.isArray(v) ? JSON.stringify(v) : (v ?? null)));

export const questionSchema = z
  .object({
    // Either a course question or a material-sourced one — see the refine below.
    courseId: z.string().min(1).nullable().optional(),
    sourceId: z.string().min(1).nullable().optional(),
    type: z.enum(QUESTION_TYPES),
    question: z.string().min(2),
    options: optionsField,
    answer: z.string().min(1),
    explanation: z.string().nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
    points: z.number().int().min(1).max(100).default(1),
  })
  .refine((v) => !!v.courseId || !!v.sourceId, {
    message: "courseId or sourceId is required",
    path: ["courseId"],
  })
  .refine((v) => v.type !== "MCQ" || !!v.options, {
    message: "MCQ questions require options",
    path: ["options"],
  });

export const questionUpdateSchema = z.object({
  type: z.enum(QUESTION_TYPES).optional(),
  question: z.string().min(2).optional(),
  options: optionsField,
  answer: z.string().min(1).optional(),
  explanation: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  points: z.number().int().min(1).max(100).optional(),
});

/* ---------------------------------------------------------------- *
 * CBT attempts
 * ---------------------------------------------------------------- */

export const examStartSchema = z
  .object({
    courseId: z.string().min(1).optional(),
    materialId: z.string().min(1).optional(),
    mode: z.enum(["practice", "exam"]),
    count: z.number().int().min(1).max(100).default(10),
    durationSec: z.number().int().min(60).max(10800).optional(),
    types: z.array(z.enum(QUESTION_TYPES)).min(1).optional(),
  })
  .refine((v) => !!v.courseId !== !!v.materialId, {
    message: "Provide exactly one of courseId or materialId",
    path: ["courseId"],
  });

const answerItems = z
  .array(
    z.object({
      itemId: z.string().min(1),
      response: z.string().max(20000).nullable(),
    })
  )
  .min(1)
  .max(120);

export const examAnswerPatchSchema = z.object({ items: answerItems });

/** Final flush on submit; optional because the answers may already be autosaved. */
export const examSubmitSchema = z.object({ items: answerItems.optional() });

export const examCheckSchema = z.object({
  itemId: z.string().min(1),
  response: z.string().max(20000).nullable(),
});

export const examOverrideSchema = z.object({
  awarded: z.number().min(0),
  note: z.string().max(2000).nullable().optional(),
});

export const chatSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
  stream: z.boolean().optional(),
  blobUrl: z.string().optional(),
  originalName: z.string().optional(),
  files: z.array(z.object({
    url: z.string().min(1),
    name: z.string().min(1),
  })).optional(),
  context: z.object({
    courseId: z.string().optional(),
    noteId: z.string().optional(),
  }).optional(),
});
