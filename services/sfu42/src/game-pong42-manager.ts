import { GamePong42State, PlayerInfo, NPCRequest, GamePong42GameState, GamePong42Input, GamePong42Update, GamePong42Event } from './types';

export class GamePong42Room {
  public id: string;
  public participants: Map<string, PlayerInfo>;
  public countdown: number;
  public gameStarted: boolean;
  public gameOver: boolean;
  public npcCount: number;
  public createdAt: Date;
  public lastActivity: Date;

  // ゲーム状態管理
  public gameState: GamePong42GameState;
  public gameLoop: any | null = null;

  private countdownTimer: any | null = null;
  private countdownStarted: boolean = false;

  constructor(id: string) {
    this.id = id;
    this.participants = new Map();
    this.countdown = 30; // 30秒のカウントダウン
    this.gameStarted = false;
    this.gameOver = false;
    this.npcCount = 0;
    this.createdAt = new Date();
    this.lastActivity = new Date();

    // ゲーム状態初期化
    this.gameState = this.initializeGameState();
  }

  private initializeGameState(): GamePong42GameState {
    // サイドゲーム（最大41個）を初期化
    const sideGames = [];
    for (let i = 0; i < 41; i++) {
      sideGames.push({
        id: i,
        ball: { x: 400, y: 300, vx: 5, vy: 5 },
        player1: { x: 50, y: 250, score: 0, type: 'npc' as const, name: `NPC${i * 2 + 1}` },
        player2: { x: 750, y: 250, score: 0, type: 'npc' as const, name: `NPC${i * 2 + 2}` },
        gameStarted: false,
        gameOver: false,
        winner: null,
        active: false
      });
    }

    return {
      mainGame: {
        ball: { x: 400, y: 300, vx: 5, vy: 5 },
        player: { x: 50, y: 250, score: 0 },
        pidNPC: { x: 750, y: 250, score: 0 },
        gameStarted: false,
        gameOver: false,
        winner: null
      },
      sideGames,
      roomState: {
        participantCount: 0,
        npcCount: 42,
        survivors: 42,
        gameStarted: false,
        gameOver: false,
        countdown: 30, // カウントダウンプロパティを追加
        timestamp: Date.now()
      }
    };
  }

  // 参加者にゲーム状態を送信するためのコールバック
  public onGameStateUpdate?: (update: GamePong42Update) => void;

  // npc_managerを停止するためのコールバック
  public onStopNPCManager?: (roomId: string) => void;

  addParticipant(playerId: string, playerInfo: PlayerInfo): void {
    this.lastActivity = new Date();
    if (!this.participants.has(playerId)) {
      this.participants.set(playerId, playerInfo);
      console.log(`Player ${playerId} joined GamePong42 room ${this.id}`);

      // 最初の参加者でカウントダウン開始
      if (this.participants.size === 1 && !this.countdownStarted) {
        this.startCountdown();
      }
    }
  }

  removeParticipant(playerId: string): boolean {
    this.lastActivity = new Date();
    const removed = this.participants.delete(playerId);
    this.gameState.roomState.participantCount = this.participants.size;

    // 全員いなくなったらカウントダウン停止と部屋の初期化
    if (this.participants.size === 0) {
      this.resetRoomToInitialState();
    }

    return removed;
  }

  getParticipantCount(): number {
    return this.participants.size;
  }

  hasParticipant(playerId: string): boolean {
    return this.participants.has(playerId);
  }

  getParticipants(): Array<{ playerId: string; playerInfo: PlayerInfo }> {
    return Array.from(this.participants.entries()).map(([playerId, playerInfo]) => ({
      playerId,
      playerInfo
    }));
  }

  shouldStartGame(): boolean {
    return this.countdown <= 0 || this.participants.size >= 42;
  }

  calculateNPCCount(): number {
    return Math.max(0, 42 - this.participants.size);
  }

  startCountdown(): void {
    if (this.countdownStarted || this.gameStarted) return;

    this.countdownStarted = true;
    console.log(`Starting countdown for room ${this.id} with ${this.participants.size} participants`);

    // 初回の部屋状態を送信
    this.broadcastRoomState();

    this.countdownTimer = setInterval(() => {
      this.countdown--;
      console.log(`Room ${this.id} countdown: ${this.countdown}`);

      // カウントダウン更新を参加者に送信
      this.broadcastRoomState();

      if (this.shouldStartGame()) {
        this.startGame();
      }
    }, 1000) as any;
  }

  startGame(): void {
    if (this.gameStarted) return;

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    this.gameStarted = true;
    this.npcCount = this.calculateNPCCount();
    this.gameState.roomState.npcCount = this.npcCount;
    console.log(`Game started in room ${this.id} with ${this.participants.size} players and ${this.npcCount} NPCs`);

    // ゲームループ開始
    this.startGameLoop();
  }

  // ゲームループ開始
  public startGameLoop(): void {
    if (this.gameLoop) return;

    console.log(`Starting game loop for room ${this.id}`);
    this.gameState.mainGame.gameStarted = true;
    this.gameState.roomState.gameStarted = true;

    // サイドゲームの一部をアクティブにする
    const activeCount = Math.min(this.npcCount, 41);
    for (let i = 0; i < activeCount; i++) {
      this.gameState.sideGames[i].active = true;
      this.gameState.sideGames[i].gameStarted = true;
    }

    // 60FPSでゲーム状態を更新
    this.gameLoop = setInterval(() => {
      this.updateGameState();

      // ゲーム状態更新コールバック呼び出し
      if (this.onGameStateUpdate) {
        const update: GamePong42Update = {
          type: 'gameState',
          data: this.getGameState(),
          timestamp: Date.now()
        };
        this.onGameStateUpdate(update);
      }
    }, 1000 / 60) as any;
  }

  // ゲームループ停止
  public stopGameLoop(): void {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
      console.log(`Stopped game loop for room ${this.id}`);
    }
  }

  // ゲーム状態更新
  private updateGameState(): void {
    this.gameState.roomState.timestamp = Date.now();

    // メインゲーム更新
    this.updateMainGame();

    // サイドゲーム更新
    this.updateSideGames();

    // 勝利条件チェック
    this.checkWinConditions();
  }

  private updateMainGame(): void {
    const { ball, player, pidNPC } = this.gameState.mainGame;

    // ボール移動
    ball.x += ball.vx;
    ball.y += ball.vy;

    // 境界チェック
    if (ball.y <= 0 || ball.y >= 600) {
      ball.vy = -ball.vy;
    }

    // パドル衝突判定
    if (ball.x <= 60 && ball.y >= player.y && ball.y <= player.y + 50) {
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x >= 740 && ball.y >= pidNPC.y && ball.y <= pidNPC.y + 50) {
      ball.vx = -Math.abs(ball.vx);
    }

    // スコア処理
    if (ball.x <= 0) {
      pidNPC.score++;
      this.resetBall(ball);
    } else if (ball.x >= 800) {
      player.score++;
      this.resetBall(ball);
    }

    // PID NPCの簡易AI
    const targetY = ball.y - 25; // パドルの中心に合わせる
    const diff = targetY - pidNPC.y;
    pidNPC.y += Math.sign(diff) * Math.min(Math.abs(diff), 3);
    pidNPC.y = Math.max(0, Math.min(550, pidNPC.y));
  }

  private updateSideGames(): void {
    this.gameState.sideGames.forEach(game => {
      if (!game.active || game.gameOver) return;

      // ボール移動
      game.ball.x += game.ball.vx;
      game.ball.y += game.ball.vy;

      // 境界チェック
      if (game.ball.y <= 0 || game.ball.y >= 600) {
        game.ball.vy = -game.ball.vy;
      }

      // パドル衝突判定
      if (game.ball.x <= 60 && game.ball.y >= game.player1.y && game.ball.y <= game.player1.y + 50) {
        game.ball.vx = Math.abs(game.ball.vx);
      }
      if (game.ball.x >= 740 && game.ball.y >= game.player2.y && game.ball.y <= game.player2.y + 50) {
        game.ball.vx = -Math.abs(game.ball.vx);
      }

      // スコア処理
      if (game.ball.x <= 0) {
        game.player2.score++;
        this.resetBall(game.ball);
      } else if (game.ball.x >= 800) {
        game.player1.score++;
        this.resetBall(game.ball);
      }

      // NPCの簡易AI
      const targetY1 = game.ball.y - 25;
      const targetY2 = game.ball.y - 25;

      const diff1 = targetY1 - game.player1.y;
      const diff2 = targetY2 - game.player2.y;

      game.player1.y += Math.sign(diff1) * Math.min(Math.abs(diff1), 2);
      game.player2.y += Math.sign(diff2) * Math.min(Math.abs(diff2), 2);

      game.player1.y = Math.max(0, Math.min(550, game.player1.y));
      game.player2.y = Math.max(0, Math.min(550, game.player2.y));

      // ゲーム終了判定（スコア5で勝利）
      if (game.player1.score >= 5) {
        game.gameOver = true;
        game.winner = 1;
        this.gameState.roomState.survivors--;
      } else if (game.player2.score >= 5) {
        game.gameOver = true;
        game.winner = 2;
        this.gameState.roomState.survivors--;
      }
    });
  }

  private resetBall(ball: { x: number; y: number; vx: number; vy: number }): void {
    ball.x = 400;
    ball.y = 300;
    ball.vx = (ball.vx > 0 ? -5 : 5) + (Math.random() - 0.5);
    ball.vy = (Math.random() - 0.5) * 5;
  }

  private checkWinConditions(): void {
    // メインゲーム勝利条件（スコア5で勝利）
    if (this.gameState.mainGame.player.score >= 5) {
      this.gameState.mainGame.gameOver = true;
      this.gameState.mainGame.winner = 'player';
      this.gameState.roomState.gameOver = true;
      this.stopGameLoop();
    } else if (this.gameState.mainGame.pidNPC.score >= 5) {
      this.gameState.mainGame.gameOver = true;
      this.gameState.mainGame.winner = 'pidNPC';
      this.gameState.roomState.gameOver = true;
      this.stopGameLoop();
    }

    // 全体勝利条件（生存者が1人の場合）
    if (this.gameState.roomState.survivors <= 1) {
      this.gameState.roomState.gameOver = true;
      this.stopGameLoop();
    }
  }

  // プレイヤー入力処理
  public processPlayerInput(input: GamePong42Input): void {
    // メインゲームのプレイヤー移動
    if (input.input.up) {
      this.gameState.mainGame.player.y = Math.max(0, this.gameState.mainGame.player.y - 5);
    }
    if (input.input.down) {
      this.gameState.mainGame.player.y = Math.min(550, this.gameState.mainGame.player.y + 5);
    }

    // 攻撃処理
    if (input.input.attack !== undefined) {
      this.processAttack(input.playerId, input.input.attack);
    }
  }

  private processAttack(playerId: string, targetGameId: number): void {
    if (targetGameId >= 0 && targetGameId < this.gameState.sideGames.length) {
      const targetGame = this.gameState.sideGames[targetGameId];
      if (targetGame.active && !targetGame.gameOver) {
        // 攻撃効果：対象ゲームの速度を上げる
        targetGame.ball.vx *= 1.1;
        targetGame.ball.vy *= 1.1;
        console.log(`Player ${playerId} attacked game ${targetGameId}`);
      }
    }
  }

  // 部屋状態を参加者にブロードキャスト
  private broadcastRoomState(): void {
    if (this.onGameStateUpdate) {
      // 現在の部屋状態を更新
      this.gameState.roomState.participantCount = this.participants.size;
      this.gameState.roomState.npcCount = this.calculateNPCCount();
      this.gameState.roomState.countdown = this.countdown;
      this.gameState.roomState.gameStarted = this.gameStarted;
      this.gameState.roomState.gameOver = this.gameOver;
      this.gameState.roomState.timestamp = Date.now();

      const update: GamePong42Update = {
        type: 'roomState',
        data: {
          roomState: this.gameState.roomState
        },
        timestamp: Date.now()
      };
      this.onGameStateUpdate(update);
    }
  }

  // ゲーム状態取得
  public getGameState(): GamePong42GameState {
    return JSON.parse(JSON.stringify(this.gameState)); // Deep copy
  }

  getFirstParticipant(): string | null {
    const participantIds = Array.from(this.participants.keys());
    return participantIds.length > 0 ? participantIds[0] : null;
  }

  cleanup(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.stopGameLoop();
  }  // 部屋を試合前の状態に初期化
  resetRoomToInitialState(): void {
    console.log(`🔄 Resetting room ${this.id} to initial state`);

    // npc_managerの停止処理を実行
    if (this.onStopNPCManager) {
      console.log(`🛑 Stopping NPC manager for room ${this.id}`);
      this.onStopNPCManager(this.id);
    }

    // タイマーを停止
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.stopGameLoop();

    // 状態をリセット
    this.countdown = 30;
    this.gameStarted = false;
    this.gameOver = false;
    this.npcCount = 0;
    this.countdownStarted = false;
    this.lastActivity = new Date();

    // ゲーム状態を初期化
    this.gameState = this.initializeGameState();

    console.log(`✅ Room ${this.id} reset complete`);
  }

  // カウントダウンが0かつ生存クライアントが0の場合の初期化チェック
  checkForRoomReset(): void {
    if (this.countdown <= 0 && this.participants.size === 0 && this.gameStarted) {
      console.log(`🔄 Room ${this.id} meets reset conditions (countdown: ${this.countdown}, participants: ${this.participants.size})`);
      this.resetRoomToInitialState();
    }
  }

  // 新しいクライアントが入室可能かチェック
  canJoinRoom(): boolean {
    // カウントダウンが0になった部屋には入室不可
    if (this.countdown <= 0 && this.gameStarted) {
      console.log(`❌ Room ${this.id} cannot be joined - game already started`);
      return false;
    }

    // カウントダウン中なら入室可能
    if (this.countdown > 0 && this.countdownStarted) {
      console.log(`✅ Room ${this.id} can be joined - countdown in progress (${this.countdown}s remaining)`);
      return true;
    }

    // まだカウントダウンが始まっていない場合も入室可能
    if (!this.countdownStarted) {
      console.log(`✅ Room ${this.id} can be joined - countdown not started yet`);
      return true;
    }

    return true;
  }
}

export class GamePong42Manager {
  private rooms: Map<string, GamePong42Room> = new Map();

  // カウントダウン中の入室可能な部屋を取得、なければ新しい部屋を作成
  getAvailableRoom(): GamePong42Room {
    // 既存の部屋の中でカウントダウン中の部屋を探す
    for (const room of this.rooms.values()) {
      if (room.canJoinRoom()) {
        console.log(`🏠 Found available room: ${room.id}`);
        return room;
      }
    }

    // 入室可能な部屋がない場合、新しい部屋を作成
    const roomId = `gamepong42-room-${Date.now()}`;
    console.log(`🆕 Creating new room: ${roomId}`);
    const newRoom = new GamePong42Room(roomId);
    this.rooms.set(roomId, newRoom);
    return newRoom;
  }

  getOrCreateRoom(roomId: string): GamePong42Room {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new GamePong42Room(roomId));
    }
    return this.rooms.get(roomId)!;
  }

  getRoom(roomId: string): GamePong42Room | null {
    return this.rooms.get(roomId) || null;
  }

  removeRoom(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (room) {
      room.cleanup();
      return this.rooms.delete(roomId);
    }
    return false;
  }

  addParticipant(roomId: string, playerId: string, playerInfo: PlayerInfo): GamePong42Room {
    const room = this.getAvailableRoom(); // 既存のロジックを使用
    room.addParticipant(playerId, playerInfo);
    return room;
  }

  removeParticipant(roomId: string, playerId: string): boolean {
    const room = this.getRoom(roomId);
    if (!room) return false;

    const removed = room.removeParticipant(playerId);

    // 部屋が空になったら削除
    if (room.getParticipantCount() === 0) {
      this.removeRoom(roomId);
    }

    return removed;
  }

  getAllRooms(): GamePong42Room[] {
    return Array.from(this.rooms.values());
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  cleanup(): void {
    for (const room of this.rooms.values()) {
      room.cleanup();
    }
    this.rooms.clear();
  }

  // 定期的に空の部屋や初期化が必要な部屋をチェック
  periodicCleanup(): void {
    for (const [roomId, room] of this.rooms.entries()) {
      // 部屋が空で、かつゲームが開始されている場合は初期化
      room.checkForRoomReset();

      // 参加者がいない部屋を削除
      if (room.getParticipantCount() === 0) {
        console.log(`🗑️ Removing empty room: ${roomId}`);
        room.cleanup();
        this.rooms.delete(roomId);
      }
    }
  }
}
