export type Role = "STUDENT" | "ADMIN";

export type SubscriptionTier = "FREE" | "PREMIUM" | "ULTIMATE";

export interface JWTPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  matricNumber: string;
  university: string;
  faculty: string;
  department: string;
  level: string;
  semester: string;
  role: Role;
  avatarUrl: string | null;
  subscriptionTier: SubscriptionTier;
  walletBalance: number;
  createdAt: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  faculty: string;
  department: string;
  level: string;
  semester: string;
  lecturerId: string;
  coverImage: string | null;
  createdAt: string;
  _count?: { notes: number; questions: number };
}

export interface Note {
  id: string;
  title: string;
  content: string;
  courseId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  courseId: string;
  type: "MCQ" | "THEORY" | "TRUE_FALSE" | "FILL_BLANK" | "MATCHING" | "ESSAY" | "IMAGE";
  question: string;
  options: string | null;
  answer: string;
  explanation: string | null;
  imageUrl: string | null;
  points: number;
  createdAt: string;
}

export interface ExamSession {
  id: string;
  userId: string;
  courseId: string;
  mode: "practice" | "exam";
  status: "in_progress" | "completed";
  score: number | null;
  totalPoints: number | null;
  startedAt: string;
  completedAt: string | null;
  answers: string | null;
}
