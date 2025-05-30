import React from 'react';
import type { NPCConfig } from './npcTypes';

interface NPCDebugInfo {
  state: string;
  timeInState: number;
  returnRate: number;
  targetPosition: number;
  pid?: { error: number; p: number; i: number; d: number; output: number };
  // Technician用の追加情報
  currentAction?: string;
  lastTechnique?: string;
  techniqueHistory?: string[];
  activeTechniqueEffect?: {
    type: string | null;
    shouldApply: boolean;
  };
  techniqueDiversity?: {
    consecutive: number;
    historyLength: number;
    uniqueTechniques: number;
  };
}

interface NPCDebugPanelProps {
  gameStarted: boolean;
  npcEnabled: boolean;
  npcSettings: NPCConfig;
  npcDebugInfo: NPCDebugInfo | null;
}

export const NPCDebugPanel: React.FC<NPCDebugPanelProps> = ({
  gameStarted,
  npcEnabled,
  npcSettings,
  npcDebugInfo
}) => {
  if (!gameStarted || !npcEnabled || !npcDebugInfo) return null;

  return (
    <div className="absolute top-4 right-4 z-20 bg-black bg-opacity-80 p-3 rounded text-white text-xs font-mono">
      <div className="font-bold text-green-400 mb-1">🤖 NPC Debug</div>
      <div className="space-y-1">
        <div>Mode: <span className="text-cyan-300">{npcSettings.mode.toUpperCase()}</span></div>
        <div>State: <span className={`font-bold ${
          npcDebugInfo.state === 'TRACK' ? 'text-green-300' :
          npcDebugInfo.state === 'MISS' ? 'text-red-300' :
          npcDebugInfo.state === 'SMASH' ? 'text-purple-300' :
          npcDebugInfo.state === 'PID' ? 'text-blue-300' :
          'text-yellow-300'
        }`}>{npcDebugInfo.state}</span></div>

        {npcSettings.mode === 'technician' && npcDebugInfo.currentAction && (
          <>
            <div className="border-t border-gray-600 pt-1">
              <div>Current: <span className="text-purple-300 font-bold">{npcDebugInfo.currentAction.toUpperCase()}</span></div>
              <div>Last: <span className="text-orange-300">{npcDebugInfo.lastTechnique?.toUpperCase() || 'NONE'}</span></div>
              {npcDebugInfo.activeTechniqueEffect?.shouldApply && (
                <div>Effect: <span className="text-red-300 animate-pulse">ACTIVE</span></div>
              )}
              {npcDebugInfo.techniqueDiversity && (
                <div className="text-xs text-gray-400">
                  History: {npcDebugInfo.techniqueDiversity.historyLength}/5 |
                  Unique: {npcDebugInfo.techniqueDiversity.uniqueTechniques}
                </div>
              )}
              {npcDebugInfo.techniqueHistory && npcDebugInfo.techniqueHistory.length > 0 && (
                <div className="text-xs text-gray-400">
                  Recent: {npcDebugInfo.techniqueHistory.slice(-3).map(t => t.charAt(0)).join('-')}
                </div>
              )}
            </div>
          </>
        )}

        {npcSettings.mode === 'pid' && npcDebugInfo.pid && (
          <>
            <div className="border-t border-gray-600 pt-1">
              <div>Error: <span className="text-red-300">{npcDebugInfo.pid.error.toFixed(1)}</span></div>
              <div>P: <span className="text-green-300">{npcDebugInfo.pid.p.toFixed(2)}</span></div>
              <div>I: <span className="text-yellow-300">{npcDebugInfo.pid.i.toFixed(2)}</span></div>
              <div>D: <span className="text-purple-300">{npcDebugInfo.pid.d.toFixed(2)}</span></div>
              <div>Out: <span className="text-orange-300">{npcDebugInfo.pid.output.toFixed(2)}</span></div>
            </div>
          </>
        )}

        {npcSettings.mode !== 'pid' && npcSettings.mode !== 'technician' && (
          <>
            <div>Time: {(npcDebugInfo.timeInState / 1000).toFixed(1)}s</div>
            <div>返球率: <span className="text-blue-300">{(npcDebugInfo.returnRate * 100).toFixed(1)}%</span></div>
            <div>Target: <span className="text-orange-300">{Math.round(npcDebugInfo.targetPosition)}</span></div>
          </>
        )}

        <div className="pt-1 border-t border-gray-600">
          <div className="text-xs text-gray-400">
            Player: {npcSettings.player} | Difficulty: {npcSettings.difficulty}
          </div>
        </div>
      </div>
    </div>
  );
};
