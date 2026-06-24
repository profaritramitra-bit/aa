/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BuildingState, BUILDING_METADATA, TroopType, TROOP_METADATA } from '../types';
import { Home, Shield, Swords, Coins, Flame, Gem, Sparkles, ArrowUp, RefreshCw, Star, Info, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VillageViewProps {
  buildings: BuildingState[];
  trainedTroops: Record<TroopType, number>;
  gold: number;
  elixir: number;
  gems: number;
  trophies: number;
  townHallLevel: number;
  onUpgradeTownHall: (cost: number) => void;
  onAddLoot: (goldAmount: number, elixirAmount: number, trophies: number) => void;
  onLogMessage: (text: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onSwitchTab: (tab: 'editor' | 'barracks' | 'battle' | 'chat') => void;
}

interface PendingReserve {
  buildingId: string;
  type: 'gold' | 'elixir';
  amount: number;
  maxCapacity: number;
}

export default function VillageView({
  buildings,
  trainedTroops,
  gold,
  elixir,
  gems,
  trophies,
  townHallLevel,
  onUpgradeTownHall,
  onAddLoot,
  onLogMessage,
  onSwitchTab,
}: VillageViewProps) {
  const [pendingReserves, setPendingReserves] = useState<Record<string, number>>({});
  const [floatingCollections, setFloatingCollections] = useState<{ id: string; text: string; type: 'gold' | 'elixir'; x: number; y: number }[]>([]);

  // Calculate current storage caps
  const goldStorages = buildings.filter(b => b.type === 'gold_storage' || b.type === 'town_hall');
  const maxGoldCap = goldStorages.reduce((sum, b) => {
    const meta = BUILDING_METADATA[b.type];
    return sum + (meta.statsByLevel[b.level - 1]?.capacity || 5000);
  }, 5000);

  const elixirStorages = buildings.filter(b => b.type === 'elixir_storage' || b.type === 'town_hall');
  const maxElixirCap = elixirStorages.reduce((sum, b) => {
    const meta = BUILDING_METADATA[b.type];
    return sum + (meta.statsByLevel[b.level - 1]?.capacity || 5000);
  }, 5000);

  // Background producer tick (runs every 1 second to accumulate resource mine values)
  useEffect(() => {
    const producerInterval = setInterval(() => {
      setPendingReserves(prev => {
        const next = { ...prev };
        
        buildings.forEach(b => {
          if (b.type !== 'gold_mine' && b.type !== 'elixir_collector') return;
          
          const meta = BUILDING_METADATA[b.type];
          const stats = meta.statsByLevel[b.level - 1];
          if (!stats || !stats.rate || !stats.capacity) return;

          // rate is per hour, convert to per second: rate / 3600
          const ratePerSec = stats.rate / 3600;
          const currentPending = prev[b.id] || 0;
          
          // clamp by individual mine's storage capacity
          next[b.id] = Math.min(stats.capacity, currentPending + ratePerSec * 4); // speed up 4x for fun game pace!
        });

        return next;
      });
    }, 1000);

    return () => clearInterval(producerInterval);
  }, [buildings]);

  // Click handler to collect mine pending reserves
  const handleCollect = (building: BuildingState, e: React.MouseEvent) => {
    e.stopPropagation();
    const type = building.type === 'gold_mine' ? 'gold' : 'elixir';
    const amount = Math.floor(pendingReserves[building.id] || 0);

    if (amount <= 0) {
      onLogMessage(`No reserves accumulated in this ${BUILDING_METADATA[building.type].name} yet. Wait a few moments!`, 'info');
      return;
    }

    // Capacity checks
    if (type === 'gold' && gold >= maxGoldCap) {
      onLogMessage('Your Gold Storages are completely full! Upgrade storages or Town Hall.', 'warning');
      return;
    }
    if (type === 'elixir' && elixir >= maxElixirCap) {
      onLogMessage('Your Elixir Storages are completely full! Upgrade storages or Town Hall.', 'warning');
      return;
    }

    // Add loot to caps
    const actualAddGold = type === 'gold' ? Math.min(amount, maxGoldCap - gold) : 0;
    const actualAddElixir = type === 'elixir' ? Math.min(amount, maxElixirCap - elixir) : 0;

    onAddLoot(actualAddGold, actualAddElixir, 0);

    // Reset pending
    setPendingReserves(prev => ({
      ...prev,
      [building.id]: 0
    }));

    // Spawn floating success numbers
    const rect = e.currentTarget.getBoundingClientRect();
    const id = `f-${Date.now()}-${Math.random()}`;
    const text = `+${amount} ${type === 'gold' ? 'Gold' : 'Elixir'}`;
    
    setFloatingCollections(prev => [...prev, {
      id,
      text,
      type,
      x: e.clientX,
      y: e.clientY - 40
    }]);

    onLogMessage(`Harvested ${amount} ${type}!`, 'success');

    // Remove floaty texts after 1.5s
    setTimeout(() => {
      setFloatingCollections(prev => prev.filter(f => f.id !== id));
    }, 1500);
  };

  // Trigger global town hall upgrade
  const handleUpgradeTownHall = () => {
    const nextLevel = townHallLevel + 1;
    if (nextLevel > 5) {
      onLogMessage('Your Town Hall is already at the peak Level 5!', 'warning');
      return;
    }

    const meta = BUILDING_METADATA['town_hall'];
    // Cost formulas
    const costFactor = Math.pow(meta.levelMultiplier, townHallLevel - 1);
    const upgradeCost = Math.round(meta.baseCost * costFactor);

    if (gold < upgradeCost) {
      onLogMessage(`Insufficient gold! Upgrading to Town Hall Level ${nextLevel} costs ${upgradeCost} gold.`, 'error');
      return;
    }

    onUpgradeTownHall(upgradeCost);
    onLogMessage(`CONGRATULATIONS! Your Town Hall was upgraded to Level ${nextLevel}! New building capacity and structures unlocked in Shop.`, 'success');
  };

  const currentTrainedCount = Object.values(trainedTroops).reduce((a, b) => a + b, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="village_root">
      
      {/* Dynamic Floating Numbers layer */}
      <AnimatePresence>
        {floatingCollections.map(f => (
          <motion.div
            key={f.id}
            initial={{ opacity: 1, y: f.y, x: f.x - 40 }}
            animate={{ opacity: 0, y: f.y - 120 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className={`fixed font-mono font-bold text-sm pointer-events-none z-50 text-stroke ${
              f.type === 'gold' ? 'text-yellow-400' : 'text-pink-400'
            }`}
          >
            {f.text}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Profile Overview Card */}
      <div className="lg:col-span-8 bg-black/60 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-md text-white flex flex-col justify-between min-h-[220px]">
        <div>
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-amber-400">Village Overview</span>
              <h2 className="font-sans font-bold text-2xl tracking-tight text-white mt-1 text-stroke uppercase italic">Chief's Fortress Castle</h2>
              <span className="text-xs text-slate-300 font-sans mt-0.5 block">Nurturing a prospering clan since centuries.</span>
            </div>
            
            <div className="flex items-center gap-1.5 bg-black/50 border border-white/10 px-3 py-1.5 rounded-2xl shadow-md">
              <Trophy className="w-4 h-4 text-amber-400 fill-amber-400/20 animate-bounce" />
              <span className="font-mono font-bold text-[#ffda44] text-xs uppercase tracking-wide">{trophies} Trophies</span>
            </div>
          </div>

          {/* Core Resource Stocks bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            
            {/* Gold Stock */}
            <div className="bg-black/40 p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-baseline mb-1">
                <span className="font-sans font-bold text-slate-200 text-xs flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-yellow-400" />
                  Gold Reserves
                </span>
                <span className="font-mono text-xs text-slate-300">
                  <span className="font-bold text-yellow-400">{gold.toLocaleString()}</span> / {maxGoldCap.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-3.5 bg-black/80 rounded-full border border-white/10 overflow-hidden p-0.5">
                <div className="bg-gradient-to-r from-yellow-600 to-yellow-400 h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(250,204,21,0.5)]" style={{ width: `${Math.min(100, (gold / maxGoldCap) * 100)}%` }} />
              </div>
            </div>

            {/* Elixir Stock */}
            <div className="bg-black/40 p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-baseline mb-1">
                <span className="font-sans font-bold text-slate-200 text-xs flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-pink-500" />
                  Elixir Reserves
                </span>
                <span className="font-mono text-xs text-slate-300">
                  <span className="font-bold text-pink-400">{elixir.toLocaleString()}</span> / {maxElixirCap.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-3.5 bg-black/80 rounded-full border border-white/10 overflow-hidden p-0.5">
                <div className="bg-gradient-to-r from-pink-600 to-pink-400 h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(236,72,153,0.5)]" style={{ width: `${Math.min(100, (elixir / maxElixirCap) * 100)}%` }} />
              </div>
            </div>

          </div>
        </div>

        {/* Dashboard quick action links */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-white/5">
          <button
            onClick={() => onSwitchTab('editor')}
            className="flex-1 py-3 btn-secondary-sleek text-white text-xs font-bold rounded-xl transition-all uppercase tracking-wider text-center"
          >
            Design Village
          </button>
          <button
            onClick={() => onSwitchTab('battle')}
            className="flex-1 py-3 btn-combat text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg"
          >
            <Swords className="w-4 h-4" />
            Engage Raid Battles
          </button>
        </div>
      </div>

      {/* Town Hall Upgrade Control Card */}
      <div className="lg:col-span-4 bg-black/60 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-md text-white flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center pb-2 border-b border-white/10 mb-3">
            <h3 className="font-sans font-bold text-white tracking-tight text-sm flex items-center gap-1.5 uppercase italic">
              <Home className="w-4 h-4 text-[#ffda44]" />
              Town Hall Citadel
            </h3>
            <span className="bg-[#ffda44]/20 text-[#ffda44] text-[10px] font-mono font-bold px-2 py-0.5 border border-[#ffda44]/30 rounded-full shadow-[0_0_8px_rgba(255,218,68,0.2)]">
              Level {townHallLevel}
            </span>
          </div>
          
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Your primary central castle. Upgrading unlocks high tier defensive weapons (Archer Towers, Mortars) and allows more gold mines and barracks.
          </p>

          <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 text-[10px] mt-4 font-mono text-slate-300 flex flex-col gap-1">
            <div className="flex justify-between">
              <span>Next Level unlocks:</span>
              <span className="text-yellow-400 font-bold">New Walls, Collectors</span>
            </div>
            <div className="flex justify-between">
              <span>Upgrades Available:</span>
              <span className="text-amber-400 font-bold">TH Level {townHallLevel + 1} / 5</span>
            </div>
          </div>
        </div>

        {townHallLevel < 5 ? (
          (() => {
            const meta = BUILDING_METADATA['town_hall'];
            const costFactor = Math.pow(meta.levelMultiplier, townHallLevel - 1);
            const upgradeCost = Math.round(meta.baseCost * costFactor);
            const isAffordable = gold >= upgradeCost;

            return (
              <button
                onClick={handleUpgradeTownHall}
                className={`w-full py-2.5 mt-6 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md ${
                  isAffordable
                    ? 'btn-upgrade text-white'
                    : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
                }`}
                disabled={!isAffordable}
              >
                <ArrowUp className="w-3.5 h-3.5" />
                Upgrade TH Lvl {townHallLevel + 1} ({upgradeCost.toLocaleString()} Gold)
              </button>
            );
          })()
        ) : (
          <div className="w-full mt-6 py-2.5 bg-white/5 text-slate-400 text-xs font-medium text-center rounded-xl border border-white/5">
            🏆 Peak Level 5 Reached
          </div>
        )}
      </div>

      {/* Placed Real-time Mines & Resource gatherer clicker card */}
      <div className="lg:col-span-8 bg-black/60 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-md text-white">
        <h3 className="font-sans font-bold text-white tracking-tight text-sm pb-2 border-b border-white/10 mb-4 flex items-center gap-1.5 uppercase italic">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          Click-to-Collect Mines & Collectors
        </h3>
        
        {buildings.filter(b => b.type === 'gold_mine' || b.type === 'elixir_collector').length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
            {buildings.filter(b => b.type === 'gold_mine' || b.type === 'elixir_collector').map(b => {
              const meta = BUILDING_METADATA[b.type];
              const amount = Math.floor(pendingReserves[b.id] || 0);
              const maxCap = meta.statsByLevel[b.level - 1]?.capacity || 500;
              const type = b.type === 'gold_mine' ? 'gold' : 'elixir';

              return (
                <button
                  key={b.id}
                  onClick={(e) => handleCollect(b, e)}
                  className={`p-3.5 rounded-xl border text-left transition-all flex justify-between items-center group ${
                    amount > 0
                      ? 'bg-black/40 border-white/10 hover:bg-black/60 hover:border-white/20 text-slate-100 cursor-pointer shadow-md hover:shadow-lg'
                      : 'bg-black/20 border-white/5 text-slate-500 cursor-default opacity-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${type === 'gold' ? 'bg-yellow-400 shadow-[0_0_8px_#f59e0b]' : 'bg-pink-500 shadow-[0_0_8px_#ec4899]'}`} />
                      <span className="font-bold text-xs font-sans truncate">{meta.name} (Lvl {b.level})</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                      Capacity: {amount} / {maxCap}
                    </span>
                  </div>

                  {amount > 0 ? (
                    <span className={`text-xs font-mono font-bold px-2 py-1 bg-black rounded-lg group-hover:scale-105 transition-transform border border-white/10 ${
                      type === 'gold' ? 'text-yellow-400' : 'text-pink-400'
                    }`}>
                      Collect
                    </span>
                  ) : (
                    <span className="text-[9px] text-slate-400 font-mono italic">Mining...</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
            <Info className="w-8 h-8 opacity-30 mb-2" />
            <p className="text-xs font-sans">No mining facilities detected in your layout.</p>
            <p className="text-[10px] px-4 mt-1 font-sans">Visit the "Design Village" tab and select Gold Mines or Elixir Collectors in the Shop to start generating resource income streams.</p>
          </div>
        )}
      </div>

      {/* Army Camp Roster Panel */}
      <div className="lg:col-span-4 bg-black/60 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-md text-white flex flex-col justify-between">
        <div>
          <h3 className="font-sans font-bold text-white tracking-tight text-sm pb-2 border-b border-white/10 mb-4 flex items-center gap-1.5 uppercase italic">
            <Shield className="w-4 h-4 text-[#5ce1e6]" />
            Army Camp Forces
          </h3>

          {currentTrainedCount > 0 ? (
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
              {Object.entries(trainedTroops).map(([typeStr, count]) => {
                if (count <= 0) return null;
                const troop = typeStr as TroopType;
                const meta = TROOP_METADATA[troop];

                return (
                  <div
                    key={troop}
                    className="p-2 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between text-xs font-sans"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                      <span className="font-bold text-slate-200">{meta.name}</span>
                    </div>
                    <span className="font-mono font-bold text-amber-400">Qty: {count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
              <Swords className="w-8 h-8 opacity-35 mb-2" />
              <p className="text-xs font-sans">Army Camps are currently empty.</p>
              <p className="text-[10px] px-2 mt-1 font-sans">Navigate to the "Train Barracks" tab to recruit strong fighters using Elixir essences.</p>
            </div>
          )}
        </div>

        <button
          onClick={() => onSwitchTab('barracks')}
          className="w-full mt-6 py-2.5 btn-secondary-sleek text-white text-xs font-bold rounded-xl transition-all uppercase tracking-wider"
        >
          Train More Recruits
        </button>
      </div>

    </div>
  );
}
