/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { ClanMessage } from '../types';
import { Send, MessageSquare, Shield, User, Clock, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface ClanChatProps {
  onLogMessage: (text: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

const INITIAL_MESSAGES: ClanMessage[] = [
  {
    id: 'msg-1',
    sender: 'ArcherQueen99',
    role: 'Leader',
    avatar: '👑',
    message: 'Greetings, warriors! Who keeps donating level 1 Wall Breakers? I requested Giants for my hybrid attack!',
    time: '2 hours ago',
  },
  {
    id: 'msg-2',
    sender: 'BarbarianBob',
    role: 'Member',
    avatar: '🪓',
    message: 'Haha, sorry Queen! I tapped the wrong training tube. Hey, did anyone see the new layout Elder Magnus evaluated? It got a solid B rating!',
    time: '1 hour ago',
  },
  {
    id: 'msg-3',
    sender: 'GrandWarden',
    role: 'Co-Leader',
    avatar: '🧙‍♂️',
    message: 'Yes! I noticed the mortar placement was extremely sound. Remember to keep those mortar splash defenses guarded with a double layer of walls so giants can\'t skip them.',
    time: '45 mins ago',
  },
];

export default function ClanChat({ onLogMessage }: ClanChatProps) {
  const [messages, setMessages] = useState<ClanMessage[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isElderResponding, setIsElderResponding] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat list to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg: ClanMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'You (Chief)',
      role: 'Co-Leader',
      avatar: '🛡️',
      message: inputText.trim(),
      time: 'Just now',
    };

    setMessages(prev => [...prev, userMsg]);
    const messageToSend = inputText.trim();
    setInputText('');

    // Trigger AI Elder reply
    setIsElderResponding(true);
    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          history: messages.concat(userMsg),
        }),
      });
      const data = await response.json();

      const elderMsg: ClanMessage = {
        id: `msg-elder-${Date.now()}`,
        sender: 'Elder Magnus',
        role: 'Elder',
        avatar: '🧙',
        message: data.reply,
        time: 'Just now',
      };

      setMessages(prev => [...prev, elderMsg]);
    } catch (err) {
      console.error(err);
      onLogMessage('Failed to communicate with Elder Magnus. Check server connection.', 'error');
    } finally {
      setIsElderResponding(false);
    }
  };

  return (
    <div className="bg-black/60 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md p-5 text-white flex flex-col h-[500px]" id="clan_chat_root">
      
      {/* Chat header */}
      <div className="flex items-center gap-2 pb-3 border-b border-white/10 mb-4">
        <MessageSquare className="text-red-500 w-5 h-5 animate-pulse" />
        <div>
          <h3 className="font-sans font-bold text-white tracking-tight text-base leading-none uppercase italic text-stroke">Clan Castle Chat</h3>
          <span className="text-[10px] text-slate-400 font-sans mt-1 block">Active Alliance Channel: Ask Magnus (Elder) for battle tips!</span>
        </div>
      </div>

      {/* Message logs list */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-4 mb-4 font-sans text-xs">
        {messages.map((msg) => {
          const isUser = msg.sender.includes('You');
          const isElder = msg.sender.includes('Magnus');

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar circle */}
              <div className="w-8 h-8 rounded-full bg-black/80 border border-white/10 flex items-center justify-center text-sm shadow-md flex-shrink-0">
                {msg.avatar}
              </div>

              {/* Message box */}
              <div className="flex flex-col max-w-[75%]">
                <div className={`flex items-center gap-1.5 mb-1 ${isUser ? 'justify-end' : ''}`}>
                  <span className={`font-bold text-[11px] uppercase tracking-wide text-stroke ${isUser ? 'text-[#ffda44]' : isElder ? 'text-[#5ce1e6]' : 'text-slate-200'}`}>
                    {msg.sender}
                  </span>
                  
                  {/* Badge role */}
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-sans font-bold uppercase ${
                    msg.role === 'Leader' 
                      ? 'bg-red-950/40 text-red-300 border border-red-800/40' 
                      : msg.role === 'Elder'
                      ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-800/40'
                      : 'bg-white/5 text-slate-400 border border-white/5'
                  }`}>
                    {msg.role}
                  </span>

                  <span className="text-[8px] text-slate-500 font-mono">{msg.time}</span>
                </div>

                <div className={`p-3 rounded-2xl leading-relaxed text-slate-200 shadow-sm border ${
                  isUser 
                    ? 'bg-red-500/10 border-red-500/20 rounded-tr-none text-white' 
                    : isElder
                    ? 'bg-indigo-500/10 border-indigo-500/20 rounded-tl-none font-serif italic'
                    : 'bg-black/40 border-white/5 rounded-tl-none'
                }`}>
                  {msg.message}
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Typing indicator */}
        {isElderResponding && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-black/80 border border-white/10 flex items-center justify-center text-sm flex-shrink-0 animate-pulse">🧙</div>
            <div className="flex flex-col">
              <span className="font-bold text-[11px] text-indigo-300 mb-1">Elder Magnus is typing...</span>
              <div className="bg-indigo-950/10 border border-indigo-900/20 p-2 rounded-xl flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                <span className="text-[10px] text-slate-500 font-sans italic">Consulting military scrolls...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Input Submit form */}
      <form onSubmit={handleSendMessage} className="flex gap-2 pt-3 border-t border-white/10">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask Magnus for advice (e.g. 'How do I protect my base?')..."
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs font-sans text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isElderResponding}
          className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:from-zinc-900 disabled:to-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 disabled:cursor-not-allowed font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 flex-shrink-0 text-xs text-white border border-transparent"
        >
          <Send className="w-3.5 h-3.5" />
          Send
        </button>
      </form>

    </div>
  );
}
