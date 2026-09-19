import confetti from 'canvas-confetti';

let activeAnimationId: number | null = null;
let activeIntervalId: ReturnType<typeof setInterval> | null = null;

export function stopFireworks() {
  if (activeIntervalId) {
    clearInterval(activeIntervalId);
    activeIntervalId = null;
  }
  if (activeAnimationId) {
    cancelAnimationFrame(activeAnimationId);
    activeAnimationId = null;
  }
  try {
    confetti.reset();
  } catch (e) {
    console.debug('Confetti reset error:', e);
  }
}

/**
 * Hiệu ứng pháo hoa (confetti) toàn màn hình bằng thư viện canvas-confetti
 * Tạo không khí rực rỡ, bùng nổ, hào hứng khi học sinh trả lời đúng.
 */
export function triggerFullScreenFireworks(durationMs: number = 3800) {
  stopFireworks();

  const animationEnd = Date.now() + durationMs;
  const FESTIVE_COLORS = [
    '#f59e0b', // Vàng hoàng gia
    '#10b981', // Xanh ngọc lục bảo
    '#06b6d4', // Xanh cyan bầu trời
    '#ec4899', // Hồng sen rực rỡ
    '#8b5cf6', // Tím hoa cà
    '#ef4444', // Đỏ may mắn
    '#facc15', // Vàng gold lấp lánh
    '#ffffff', // Trắng ánh bạc
  ];

  // 1. Cú nổ pháo hoa trung tâm cực mạnh ban đầu
  try {
    confetti({
      particleCount: 160,
      spread: 120,
      startVelocity: 55,
      origin: { x: 0.5, y: 0.52 },
      colors: FESTIVE_COLORS,
      ticks: 250,
      gravity: 0.85,
      decay: 0.92,
      scalar: 1.2,
      zIndex: 99999,
    });
  } catch (e) {
    console.debug(e);
  }

  // 2. Hai đại bác pháo hoa hai bên góc màn hình bắn chéo lên bầu trời
  const fireCornerCannons = () => {
    try {
      // Pháo góc trái bắn chếch 60 độ sang phải
      confetti({
        particleCount: 45,
        angle: 60,
        spread: 75,
        startVelocity: 68,
        origin: { x: 0.02, y: 0.95 },
        colors: ['#38bdf8', '#facc15', '#f43f5e', '#a855f7', '#34d399', '#f59e0b'],
        ticks: 300,
        gravity: 0.8,
        scalar: 1.1,
        zIndex: 99999,
      });

      // Pháo góc phải bắn chếch 120 độ sang trái
      confetti({
        particleCount: 45,
        angle: 120,
        spread: 75,
        startVelocity: 68,
        origin: { x: 0.98, y: 0.95 },
        colors: ['#fbbf24', '#f43f5e', '#06b6d4', '#10b981', '#c084fc', '#e11d48'],
        ticks: 300,
        gravity: 0.8,
        scalar: 1.1,
        zIndex: 99999,
      });
    } catch (e) {
      console.debug(e);
    }
  };

  // 3. Pháo hoa nổ bung ngẫu nhiên trên bầu trời (Sky Bursts)
  const fireSkyBurst = () => {
    try {
      const randomX = 0.15 + Math.random() * 0.7;
      const randomY = 0.12 + Math.random() * 0.35;
      const burstColors = [
        ['#ffd700', '#ff0055', '#00e5ff'],
        ['#76ff03', '#ffeb3b', '#ff3d00'],
        ['#e040fb', '#00e676', '#ffea00'],
        ['#00b0ff', '#ff1744', '#ffc400'],
      ][Math.floor(Math.random() * 4)];

      confetti({
        particleCount: 40,
        spread: 360,
        startVelocity: 35,
        origin: { x: randomX, y: randomY },
        colors: burstColors,
        ticks: 180,
        gravity: 0.65,
        decay: 0.93,
        scalar: 1.0,
        zIndex: 99999,
      });
    } catch (e) {
      console.debug(e);
    }
  };

  // Bắn tức thì lượt đầu
  fireCornerCannons();

  // Tạo chuỗi bắn liên tục theo nhịp cho đến hết thời lượng
  activeIntervalId = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      if (activeIntervalId) {
        clearInterval(activeIntervalId);
        activeIntervalId = null;
      }
      return;
    }

    // Bắn đại bác góc
    fireCornerCannons();

    // Bắn 2 chùm pháo hoa bung tỏa trên cao
    fireSkyBurst();
    setTimeout(fireSkyBurst, 120);
  }, 320);
}
