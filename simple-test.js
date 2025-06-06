// 即座に実行する簡単なテスト
const io = require('socket.io-client');

console.log('Starting SFU test...');

let player1, player2;

// Player 1
player1 = io('http://localhost:3001');

player1.on('connect', () => {
    console.log('✓ Player 1 connected:', player1.id);

    player1.emit('join-room', {
        roomNumber: '000042',
        playerInfo: {
            id: player1.id,
            avatar: 'test1.png',
            name: 'TestPlayer1'
        }
    });
});

player1.on('room-joined', (data) => {
    console.log('✓ Player 1 joined room:', {
        playerNumber: data.playerNumber,
        isGameReady: data.isGameReady,
        playersCount: data.players.length
    });
});

player1.on('game-ready', (data) => {
    console.log('✓ Game is ready! Starting game...');

    // 1秒後にゲーム開始
    setTimeout(() => {
        console.log('🎮 Player 1 requesting game start...');
        player1.emit('start-game', { roomNumber: '000042' });
    }, 1000);
});

player1.on('game-started', (data) => {
    console.log('🎉 Game started successfully!', {
        initiator: data.initiator,
        players: data.players.length
    });

    // テスト成功、終了
    setTimeout(() => {
        console.log('✅ Test completed successfully!');
        player1.disconnect();
        player2.disconnect();
        process.exit(0);
    }, 2000);
});

player1.on('game-start-failed', (data) => {
    console.log('❌ Game start failed:', data);
});

// Player 2 - 2秒後に接続
setTimeout(() => {
    player2 = io('http://localhost:3001');

    player2.on('connect', () => {
        console.log('✓ Player 2 connected:', player2.id);

        player2.emit('join-room', {
            roomNumber: '000042',
            playerInfo: {
                id: player2.id,
                avatar: 'test2.png',
                name: 'TestPlayer2'
            }
        });
    });

    player2.on('room-joined', (data) => {
        console.log('✓ Player 2 joined room:', {
            playerNumber: data.playerNumber,
            isGameReady: data.isGameReady,
            playersCount: data.players.length
        });
    });

    player2.on('game-started', (data) => {
        console.log('🎉 Player 2 received game started!', {
            initiator: data.initiator
        });
    });
}, 2000);

// タイムアウト
setTimeout(() => {
    console.log('⏰ Test timeout');
    process.exit(1);
}, 10000);
