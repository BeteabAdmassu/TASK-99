import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_ID = '00000000-0000-0000-0000-000000000002';

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('SEED_ADMIN_PASSWORD environment variable is required');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: {},
    create: {
      id: ORG_ID,
      name: 'Default Organization',
      slug: 'default',
      settings: {},
    },
  });

  await prisma.user.upsert({
    where: {
      id: ADMIN_ID,
    },
    update: {},
    create: {
      id: ADMIN_ID,
      organizationId: ORG_ID,
      username: 'admin',
      passwordHash,
      role: 'admin',
    },
  });

  console.log(`Seed complete. Org ID: ${ORG_ID}, admin user created. Change the default password before deploying to production.`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
