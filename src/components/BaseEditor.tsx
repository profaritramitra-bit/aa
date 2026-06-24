/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BuildingState, BuildingType, BUILDING_METADATA, BaseAuditResult } from '../types';
import { Hammer, Trash2, ArrowUp, CheckCircle, Info, Sparkles, Shield, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BaseEditorProps {
  buildings: BuildingState[];
  townHallLevel: number;
  gold: number;
  elixir: number;
  onUpdateBuildings: (buildings: BuildingState[]) => void;
  onDeductResources: (goldAmount: number, elixirAmount: number) => void;
  onLogMessage: (text: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

const GRID_SIZE = 16;

export default function BaseEditor({
  buildings,
  townHallLevel,
  gold,
  elixir,
  onUpdateBuildings,
  onDeductResources,
  onLogMessage,
}: BaseEditorProps) {
  const [selectedShopItem, setSelectedShopItem] = useState<BuildingType | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);
  
  // AI Audit State
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<BaseAuditResult | null>(null);

  // Get count of a specific building type
  const getBuildingCount = (type: BuildingType) => {
    return buildings.filter(b => b.type === type).length;
  };

  // Get max allowed buildings of a specific type based on Town Hall level
  const getMaxAllowed = (type: BuildingType): number => {
    switch (type) {
      case 'town_hall': return 1;
      case 'gold_mine': return townHallLevel >= 4 ? 3 : townHallLevel >= 2 ? 2 : 1;
      case 'elixir_collector': return townHallLevel >= 4 ? 3 : townHallLevel >= 2 ? 2 : 1;
      case 'gold_storage': return townHallLevel >= 3 ? 2 : 1;
      case 'elixir_storage': return townHallLevel >= 3 ? 2 : 1;
      case 'cannon': return townHallLevel >= 5 ? 4 : townHallLevel >= 3 ? 3 : townHallLevel >= 2 ? 2 : 1;
      case 'archer_tower': return townHallLevel >= 4 ? 3 : townHallLevel >= 2 ? 2 : 1;
      case 'mortar': return townHallLevel >= 3 ? 2 : townHallLevel >= 2 ? 1 : 0;
      case 'barracks': return townHallLevel >= 3 ? 2 : 1;
      case 'wall': return townHallLevel * 10 + 2; // e.g., TH1=12, TH2=22, TH3=32, TH4=42, TH5=52
      default: return 0;
    }
  };

  // Render range indicators for defenses
  const getRangeCircle = (building: BuildingState) => {
    const meta = BUILDING_METADATA[building.type];
    const levelStats = meta.statsByLevel[building.level - 1];
    if (levelStats && levelStats.range) {
      return levelStats.range;
    }
    return 0;
  };

  // Find if a tile is occupied
  const getBuildingAt = (x: number, y: number): BuildingState | null => {
    return buildings.find(b => {
      const meta = BUILDING_METADATA[b.type];
      const w = meta.width;
      const h = meta.height;
      return x >= b.x && x < b.x + w && y >= b.y && y < b.y + h;
    }) || null;
  };

  // Tile click handler
  const handleTileClick = (x: number, y: number) => {
    const occupied = getBuildingAt(x, y);

    // 1. If in shop placement mode
    if (selectedShopItem) {
      const meta = BUILDING_METADATA[selectedShopItem];
      
      // Check boundaries
      if (x + meta.width > GRID_SIZE || y + meta.height > GRID_SIZE) {
        onLogMessage('Cannot build outside the village boundaries!', 'warning');
        return;
      }

      // Check limits
      const currentCount = getBuildingCount(selectedShopItem);
      const limit = getMaxAllowed(selectedShopItem);
      if (currentCount >= limit) {
        onLogMessage(`Max ${limit} ${meta.name}(s) allowed at Town Hall level ${townHallLevel}!`, 'warning');
        return;
      }

      // Check overlaps
      let overlaps = false;
      for (let dx = 0; dx < meta.width; dx++) {
        for (let dy = 0; dy < meta.height; dy++) {
          if (getBuildingAt(x + dx, y + dy)) {
            overlaps = true;
          }
        }
      }

      if (overlaps) {
        onLogMessage('Tile space is already occupied!', 'warning');
        return;
      }

      // Cost check
      const cost = meta.baseCost;
      if (meta.costType === 'gold' && gold < cost) {
        onLogMessage(`Insufficient gold! Need ${cost} gold.`, 'error');
        return;
      }
      if (meta.costType === 'elixir' && elixir < cost) {
        onLogMessage(`Insufficient elixir! Need ${cost} elixir.`, 'error');
        return;
      }

      // Build it!
      const level1Stats = meta.statsByLevel[0];
      const newBuilding: BuildingState = {
        id: `${selectedShopItem}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: selectedShopItem,
        x,
        y,
        level: 1,
        hp: level1Stats.hp,
        maxHp: level1Stats.hp,
        ...(selectedShopItem === 'gold_mine' || selectedShopItem === 'elixir_collector' ? { lastCollectedAt: Date.now() } : {})
      };

      if (meta.costType === 'gold') {
        onDeductResources(cost, 0);
      } else {
        onDeductResources(0, cost);
      }

      onUpdateBuildings([...buildings, newBuilding]);
      onLogMessage(`Successfully built ${meta.name}!`, 'success');
      setSelectedShopItem(null); // turn off shop mode
      return;
    }

    // 2. If moving an already selected building to an empty slot
    if (selectedBuildingId && !occupied) {
      const bToMove = buildings.find(b => b.id === selectedBuildingId);
      if (bToMove) {
        const meta = BUILDING_METADATA[bToMove.type];

        // Bounds check
        if (x + meta.width > GRID_SIZE || y + meta.height > GRID_SIZE) {
          onLogMessage('Cannot place outside grid!', 'warning');
          return;
        }

        // Overlap checks (exclude self)
        let overlaps = false;
        for (let dx = 0; dx < meta.width; dx++) {
          for (let dy = 0; dy < meta.height; dy++) {
            const bOnTile = getBuildingAt(x + dx, y + dy);
            if (bOnTile && bOnTile.id !== selectedBuildingId) {
              overlaps = true;
            }
          }
        }

        if (overlaps) {
          onLogMessage('New location is occupied!', 'warning');
          return;
        }

        // Relocate
        const updated = buildings.map(b => {
          if (b.id === selectedBuildingId) {
            return { ...b, x, y };
          }
          return b;
        });

        onUpdateBuildings(updated);
        setSelectedBuildingId(null);
        onLogMessage('Structure relocated.', 'info');
        return;
      }
    }

    // 3. Select clicked building
    if (occupied) {
      if (occupied.id === selectedBuildingId) {
        setSelectedBuildingId(null); // deselect
      } else {
        setSelectedBuildingId(occupied.id);
        setSelectedShopItem(null); // turn off builder placement
      }
    } else {
      setSelectedBuildingId(null);
    }
  };

  // Demolish handler
  const handleDemolish = (id: string) => {
    const building = buildings.find(b => b.id === id);
    if (!building) return;

    if (building.type === 'town_hall') {
      onLogMessage('You cannot demolish your Town Hall!', 'error');
      return;
    }

    onUpdateBuildings(buildings.filter(b => b.id !== id));
    setSelectedBuildingId(null);
    onLogMessage('Structure dismantled. No refund given.', 'warning');
  };

  // Upgrade handler
  const handleUpgrade = (id: string) => {
    const b = buildings.find(b => b.id === id);
    if (!b) return;

    const meta = BUILDING_METADATA[b.type];
    if (b.level >= meta.maxLevel) {
      onLogMessage('Structure is already at maximum level!', 'warning');
      return;
    }

    // Cost calculations
    const costFactor = Math.pow(meta.levelMultiplier, b.level);
    const upgradeCost = Math.round(meta.baseCost * costFactor);

    if (meta.costType === 'gold' && gold < upgradeCost) {
      onLogMessage(`Insufficient gold! Need ${upgradeCost} gold for upgrade.`, 'error');
      return;
    }
    if (meta.costType === 'elixir' && elixir < upgradeCost) {
      onLogMessage(`Insufficient elixir! Need ${upgradeCost} elixir for upgrade.`, 'error');
      return;
    }

    // Restrict level by Town Hall level (non-townhall structures cannot exceed Town Hall level)
    if (b.type !== 'town_hall' && b.level >= townHallLevel) {
      onLogMessage(`Upgrade your Town Hall to Level ${townHallLevel + 1} first!`, 'warning');
      return;
    }

    const nextStats = meta.statsByLevel[b.level];
    const updated = buildings.map(item => {
      if (item.id === id) {
        return {
          ...item,
          level: item.level + 1,
          hp: nextStats.hp,
          maxHp: nextStats.hp,
        };
      }
      return item;
    });

    if (meta.costType === 'gold') {
      onDeductResources(upgradeCost, 0);
    } else {
      onDeductResources(0, upgradeCost);
    }

    onUpdateBuildings(updated);
    setSelectedBuildingId(null);
    onLogMessage(`Upgraded ${meta.name} to Level ${b.level + 1}!`, 'success');
  };

  // Request AI base audit from Express server
  const handleAskElder = async () => {
    setIsAuditing(true);
    setAuditResult(null);
    try {
      const response = await fetch('/api/gemini/audit-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseLayout: buildings }),
      });
      const data = await response.json();
      setAuditResult(data);
      onLogMessage('Clan Elder Magnus finished base layout evaluation!', 'success');
    } catch (e) {
      console.error(e);
      onLogMessage('Failed to reach Elder Magnus. Check internet connection.', 'error');
    } finally {
      setIsAuditing(false);
    }
  };

  const activeBuilding = buildings.find(b => b.id === selectedBuildingId);
  const activeMeta = activeBuilding ? BUILDING_METADATA[activeBuilding.type] : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="base_editor_root">
      
      {/* Grid Canvas Section */}
      <div className="lg:col-span-8 flex flex-col items-center bg-black/60 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-md">
        
        {/* Editor Controls */}
        <div className="w-full flex flex-col sm:flex-row justify-between items-center gap-3 mb-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#ffda44]/10 rounded-lg border border-[#ffda44]/20">
              <Hammer className="text-[#ffda44] w-5 h-5 animate-bounce" />
            </div>
            <h3 className="font-sans font-bold text-white tracking-tight text-lg uppercase italic text-stroke">Village Layout Editor</h3>
          </div>
          <div className="flex gap-2">
            {selectedShopItem && (
              <button 
                onClick={() => setSelectedShopItem(null)}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-full transition-all border border-red-950 shadow-md flex items-center gap-1 active:translate-y-0.5"
              >
                Cancel Placement
              </button>
            )}
            <button
              onClick={handleAskElder}
              disabled={isAuditing}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 disabled:from-slate-800 disabled:to-slate-900 disabled:text-slate-500 text-white text-xs font-bold rounded-full transition-all shadow-[0_0_12px_rgba(147,51,234,0.4)] flex items-center gap-1.5 border border-purple-400/20 active:translate-y-0.5"
            >
              <Sparkles className={`w-3.5 h-3.5 text-yellow-300 ${isAuditing ? 'animate-spin' : ''}`} />
              {isAuditing ? 'Auditing Layout...' : 'Ask Clan Elder'}
            </button>
          </div>
        </div>

        {/* 16x16 Grid Board */}
        <div 
          className="relative w-full aspect-square max-w-[480px] bg-gradient-to-b from-[#1a3516] to-[#244b1e] border-4 border-[#122710] rounded-xl shadow-2xl overflow-hidden grid grid-cols-16 grid-rows-16 cursor-crosshair select-none"
          onMouseLeave={() => setHoverTile(null)}
        >
          {/* Base tiles */}
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
            const x = index % GRID_SIZE;
            const y = Math.floor(index / GRID_SIZE);
            const isAlternate = (x + y) % 2 === 0;
            const isEdge = x === 0 || x === GRID_SIZE - 1 || y === 0 || y === GRID_SIZE - 1;

            return (
              <div
                key={`tile-${x}-${y}`}
                className={`w-full h-full border-[0.5px] border-emerald-950/10 transition-colors duration-100 ${
                  isEdge ? 'bg-emerald-950/40' : isAlternate ? 'bg-emerald-800/20' : 'bg-emerald-800/10'
                } hover:bg-yellow-400/20`}
                onMouseEnter={() => setHoverTile({ x, y })}
                onClick={() => handleTileClick(x, y)}
              />
            );
          })}

          {/* Range Overlay for Hover/Selected towers */}
          {activeBuilding && (
            (() => {
              const range = getRangeCircle(activeBuilding);
              if (range === 0) return null;
              const meta = BUILDING_METADATA[activeBuilding.type];
              const cx = activeBuilding.x + meta.width / 2;
              const cy = activeBuilding.y + meta.height / 2;
              return (
                <div 
                  className="absolute rounded-full border border-yellow-400 bg-yellow-400/5 pointer-events-none mix-blend-screen transition-all"
                  style={{
                    width: `${(range * 2) * (100 / GRID_SIZE)}%`,
                    height: `${(range * 2) * (100 / GRID_SIZE)}%`,
                    left: `${(cx - range) * (100 / GRID_SIZE)}%`,
                    top: `${(cy - range) * (100 / GRID_SIZE)}%`,
                  }}
                />
              );
            })()
          )}

          {/* Buildings layer */}
          {buildings.map((b) => {
            const meta = BUILDING_METADATA[b.type];
            const isSelected = b.id === selectedBuildingId;
            const sizeWidth = (meta.width * 100) / GRID_SIZE;
            const sizeHeight = (meta.height * 100) / GRID_SIZE;
            const leftOffset = (b.x * 100) / GRID_SIZE;
            const topOffset = (b.y * 100) / GRID_SIZE;

            // Simple building skins using colors and shapes
            let skinColor = 'bg-slate-500';
            let label = meta.name.split(' ').map(w => w[0]).join(''); // short initials

            switch (b.type) {
              case 'town_hall':
                skinColor = 'bg-gradient-to-b from-amber-600 to-amber-800 border-amber-950';
                break;
              case 'cannon':
                skinColor = 'bg-gradient-to-b from-slate-700 to-slate-900 border-slate-950';
                break;
              case 'archer_tower':
                skinColor = 'bg-gradient-to-b from-stone-400 to-stone-600 border-stone-800';
                break;
              case 'mortar':
                skinColor = 'bg-gradient-to-b from-zinc-800 to-zinc-900 border-zinc-950';
                break;
              case 'gold_mine':
                skinColor = 'bg-gradient-to-b from-yellow-500 to-yellow-600 border-yellow-800';
                break;
              case 'elixir_collector':
                skinColor = 'bg-gradient-to-b from-pink-500 to-pink-600 border-pink-800';
                break;
              case 'gold_storage':
                skinColor = 'bg-yellow-400 border-yellow-600';
                break;
              case 'elixir_storage':
                skinColor = 'bg-pink-400 border-pink-600';
                break;
              case 'wall':
                skinColor = 'bg-stone-700 border-stone-900';
                label = ''; // walls do not need initials
                break;
              case 'barracks':
                skinColor = 'bg-blue-600 border-blue-900';
                break;
            }

            return (
              <motion.div
                key={b.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                className={`absolute rounded-md border-2 shadow-lg flex flex-col justify-center items-center text-[9px] font-bold text-slate-100 font-mono select-none cursor-pointer ${skinColor} ${
                  isSelected ? 'ring-4 ring-yellow-400 ring-offset-1 z-30' : 'z-20'
                }`}
                style={{
                  width: `${sizeWidth}%`,
                  height: `${sizeHeight}%`,
                  left: `${leftOffset}%`,
                  top: `${topOffset}%`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleTileClick(b.x, b.y);
                }}
              >
                {label && <span className="drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.8)]">{label}</span>}
                {b.type !== 'wall' && (
                  <span className="text-[7px] text-yellow-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                    Lvl {b.level}
                  </span>
                )}
                {/* Healthbar helper inside base */}
                <div className="absolute bottom-0 left-0 w-full h-[3px] bg-slate-900/60 rounded-b">
                  <div className="bg-green-500 h-full" style={{ width: `${(b.hp / b.maxHp) * 100}%` }} />
                </div>
              </motion.div>
            );
          })}

          {/* Ghost building preview when placing from Shop */}
          {selectedShopItem && hoverTile && (
            (() => {
              const meta = BUILDING_METADATA[selectedShopItem];
              // fit in bounds
              const fitX = Math.min(hoverTile.x, GRID_SIZE - meta.width);
              const fitY = Math.min(hoverTile.y, GRID_SIZE - meta.height);
              return (
                <div
                  className="absolute bg-green-500/30 border-2 border-dashed border-green-400 pointer-events-none z-10 rounded"
                  style={{
                    width: `${(meta.width * 100) / GRID_SIZE}%`,
                    height: `${(meta.height * 100) / GRID_SIZE}%`,
                    left: `${(fitX * 100) / GRID_SIZE}%`,
                    top: `${(fitY * 100) / GRID_SIZE}%`,
                  }}
                />
              );
            })()
          )}
        </div>

        <p className="text-slate-400 text-xs mt-3 text-center font-sans">
          Click an existing building to select it. Click empty grass to move it. Select items in the Shop below to place them.
        </p>
      </div>

      {/* Side Action/Info Panel */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        
        {/* Active Structure Actions */}
        <div className="bg-black/60 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-white flex-1">
          <h4 className="font-sans font-bold text-white tracking-tight text-sm pb-2 border-b border-white/10 flex items-center gap-1.5 uppercase italic">
            <Info className="w-4 h-4 text-blue-400" />
            Structure Inspector
          </h4>

          {activeBuilding && activeMeta ? (
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-yellow-400 font-sans text-base">{activeMeta.name}</span>
                  <span className="font-mono text-xs text-[#ffda44] bg-[#ffda44]/10 px-2.5 py-0.5 border border-[#ffda44]/20 rounded-full font-bold">Level {activeBuilding.level}</span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed font-sans">{activeMeta.description}</p>
              </div>

              {/* Stats Breakdown */}
              <div className="bg-black/40 p-3 rounded-xl border border-white/5 text-xs flex flex-col gap-2 font-sans">
                <div className="flex justify-between">
                  <span className="text-slate-400">Durability (HP):</span>
                  <span className="font-mono font-bold text-slate-200">{activeBuilding.hp.toLocaleString()} / {activeBuilding.maxHp.toLocaleString()}</span>
                </div>
                {activeMeta.statsByLevel[activeBuilding.level - 1].dps && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Damage Per Sec:</span>
                    <span className="font-mono font-bold text-red-400">{activeMeta.statsByLevel[activeBuilding.level - 1].dps} dps</span>
                  </div>
                )}
                {activeMeta.statsByLevel[activeBuilding.level - 1].range && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Weapon Range:</span>
                    <span className="font-mono font-bold text-blue-400">{activeMeta.statsByLevel[activeBuilding.level - 1].range} tiles</span>
                  </div>
                )}
                {activeMeta.statsByLevel[activeBuilding.level - 1].rate && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Production Rate:</span>
                    <span className="font-mono font-bold text-pink-400">{activeMeta.statsByLevel[activeBuilding.level - 1].rate} / hr</span>
                  </div>
                )}
                {activeMeta.statsByLevel[activeBuilding.level - 1].capacity && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Maximum Capacity:</span>
                    <span className="font-mono font-bold text-yellow-400">{activeMeta.statsByLevel[activeBuilding.level - 1].capacity?.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 mt-2">
                {activeBuilding.level < activeMeta.maxLevel ? (
                  (() => {
                    const costFactor = Math.pow(activeMeta.levelMultiplier, activeBuilding.level);
                    const cost = Math.round(activeMeta.baseCost * costFactor);
                    const isAffordable = activeMeta.costType === 'gold' ? gold >= cost : elixir >= cost;

                    return (
                      <button
                        onClick={() => handleUpgrade(activeBuilding.id)}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md ${
                          isAffordable
                            ? 'btn-upgrade text-white'
                            : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
                        }`}
                        disabled={!isAffordable}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                        Upgrade ({cost.toLocaleString()} {activeMeta.costType})
                      </button>
                    );
                  })()
                ) : (
                  <div className="w-full py-2 bg-white/5 text-slate-500 text-xs font-medium text-center rounded-xl border border-white/5">
                    Max Level Reached
                  </div>
                )}

                <button
                  onClick={() => handleDemolish(activeBuilding.id)}
                  disabled={activeBuilding.type === 'town_hall'}
                  className="w-full py-2.5 bg-red-950/40 hover:bg-red-900/60 disabled:opacity-30 disabled:hover:bg-red-950/40 disabled:cursor-not-allowed text-red-200 border border-red-900/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Demolish Structure
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
              <Compass className="w-8 h-8 opacity-30 mb-2 animate-spin-slow" />
              <p className="text-xs font-sans">No building selected.</p>
              <p className="text-[10px] px-4 mt-1 font-sans">Click on any building inside the village map to upgrade or adjust its grid positioning.</p>
            </div>
          )}
        </div>

        {/* AI Advisor Panel */}
        <div className="bg-black/60 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-white max-h-[300px] overflow-y-auto">
          <h4 className="font-sans font-bold text-white tracking-tight text-sm pb-2 border-b border-white/10 flex items-center gap-1.5 uppercase italic">
            <Shield className="w-4 h-4 text-purple-400" />
            Elder's Strategy Report
          </h4>
          
          <AnimatePresence mode="wait">
            {auditResult ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-3 text-xs flex flex-col gap-3 font-sans"
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[10px] uppercase font-black tracking-wider">Defensive Rating:</span>
                  <span className="text-sm font-bold px-3 py-1 bg-purple-900/50 border border-purple-500/50 text-purple-300 rounded font-mono shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                    {auditResult.rating}
                  </span>
                </div>

                <div>
                  <span className="text-[#ffda44] font-bold block mb-1">Strengths:</span>
                  <ul className="list-disc pl-4 space-y-1 text-slate-200">
                    {auditResult.strengths.map((s, idx) => (
                      <li key={idx} className="leading-tight">{s}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <span className="text-red-400 font-bold block mb-1">Gaps / Weaknesses:</span>
                  <ul className="list-disc pl-4 space-y-1 text-red-300/95">
                    {auditResult.weaknesses.map((w, idx) => (
                      <li key={idx} className="leading-tight">{w}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-black/40 border border-white/5 rounded-xl text-yellow-100/90 leading-relaxed font-sans italic text-[11px]">
                  "{auditResult.strategicAdvice}"
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                <Sparkles className="w-6 h-6 opacity-30 mb-2 text-indigo-400" />
                <p className="text-xs font-sans">No audit report generated yet.</p>
                <p className="text-[10px] px-2 mt-1 font-sans">Click "Ask Clan Elder" to let Magnus evaluate your defensive boundaries with Gemini.</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Builder Shop Section */}
        <div className="bg-black/60 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-white">
          <h4 className="font-sans font-bold text-white tracking-tight text-sm pb-2 border-b border-white/10 flex items-center gap-1.5 uppercase italic">
            <Hammer className="w-4 h-4 text-yellow-400" />
            Builder's Shop
          </h4>
          
          <div className="grid grid-cols-2 gap-2 mt-3 overflow-y-auto max-h-[220px] pr-1">
            {Object.values(BUILDING_METADATA).map((meta) => {
              const currentCount = getBuildingCount(meta.type);
              const maxCount = getMaxAllowed(meta.type);
              const isLocked = maxCount === 0;
              const isAtLimit = currentCount >= maxCount;
              const isAffordable = meta.costType === 'gold' ? gold >= meta.baseCost : elixir >= meta.baseCost;
              const isSelected = selectedShopItem === meta.type;

              return (
                <button
                  key={meta.type}
                  disabled={isLocked || isAtLimit || isSelected}
                  onClick={() => {
                    setSelectedShopItem(meta.type);
                    setSelectedBuildingId(null); // deselect existing
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between h-[85px] ${
                    isLocked
                      ? 'bg-black/20 border-white/5 text-slate-600 cursor-not-allowed opacity-50'
                      : isSelected
                      ? 'bg-[#ffda44]/15 border-[#ffda44] text-white ring-2 ring-[#ffda44] ring-offset-1 ring-offset-black'
                      : isAtLimit
                      ? 'bg-emerald-950/20 border-emerald-800 text-emerald-400 cursor-not-allowed'
                      : 'bg-black/40 border-white/10 hover:bg-black/60 hover:border-white/20 text-slate-200'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-xs font-sans truncate">{meta.name}</span>
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                      {isLocked ? 'Locked (TH too low)' : isAtLimit ? 'Max limit reached' : `Qty: ${currentCount}/${maxCount}`}
                    </span>
                  </div>

                  {!isLocked && !isAtLimit && (
                    <div className="flex items-center gap-1 text-[10px] font-mono font-bold mt-1">
                      <span className={meta.costType === 'gold' ? 'text-yellow-400' : 'text-pink-400'}>
                        {meta.baseCost.toLocaleString()} {meta.costType}
                      </span>
                    </div>
                  )}

                  {isAtLimit && (
                    <div className="absolute right-2 bottom-2 bg-emerald-950/80 border border-emerald-500/40 rounded px-1.5 py-0.5 text-[8px] font-sans text-emerald-300 font-bold">
                      Built
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
