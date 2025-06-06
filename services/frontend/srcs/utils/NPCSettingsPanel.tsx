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
              <label>NPCプレイヤー: Player 1 (上)</label>
            </div>

            <div>
              <label>NPC方式: ⚡ テクニシャン</label>
            </div>
          </div>

          <div className="border-t border-gray-600 pt-3">
            <h4 className="font-bold mb-2">⚡ テクニシャン設定</h4>
            <div className="space-y-2">
              <div>
                <label>難易度: 👹 Nightmare</label>
              </div>

              <div>
                <label>反応遅延: 50ms</label>
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
        </div>
      )}
    </div>
  );
};
