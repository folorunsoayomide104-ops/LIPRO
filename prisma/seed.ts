import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
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

  // No demo courses are seeded — left empty intentionally.
  await prisma.course.deleteMany({ where: { id: { in: ["demo-course-1", "demo-course-2"] } } });

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
  console.log("  Admin:   admin@lipro.academy / Password123!");
  console.log("  Student: student@lipro.academy / Password123!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
