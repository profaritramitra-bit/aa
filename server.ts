/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize the Google Gen AI client with User-Agent for telemetry
let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
} catch (e) {
  console.error('Failed to initialize GoogleGenAI client:', e);
}

// ---------------------------------------------------------
// Helper: Fallback base generators if Gemini is unconfigured or fails
// ---------------------------------------------------------
function getFallbackOpponent(difficulty: string): any {
  const randomId = () => Math.random().toString(36).substring(2, 7);
  
  if (difficulty === 'easy') {
    return {
      id: `fallback-${randomId()}`,
      name: 'Goblin Hideout',
      theme: 'Overgrown Woodlands',
      backstory: 'A quick, simple forest clearing where local goblins have cached basic loot. Beware of their single rusty cannon!',
      difficulty: 'easy',
      townHallLevel: 1,
      goldReward: 2000,
      elixirReward: 2000,
      buildings: [
        { id: 'f_th', type: 'town_hall', x: 7, y: 7, level: 1, hp: 1500, maxHp: 1500 },
        { id: 'f_gs', type: 'gold_storage', x: 5, y: 7, level: 1, hp: 800, maxHp: 800 },
        { id: 'f_es', type: 'elixir_storage', x: 9, y: 7, level: 1, hp: 800, maxHp: 800 },
        { id: 'f_c1', type: 'cannon', x: 7, y: 5, level: 1, hp: 450, maxHp: 450 },
        { id: 'f_w1', type: 'wall', x: 6, y: 6, level: 1, hp: 1000, maxHp: 1000 },
        { id: 'f_w2', type: 'wall', x: 7, y: 6, level: 1, hp: 1000, maxHp: 1000 },
        { id: 'f_w3', type: 'wall', x: 8, y: 6, level: 1, hp: 1000, maxHp: 1000 },
        { id: 'f_w4', type: 'wall', x: 6, y: 8, level: 1, hp: 1000, maxHp: 1000 },
        { id: 'f_w5', type: 'wall', x: 8, y: 8, level: 1, hp: 1000, maxHp: 1000 },
      ]
    };
  } else if (difficulty === 'medium') {
    return {
      id: `fallback-${randomId()}`,
      name: 'Twin Spires Outpost',
      theme: 'Desert Slabs',
      backstory: 'An organized desert layout guarded by dual archer towers and a core mortar. Clear pathing is required to avoid mortar splash!',
      difficulty: 'medium',
      townHallLevel: 2,
      goldReward: 8000,
      elixirReward: 8000,
      buildings: [
        { id: 'f_th', type: 'town_hall', x: 7, y: 7, level: 2, hp: 2000, maxHp: 2000 },
        { id: 'f_gs', type: 'gold_storage', x: 5, y: 7, level: 2, hp: 1200, maxHp: 1200 },
        { id: 'f_es', type: 'elixir_storage', x: 9, y: 7, level: 2, hp: 1200, maxHp: 1200 },
        { id: 'f_at1', type: 'archer_tower', x: 4, y: 4, level: 2, hp: 520, maxHp: 520 },
        { id: 'f_at2', type: 'archer_tower', x: 10, y: 10, level: 2, hp: 520, maxHp: 520 },
        { id: 'f_m1', type: 'mortar', x: 7, y: 9, level: 1, hp: 400, maxHp: 400 },
        // Simple ring of walls
        ...[5,6,7,8,9].map((gridX, i) => ({ id: `f_w_${i}`, type: 'wall' as const, x: gridX, y: 5, level: 2, hp: 1800, maxHp: 1800 })),
        ...[5,6,7,8,9].map((gridX, i) => ({ id: `f_w_b_${i}`, type: 'wall' as const, x: gridX, y: 9, level: 2, hp: 1800, maxHp: 1800 })),
      ]
    };
  } else {
    // Hard / Legendary fallback
    return {
      id: `fallback-${randomId()}`,
      name: 'Magma Citadel',
      theme: 'Volcanic Caldera',
      backstory: 'A fortified volcano outpost protected by heavy defensive rings. High threat mortars and multiple cannons protect the premium reserves!',
      difficulty: 'hard',
      townHallLevel: 4,
      goldReward: 25000,
      elixirReward: 25000,
      buildings: [
        { id: 'f_th', type: 'town_hall', x: 7, y: 7, level: 4, hp: 3800, maxHp: 3800 },
        { id: 'f_gs', type: 'gold_storage', x: 5, y: 5, level: 3, hp: 1800, maxHp: 1800 },
        { id: 'f_es', type: 'elixir_storage', x: 9, y: 9, level: 3, hp: 1800, maxHp: 1800 },
        { id: 'f_m1', type: 'mortar', x: 7, y: 4, level: 3, hp: 630, maxHp: 630 },
        { id: 'f_c1', type: 'cannon', x: 4, y: 8, level: 3, hp: 750, maxHp: 750 },
        { id: 'f_c2', type: 'cannon', x: 10, y: 6, level: 3, hp: 750, maxHp: 750 },
        { id: 'f_at1', type: 'archer_tower', x: 3, y: 3, level: 3, hp: 680, maxHp: 680 },
        { id: 'f_at2', type: 'archer_tower', x: 11, y: 11, level: 3, hp: 680, maxHp: 680 },
        // Protective walls
        ...Array.from({ length: 9 }).map((_, i) => ({ id: `f_wh_${i}`, type: 'wall' as const, x: i + 3, y: 2, level: 3, hp: 3000, maxHp: 3000 })),
        ...Array.from({ length: 9 }).map((_, i) => ({ id: `f_wb_${i}`, type: 'wall' as const, x: i + 3, y: 12, level: 3, hp: 3000, maxHp: 3000 })),
        ...Array.from({ length: 9 }).map((_, i) => ({ id: `f_wl_${i}`, type: 'wall' as const, x: 2, y: i + 3, level: 3, hp: 3000, maxHp: 3000 })),
        ...Array.from({ length: 9 }).map((_, i) => ({ id: `f_wr_${i}`, type: 'wall' as const, x: 12, y: i + 3, level: 3, hp: 3000, maxHp: 3000 })),
      ]
    };
  }
}

// ---------------------------------------------------------
// API Endpoint 1: Base Layout Audit
// ---------------------------------------------------------
app.post('/api/gemini/audit-base', async (req, res) => {
  const { baseLayout } = req.body;

  if (!baseLayout || !Array.isArray(baseLayout)) {
    return res.status(400).json({ error: 'Missing or invalid baseLayout array' });
  }

  // Summary statistics to guide the model contextually
  const th = baseLayout.find(b => b.type === 'town_hall');
  const thLevel = th ? th.level : 1;
  const numWalls = baseLayout.filter(b => b.type === 'wall').length;
  const numDefenses = baseLayout.filter(b => ['cannon', 'archer_tower', 'mortar'].includes(b.type)).length;
  const numStorages = baseLayout.filter(b => ['gold_storage', 'elixir_storage'].includes(b.type)).length;

  if (!ai) {
    // Mock review response if AI is not configured
    return res.json({
      rating: thLevel < 2 ? 'C+' : 'B',
      strengths: [
        'Centralized Town Hall layout providing standard shield boundaries.',
        `Utilizes ${numWalls} defensive walls to route or contain ground troops.`
      ],
      weaknesses: [
        numDefenses < 3 ? 'Inadequate defensive coverage. Build more Cannons or Archer Towers.' : 'Defenses are placed near the margins and might get picked off.',
        numStorages === 0 ? 'No secure vaults detected. Resources are exposed to Goblins.' : 'Storages are clustered, making them vulnerable to splash spells.'
      ],
      strategicAdvice: 'Try to place your splash defenses (like Mortars) deep inside the core near the Town Hall, then surround them with walls. Place high-capacity Storages within range of Archer Towers so marching Goblins can be handled before clearing out your banks!'
    });
  }

  try {
    const prompt = `
      You are the Master Builder and Clan Elder Magnus of Clash of Clans. 
      Analyze the following player base layout and grade its defensive capability (A+, A, B, C, D, or F).
      
      Village Summary Context:
      - Town Hall Level: ${thLevel} (Coordinates: X=${th?.x ?? 'unknown'}, Y=${th?.y ?? 'unknown'})
      - Wall count: ${numWalls}
      - Defense structures (Cannon, Archer Tower, Mortar): ${numDefenses}
      - Storages (Gold/Elixir Storage): ${numStorages}
      
      Full Layout Grid Array (JSON representation):
      ${JSON.stringify(baseLayout)}
      
      Look for classic Clash of Clans tactical mistakes:
      1. Placing the Town Hall completely undefended at the edge.
      2. Grouping all defenses in one spot where splash damage or distraction easily disables them.
      3. Leaving open holes/gaps in the walls.
      4. Leaving Gold/Elixir storages completely exposed outside.
      5. Poor mortar placement (too close to margins; remember mortars have dead zones!).
      
      Provide a highly precise strategic review. Be encouraging but tactically critical like a veteran Clan Chief.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are a veteran Clan Coach. You must return your analysis strictly as a single JSON object corresponding to the provided schema. Do not include markdown wraps or preambles, just raw JSON.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rating: { type: Type.STRING, description: 'The overall defense letter grade (e.g. A+, B, C, F)' },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of 2 to 3 notable layout strengths'
            },
            weaknesses: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of 2 to 3 notable weaknesses or defensive gaps'
            },
            strategicAdvice: { type: Type.STRING, description: 'Warm, encouraging, and detailed feedback with tips on improvement.' }
          },
          required: ['rating', 'strengths', 'weaknesses', 'strategicAdvice']
        }
      }
    });

    const cleanText = response.text?.trim() || '{}';
    const result = JSON.parse(cleanText);
    res.json(result);
  } catch (error: any) {
    console.error('Gemini Base Audit Error:', error);
    res.status(500).json({ error: 'Failed to perform AI audit', details: error.message });
  }
});

// ---------------------------------------------------------
// API Endpoint 2: Generate Procedural Opponent Village
// ---------------------------------------------------------
app.post('/api/gemini/generate-base', async (req, res) => {
  const { difficulty } = req.body;
  const validDifficulties = ['easy', 'medium', 'hard', 'legendary'];
  const diff = validDifficulties.includes(difficulty) ? difficulty : 'medium';

  if (!ai) {
    // Return high quality fallback opponent
    return res.json(getFallbackOpponent(diff));
  }

  try {
    const prompt = `
      Create a fully functional Clash of Clans layout grid of size 16x16 (X from 0 to 15, Y from 0 to 15).
      The difficulty tier requested is: "${diff}".
      
      Generate a customized opponent with:
      - A cool clan theme (e.g., Ice Peak, Poison Swamp, Lava Gorge)
      - A witty goblin or rebel leader name
      - A funny story of what they did with the stolen loot
      - Loot rewards:
        - "easy" -> 1,000 to 4,000 gold/elixir
        - "medium" -> 5,000 to 12,000 gold/elixir
        - "hard" -> 15,000 to 35,000 gold/elixir
        - "legendary" -> 40,000 to 100,000 gold/elixir
      - A list of buildings of type: 'town_hall', 'gold_storage', 'elixir_storage', 'cannon', 'archer_tower', 'mortar', 'wall', 'barracks'.
      
      IMPORTANT Placement Rules:
      1. All coordinates x and y MUST be integers between 1 and 14.
      2. Do NOT overlap structures on the same (x,y) tile.
      3. Town Hall is size 2x2. Make sure it has enough room, e.g. place at center (7,7) or (8,8) or similar.
      4. Defensive layout:
         - "easy" should have 1 Cannon and 1 Archer Tower, Town Hall level 1, around 4 to 8 walls.
         - "medium" should have 2 Cannons, 1 Archer Tower, 1 Mortar, Town Hall level 2, around 10 to 15 walls.
         - "hard" should have 3 Cannons, 2 Archer Towers, 1 Mortar, Town Hall level 3 or 4, around 20 to 30 walls protecting assets.
         - "legendary" should have 4 Cannons, 3 Archer Towers, 2 Mortars, Town Hall level 5, and 40+ walls.
      5. Do NOT place defenses outside the 16x16 map boundaries.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are a master tactical village designer. You generate challenging, creative, and valid game maps. Ensure all buildings have unique IDs, and that their hp is set appropriately (HP range: Walls: 1000-3000, Cannon: 450-900, Town Hall: 1500-5000, Storages: 800-2000). Return ONLY the JSON object conforming strictly to the schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            theme: { type: Type.STRING },
            backstory: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            townHallLevel: { type: Type.INTEGER },
            goldReward: { type: Type.INTEGER },
            elixirReward: { type: Type.INTEGER },
            buildings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: {
                    type: Type.STRING,
                    description: 'One of town_hall, gold_storage, elixir_storage, cannon, archer_tower, mortar, wall, barracks'
                  },
                  x: { type: Type.INTEGER, description: 'integer from 0 to 15' },
                  y: { type: Type.INTEGER, description: 'integer from 0 to 15' },
                  level: { type: Type.INTEGER },
                  hp: { type: Type.INTEGER },
                  maxHp: { type: Type.INTEGER }
                },
                required: ['id', 'type', 'x', 'y', 'level', 'hp', 'maxHp']
              }
            }
          },
          required: ['id', 'name', 'theme', 'backstory', 'difficulty', 'townHallLevel', 'goldReward', 'elixirReward', 'buildings']
        }
      }
    });

    const cleanText = response.text?.trim() || '{}';
    const result = JSON.parse(cleanText);
    res.json(result);
  } catch (error: any) {
    console.error('Gemini Generate Base Error:', error);
    // Return high quality fallback instead of failing
    res.json(getFallbackOpponent(diff));
  }
});

// ---------------------------------------------------------
// API Endpoint 3: Post-Battle AI Commentary
// ---------------------------------------------------------
app.post('/api/gemini/battle-commentary', async (req, res) => {
  const { finalScore, finalStars, troopsDeployed, duration, opponentName } = req.body;

  if (!ai) {
    // Friendly local advice
    let starsMessage = "That was an okay battle.";
    if (finalStars === 3) {
      starsMessage = `A glorious three-star Victory! You wiped ${opponentName} off the map!`;
    } else if (finalStars >= 1) {
      starsMessage = `Good try! You claimed ${finalStars} star and walked away with valuable loot.`;
    } else {
      starsMessage = "A crushing defeat! We must rebuild and train more heavy troops.";
    }
    return res.json({
      commentary: `${starsMessage} You deployed your units and achieved ${finalScore}% destruction in ${duration} seconds. Consider training more Giants to tank tower fire, or wizards for higher back-line damage!`
    });
  }

  try {
    const prompt = `
      You are the Clan Elder Magnus, reviewing the battle logs of our chief's recent attack.
      
      Raid Report Details:
      - Opponent Village: ${opponentName}
      - Destruction Score: ${finalScore}%
      - Stars Earned: ${finalStars} / 3
      - Time Elapsed: ${duration} seconds
      - Troops Deployed: ${JSON.stringify(troopsDeployed)}
      
      Provide a personalized, humorous, and tactically sound evaluation of their performance.
      - If they got 3 stars: Praise their tactical genius, compare them to legendary conquerors, and celebrate the loot.
      - If they got 1 or 2 stars: Give specific advice (e.g. if they had no Giants, mention they needed tanks; if they used all archers, mention they got wiped by splash mortars; if they ran out of time, mention speed).
      - If they got 0 stars: Roast them lightly but remain constructive and supportive. Encourage them to train a balanced army!
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are the Clan Elder Magnus, a burly, wise viking with a bushy grey beard, a booming voice, and a deep love for sound tactics and cold Elixir. Provide a single paragraph of text representing your direct commentary to the Chief.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            commentary: { type: Type.STRING, description: 'Speeches and advice directly from Magnus' }
          },
          required: ['commentary']
        }
      }
    });

    const cleanText = response.text?.trim() || '{}';
    const result = JSON.parse(cleanText);
    res.json(result);
  } catch (error: any) {
    console.error('Gemini Commentary Error:', error);
    res.json({
      commentary: "A brave charge, Chief! Your tactics was noteworthy, but the battlefield was chaotic. Let's restock the barracks, upgrade our defense grid, and strike when the elixir is warm!"
    });
  }
});

// ---------------------------------------------------------
// API Endpoint 4: AI Clan Chat Advisor
// ---------------------------------------------------------
app.post('/api/gemini/chat', async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Missing message parameter' });
  }

  if (!ai) {
    return res.json({
      reply: "Listen here, Chief! The ancient skies tell of great things, but my crystal ball is offline. Let's upgrade our defenses and recruit more archers!"
    });
  }

  try {
    const formattedHistory = Array.isArray(history) 
      ? history.slice(-6).map((h: any) => `${h.sender} (${h.role}): ${h.message}`).join('\n')
      : '';

    const prompt = `
      You are the Clan Elder Magnus, the wise, burly veteran advisor in a Clash of Clans simulator.
      The Chief (player) has sent you a message: "${message}"

      Recent Chat Log History for Context:
      ${formattedHistory}

      Provide a helpful, encouraging, and witty response as Magnus. You speak with heavy Norse/Viking themes (e.g., "By Odin's beard", "Pour the dark Elixir", "Strap on your shield").
      - Give real Clash of Clans tactical advice if they ask about building, attacking, troops, or base layouts.
      - Keep your answer within 2 to 3 sentences so it looks like a chat message.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are the Clan Elder Magnus. Speak directly, in character, with warmth and humor. Return ONLY a single JSON object corresponding to the schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING, description: 'Magnus\'s direct, witty chat reply' }
          },
          required: ['reply']
        }
      }
    });

    const cleanText = response.text?.trim() || '{}';
    const result = JSON.parse(cleanText);
    res.json(result);
  } catch (error: any) {
    console.error('Gemini Chat Error:', error);
    res.json({
      reply: "By the stars, Chief! My voice is raspy from shouting at local wall-breakers. Keep building, training, and testing your metal!"
    });
  }
});

// ---------------------------------------------------------
// Vite Integration and Static Asset Serving
// ---------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
