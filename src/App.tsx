/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BuildingState, TroopType, INITIAL_VILLAGE, BUILDING_METADATA } from './types';
import VillageView from './components/VillageView';
import BaseEditor from './components/BaseEditor';
import BarracksView from './components/BarracksView';
import BattleSimulator from './components/BattleSimulator';
import ClanChat from './components/ClanChat';
import { Shield, Home, Hammer, Zap, Swords, MessageSquare, Terminal, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ToastLog {
  id: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'village' | 'editor' | 'barracks' | 'battle' | 'chat'>('village');
  
  // Game inventory and profile states
  const [gold, setGold] = useState(1500);
  const [elixir, setElixir] = useState(1500);
  const [gems, setGems] = useState(50);
  const [trophies, setTrophies] = useState(100);
  const [townHallLevel, setTownHallLevel] = useState(1);
  const [buildings, setBuildings] = useState<BuildingState[]>(INITIAL_VILLAGE);

  const [trainedTroops, setTrainedTroops] = useState<Record<TroopType, number>>({
    barbarian: 0,
    archer: 0,
    giant: 0,
    wizard: 0,
    dragon: 0,
  });

  // Floating notifications console logs
  const [logs, setLogs] = useState<ToastLog[]>([]);
  const [showLogsConsole, setShowLogsConsole] = useState(false);

  // Load saved progress from localStorage on boot
  useEffect(() => {
    const savedGold = localStorage.getItem('coc_gold');
    const savedElixir = localStorage.getItem('coc_elixir');
    const savedGems = localStorage.getItem('coc_gems');
    const savedTrophies = localStorage.getItem('coc_trophies');
    const savedTh = localStorage.getItem('coc_townhall');
    const savedBuildings = localStorage.getItem('coc_buildings');
    const savedTroops = localStorage.getItem('coc_troops');

    if (savedGold) setGold(parseInt(savedGold, 10));
    if (savedElixir) setElixir(parseInt(savedElixir, 10));
    if (savedGems) setGems(parseInt(savedGems, 10));
    if (savedTrophies) setTrophies(parseInt(savedTrophies, 10));
    if (savedTh) setTownHallLevel(parseInt(savedTh, 10));
    if (savedBuildings) {
      try {
        setBuildings(JSON.parse(savedBuildings));
      } catch (e) {
        console.error('Failed to parse saved buildings, loading defaults');
      }
    }
    if (savedTroops) {
      try {
        setTrainedTroops(JSON.parse(savedTroops));
      } catch (e) {
        console.error('Failed to parse saved troops');
      }
    }

    addLog('Fortress profile synced. Welcome back, Chief!', 'success');
  }, []);

  // Sync state changes to localStorage
  useEffect(() => {
    localStorage.setItem('coc_gold', gold.toString());
    localStorage.setItem('coc_elixir', elixir.toString());
    localStorage.setItem('coc_gems', gems.toString());
    localStorage.setItem('coc_trophies', trophies.toString());
    localStorage.setItem('coc_townhall', townHallLevel.toString());
    localStorage.setItem('coc_buildings', JSON.stringify(buildings));
    localStorage.setItem('coc_troops', JSON.stringify(trainedTroops));
  }, [gold, elixir, gems, trophies, townHallLevel, buildings, trainedTroops]);

  // Bind window functions for subcomponent background triggers
  useEffect(() => {
    (window as any)._onAddElixir = (amount: number) => {
      setElixir(prev => prev + amount);
    };
    (window as any)._onDeductElixir = (amount: number) => {
      setElixir(prev => Math.max(0, prev - amount));
    };

    return () => {
      delete (window as any)._onAddElixir;
      delete (window as any)._onDeductElixir;
    };
  }, []);

  // Helper log emitter
  const addLog = (text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newLog: ToastLog = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      type,
      timestamp: time
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50)); // limit 50 logs
  };

  // Upgrades Town Hall building inside layout
  const handleUpgradeTownHall = (cost: number) => {
    setGold(prev => Math.max(0, prev - cost));
    setTownHallLevel(prev => {
      const next = prev + 1;
      
      // Also update the Town Hall structure inside layout
      setBuildings(current => current.map(b => {
        if (b.type === 'town_hall') {
          const stats = BUILDING_METADATA['town_hall'].statsByLevel[next - 1];
          return {
            ...b,
            level: next,
            hp: stats.hp,
            maxHp: stats.hp
          };
        }
        return b;
      }));

      addLog(`Town Hall upgraded to level ${next}!`, 'success');
      return next;
    });
  };

  // Deducts builder costs
  const handleDeductResources = (goldAmount: number, elixirAmount: number) => {
    if (goldAmount > 0) {
      setGold(prev => Math.max(0, prev - goldAmount));
      addLog(`Spent ${goldAmount} Gold on structure adjustments.`, 'info');
    }
    if (elixirAmount > 0) {
      setElixir(prev => Math.max(0, prev - elixirAmount));
      addLog(`Spent ${elixirAmount} Elixir on structure adjustments.`, 'info');
    }
  };

  // Adds harvested mine loot or combat plunder loot
  const handleAddLoot = (goldAmount: number, elixirAmount: number, trophyAmount: number) => {
    if (goldAmount !== 0) {
      setGold(prev => Math.max(0, prev + goldAmount));
    }
    if (elixirAmount !== 0) {
      setElixir(prev => Math.max(0, prev + elixirAmount));
    }
    if (trophyAmount !== 0) {
      setTrophies(prev => Math.max(0, prev + trophyAmount));
      if (trophyAmount > 0) {
        addLog(`Gained +${trophyAmount} trophies!`, 'success');
      } else {
        addLog(`Lost ${trophyAmount} trophies in raid setback.`, 'warning');
      }
    }
  };

  // Complete troop enqueued finished
  const handleTrainTroop = (type: TroopType) => {
    setTrainedTroops(prev => ({
      ...prev,
      [type]: (prev[type] || 0) + 1,
    }));
  };

  // Instant completes the training queue
  const handleInstantCompleteQueue = (gemCost: number, finishedTroops: TroopType[]) => {
    setGems(prev => Math.max(0, prev - gemCost));
    setTrainedTroops(prev => {
      const next = { ...prev };
      finishedTroops.forEach(t => {
        next[t] = (next[t] || 0) + 1;
      });
      return next;
    });
    addLog(`Instant trained queue using ${gemCost} gems!`, 'success');
  };

  // Clear recruitment queue
  const handleClearQueue = () => {
    addLog('Training facility queue cleared.', 'info');
  };

  // Combat deployment reducer
  const handleDeployTroopFromArmy = (type: TroopType) => {
    setTrainedTroops(prev => ({
      ...prev,
      [type]: Math.max(0, (prev[type] || 0) - 1),
    }));
  };

  // Dev tools resets
  const handleFactoryReset = () => {
    localStorage.clear();
    setGold(1500);
    setElixir(1500);
    setGems(50);
    setTrophies(100);
    setTownHallLevel(1);
    setBuildings(INITIAL_VILLAGE);
    setTrainedTroops({
      barbarian: 0,
      archer: 0,
      giant: 0,
      wizard: 0,
      dragon: 0,
    });
    addLog('Factory profile reset successfully.', 'warning');
  };

  return (
    <div className="min-h-screen grass-map-bg text-slate-100 flex flex-col font-sans relative" id="app_root">
      
      {/* Top Header Banner */}
      <header className="bg-black/60 backdrop-blur-md border-b border-white/10 py-4 px-6 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Logo Title */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-600 rounded-full flex items-center justify-center font-black text-xl shadow-[0_0_15px_rgba(37,99,235,0.6)]">
              <Shield className="w-6 h-6 text-slate-100 fill-slate-100/10" />
            </div>
            <div>
              <h1 className="font-sans font-bold text-slate-100 tracking-tight text-lg leading-tight uppercase italic text-stroke">Clash of Clans</h1>
              <span className="text-[10px] text-[#ffda44] uppercase font-mono tracking-wider font-bold">Tactical Simulator</span>
            </div>
          </div>

          {/* Quick resource inventory display - formatted to look like Sleek HUD */}
          <div className="flex flex-wrap gap-3 items-center justify-center">
            
            {/* Gold */}
            <div className="flex items-center gap-3 bg-gradient-to-l from-yellow-600/80 to-black/30 backdrop-blur-sm rounded-l-full pl-5 pr-2 py-1 border-r-4 border-yellow-400 shadow-md">
              <span className="font-mono text-sm font-bold text-white tracking-wide">{gold.toLocaleString()}</span>
              <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg text-sm">🪙</div>
            </div>

            {/* Elixir */}
            <div className="flex items-center gap-3 bg-gradient-to-l from-pink-600/80 to-black/30 backdrop-blur-sm rounded-l-full pl-5 pr-2 py-1 border-r-4 border-pink-400 shadow-md">
              <span className="font-mono text-sm font-bold text-white tracking-wide">{elixir.toLocaleString()}</span>
              <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center shadow-lg text-sm">🧪</div>
            </div>

            {/* Gems */}
            <div className="flex items-center gap-3 bg-gradient-to-l from-emerald-600/80 to-black/30 backdrop-blur-sm rounded-l-full pl-5 pr-2 py-1 border-r-4 border-[#5ce1e6] shadow-md">
              <span className="font-mono text-sm font-bold text-white tracking-wide">{gems.toLocaleString()}</span>
              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg text-sm">💎</div>
            </div>

            {/* Log Console Trigger */}
            <button
              onClick={() => setShowLogsConsole(prev => !prev)}
              className="p-2 bg-black/40 hover:bg-black/70 rounded-xl border border-white/10 text-slate-300 hover:text-white transition-all shadow-md flex items-center justify-center"
              title="Toggle Console Log Feed"
            >
              <Terminal className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'village' && (
              <VillageView
                buildings={buildings}
                trainedTroops={trainedTroops}
                gold={gold}
                elixir={elixir}
                gems={gems}
                trophies={trophies}
                townHallLevel={townHallLevel}
                onUpgradeTownHall={handleUpgradeTownHall}
                onAddLoot={handleAddLoot}
                onLogMessage={addLog}
                onSwitchTab={(tab) => {
                  if (tab === 'editor') setActiveTab('editor');
                  if (tab === 'barracks') setActiveTab('barracks');
                  if (tab === 'battle') setActiveTab('battle');
                  if (tab === 'chat') setActiveTab('chat');
                }}
              />
            )}

            {activeTab === 'editor' && (
              <BaseEditor
                buildings={buildings}
                townHallLevel={townHallLevel}
                gold={gold}
                elixir={elixir}
                onUpdateBuildings={setBuildings}
                onDeductResources={handleDeductResources}
                onLogMessage={addLog}
              />
            )}

            {activeTab === 'barracks' && (
              <BarracksView
                elixir={elixir}
                gems={gems}
                trainedTroops={trainedTroops}
                onTrainTroop={handleTrainTroop}
                onInstantCompleteQueue={handleInstantCompleteQueue}
                onClearQueue={handleClearQueue}
                onLogMessage={addLog}
              />
            )}

            {activeTab === 'battle' && (
              <BattleSimulator
                trainedTroops={trainedTroops}
                gold={gold}
                onAddLoot={handleAddLoot}
                onDeployTroopFromArmy={handleDeployTroopFromArmy}
                onLogMessage={addLog}
              />
            )}

            {activeTab === 'chat' && (
              <ClanChat
                onLogMessage={addLog}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Log Console Modal (Drawer style) */}
      <AnimatePresence>
        {showLogsConsole && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 50 }}
            className="fixed bottom-20 right-6 z-50 bg-black/90 border border-white/10 rounded-2xl p-4 w-[350px] shadow-2xl backdrop-blur-md text-white text-xs"
          >
            <div className="flex justify-between items-center pb-2 border-b border-white/10 mb-3">
              <span className="font-bold font-sans text-slate-300">Tactical Console Log</span>
              <button 
                onClick={handleFactoryReset}
                className="text-[9px] uppercase font-bold text-red-400 bg-red-950/40 px-2 py-0.5 rounded border border-red-900/30 hover:bg-red-900/60"
              >
                Reset Progress
              </button>
            </div>
            
            <div className="max-h-[200px] overflow-y-auto space-y-1.5 font-mono pr-1">
              {logs.length > 0 ? (
                logs.map(log => (
                  <div key={log.id} className="leading-tight flex justify-between gap-2">
                    <span className="text-slate-500 font-mono flex-shrink-0">[{log.timestamp}]</span>
                    <span className={`flex-1 ${
                      log.type === 'success' 
                        ? 'text-emerald-400 font-semibold' 
                        : log.type === 'error'
                        ? 'text-red-400'
                        : log.type === 'warning'
                        ? 'text-amber-400'
                        : 'text-slate-300'
                    }`}>
                      {log.text}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-400 py-8 italic font-sans">No logs received yet.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Sticky Tabbed Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/85 border-t border-white/10 backdrop-blur-xl py-2.5 px-6 z-40 shadow-2xl">
        <div className="max-w-md mx-auto flex justify-between items-center">
          
          {/* Home Tab */}
          <button
            onClick={() => setActiveTab('village')}
            className={`flex flex-col items-center gap-1 transition-all duration-200 ${
              activeTab === 'village' ? 'text-[#ffda44] scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[9px] font-sans font-bold">Citadel Home</span>
          </button>

          {/* Design Tab */}
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex flex-col items-center gap-1 transition-all duration-200 ${
              activeTab === 'editor' ? 'text-[#ffda44] scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Hammer className="w-5 h-5" />
            <span className="text-[9px] font-sans font-bold">Base Editor</span>
          </button>

          {/* Training Tab */}
          <button
            onClick={() => setActiveTab('barracks')}
            className={`flex flex-col items-center gap-1 transition-all duration-200 ${
              activeTab === 'barracks' ? 'text-[#ffda44] scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-5 h-5" />
            <span className="text-[9px] font-sans font-bold">Train Barracks</span>
          </button>

          {/* Combat Tab */}
          <button
            onClick={() => setActiveTab('battle')}
            className={`flex flex-col items-center gap-1 transition-all duration-200 ${
              activeTab === 'battle' ? 'text-red-400 scale-115 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] font-black italic text-stroke' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Swords className="w-5 h-5" />
            <span className="text-[9px] font-sans font-bold uppercase tracking-tighter">Raid Battles</span>
          </button>

          {/* Chat Tab */}
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center gap-1 transition-all duration-200 ${
              activeTab === 'chat' ? 'text-[#ffda44] scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[9px] font-sans font-bold">Clan Chat</span>
          </button>

        </div>
      </nav>

    </div>
  );
}
