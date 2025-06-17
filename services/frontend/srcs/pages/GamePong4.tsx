import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGameEngine, useKeyboardControls } from "@/utils/gameHooks";
import { DEFAULT_CONFIG } from "@/utils/gameEngine";
import { isUserAuthenticated } from "@/utils/authUtils";
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

interface GamePong4Props {
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

const GamePong4: React.FC<GamePong4Props> = ({ navigate, players = defaultPlayers }) => {
  // JWT認証チェック
  useEffect(() => {
    if (!isUserAuthenticated()) {
      console.log('❌ GamePong4: User not authenticated, redirecting to Home');
      navigate('Home');
      return;
    }
  }, [navigate]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // ゲーム状態
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState({ player1: 0, player2: 0 });
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<number | null>(null); // @ts-ignore unused variable
  
  // UI状態
  const [hoverClose, setHoverClose] = useState(false);
  const [iconsDocked, setIconsDocked] = useState(false);
  const ICON_LAUNCH_DELAY = 600;
  
  // トーナメント状態
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [tournamentId, setTournamentId] = useState<string>('');
  const [isInTournament, setIsInTournament] = useState(false);
  const [currentMatch, setCurrentMatch] = useState<TournamentMatch | null>(null);
  const [showTournamentLobby, setShowTournamentLobby] = useState(true);
  const [isEliminated, setIsEliminated] = useState(false);
  const [tournamentCompleted, setTournamentCompleted] = useState(false);
  const [tournamentWinner, setTournamentWinner] = useState<TournamentPlayer | null>(null);
  const [participants, setParticipants] = useState<{
    players: TournamentPlayer[];
  }>({ players: [] });
  
  // 通信対戦状態
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [playerNumber, setPlayerNumber] = useState<1 | 2 | 'spectator' | null>(null);
  const [remotePlayerInput, setRemotePlayerInput] = useState<PlayerInput | null>(null);
  const [isAuthoritativeClient, setIsAuthoritativeClient] = useState(false);
  
  // 新規追加: ゲームが初期化されたかどうかを追跡
  const [isGameInitialized, setIsGameInitialized] = useState(false);
  
  // 重複防止フラグ
  const [tournamentResultSent, setTournamentResultSent] = useState(false);

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
          setIsInTournament(true);
          setShowTournamentLobby(true);
        });

        multiplayerService.on('tournament-joined', (data: any) => {
          console.log('Tournament joined:', data);
          setTournament(data.tournament);
          setTournamentId(data.tournamentId);
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
          setIsGameInitialized(false);
          
          // 敗退した場合は即座にリザルト画面へ
          if (isEliminated) {
            console.log('Player eliminated, setting elimination state');
            setIsEliminated(true);
            setShowTournamentLobby(false);
            
            // マルチプレイヤー状態をリセット
            setIsMultiplayer(false);
            setPlayerNumber(null);
            setIsAuthoritativeClient(false);
            
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
          
          // 現在の試合を終了状態にリセット - スコアを必ず0:0に
          setGameStarted(false);
          setGameOver(false);
          setWinner(null);
          setScore({ player1: 0, player2: 0 }); // 必ずリセット
          setIsGameInitialized(false);
          
          // 前の試合から確実に離脱
          stopGameLoop();
          if (engineRef.current) {
            engineRef.current.cleanup();
            // エンジンのスコアもリセット
            engineRef.current.resetScore();
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
            setScore({ player1: 0, player2: 0 }); // 再度確実にリセット
            setIsEliminated(false);
            setIsMultiplayer(false); // 一度リセット
            setIsAuthoritativeClient(false);
            
            // トーナメントロビーに戻す（次の試合開始まで待機）
            setShowTournamentLobby(true);
            
            // 少し遅延を入れてから試合部屋に参加
            setTimeout(() => {
              // スコアをリセットしてから部屋に参加
              setScore({ player1: 0, player2: 0 });
              joinMatchRoom(myNextMatch.roomNumber || '');
            }, 2000);
          } else {
            console.log('No next match found for this player in round advancement');
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
          
          console.log(`Tournament completed! Winner: ${data.winner?.playerInfo.name || '不明'}`);
        });

        // エラーハンドリング
        multiplayerService.on('error', (error: any) => {
          console.error('MultiplayerService error:', error);
          // 特定のエラーメッセージは無視
          if (error.message !== 'Failed to record match result') {
            alert('エラーが発生しました: ' + (error.message || error));
          }
        });

        // 試合が既に完了している場合のイベント
        multiplayerService.on('tournament-match-already-completed', (data: any) => {
          console.log('Match already completed, current state:', data);
          // エラーではないので、現在の状態を確認するだけ
        });

        // 通常のゲーム部屋のイベントリスナー
        multiplayerService.on('roomJoined', (data: RoomState) => {
          console.log('Joined room event received:', data);
          
          // スコアを必ずリセット
          setScore({ player1: 0, player2: 0 });
          
          // 4人制トーナメントでは観戦者は許可しない
          if (data.isSpectator || data.playerNumber === 'spectator') {
            alert('This tournament does not support spectators');
            return;
          }
          
          setPlayerNumber(data.playerNumber);
          console.log(`Joined match room as player ${data.playerNumber}`);
          
          // 修正: 権威クライアントの設定を簡潔に
          // トーナメントでは常にプレイヤー1が権威クライアント
          const isAuth = data.playerNumber === 1;
          setIsAuthoritativeClient(isAuth);
          console.log('Is authoritative client:', isAuth);
          
          // エンジンが存在する場合は設定
          if (engineRef.current) {
            engineRef.current.setAuthoritativeClient(isAuth);
            // エンジンのスコアもリセット
            engineRef.current.resetScore();
          }
          
          setIsMultiplayer(true);
          
          // 部屋参加時にUIを完全リセット
          setGameStarted(false);
          setGameOver(false);
          setScore({ player1: 0, player2: 0 }); // 再度確実にリセット
          setWinner(null);
          setIsEliminated(false);
          setTournamentResultSent(false); // 重複防止フラグもリセット
        });

        multiplayerService.on('gameStarted', (data: any) => {
          console.log('Match game started:', data);
          
          // スコアを必ず0:0にリセット
          setScore({ player1: 0, player2: 0 });
          
          // ゲーム開始前にエンジンを初期化
          const engine = initializeEngine();
          if (!engine) {
            console.error('Failed to initialize game engine for multiplayer match');
            return;
          }
          
          // エンジンのスコアもリセット
          engine.resetScore();
          
          // ボールの初期化とゲーム開始
          engine.resetBall();
          console.log('Ball reset for game start, ball state:', engine.getState().ball);
          
          // ゲーム状態を完全リセット
          setGameStarted(true);
          setGameOver(false);
          setWinner(null);
          setScore({ player1: 0, player2: 0 }); // 再度確実にリセット
          setIsEliminated(false);
          setIsGameInitialized(true);
          setTournamentResultSent(false); // 重複防止フラグもリセット
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
          
          // トーナメントの場合は結果を報告（勝者のみ、かつ重複防止）
          if (isWinner && currentMatch && tournamentId && isInTournament && !tournamentResultSent) {
            const winnerId = data.winner === 1 ? 
              currentMatch.player1?.playerId : 
              currentMatch.player2?.playerId;
            
            if (winnerId) {
              console.log('Reporting tournament result as winner:', { 
                tournamentId, 
                matchId: currentMatch.id, 
                winnerId
              });
              
              setTournamentResultSent(true); // 重複防止フラグを設定
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

        // 修正: fullGameStateUpdateの処理を簡潔に
        multiplayerService.on('fullGameStateUpdate', (data: any) => {
          if (engineRef.current && data.gameState && !isAuthoritativeClient) {
            console.log('Non-authoritative client received full game state update');
            
            // ゲームが初期化されていない場合はスコアを同期しない
            if (isGameInitialized) {
              engineRef.current.syncWithRemoteState(data.gameState);
              // スコアも同期
              if (data.gameState.score) {
                console.log('Syncing score from full state update:', data.gameState.score);
                setScore(data.gameState.score);
              }
            } else {
              // ゲーム開始前はスコアを除いた状態のみ同期
              const { score: _, ...stateWithoutScore } = data.gameState;
              engineRef.current.syncWithRemoteState(stateWithoutScore);
            }
          }
        });

      } catch (error) {
        console.error('Failed to setup tournament connection:', error);
        
        // 認証エラーの場合はHomeページにリダイレクト
        if (error instanceof Error && error.message.includes('Authentication required')) {
          console.log('❌ GamePong4: Authentication error, redirecting to Home');
          navigate('Home');
        }
      }
    };

    setupTournamentConnection();
  }, [isGameInitialized]); // isGameInitializedを依存配列に追加

  // 試合部屋に参加
  const joinMatchRoom = async (roomNum: string) => {
    try {
      console.log(`Attempting to join match room: ${roomNum}`);
      
      // スコアを必ずリセット
      setScore({ player1: 0, player2: 0 });
      
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
      setScore({ player1: 0, player2: 0 }); // 再度確実にリセット
      setWinner(null);
      setIsMultiplayer(true);
      setIsEliminated(false);
      setIsGameInitialized(false);
      
      // UIをゲーム画面に切り替え
      setShowTournamentLobby(false);
      
    } catch (error) {
      console.error('Failed to join match room:', error);
    }
  };

  // トーナメント作成
  const handleCreateTournament = async () => {
    try {
      console.log('Creating 4-player tournament');
      
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
      // 4人制のトーナメントのみを作成
      multiplayerService.createTournament(4, playerInfo);
    } catch (error) {
      console.error('Failed to create tournament:', error);
      alert('トーナメントの作成に失敗しました: ' + error);
    }
  };

  // トーナメント参加
  const handleJoinTournament = async () => {
    if (!tournamentId) {
      alert('Tournament ID is required');
      return;
    }

    // 参加者数をチェック（4人以上なら参加を拒否）
    if (participants.players.length >= 4) {
      alert('Tournament is full (4 players maximum)');
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

    // 4人きっかりでないとトーナメントを開始できない
    if (participants.players.length !== 4) {
      alert(`Need exactly 4 players to start tournament. Current: ${participants.players.length}`);
      return;
    }

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

  // アイコンアニメーション効果
  useEffect(() => {
    if (!gameStarted) return;
    setIconsDocked(false);
    const t = setTimeout(() => setIconsDocked(true), ICON_LAUNCH_DELAY);
    return () => clearTimeout(t);
  }, [gameStarted]);

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
        
        // トーナメント中の場合、結果を報告（権威クライアントのみ、かつ重複防止）
        if (currentMatch && tournamentId && isInTournament && isMultiplayer && isAuthoritativeClient && !tournamentResultSent) {
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
            
            // 重複防止フラグを設定してから送信
            setTournamentResultSent(true);
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
        if (multiplayerService.isPlayer()) {
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
                requestAnimationFrame(renderLoop);
              }
            };
            requestAnimationFrame(renderLoop);
          }

          return () => {
            clearInterval(inputInterval);
            stopGameLoop();
          };
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
  }, [gameStarted, startGameLoop, stopGameLoop, handleScore, keysRef, isMultiplayer, remotePlayerInput, playerNumber, isAuthoritativeClient]);

  // 修正: 権威クライアントのコールバック設定
  useEffect(() => {
    if (gameStarted && isMultiplayer && engineRef.current && isAuthoritativeClient) {
      console.log('Setting up authoritative client callbacks');
      
      // 権威クライアントのGameEngineにスコア更新コールバックを設定
      engineRef.current.setScoreUpdateCallback((scorer: 'player1' | 'player2') => {
        console.log('Score update from game engine, sending to server:', scorer);
        handleMultiplayerScore(scorer);
      });
      
      // ゲーム状態の定期送信（60fps）
      const gameStateInterval = setInterval(() => {
        if (engineRef.current && gameStarted) {
          const gameState = engineRef.current.getGameState();
          multiplayerService.sendFullGameState(gameState);
        }
      }, 16); // 約60fps

      return () => {
        clearInterval(gameStateInterval);
      };
    }
  }, [gameStarted, isMultiplayer, isAuthoritativeClient, handleMultiplayerScore]);

  const handleStartMatch = () => {
    console.log('handleStartMatch called', { 
      isMultiplayer, 
      currentMatch: !!currentMatch, 
      isInTournament 
    });
    
    // スコアを必ずリセット
    setScore({ player1: 0, player2: 0 });
    
    // ゲーム開始前にエンジンを初期化
    const engine = initializeEngine();
    if (!engine) {
      console.error('Failed to initialize game engine');
      return;
    }
    
    // エンジンのスコアもリセット
    engine.resetScore();
    
    if (isMultiplayer && currentMatch) {
      console.log('Starting multiplayer game');
      multiplayerService.startGame();
    } else if (isInTournament) {
      // トーナメントのローカルテストモード
      console.log('Starting local tournament game');
      const engine = initializeEngine();
      if (engine) {
        engine.resetBall();
        engine.resetScore();
        console.log('Ball reset for local tournament, ball state:', engine.getState().ball);
      }
      setGameStarted(true);
      setGameOver(false);
      setWinner(null);
      setScore({ player1: 0, player2: 0 });
      setIsGameInitialized(true);
      setTournamentResultSent(false); // 重複防止フラグもリセット
    } else {
      // 通常のローカルゲーム
      console.log('Starting regular local game');
      const engine = initializeEngine();
      if (engine) {
        engine.resetBall();
        engine.resetScore();
        console.log('Ball reset for local game, ball state:', engine.getState().ball);
      }
      setGameStarted(true);
      setGameOver(false);
      setWinner(null);
      setScore({ player1: 0, player2: 0 });
      setIsGameInitialized(true);
      setTournamentResultSent(false); // 重複防止フラグもリセット
    }
  };

  const renderAvatarGroup = (idx: 1 | 2, side: "left" | "right") => {
    // 自分のプレイヤー番号に基づいてスコアとアバターを決定
    let displayedScore;
    let avatarPlayerKey: "player1" | "player2";
    
    if (isMultiplayer && playerNumber) {
      // マルチプレイヤーの場合：左=自分、右=相手
      const isMyScore = (side === "left");
      if (isMyScore) {
        // 自分のスコアとアバター
        displayedScore = playerNumber === 1 ? score.player1 : score.player2;
        avatarPlayerKey = playerNumber === 1 ? "player1" : "player2";
      } else {
        // 相手のスコアとアバター  
        displayedScore = playerNumber === 1 ? score.player2 : score.player1;
        avatarPlayerKey = playerNumber === 1 ? "player2" : "player1";
      }
    } else {
      // ローカルゲーム/NPCモードの場合は従来通り
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
        {/* outer score */}
        {pts >= DEFAULT_CONFIG.winningScore ? (
          <img src={`${ICON_PATH}win.svg`} alt="win" className="w-12 h-12 lg:w-16 lg:h-16" />
        ) : (
          <span className="text-white font-extrabold text-6xl lg:text-8xl leading-none">{pts}</span>
        )}
        
        {/* inner avatar */}
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
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="flex flex-col items-center justify-center w-full h-full max-w-2xl mx-8">
              {/* 勝利アイコン */}
              <div className="mb-8">
                <img src="/images/icons/win.svg" alt="Tournament Winner" className="w-32 h-32" />
              </div>
              
              {/* タイトル */}
              <h1 className="text-6xl font-bold mb-8 text-slate-500">
                CHAMPION
              </h1>
              
              {/* 勝者情報 */}
              <div className="flex flex-col items-center mb-12">
                <img 
                  src={tournamentWinner?.playerInfo.avatar || '/images/avatar/default_avatar.png'} 
                  alt="winner avatar" 
                  className="w-24 h-24 rounded-full mb-6 border-4 border-slate-500"
                />
                <div className="text-3xl font-bold text-slate-500">
                  {tournamentWinner?.playerInfo.name || 'Champion'}
                </div>
              </div>
              
              {/* 戻るボタン */}
              <button
                onClick={() => navigate('MyPage')}
                className="hover:opacity-80 transition-opacity"
                aria-label="Back to My Page"
              >
                <img src="/images/icons/mypage.svg" alt="MyPage" className="w-16 h-16" />
              </button>
            </div>
          </div>
        )}

        {/* Eliminated Player Screen */}
        {isEliminated && !tournamentCompleted && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="flex flex-col items-center justify-center w-full h-full max-w-2xl mx-8">
              {/* 敗退アイコン */}
              <div className="mb-8">
                <img src="/images/icons/close.svg" alt="Eliminated" className="w-24 h-24" />
              </div>
              
              {/* タイトル */}
              <h1 className="text-5xl font-bold mb-8 text-slate-500">
                ELIMINATED
              </h1>
              
              {/* メッセージ */}
              <div className="text-xl text-center mb-12 text-gray-400">
                Better luck next time!
              </div>
              
              {/* トーナメント情報 */}
              {tournament && (
                <div className="text-center mb-12">
                  <div className="text-lg mb-2 text-slate-500">
                    Tournament Status: {tournament.status === 'IN_PROGRESS' ? 'In Progress' : 'Completed'}
                  </div>
                  {tournament.status === 'COMPLETED' && tournament.winner && (
                    <div className="text-lg font-bold text-green-500">
                      Winner: {tournament.winner.playerInfo.name}
                    </div>
                  )}
                </div>
              )}
              
              {/* 戻るボタン */}
              <button
                onClick={() => navigate('MyPage')}
                className="hover:opacity-80 transition-opacity"
                aria-label="Back to My Page"
              >
                <img src="/images/icons/mypage.svg" alt="MyPage" className="w-16 h-16" />
              </button>
            </div>
          </div>
        )}

        {/* Tournament Lobby */}
        {showTournamentLobby && !gameStarted && !isEliminated && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            {/* メインロビー画面 */}
            <div className="flex flex-col items-center justify-center w-full h-full relative">
              
              {!isInTournament ? (
                <>
                  {/* メインタイトル */}
                  <h1 className="text-9xl font-bold mb-16 text-slate-500">
                    PONG4
                  </h1>

                  {/* ゲームモード選択ボタン */}
                  <div className="flex flex-col items-center space-y-8">
                    {/* トーナメント作成ボタン */}
                    <button
                      onClick={handleCreateTournament}
                      className="hover:opacity-80 transition-opacity"
                      aria-label="Create Tournament"
                    >
                      <img src="/images/icons/pong.svg" alt="Create Tournament" className="w-64 h-64" />
                    </button>

                    {/* トーナメント参加エリア */}
                    <div className="flex flex-col items-center space-y-4">
                      <div className="flex items-center space-x-4">
                        <input
                          type="text"
                          value={tournamentId}
                          onChange={(e) => setTournamentId(e.target.value)}
                          placeholder="Tournament ID"
                          className="w-64 px-4 py-3 border-2 border-slate-400 rounded-lg text-slate-700 text-lg focus:outline-none focus:border-slate-600"
                          style={{
                            fontSize: '18px',
                            textAlign: 'center'
                          }}
                        />
                        <button
                          onClick={handleJoinTournament}
                          className="hover:opacity-80 transition-opacity"
                          aria-label="Join Tournament"
                        >
                          <img src="/images/icons/signin.svg" alt="Join Tournament" className="w-16 h-16" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* マイページボタン - 右下 */}
                  <button
                    onClick={() => navigate('MyPage')}
                    className="absolute bottom-16 right-16 hover:opacity-80 transition-opacity"
                    aria-label="Back to My Page"
                  >
                    <img src="/images/icons/mypage.svg" alt="MyPage" className="w-16 h-16" />
                  </button>
                </>
              ) : (
                /* トーナメント待機画面 */
                <div className="flex flex-col items-center justify-center w-full h-full max-w-4xl mx-8">
                  {/* タイトルエリア */}
                  <div className="text-center mb-12">
                    <h1 className="text-6xl font-bold mb-4 text-slate-500">
                      PONG4
                    </h1>
                    <div className="flex items-center justify-center text-2xl mb-2 text-slate-500">
                      <img src="/images/icons/key.svg" alt="Tournament ID" className="w-8 h-8 mr-3" />
                      {tournamentId}
                    </div>
                    <div className="text-lg text-gray-400">
                      {tournament?.status === 'IN_PROGRESS' ? 'Tournament in progress' : 
                       tournament?.status === 'COMPLETED' ? 'Completed' : ''}
                    </div>
                  </div>

                  {/* プレイヤーグリッド */}
                  <div className="w-full mb-12">
                    <div className="text-xl font-semibold mb-6 text-center text-slate-500">
                      Players ({participants.players.length}/4)
                    </div>
                    <div className="grid grid-cols-2 gap-8 max-w-lg mx-auto">
                      {Array.from({ length: 4 }, (_, idx) => {
                        const player = participants.players[idx];
                        return (
                          <div
                            key={idx}
                            className={`flex flex-col items-center p-6 border-2 rounded-lg ${
                              player ? 'border-slate-500 bg-slate-50' : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="w-16 h-16 mb-3">
                              {player ? (
                                <img 
                                  src={player.playerInfo.avatar} 
                                  alt="player avatar" 
                                  className="w-full h-full rounded-full object-cover border-2 border-slate-500"
                                />
                              ) : (
                                <div className="w-full h-full rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                                  <div className="text-2xl text-gray-300">
                                    ?
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className={`text-sm font-medium text-center ${
                              player ? 'text-slate-500' : 'text-gray-400'
                            }`}>
                              {player ? (player.playerInfo.name || `Player ${idx + 1}`) : `Waiting...`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* アクションボタン */}
                  <div className="flex flex-col items-center space-y-6">
                    {tournament?.status === 'WAITING' && participants.players.length === 4 && (
                      <button
                        onClick={handleStartTournament}
                        className="hover:opacity-80 transition-opacity"
                        aria-label="Start Tournament"
                      >
                        <img src="/images/icons/check.svg" alt="Start Tournament" className="w-32 h-32" />
                      </button>
                    )}

                    {tournament?.status === 'WAITING' && participants.players.length < 4 && (
                      <div className="text-center">
                        <div className="text-lg mb-4 text-gray-400">
                          Need {4 - participants.players.length} more player{4 - participants.players.length !== 1 ? 's' : ''}
                        </div>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500 mx-auto"></div>
                      </div>
                    )}

                    {tournament?.status === 'IN_PROGRESS' && currentMatch && (
                      <div className="text-center space-y-4">
                        <div className="text-xl font-semibold text-slate-500">
                          Your Match - Round {currentMatch.round}
                        </div>
                        <div className="text-lg text-slate-500">
                          {currentMatch.player1?.playerInfo.name} vs {currentMatch.player2?.playerInfo.name}
                        </div>
                        <button
                          onClick={() => setShowTournamentLobby(false)}
                          className="hover:opacity-80 transition-opacity"
                          aria-label="Start Match"
                        >
                          <img src="/images/icons/open.svg" alt="Start Match" className="w-24 h-24" />
                        </button>
                      </div>
                    )}
                    
                    {tournament?.status === 'IN_PROGRESS' && !currentMatch && !isEliminated && (
                      <div className="text-center space-y-4">
                        <div className="text-xl text-slate-500">
                          Waiting for next round...
                        </div>
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500 mx-auto"></div>
                      </div>
                    )}
                  </div>

                  {/* 戻るボタン */}
                  <button
                    onClick={() => navigate('MyPage')}
                    className="absolute bottom-16 right-16 hover:opacity-80 transition-opacity"
                    aria-label="Back to My Page"
                  >
                    <img src="/images/icons/mypage.svg" alt="MyPage" className="w-16 h-16" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Game Canvas */}
        {!showTournamentLobby && !isEliminated && !tournamentCompleted && (
          <div className="relative w-[90vmin] h-[90vmin]">
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
                    {/* マルチプレイヤー：常に左=自分、右=相手 */}
                    {renderAvatarGroup(1, "left")}   {/* 左側は自分 */}
                    {renderAvatarGroup(1, "right")}  {/* 右側は相手 */}
                  </>
                ) : (
                  <>
                    {/* ローカルゲーム/NPCモード：従来通り */}
                    {renderAvatarGroup(1, "right")}
                    {renderAvatarGroup(2, "left")}
                  </>
                )}
              </>
            )}

            {/* Game start screen */}
            {!gameStarted && !showTournamentLobby && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-5xl mb-4 tracking-widest text-slate-800">
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

export default GamePong4;