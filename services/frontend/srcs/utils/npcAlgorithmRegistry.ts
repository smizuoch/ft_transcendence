import { NPCFactory } from './npcEngine';

// 既存のアルゴリズムをインポート
import './heuristicNPC';
import './pidNPC';

// 新しいアルゴリズムの追加例
// import './advancedNPC';
// import './neuralNetworkNPC';

// 利用可能なアルゴリズムの一覧を取得する関数
export function getAvailableNPCAlgorithms(): string[] {
  return NPCFactory.getAvailableAlgorithms();
}

// カスタムアルゴリズムを動的に追加する関数
export function addCustomNPCAlgorithm(name: string, algorithmClass: any): void {
  NPCFactory.registerAlgorithm(name, algorithmClass);
}
