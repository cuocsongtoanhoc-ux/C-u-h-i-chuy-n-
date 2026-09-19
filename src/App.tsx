/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import SetupScreen from './components/SetupScreen';
import PresentationScreen from './components/PresentationScreen';
import { 
  Question, 
  ClassData, 
  SelectionMode, 
  ClassSelectionConfig, 
  StudentItem 
} from './types';
import { VoiceGenderPreference } from './utils/speechHelper';

export default function App() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('class_stt');
  const [classConfig, setClassConfig] = useState<ClassSelectionConfig>({
    grade10: true,
    grade11: true,
    grade12: true,
    maxSTT: 40,
  });
  const [customStudents, setCustomStudents] = useState<StudentItem[]>([]);
  const [voicePreference, setVoicePreference] = useState<VoiceGenderPreference>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vts_voice_preference');
      if (stored) return stored as VoiceGenderPreference;
    }
    return 'aoede';
  });
  const [mode, setMode] = useState<'setup' | 'presentation'>('setup');
  
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans selection:bg-amber-200">
      {mode === 'setup' ? (
        <SetupScreen 
          onStart={(q, selMode, cfg, students, cList, voicePref) => {
            setQuestions(q);
            setSelectionMode(selMode);
            setClassConfig(cfg);
            setCustomStudents(students);
            setClasses(cList);
            setVoicePreference(voicePref);
            setMode('presentation');
          }}
        />
      ) : (
        <PresentationScreen
          questions={questions}
          selectionMode={selectionMode}
          classConfig={classConfig}
          customStudents={customStudents}
          classes={classes}
          voicePreference={voicePreference}
          onBack={() => setMode('setup')}
        />
      )}
    </div>
  );
}
