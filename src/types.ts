export interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export type SelectionMode = 'class_stt' | 'named_students';

export interface ClassSelectionConfig {
  grade10: boolean; // 10A1 -> 10A11
  grade11: boolean; // 11A1 -> 11A11
  grade12: boolean; // 12A1 -> 12A12
  maxSTT: number;   // Mặc định 40
}

export interface StudentItem {
  id: string;
  name: string;
  className: string;
  stt?: number;
}

export interface ClassData {
  id: string;
  name: string;
  participants: string[];
}

export interface GameSelectionResult {
  className: string;
  stt?: number;
  studentName?: string;
  displayText: string;
}

export type MinigameType = 
  | 'WHEEL'           // 🎡 Vòng Quay Kỳ Diệu
  | 'VTS_BALLS'       // 🔮 Quả Cầu May Mắn VTS
  | 'SLOT'            // 🎰 Máy Bấm Số Jackpot Vegas
  | 'ROCKET'          // 🚀 Tên Lửa Vũ Trụ VTS
  | 'CHEST'           // 🎁 Rương Bí Ẩn Ma Thuật
  | 'FLYING_AVATARS'; // 🛸 Biệt Đội Avatar Bay Lượn

export interface SavedSession {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  questions: Question[];
  selectionMode: SelectionMode;
  classConfig: ClassSelectionConfig;
  customStudents?: StudentItem[];
  voicePref?: string;
  ownerId?: string;
  ownerEmail?: string;
}
