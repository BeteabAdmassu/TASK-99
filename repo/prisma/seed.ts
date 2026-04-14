import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_ID = '00000000-0000-0000-0000-000000000002';
const ADMIN_PASSWORD = 'Admin12345678!';

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

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

  console.log(`Seed complete. Org ID: ${ORG_ID}, Admin: admin / ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
