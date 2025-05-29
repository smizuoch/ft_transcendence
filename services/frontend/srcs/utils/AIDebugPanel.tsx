import React from 'react';
import type { AIConfig } from './aiTypes';

interface AIDebugInfo {
  state: string;
  timeInState: number;
  returnRate: number;
  targetPosition: number;
  pid?: { error: number; p: number; i: number; d: number; output: number };
}

interface AIDebugPanelProps {
  gameStarted: boolean;
  aiEnabled: boolean;
  aiSettings: AIConfig;
  aiDebugInfo: AIDebugInfo | null;
}

export const AIDebugPanel: React.FC<AIDebugPanelProps> = ({
  gameStarted,
  aiEnabled,
  aiSettings,
  aiDebugInfo
}) => {
  if (!gameStarted || !aiEnabled || !aiDebugInfo) return null;

  return (
    <div className="absolute top-4 right-4 z-20 bg-black bg-opacity-80 p-3 rounded text-white text-xs font-mono">
      <div className="font-bold text-green-400 mb-1">🤖 AI Debug</div>
      <div className="space-y-1">
        <div>Mode: <span className="text-cyan-300">{aiSettings.mode.toUpperCase()}</span></div>
        <div>State: <span className={`font-bold ${
          aiDebugInfo.state === 'TRACK' ? 'text-green-300' :
          aiDebugInfo.state === 'MISS' ? 'text-red-300' :
          aiDebugInfo.state === 'SMASH' ? 'text-purple-300' :
          aiDebugInfo.state === 'PID' ? 'text-blue-300' :
          'text-yellow-300'
        }`}>{aiDebugInfo.state}</span></div>
        
        {aiSettings.mode === 'pid' && aiDebugInfo.pid && (
          <>
            <div className="border-t border-gray-600 pt-1">
              <div>Error: <span className="text-red-300">{aiDebugInfo.pid.error.toFixed(1)}</span></div>
              <div>P: <span className="text-green-300">{aiDebugInfo.pid.p.toFixed(2)}</span></div>
              <div>I: <span className="text-yellow-300">{aiDebugInfo.pid.i.toFixed(2)}</span></div>
              <div>D: <span className="text-purple-300">{aiDebugInfo.pid.d.toFixed(2)}</span></div>
              <div>Out: <span className="text-orange-300">{aiDebugInfo.pid.output.toFixed(2)}</span></div>
            </div>
          </>
        )}
        
        {aiSettings.mode !== 'pid' && (
          <>
            <div>Time: {(aiDebugInfo.timeInState / 1000).toFixed(1)}s</div>
            <div>返球率: <span className="text-blue-300">{(aiDebugInfo.returnRate * 100).toFixed(1)}%</span></div>
            <div>Target: <span className="text-orange-300">{Math.round(aiDebugInfo.targetPosition)}</span></div>
          </>
        )}
        
        <div className="pt-1 border-t border-gray-600">
          <div className="text-xs text-gray-400">
            Player: {aiSettings.player} | Difficulty: {aiSettings.difficulty}
          </div>
        </div>
      </div>
    </div>
  );
};
