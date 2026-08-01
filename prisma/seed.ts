import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@lipro.academy" },
    update: {},
    create: {
      email: "superadmin@lipro.academy",
      passwordHash: await bcrypt.hash("Password123!", 10),
      fullName: "LIPRO Super Admin",
      matricNumber: "SA000001",
      university: "LIPRO Headquarters",
      faculty: "Administration",
      department: "Operations",
      level: "100",
      semester: "First",
      role: "SUPER_ADMIN",
      isEmailVerified: true,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@lipro.academy" },
    update: {},
    create: {
      email: "admin@lipro.academy",
      passwordHash: await bcrypt.hash("Password123!", 10),
      fullName: "Admin User",
      matricNumber: "AD000001",
      university: "LIPRO University",
      faculty: "Administration",
      department: "IT",
      level: "100",
      semester: "First",
      role: "ADMIN",
      isEmailVerified: true,
    },
  });

  const lecturer = await prisma.user.upsert({
    where: { email: "lecturer@lipro.academy" },
    update: {},
    create: {
      email: "lecturer@lipro.academy",
      passwordHash: await bcrypt.hash("Password123!", 10),
      fullName: "Dr. Adekunle Johnson",
      matricNumber: "LEC000001",
      university: "University of Lagos",
      faculty: "Science",
      department: "Computer Science",
      level: "Staff",
      semester: "First",
      role: "LECTURER",
      isEmailVerified: true,
    },
  });

  const student = await prisma.user.upsert({
    where: { email: "student@lipro.academy" },
    update: {},
    create: {
      email: "student@lipro.academy",
      passwordHash: await bcrypt.hash("Password123!", 10),
      fullName: "Chioma Okafor",
      matricNumber: "CSC/2020/001",
      university: "University of Lagos",
      faculty: "Science",
      department: "Computer Science",
      level: "300",
      semester: "First",
      role: "STUDENT",
      isEmailVerified: true,
      subscriptionTier: "FREE",
      walletBalance: 0,
    },
  });

  const course = await prisma.course.upsert({
    where: { id: "demo-course-1" },
    update: {},
    create: {
      id: "demo-course-1",
      code: "CSC301",
      title: "Data Structures and Algorithms",
      description: "Introduction to data structures, algorithms and complexity analysis.",
      faculty: "Science",
      department: "Computer Science",
      level: "300",
      semester: "First",
      lecturerId: lecturer.id,
    },
  });

  const course2 = await prisma.course.upsert({
    where: { id: "demo-course-2" },
    update: {},
    create: {
      id: "demo-course-2",
      code: "CSC302",
      title: "Operating Systems",
      description: "Concepts of operating systems, processes, memory and file management.",
      faculty: "Science",
      department: "Computer Science",
      level: "300",
      semester: "First",
      lecturerId: lecturer.id,
    },
  });

  const questions = [
    { type: "MCQ" as const, question: "What is the time complexity of binary search on a sorted array of n elements?", options: JSON.stringify(["O(1)","O(log n)","O(n)","O(n log n)"]), answer: "O(log n)", explanation: "Binary search halves the search space each step -> logarithmic time." },
    { type: "MCQ" as const, question: "Which data structure uses LIFO ordering?", options: JSON.stringify(["Queue","Stack","Heap","Tree"]), answer: "Stack", explanation: "Stacks are Last-In-First-Out." },
    { type: "TRUE_FALSE" as const, question: "A linked list provides O(1) random access.", options: null, answer: "False", explanation: "Linked lists require O(n) traversal to access an arbitrary index." },
    { type: "FILL_BLANK" as const, question: "The worst-case time complexity of quicksort is ___.", options: null, answer: "O(n^2)", explanation: "Quicksort degrades to O(n^2) on already-sorted input without randomization." },
    { type: "THEORY" as const, question: "Define Big-O notation and explain its importance.", options: null, answer: "Big-O describes the asymptotic upper bound of an algorithm's running time as a function of input size, allowing comparison of algorithm scalability independent of hardware.", explanation: "Used for algorithm analysis." },
  ];

  // Make seeding idempotent: clear demo data for this course before re-creating
  await prisma.examSession.deleteMany({ where: { courseId: course.id } });
  await prisma.note.deleteMany({ where: { courseId: course.id } });
  await prisma.question.deleteMany({ where: { courseId: course.id } });

  for (const q of questions) {
    await prisma.question.create({
      data: { ...q, courseId: course.id, authorId: lecturer.id, points: q.type === "THEORY" ? 10 : 2 },
    });
  }

  await prisma.note.create({
    data: {
      title: "Arrays and Linked Lists - Quick Revision",
      content: "Arrays provide O(1) random access but O(n) insertion/deletion. Linked lists provide O(1) insertion/deletion at known positions but O(n) access.",
      courseId: course.id,
      userId: lecturer.id,
      tags: JSON.stringify(["arrays","linked-list","revision"]),
    },
  });

  await prisma.notification.deleteMany({ where: { userId: student.id } });
  await prisma.walletTxn.deleteMany({ where: { userId: student.id } });
  await prisma.user.update({
    where: { id: student.id },
    data: { walletBalance: 0 },
  });

  await prisma.notification.create({
    data: { userId: student.id, type: "INFO", title: "Welcome to LIPRO Academy", message: "Your account is ready. Start by enrolling in a course." },
  });

  console.log("Seed complete. Demo accounts:");
  console.log("  Super Admin: superadmin@lipro.academy / Password123!");
  console.log("  Admin:       admin@lipro.academy / Password123!");
  console.log("  Lecturer:    lecturer@lipro.academy / Password123!");
  console.log("  Student:     student@lipro.academy / Password123!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
