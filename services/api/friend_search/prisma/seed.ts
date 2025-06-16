import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // サンプルフレンドシップデータを作成
  const sampleFriendships = [
    {
      follower: 'user1',
      following: 'user2',
    },
    {
      follower: 'user2',
      following: 'user1',
    },
    {
      follower: 'user1',
      following: 'testuser',
    },
    {
      follower: 'testuser',
      following: 'user1',
    },
    {
      follower: 'user2',
      following: 'testuser',
    }
  ];

  for (const friendship of sampleFriendships) {
    await prisma.friendship.upsert({
      where: { 
        follower_following: {
          follower: friendship.follower,
          following: friendship.following
        }
      },
      update: {},
      create: friendship,
    });
  }

  console.log('Sample friendships have been seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
