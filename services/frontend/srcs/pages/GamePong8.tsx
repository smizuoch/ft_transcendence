import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGameEngine, useKeyboardControls } from "@/utils/gameHooks";
import { DEFAULT_CONFIG } from "@/utils/gameEngine";
import { multiplayerService, type PlayerInput, type RoomState } from "@/utils/multiplayerService";

interface PlayerInfo {
  id: number | string;
  avatar: string;
  name?: string;
}

interface TournamentPlayer {
  playerId: string;
  playerInfo: PlayerInfo;
  seedPosition: number;
}

interface TournamentMatch {
  id: string;
  round: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  player1?: TournamentPlayer;
  player2?: TournamentPlayer;
  winner?: TournamentPlayer;
  roomNumber?: string;
}

interface Tournament {
  id: string;
  maxPlayers: number;
  players: TournamentPlayer[];
  bracket: TournamentMatch[][];
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt: Date;
  completedAt?: Date;
  winner?: TournamentPlayer;
  currentRound: number;
}

interface GamePong8Props {
  navigate: (page: string, userId?: string, roomNumber?: string) => void;
  players?: {
    player1: PlayerInfo;
    player2: PlayerInfo;
  };
}

const ICON_PATH = "/images/icons/";

const defaultPlayers = {
  player1: { id: 1, avatar: "/images/avatar/default_avatar.png", name: "Player 1" },
  player2: { id: 2, avatar: "/images/avatar/default_avatar1.png", name: "Player 2" },
};

const GamePong8: React.FC<GamePong8Props> = ({ players = defaultPlayers }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // ゲーム状態
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState({ player1: 0, player2: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<number | null>(null); // @ts-ignore unused variable
  
  // UI状態
  const [hoverClose, setHoverClose] = useState(false);
  const iconsDocked = false; // Fixed value to avoid unused variable warning
  
  // トーナメント状態
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [tournamentId, setTournamentId] = useState<string>('');
  const [isInTournament, setIsInTournament] = useState(false);
  const [tournamentRole, setTournamentRole] = useState<'player' | 'spectator' | null>(null);
  const [currentMatch, setCurrentMatch] = useState<TournamentMatch | null>(null);
  const [showTournamentLobby, setShowTournamentLobby] = useState(true);
  const [isEliminated, setIsEliminated] = useState(false);
  const [tournamentCompleted, setTournamentCompleted] = useState(false);
  const [tournamentWinner, setTournamentWinner] = useState<TournamentPlayer | null>(null);
  const [participants, setParticipants] = useState<{
    players: TournamentPlayer[];
    spectators: Array<{ playerId: string; playerInfo: PlayerInfo; joinedAt: Date }>;
  }>({ players: [], spectators: [] });
  
  // 通信対戦状態
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [playerNumber, setPlayerNumber] = useState<1 | 2 | 'spectator' | null>(null);
  const [remotePlayerInput, setRemotePlayerInput] = useState<PlayerInput | null>(null);
  const [isAuthoritativeClient, setIsAuthoritativeClient] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);

  const { engineRef, initializeEngine, startGameLoop, stopGameLoop } = useGameEngine(canvasRef as React.RefObject<HTMLCanvasElement>, DEFAULT_CONFIG);
  const keysRef = useKeyboardControls();

  // canvas refコールバックで確実に初期化
  const canvasRefCallback = useCallback((canvas: HTMLCanvasElement | null) => {
    if (canvas && !showTournamentLobby && !isEliminated) {
      canvasRef.current = canvas;
      console.log('Canvas attached, initializing engine...');
      setTimeout(() => {
        initializeEngine();
      }, 50);
    }
  }, [initializeEngine, showTournamentLobby, isEliminated]);

  // トーナメント通信のセットアップ
  useEffect(() => {
    const setupTournamentConnection = async () => {
      try {
        if (!multiplayerService.isConnectedToServer()) {
          await multiplayerService.connect();
        }

        // トーナメント関連のイベントリスナーを設定
        multiplayerService.on('tournament-created', (data: any) => {
          console.log('Tournament created:', data);
          setTournament(data.tournament);
          setTournamentId(data.tournamentId);
          setTournamentRole(data.role);
          setIsInTournament(true);
          setShowTournamentLobby(true);
        });

        multiplayerService.on('tournament-joined', (data: any) => {
          console.log('Tournament joined:', data);
          setTournament(data.tournament);
          setTournamentId(data.tournamentId);
          setTournamentRole(data.role);
          setIsInTournament(true);
          setParticipants(data.participants);
          setShowTournamentLobby(true);
        });

        multiplayerService.on('tournament-participant-joined', (data: any) => {
          console.log('New participant joined:', data);
          setParticipants(data.participants);
        });

        multiplayerService.on('tournament-started', (data: any) => {
          console.log('Tournament started:', data);
          setTournament(data.tournament);
          setShowTournamentLobby(false);
          
          // 自分の最初の試合を探す
          const myMatch = data.nextMatches.find((match: TournamentMatch) => 
            match.player1?.playerId === multiplayerService.getPlayerId() ||
            match.player2?.playerId === multiplayerService.getPlayerId()
          );
          
          if (myMatch) {
            setCurrentMatch(myMatch);
            // 試合部屋に自動参加
            joinMatchRoom(myMatch.roomNumber || '');
          }
        });

        multiplayerService.on('tournament-match-completed', (data: any) => {
          console.log('Match completed:', data);
          setTournament(data.tournament);
          
          // サーバーから送信される敗退/勝利情報を確認
          const isWinner = data.isWinner;
          const isEliminated = data.isEliminated;
          
          console.log(`Match completed - IsWinner: ${isWinner}, IsEliminated: ${isEliminated}`);
          
          // 試合完了後、ゲーム状態をリセット
          setGameStarted(false);
          setGameOver(true);
          
          // 敗退した場合は即座にリザルト画面へ
          if (isEliminated) {
            console.log('Player eliminated, setting elimination state');
            setIsEliminated(true);
            setShowTournamentLobby(false);
            
            // マルチプレイヤー状態をリセット
            setIsMultiplayer(false);
            setPlayerNumber(null);
            setIsAuthoritativeClient(false);
            setIsSpectator(false);
            
            // ゲームエンジンのクリーンアップ
            stopGameLoop();
            if (engineRef.current) {
              engineRef.current.cleanup();
            }
          } else if (isWinner) {
            console.log('Player won, returning to lobby to wait for next round');
            setShowTournamentLobby(true);
            
            // 勝者は次のラウンド待機状態
            setIsMultiplayer(false);
            setPlayerNumber(null);
            setIsAuthoritativeClient(false);
            setIsSpectator(false);
            
            // ゲームエンジンのクリーンアップ
            stopGameLoop();
            if (engineRef.current) {
              engineRef.current.cleanup();
            }
          }
        });

        multiplayerService.on('tournament-round-advanced', (data: any) => {
          console.log('Round advanced:', data);
          
          // 敗退済みのプレイヤーは無視
          if (isEliminated) {
            console.log('Already eliminated, ignoring round advancement');
            return;
          }
          
          setTournament(data.tournament);
          
          // 現在の試合を終了状態にリセット
          setGameStarted(false);
          setGameOver(false);
          setWinner(null);
          setScore({ player1: 0, player2: 0 });
          
          // 前の試合から確実に離脱
          stopGameLoop();
          if (engineRef.current) {
            engineRef.current.cleanup();
          }
          
          // 次の試合は data.currentMatch で指定される（サーバーから個別送信）
          const myNextMatch = data.currentMatch;
          
          if (myNextMatch) {
            console.log('Found next match, advancing to next round:', myNextMatch);
            setCurrentMatch(myNextMatch);
            
            // プレイヤー番号を再設定
            const myPlayerId = multiplayerService.getPlayerId();
            const newPlayerNumber = myNextMatch.player1?.playerId === myPlayerId ? 1 : 2;
            setPlayerNumber(newPlayerNumber);
            console.log('Player number for next match:', newPlayerNumber);
            
            // UIを完全にリセット
            setGameOver(false);
            setWinner(null);
            setScore({ player1: 0, player2: 0 });
            setIsEliminated(false);
            setIsMultiplayer(false); // 一度リセット
            setIsAuthoritativeClient(false);
            setIsSpectator(false);
            
            // トーナメントロビーに戻す（次の試合開始まで待機）
            setShowTournamentLobby(true);
            
            // 少し遅延を入れてから試合部屋に参加
            setTimeout(() => {
              joinMatchRoom(myNextMatch.roomNumber || '');
            }, 2000);
          } else {
            console.log('No next match found for this player in round advancement');
            // ここには来ないはず（該当プレイヤーのみがこのイベントを受けるため）
          }
        });

        multiplayerService.on('tournament-completed', (data: any) => {
          console.log('Tournament completed:', data);
          setTournament(data.tournament);
          setTournamentCompleted(true);
          setTournamentWinner(data.winner);
          setIsInTournament(false);
          setShowTournamentLobby(false);
          setGameStarted(false);
          setGameOver(true);
          
          // マルチプレイヤー状態をリセット
          setIsMultiplayer(false);
          setPlayerNumber(null);
          setIsAuthoritativeClient(false);
          setIsSpectator(false);
          
          console.log(`Tournament completed! Winner: ${data.winner?.playerInfo.name || '不明'}`);
        });

        // エラーハンドリング
        multiplayerService.on('error', (error: any) => {
          console.error('MultiplayerService error:', error);
          alert('エラーが発生しました: ' + (error.message || error));
        });

        // 通常のゲーム部屋のイベントリスナー
        multiplayerService.on('roomJoined', (data: RoomState) => {
          console.log('Joined room event received:', data);
          setPlayerNumber(data.playerNumber);
          setIsSpectator(data.isSpectator || data.playerNumber === 'spectator');
          console.log(`Joined match room as ${data.isSpectator ? 'spectator' : `player ${data.playerNumber}`}`);
          
          const isAuth = data.playerNumber === 1 && !data.isSpectator;
          setIsAuthoritativeClient(isAuth);
          console.log('Is authoritative client:', isAuth);
          
          if (currentMatch) {
            const myPlayerId = multiplayerService.getPlayerId();
            const actualPlayerNumber = currentMatch.player1?.playerId === myPlayerId ? 1 : 2;
            console.log('Correcting player number based on match info:', { 
              roomPlayerNumber: data.playerNumber,
              actualPlayerNumber,
              myPlayerId,
              player1Id: currentMatch.player1?.playerId,
              player2Id: currentMatch.player2?.playerId
            });
            
            if (actualPlayerNumber !== data.playerNumber && !data.isSpectator) {
              setPlayerNumber(actualPlayerNumber);
              setIsAuthoritativeClient(actualPlayerNumber === 1);
              console.log('Setting authoritative client based on match info:', actualPlayerNumber === 1);
            } else {
              setIsAuthoritativeClient(isAuth);
              console.log('Setting authoritative client based on room data:', isAuth);
            }
          } else {
            setIsAuthoritativeClient(isAuth);
            console.log('Setting authoritative client (no match info):', isAuth);
          }
          
          // エンジンが存在する場合は設定
          if (engineRef.current) {
            engineRef.current.setAuthoritativeClient(isAuth);
          }
          
          setIsMultiplayer(true);
          
          // 部屋参加時にUIを完全リセット
          setGameStarted(false);
          setGameOver(false);
          setScore({ player1: 0, player2: 0 });
          setWinner(null);
          setIsEliminated(false);
        });

        multiplayerService.on('gameStarted', (data: any) => {
          console.log('Match game started:', data);
          // ゲーム開始前にエンジンを初期化
          const engine = initializeEngine();
          if (!engine) {
            console.error('Failed to initialize game engine for multiplayer match');
            return;
          }
          
          // ボールの初期化とゲーム開始
          engine.resetBall();
          console.log('Ball reset for game start, ball state:', engine.getState().ball);
          
          // ゲーム状態を完全リセット
          setGameStarted(true);
          setGameOver(false);
          setWinner(null);
          setScore({ player1: 0, player2: 0 });
          setIsEliminated(false);
        });

        multiplayerService.on('gameEnded', (data: any) => {
          console.log('Match game ended:', data);
          console.log('Current tournament state:', { tournamentId, currentMatch, isInTournament });
          
          // スコアと勝者を確実に設定
          if (data.finalScores) {
            setScore(data.finalScores);
            console.log('Final scores set:', data.finalScores);
          }
          setGameOver(true);
          setWinner(data.winner);
          
          // ゲームを停止
          setGameStarted(false);
          
          // 自分が勝者か敗者かを判定
          const myPlayerId = multiplayerService.getPlayerId();
          let isWinner = false;
          
          if (currentMatch) {
            if (data.winner === 1 && currentMatch.player1?.playerId === myPlayerId) {
              isWinner = true;
            } else if (data.winner === 2 && currentMatch.player2?.playerId === myPlayerId) {
              isWinner = true;
            }
          }
          
          console.log('Match result for current player:', { 
            myPlayerId, 
            winner: data.winner, 
            isWinner,
            player1Id: currentMatch?.player1?.playerId,
            player2Id: currentMatch?.player2?.playerId
          });
          
          // トーナメントの場合は結果を報告（勝者のみ）
          if (isWinner && currentMatch && tournamentId && isInTournament) {
            const winnerId = data.winner === 1 ? 
              currentMatch.player1?.playerId : 
              currentMatch.player2?.playerId;
            
            if (winnerId) {
              console.log('Reporting tournament result as winner:', { 
                tournamentId, 
                matchId: currentMatch.id, 
                winnerId
              });
              
              multiplayerService.reportTournamentResult(tournamentId, currentMatch.id, winnerId);
            }
          }
          
          // 結果の処理はtournament-match-completedイベントで行う
          // ここでは基本的なゲーム終了処理のみ
        });

        multiplayerService.on('playerInputUpdate', (data: any) => {
          if (data.playerNumber !== playerNumber) {
            setRemotePlayerInput(data.input);
          }
        });

        multiplayerService.on('scoreUpdated', (data: any) => {
          console.log('Score updated event received:', data);
          if (data.scores) {
            console.log('Setting scores from scoreUpdated:', data.scores);
            setScore(data.scores);
          } else if (data.scorer) {
            // 個別スコア更新の場合
            setScore((prev: { player1: number; player2: number }) => {
              const scorer = data.scorer as 'player1' | 'player2';
              const newScore = { ...prev, [scorer]: prev[scorer] + 1 };
              console.log('Updated score from scoreUpdated event:', newScore);
              return newScore;
            });
          }
          
          if (data.gameOver) {
            setGameOver(true);
            setWinner(data.winner);
            console.log('Game ended via scoreUpdated event, winner:', data.winner);
          }
        });

        // ゲーム状態の完全同期
        multiplayerService.on('gameStateUpdate', (data: any) => {
          if (engineRef.current && data.gameState && !isAuthoritativeClient) {
            console.log('Non-authoritative client received game state update');
            engineRef.current.syncWithRemoteState(data.gameState);
          }
        });

        // 完全なゲーム状態の同期（ハイフン付きイベント名）
        multiplayerService.on('fullGameStateUpdate', (data: any) => {
          if (engineRef.current && data.gameState && !isAuthoritativeClient) {
            console.log('Non-authoritative client received full game state update:', data.gameState);
            engineRef.current.syncWithRemoteState(data.gameState);
            // スコアも同期
            if (data.gameState.score) {
              console.log('Syncing score:', data.gameState.score);
              setScore(data.gameState.score);
            }
          }
        });

      } catch (error) {
        console.error('Failed to setup tournament connection:', error);
      }
    };

    setupTournamentConnection();
  }, []);

  // 試合部屋に参加
  const joinMatchRoom = async (roomNum: string) => {
    try {
      console.log(`Attempting to join match room: ${roomNum}`);
      
      const playerInfo = {
        id: '',
        avatar: players.player2.avatar,
        name: players.player2.name || 'Player'
      };

      await multiplayerService.joinRoom(roomNum, playerInfo);
      console.log(`Successfully joined match room: ${roomNum}`);
      
      // 部屋参加後に状態を完全にリセット
      setGameStarted(false);
      setGameOver(false);
      setScore({ player1: 0, player2: 0 });
      setWinner(null);
      setIsMultiplayer(true);
      setIsEliminated(false);
      
      // UIをゲーム画面に切り替え
      setShowTournamentLobby(false);
      
    } catch (error) {
      console.error('Failed to join match room:', error);
    }
  };

  // トーナメント作成
  const handleCreateTournament = async (maxPlayers: number) => {
    try {
      console.log('Creating tournament with', maxPlayers, 'players');
      
      // 接続状態を確認
      if (!multiplayerService.isConnectedToServer()) {
        console.log('Not connected, attempting to connect...');
        await multiplayerService.connect();
        console.log('Connected successfully');
      }

      const playerInfo = {
        id: '',
        avatar: players.player1.avatar,
        name: players.player1.name || 'Tournament Host'
      };

      console.log('Sending create tournament request with playerInfo:', playerInfo);
      multiplayerService.createTournament(maxPlayers, playerInfo);
    } catch (error) {
      console.error('Failed to create tournament:', error);
      alert('トーナメントの作成に失敗しました: ' + error);
    }
  };

  // トーナメント参加
  const handleJoinTournament = async () => {
    if (!tournamentId) {
      alert('トーナメントIDを入力してください');
      return;
    }

    try {
      const playerInfo = {
        id: '',
        avatar: players.player2.avatar,
        name: players.player2.name || 'Player'
      };

      multiplayerService.joinTournament(tournamentId, playerInfo);
    } catch (error) {
      console.error('Failed to join tournament:', error);
    }
  };

  // トーナメント開始
  const handleStartTournament = () => {
    if (!tournamentId) return;

    multiplayerService.startTournament(tournamentId);
  };

  // ゲーム関連の既存ロジック
  useEffect(() => {
    // トーナメントロビーが表示されている間やプレイヤーが敗退した場合はエンジンを初期化しない
    if (showTournamentLobby || isEliminated) return;
    
    const handleResize = () => {
      console.log('Initializing engine, canvas ref:', canvasRef.current);
      initializeEngine();
    };

    window.addEventListener("resize", handleResize);
    // 遅延して初期化を実行（canvasがDOMに確実に存在するように）
    const timeoutId = setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
      stopGameLoop();
    };
  }, [initializeEngine, stopGameLoop, showTournamentLobby, isEliminated]);

  // showTournamentLobbyが変更された時にエンジンを初期化
  useEffect(() => {
    if (!showTournamentLobby && !isEliminated && canvasRef.current) {
      console.log('Tournament lobby closed, initializing engine...');
      
      // 複数回試行して確実に初期化
      let attempts = 0;
      const maxAttempts = 5;
      
      const tryInitialize = () => {
        attempts++;
        console.log(`Initialization attempt ${attempts}/${maxAttempts}`);
        
        const engine = initializeEngine();
        if (engine) {
          console.log('Engine successfully initialized');
          return;
        }
        
        if (attempts < maxAttempts) {
          setTimeout(tryInitialize, 100);
        } else {
          console.error('Failed to initialize engine after', maxAttempts, 'attempts');
        }
      };
      
      setTimeout(tryInitialize, 100);
    }
  }, [showTournamentLobby, isEliminated, initializeEngine]);

  const handleScore = useCallback((scorer: 'player1' | 'player2') => {
    console.log('handleScore called with scorer:', scorer);
    setScore((prev: { player1: number; player2: number }) => {
      const newScore = { ...prev, [scorer]: prev[scorer] + 1 };
      console.log('Updated score state:', newScore);
      
      if (newScore[scorer] >= DEFAULT_CONFIG.winningScore) {
        setGameOver(true);
        const winnerNumber = scorer === 'player1' ? 1 : 2;
        setWinner(winnerNumber);
        console.log('Game over! Winner:', scorer, 'Winner number:', winnerNumber);
        
        // トーナメント中の場合、結果を報告
        if (currentMatch && tournamentId && isInTournament && isMultiplayer) {
          const winnerId = winnerNumber === 1 ? 
            currentMatch.player1?.playerId : 
            currentMatch.player2?.playerId;
          
          if (winnerId) {
            console.log('Reporting tournament result from handleScore:', { 
              tournamentId, 
              matchId: currentMatch.id, 
              winnerId,
              winnerNumber
            });
            
            // 少し遅延を入れて結果を報告
            setTimeout(() => {
              multiplayerService.reportTournamentResult(tournamentId, currentMatch.id, winnerId);
            }, 500);
          }
        }
      }
      return newScore;
    });
  }, [currentMatch, tournamentId, isInTournament, isMultiplayer]);

  // マルチプレイヤー用のスコア更新コールバック（サーバーに送信）
  const handleMultiplayerScore = useCallback((scorer: 'player1' | 'player2') => {
    console.log('handleMultiplayerScore called with scorer:', scorer);
    if (multiplayerService && multiplayerService.isConnectedToServer()) {
      console.log('Sending score update to server:', scorer);
      multiplayerService.sendScoreUpdate(scorer);
    }
  }, []);

  useEffect(() => {
    if (gameStarted) {
      if (isMultiplayer) {
        // マルチプレイヤーゲーム
        if (!isSpectator && multiplayerService.isPlayer()) {
          const sendInputs = () => {
            if (keysRef.current) {
              let up = false;
              let down = false;

              if (playerNumber === 1) {
                up = keysRef.current['arrowLeft'] || keysRef.current['a'];
                down = keysRef.current['arrowRight'] || keysRef.current['d'];
              } else if (playerNumber === 2) {
                up = keysRef.current['arrowLeft'] || keysRef.current['a'];
                down = keysRef.current['arrowRight'] || keysRef.current['d'];
              }

              multiplayerService.sendPlayerInput({
                up: up || false,
                down: down || false,
                timestamp: Date.now()
              });
            }
          };
          
          const inputInterval = setInterval(sendInputs, 16);
          
          // 権威クライアントのみゲームループを実行、その他は描画のみ
          if (isAuthoritativeClient) {
            console.log('Starting authoritative client game loop');
            startGameLoop(handleScore, gameStarted, keysRef, '#212121', false, remotePlayerInput, playerNumber);
          } else {
            console.log('Starting non-authoritative client - display only');
            // 非権威クライアントは描画のみ
            const renderLoop = () => {
              if (engineRef.current && canvasRef.current && gameStarted) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                  engineRef.current.draw(ctx, '#212121');
                }
              }
              requestAnimationFrame(renderLoop);
            };
            requestAnimationFrame(renderLoop);
          }

          return () => {
            clearInterval(inputInterval);
            stopGameLoop();
          };
        } else if (isSpectator) {
          const emptyKeysRef = { current: {} };
          startGameLoop(handleScore, gameStarted, emptyKeysRef, '#212121', false, remotePlayerInput, 'spectator');
        }
      } else {
        // ローカルゲーム（トーナメントテスト用）
        console.log('Starting local game loop for tournament test');
        startGameLoop(handleScore, gameStarted, keysRef, '#212121', false, null, null);
      }
    } else {
      stopGameLoop();
    }

    return () => stopGameLoop();
  }, [gameStarted, startGameLoop, stopGameLoop, handleScore, keysRef, isMultiplayer, isSpectator, remotePlayerInput, playerNumber]);

  useEffect(() => {
    if (gameStarted) {
      if (isMultiplayer && engineRef.current) {
        if (isAuthoritativeClient) {
          console.log('Setting up authoritative client callbacks');
          
          // 権威クライアントのGameEngineにスコア更新コールバックを設定
          engineRef.current.setScoreUpdateCallback((scorer: 'player1' | 'player2') => {
            console.log('Score update from game engine, sending to server:', scorer);
            handleMultiplayerScore(scorer);
          });
          
          // ゲーム状態の定期送信（60fps）
          const gameStateInterval = setInterval(() => {
            if (engineRef.current) {
              const gameState = engineRef.current.getGameState();
              multiplayerService.sendFullGameState(gameState);
            }
          }, 16); // 約60fps

          engineRef.current.setScoreUpdateCallback((scorer: 'player1' | 'player2') => {
            console.log('Score update from authoritative client:', scorer);
            multiplayerService.sendScoreUpdate(scorer);
          });

          return () => {
            clearInterval(gameStateInterval);
          };
        } else {
          // 非権威クライアントの初期化
          console.log('Initializing non-authoritative client');
          engineRef.current.setAuthoritativeClient(false);
        }
      }
    }
  }, [gameStarted, isMultiplayer, isAuthoritativeClient, handleMultiplayerScore]);

  const handleStartMatch = () => {
    console.log('handleStartMatch called', { 
      isMultiplayer, 
      currentMatch: !!currentMatch, 
      isInTournament 
    });
    
    // ゲーム開始前にエンジンを初期化
    const engine = initializeEngine();
    if (!engine) {
      console.error('Failed to initialize game engine');
      return;
    }
    
    if (isMultiplayer && currentMatch) {
      console.log('Starting multiplayer game');
      multiplayerService.startGame();
    } else if (isInTournament) {
      // トーナメントのローカルテストモード
      console.log('Starting local tournament game');
      const engine = initializeEngine();
      if (engine) {
        engine.resetBall();
        console.log('Ball reset for local tournament, ball state:', engine.getState().ball);
      }
      setGameStarted(true);
      setGameOver(false);
      setWinner(null);
      setScore({ player1: 0, player2: 0 });
    } else {
      // 通常のローカルゲーム
      console.log('Starting regular local game');
      const engine = initializeEngine();
      if (engine) {
        engine.resetBall();
        console.log('Ball reset for local game, ball state:', engine.getState().ball);
      }
      setGameStarted(true);
      setGameOver(false);
      setWinner(null);
      setScore({ player1: 0, player2: 0 });
    }
  };

  const renderAvatarGroup = (idx: 1 | 2, side: "left" | "right") => {
    let displayedScore;
    let avatarPlayerKey: "player1" | "player2";
    
    if (isMultiplayer && playerNumber) {
      const isMyScore = (side === "left");
      if (isMyScore) {
        displayedScore = playerNumber === 1 ? score.player1 : score.player2;
        avatarPlayerKey = playerNumber === 1 ? "player1" : "player2";
      } else {
        displayedScore = playerNumber === 1 ? score.player2 : score.player1;
        avatarPlayerKey = playerNumber === 1 ? "player2" : "player1";
      }
    } else {
      displayedScore = idx === 1 ? score.player1 : score.player2;
      avatarPlayerKey = idx === 1 ? "player1" : "player2";
    }
    
    const pts = displayedScore;
    const translateClass = side === "left"
      ? (iconsDocked ? "-translate-x-full" : "")
      : (iconsDocked ? "translate-x-full" : "");
    const positionClass = side === "left"
      ? "left-0 bottom-16"
      : "right-0 top-16";
    const initialPosition = iconsDocked ? "" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2";

    return (
      <div
        className={`absolute flex items-center gap-3 select-none pointer-events-none transition-all duration-700 ease-out ${
          side === "right" ? "flex-row-reverse" : ""
        } ${iconsDocked ? positionClass : initialPosition} ${translateClass}`}
      >
        {pts >= DEFAULT_CONFIG.winningScore ? (
          <img src={`${ICON_PATH}win.svg`} alt="win" className="w-12 h-12 lg:w-16 lg:h-16" />
        ) : (
          <span className="text-white font-extrabold text-6xl lg:text-8xl leading-none">{pts}</span>
        )}
        <img
          src={players[avatarPlayerKey].avatar}
          alt="avatar"
          className="w-12 h-12 lg:w-16 lg:h-16 rounded-full shadow-lg"
        />
      </div>
    );
  };

  return (
    <div className="relative w-full h-screen overflow-hidden font-[Futura]">
      {/* BG cover */}
      <img
        src="/images/background/noon.png"
        alt="bg"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* central content */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {/* Tournament Completed Screen */}
        {tournamentCompleted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75">
            <div className="bg-white bg-opacity-90 p-8 rounded-lg max-w-2xl w-full mx-4 text-center">
              <h1 className="text-4xl font-bold mb-6 text-black">
                🏆 トーナメント終了！ 🏆
              </h1>
              <div className="mb-6">
                <div className="text-2xl text-green-600 font-bold mb-4">
                  優勝者: {tournamentWinner?.playerInfo.name || '不明'}
                </div>
                <img 
                  src={tournamentWinner?.playerInfo.avatar || '/images/avatar/default_avatar.png'} 
                  alt="winner avatar" 
                  className="w-24 h-24 rounded-full mx-auto mb-4"
                />
                <p className="text-lg text-gray-600">
                  おめでとうございます！
                </p>
              </div>
              
              <button
                onClick={() => {
                  // ホーム画面に戻る
                  window.location.reload();
                }}
                className="px-8 py-3 bg-green-600 text-white rounded hover:bg-green-700"
              >
                ホームに戻る
              </button>
            </div>
          </div>
        )}

        {/* Eliminated Player Screen */}
        {isEliminated && !tournamentCompleted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75">
            <div className="bg-white bg-opacity-90 p-8 rounded-lg max-w-2xl w-full mx-4 text-center">
              <h1 className="text-3xl font-bold mb-6 text-black">
                トーナメント結果
              </h1>
              <div className="mb-6">
                <p className="text-xl text-gray-700 mb-4">お疲れさまでした！</p>
                <p className="text-lg text-gray-600">
                  あなたはトーナメントから敗退しました。
                </p>
              </div>
              
              {tournament && (
                <div className="mb-6 space-y-3">
                  <h3 className="text-lg font-semibold text-black">トーナメント状況</h3>
                  <p className="text-gray-600">
                    状態: {tournament.status === 'IN_PROGRESS' ? '進行中' : '完了'}
                  </p>
                  {tournament.status === 'COMPLETED' && tournament.winner && (
                    <p className="text-green-600 font-bold">
                      優勝者: {tournament.winner.playerInfo.name}
                    </p>
                  )}
                </div>
              )}
              
              <button
                onClick={() => {
                  // ホーム画面に戻る（navigate実装があれば使用）
                  window.location.reload();
                }}
                className="px-8 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                ホームに戻る
              </button>
            </div>
          </div>
        )}

        {/* Tournament Lobby */}
        {showTournamentLobby && !gameStarted && !isEliminated && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75">
            <div className="bg-white bg-opacity-90 p-8 rounded-lg max-w-2xl w-full mx-4">
              <h1 className="text-3xl font-bold mb-6 text-center text-black">
                Pong Tournament (8 Players Max)
              </h1>
              
              {!isInTournament ? (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-xl mb-4 text-black">トーナメントを作成または参加</h2>
                    <div className="flex flex-col gap-4">
                      <button
                        onClick={() => handleCreateTournament(8)}
                        className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        8人トーナメントを作成
                      </button>
                      <button
                        onClick={() => handleCreateTournament(4)}
                        className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        4人トーナメントを作成
                      </button>
                    </div>
                  </div>
                  
                  <div className="border-t pt-6">
                    <h3 className="text-lg mb-3 text-black">既存のトーナメントに参加</h3>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={tournamentId}
                        onChange={(e) => setTournamentId(e.target.value)}
                        placeholder="トーナメントID"
                        className="flex-1 px-3 py-2 border rounded text-black"
                      />
                      <button
                        onClick={handleJoinTournament}
                        className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        参加
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-xl mb-2 text-black">
                      トーナメント ID: {tournamentId}
                    </h2>
                    <p className="text-gray-600">
                      あなたの役割: {tournamentRole === 'player' ? 'プレイヤー' : '観戦者'}
                    </p>
                    <p className="text-gray-600">
                      状態: {tournament?.status === 'WAITING' ? '待機中' : 
                             tournament?.status === 'IN_PROGRESS' ? '進行中' : '完了'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-black">
                        プレイヤー ({participants.players.length}/{tournament?.maxPlayers})
                      </h3>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {participants.players.map((player, idx) => (
                          <div key={player.playerId} className="flex items-center gap-2 p-2 bg-gray-100 rounded">
                            <img 
                              src={player.playerInfo.avatar} 
                              alt="avatar" 
                              className="w-8 h-8 rounded-full"
                            />
                            <span className="text-black">{player.playerInfo.name || `Player ${idx + 1}`}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-black">
                        観戦者 ({participants.spectators.length})
                      </h3>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {participants.spectators.map((spectator, idx) => (
                          <div key={spectator.playerId} className="flex items-center gap-2 p-2 bg-gray-100 rounded">
                            <img 
                              src={spectator.playerInfo.avatar} 
                              alt="avatar" 
                              className="w-8 h-8 rounded-full"
                            />
                            <span className="text-black">{spectator.playerInfo.name || `Spectator ${idx + 1}`}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {tournament?.status === 'WAITING' && participants.players.length >= 2 && (
                    <div className="text-center">
                      <button
                        onClick={handleStartTournament}
                        className="px-8 py-3 bg-red-600 text-white rounded hover:bg-red-700 text-lg"
                      >
                        トーナメント開始
                      </button>
                    </div>
                  )}

                  {tournament?.status === 'IN_PROGRESS' && currentMatch && (
                    <div className="text-center">
                      <h3 className="text-lg mb-3 text-black">あなたの次の試合</h3>
                      <p className="text-gray-600 mb-4">
                        Round {currentMatch.round}: {currentMatch.player1?.playerInfo.name} vs {currentMatch.player2?.playerInfo.name}
                      </p>
                      <p className="text-gray-600 mb-4">
                        部屋番号: {currentMatch.roomNumber}
                      </p>
                      <button
                        onClick={() => setShowTournamentLobby(false)}
                        className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        試合開始
                      </button>
                    </div>
                  )}
                  
                  {tournament?.status === 'IN_PROGRESS' && !currentMatch && !isEliminated && (
                    <div className="text-center">
                      <h3 className="text-lg mb-3 text-black">次のラウンドを待機中...</h3>
                      <p className="text-gray-600 mb-4">
                        現在のラウンドの試合が終了するまでお待ちください
                      </p>
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Game Canvas */}
        {!showTournamentLobby && !isEliminated && !tournamentCompleted && (
          <div className="relative" style={{ width: "90vmin", height: "90vmin" }}>
            <canvas 
              ref={canvasRefCallback}
              className={`w-full h-full border border-white ${playerNumber === 1 ? 'rotate-180' : ''}`}
            />

            {/* Winner Display */}
            {gameOver && winner && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
                <div className="text-white text-4xl font-bold">
                  Player {winner} Wins!
                </div>
              </div>
            )}

            {/* avatar groups */}
            {gameStarted && !gameOver && (
              <>
                {isMultiplayer && playerNumber ? (
                  <>
                    {renderAvatarGroup(1, "left")}
                    {renderAvatarGroup(2, "right")}
                  </>
                ) : (
                  <>
                    {renderAvatarGroup(1, "right")}
                    {renderAvatarGroup(2, "left")}
                  </>
                )}
              </>
            )}

            {/* Game start screen */}
            {!gameStarted && !showTournamentLobby && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-5xl mb-4 tracking-widest" style={{ color: "#212121" }}>
                  {isInTournament ? `Round ${currentMatch?.round}` : "Tournament Match"}
                </div>
                <img
                  src={`${ICON_PATH}${hoverClose ? "close" : "open"}.svg`}
                  alt="toggle"
                  className="w-40 h-40 cursor-pointer"
                  onMouseEnter={() => setHoverClose(true)}
                  onMouseLeave={() => setHoverClose(false)}
                  onClick={handleStartMatch}
                />
                {currentMatch && (
                  <div className="text-2xl text-white mt-4 text-center">
                    <div>{currentMatch.player1?.playerInfo.name}</div>
                    <div className="text-lg">vs</div>
                    <div>{currentMatch.player2?.playerInfo.name}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GamePong8;