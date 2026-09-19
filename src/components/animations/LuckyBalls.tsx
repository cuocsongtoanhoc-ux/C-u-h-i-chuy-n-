import { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { playMagicWhoosh, playWinnerFanfare } from '../../utils/soundFx';

// Coordinates for V - T - S side-by-side
// Centered around: V (-260, 0), T (0, 0), S (+260, 0)
const V_POINTS = [
  { x: -340, y: -130 },
  { x: -320, y: -65 },
  { x: -300, y: 0 },
  { x: -280, y: 65 },
  { x: -260, y: 130 }, // V tip
  { x: -240, y: 65 },
  { x: -220, y: 0 },
  { x: -200, y: -65 },
  { x: -180, y: -130 },
];

const T_POINTS = [
  // Top horizontal bar
  { x: -80, y: -130 },
  { x: -40, y: -130 },
  { x: 0, y: -130 },
  { x: 40, y: -130 },
  { x: 80, y: -130 },
  // Vertical stem
  { x: 0, y: -80 },
  { x: 0, y: -30 },
  { x: 0, y: 20 },
  { x: 0, y: 75 },
  { x: 0, y: 130 },
];

const S_POINTS = [
  // S top curve
  { x: 330, y: -125 },
  { x: 290, y: -135 },
  { x: 240, y: -120 },
  { x: 215, y: -80 },
  { x: 225, y: -35 },
  { x: 260, y: -5 },
  // S mid & bottom curve
  { x: 295, y: 25 },
  { x: 310, y: 70 },
  { x: 290, y: 115 },
  { x: 245, y: 130 },
  { x: 200, y: 115 },
];

const ALL_LETTERS_POINTS = [
  { letter: 'V', points: V_POINTS, color: '#38bdf8' },
  { letter: 'T', points: T_POINTS, color: '#facc15' },
  { letter: 'S', points: S_POINTS, color: '#f43f5e' },
];

export default function LuckyBalls({ targetName, onComplete }: { targetName: string; onComplete: () => void }) {
  const [motionIndex, setMotionIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  // Total balls per letter
  const BALL_COUNT_PER_LETTER = 12;

  useEffect(() => {
    // Play initial whoosh sound
    playMagicWhoosh();

    const whooshInterval = setInterval(() => {
      playMagicWhoosh();
    }, 1800);

    // Dynamic rotation of ball positions on the 3 letters
    const interval = setInterval(() => {
      setMotionIndex(prev => prev + 1);
    }, 160);

    // After 7.5 seconds, start convergence and drop
    const finishTimeout = setTimeout(() => {
      setIsFinishing(true);
      clearInterval(interval);
      clearInterval(whooshInterval);

      playWinnerFanfare();

      setTimeout(() => {
        onComplete();
      }, 1400);
    }, 8500);

    return () => {
      clearInterval(interval);
      clearInterval(whooshInterval);
      clearTimeout(finishTimeout);
    };
  }, [onComplete]);

  // Generate glowing balls distributed among V, T, and S
  const ballsData = useMemo(() => {
    const list = [];
    let id = 0;
    ALL_LETTERS_POINTS.forEach((group, gIdx) => {
      for (let i = 0; i < BALL_COUNT_PER_LETTER; i++) {
        list.push({
          id: id++,
          letterIdx: gIdx,
          letterPoints: group.points,
          offset: i * 2,
          color: group.color,
          hue: (gIdx * 120 + i * 25) % 360,
        });
      }
    });
    return list;
  }, []);

  return (
    <div className="relative w-full max-w-5xl h-[520px] flex flex-col items-center justify-center overflow-hidden bg-slate-950/80 rounded-[3rem] backdrop-blur-2xl shadow-2xl border-4 border-indigo-500/30 select-none">
      {/* Background Starfield & Constellation Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15)_0%,transparent_70%)] pointer-events-none" />
      
      {/* Subtle banner */}
      <div className="absolute top-6 flex items-center gap-2 px-5 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-amber-300 font-bold text-xs tracking-wider uppercase">
        <span>✨</span> Quả Cầu May Mắn <span>✨</span>
      </div>

      {/* SVG Letter Backdrop Traces: V - T - S all visible at once */}
      <div className="relative w-full h-[360px] flex items-center justify-center">
        {/* Glow outlines for V, T, S */}
        <svg className="absolute w-[800px] h-[320px] pointer-events-none overflow-visible">
          <defs>
            <filter id="glow-v" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-t" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-s" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Center of SVG is (400, 160) */}
          <g transform="translate(400, 160)">
            {/* V Letter Path */}
            <path
              d="M -340 -130 L -260 130 L -180 -130"
              fill="none"
              stroke="#0284c7"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.4"
              filter="url(#glow-v)"
            />
            {/* T Letter Path */}
            <path
              d="M -80 -130 L 80 -130 M 0 -130 L 0 130"
              fill="none"
              stroke="#eab308"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.4"
              filter="url(#glow-t)"
            />
            {/* S Letter Path */}
            <path
              d="M 330 -125 C 260 -160 210 -80 260 -10 C 310 60 270 145 200 115"
              fill="none"
              stroke="#e11d48"
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.4"
              filter="url(#glow-s)"
            />
          </g>
        </svg>

        {/* Dynamic Glowing Balls moving on all 3 letters simultaneously */}
        {ballsData.map((ball) => {
          const points = ball.letterPoints;
          const posIdx = (motionIndex + ball.offset) % points.length;
          const currentPoint = points[posIdx];

          let targetX = currentPoint.x;
          let targetY = currentPoint.y;
          let scale = 1;
          let opacity = 1;

          if (isFinishing) {
            // Balls burst outwards or converge down
            targetX = (Math.random() - 0.5) * 800;
            targetY = 400 + Math.random() * 200;
            scale = 0.4;
            opacity = 0;
          }

          return (
            <motion.div
              key={ball.id}
              className="absolute w-8 h-8 rounded-full shadow-[0_0_18px_rgba(255,255,255,0.9)] z-20 border-2 border-white flex items-center justify-center pointer-events-none"
              style={{
                background: `radial-gradient(circle at 35% 35%, #ffffff, ${ball.color} 60%, #000 100%)`,
                boxShadow: `0 0 16px ${ball.color}, 0 0 24px ${ball.color}`,
              }}
              animate={{
                x: targetX,
                y: targetY,
                scale: isFinishing ? scale : [1, 1.25, 1],
                opacity: opacity,
              }}
              transition={{
                duration: isFinishing ? 0.9 : 0.2,
                ease: isFinishing ? 'easeIn' : 'easeInOut',
              }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white/90 blur-[0.5px]" />
            </motion.div>
          );
        })}
      </div>

      {/* Result announcement when finishing */}
      {isFinishing && (
        <div className="mt-4 px-8 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-xl flex items-center gap-3 animate-bounce">
          <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-amber-300 to-rose-400 tracking-wide">
            🎉 ĐÃ CHỌN ĐƯỢC NGƯỜI MAY MẮN!
          </span>
        </div>
      )}
    </div>
  );
}
