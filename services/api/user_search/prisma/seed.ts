import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // サンプルユーザープロフィールを作成
  const sampleProfiles = [
    {
      user_name: 'user1',
      profile_image: '/images/avatar/user1.png',
      is_online: true,
    },
    {
      user_name: 'user2',
      profile_image: '/images/avatar/user2.png', 
      is_online: false,
    },
    {
      user_name: 'testuser',
      profile_image: '/images/avatar/default_avatar.png',
      is_online: true,
    }
  ];

  for (const profile of sampleProfiles) {
    await prisma.userProfile.upsert({
      where: { user_name: profile.user_name },
      update: {},
      create: profile,
    });
  }

  console.log('Sample user profiles have been seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
