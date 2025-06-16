import { useEffect, useRef, useCallback } from 'react';
import { GameEngine, GameConfig } from './gameEngine';

export const useGameEngine = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  config?: GameConfig
) => {
  const engineRef = useRef<GameEngine | null>(null);
  const animationRef = useRef<number | undefined>(undefined);

  const initializeEngine = useCallback(() => {
    console.log('initializeEngine called, canvasRef.current:', canvasRef.current);
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('Canvas ref is null, skipping initialization');
      return null;
    }

    // canvasの寸法情報をログ出力
    console.log('Canvas dimensions:', {
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      offsetWidth: canvas.offsetWidth,
      offsetHeight: canvas.offsetHeight,
      getBoundingClientRect: canvas.getBoundingClientRect()
    });

    const size = Math.min(window.innerWidth, window.innerHeight) * 0.9;
    console.log('Canvas size calculated:', size);
    canvas.width = size;
    canvas.height = size;

    if (!engineRef.current) {
      engineRef.current = new GameEngine(size, size, config);
      console.log('Created new GameEngine with size:', size);
    } else {
      // エンジンが既に存在する場合はキャンバスサイズを更新
      engineRef.current.updateCanvasSize(size, size);
      console.log('Updated existing GameEngine canvas size to:', size);
    }
    return engineRef.current;
  }, [canvasRef, config]);

  const startGameLoop = useCallback((
    onScore: (scorer: 'player1' | 'player2') => void,
    gameStarted: boolean,
    keysRef: React.RefObject<{ [key: string]: boolean }>,
    paddleAndBallColor?: string, // 色パラメータ
    isPVEMode?: boolean, // PVEモードかどうか
    remotePlayerInput?: { up: boolean; down: boolean; timestamp: number } | null, // マルチプレイヤー入力
    playerNumber?: 1 | 2 | 'spectator' | null // プレイヤー番号（観戦者を含む）
  ) => {
    console.log('startGameLoop called', {
      hasEngine: !!engineRef.current,
      hasCanvas: !!canvasRef.current,
      gameStarted,
      playerNumber
    });

    // エンジンが初期化されていない場合は初期化を試行
    if (!engineRef.current) {
      console.log('Engine not initialized, attempting to initialize...');
      const engine = initializeEngine();
      if (!engine) {
        console.error('Failed to initialize engine in startGameLoop');
        return;
      }
    }

    if (!canvasRef.current) {
      console.log('Missing canvas, cannot start game loop');
      return;
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) {
      console.log('Could not get canvas context');
      return;
    }

    const loop = () => {
      if (engineRef.current && gameStarted && keysRef.current) {
        // キーボード制御の処理
        const state = engineRef.current.getState();
        const speed = 8; // paddleSpeed

        // 観戦者モードの場合はキー入力を一切受け付けない
        if (playerNumber === 'spectator') {
          // 観戦者モード: キー入力は完全に無効
          // ゲーム状態の更新のみ行う（パドル移動なし）
        } else if (isPVEMode) {
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
            if (remotePlayerInput.up && state.paddle2.x > 0) {
              state.paddle2.x -= speed; // P2のup（左）
            }
            if (remotePlayerInput.down && state.paddle2.x + state.paddle2.width < state.canvasWidth) {
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
            if (remotePlayerInput.up && state.paddle1.x > 0) {
              state.paddle1.x -= speed; // P1のup（左）
            }
            if (remotePlayerInput.down && state.paddle1.x + state.paddle1.width < state.canvasWidth) {
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
          onScore(result);
        }
      }

      if (engineRef.current) {
        engineRef.current.draw(ctx, paddleAndBallColor || '#212121');
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
