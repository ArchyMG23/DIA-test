import React, { useState, useEffect } from 'react';
import { useTimer } from '../hooks/useTimer';
import { Exercise, Evaluation } from '../services/gemini';
import { Play, Pause, RotateCcw, CheckCircle, PenTool, Award, Printer, UserCircle, Clock, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import Markdown from 'react-markdown';
import { User } from 'firebase/auth';
import { submitToTeacher } from '../lib/firebase';

interface TrainingInterfaceProps {
  exercise: Exercise;
  initialText: string;
  evaluation: Evaluation | null;
  onTextChange: (text: string) => void;
  onEvaluate: (text: string) => void;
  isEvaluating: boolean;
  isOnline: boolean;
  isTimerRunning: boolean;
  setIsTimerRunning: (val: boolean) => void;
  teachers: any[];
  user: User | null;
  lastTeacherId?: string;
  onExit: () => void;
}

export function TrainingInterface({ 
  exercise, initialText, evaluation, onTextChange, onEvaluate, isEvaluating, isOnline,
  isTimerRunning, setIsTimerRunning, teachers, user, lastTeacherId, onExit
}: TrainingInterfaceProps) {
  const [text, setText] = useState(initialText);
  const [activeTab, setActiveTab] = useState<'write' | 'eval'>(evaluation ? 'eval' : 'write');
  const { minutes, seconds, isActive, isWarning, isFinished, start, pause, reset } = useTimer(30);

  // Sync timer state with parent
  useEffect(() => {
    setIsTimerRunning(isActive);
  }, [isActive, setIsTimerRunning]);

  // Sync text changes upwards
  useEffect(() => {
    onTextChange(text);
  }, [text, onTextChange]);

  // Switch to eval tab when evaluation arrives
  useEffect(() => {
    if (evaluation) {
      setActiveTab('eval');
      pause();
    }
  }, [evaluation, pause]);

  const handleEvaluate = () => {
    if (!isOnline) return;
    pause();
    onEvaluate(text);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendToTeacher = async (teacherId: string) => {
    if (!user) return;
    if (teacherId === lastTeacherId) {
       alert("Vous ne pouvez pas choisir le même enseignant deux fois de suite.");
       return;
    }

    setIsSubmitting(true);
    try {
      await submitToTeacher({
        studentId: user.uid,
        teacherId,
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        text,
        status: 'pending'
      });
      alert("Travail envoyé à l'enseignant !");
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'envoi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>Ma Rédaction - ${exercise.title}</title></head>
          <body style="font-family: sans-serif; padding: 40px; line-height: 1.6;">
            <h1>${exercise.title}</h1>
            <p><strong>Type:</strong> ${exercise.type}</p>
            <hr />
            <div style="white-space: pre-wrap; font-size: 1.2rem; margin-top: 2rem;">${text}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <button 
            onClick={onExit}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center justify-center"
            title="Quitter et sauvegarder"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold truncate max-w-sm">{exercise.title}</h1>
          <span className="px-3 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 rounded-full">
            {exercise.type}
          </span>
        </div>

        {/* Timer Module */}
        <div className="flex items-center gap-4">
          {!evaluation && (
            <>
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xl font-bold transition-colors",
                isWarning ? "bg-[#FF0000]/10 text-[#FF0000]" : "bg-gray-100 dark:bg-gray-800",
                isFinished && "bg-red-500 text-white"
              )}>
                <span>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
              </div>
              
              <div className="flex items-center gap-1">
                {isActive ? (
                  <button onClick={pause} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full" title="Pause">
                    <Pause className="w-5 h-5" />
                  </button>
                ) : (
                  <button onClick={start} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full" title="Débuter" disabled={isFinished}>
                    <Play className="w-5 h-5 text-green-500" />
                  </button>
                )}
                <button onClick={reset} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full" title="Réinitialiser">
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
            </>
          )}

          {isFinished || evaluation ? (
            <div className="flex items-center gap-2">
               <button 
                onClick={handlePrint}
                className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Imprimer pour correction manuelle"
              >
                <Printer className="w-5 h-5" />
              </button>
              
              {/* Teacher Dropdown */}
              <div className="relative group">
                <button 
                  disabled={isSubmitting || teachers.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
                >
                  <UserCircle className="w-4 h-4" /> Enseignant
                </button>
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                   <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                     <p className="text-[10px] font-bold text-gray-400 uppercase px-2">Choisir un prof</p>
                   </div>
                   <div className="p-1 max-h-60 overflow-y-auto">
                     {teachers.map(t => (
                       <button
                         key={t.uid}
                         disabled={t.uid === lastTeacherId}
                         onClick={() => handleSendToTeacher(t.uid)}
                         className="w-full text-left p-2 rounded-lg text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between disabled:opacity-30"
                       >
                         <span>{t.displayName || 'Prof sans nom'}</span>
                         {t.uid === lastTeacherId && <span className="text-[8px] text-red-500">Dernier</span>}
                       </button>
                     ))}
                     {teachers.length === 0 && <p className="p-4 text-xs text-gray-500 text-center">Aucun prof dispo</p>}
                   </div>
                </div>
              </div>

               <button
                onClick={handleEvaluate}
                disabled={text.trim().length === 0 || isEvaluating || !isOnline}
                className="flex items-center gap-2 px-6 py-2 bg-[#FF0000] hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                {isEvaluating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                IA
              </button>
            </div>
          ) : (
            isActive && (
              <p className="text-[10px] text-orange-500 font-bold uppercase animate-pulse">Temps en cours...</p>
            )
          )}
        </div>
      </header>

      {/* Split Screen Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Column: Topic */}
        <div className="w-1/2 h-full overflow-y-auto p-8 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <div className="mb-8">
            <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Situation / Offre</h2>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-lg leading-relaxed text-gray-800 dark:text-gray-200">
                {exercise.situation}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Consigne (Aufgabe)</h2>
            <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-lg leading-relaxed text-gray-800 dark:text-gray-200">
              {exercise.content}
            </div>
          </div>
        </div>

        {/* Right Column: Writing Area & Evaluation */}
        <div className="w-1/2 h-full flex flex-col bg-white dark:bg-gray-950">
          {/* Tabs */}
          {evaluation && (
            <div className="flex border-b border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setActiveTab('write')}
                className={cn(
                  "flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors",
                  activeTab === 'write' ? "border-[#FF0000] text-[#FF0000]" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                )}
              >
                <PenTool className="w-4 h-4" />
                Ma Rédaction
              </button>
              <button
                onClick={() => setActiveTab('eval')}
                className={cn(
                  "flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors",
                  activeTab === 'eval' ? "border-[#FF0000] text-[#FF0000]" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                )}
              >
                <Award className="w-4 h-4" />
                Correction ({evaluation.score}/100)
              </button>
            </div>
          )}

          {activeTab === 'write' ? (
            <div className="relative flex-1 flex flex-col">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isFinished && !evaluation}
                placeholder="Sehr geehrte Damen und Herren, ..."
                className={cn(
                  "flex-1 w-full p-8 resize-none outline-none bg-transparent text-lg leading-relaxed placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-opacity",
                  isFinished && !evaluation && "opacity-50 grayscale cursor-not-allowed"
                )}
                spellCheck={false}
              />
              {isFinished && !evaluation && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-[1px] pointer-events-none">
                  <div className="bg-red-500 text-white px-8 py-4 rounded-2xl shadow-2xl font-bold flex flex-col items-center gap-2">
                    <Clock className="w-8 h-8 animate-pulse" />
                    <span>Temps écoulé !</span>
                    <p className="text-xs font-normal opacity-90">Choisissez une option de correction ci-dessus.</p>
                  </div>
                </div>
              )}
              <div className="px-8 py-4 border-t border-gray-100 dark:border-gray-900 text-[10px] uppercase font-bold text-gray-400 flex justify-between">
                <span>{text.trim().split(/\s+/).filter(w => w.length > 0).length} mots</span>
                <span>Telc B2 (150-200 mots)</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-8">
              {evaluation && (
                <div className="space-y-8">
                  <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white dark:bg-gray-900 border-8 border-gray-100 dark:border-gray-800 shadow-xl relative mb-6">
                      <span className="text-4xl font-black text-[#FF0000]">{evaluation.score}</span>
                      <div className="absolute inset-0 rounded-full border-4 border-[#FF0000] border-t-transparent animate-[spin_3s_linear_infinite]" />
                    </div>
                    <div className="prose dark:prose-invert max-w-2xl mx-auto italic text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl">
                      <Markdown>{evaluation.overallFeedback}</Markdown>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <FeedbackCard title="Grammaire" content={evaluation.grammar} score={evaluation.grammarScore} maxScore={25} />
                    <FeedbackCard title="Vocabulaire (B2)" content={evaluation.vocabulary} score={evaluation.vocabularyScore} maxScore={25} />
                    <FeedbackCard title="Structure de la lettre" content={evaluation.structure} score={evaluation.structureScore} maxScore={25} />
                    <FeedbackCard title="Connecteurs Logiques" content={evaluation.connectors} score={evaluation.connectorsScore} maxScore={25} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FeedbackCard({ title, content, score, maxScore }: { title: string, content: string, score: number, maxScore: number }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</h3>
        <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-800 rounded text-xs font-mono font-bold">
          {score} / {maxScore}
        </span>
      </div>
      <div className="prose dark:prose-invert prose-sm max-w-none text-gray-700 dark:text-gray-300">
        <Markdown>{content}</Markdown>
      </div>
    </div>
  );
}
