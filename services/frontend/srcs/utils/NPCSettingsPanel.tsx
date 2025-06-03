import React from 'react';
import type { NPCConfig } from './npcTypes';

interface NPCSettingsPanelProps {
  npcEnabled: boolean;
  setNpcEnabled: (enabled: boolean) => void;
  npcSettings: NPCConfig;
  setNpcSettings: React.Dispatch<React.SetStateAction<NPCConfig>>;
  gameStarted: boolean;
}

export const NPCSettingsPanel: React.FC<NPCSettingsPanelProps> = ({
  npcEnabled,
  setNpcEnabled,
  npcSettings,
  setNpcSettings,
  gameStarted
}) => {
  if (gameStarted) return null;

  return (
    <div className="absolute top-4 left-4 z-20 bg-black bg-opacity-80 p-4 rounded-lg text-white max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          checked={npcEnabled}
          onChange={(e) => setNpcEnabled(e.target.checked)}
          className="w-4 h-4"
        />
        <label className="text-sm font-bold">🤖 NPC有効</label>
      </div>

      {npcEnabled && (
        <div className="space-y-3 text-xs">
          <div className="flex gap-4">
            <div>
              <label>NPCプレイヤー:</label>
              <select
                value={npcSettings.player}
                onChange={(e) => setNpcSettings(prev => ({ ...prev, player: Number(e.target.value) as 1 | 2 }))}
                className="ml-2 bg-gray-700 text-white px-2 py-1 rounded"
              >
                <option value={1}>Player 1 (上)</option>
                <option value={2}>Player 2 (下)</option>
              </select>
            </div>

            <div>
              <label>NPC方式:</label>
              <select
                value={npcSettings.mode}
                onChange={(e) => setNpcSettings(prev => ({ ...prev, mode: e.target.value as 'heuristic' | 'pid' | 'technician' }))}
                className="ml-2 bg-gray-700 text-white px-2 py-1 rounded"
              >
                <option value="heuristic">ヒューリスティック</option>
                <option value="pid">🎯 PID制御</option>
                <option value="technician">⚡ テクニシャン</option>
              </select>
            </div>
          </div>

          {npcSettings.mode === 'heuristic' && (
            <div className="border-t border-gray-600 pt-3">
              <h4 className="font-bold mb-2">ヒューリスティック設定</h4>
              <div className="space-y-2">
                <div>
                  <label>反応遅延: {npcSettings.reactionDelay.toFixed(2)}s</label>
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.05"
                    value={npcSettings.reactionDelay}
                    onChange={(e) => setNpcSettings(prev => ({ ...prev, reactionDelay: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label>位置ノイズ: {npcSettings.positionNoise}</label>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={npcSettings.positionNoise}
                    onChange={(e) => setNpcSettings(prev => ({ ...prev, positionNoise: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                <div>
                  <label>追従ゲイン: {npcSettings.followGain.toFixed(2)}</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={npcSettings.followGain}
                    onChange={(e) => setNpcSettings(prev => ({ ...prev, followGain: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {npcSettings.mode === 'pid' && (
            <div className="border-t border-gray-600 pt-3">
              <h4 className="font-bold mb-2">🎯 PID制御設定</h4>
              <div className="space-y-2">
                <div>
                  <label>難易度:</label>
                  <select
                    value={npcSettings.difficulty}
                    onChange={(e) => {
                      const difficulty = e.target.value as 'Nightmare' | 'Hard' | 'Normal' | 'Easy' | 'Custom';
                      setNpcSettings(prev => ({ ...prev, difficulty }));
                    }}
                    className="ml-2 bg-gray-700 text-white px-2 py-1 rounded"
                  >
                    <option value="Easy">😴 Easy</option>
                    <option value="Normal">🎯 Normal</option>
                    <option value="Hard">🔥 Hard</option>
                    <option value="Nightmare">👹 Nightmare</option>
                    <option value="Custom">⚙️ Custom</option>
                  </select>
                </div>

                {npcSettings.difficulty === 'Custom' && npcSettings.pid && (
                  <>
                    <div>
                      <label>Kp (比例ゲイン): {npcSettings.pid.kp.toFixed(2)}</label>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.05"
                        value={npcSettings.pid.kp}
                        onChange={(e) => setNpcSettings(prev => ({
                          ...prev,
                          pid: { ...prev.pid!, kp: Number(e.target.value) }
                        }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label>Ki (積分ゲイン): {npcSettings.pid.ki.toFixed(3)}</label>
                      <input
                        type="range"
                        min="0.00"
                        max="0.20"
                        step="0.01"
                        value={npcSettings.pid.ki}
                        onChange={(e) => setNpcSettings(prev => ({
                          ...prev,
                          pid: { ...prev.pid!, ki: Number(e.target.value) }
                        }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label>Kd (微分ゲイン): {npcSettings.pid.kd.toFixed(3)}</label>
                      <input
                        type="range"
                        min="0.00"
                        max="0.15"
                        step="0.01"
                        value={npcSettings.pid.kd}
                        onChange={(e) => setNpcSettings(prev => ({
                          ...prev,
                          pid: { ...prev.pid!, kd: Number(e.target.value) }
                        }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label>最大速度: {npcSettings.pid.maxControlSpeed}px/s</label>
                      <input
                        type="range"
                        min="200"
                        max="1000"
                        step="50"
                        value={npcSettings.pid.maxControlSpeed}
                        onChange={(e) => setNpcSettings(prev => ({
                          ...prev,
                          pid: { ...prev.pid!, maxControlSpeed: Number(e.target.value) }
                        }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label>追跡ノイズ: {npcSettings.trackingNoise}</label>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        step="2"
                        value={npcSettings.trackingNoise}
                        onChange={(e) => setNpcSettings(prev => ({ ...prev, trackingNoise: Number(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {npcSettings.mode === 'technician' && (
            <div className="border-t border-gray-600 pt-3">
              <h4 className="font-bold mb-2">⚡ テクニシャン設定</h4>
              <div className="space-y-2">
                <div>
                  <label>難易度:</label>
                  <select
                    value={npcSettings.difficulty}
                    onChange={(e) => {
                      const difficulty = e.target.value as 'Nightmare' | 'Hard' | 'Normal' | 'Easy' | 'Custom';
                      setNpcSettings(prev => ({ ...prev, difficulty }));
                    }}
                    className="ml-2 bg-gray-700 text-white px-2 py-1 rounded"
                  >
                    <option value="Easy">😴 Easy</option>
                    <option value="Normal">⚡ Normal</option>
                    <option value="Hard">🔥 Hard</option>
                    <option value="Nightmare">👹 Nightmare</option>
                    <option value="Custom">⚙️ Custom</option>
                  </select>
                </div>

                <div>
                  <label>反応遅延: {npcSettings.reactionDelayMs}ms</label>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="50"
                    value={npcSettings.reactionDelayMs}
                    onChange={(e) => setNpcSettings(prev => ({ ...prev, reactionDelayMs: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                {npcSettings.difficulty === 'Custom' && npcSettings.technician && (
                  <>
                    <div>
                      <label>予測精度: {npcSettings.technician.predictionAccuracy.toFixed(2)}</label>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={npcSettings.technician.predictionAccuracy}
                        onChange={(e) => setNpcSettings(prev => ({
                          ...prev,
                          technician: { ...prev.technician!, predictionAccuracy: Number(e.target.value) }
                        }))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label>コース精度: {npcSettings.technician.courseAccuracy.toFixed(2)}</label>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={npcSettings.technician.courseAccuracy}
                        onChange={(e) => setNpcSettings(prev => ({
                          ...prev,
                          technician: { ...prev.technician!, courseAccuracy: Number(e.target.value) }
                        }))}
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
