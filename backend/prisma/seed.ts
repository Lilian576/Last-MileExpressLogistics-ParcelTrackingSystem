import { LocationType, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seed() {
  const password = process.env.DEMO_SEED_PASSWORD;
  if (!password || password.length < 12 || Buffer.byteLength(password) > 72) {
    throw new Error(
      'Set DEMO_SEED_PASSWORD (at least 12 characters and at most 72 bytes)',
    );
  }
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    ...[
      { email: 'admin@example.test', name: 'Demo Admin', role: Role.admin },
      {
        email: 'shipper1@example.test',
        name: 'Demo Shipper 1',
        role: Role.shipper,
        latitude: 10.7292,
        longitude: 106.6935,
      },
      {
        email: 'shipper2@example.test',
        name: 'Demo Shipper 2',
        role: Role.shipper,
        latitude: 10.7731,
        longitude: 106.703,
      },
      {
        email: 'warehouse@example.test',
        name: 'Demo Warehouse',
        role: Role.warehouse_staff,
      },
    ].map(({ email, name, role, latitude, longitude }, index) =>
      prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          fullName: name,
          email,
          phone: `DEMO-000${index}`,
          passwordHash,
          role,
          currentLatitude: latitude,
          currentLongitude: longitude,
          locationUpdatedAt: latitude === undefined ? undefined : new Date(),
        },
      }),
    ),
    ...[
      {
        id: 'demo-hub-q7',
        name: 'Hub Quận 7',
        address: 'Quận 7, TP.HCM',
        latitude: 10.7292,
        longitude: 106.6935,
      },
      {
        id: 'demo-hub-q1',
        name: 'Hub Quận 1',
        address: 'Quận 1, TP.HCM',
        latitude: 10.7731,
        longitude: 106.703,
      },
    ].map((hub) =>
      prisma.location.upsert({
        where: { id: hub.id },
        update: {},
        create: { ...hub, type: LocationType.hub },
      }),
    ),
  ]);
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
