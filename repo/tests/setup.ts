// Global test setup/teardown
import { prisma } from '../src/config/database';

afterAll(async () => {
  await prisma.$disconnect();
});
