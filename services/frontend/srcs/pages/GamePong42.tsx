import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGameEngine, useKeyboardControls } from "@/utils/gameHooks";
import { DEFAULT_CONFIG } from "@/utils/gameEngine";
import { useNPCManager, NPCGameConfig, NPCGameResponse } from "@/utils/npcManagerService";
import { useGamePong42SFU } from "@/utils/gamePong42SFU";

interface GamePong42Props {
  navigate: (page: string) => void;
}

// ミニゲーム用のインターフェイス（npc_managerサービス対応）
interface MiniGame {
  id: number;
  gameId: string | null; // npc_managerのゲームID
  active: boolean;
  gameState: NPCGameResponse | null;
  canvasSize: { width: number; height: number };
}

const GamePong42: React.FC<GamePong42Props> = ({ navigate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<number | null>(Math.floor(Math.random() * 41));
  const [showSurvivorsAlert, setShowSurvivorsAlert] = useState(false);
  const [attackAnimation, setAttackAnimation] = useState<{ targetIndex: number; duration: number } | null>(null);
  const [miniGamesReady, setMiniGamesReady] = useState(false);

  // ミニゲーム状態
  const [miniGames, setMiniGames] = useState<MiniGame[]>([]);
  // npc_managerサービスのhook
  const npcManager = useNPCManager();
  // WebRTC SFUのhook（純粋なデータ中継）
  const sfu = useGamePong42SFU();

  // SFUから取得する状態（Room Leaderが管理）
  const gameStarted = sfu.gameState.gameStarted;
  const countdown = sfu.gameState.countdown;
  const [survivors, setSurvivors] = useState(42); // 動的な生存者数
  const isWaitingForGame = !gameStarted && countdown > 0;

  // 固定のプレイヤー情報
  const playerInfoRef = useRef({
    name: 'Player',
    avatar: '/images/avatar/default.png'
  });

  // ゲームエンジンとキーボード制御を追加
  const { engineRef, initializeEngine, startGameLoop, stopGameLoop } = useGameEngine(canvasRef as React.RefObject<HTMLCanvasElement>, DEFAULT_CONFIG);
  const keysRef = useKeyboardControls();

  // SFUのローカルゲーム状態を監視してUIを更新
  useEffect(() => {
    const { gameState } = sfu;

    // カウントダウン状態の反映
    if (gameState.countdown >= 0 && !gameState.gameStarted) {
      console.log(`⏰ Countdown: ${gameState.countdown}`);
    }

    // ゲーム開始状態の反映
    if (gameState.gameStarted && !gameStarted) {
      console.log('🎮 Game started locally');

      // NPCの数を計算（42 - 参加者数）
      const npcCount = Math.max(0, 42 - gameState.participantCount);
      if (npcCount > 0) {
        initMiniGames(npcCount);
      } else {
        setMiniGamesReady(true); // 42人満員の場合はNPCなし
      }
    }
  }, [sfu.gameState, gameStarted]);

  // 他のプレイヤーからの入力を受信
  useEffect(() => {
    sfu.receivedData.forEach(data => {
      if (data.type === 'playerInput') {
        console.log('📨 Received player input from', data.playerId, ':', data.payload);
        // 他のプレイヤーの入力を処理（必要に応じて実装）
      } else if (data.type === 'gameState') {
        console.log('📨 Received game state from', data.playerId, ':', data.payload);
        // 他のプレイヤーのゲーム状態を処理（必要に応じて実装）
      }
    });
  }, [sfu.receivedData]);

  // 他のプレイヤーからの入力を使ってミニゲームを更新
  useEffect(() => {
    sfu.receivedData.forEach(data => {
      if (data.type === 'gameState') {
        console.log('📨 Received game state from other player:', data.playerId);

        // 他のプレイヤーのゲーム状態をミニゲームに反映
        const playerIndex = Math.floor(Math.random() * miniGames.length);

        setMiniGames(prev => {
          const updated = [...prev];
          if (updated[playerIndex]) {
            updated[playerIndex] = {
              ...updated[playerIndex],
              gameState: {
                gameId: `player-${data.playerId}`,
                gameState: data.payload,
                isRunning: true,
                score: { player1: 0, player2: 0 }
              },
              active: true
            };
          }
          return updated;
        });
      }
    });
  }, [sfu.receivedData, miniGames.length]);

  // NPCの状態を監視（後で実装予定）
  // useEffect(() => {
  //   if (sfu.gameState.npcStates && sfu.gameState.npcStates.length > 0) {
  //     console.log('🤖 NPC states updated:', sfu.gameState.npcStates.length, 'NPCs');

  //     // NPCの状態をミニゲームに反映
  //     setMiniGames(prev => {
  //       const updated = [...prev];

  //       sfu.gameState.npcStates.forEach((npcState: any, index: number) => {
  //         if (index < updated.length && updated[index]) {
  //           updated[index] = {
  //             ...updated[index],
  //             gameState: npcState.gameState,
  //             active: npcState.active
  //           };
  //         }
  //       });

  //       return updated;
  //     });
  //   }
  // }, [sfu.gameState.npcStates]);

  // ミニゲーム更新ループ（WebRTC SFU経由でNPCManagerから更新を受信）
  useEffect(() => {
    if (!miniGamesReady || gameOver || !gameStarted) return;

    // WebRTC SFU経由でNPCの状態が更新される場合の処理は
    // 上記のnpcStatesの監視で処理される
    console.log('ℹ️ Mini games update now handled via WebRTC SFU');
  }, [miniGamesReady, gameOver, gameStarted]);

  // キーボード入力をSFUに送信
  const sendPlayerInput = useCallback(() => {
    if (sfu.connected && gameStarted) {
      const input = {
        up: keysRef.current.ArrowUp || keysRef.current.KeyW,
        down: keysRef.current.ArrowDown || keysRef.current.KeyS,
        attack: selectedTarget ?? undefined
      };

      // 入力に変化がある場合のみ送信
      if (input.up || input.down || input.attack !== undefined) {
        sfu.sendPlayerInput(input);
      }
    }
  }, [sfu, gameStarted, selectedTarget]);

  // ゲーム状態送信（60fps）
  useEffect(() => {
    if (!gameStarted || !sfu.connected || !engineRef.current) return;

    const sendGameState = () => {
      if (engineRef.current) {
        const gameState = engineRef.current.getState();
        sfu.sendGameState(gameState);
      }
    };

    const interval = setInterval(sendGameState, 1000 / 60); // 60fps
    return () => clearInterval(interval);
  }, [gameStarted, sfu, engineRef]);

  // 定期的にプレイヤー入力を送信
  useEffect(() => {
    if (!gameStarted) return;

    const inputInterval = setInterval(sendPlayerInput, 1000 / 60); // 60FPS
    return () => clearInterval(inputInterval);
  }, [gameStarted, sendPlayerInput]);

  // ミニゲーム初期化関数
  const initMiniGames = useCallback(async (npcCount: number) => {
    if (miniGames.length > 0) return; // 既に初期化済みの場合はスキップ

    console.log(`🎮 Starting miniGames initialization with ${npcCount} NPCs...`);
    const games: MiniGame[] = [];
    const miniCanvasSize = { width: 100, height: 100 };

    // NPCが0の場合（42人満員）はミニゲームを作成しない
    if (npcCount === 0) {
      console.log('⚠️ 42 participants detected, no mini-games needed');
      setMiniGamesReady(true);
      return;
    }

    // NPC数分のNPC vs NPCゲームを作成
    for (let i = 0; i < npcCount; i++) {
      const gameConfig: NPCGameConfig = {
        canvasWidth: 100, // ミニゲーム用キャンバス横幅
        canvasHeight: 100, // ミニゲーム用キャンバス縦幅
        paddleWidth: 10, // パドル幅をより小さく
        paddleHeight: 1.5, // パドル高さをより小さく
        ballRadius: 2, // ボールサイズをより小さく
        paddleSpeed: 6, // パドル速度を下げてより長いラリーを実現
        initialBallSpeed: 1.0, // 初期ボール速度を下げる
        maxBallSpeed: 2.5, // ボール最大速度を2.5に制限
        npc: {
          enabled: true,
          player: 1,
          mode: 'pid',
          difficulty: 'Easy',
        },
        npc2: {
          enabled: true,
          player: 2,
          mode: 'pid',
          difficulty: 'Nightmare', // HardからNightmareに変更
        },
      };

      try {
        console.log(`🎯 Creating game ${i}...`);
        const result = await npcManager.createGame(gameConfig);
        if (result.success && result.gameId) {
          console.log(`✅ Game ${i} created with ID: ${result.gameId}`);
          games.push({
            id: i,
            gameId: result.gameId,
            active: true,
            gameState: null,
            canvasSize: miniCanvasSize,
          });
        } else {
          console.error(`❌ Failed to create game ${i}:`, result.error);
          games.push({
            id: i,
            gameId: null,
            active: false,
            gameState: null,
            canvasSize: miniCanvasSize,
          });
        }
      } catch (error) {
        console.error(`💥 Error creating game ${i}:`, error);
        games.push({
          id: i,
          gameId: null,
          active: false,
          gameState: null,
          canvasSize: miniCanvasSize,
        });
      }
    }

    console.log(`🏁 MiniGames initialization complete. Created ${games.filter(g => g.active).length} active games.`);
    setMiniGames(games);
    setMiniGamesReady(true); // ミニゲーム初期化完了
  }, [miniGames.length, npcManager]);

  // SFUサーバーに接続
  useEffect(() => {
    console.log('🔗 Starting SFU connection process...');

    try {
      sfu.connect();
      console.log('🔗 SFU connect function called successfully');
    } catch (error) {
      console.error('❌ Error calling SFU connect:', error);
    }

    // クリーンアップ
    return () => {
      console.log('🔌 Cleaning up SFU connection...');
      sfu.disconnect();
    };
  }, []); // 初回のみ実行

  // 接続状態をログ出力
  useEffect(() => {
    console.log('🔗 SFU connected state changed:', sfu.connected);
  }, [sfu.connected]);

  // 接続完了後に部屋に参加
  useEffect(() => {
    if (sfu.connected) {
      console.log('✅ Connected to SFU server, preparing to join GamePong42 room...');

      const playerInfo = playerInfoRef.current; // 固定のプレイヤー情報を使用
      const roomNumber = 'gamepong42-room-1'; // 固定の部屋番号
      console.log('🏠 Attempting to join room:', roomNumber, 'with player info:', playerInfo);

      try {
        sfu.joinRoom(roomNumber, playerInfo);
        console.log('🏠 Joined room:', roomNumber);
      } catch (error) {
        console.error('❌ Error joining room:', error);
      }
    } else {
      console.log('⏳ Waiting for SFU connection to be established...');
    }
  }, [sfu.connected]);

  // ゲーム状態の監視
  useEffect(() => {
    console.log('🎮 Game state updated:', sfu.gameState);

    // ゲーム開始状態の反映
    if (sfu.gameState.gameStarted && !gameStarted) {
      console.log('🎮 Game started locally');

      // NPCを上側（Player1）のみに設定
      if (engineRef.current) {
        engineRef.current.updateNPCConfig({
          player: 1 as 1 | 2, // Player 1 (上)がNPC
          mode: 'pid' as any,
          enabled: true,
          difficulty: 'Normal' as any,
        });
      }

      // NPCの数を計算（42 - 参加者数）
      const npcCount = Math.max(0, 42 - sfu.gameState.participantCount);
      if (npcCount > 0) {
        initMiniGames(npcCount);
      } else {
        setMiniGamesReady(true); // 42人満員の場合はNPCなし
      }
    }
  }, [sfu.gameState, gameStarted, engineRef]);

  // 受信データの監視
  useEffect(() => {
    if (sfu.receivedData.length > 0) {
      console.log('📨 Received data:', sfu.receivedData);
    }
  }, [sfu.receivedData]);

  // ゲームループの統一管理
  useEffect(() => {
    if (!gameStarted) return;

    // パドルとボールの色を取得
    const getPaddleAndBallColor = () => {
      if (survivors < 33) return '#ffffff';
      return '#212121';
    };

    const handleScore = (scorer: 'player1' | 'player2') => {
      if (scorer === 'player1') { // NPCが勝利した場合
        setGameOver(true);
        setWinner(1);
      }
    };

    startGameLoop(handleScore, gameStarted, keysRef, getPaddleAndBallColor());
    return () => stopGameLoop();
  }, [gameStarted, startGameLoop, stopGameLoop, keysRef, survivors]);

  // ゲームエンジン初期化
  useEffect(() => {
    const handleResize = () => {
      initializeEngine();
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      stopGameLoop();
    };
  }, [initializeEngine, stopGameLoop]);

  const getBackgroundImage = () => {
    if (survivors >= 33) return '/images/background/noon.png';
    if (survivors >= 22) return '/images/background/evening.png';
    if (survivors >= 6) return '/images/background/late_night.png';
    return '/images/background/daybreak.png';
  };

  // パドルとボールの色を取得
  const getPaddleAndBallColor = () => {
    if (survivors < 33) return '#ffffff';
    return '#212121';
  };

  const handleScore = useCallback((scorer: 'player1' | 'player2') => {
    // GamePong42では得点システムではなく生存者システム
    if (scorer === 'player1') { // NPCが勝利した場合（Player1 = NPC）
      setGameOver(true);
      setWinner(1);
    }
    // プレイヤーが勝利した場合（Player2）は攻撃フェーズに移行
    if (scorer === 'player2') {
      // プレイヤーがNPCに勝利 - 自動攻撃実行
      executeAutoAttack();
    }
  }, [selectedTarget, survivors]);

  const executeAutoAttack = useCallback(async () => {
    if (selectedTarget !== null) {
      // Show attack animation from center to target opponent
      setAttackAnimation({ targetIndex: selectedTarget, duration: 1000 });
      setTimeout(() => setAttackAnimation(null), 1000);

      // 選択されたミニゲームにスピードブースト攻撃を適用
      const targetGame = miniGames[selectedTarget];
      if (targetGame?.active && targetGame.gameId) {
        try {
          await npcManager.applySpeedBoostToGame(targetGame.gameId);
        } catch (error) {
          console.error('Failed to apply speed boost:', error);
        }
      }

      // 新しいターゲットを選択（アクティブなゲームのみ）
      setTimeout(() => {
        const activeGames = miniGames.filter((game, index) => game.active && index !== selectedTarget);
        if (activeGames.length > 0) {
          const randomActiveGame = activeGames[Math.floor(Math.random() * activeGames.length)];
          const newTargetIndex = miniGames.findIndex(game => game.id === randomActiveGame.id);
          setSelectedTarget(newTargetIndex);
        }
      }, 1000);
    }
  }, [selectedTarget, miniGames, npcManager]);

  const handleStartGame = useCallback(() => {
    // NPCを上側（Player1）のみに設定
    if (engineRef.current) {
      engineRef.current.updateNPCConfig({
        player: 1 as 1 | 2, // Player 1 (上)がNPC
        mode: 'pid' as any, // getCurrentNPC() → 'pid'に変更（常にPID NPC）
        enabled: true,
        difficulty: 'Normal' as any,
      });
    }
  }, [engineRef]);

  // ゲームループの統一管理
  useEffect(() => {
    // カウントダウン中もゲームループを開始（プレイヤーのパドル操作のため）
    startGameLoop(handleScore, gameStarted, keysRef, getPaddleAndBallColor());

    return () => stopGameLoop();
  }, [gameStarted, startGameLoop, stopGameLoop, handleScore, keysRef, survivors]);

  // Show alert when survivors count reaches milestone
  useEffect(() => {
    if (survivors === 32 || survivors === 21 || survivors === 5) {
      setShowSurvivorsAlert(true);
      setTimeout(() => setShowSurvivorsAlert(false), 3000);
    }
  }, [survivors]);

  useEffect(() => {
    const handleResize = () => {
      initializeEngine();
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      stopGameLoop();
    };
  }, [initializeEngine, stopGameLoop]);

  useEffect(() => {
    if (gameOver && winner) {
      // ゲーム終了時にすべてのミニゲームを停止
      miniGames.forEach(async (game) => {
        if (game.gameId && game.active) {
          try {
            await npcManager.stopGame(game.gameId);
          } catch (error) {
            console.error(`Failed to stop game ${game.gameId}:`, error);
          }
        }
      });

      const t = setTimeout(() => navigate("GameResult"), 1200);
      return () => clearTimeout(t);
    }
  }, [gameOver, winner, navigate, miniGames, npcManager]);

  const handleTargetSelect = (index: number) => {
    if (miniGames[index]?.active) {
      setSelectedTarget(index);
    }
  };

  // Calculate target position for ray animation
  const getTargetPosition = (targetIndex: number) => {
    const isLeftSide = targetIndex < 21;
    const gridIndex = isLeftSide ? targetIndex : targetIndex - 21;
    const row = Math.floor(gridIndex / 3);
    const col = gridIndex % 3;

    const canvasSize = 12.8; // vmin
    const gap = 0.25; // rem converted to vmin approximation

    if (isLeftSide) {
      // Left side positioning
      const leftOffset = 4; // left-4 in vmin approximation
      const x = leftOffset + col * (canvasSize + gap) + canvasSize / 2;
      const y = 50 + (row - 3) * (canvasSize + gap); // centered vertically
      return { x: `${x}vmin`, y: `${y}vh` };
    } else {
      // Right side positioning
      const rightOffset = 4; // right-4 in vmin approximation
      const x = 100 - rightOffset - (2 - col) * (canvasSize + gap) - canvasSize / 2; // from right
      const y = 50 + (row - 3) * (canvasSize + gap); // centered vertically
      return { x: `${x}vw`, y: `${y}vh` };
    }
  };

  return (
    <div
      className="relative w-full h-screen overflow-hidden font-[Futura]"
      style={{
        backgroundImage: `url(${getBackgroundImage()})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-40"></div>

      {/* Waiting screen */}
      {isWaitingForGame && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-6xl font-bold mb-8">GamePong42</h1>
            <div className="text-3xl mb-4">Waiting for players...</div>
            <div className="text-2xl mb-4">
              Players: {sfu.gameState.participantCount} / 42
            </div>
            {countdown > 0 && (
              <div className="text-4xl font-bold animate-pulse">
                Game starts in: {countdown}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game UI */}
      {gameStarted && (
        <>
          {/* Left side opponents - 21 tables in 7x3 grid (21 out of 41) */}
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20">
            <div className="grid grid-cols-3 grid-rows-7 gap-3" style={{ width: "calc(3 * 12.8vmin + 2 * 0.75rem)", height: "90vmin" }}>
              {Array.from({ length: 21 }).map((_, i) => {
                const game = miniGames[i];
                const hasNPCGame = game?.active && game.gameState;
                const hasOtherPlayers = sfu.gameState.participantCount > 1;

                // NPC vs NPC ゲーム、または他のプレイヤーとの対戦を表示
                const shouldShowCanvas = hasNPCGame || (hasOtherPlayers && i < (41 - miniGames.length));

                if (!shouldShowCanvas) return null;

                const gameState = game?.gameState?.gameState; // NPCGameResponse.gameState
                const isUnderAttack = false; // スピードブースト状態は別途管理が必要
                const isPlayerVsPlayer = !hasNPCGame && hasOtherPlayers;

                return (
                  <div
                    key={`left-${i}`}
                    className={`cursor-pointer transition-all duration-200 relative ${
                      selectedTarget === i ? 'scale-105' : 'hover:scale-102'
                    } ${isUnderAttack ? 'ring-2 ring-red-500 ring-opacity-75' : ''}`}
                    style={{ width: "12.8vmin", height: "12.8vmin" }}
                    onClick={() => handleTargetSelect(i)}
                  >
                    {selectedTarget === i && (
                      <img
                        src="/images/icons/target_circle.svg"
                        alt="Target"
                        className="absolute inset-0 w-full h-full opacity-80 z-10"
                      />
                    )}

                    {/* 攻撃効果表示 */}
                    {isUnderAttack && (
                      <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-1 rounded-bl z-20">
                        BOOST
                      </div>
                    )}

                    {/* NPC Manager-based mini pong game */}
                    <div className="w-full h-full border border-white relative overflow-hidden" style={{
                      backgroundColor: isUnderAttack ? "rgba(255,0,0,0.2)" : "rgba(255,255,255,0.15)"
                    }}>
                      {gameState ? (
                        <>
                          {/* Player1 paddle */}
                          <div
                            className="absolute rounded"
                            style={{
                              left: `${Math.max(0, Math.min(100, (gameState.paddle1.x / gameState.canvasWidth) * 100))}%`,
                              top: `${Math.max(0, Math.min(100, (gameState.paddle1.y / gameState.canvasHeight) * 100))}%`,
                              width: `${Math.max(1, (gameState.paddle1.width / gameState.canvasWidth) * 100)}%`,
                              height: `${Math.max(1, (gameState.paddle1.height / gameState.canvasHeight) * 100)}%`,
                              backgroundColor: getPaddleAndBallColor()
                            }}
                          ></div>

                          {/* Player2 paddle */}
                          <div
                            className="absolute rounded"
                            style={{
                              left: `${Math.max(0, Math.min(100, (gameState.paddle2.x / gameState.canvasWidth) * 100))}%`,
                              top: `${Math.max(0, Math.min(100, (gameState.paddle2.y / gameState.canvasHeight) * 100))}%`,
                              width: `${Math.max(1, (gameState.paddle2.width / gameState.canvasWidth) * 100)}%`,
                              height: `${Math.max(1, (gameState.paddle2.height / gameState.canvasHeight) * 100)}%`,
                              backgroundColor: getPaddleAndBallColor()
                            }}
                          ></div>

                          {/* Ball */}
                          <div
                            className={`absolute rounded-full ${
                              isUnderAttack ? 'animate-pulse shadow-lg shadow-red-500' : ''
                            }`}
                            style={{
                              left: `${Math.max(0, Math.min(100, (gameState.ball.x / gameState.canvasWidth) * 100))}%`,
                              top: `${Math.max(0, Math.min(100, (gameState.ball.y / gameState.canvasHeight) * 100))}%`,
                              width: `${Math.max(1, (gameState.ball.radius * 2 / gameState.canvasWidth) * 100)}%`,
                              height: `${Math.max(1, (gameState.ball.radius * 2 / gameState.canvasHeight) * 100)}%`,
                              backgroundColor: isUnderAttack ? '#ff0000' : getPaddleAndBallColor()
                            }}
                          ></div>
                        </>
                      ) : (
                        /* Placeholder for player vs player battles */
                        <div className="w-full h-full flex items-center justify-center text-white text-xs">
                          {isPlayerVsPlayer ? 'P vs P' : 'Loading...'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Central canvas */}
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
            <canvas
              ref={canvasRef}
              className="bg-transparent"
              style={{
                width: '60vmin',
                height: '40vmin',
                maxWidth: '80vw',
                maxHeight: '60vh',
              }}
            />
          </div>

          {/* Right side opponents - 20 tables in 7x3 grid (positions 21-40 out of 41) */}
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20">
            <div className="grid grid-cols-3 grid-rows-7 gap-3" style={{ width: "calc(3 * 12.8vmin + 2 * 0.75rem)", height: "90vmin" }}>
              {Array.from({ length: 20 }).map((_, i) => {
                const gameIndex = i + 21; // Right side starts from index 21
                const game = miniGames[gameIndex];
                const hasNPCGame = game?.active && game.gameState;
                const hasOtherPlayers = sfu.gameState.participantCount > 1;

                const shouldShowCanvas = hasNPCGame || (hasOtherPlayers && gameIndex < (41 - miniGames.length));

                if (!shouldShowCanvas) return null;

                const gameState = game?.gameState?.gameState;
                const isUnderAttack = false;
                const isPlayerVsPlayer = !hasNPCGame && hasOtherPlayers;

                return (
                  <div
                    key={`right-${gameIndex}`}
                    className={`cursor-pointer transition-all duration-200 relative ${
                      selectedTarget === gameIndex ? 'scale-105' : 'hover:scale-102'
                    } ${isUnderAttack ? 'ring-2 ring-red-500 ring-opacity-75' : ''}`}
                    style={{ width: "12.8vmin", height: "12.8vmin" }}
                    onClick={() => handleTargetSelect(gameIndex)}
                  >
                    {selectedTarget === gameIndex && (
                      <img
                        src="/images/icons/target_circle.svg"
                        alt="Target"
                        className="absolute inset-0 w-full h-full opacity-80 z-10"
                      />
                    )}

                    {isUnderAttack && (
                      <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-1 rounded-bl z-20">
                        BOOST
                      </div>
                    )}

                    <div className="w-full h-full border border-white relative overflow-hidden" style={{
                      backgroundColor: isUnderAttack ? "rgba(255,0,0,0.2)" : "rgba(255,255,255,0.15)"
                    }}>
                      {gameState ? (
                        <>
                          <div
                            className="absolute rounded"
                            style={{
                              left: `${Math.max(0, Math.min(100, (gameState.paddle1.x / gameState.canvasWidth) * 100))}%`,
                              top: `${Math.max(0, Math.min(100, (gameState.paddle1.y / gameState.canvasHeight) * 100))}%`,
                              width: `${Math.max(1, (gameState.paddle1.width / gameState.canvasWidth) * 100)}%`,
                              height: `${Math.max(1, (gameState.paddle1.height / gameState.canvasHeight) * 100)}%`,
                              backgroundColor: getPaddleAndBallColor()
                            }}
                          ></div>

                          <div
                            className="absolute rounded"
                            style={{
                              left: `${Math.max(0, Math.min(100, (gameState.paddle2.x / gameState.canvasWidth) * 100))}%`,
                              top: `${Math.max(0, Math.min(100, (gameState.paddle2.y / gameState.canvasHeight) * 100))}%`,
                              width: `${Math.max(1, (gameState.paddle2.width / gameState.canvasWidth) * 100)}%`,
                              height: `${Math.max(1, (gameState.paddle2.height / gameState.canvasHeight) * 100)}%`,
                              backgroundColor: getPaddleAndBallColor()
                            }}
                          ></div>

                          <div
                            className={`absolute rounded-full ${
                              isUnderAttack ? 'animate-pulse shadow-lg shadow-red-500' : ''
                            }`}
                            style={{
                              left: `${Math.max(0, Math.min(100, (gameState.ball.x / gameState.canvasWidth) * 100))}%`,
                              top: `${Math.max(0, Math.min(100, (gameState.ball.y / gameState.canvasHeight) * 100))}%`,
                              width: `${Math.max(1, (gameState.ball.radius * 2 / gameState.canvasWidth) * 100)}%`,
                              height: `${Math.max(1, (gameState.ball.radius * 2 / gameState.canvasHeight) * 100)}%`,
                              backgroundColor: isUnderAttack ? '#ff0000' : getPaddleAndBallColor()
                            }}
                          ></div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-xs">
                          {isPlayerVsPlayer ? 'P vs P' : 'Loading...'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* UI Elements */}
          <div className="absolute top-4 left-4 text-white z-30">
            <div className="text-2xl font-bold">Survivors: {survivors}</div>
            <div className="text-sm">Players: {sfu.gameState.participantCount}</div>
          </div>

          {/* Attack Animation Ray */}
          {attackAnimation && (
            <div
              className="absolute pointer-events-none z-40"
              style={{
                left: '50%',
                top: '50%',
                width: '2px',
                height: '2px',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className="absolute bg-red-500 shadow-lg shadow-red-500 animate-pulse"
                style={{
                  width: '4px',
                  height: '200px',
                  transformOrigin: 'center bottom',
                  transform: `rotate(${Math.atan2(
                    parseFloat(getTargetPosition(attackAnimation.targetIndex).y.replace('vh', '')) - 50,
                    parseFloat(getTargetPosition(attackAnimation.targetIndex).x.replace(/v[mw]/, '')) - 50
                  )}rad)`,
                  transition: `opacity ${attackAnimation.duration}ms ease-out`,
                }}
              />
            </div>
          )}

          {/* Survivors Alert */}
          {showSurvivorsAlert && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 text-center">
              <div className="bg-black bg-opacity-75 text-white px-8 py-4 rounded-lg text-3xl font-bold animate-pulse">
                {survivors} Survivors Remaining!
              </div>
            </div>
          )}

          {/* Game Over Screen */}
          {gameOver && (
            <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
              <div className="text-center text-white">
                <h1 className="text-6xl font-bold mb-4">
                  {winner === 1 ? 'NPC Wins!' : 'You Win!'}
                </h1>
                <p className="text-2xl">Redirecting to results...</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GamePong42;
