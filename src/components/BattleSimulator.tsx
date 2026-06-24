/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  BuildingState, 
  BuildingType, 
  BUILDING_METADATA, 
  OpponentBase, 
  TroopType, 
  TROOP_METADATA, 
  TroopInstance, 
  ProjectileInstance, 
  FloatingText,
  BattleParticle
} from '../types';
import { Swords, Search, Flame, Trophy, Coins, Sparkles, User, RefreshCw, Star, Play, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BattleSimulatorProps {
  trainedTroops: Record<TroopType, number>;
  gold: number;
  onAddLoot: (goldAmount: number, elixirAmount: number, trophies: number) => void;
  onDeployTroopFromArmy: (type: TroopType) => void;
  onLogMessage: (text: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

const GRID_SIZE = 16;

export default function BattleSimulator({
  trainedTroops,
  gold,
  onAddLoot,
  onDeployTroopFromArmy,
  onLogMessage,
}: BattleSimulatorProps) {
  // Game states: 'idle' | 'searching' | 'match' | 'battling' | 'summary'
  const [battleState, setBattleState] = useState<'idle' | 'searching' | 'match' | 'battling' | 'summary'>('idle');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'legendary'>('medium');
  const [opponent, setOpponent] = useState<OpponentBase | null>(null);
  
  // Deploy states
  const [selectedDeployTroop, setSelectedDeployTroop] = useState<TroopType | null>(null);
  const [currentArmy, setCurrentArmy] = useState<Record<TroopType, number>>({
    barbarian: 0,
    archer: 0,
    giant: 0,
    wizard: 0,
    dragon: 0,
  });

  // Active Battle Loop States (Stored in refs for fast animation access and states for rendering)
  const [destructionPercentage, setDestructionPercentage] = useState(0);
  const [stars, setStars] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(90);
  const [lootEarned, setLootEarned] = useState({ gold: 0, elixir: 0 });

  // Refs for the simulation engine loops
  const simulationBuildingsRef = useRef<BuildingState[]>([]);
  const initialBuildingsCountRef = useRef(0);
  const activeTroopsRef = useRef<TroopInstance[]>([]);
  const projectilesRef = useRef<ProjectileInstance[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const particlesRef = useRef<BattleParticle[]>([]);
  
  // Trigger triggers for React components
  const [renderTrigger, setRenderTrigger] = useState(0);
  const [deployedTroopSummary, setDeployedTroopSummary] = useState<Record<string, number>>({});
  const [aiCommentary, setAiCommentary] = useState<string>('');
  const [isCommentaryLoading, setIsCommentaryLoading] = useState(false);

  // Animation Frame Ref
  const gameLoopRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // Initialize army when opponent matched
  useEffect(() => {
    if (battleState === 'match') {
      setCurrentArmy({ ...trainedTroops });
      // Reset deployments trackers
      const summary: Record<string, number> = {};
      Object.keys(trainedTroops).forEach(k => {
        summary[k] = 0;
      });
      setDeployedTroopSummary(summary);
    }
  }, [battleState, trainedTroops]);

  // Matchmaking search
  const handleFindOpponent = async () => {
    if (gold < 50) {
      onLogMessage('Finding an opponent costs 50 Gold! Collect resources first.', 'error');
      return;
    }

    onDeductGoldCost(50);
    setBattleState('searching');
    setOpponent(null);
    setAiCommentary('');

    try {
      const response = await fetch('/api/gemini/generate-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty }),
      });
      const data = await response.json();
      setOpponent(data);
      setBattleState('match');
      onLogMessage(`Matched with ${data.name}! Evaluated theme: ${data.theme}`, 'success');
    } catch (e) {
      console.error(e);
      onLogMessage('Matchmaking search timed out. Loading local goblin camp.', 'error');
      setBattleState('idle');
    }
  };

  // Safe deduction for searching cost
  const onDeductGoldCost = (amount: number) => {
    onAddLoot(-amount, 0, 0);
  };

  // Deployment handler
  const handleGridDeploy = (x: number, y: number) => {
    if (battleState !== 'match' && battleState !== 'battling') return;
    if (!selectedDeployTroop) {
      onLogMessage('Select a trained troop card from the bottom dock first!', 'info');
      return;
    }

    // Border validation (Must deploy in perimeter tiles: x or y is 0, 1, 14, 15)
    const isPerimeter = x <= 1 || x >= GRID_SIZE - 2 || y <= 1 || y >= GRID_SIZE - 2;
    if (!isPerimeter) {
      onLogMessage('Troops must be deployed along the outer green borders!', 'warning');
      return;
    }

    if (currentArmy[selectedDeployTroop] <= 0) {
      onLogMessage(`No more ${selectedDeployTroop}s available!`, 'error');
      return;
    }

    // Consume troop
    setCurrentArmy(prev => ({
      ...prev,
      [selectedDeployTroop]: prev[selectedDeployTroop] - 1
    }));
    onDeployTroopFromArmy(selectedDeployTroop);

    // Track deployments for AI commentary
    setDeployedTroopSummary(prev => ({
      ...prev,
      [selectedDeployTroop]: (prev[selectedDeployTroop] || 0) + 1
    }));

    // Create Troop Instance
    const meta = TROOP_METADATA[selectedDeployTroop];
    const newTroop: TroopInstance = {
      id: `${selectedDeployTroop}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: selectedDeployTroop,
      x: x + 0.5, // center offset
      y: y + 0.5,
      hp: meta.hp,
      maxHp: meta.hp,
      targetBuildingId: null,
      state: 'marching',
      lastAttackAt: 0,
    };

    activeTroopsRef.current.push(newTroop);

    // Add particle spawn puff
    spawnPuff(x + 0.5, y + 0.5, '#f8fafc', 15);

    // If first troop deployed, initiate Battle mode
    if (battleState === 'match') {
      onStartBattle();
    }
  };

  // Start simulation loop
  const onStartBattle = () => {
    if (!opponent) return;
    setBattleState('battling');
    setTimerSeconds(90);
    setLootEarned({ gold: 0, elixir: 0 });
    
    // Setup refs
    simulationBuildingsRef.current = JSON.parse(JSON.stringify(opponent.buildings));
    // Filter out walls from "initial count" because destroying them doesn't add to completion stars
    initialBuildingsCountRef.current = opponent.buildings.filter(b => b.type !== 'wall').length;
    
    projectilesRef.current = [];
    floatingTextsRef.current = [];
    particlesRef.current = [];
    lastUpdateTimeRef.current = Date.now();

    // Spawn AI floating battle log
    onLogMessage('Raid started! Destroy the Town Hall to claim a Star!', 'info');

    // Run interval countdown timer
    const timerInterval = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          onStopBattle();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Run animation frames
    const tick = () => {
      if (battleState !== 'summary') {
        updateBattlePhysics();
        setRenderTrigger(prev => prev + 1);
        gameLoopRef.current = requestAnimationFrame(tick);
      }
    };
    gameLoopRef.current = requestAnimationFrame(tick);

    // Store timer cleaner
    (window as any)._battleTimerInterval = timerInterval;
  };

  // Terminate battle
  const onStopBattle = () => {
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
    if ((window as any)._battleTimerInterval) {
      clearInterval((window as any)._battleTimerInterval);
    }

    // Determine star achievements
    let finalStars = 0;
    const isTownHallDestroyed = !simulationBuildingsRef.current.some(b => b.type === 'town_hall' && b.hp > 0);
    const percentage = calculateDestruction();
    
    if (isTownHallDestroyed) finalStars += 1;
    if (percentage >= 50) finalStars += 1;
    if (percentage === 100) finalStars += 1;

    setStars(finalStars);
    setBattleState('summary');

    // Calculate final rewards
    const lootRatio = percentage / 100;
    const finalGold = Math.round((opponent?.goldReward || 0) * lootRatio);
    const finalElixir = Math.round((opponent?.elixirReward || 0) * lootRatio);
    const trophyReward = finalStars > 0 ? (opponent?.difficulty === 'legendary' ? 30 : opponent?.difficulty === 'hard' ? 22 : 12) : -10;

    setLootEarned({ gold: finalGold, elixir: finalElixir });
    onAddLoot(finalGold, finalElixir, trophyReward);

    // Fetch AI commentary
    fetchAiCommentary(percentage, finalStars, trophyReward);
  };

  // Fetch battle review from Gemini proxy
  const fetchAiCommentary = async (percentage: number, finalStars: number, trophies: number) => {
    setIsCommentaryLoading(true);
    try {
      const response = await fetch('/api/gemini/battle-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalScore: percentage,
          finalStars,
          troopsDeployed: deployedTroopSummary,
          duration: 90 - timerSeconds,
          opponentName: opponent?.name || 'Unnamed Base'
        }),
      });
      const data = await response.json();
      setAiCommentary(data.commentary);
    } catch (e) {
      console.error(e);
      setAiCommentary("By Thor's hammer, that was a spectacular raid, Chief! The loot has been carried back to our vaults. Re-arm, upgrade, and let's conquer more outposts!");
    } finally {
      setIsCommentaryLoading(false);
    }
  };

  // Helper calculation
  const calculateDestruction = () => {
    const totalDestructible = opponent?.buildings.filter(b => b.type !== 'wall').length || 1;
    const activeDestructible = simulationBuildingsRef.current.filter(b => b.type !== 'wall' && b.hp > 0).length;
    const destroyed = totalDestructible - activeDestructible;
    return Math.round((destroyed / totalDestructible) * 100);
  };

  // Puff Particle Spawn
  const spawnPuff = (x: number, y: number, color: string, count = 10) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 0.15 + 0.05;
      particlesRef.current.push({
        id: `${Date.now()}-${Math.random()}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: Math.random() * 3 + 2,
        life: 15,
        maxLife: 15
      });
    }
  };

  // Battle Physics Loop
  const updateBattlePhysics = () => {
    const now = Date.now();
    const dt = (now - lastUpdateTimeRef.current) / 1000;
    lastUpdateTimeRef.current = now;

    const troops = activeTroopsRef.current;
    const buildings = simulationBuildingsRef.current;
    const projectiles = projectilesRef.current;
    const floatingTexts = floatingTextsRef.current;
    const particles = particlesRef.current;

    // 1. Process Troop behaviors
    troops.forEach(troop => {
      if (troop.hp <= 0) {
        troop.state = 'dead';
        return;
      }

      const meta = TROOP_METADATA[troop.type];

      // Pathfind: Search target
      let target = buildings.find(b => b.id === troop.targetBuildingId && b.hp > 0);
      
      if (!target) {
        // Find new target
        let potentialTargets = buildings.filter(b => b.hp > 0);
        if (potentialTargets.length === 0) return; // All buildings destroyed!

        // If favorite target is defenses, search those first
        if (meta.favoriteTarget === 'defenses') {
          const defenses = potentialTargets.filter(b => ['cannon', 'archer_tower', 'mortar'].includes(b.type));
          if (defenses.length > 0) {
            potentialTargets = defenses;
          }
        }

        // Find nearest potential target
        let nearest: BuildingState | null = null;
        let minDist = Infinity;
        
        potentialTargets.forEach(b => {
          const bMeta = BUILDING_METADATA[b.type];
          // center of building
          const bx = b.x + bMeta.width / 2;
          const by = b.y + bMeta.height / 2;
          const dist = Math.hypot(bx - troop.x, by - troop.y);
          if (dist < minDist) {
            minDist = dist;
            nearest = b;
          }
        });

        if (nearest) {
          troop.targetBuildingId = (nearest as BuildingState).id;
          target = nearest;
        }
      }

      if (target) {
        const bMeta = BUILDING_METADATA[target.type];
        const tx = target.x + bMeta.width / 2;
        const ty = target.y + bMeta.height / 2;
        const dist = Math.hypot(tx - troop.x, ty - troop.y) - (bMeta.width / 2);

        // Within attack range?
        if (dist <= meta.range) {
          troop.state = 'attacking';
          
          // Attack tick (cooldown check: 1 sec)
          if (now - troop.lastAttackAt >= 1000) {
            troop.lastAttackAt = now;
            target.hp -= meta.dps;

            // Spawn dynamic damage floating text
            floatingTexts.push({
              id: `${Date.now()}-${Math.random()}`,
              text: `-${meta.dps}`,
              x: target.x + Math.random() * bMeta.width,
              y: target.y,
              color: 'text-red-500 font-bold',
              alpha: 1,
              life: 20
            });

            // Fire sparks
            spawnPuff(tx, ty, meta.color, 4);

            // Handle building destruction
            if (target.hp <= 0) {
              target.hp = 0;
              spawnPuff(tx, ty, '#f59e0b', 25); // fire blast
              onLogMessage(`Enemy ${bMeta.name} destroyed!`, 'info');
              
              // Trigger score refresh
              const progress = calculateDestruction();
              setDestructionPercentage(progress);
            }
          }
        } else {
          // March towards target
          troop.state = 'marching';
          const angle = Math.atan2(ty - troop.y, tx - troop.x);
          const moveStep = meta.speed * 0.03; // frame speed scale
          troop.x += Math.cos(angle) * moveStep;
          troop.y += Math.sin(angle) * moveStep;
        }
      }
    });

    // 2. Process Defensive Weapons firing
    buildings.forEach(b => {
      if (b.hp <= 0) return;
      if (!['cannon', 'archer_tower', 'mortar'].includes(b.type)) return;

      const meta = BUILDING_METADATA[b.type];
      const levelStats = meta.statsByLevel[b.level - 1];
      if (!levelStats || !levelStats.range || !levelStats.dps) return;

      const bx = b.x + meta.width / 2;
      const by = b.y + meta.height / 2;

      // Find targets in range
      const aliveTroopsInCoverage = troops.filter(t => t.hp > 0);
      let targetTroop: TroopInstance | null = null;
      let minDist = Infinity;

      aliveTroopsInCoverage.forEach(t => {
        const dist = Math.hypot(t.x - bx, t.y - by);
        
        // Mortar minimum blind range check (mortar can't shoot targets within 3 grid units)
        if (b.type === 'mortar' && dist < 3) return;

        if (dist <= levelStats.range && dist < minDist) {
          minDist = dist;
          targetTroop = t;
        }
      });

      if (targetTroop) {
        // Fire speed cooldown (e.g. cannon fires every 1.2s, archer tower every 0.8s, mortar every 4.0s)
        const fireInterval = b.type === 'mortar' ? 4000 : b.type === 'cannon' ? 1200 : 800;
        const bExtra: any = b;
        const lastFired = bExtra.lastFiredAt || 0;

        if (now - lastFired >= fireInterval) {
          bExtra.lastFiredAt = now;

          // Spawn visual projectile flying
          projectiles.push({
            id: `${Date.now()}-${Math.random()}`,
            type: b.type === 'cannon' ? 'cannonball' : b.type === 'mortar' ? 'mortar_shell' : 'arrow',
            x: bx,
            y: by,
            targetX: (targetTroop as TroopInstance).x,
            targetY: (targetTroop as TroopInstance).y,
            targetTroopId: (targetTroop as TroopInstance).id,
            speed: b.type === 'mortar' ? 0.05 : 0.15, // speed scale per tick
            damage: levelStats.dps * (fireInterval / 1000) // damage proportionate to firing interval
          });
        }
      }
    });

    // 3. Move Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      const troopTarget = troops.find(t => t.id === p.targetTroopId && t.hp > 0);

      // Re-route slightly if troop moved, otherwise fly to landing target
      const tx = troopTarget ? troopTarget.x : p.targetX;
      const ty = troopTarget ? troopTarget.y : p.targetY;

      const distToLanding = Math.hypot(tx - p.x, ty - p.y);

      if (distToLanding < 0.3) {
        // Landing hit!
        if (p.type === 'mortar_shell') {
          // Splash Area effect! Damage all troops within 1.5 tiles radius
          spawnPuff(p.x, p.y, '#f97316', 20); // big yellow ring
          troops.forEach(t => {
            if (t.hp <= 0) return;
            const dist = Math.hypot(t.x - p.x, t.y - p.y);
            if (dist <= 1.5) {
              t.hp -= p.damage;
              floatingTexts.push({
                id: `${Date.now()}-${Math.random()}`,
                text: `-${Math.round(p.damage)}`,
                x: t.x,
                y: t.y - 0.5,
                color: 'text-amber-500 font-bold',
                alpha: 1,
                life: 15
              });
            }
          });
        } else {
          // Single target impact
          if (troopTarget) {
            troopTarget.hp -= p.damage;
            floatingTexts.push({
              id: `${Date.now()}-${Math.random()}`,
              text: `-${Math.round(p.damage)}`,
              x: troopTarget.x,
              y: troopTarget.y - 0.5,
              color: 'text-orange-500 font-bold',
              alpha: 1,
              life: 15
            });
            spawnPuff(p.x, p.y, p.type === 'cannonball' ? '#475569' : '#ec4899', 4);
          }
        }

        // Delete projectile
        projectiles.splice(i, 1);
      } else {
        // March projectile vector
        const angle = Math.atan2(ty - p.y, tx - p.x);
        p.x += Math.cos(angle) * p.speed;
        p.y += Math.sin(angle) * p.speed;
      }
    }

    // 4. Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const part = particles[i];
      part.x += part.vx;
      part.y += part.vy;
      part.life--;
      if (part.life <= 0) {
        particles.splice(i, 1);
      }
    }

    // 5. Update floating texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const f = floatingTexts[i];
      f.y -= 0.01; // drift up
      f.life--;
      if (f.life <= 0) {
        floatingTexts.splice(i, 1);
      }
    }

    // Filter out completely dead troops
    activeTroopsRef.current = troops.filter(t => t.hp > 0);

    // 6. Check end of combat conditions
    const isBaseWiped = !buildings.some(b => b.type !== 'wall' && b.hp > 0);
    const hasMoreTroopsToDeploy = Object.values(currentArmy).some(count => (count as number) > 0);
    const noTroopsLeftOnSoil = activeTroopsRef.current.length === 0;

    if (isBaseWiped) {
      onStopBattle();
    } else if (noTroopsLeftOnSoil && !hasMoreTroopsToDeploy) {
      // Wiped out all deployed units and nothing remains in storage
      onStopBattle();
    }
  };

  return (
    <div className="flex flex-col gap-6" id="battle_simulator_root">
      
      {/* Search Header Panel */}
      {battleState === 'idle' && (
        <div className="bg-black/60 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-md text-white flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-red-500/10 rounded-lg border border-red-500/20">
                <Swords className="text-red-500 w-6 h-6 animate-pulse" />
              </div>
              <h3 className="font-sans font-bold text-white tracking-tight text-xl uppercase italic text-stroke">Raiding Arena Matchmaking</h3>
            </div>
            <p className="text-sm text-slate-300 font-sans leading-relaxed">
              Deduct a small 50 Gold searching scout fee to search for neighboring enemy outposts. Select your desired tactical difficulty before searching!
            </p>
            
            {/* Difficulty selectors */}
            <div className="flex flex-wrap gap-2 mt-4">
              {(['easy', 'medium', 'hard', 'legendary'] as const).map(level => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all border ${
                    difficulty === level
                      ? 'bg-red-500 text-white border-red-950 shadow-md scale-105'
                      : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleFindOpponent}
            className="w-full md:w-auto btn-combat text-white font-bold px-8 py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 active:translate-y-0.5"
          >
            <Search className="w-5 h-5" />
            Scout Opponent (50 Gold)
          </button>
        </div>
      )}

      {/* Searching Loader Animation */}
      {battleState === 'searching' && (
        <div className="bg-black/60 border border-white/10 rounded-2xl p-16 shadow-2xl backdrop-blur-md text-white flex flex-col items-center justify-center text-center">
          <RefreshCw className="w-12 h-12 text-red-500 animate-spin mb-4" />
          <h4 className="font-sans font-bold text-white text-lg uppercase italic text-stroke">Scouting Nearby Territorials...</h4>
          <p className="text-xs text-slate-400 mt-2 font-sans max-w-sm leading-relaxed">
            Elder Magnus is scouting targets with Gemini. Constructing custom wall layers and verifying defense limits.
          </p>
        </div>
      )}

      {/* MATCH/ACTIVE BATTLE SCREEN */}
      {(battleState === 'match' || battleState === 'battling') && opponent && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Active Battle Board */}
          <div className="lg:col-span-8 flex flex-col items-center bg-black/60 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-md relative">
            
            {/* Status Headbar */}
            <div className="w-full flex justify-between items-center mb-4 pb-3 border-b border-white/10 text-white">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-red-400">Raiding Opponent</span>
                <h4 className="font-sans font-bold text-white text-lg flex items-center gap-1.5 leading-none mt-0.5 uppercase italic text-stroke">
                  <Flame className="w-4 h-4 text-orange-500" />
                  {opponent.name}
                </h4>
              </div>
              
              {/* Destruction percent bar */}
              <div className="flex-1 mx-6 max-w-xs hidden sm:block">
                <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                  <span>Destruction:</span>
                  <span className="font-bold text-[#ffda44]">{destructionPercentage}%</span>
                </div>
                <div className="w-full h-3 bg-black rounded-full border border-white/10 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-red-500 h-full transition-all duration-300 shadow-[0_0_8px_rgba(239,68,68,0.5)]" 
                    style={{ width: `${destructionPercentage}%` }}
                  />
                </div>
              </div>

              {/* Star Rating displays */}
              <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 px-3 py-1 rounded-full shadow-inner">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Star 
                    key={idx} 
                    className={`w-4 h-4 ${idx < stars ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_6px_#f59e0b]' : 'text-slate-600'}`} 
                  />
                ))}
              </div>

              {/* Timer clock */}
              <div className="ml-4 flex flex-col items-center">
                <span className="text-[9px] uppercase font-bold text-slate-500">Timer</span>
                <span className={`font-mono font-bold text-lg leading-none mt-1 ${timerSeconds < 15 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                  {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* Arena Board Grid */}
            <div className="relative w-full aspect-square max-w-[480px] bg-gradient-to-b from-[#1a3516] to-[#244b1e] border-4 border-[#122710] rounded-xl shadow-2xl overflow-hidden grid grid-cols-16 grid-rows-16">
              
              {/* Base terrain */}
              {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
                const x = idx % GRID_SIZE;
                const y = Math.floor(idx / GRID_SIZE);
                const isAlternate = (x + y) % 2 === 0;
                
                // Draw perimeter red deployment zone
                const isPerimeter = x <= 1 || x >= GRID_SIZE - 2 || y <= 1 || y >= GRID_SIZE - 2;

                return (
                  <div
                    key={`btile-${x}-${y}`}
                    className={`w-full h-full border-[0.5px] border-green-950/5 transition-colors ${
                      isPerimeter ? 'bg-emerald-950/40 hover:bg-red-500/20' : isAlternate ? 'bg-[#15803d]/30' : 'bg-[#166534]/10'
                    }`}
                    onClick={() => handleGridDeploy(x, y)}
                  />
                );
              })}

              {/* Opponent Buildings layer */}
              {simulationBuildingsRef.current.map((b) => {
                const meta = BUILDING_METADATA[b.type];
                const isDestroyed = b.hp <= 0;
                const sizeWidth = (meta.width * 100) / GRID_SIZE;
                const sizeHeight = (meta.height * 100) / GRID_SIZE;
                const leftOffset = (b.x * 100) / GRID_SIZE;
                const topOffset = (b.y * 100) / GRID_SIZE;

                let skinColor = isDestroyed ? 'bg-zinc-800 border-zinc-950 opacity-60' : 'bg-slate-500';
                let label = isDestroyed ? '💥' : meta.name.split(' ').map(w => w[0]).join('');

                if (!isDestroyed) {
                  switch (b.type) {
                    case 'town_hall': skinColor = 'bg-gradient-to-b from-amber-600 to-amber-800 border-amber-950'; break;
                    case 'cannon': skinColor = 'bg-gradient-to-b from-slate-700 to-slate-900 border-slate-950'; break;
                    case 'archer_tower': skinColor = 'bg-gradient-to-b from-stone-400 to-stone-600 border-stone-800'; break;
                    case 'mortar': skinColor = 'bg-gradient-to-b from-zinc-800 to-zinc-900 border-zinc-950'; break;
                    case 'gold_storage': skinColor = 'bg-yellow-400 border-yellow-600'; break;
                    case 'elixir_storage': skinColor = 'bg-pink-400 border-pink-600'; break;
                    case 'wall': skinColor = 'bg-stone-700 border-stone-900'; label = ''; break;
                    default: skinColor = 'bg-slate-600 border-slate-800';
                  }
                }

                return (
                  <div
                    key={b.id}
                    className={`absolute rounded border-2 shadow-lg flex flex-col justify-center items-center text-[9px] font-bold text-slate-100 font-mono select-none transition-all ${skinColor}`}
                    style={{
                      width: `${sizeWidth}%`,
                      height: `${sizeHeight}%`,
                      left: `${leftOffset}%`,
                      top: `${topOffset}%`,
                    }}
                  >
                    {!isDestroyed && (
                      <span className="text-[7px] text-yellow-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] leading-none mb-0.5">Lvl {b.level}</span>
                    )}
                    <span className="drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.8)] leading-none">{label}</span>
                    
                    {/* HP bar */}
                    {!isDestroyed && (
                      <div className="absolute bottom-0 left-0 w-full h-[3px] bg-slate-950/60 rounded-b">
                        <div className="bg-green-500 h-full" style={{ width: `${(b.hp / b.maxHp) * 100}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Marching/Attacking Troops layer */}
              {activeTroopsRef.current.map((t) => {
                const meta = TROOP_METADATA[t.type];
                const leftOffset = (t.x * 100) / GRID_SIZE;
                const topOffset = (t.y * 100) / GRID_SIZE;

                return (
                  <motion.div
                    key={t.id}
                    className="absolute w-[10px] h-[10px] rounded-full ring-2 ring-slate-950 z-30 shadow-md flex items-center justify-center"
                    style={{
                      left: `${leftOffset}%`,
                      top: `${topOffset}%`,
                      backgroundColor: meta.color,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div className="w-[4px] h-[4px] bg-slate-950 rounded-full" />
                    
                    {/* Health indicator tiny dot */}
                    <div className="absolute -top-3 left-0 w-full flex justify-center">
                      <div className="w-4 h-[2px] bg-slate-900/60">
                        <div className="bg-emerald-400 h-full" style={{ width: `${(t.hp / t.maxHp) * 100}%` }} />
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Flying Projectiles layer */}
              {projectilesRef.current.map((p) => {
                const leftOffset = (p.x * 100) / GRID_SIZE;
                const topOffset = (p.y * 100) / GRID_SIZE;
                let color = 'bg-slate-900';
                let size = 'w-1.5 h-1.5';

                if (p.type === 'arrow') {
                  color = 'bg-pink-400 rotate-45';
                  size = 'w-1 h-2';
                } else if (p.type === 'mortar_shell') {
                  color = 'bg-orange-600 animate-pulse border border-yellow-400';
                  size = 'w-2.5 h-2.5';
                }

                return (
                  <div
                    key={p.id}
                    className={`absolute rounded-full shadow z-40 ${color} ${size}`}
                    style={{
                      left: `${leftOffset}%`,
                      top: `${topOffset}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                );
              })}

              {/* Floating Combat Text overlay */}
              {floatingTextsRef.current.map((f) => {
                const leftOffset = (f.x * 100) / GRID_SIZE;
                const topOffset = (f.y * 100) / GRID_SIZE;

                return (
                  <div
                    key={f.id}
                    className={`absolute pointer-events-none text-[8px] font-mono z-50 whitespace-nowrap text-stroke select-none ${f.color}`}
                    style={{
                      left: `${leftOffset}%`,
                      top: `${topOffset}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {f.text}
                  </div>
                );
              })}

              {/* Particles layers */}
              {particlesRef.current.map((p) => {
                const leftOffset = (p.x * 100) / GRID_SIZE;
                const topOffset = (p.y * 100) / GRID_SIZE;

                return (
                  <div
                    key={p.id}
                    className="absolute rounded-full pointer-events-none z-30"
                    style={{
                      left: `${leftOffset}%`,
                      top: `${topOffset}%`,
                      width: `${p.size}px`,
                      height: `${p.size}px`,
                      backgroundColor: p.color,
                      opacity: p.life / p.maxLife,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                );
              })}

            </div>

            {battleState === 'match' && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] rounded-lg flex flex-col items-center justify-center p-6 text-center z-10 pointer-events-none">
                <div className="bg-black/90 border border-white/10 px-6 py-4 rounded-2xl shadow-2xl max-w-sm pointer-events-auto">
                  <Play className="w-8 h-8 text-[#ffda44] animate-ping mx-auto mb-2" />
                  <h4 className="font-sans font-bold text-white text-sm uppercase italic text-stroke">Deployment Stage</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-normal font-sans">
                    Click on a trained army card below, then click any perimeter border grid grass to drop your first troop and charge the castle!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Troop Deploy Dock & Opponent Info */}
          <div className="lg:col-span-4 flex flex-col gap-6 text-white">
            
            {/* Opponent Card Story */}
            <div className="bg-black/60 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-md">
              <span className="text-[9px] uppercase font-bold tracking-wider text-[#ffda44]">Match Intel</span>
              <h4 className="font-sans font-bold text-slate-200 mt-0.5">{opponent.theme} Camp</h4>
              <p className="text-xs text-slate-300 italic font-sans leading-relaxed mt-2 p-3 bg-black/40 border border-white/5 rounded-xl">
                "{opponent.backstory}"
              </p>

              {/* Rewards */}
              <div className="grid grid-cols-2 gap-3 mt-4 text-xs font-sans font-bold">
                <div className="flex items-center gap-2 bg-[#ffda44]/10 border border-[#ffda44]/20 p-2.5 rounded-xl text-[#ffda44]">
                  <Coins className="w-4 h-4" />
                  <div>
                    <span className="block text-[8px] uppercase text-slate-400 leading-none font-bold">Max Gold</span>
                    <span className="font-mono text-xs font-black">{opponent.goldReward.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-pink-900/20 border border-pink-600/20 p-2.5 rounded-xl text-pink-300">
                  <Flame className="w-4 h-4" />
                  <div>
                    <span className="block text-[8px] uppercase text-slate-400 leading-none font-bold">Max Elixir</span>
                    <span className="font-mono text-xs font-black">{opponent.elixirReward.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Troop Deck */}
            <div className="bg-black/60 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex-1 flex flex-col justify-between">
              <div>
                <h4 className="font-sans font-bold text-white tracking-tight text-sm pb-2 border-b border-white/10 flex items-center gap-1.5 uppercase italic">
                  <Swords className="w-4 h-4 text-red-500" />
                  Select Deployable Regiments
                </h4>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  {Object.entries(currentArmy).map(([troopStr, count]) => {
                    const troop = troopStr as TroopType;
                    const meta = TROOP_METADATA[troop];
                    const isSelected = selectedDeployTroop === troop;
                    const countNum = count as number;
                    const isAvailable = countNum > 0;

                    return (
                      <button
                        key={troop}
                        disabled={!isAvailable}
                        onClick={() => setSelectedDeployTroop(troop)}
                        className={`p-2.5 rounded-xl border text-left transition-all h-[75px] relative overflow-hidden flex flex-col justify-between ${
                          !isAvailable
                            ? 'bg-black/20 border-white/5 text-slate-600 cursor-not-allowed opacity-40'
                            : isSelected
                            ? 'bg-red-500/15 border-red-500 text-white ring-2 ring-red-500 ring-offset-1 ring-offset-black'
                            : 'bg-black/40 border-white/10 hover:bg-black/60 hover:border-white/20 text-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start w-full">
                          <span className="font-bold text-xs font-sans truncate pr-1">{meta.name}</span>
                          <span className="font-mono font-bold text-xs bg-black px-1.5 py-0.5 border border-white/5 rounded text-slate-300">
                            x{count}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-sans truncate font-semibold">
                          Space: {meta.housingSpace} | Range: {meta.range}
                        </span>
                        
                        {/* Selected Indicator tag */}
                        {isSelected && (
                          <div className="absolute right-0 bottom-0 bg-red-500 text-white px-1.5 py-0.5 text-[8px] rounded-tl font-bold uppercase tracking-wider">
                            Ready
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* End Battle early */}
              <button
                onClick={onStopBattle}
                className="w-full mt-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 text-xs font-bold rounded-xl transition-all shadow-md active:translate-y-0.5"
              >
                Surrender / Retreat Army
              </button>
            </div>

          </div>

        </div>
      )}

      {/* POST-BATTLE SUMMARY SCREEN */}
      {battleState === 'summary' && opponent && (
        <div className="bg-black/60 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-md text-white max-w-2xl mx-auto flex flex-col items-center">
          <div className="p-3 bg-[#ffda44]/10 rounded-full border border-[#ffda44]/20 mb-2">
            <Award className="w-8 h-8 text-[#ffda44] animate-bounce" />
          </div>
          <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Raid Victory Breakdown</span>
          <h3 className="font-sans font-bold text-white text-2xl tracking-tight mt-1 uppercase italic text-stroke">Battle of {opponent.name}</h3>

          {/* Star animation results */}
          <div className="flex gap-4 my-6">
            {Array.from({ length: 3 }).map((_, idx) => (
              <motion.div
                key={idx}
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: idx < stars ? 1.2 : 0.9, rotate: 0 }}
                transition={{ delay: idx * 0.2, type: 'spring' }}
              >
                <Star 
                  className={`w-14 h-14 ${
                    idx < stars 
                      ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]' 
                      : 'text-slate-800'
                  }`} 
                />
              </motion.div>
            ))}
          </div>

          <p className="text-sm font-sans font-bold text-slate-200 mb-6">
            Overall Destruction Percentage: <span className="text-yellow-400 text-lg font-mono font-black">{destructionPercentage}%</span>
          </p>

          {/* Rewards loot card */}
          <div className="w-full grid grid-cols-3 gap-3 mb-6 font-bold">
            <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex flex-col items-center">
              <Coins className="text-yellow-400 w-5 h-5 mb-1" />
              <span className="text-[9px] uppercase text-slate-400 leading-none">Gold Looted</span>
              <span className="font-mono font-black text-yellow-400 text-base mt-1">+{lootEarned.gold.toLocaleString()}</span>
            </div>

            <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex flex-col items-center">
              <Flame className="text-pink-400 w-5 h-5 mb-1" />
              <span className="text-[9px] uppercase text-slate-400 leading-none">Elixir Looted</span>
              <span className="font-mono font-black text-pink-400 text-base mt-1">+{lootEarned.elixir.toLocaleString()}</span>
            </div>

            <div className="bg-black/40 p-4 rounded-xl border border-white/5 flex flex-col items-center">
              <Trophy className="text-purple-400 w-5 h-5 mb-1 animate-pulse" />
              <span className="text-[9px] uppercase text-slate-400 leading-none">Trophies</span>
              <span className="font-mono font-black text-purple-400 text-base mt-1">
                {stars > 0 ? `+${opponent.difficulty === 'legendary' ? 30 : 12}` : '-10'}
              </span>
            </div>
          </div>

          {/* AI Coach Speak bubble */}
          <div className="w-full bg-black/40 border border-white/10 p-4 rounded-2xl mb-6 relative">
            <div className="flex items-center gap-2 mb-2 pb-1 border-b border-white/10">
              <div className="w-6 h-6 rounded-full bg-indigo-900/80 border border-indigo-400/30 flex items-center justify-center font-mono text-[9px] text-indigo-200 font-bold">M</div>
              <span className="font-sans font-bold text-xs text-indigo-300">Elder Coach Magnus</span>
              {isCommentaryLoading && <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin ml-auto" />}
            </div>

            {isCommentaryLoading ? (
              <p className="text-xs text-slate-500 italic font-sans py-3 text-center">Magnus is writing down combat feedback review with Gemini...</p>
            ) : (
              <p className="text-xs text-yellow-100/90 leading-relaxed font-sans italic">
                "{aiCommentary}"
              </p>
            )}
          </div>

          <button
            onClick={() => {
              setBattleState('idle');
              setOpponent(null);
              setDestructionPercentage(0);
              setStars(0);
            }}
            className="w-full py-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold rounded-xl transition-all shadow-md text-center text-sm active:translate-y-0.5"
          >
            Carry Loot Back To Village
          </button>
        </div>
      )}

    </div>
  );
}
