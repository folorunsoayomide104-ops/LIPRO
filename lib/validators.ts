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

export const questionSchema = z.object({
  courseId: z.string().min(1),
  type: z.enum(["MCQ","THEORY","TRUE_FALSE","FILL_BLANK","MATCHING","ESSAY","IMAGE"]),
  question: z.string().min(2),
  options: z.string().nullable().optional(),
  answer: z.string().min(1),
  explanation: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  points: z.number().int().min(1).default(1),
});

export const chatSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
  stream: z.boolean().optional(),
  context: z.object({
    courseId: z.string().optional(),
    noteId: z.string().optional(),
  }).optional(),
});
