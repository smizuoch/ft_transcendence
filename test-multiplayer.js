// GamePong2マルチプレイヤーモードのテスト用スクリプト
// ブラウザの開発者コンソールで実行

console.log('GamePong2 マルチプレイヤーテスト開始');

// 1. multiplayerServiceの存在確認
if (typeof window.multiplayerService !== 'undefined') {
  console.log('✓ multiplayerService が利用可能です');
} else {
  console.log('✗ multiplayerService が見つかりません');
}

// 2. 接続テスト
async function testMultiplayerConnection() {
  const roomNumber = '000042';
  const playerInfo = {
    id: 'test-player-' + Math.random().toString(36).substr(2, 9),
    avatar: 'test-avatar.png',
    name: 'Test Player'
  };

  console.log(`部屋 ${roomNumber} に接続中...`);

  // イベントリスナーの設定
  window.multiplayerService.on('roomJoined', (data) => {
    console.log('✓ 部屋に参加しました:', data);
    console.log(`プレイヤー番号: ${data.playerNumber}`);
    console.log(`ゲーム準備完了: ${data.isGameReady}`);

    if (data.isGameReady) {
      console.log('ゲーム開始を試行中...');
      window.multiplayerService.startGame();
    }
  });

  window.multiplayerService.on('gameStarted', (data) => {
    console.log('✓ ゲームが開始されました:', data);
    console.log(`開始者: ${data.initiator}`);
    console.log(`参加プレイヤー: ${data.players.length}人`);
  });

  window.multiplayerService.on('gameStartFailed', (data) => {
    console.log('✗ ゲーム開始に失敗:', data);
  });

  // 接続実行
  window.multiplayerService.connect(roomNumber, playerInfo);
}

// 使用方法の表示
console.log(`
テスト実行方法:
1. ブラウザでGamePong2ページを開く
2. 開発者コンソールを開く
3. 以下のコマンドを実行:
   testMultiplayerConnection()

または、直接ゲーム開始をテスト:
   window.multiplayerService.startGame()
`);

// テスト関数をグローバルに公開
window.testMultiplayerConnection = testMultiplayerConnection;
