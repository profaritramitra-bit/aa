/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { TroopType, TROOP_METADATA, TroopStats } from '../types';
import { Play, Sparkles, Zap, Flame, Shield, Clock, Plus, Trash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BarracksViewProps {
  elixir: number;
  gems: number;
  trainedTroops: Record<TroopType, number>;
  onTrainTroop: (type: TroopType) => void;
  onInstantCompleteQueue: (costInGems: number, finishedTroops: TroopType[]) => void;
  onClearQueue: () => void;
  onLogMessage: (text: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

interface QueueItem {
  id: string;
  type: TroopType;
  timeRemaining: number;
  totalTime: number;
}

export default function BarracksView({
  elixir,
  gems,
  trainedTroops,
  onTrainTroop,
  onInstantCompleteQueue,
  onClearQueue,
  onLogMessage,
}: BarracksViewProps) {
  const [trainingQueue, setTrainingQueue] = useState<QueueItem[]>([]);
  const [timerIntervalId, setTimerIntervalId] = useState<number | null>(null);

  // Background timer ticking every 1 second to train active troop
  useEffect(() => {
    const id = setInterval(() => {
      setTrainingQueue(prevQueue => {
        if (prevQueue.length === 0) return prevQueue;

        const updatedQueue = [...prevQueue];
        const activeItem = { ...updatedQueue[0] };
        
        activeItem.timeRemaining -= 1;

        if (activeItem.timeRemaining <= 0) {
          // Finished training!
          updatedQueue.shift(); // remove active item
          // Add troop to active trained list
          onTrainTroop(activeItem.type);
          onLogMessage(`Finished training ${TROOP_METADATA[activeItem.type].name}!`, 'success');
        } else {
          updatedQueue[0] = activeItem;
        }

        return updatedQueue;
      });
    }, 1000);

    setTimerIntervalId(id as any);

    return () => {
      clearInterval(id);
    };
  }, [onTrainTroop]);

  // Click handler to enqueue a troop
  const handleEnqueue = (type: TroopType) => {
    const meta = TROOP_METADATA[type];
    
    // Elixir resource check
    if (elixir < meta.cost) {
      onLogMessage(`Insufficient elixir! Need ${meta.cost} elixir to train a ${meta.name}.`, 'error');
      return;
    }

    // Limit overall housing space (e.g. max 50 housing slots across trained units and queue)
    const activeHousing = Object.entries(trainedTroops).reduce((sum, [t, count]) => {
      return sum + count * TROOP_METADATA[t as TroopType].housingSpace;
    }, 0);

    const queueHousing = trainingQueue.reduce((sum, item) => {
      return sum + TROOP_METADATA[item.type].housingSpace;
    }, 0);

    if (activeHousing + queueHousing + meta.housingSpace > 75) {
      onLogMessage('Your Army Camp is full (Max 75 housing space capacity)! Upgrade your Town Hall or deploy some units.', 'warning');
      return;
    }

    // Deduct elixir on client
    onTrainTroopTriggerCost(meta.cost);

    // Enqueue
    const newItem: QueueItem = {
      id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      timeRemaining: meta.trainingTime,
      totalTime: meta.trainingTime,
    };

    setTrainingQueue(prev => [...prev, newItem]);
    onLogMessage(`Enlisted ${meta.name} to training roster!`, 'info');
  };

  // Safe deduction on enlistment
  const onTrainTroopTriggerCost = (cost: number) => {
    // Notify parent to subtract elixir
    (window as any)._onDeductElixir?.(cost);
  };

  // Instant Gems completion
  const handleInstantGems = () => {
    if (trainingQueue.length === 0) return;
    
    // Cost is 1 gem per 3 seconds remaining in total queue
    const totalRemainingSeconds = trainingQueue.reduce((sum, item) => sum + item.timeRemaining, 0);
    const gemCost = Math.max(1, Math.ceil(totalRemainingSeconds / 3));

    if (gems < gemCost) {
      onLogMessage(`Insufficient Gems! Instant finish requires ${gemCost} Gems.`, 'error');
      return;
    }

    const finishedTroops = trainingQueue.map(item => item.type);
    onInstantCompleteQueue(gemCost, finishedTroops);
    setTrainingQueue([]);
    onLogMessage(`Instant trained ${finishedTroops.length} units using ${gemCost} Gems!`, 'success');
  };

  // Remove single element from queue
  const handleRemoveFromQueue = (index: number) => {
    const item = trainingQueue[index];
    const meta = TROOP_METADATA[item.type];
    
    // Refund Elixir
    (window as any)._onAddElixir?.(meta.cost);

    setTrainingQueue(prev => prev.filter((_, i) => i !== index));
    onLogMessage(`Removed ${meta.name} from queue. Elixir refunded!`, 'info');
  };

  // Total space indicators
  const totalHousingUsed = Object.entries(trainedTroops).reduce((sum, [t, count]) => {
    return sum + count * TROOP_METADATA[t as TroopType].housingSpace;
  }, 0);

  const activeQueueHousing = trainingQueue.reduce((sum, item) => {
    return sum + TROOP_METADATA[item.type].housingSpace;
  }, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="barracks_root">
      
      {/* Recruiter Shop */}
      <div className="lg:col-span-8 bg-black/60 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-md text-white">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <Zap className="text-blue-400 w-5 h-5 animate-pulse" />
            </div>
            <h3 className="font-sans font-bold text-white tracking-tight text-lg uppercase italic text-stroke">Recruitment Office</h3>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Army Camps: <span className="text-[#ffda44] font-black">{totalHousingUsed} / 75 Space</span>
          </div>
        </div>

        {/* List of troops to train */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.values(TROOP_METADATA).map((troop) => {
            const isAffordable = elixir >= troop.cost;

            return (
              <div
                key={troop.type}
                className="bg-black/40 border border-white/5 rounded-2xl p-4 flex justify-between items-center gap-4 hover:border-white/20 hover:scale-[1.01] transition-all group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: troop.color, color: troop.color }} />
                    <h4 className="font-sans font-bold text-white text-sm group-hover:text-[#ffda44] transition-colors">
                      {troop.name}
                    </h4>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-sans leading-normal">
                    {troop.description}
                  </p>

                  {/* Stats chips */}
                  <div className="flex gap-2 mt-2 text-[9px] font-mono text-slate-400 font-semibold">
                    <span className="bg-white/5 px-2 py-0.5 border border-white/5 rounded">HP: {troop.hp}</span>
                    <span className="bg-white/5 px-2 py-0.5 border border-white/5 rounded">DPS: {troop.dps}</span>
                    <span className="bg-white/5 px-2 py-0.5 border border-white/5 rounded">Space: {troop.housingSpace}</span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1 text-xs font-mono font-bold text-pink-400">
                    <Flame className="w-3 h-3 text-pink-500" />
                    {troop.cost.toLocaleString()}
                  </div>
                  
                  <button
                    onClick={() => handleEnqueue(troop.type)}
                    className="p-2 bg-[#5ce1e6]/10 hover:bg-[#5ce1e6] text-[#5ce1e6] hover:text-black border border-[#5ce1e6]/20 hover:border-transparent rounded-xl transition-all shadow-md font-bold active:translate-y-0.5"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Training Queue */}
      <div className="lg:col-span-4 bg-black/60 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-md text-white flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center pb-2 border-b border-white/10 mb-3">
            <h4 className="font-sans font-bold text-white tracking-tight text-sm flex items-center gap-1.5 uppercase italic">
              <Clock className="w-4 h-4 text-[#ffda44]" />
              Active Training Queue
            </h4>
            {trainingQueue.length > 0 && (
              <span className="text-[10px] bg-white/10 border border-white/5 px-2.5 py-0.5 rounded-full font-mono font-bold text-slate-300">
                {trainingQueue.length} Enlisted
              </span>
            )}
          </div>

          {trainingQueue.length > 0 ? (
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
              {trainingQueue.map((item, index) => {
                const meta = TROOP_METADATA[item.type];
                const isActive = index === 0;

                return (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-sans ${
                      isActive 
                        ? 'bg-blue-950/30 border-blue-500/40 text-blue-200' 
                        : 'bg-black/30 border-white/5 text-slate-400'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline pr-2">
                        <span className="font-bold truncate">{meta.name}</span>
                        <span className="font-mono text-[10px] font-semibold">
                          {isActive ? `${item.timeRemaining}s left` : `Wait queue`}
                        </span>
                      </div>
                      
                      {/* Active progress bar */}
                      {isActive && (
                        <div className="w-full h-1 bg-black rounded-full mt-1.5 overflow-hidden">
                          <div 
                            className="bg-[#5ce1e6] h-full transition-all duration-1000 shadow-[0_0_8px_#5ce1e6]" 
                            style={{ width: `${((item.totalTime - item.timeRemaining) / item.totalTime) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemoveFromQueue(index)}
                      className="p-1 hover:bg-red-950/40 text-red-400 rounded-lg transition-colors ml-2"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
              <Clock className="w-8 h-8 opacity-30 mb-2 animate-spin-slow" />
              <p className="text-xs font-sans font-semibold">Training facilities are quiet.</p>
              <p className="text-[10px] px-4 mt-1 font-sans">Enqueue recruits in the left office using Elixir fluid values to build your active army.</p>
            </div>
          )}
        </div>

        {trainingQueue.length > 0 && (
          <div className="mt-6 pt-4 border-t border-white/10 flex flex-col gap-2">
            {(() => {
              const totalRemainingSeconds = trainingQueue.reduce((sum, item) => sum + item.timeRemaining, 0);
              const gemCost = Math.max(1, Math.ceil(totalRemainingSeconds / 3));

              return (
                <button
                  onClick={handleInstantGems}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-white text-xs font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-1.5 border border-emerald-400/20 active:translate-y-0.5"
                >
                  <Zap className="w-3.5 h-3.5 text-yellow-300" />
                  Instant Finish ({gemCost} Gems)
                </button>
              );
            })()}
          </div>
        )}

      </div>

    </div>
  );
}
