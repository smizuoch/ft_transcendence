import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // サンプルユーザープロフィールを作成
  const sampleProfiles = [
    {
      username: 'user1',
      profileImage: '/images/avatar/user1.png',
      isOnline: true,
    },
    {
      username: 'user2',
      profileImage: '/images/avatar/user2.png', 
      isOnline: false,
    },
    {
      username: 'testuser',
      profileImage: '/images/avatar/default_avatar.png',
      isOnline: true,
    },
    // NPCプロフィールを追加
    {
      username: 'NPC',
      profileImage: '/images/avatar/npc_avatar.png',
      isOnline: false, // NPCは常にオフライン状態
    }
  ];

  for (const profile of sampleProfiles) {
    await prisma.userProfile.upsert({
      where: { username: profile.username },
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
