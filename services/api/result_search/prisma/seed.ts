import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // テストユーザーのpong2対戦結果
  const pong2Results = await prisma.gameResultPong2.createMany({
    data: [
      {
        username: 'user1',
        opponentUsername: 'user2',
        result: 'win',
        gameDate: new Date('2024-01-15T14:30:00Z'),
      },
      {
        username: 'user1',
        opponentUsername: 'user3',
        result: 'lose',
        gameDate: new Date('2024-01-16T16:45:00Z'),
      },
      {
        username: 'user2',
        opponentUsername: 'user1',
        result: 'lose',
        gameDate: new Date('2024-01-15T14:30:00Z'),
      },
      {
        username: 'user2',
        opponentUsername: 'user4',
        result: 'win',
        gameDate: new Date('2024-01-17T20:00:00Z'),
      },
      {
        username: 'user3',
        opponentUsername: 'user1',
        result: 'win',
        gameDate: new Date('2024-01-16T16:45:00Z'),
      },
      {
        username: 'user4',
        opponentUsername: 'user2',
        result: 'lose',
        gameDate: new Date('2024-01-17T20:00:00Z'),
      },
    ],
  });

  // テストユーザーのpong42対戦結果
  const pong42Results = await prisma.gameResultPong42.createMany({
    data: [
      {
        username: 'user1',
        rank: 5,
        gameDate: new Date('2024-01-20T19:00:00Z'),
      },
      {
        username: 'user1',
        rank: 12,
        gameDate: new Date('2024-01-27T19:00:00Z'),
      },
      {
        username: 'user1',
        rank: 8,
        gameDate: new Date('2024-02-03T19:00:00Z'),
      },
      {
        username: 'user2',
        rank: 23,
        gameDate: new Date('2024-01-20T19:00:00Z'),
      },
      {
        username: 'user2',
        rank: 8,
        gameDate: new Date('2024-01-27T19:00:00Z'),
      },
      {
        username: 'user2',
        rank: 15,
        gameDate: new Date('2024-02-03T19:00:00Z'),
      },
      {
        username: 'user3',
        rank: 1,
        gameDate: new Date('2024-01-20T19:00:00Z'),
      },
      {
        username: 'user3',
        rank: 3,
        gameDate: new Date('2024-01-27T19:00:00Z'),
      },
      {
        username: 'user3',
        rank: 2,
        gameDate: new Date('2024-02-03T19:00:00Z'),
      },
      {
        username: 'user4',
        rank: 35,
        gameDate: new Date('2024-01-20T19:00:00Z'),
      },
      {
        username: 'user4',
        rank: 28,
        gameDate: new Date('2024-01-27T19:00:00Z'),
      },
    ],
  });

  console.log(`Created ${pong2Results.count} pong2 results`);
  console.log(`Created ${pong42Results.count} pong42 results`);
  console.log('Seeding finished.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });