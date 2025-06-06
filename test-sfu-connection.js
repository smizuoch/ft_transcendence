const { io } = require('socket.io-client');

console.log('SFU Server テスト開始...');

// プレイヤー1
const player1 = io('http://localhost:3001');
player1.on('connect', () => {
  console.log('Player 1 connected:', player1.id);

  // 部屋に参加
  player1.emit('join-room', {
    roomNumber: '000042',
    playerInfo: {
      id: player1.id,
      avatar: 'test1.png',
      name: 'Player1'
    }
  });
});

player1.on('room-joined', (data) => {
  console.log('Player 1 joined room:', data);
});

player1.on('game-ready', (data) => {
  console.log('Game ready:', data);

  // ゲーム開始を試行
  setTimeout(() => {
    console.log('Player 1 starting game...');
    player1.emit('start-game', { roomNumber: '000042' });
  }, 1000);
});

player1.on('game-started', (data) => {
  console.log('Game started by Player 1:', data);
});

player1.on('game-start-failed', (data) => {
  console.log('Game start failed:', data);
});

// プレイヤー2
setTimeout(() => {
  const player2 = io('http://localhost:3001');
  player2.on('connect', () => {
    console.log('Player 2 connected:', player2.id);

    // 部屋に参加
    player2.emit('join-room', {
      roomNumber: '000042',
      playerInfo: {
        id: player2.id,
        avatar: 'test2.png',
        name: 'Player2'
      }
    });
  });

  player2.on('room-joined', (data) => {
    console.log('Player 2 joined room:', data);
  });

  player2.on('game-started', (data) => {
    console.log('Game started for Player 2:', data);

    // テスト完了
    setTimeout(() => {
      console.log('テスト完了。接続を切断します...');
      player1.disconnect();
      player2.disconnect();
      process.exit(0);
    }, 2000);
  });
}, 2000);

// エラーハンドリング
player1.on('error', (err) => console.log('Player 1 error:', err));
player1.on('disconnect', () => console.log('Player 1 disconnected'));

setTimeout(() => {
  console.log('タイムアウト: テストを終了します');
  process.exit(1);
}, 15000);
