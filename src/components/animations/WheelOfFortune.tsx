import { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { playTick, playWinnerFanfare } from '../../utils/soundFx';

interface WheelProps {
  candidateList?: string[];
  targetName: string;
  onComplete: () => void;
}

const DEFAULT_SEGMENTS = [
  'Lớp 10A1', 'Lớp 10A5', 'Lớp 11A2', 'Lớp 11A8',
  'Lớp 12A1', 'Lớp 12A6', 'Lớp 10A9', 'Lớp 11A4',
  'Lớp 12A11', 'Lớp 11A11', 'Lớp 10A11', 'Lớp 12A3'
];

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#10b981', 
  '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef',
  '#f43f5e', '#14b8a6', '#6366f1', '#84cc16'
];

export default function WheelOfFortune({ candidateList, targetName, onComplete }: WheelProps) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const segments = candidateList && candidateList.length >= 6 
    ? candidateList.slice(0, 12) 
    : DEFAULT_SEGMENTS;

  useEffect(() => {
    // Play ticking sounds that decelerate
    let tickCount = 0;
    const maxTicks = 45;
    let delay = 60;

    const runTicks = () => {
      if (tickCount >= maxTicks) return;
      playTick(500 + Math.random() * 200);
      tickCount++;
      // Progressively slow down ticking
      delay += Math.floor(tickCount * 2.5);
      tickIntervalRef.current = setTimeout(runTicks, delay);
    };

    const startTimer = setTimeout(() => {
      setIsSpinning(true);
      const fullSpins = 6;
      const targetDeg = fullSpins * 360 + Math.floor(Math.random() * 360);
      setRotation(targetDeg);

      runTicks();

      const completeTimer = setTimeout(() => {
        playWinnerFanfare();
        setTimeout(() => {
          onComplete();
        }, 1200);
      }, 5000);

      return () => clearTimeout(completeTimer);
    }, 400);

    return () => {
      clearTimeout(startTimer);
      if (tickIntervalRef.current) clearTimeout(tickIntervalRef.current);
    };
  }, [onComplete]);

  const sliceAngle = 360 / segments.length;

  return (
    <div className="flex flex-col items-center select-none">
      <div className="relative w-80 h-80 sm:w-[460px] sm:h-[460px]">
        {/* Pointer */}
        <div className="absolute top-[-32px] left-1/2 -translate-x-1/2 z-30 filter drop-shadow-xl">
          <div className="w-0 h-0 border-l-[22px] border-l-transparent border-r-[22px] border-r-transparent border-t-[42px] border-t-amber-500"></div>
          <div className="absolute top-[2px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[34px] border-t-yellow-300"></div>
        </div>
        
        {/* Outer Rim with Neon Lights */}
        <div className="absolute inset-[-14px] rounded-full border-[14px] border-slate-900 shadow-2xl z-20 pointer-events-none flex items-center justify-center">
          {Array.from({ length: 24 }).map((_, i) => (
            <div 
              key={i} 
              className="absolute w-3 h-3 rounded-full bg-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse" 
              style={{ transform: `rotate(${i * 15}deg) translateY(-224px)` }}
            />
          ))}
        </div>
        
        {/* Wheel Body */}
        <motion.div 
          className="w-full h-full rounded-full overflow-hidden relative shadow-2xl border-4 border-white/60"
          animate={{ rotate: rotation }}
          transition={{ duration: 5.0, ease: [0.15, 0.85, 0.2, 1] }}
          style={{
            background: `conic-gradient(${segments.map((_, idx) => `${COLORS[idx % COLORS.length]} ${idx * sliceAngle}deg ${(idx + 1) * sliceAngle}deg`).join(', ')})`
          }}
        >
          {/* Segment text and divider lines */}
          {segments.map((name, i) => {
            const rot = i * sliceAngle + sliceAngle / 2;
            return (
              <div 
                key={i} 
                className="absolute w-full h-full top-0 left-0 flex items-start justify-center pt-5 pointer-events-none"
                style={{ transform: `rotate(${rot}deg)` }}
              >
                <span 
                  className="text-white font-extrabold text-xs sm:text-sm tracking-wider uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] px-2"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  {name}
                </span>
              </div>
            );
          })}

          {/* Slices divider lines */}
          {segments.map((_, i) => (
            <div 
              key={`div-${i}`} 
              className="absolute top-0 left-1/2 w-[2px] h-1/2 bg-white/40 origin-bottom pointer-events-none"
              style={{ transform: `translateX(-50%) rotate(${i * sliceAngle}deg)` }}
            />
          ))}
          
          {/* Center Hub */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 rounded-full shadow-[0_0_25px_rgba(0,0,0,0.4)] z-20 border-4 border-white flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-yellow-300 flex items-center justify-center shadow-inner">
              <span className="text-yellow-400 font-black text-xs sm:text-sm text-center leading-tight">VTS<br/>2026</span>
            </div>
          </div>
        </motion.div>
      </div>
      
      {isSpinning && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="mt-12 bg-white/90 backdrop-blur-md px-8 py-3 rounded-full shadow-lg border border-white"
        >
          <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-600 animate-pulse flex items-center gap-2">
            <span>🎡</span> Vòng quay đang tìm kiếm người may mắn...
          </span>
        </motion.div>
      )}
    </div>
  );
}
