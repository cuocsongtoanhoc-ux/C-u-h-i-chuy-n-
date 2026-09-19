import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  Sparkles, 
  Target, 
  Trophy, 
  Compass, 
  Volume2, 
  Zap, 
  Rocket, 
  Smile
} from 'lucide-react';
import { 
  playCartoonBoing, 
  playCartoonWhistle, 
  playBubblePop, 
  playUfoLaser, 
  playWinnerFanfare, 
  playTick 
} from '../../utils/soundFx';

interface FlyingAvatarsProps {
  targetName: string;
  onComplete: () => void;
}

interface AvatarParticle {
  id: number;
  label: string;
  emoji: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vRot: number;
  scale: number;
  isWinner?: boolean;
}

const AVATAR_CHARACTERS = [
  { emoji: '🚀', bg: 'from-sky-400 to-blue-600', border: 'border-sky-300', text: 'text-white' },
  { emoji: '🛸', bg: 'from-purple-500 to-indigo-700', border: 'border-purple-300', text: 'text-white' },
  { emoji: '🦸', bg: 'from-red-500 to-rose-700', border: 'border-rose-300', text: 'text-white' },
  { emoji: '🐱', bg: 'from-amber-400 to-orange-600', border: 'border-amber-200', text: 'text-white' },
  { emoji: '🐶', bg: 'from-emerald-400 to-teal-600', border: 'border-teal-200', text: 'text-white' },
  { emoji: '🌟', bg: 'from-yellow-300 to-amber-500', border: 'border-yellow-100', text: 'text-amber-950' },
  { emoji: '🎈', bg: 'from-pink-400 to-rose-500', border: 'border-pink-200', text: 'text-white' },
  { emoji: '🤖', bg: 'from-cyan-400 to-blue-500', border: 'border-cyan-200', text: 'text-white' },
  { emoji: '🦉', bg: 'from-indigo-400 to-violet-600', border: 'border-indigo-200', text: 'text-white' },
  { emoji: '🦊', bg: 'from-orange-400 to-red-500', border: 'border-orange-200', text: 'text-white' },
  { emoji: '🦄', bg: 'from-fuchsia-400 to-pink-600', border: 'border-fuchsia-200', text: 'text-white' },
  { emoji: '🐼', bg: 'from-slate-700 to-slate-900', border: 'border-slate-400', text: 'text-white' },
];

export default function FlyingAvatars({ targetName, onComplete }: FlyingAvatarsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'FLYING' | 'CATCHING' | 'CELEBRATING'>('FLYING');
  const [winner, setWinner] = useState<AvatarParticle | null>(null);
  const [windSpeed, setWindSpeed] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Initialize Avatar particles
  const particlesRef = useRef<AvatarParticle[]>([]);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    // Generate 18-24 avatars floating
    const count = 20;
    const initialParticles: AvatarParticle[] = [];

    for (let i = 0; i < count; i++) {
      const char = AVATAR_CHARACTERS[i % AVATAR_CHARACTERS.length];
      const isTheWinner = i === 0;

      initialParticles.push({
        id: i,
        label: isTheWinner ? targetName : `VTS #${i + 1}`,
        emoji: isTheWinner ? '👑' : char.emoji,
        bgColor: isTheWinner ? 'from-amber-400 via-yellow-400 to-orange-500' : char.bg,
        borderColor: isTheWinner ? 'border-yellow-200' : char.border,
        textColor: char.text,
        x: 10 + Math.random() * 80, // %
        y: 15 + Math.random() * 70, // %
        vx: (Math.random() - 0.5) * 0.7 * (Math.random() > 0.5 ? 1 : -1),
        vy: (Math.random() - 0.5) * 0.7 * (Math.random() > 0.5 ? 1 : -1),
        size: isTheWinner ? 78 : 64 + Math.floor(Math.random() * 16),
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 2.5,
        scale: 1,
        isWinner: isTheWinner
      });
    }

    particlesRef.current = initialParticles;
    playCartoonWhistle();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [targetName]);

  // Physics animation loop
  const [, setTick] = useState(0);

  useEffect(() => {
    let lastBounceSound = 0;

    const animate = (time: number) => {
      if (phase === 'FLYING' || phase === 'CATCHING') {
        const particles = particlesRef.current;
        const speedMultiplier = phase === 'CATCHING' ? 2.5 : windSpeed;

        particles.forEach((p) => {
          if (phase === 'CATCHING' && p.isWinner) {
            // Gravitate towards center (50%, 50%)
            const dx = 50 - p.x;
            const dy = 50 - p.y;
            p.x += dx * 0.08;
            p.y += dy * 0.08;
            p.rotation += 12;
            p.scale = 1.35;
          } else {
            p.x += p.vx * speedMultiplier;
            p.y += p.vy * speedMultiplier;
            p.rotation += p.vRot;

            // Bounce off edges with hilarious boing sounds
            let bounced = false;
            if (p.x <= 5) {
              p.x = 5;
              p.vx = Math.abs(p.vx);
              bounced = true;
            } else if (p.x >= 92) {
              p.x = 92;
              p.vx = -Math.abs(p.vx);
              bounced = true;
            }

            if (p.y <= 6) {
              p.y = 6;
              p.vy = Math.abs(p.vy);
              bounced = true;
            } else if (p.y >= 88) {
              p.y = 88;
              p.vy = -Math.abs(p.vy);
              bounced = true;
            }

            if (bounced && soundEnabled && time - lastBounceSound > 220) {
              lastBounceSound = time;
              if (Math.random() > 0.4) {
                playCartoonBoing(300 + Math.random() * 200);
              } else {
                playBubblePop(700 + Math.random() * 400);
              }
            }
          }
        });

        setTick((prev) => (prev + 1) % 1000);
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [phase, windSpeed, soundEnabled]);

  // Catch the Lucky Avatar action
  const handleCatchAvatar = () => {
    if (phase !== 'FLYING') return;

    setPhase('CATCHING');
    playUfoLaser();

    // Sudden zoom and dramatic spotlight
    setTimeout(() => {
      const winnerParticle = particlesRef.current.find((p) => p.isWinner) || particlesRef.current[0];
      setWinner(winnerParticle);
      setPhase('CELEBRATING');

      // Play victory sounds
      playCartoonBoing(440);
      playWinnerFanfare();

      // Confetti fireworks
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.6 }
      });
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 80,
          origin: { x: 0.1, y: 0.7 }
        });
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 80,
          origin: { x: 0.9, y: 0.7 }
        });
      }, 400);

      // Transition to questions after celebration
      setTimeout(() => {
        onComplete();
      }, 3600);
    }, 1800);
  };

  // Fun helper: Boost wind speed
  const handleBoostWind = () => {
    setWindSpeed((prev) => (prev >= 2.2 ? 0.8 : prev + 0.6));
    playUfoLaser();
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[520px] sm:h-[600px] rounded-[3rem] overflow-hidden bg-gradient-to-b from-indigo-950 via-slate-900 to-sky-950 border-4 border-sky-400/40 shadow-2xl flex flex-col justify-between p-4 select-none"
    >
      {/* Background Starfield & Floating Nebulas */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute top-10 left-12 w-72 h-72 rounded-full bg-sky-500/20 blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-12 w-80 h-80 rounded-full bg-fuchsia-500/20 blur-3xl animate-pulse delay-700" />
      </div>

      {/* Header Bar */}
      <div className="relative z-20 flex items-center justify-between px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl animate-bounce">🛸</span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-white tracking-wide flex items-center gap-1.5">
              BIỆT ĐỘI AVATAR BAY LƯỢN
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black uppercase">
                Game Mới
              </span>
            </h3>
            <p className="text-[11px] text-sky-200 hidden sm:block">
              Các Avatar học sinh đang bay lượn tự do với hiệu ứng âm thanh vui nhộn!
            </p>
          </div>
        </div>

        {/* Quick controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleBoostWind}
            disabled={phase !== 'FLYING'}
            className="px-3 py-1.5 rounded-xl bg-sky-500/30 hover:bg-sky-500/50 text-sky-100 text-xs font-bold border border-sky-400/40 flex items-center gap-1 transition active:scale-95 disabled:opacity-50"
            title="Tăng giảm tốc độ gió bay lượn"
          >
            <Zap size={14} className="text-amber-300" />
            <span className="hidden sm:inline">Gió:</span> {windSpeed.toFixed(1)}x
          </button>

          <button
            onClick={() => {
              playBubblePop();
              setSoundEnabled(!soundEnabled);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1 transition active:scale-95 ${
              soundEnabled
                ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400/40'
                : 'bg-rose-500/30 text-rose-200 border-rose-400/40'
            }`}
          >
            <Volume2 size={14} />
            <span className="hidden sm:inline">{soundEnabled ? 'Bật âm' : 'Tắt âm'}</span>
          </button>
        </div>
      </div>

      {/* Dynamic Flying Arena */}
      <div className="relative flex-1 w-full overflow-hidden">
        {/* Floating Avatars */}
        {particlesRef.current.map((p) => {
          const isWinnerCelebrating = phase === 'CELEBRATING' && p.isWinner;

          if (isWinnerCelebrating) return null; // Rendered in spotlight modal

          return (
            <motion.div
              key={p.id}
              className={`absolute cursor-pointer transition-transform ${
                phase === 'CATCHING' && p.isWinner ? 'z-30 ring-4 ring-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.9)]' : 'z-10'
              }`}
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${p.scale})`,
              }}
              onClick={() => {
                if (phase === 'FLYING') {
                  playCartoonBoing();
                  p.vx = -p.vx * 1.4;
                  p.vy = -p.vy * 1.4;
                }
              }}
              whileHover={{ scale: 1.25 }}
            >
              <div
                className={`flex flex-col items-center justify-center rounded-full bg-gradient-to-tr ${p.bgColor} border-2 ${p.borderColor} shadow-lg p-2 transition-all`}
                style={{ width: `${p.size}px`, height: `${p.size}px` }}
              >
                <span className="text-2xl sm:text-3xl select-none filter drop-shadow-md">
                  {p.emoji}
                </span>
                <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-tight truncate max-w-[60px] ${p.textColor}`}>
                  {p.isWinner ? 'MAY MẮN' : p.label}
                </span>
              </div>
            </motion.div>
          );
        })}

        {/* Catching Tractor Beam Spotlight Effect */}
        {phase === 'CATCHING' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <div className="w-80 h-80 rounded-full border-4 border-dashed border-amber-300 animate-spin bg-amber-400/10 flex items-center justify-center backdrop-blur-xs">
              <div className="w-56 h-56 rounded-full border-4 border-amber-400/80 animate-ping" />
              <Target size={64} className="text-amber-300 absolute animate-pulse" />
            </div>
          </motion.div>
        )}

        {/* Winner Celebration Modal Overlay */}
        <AnimatePresence>
          {phase === 'CELEBRATING' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md"
            >
              <div className="relative bg-gradient-to-b from-amber-500 via-orange-500 to-amber-600 rounded-[2.5rem] p-8 sm:p-10 border-4 border-yellow-200 shadow-[0_0_80px_rgba(245,158,11,0.8)] text-center max-w-lg w-full flex flex-col items-center">
                {/* Floating Crown Mascot */}
                <motion.div
                  animate={{ y: [0, -12, 0], rotate: [0, 5, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white shadow-2xl flex items-center justify-center text-5xl sm:text-6xl border-4 border-yellow-300 mb-4"
                >
                  👑
                </motion.div>

                <span className="px-4 py-1.5 rounded-full bg-white/30 text-white font-black text-xs sm:text-sm uppercase tracking-widest mb-3 border border-white/40">
                  🎉 AVATAR CHIẾN THẮNG 🎉
                </span>

                <h2 className="text-2xl sm:text-4xl font-black text-white drop-shadow-md mb-2">
                  {targetName}
                </h2>

                <p className="text-amber-100 text-xs sm:text-sm font-semibold mb-6">
                  Đã bắt trúng Avatar may mắn! Chuẩn bị mở câu hỏi tiếp theo...
                </p>

                <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3.2, ease: 'linear' }}
                    className="h-full bg-white"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Control Bar: Big Catch Button */}
      <div className="relative z-20 flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        {phase === 'FLYING' && (
          <button
            onClick={handleCatchAvatar}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 hover:from-amber-500 hover:to-orange-600 text-amber-950 font-black text-base sm:text-lg shadow-[0_0_30px_rgba(245,158,11,0.6)] flex items-center justify-center gap-2.5 transform hover:scale-105 active:scale-95 transition cursor-pointer border-2 border-yellow-200"
          >
            <Target size={22} className="animate-spin text-amber-950" />
            <span>🎯 BẤM CHỐT AVATAR MAY MẮN!</span>
          </button>
        )}

        {phase === 'CATCHING' && (
          <div className="px-6 py-3 rounded-2xl bg-white/20 text-white font-black text-sm flex items-center gap-2 border border-white/30 animate-pulse">
            <Sparkles size={18} className="text-yellow-300" />
            <span>Đang hút Avatar về trung tâm...</span>
          </div>
        )}

        {phase === 'CELEBRATING' && (
          <button
            onClick={onComplete}
            className="px-6 py-2.5 rounded-2xl bg-white text-slate-900 font-bold text-xs sm:text-sm hover:bg-slate-100 shadow-md transition"
          >
            Tiếp tục ngay &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
