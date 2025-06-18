import { useEffect, useRef, useCallback } from 'react';
import { GameEngine, GameConfig } from './gamePong42Engine';
import { PlayerInput } from './multiplayerServiceForGamePong42';

export const useGameEngine = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  config?: GameConfig
) => {
  const engineRef = useRef<GameEngine | null>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(performance.now()); // 時間ベース計算用のRef
  const isFirstFrameRef = useRef<boolean>(true); // 初回フレームを検出

  const initializeEngine = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const size = Math.min(window.innerWidth, window.innerHeight) * 0.9;
    canvas.width = size;
    canvas.height = size;

    if (!engineRef.current) {
      // エンジンが存在しない場合のみ新規作成（初期化時のみ）
      engineRef.current = new GameEngine(size, size, config);
    } else {
      // エンジンが既に存在する場合はボールとパドルの位置を保持してキャンバスサイズのみ更新
      // この更新はupdateCanvasSize内で既に相対位置を保持するよう修正済み
      engineRef.current.updateCanvasSize(size, size);
    }
    return engineRef.current;
  }, [canvasRef, config]);

  const startGameLoop = useCallback((
    onScore: (scorer: 'player1' | 'player2') => void,
    gameStarted: boolean,
    keysRef: React.RefObject<{ [key: string]: boolean }>,
    paddleAndBallColor?: string | (() => string), // 色パラメータ（文字列または関数）
    isPVEMode?: boolean, // PVEモード（npcEnabledに対応）
    remotePlayerInput?: PlayerInput | boolean | any, // リモートプレイヤー入力
    playerNumber?: number | 'spectator' | boolean, // プレイヤー番号
    gameSender?: (gameState: any) => void, // ゲーム状態送信関数（GamePong42専用）
  ) => {
    // 初回実行時にlastTimeRefを現在時刻に設定
    lastTimeRef.current = performance.now();
    isFirstFrameRef.current = true; // 初回フレームフラグをリセット

    // エンジンが初期化されていない場合は初期化を試行
    if (!engineRef.current) {
      const engine = initializeEngine();
      if (!engine) {
        console.error('Failed to initialize engine in startGameLoop');
        return;
      }
    }

    if (!canvasRef.current) {
      return;
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) {
      return;
    }

    const loop = () => {
      if (engineRef.current && gameStarted && keysRef.current) {
        // 時間ベース計算
        const currentTime = performance.now();
        const deltaTime = (currentTime - lastTimeRef.current) / 1000; // 秒単位
        lastTimeRef.current = currentTime;

        // 初回フレームまたは異常に大きなdeltaTimeをスキップ
        if (isFirstFrameRef.current || deltaTime > 0.1) { // 100ms以上の場合はスキップ
          isFirstFrameRef.current = false;
          requestAnimationFrame(loop);
          return;
        }

        // deltaTimeを制限して異常値を防ぐ
        const clampedDeltaTime = Math.min(deltaTime, 1/30); // 最大33ms (30fps)

        // キーボード制御の処理
        const state = engineRef.current.getState();
        const baseSpeed = 240; // pixels per second (NPCと統一)
        const speed = baseSpeed * clampedDeltaTime; // pixels per second * seconds = pixels

        // デバッグ用ログ（一時的）
        if (Math.random() < 0.01) { // 1%の確率でログ出力
          console.log('deltaTime:', deltaTime.toFixed(4), 'clampedDeltaTime:', clampedDeltaTime.toFixed(4), 'speed:', speed.toFixed(2));
        }

        // 観戦者モードの場合はキー入力を一切受け付けない
        if (playerNumber === 'spectator') {
          // 観戦者モード: キー入力は完全に無効
          // ゲーム状態の更新のみ行う（パドル移動なし）
        } else if (isPVEMode || (typeof playerNumber === 'boolean' && playerNumber)) {
          // PVEモード: Player1 = NPC, Player2 = プレイヤー
          // Player 2 controls (下のパドル)
          if (keysRef.current['arrowLeft'] || keysRef.current['a']) {
            if (state.paddle2.x > 0) {
              state.paddle2.x -= speed;
            }
          }
          if (keysRef.current['arrowRight'] || keysRef.current['d']) {
            if (state.paddle2.x + state.paddle2.width < state.canvasWidth) {
              state.paddle2.x += speed;
            }
          }
        } else if (remotePlayerInput && playerNumber && typeof playerNumber === 'number') {
          // マルチプレイヤーモード: プレイヤー番号に基づいて制御（観戦者を除く）
          if (playerNumber === 1) {
            // 自分がPlayer1（上のパドル）- 画面が180度回転しているので入力も反転
            if (keysRef.current['arrowLeft'] || keysRef.current['a']) {
              if (state.paddle1.x + state.paddle1.width < state.canvasWidth) {
                state.paddle1.x += speed; // 左キー → 右移動（画面回転により視覚的には左）
              }
            }
            if (keysRef.current['arrowRight'] || keysRef.current['d']) {
              if (state.paddle1.x > 0) {
                state.paddle1.x -= speed; // 右キー → 左移動（画面回転により視覚的には右）
              }
            }

            // リモートPlayer2（下のパドル）の入力を反映
            if (remotePlayerInput && typeof remotePlayerInput === 'object' && 'up' in remotePlayerInput && remotePlayerInput.up && state.paddle2.x > 0) {
              state.paddle2.x -= speed; // P2のup（左）
            }
            if (remotePlayerInput && typeof remotePlayerInput === 'object' && 'down' in remotePlayerInput && remotePlayerInput.down && state.paddle2.x + state.paddle2.width < state.canvasWidth) {
              state.paddle2.x += speed; // P2のdown（右）
            }
          } else if (playerNumber === 2) {
            // 自分がPlayer2（下のパドル）- 通常の制御
            if (keysRef.current['arrowLeft'] || keysRef.current['a']) {
              if (state.paddle2.x > 0) {
                state.paddle2.x -= speed;
              }
            }
            if (keysRef.current['arrowRight'] || keysRef.current['d']) {
              if (state.paddle2.x + state.paddle2.width < state.canvasWidth) {
                state.paddle2.x += speed;
              }
            }

            // リモートPlayer1（上のパドル）の入力を反映
            if (remotePlayerInput && typeof remotePlayerInput === 'object' && 'up' in remotePlayerInput && remotePlayerInput.up && state.paddle1.x > 0) {
              state.paddle1.x -= speed; // P1のup（左）
            }
            if (remotePlayerInput && typeof remotePlayerInput === 'object' && 'down' in remotePlayerInput && remotePlayerInput.down && state.paddle1.x + state.paddle1.width < state.canvasWidth) {
              state.paddle1.x += speed; // P1のdown（右）
            }
          }
        } else {
          // ローカルPVPモード: Player1 = プレイヤー, Player2 = プレイヤー
          // Player 1 controls (上のパドル) - WASDキー
          if (keysRef.current['a']) {
            if (state.paddle1.x > 0) {
              state.paddle1.x -= speed;
            }
          }
          if (keysRef.current['d']) {
            if (state.paddle1.x + state.paddle1.width < state.canvasWidth) {
              state.paddle1.x += speed;
            }
          }

          // Player 2 controls (下のパドル) - 矢印キー
          if (keysRef.current['arrowLeft']) {
            if (state.paddle2.x > 0) {
              state.paddle2.x -= speed;
            }
          }
          if (keysRef.current['arrowRight']) {
            if (state.paddle2.x + state.paddle2.width < state.canvasWidth) {
              state.paddle2.x += speed;
            }
          }
        }

        // パドル位置とplayers同期
        if (engineRef.current) {
          engineRef.current.syncPlayersPosition();
        }

        const result = engineRef.current.update();
        if (result !== 'none') {
          console.log('🎯🎯🎯 GamePong42Hooks: Score detected! About to call onScore with result:', result);
          console.log('🚨 This should trigger sendGameOver if result === "player1"');
          onScore(result);
        }
      }

      if (engineRef.current) {
        const color = typeof paddleAndBallColor === 'function' ? paddleAndBallColor() : (paddleAndBallColor || '#212121');
        engineRef.current.draw(ctx, color);
      }

      // ゲーム状態を60fpsで送信（GamePong42の場合は常に送信、観戦者モードは除く）
      if (gameSender && playerNumber !== 'spectator' && engineRef.current) {
        const gameState = engineRef.current.getState();
        // 毎フレーム確実に送信
        gameSender({
          paddle1: gameState.paddle1,
          paddle2: gameState.paddle2,
          ball: gameState.ball,
          canvasWidth: gameState.canvasWidth,
          canvasHeight: gameState.canvasHeight,
        });
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
  }, [canvasRef, initializeEngine]);

  const stopGameLoop = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  return {
    engineRef,
    initializeEngine,
    startGameLoop,
    stopGameLoop,
  };
};

export const useKeyboardControls = () => {
  const keysRef = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const keyMap: Record<string, string> = {
      'a': 'a',
      'd': 'd',
      'ArrowLeft': 'arrowLeft',
      'ArrowRight': 'arrowRight',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const mappedKey = keyMap[e.key];
      if (mappedKey) {
        e.preventDefault();
        keysRef.current[mappedKey] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const mappedKey = keyMap[e.key];
      if (mappedKey) {
        keysRef.current[mappedKey] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return keysRef;
};
