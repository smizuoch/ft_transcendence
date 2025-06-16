import React, { useState, useEffect } from 'react';

interface DTLSConnectionInfo {
  isConnected: boolean;
  dtlsState: string;
  iceState: string;
  localCertificate?: any;
  remoteCertificate?: any;
  selectedCandidatePair?: any;
  stats?: any;
}

interface DTLSDebugPanelProps {
  multiplayerService: any; // MultiplayerService型
  visible?: boolean;
}

export const DTLSDebugPanel: React.FC<DTLSDebugPanelProps> = ({ 
  multiplayerService, 
  visible = true 
}) => {
  const [connectionInfo, setConnectionInfo] = useState<DTLSConnectionInfo | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!visible || !multiplayerService) return;

    // 初回チェック
    checkConnection();

    // 定期チェック開始
    const interval = setInterval(checkConnection, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [visible, multiplayerService]);

  const checkConnection = async () => {
    if (!multiplayerService || typeof multiplayerService.verifyDTLSConnection !== 'function') {
      return;
    }

    try {
      const info = await multiplayerService.verifyDTLSConnection();
      setConnectionInfo(info);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to check DTLS connection:', error);
    }
  };

  const toggleMonitoring = () => {
    if (!multiplayerService) return;

    if (isMonitoring) {
      multiplayerService.stopDTLSMonitoring();
      setIsMonitoring(false);
    } else {
      multiplayerService.startDTLSMonitoring(3000);
      setIsMonitoring(true);
    }
  };

  if (!visible) return null;

  const getStatusColor = (isConnected: boolean) => {
    return isConnected ? 'text-green-400' : 'text-red-400';
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'connected':
      case 'completed':
        return 'text-green-400';
      case 'connecting':
      case 'checking':
        return 'text-yellow-400';
      case 'failed':
      case 'disconnected':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="fixed top-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg border border-gray-600 max-w-sm z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold">DTLS Debug Panel</h3>
        <button
          onClick={toggleMonitoring}
          className={`px-2 py-1 text-xs rounded ${
            isMonitoring 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-green-600 hover:bg-green-700'
          } transition-colors`}
        >
          {isMonitoring ? 'Stop Monitor' : 'Start Monitor'}
        </button>
      </div>

      {connectionInfo ? (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>DTLS Status:</span>
            <span className={getStatusColor(connectionInfo.isConnected)}>
              {connectionInfo.isConnected ? '✅ Connected' : '❌ Not Connected'}
            </span>
          </div>

          <div className="flex justify-between">
            <span>DTLS State:</span>
            <span className={getStateColor(connectionInfo.dtlsState)}>
              {connectionInfo.dtlsState}
            </span>
          </div>

          <div className="flex justify-between">
            <span>ICE State:</span>
            <span className={getStateColor(connectionInfo.iceState)}>
              {connectionInfo.iceState}
            </span>
          </div>

          {connectionInfo.selectedCandidatePair && (
            <div className="mt-2 p-2 bg-gray-800 rounded text-xs">
              <div className="font-semibold mb-1">Selected Candidate Pair:</div>
              <div>Local: {connectionInfo.selectedCandidatePair?.localCandidateId || 'N/A'}</div>
              <div>Remote: {connectionInfo.selectedCandidatePair?.remoteCandidateId || 'N/A'}</div>
              {connectionInfo.selectedCandidatePair?.bytesSent !== undefined && (
                <div>Bytes Sent: {connectionInfo.selectedCandidatePair.bytesSent}</div>
              )}
              {connectionInfo.selectedCandidatePair?.bytesReceived !== undefined && (
                <div>Bytes Received: {connectionInfo.selectedCandidatePair.bytesReceived}</div>
              )}
            </div>
          )}

          {lastUpdate && (
            <div className="text-xs text-gray-400 mt-2">
              Last Update: {lastUpdate.toLocaleTimeString()}
            </div>
          )}

          <button
            onClick={checkConnection}
            className="w-full mt-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            Refresh
          </button>
          
          <button
            onClick={async () => {
              if (multiplayerService && typeof multiplayerService.triggerWebRTCInitialization === 'function') {
                console.log('Manual WebRTC initialization triggered from UI');
                const result = await multiplayerService.triggerWebRTCInitialization();
                console.log('Manual WebRTC initialization result:', result);
                // 結果をチェックして更新
                setTimeout(checkConnection, 1000);
              }
            }}
            className="w-full mt-1 px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded transition-colors"
          >
            Init WebRTC
          </button>
        </div>
      ) : (
        <div className="text-center text-gray-400">
          <div>No connection info available</div>
          <button
            onClick={checkConnection}
            className="mt-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            Check Connection
          </button>
        </div>
      )}
    </div>
  );
};

export default DTLSDebugPanel;
