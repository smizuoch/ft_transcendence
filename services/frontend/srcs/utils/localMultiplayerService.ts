
export interface LocalClient {
  id: string;
  name: string;
  num_of_play: number;
  stillAlive: boolean;
  avatar: string;
}

export interface LocalRoomState {
  roomNumber: string;
  clients: LocalClient[];
  players: LocalClient[];
  spectators: LocalClient[];
  gameStarted: boolean;
  gameOver: boolean;
  winner: number | null;
}

export class LocalMultiplayerService {
  private static instance: LocalMultiplayerService | null = null;
  private roomState: LocalRoomState | null = null;
  private eventListeners: { [event: string]: Function[] } = {};
  private isConnected: boolean = false;

  constructor() {
    if (LocalMultiplayerService.instance) {
      return LocalMultiplayerService.instance;
    }
    LocalMultiplayerService.instance = this;
  }

  // イベントリスナー管理
  on(event: string, callback: Function) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  off(event: string, callback: Function) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(
        cb => cb !== callback
      );
    }
  }

  private emit(event: string, data?: any) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // ローカル対戦のセットアップ
  setupLocalMultiplayer(roomNumber: string, clients: LocalClient[]): Promise<void> {
    return new Promise((resolve) => {
      // 1人しかアクセスできないルーム制御は実装しない（既に制御済み）
      this.roomState = {
        roomNumber,
        clients: [...clients],
        players: [],
        spectators: [],
        gameStarted: false,
        gameOver: false,
        winner: null,
      };

      this.isConnected = true;
      
      // プレイヤーとスペクテーターの割り当て
      this.assignPlayersAndSpectators();
      
      this.emit('localRoomJoined', this.roomState);
      resolve();
    });
  }

  private assignPlayersAndSpectators() {
    if (!this.roomState) return;

    const { clients } = this.roomState;
    
    // 参加者数が奇数の場合、technicianNPCを追加
    if (clients.length % 2 === 1) {
      const npcClient: LocalClient = {
        id: 'npc-technician',
        name: 'TechnicianNPC',
        num_of_play: 0,
        stillAlive: true,
        avatar: '/images/avatar/npc_avatar.png', // NPCアバター
      };
      clients.push(npcClient);
    }

    // stillAliveがtrueのクライアントの中から、num_of_playが最小の2人を選ぶ
    const aliveClients = clients.filter(client => client.stillAlive);
    
    // num_of_playでソートし、最小値の2人を選択
    aliveClients.sort((a, b) => a.num_of_play - b.num_of_play);
    const minPlayCount = aliveClients[0]?.num_of_play || 0;
    const candidates = aliveClients.filter(client => client.num_of_play === minPlayCount);
    
    // 候補者からランダムに2人選択
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    this.roomState.players = shuffled.slice(0, 2);
    this.roomState.spectators = clients.filter(client => 
      !this.roomState!.players.includes(client)
    );

    console.log('Player assignment:', {
      players: this.roomState.players.map(p => p.name),
      spectators: this.roomState.spectators.map(s => s.name),
    });
  }

  // ゲーム開始
  startGame() {
    if (!this.roomState) return;
    
    this.roomState.gameStarted = true;
    this.emit('localGameStarted', this.roomState);
  }

  // ゲーム終了処理
  endGame(winner: 1 | 2) {
    if (!this.roomState) return;

    const winnerPlayer = this.roomState.players[winner - 1];
    const loserPlayer = this.roomState.players[winner === 1 ? 1 : 0];

    // プレイヤーのnum_of_playを増加
    this.roomState.players.forEach(player => {
      if (player.id !== 'npc-technician') {
        player.num_of_play++;
      }
    });

    // 敗者のstillAliveをfalseに設定
    if (loserPlayer && loserPlayer.id !== 'npc-technician') {
      loserPlayer.stillAlive = false;
    }

    this.roomState.gameOver = true;
    this.roomState.winner = winner;

    console.log('Game ended:', {
      winner: winnerPlayer?.name,
      loser: loserPlayer?.name,
      stillAliveCount: this.roomState.clients.filter(c => c.stillAlive).length,
    });

    this.emit('localGameEnded', {
      winner,
      winnerPlayer,
      loserPlayer,
      finalScores: { player1: winner === 1 ? 3 : 0, player2: winner === 2 ? 3 : 0 },
      roomState: this.roomState,
    });
  }

  // 次のゲームまたは結果画面に遷移
  proceedToNext(): { action: 'nextGame' | 'result'; roomNumber?: string } {
    if (!this.roomState) return { action: 'result' };

    const stillAliveCount = this.roomState.clients.filter(c => c.stillAlive).length;
    
    if (stillAliveCount >= 2) {
      // 次のゲームに進む
      const nextRoomNumber = (parseInt(this.roomState.roomNumber) + 1000000).toString();
      return { action: 'nextGame', roomNumber: nextRoomNumber };
    } else {
      // 結果画面に進む
      return { action: 'result' };
    }
  }

  // ゲッター
  isInLocalRoom(): boolean {
    return this.roomState !== null;
  }

  getRoomState(): LocalRoomState | null {
    return this.roomState;
  }

  getRoomNumber(): string | null {
    return this.roomState?.roomNumber || null;
  }

  isConnectedToLocal(): boolean {
    return this.isConnected;
  }

  // クリーンアップ
  leaveLocalRoom() {
    this.roomState = null;
    this.isConnected = false;
    this.emit('localRoomLeft');
  }

  // プレイヤー取得
  getLocalPlayer(index: 1 | 2): LocalClient | null {
    if (!this.roomState) return null;
    return this.roomState.players[index - 1] || null;
  }

  // NPCが含まれているかチェック
  hasNPC(): boolean {
    if (!this.roomState) return false;
    return this.roomState.players.some(player => player.id === 'npc-technician');
  }
}

// シングルトンインスタンス
export const localMultiplayerService = new LocalMultiplayerService();
