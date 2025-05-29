import React from 'react';
import type { AIConfig } from './aiTypes';

interface AISettingsPanelProps {
  aiEnabled: boolean;
  setAiEnabled: (enabled: boolean) => void;
  aiSettings: AIConfig;
  setAiSettings: React.Dispatch<React.SetStateAction<AIConfig>>;
  gameStarted: boolean;
}

export const AISettingsPanel: React.FC<AISettingsPanelProps> = ({
  aiEnabled,
  setAiEnabled,
  aiSettings,
  setAiSettings,
  gameStarted
}) => {
  if (gameStarted) return null;

  return (
    <div className="absolute top-4 left-4 z-20 bg-black bg-opacity-80 p-4 rounded-lg text-white max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          checked={aiEnabled}
          onChange={(e) => setAiEnabled(e.target.checked)}
          className="w-4 h-4"
        />
        <label className="text-sm font-bold">🤖 AI有効</label>
      </div>
      
      {aiEnabled && (
        <div className="space-y-3 text-xs">
          <div className="flex gap-4">
            <div>
              <label>AIプレイヤー:</label>
              <select
                value={aiSettings.player}
                onChange={(e) => setAiSettings(prev => ({ ...prev, player: Number(e.target.value) as 1 | 2 }))}
                className="ml-2 bg-gray-700 text-white px-2 py-1 rounded"
              >
                <option value={1}>Player 1 (上)</option>
                <option value={2}>Player 2 (下)</option>
              </select>
            </div>

            <div>
              <label>AI方式:</label>
              <select
                value={aiSettings.mode}
                onChange={(e) => setAiSettings(prev => ({ ...prev, mode: e.target.value as 'heuristic' | 'fsm' | 'pid' }))}
                className="ml-2 bg-gray-700 text-white px-2 py-1 rounded"
              >
                <option value="heuristic">ヒューリスティック</option>
                <option value="fsm">FSM (状態機械)</option>
                <option value="pid">🎯 PID制御</option>
              </select>
            </div>
          </div>

          {aiSettings.mode === 'heuristic' && (
            <div className="border-t border-gray-600 pt-3">
              <h4 className="font-bold mb-2">ヒューリスティック設定</h4>
              <div className="space-y-2">
                <div>
                  <label>反応遅延: {aiSettings.reactionDelay.toFixed(2)}s</label>
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.05"
                    value={aiSettings.reactionDelay}
                    onChange={(e) => setAiSettings(prev => ({ ...prev, reactionDelay: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label>位置ノイズ: {aiSettings.positionNoise}</label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={aiSettings.positionNoise}
                    onChange={(e) => setAiSettings(prev => ({ ...prev, positionNoise: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label>追従ゲイン: {aiSettings.followGain.toFixed(2)}</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={aiSettings.followGain}
                    onChange={(e) => setAiSettings(prev => ({ ...prev, followGain: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {aiSettings.mode === 'fsm' && (
            <div className="border-t border-gray-600 pt-3">
              <h4 className="font-bold mb-2">🎯 FSM設定</h4>
              <div className="space-y-2">
                <div>
                  <label>難易度:</label>
                  <select
                    value={aiSettings.difficulty}
                    onChange={(e) => {
                      const difficulty = e.target.value as 'Nightmare' | 'Hard' | 'Normal' | 'Easy' | 'Custom';
                      setAiSettings(prev => ({ ...prev, difficulty }));
                    }}
                    className="ml-2 bg-gray-700 text-white px-2 py-1 rounded"
                  >
                    <option value="Easy">😴 Easy (返球率50%)</option>
                    <option value="Normal">🎯 Normal (返球率80%)</option>
                    <option value="Hard">🔥 Hard (返球率95%)</option>
                    <option value="Nightmare">👹 Nightmare (返球率99%)</option>
                    <option value="Custom">⚙️ Custom</option>
                  </select>
                </div>

                {aiSettings.difficulty === 'Custom' && (
                  <>
                    <div>
                      <label>返球率: {(aiSettings.returnRate * 100).toFixed(1)}%</label>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={aiSettings.returnRate}
                        onChange={(e) => setAiSettings(prev => ({ ...prev, returnRate: Number(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label>反応遅延: {aiSettings.reactionDelayMs}ms</label>
                      <input
                        type="range"
                        min="50"
                        max="500"
                        step="25"
                        value={aiSettings.reactionDelayMs}
                        onChange={(e) => setAiSettings(prev => ({ ...prev, reactionDelayMs: Number(e.target.value) }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label>最高速度: {(aiSettings.maxSpeed * 100).toFixed(0)}%</label>
                      <input
                        type="range"
                        min="0.3"
                        max="1.5"
                        step="0.1"
                        value={aiSettings.maxSpeed}
                        onChange={(e) => setAiSettings(prev => ({ ...prev, maxSpeed: Number(e.target.value) }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label>追跡ノイズ: {aiSettings.trackingNoise}</label>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        step="2"
                        value={aiSettings.trackingNoise}
                        onChange={(e) => setAiSettings(prev => ({ ...prev, trackingNoise: Number(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {aiSettings.mode === 'pid' && (
            <div className="border-t border-gray-600 pt-3">
              <h4 className="font-bold mb-2">🎯 PID制御設定</h4>
              <div className="space-y-2">
                <div>
                  <label>難易度:</label>
                  <select
                    value={aiSettings.difficulty}
                    onChange={(e) => {
                      const difficulty = e.target.value as 'Nightmare' | 'Hard' | 'Normal' | 'Easy' | 'Custom';
                      setAiSettings(prev => ({ ...prev, difficulty }));
                    }}
                    className="ml-2 bg-gray-700 text-white px-2 py-1 rounded"
                  >
                    <option value="Easy">😴 Easy (Kp=0.45)</option>
                    <option value="Normal">🎯 Normal (Kp=0.80)</option>
                    <option value="Hard">🔥 Hard (Kp=1.10)</option>
                    <option value="Nightmare">👹 Nightmare (Kp=1.30)</option>
                    <option value="Custom">⚙️ Custom</option>
                  </select>
                </div>

                {aiSettings.difficulty === 'Custom' && (
                  <>
                    <div>
                      <label>Kp (比例ゲイン): {aiSettings.pid.kp.toFixed(2)}</label>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.05"
                        value={aiSettings.pid.kp}
                        onChange={(e) => setAiSettings(prev => ({ 
                          ...prev, 
                          pid: { ...prev.pid, kp: Number(e.target.value) }
                        }))}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label>Ki (積分ゲイン): {aiSettings.pid.ki.toFixed(3)}</label>
                      <input
                        type="range"
                        min="0.00"
                        max="0.20"
                        step="0.01"
                        value={aiSettings.pid.ki}
                        onChange={(e) => setAiSettings(prev => ({ 
                          ...prev, 
                          pid: { ...prev.pid, ki: Number(e.target.value) }
                        }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label>Kd (微分ゲイン): {aiSettings.pid.kd.toFixed(3)}</label>
                      <input
                        type="range"
                        min="0.00"
                        max="0.15"
                        step="0.01"
                        value={aiSettings.pid.kd}
                        onChange={(e) => setAiSettings(prev => ({ 
                          ...prev, 
                          pid: { ...prev.pid, kd: Number(e.target.value) }
                        }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label>最大速度: {aiSettings.pid.maxControlSpeed}px/s</label>
                      <input
                        type="range"
                        min="200"
                        max="1000"
                        step="50"
                        value={aiSettings.pid.maxControlSpeed}
                        onChange={(e) => setAiSettings(prev => ({ 
                          ...prev, 
                          pid: { ...prev.pid, maxControlSpeed: Number(e.target.value) }
                        }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label>追跡ノイズ: {aiSettings.trackingNoise}</label>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        step="2"
                        value={aiSettings.trackingNoise}
                        onChange={(e) => setAiSettings(prev => ({ ...prev, trackingNoise: Number(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
