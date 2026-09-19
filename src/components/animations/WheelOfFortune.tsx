import { useEffect, useState, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { playTick, playWinnerFanfare } from '../../utils/soundFx';

interface WheelProps {
  candidateList?: string[];
  targetClass?: string;
  targetDisplayText?: string;
  targetStudentName?: string;
  targetSTT?: number;
  targetName?: string;
  onComplete: () => void;
}

const DEFAULT_CLASSES = [
  '10A1', '10A2', '10A5', '10A9',
  '11A1', '11A4', '11A8', '11A11',
  '12A1', '12A3', '12A6', '12A12'
];

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#10b981', 
  '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef',
  '#f43f5e', '#14b8a6', '#6366f1', '#84cc16'
];

export default function WheelOfFortune({ 
  candidateList, 
  targetClass, 
  targetDisplayText, 
  targetStudentName,
  targetSTT,
  targetName, 
  onComplete 
}: WheelProps) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Determine the EXACT winning slice label
  const winningLabel = useMemo(() => {
    if (targetStudentName) {
      return targetStudentName.trim();
    }
    if (targetClass) {
      const cleanClass = targetClass.trim().replace(/^lớp\s*/i, '');
      return `Lớp ${cleanClass}`;
    }
    if (targetName) {
      // Check if targetName starts with "Lớp 11A8 - ..."
      const match = targetName.match(/Lớp\s*([0-9A-Za-z]+)/i);
      if (match) {
        return `Lớp ${match[1]}`;
      }
      return targetName.slice(0, 16);
    }
    return 'Lớp 10A1';
  }, [targetClass, targetStudentName, targetName]);

  // Pick a random slot index (0 to 11) for the target to land on
  const targetSlotIndex = useRef(Math.floor(Math.random() * 12)).current;

  // 2. Build 12 distinct segments with the target guaranteed at targetSlotIndex
  const segments = useMemo(() => {
    const totalSlots = 12;
    const pool = (candidateList && candidateList.length >= 6 ? candidateList : DEFAULT_CLASSES).map(c => {
      const clean = c.trim().replace(/^lớp\s*/i, '');
      return `Lớp ${clean}`;
    });

    // Filter out the winning label from pool to avoid duplicates
    const otherCandidates = pool.filter(c => c.toLowerCase() !== winningLabel.toLowerCase());
    
    // Shuffle and pick 11 candidates
    const shuffled = [...otherCandidates].sort(() => 0.5 - Math.random());
    while (shuffled.length < totalSlots - 1) {
      shuffled.push(...DEFAULT_CLASSES.map(c => `Lớp ${c}`));
    }

    const result: string[] = [];
    let otherIdx = 0;

    for (let i = 0; i < totalSlots; i++) {
      if (i === targetSlotIndex) {
        result.push(winningLabel);
      } else {
        result.push(shuffled[otherIdx % shuffled.length]);
        otherIdx++;
      }
    }

    return result;
  }, [winningLabel, candidateList, targetSlotIndex]);

  const sliceAngle = 360 / segments.length; // Exactly 30 degrees per slice

  useEffect(() => {
    // Play ticking sounds that decelerate naturally
    let tickCount = 0;
    const maxTicks = 42;
    let delay = 60;

    const runTicks = () => {
      if (tickCount >= maxTicks) return;
      playTick(500 + Math.random() * 200);
      tickCount++;
      delay += Math.floor(tickCount * 2.8);
      tickIntervalRef.current = setTimeout(runTicks, delay);
    };

    const startTimer = setTimeout(() => {
      setIsSpinning(true);

      // MATHEMATICAL ROTATION FORMULA:
      // The pointer is at 12 o'clock (0° / top).
      // Segment i starts at (i * sliceAngle) and ends at ((i + 1) * sliceAngle).
      // Its visual center is at (i * sliceAngle + sliceAngle / 2).
      // When the wheel rotates clockwise by R degrees:
      // A point at initial angle θ moves to (θ + R) mod 360.
      // We want (targetCenterDeg + R) ≡ 0 (mod 360) => R ≡ 360 - targetCenterDeg.
      const targetCenterDeg = targetSlotIndex * sliceAngle + sliceAngle / 2;
      const fullSpins = 7; // 7 energetic full spins
      const finalTargetDeg = (fullSpins * 360) + (360 - targetCenterDeg);

      setRotation(finalTargetDeg);
      runTicks();

      // Spin lasts 5.0 seconds
      const completeTimer = setTimeout(() => {
        setIsFinished(true);
        playWinnerFanfare();

        // Give 2.2 seconds for teachers and students to verify the pointer
        const finishTimer = setTimeout(() => {
          onComplete();
        }, 2200);

        return () => clearTimeout(finishTimer);
      }, 5000);

      return () => clearTimeout(completeTimer);
    }, 300);

    return () => {
      clearTimeout(startTimer);
      if (tickIntervalRef.current) clearTimeout(tickIntervalRef.current);
    };
  }, [onComplete, sliceAngle, targetSlotIndex]);

  const displaySubtitle = targetDisplayText || (
    targetStudentName 
      ? `Học sinh: ${targetStudentName} (${winningLabel})`
      : `${winningLabel}${targetSTT !== undefined ? ` - Học sinh có STT ${targetSTT < 10 ? '0' + targetSTT : targetSTT}` : ''}`
  );

  return (
    <div className="flex flex-col items-center select-none">
      <div className="relative w-80 h-80 sm:w-[460px] sm:h-[460px]">
        {/* Pointer at exact 12 o'clock pointing DOWN into the wheel */}
        <div className="absolute top-[-34px] left-1/2 -translate-x-1/2 z-30 filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
          <div className="w-0 h-0 border-l-[22px] border-l-transparent border-r-[22px] border-r-transparent border-t-[44px] border-t-amber-500"></div>
          <div className="absolute top-[2px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-t-[36px] border-t-yellow-300"></div>
          <div className="absolute top-[4px] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white shadow-sm animate-ping"></div>
        </div>
        
        {/* Outer Rim with Neon Lights */}
        <div className="absolute inset-[-14px] rounded-full border-[14px] border-slate-900 shadow-2xl z-20 pointer-events-none flex items-center justify-center">
          {Array.from({ length: 24 }).map((_, i) => (
            <div 
              key={i} 
              className={`absolute w-3 h-3 rounded-full ${isFinished ? 'bg-yellow-300 shadow-[0_0_12px_rgba(253,224,71,1)]' : 'bg-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.9)]'} animate-pulse`} 
              style={{ transform: `rotate(${i * 15}deg) translateY(-224px)` }}
            />
          ))}
        </div>
        
        {/* Wheel Body */}
        <motion.div 
          className="w-full h-full rounded-full overflow-hidden relative shadow-2xl border-4 border-white/70"
          animate={{ rotate: rotation }}
          transition={{ duration: 5.0, ease: [0.12, 0.88, 0.18, 1] }}
          style={{
            willChange: 'transform',
            transform: 'translateZ(0)',
            background: `conic-gradient(${segments.map((_, idx) => `${COLORS[idx % COLORS.length]} ${idx * sliceAngle}deg ${(idx + 1) * sliceAngle}deg`).join(', ')})`
          }}
        >
          {/* Segment text and divider lines */}
          {segments.map((name, i) => {
            const rot = i * sliceAngle + sliceAngle / 2;
            const isTarget = i === targetSlotIndex;
            return (
              <div 
                key={i} 
                className="absolute w-full h-full top-0 left-0 flex items-start justify-center pt-5 pointer-events-none"
                style={{ transform: `rotate(${rot}deg)` }}
              >
                <span 
                  className={`font-black text-xs sm:text-sm tracking-wider uppercase px-2 py-0.5 rounded ${
                    isTarget && isFinished 
                      ? 'bg-amber-400 text-slate-950 shadow-md font-black ring-2 ring-white scale-110' 
                      : 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]'
                  }`}
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
              className="absolute top-0 left-1/2 w-[2px] h-1/2 bg-white/50 origin-bottom pointer-events-none"
              style={{ transform: `translateX(-50%) rotate(${i * sliceAngle}deg)` }}
            />
          ))}
          
          {/* Center Hub */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 rounded-full shadow-[0_0_25px_rgba(0,0,0,0.5)] z-20 border-4 border-white flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-yellow-300 flex items-center justify-center shadow-inner">
              <span className="text-yellow-400 font-black text-xs sm:text-sm text-center leading-tight">VTS<br/>2026</span>
            </div>
          </div>
        </motion.div>
      </div>
      
      {/* Dynamic Status / Winner Reveal Box */}
      <div className="mt-10 min-h-[70px] flex items-center justify-center">
        {isFinished ? (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white px-8 py-3.5 rounded-full shadow-2xl border-2 border-yellow-200 flex items-center gap-3 animate-bounce"
          >
            <span className="text-2xl">🎉</span>
            <div className="text-center">
              <div className="text-xs uppercase font-extrabold text-amber-100 tracking-wider">Mũi Tên Đã Dừng Tại</div>
              <div className="text-lg sm:text-2xl font-black text-white drop-shadow-md">
                {displaySubtitle}
              </div>
            </div>
            <span className="text-2xl">✨</span>
          </motion.div>
        ) : isSpinning ? (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="bg-white/95 backdrop-blur-md px-8 py-3 rounded-full shadow-lg border border-slate-200"
          >
            <span className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-600 animate-pulse flex items-center gap-2">
              <span>🎡</span> Vòng quay may mắn đang quay...
            </span>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
