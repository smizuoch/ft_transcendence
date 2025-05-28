import { useEffect, useRef, useCallback } from 'react';
import { GameEngine, GameConfig } from './gameEngine';

export const useGameEngine = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  config?: GameConfig
) => {
  const engineRef = useRef<GameEngine | null>(null);
  const animationRef = useRef<number>();

  const initializeEngine = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const size = Math.min(window.innerWidth, window.innerHeight) * 0.9;
    canvas.width = size;
    canvas.height = size;

    engineRef.current = new GameEngine(size, size, config);
    return engineRef.current;
  }, [canvasRef, config]);

  const startGameLoop = useCallback((
    onScore: (scorer: 'player1' | 'player2') => void,
    gameStarted: boolean
  ) => {
    if (!engineRef.current || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      if (engineRef.current && gameStarted) {
        const result = engineRef.current.update();
        if (result !== 'none') {
          onScore(result);
        }
      }

      if (engineRef.current) {
        engineRef.current.draw(ctx);
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
  }, [canvasRef]);

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

export const useKeyboardControls = (gameEngine: React.RefObject<GameEngine>) => {
  useEffect(() => {
    const keyMap: Record<string, string> = {
      'a': 'a',
      'd': 'd',
      'ArrowLeft': 'arrowLeft',
      'ArrowRight': 'arrowRight',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const mappedKey = keyMap[e.key];
      if (mappedKey && gameEngine.current) {
        e.preventDefault();
        gameEngine.current.setKeyState(mappedKey, true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const mappedKey = keyMap[e.key];
      if (mappedKey && gameEngine.current) {
        gameEngine.current.setKeyState(mappedKey, false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameEngine]);
};
