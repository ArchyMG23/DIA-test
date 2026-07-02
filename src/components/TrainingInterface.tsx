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
  const [activeTab, setActiveTab] = useState<'topic' | 'write' | 'eval'>(evaluation ? 'eval' : 'write');
  const [isRedactionFinished, setIsRedactionFinished] = useState(false);
  const { minutes, seconds, isActive, isWarning, isFinished, start, pause, reset } = useTimer(25);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // The session counts as started if they already submitted, have written text, have an evaluation, or started manually
  const [hasStartedSession, setHasStartedSession] = useState(!!evaluation || (!!initialText && initialText.trim().length > 0));

  const hasEndedRedaction = isFinished || isRedactionFinished || !!evaluation;

  const insertSpecialChar = (char: string) => {
    if (hasEndedRedaction) return;
    const textarea = textareaRef.current;
    if (!textarea) {
      setText(prev => prev + char);
      return;
    }

    const startIdx = textarea.selectionStart;
    const endIdx = textarea.selectionEnd;
    const newText = text.substring(0, startIdx) + char + text.substring(endIdx);
    
    setText(newText);
    
    // Keep focus and place cursor after inserted character
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(startIdx + char.length, startIdx + char.length);
    }, 0);
  };

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

  const handleReset = () => {
    reset();
    setIsRedactionFinished(false);
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
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800 shrink-0 select-none">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button 
            onClick={onExit}
            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center justify-center shrink-0"
            title="Quitter et abandonner l'exercice (perte des modifications)"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <h1 className="text-sm sm:text-base md:text-xl font-bold truncate max-w-[120px] sm:max-w-xs md:max-w-md">{exercise.title}</h1>
          <span className="hidden sm:inline-block px-2.5 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 rounded-full shrink-0">
            {exercise.type}
          </span>
        </div>

        {/* Timer Module */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {!evaluation && (
            <>
              {hasStartedSession && (
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-1 sm:px-4 sm:py-2 rounded-lg font-mono text-sm sm:text-lg md:text-xl font-bold transition-colors select-none",
                  isWarning ? "bg-[#FF0000]/10 text-[#FF0000]" : "bg-gray-100 dark:bg-gray-800",
                  isFinished && "bg-red-500 text-white"
                )}>
                  <Clock className="w-4 h-4 text-gray-400 select-none animate-pulse" />
                  <span>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
                </div>
              )}

              {hasStartedSession && !hasEndedRedaction && (
                <button
                  onClick={() => {
                    if (confirm("Voulez-vous arrêter le minuteur et valider votre rédaction ? Vous pourrez ensuite demander une correction IA ou l'envoyer à un enseignant.")) {
                      pause();
                      setIsRedactionFinished(true);
                    }
                  }}
                  disabled={text.trim().length === 0}
                  className="px-2.5 py-1.5 sm:px-4 sm:py-2 bg-[#FF0000] hover:bg-red-650 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-colors shadow-sm shadow-red-500/10 flex items-center gap-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Terminer la rédaction</span>
                  <span className="inline sm:hidden">Terminer</span>
                </button>
              )}
            </>
          )}

          {hasEndedRedaction ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
               <button 
                onClick={handlePrint}
                className="p-1.5 sm:p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors shrink-0"
                title="Imprimer pour correction manuelle"
              >
                <Printer className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              
              {/* Teacher Dropdown */}
              <div className="relative group">
                <button 
                  disabled={isSubmitting || teachers.length === 0}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors"
                >
                  <UserCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Enseignant</span>
                  <span className="inline sm:hidden">Prof</span>
                </button>
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                   <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                     <p className="text-[10px] font-bold text-gray-400 uppercase px-2">Choisir un prof</p>
                   </div>
                   <div className="p-1 max-h-60 overflow-y-auto w-full">
                     {teachers.map(t => (
                       <button
                         key={t.uid}
                         disabled={t.uid === lastTeacherId}
                         onClick={() => handleSendToTeacher(t.uid)}
                         className="w-full text-left p-2 rounded-lg text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between disabled:opacity-30"
                       >
                         <span className="truncate pr-2">{t.displayName || 'Prof sans nom'}</span>
                         {t.uid === lastTeacherId && <span className="text-[8px] text-red-500 shrink-0">Dernier</span>}
                       </button>
                     ))}
                     {teachers.length === 0 && <p className="p-4 text-xs text-gray-500 text-center">Aucun prof dispo</p>}
                   </div>
                </div>
              </div>

               <button
                onClick={handleEvaluate}
                disabled={text.trim().length === 0 || isEvaluating || !isOnline}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-6 sm:py-2 bg-[#FF0000] hover:bg-red-700 disabled:opacity-50 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors"
              >
                {isEvaluating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                <span className="hidden sm:inline">Correction IA</span>
                <span className="inline sm:hidden">IA</span>
              </button>
            </div>
          ) : (
            isActive && (
              <p className="hidden sm:block text-[10px] text-orange-500 font-bold uppercase animate-pulse">En cours...</p>
            )
          )}
        </div>
      </header>

      {/* Split Screen Content */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Left Column: Topic (Situation and Consigne) */}
        <div className={cn(
          "w-full md:w-1/2 h-full overflow-y-auto p-4 sm:p-8 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50",
          activeTab === 'topic' ? "block" : "hidden md:block"
        )}>
          <div className="mb-6 sm:mb-8">
            <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Situation / Offre</h2>
            <div className="p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-[15px] sm:text-[17px] leading-relaxed text-gray-800 dark:text-gray-200">
                {exercise.situation}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Consigne (Aufgabe)</h2>
            <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-[15px] sm:text-[17px] leading-relaxed text-gray-800 dark:text-gray-200 bg-white/40 dark:bg-gray-800/10 p-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
              {exercise.content}
            </div>
          </div>
        </div>

        {/* Right Column: Writing Area & Evaluation */}
        <div className={cn(
          "w-full md:w-1/2 h-full flex flex-col bg-white dark:bg-gray-950 min-h-0",
          activeTab === 'topic' ? "hidden md:flex" : "flex"
        )}>
          {/* Mobile-only tab bar when no evaluation */}
          {!evaluation && (
            <div className="md:hidden flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0">
              <button
                onClick={() => setActiveTab('topic')}
                className={cn(
                  "flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors",
                  activeTab === 'topic' ? "border-[#FF0000] text-[#FF0000]" : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600"
                )}
              >
                Sujet
              </button>
              <button
                onClick={() => setActiveTab('write')}
                className={cn(
                  "flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors",
                  activeTab === 'write' ? "border-[#FF0000] text-[#FF0000]" : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600"
                )}
              >
                Ma Rédaction
              </button>
            </div>
          )}

          {/* Tabs */}
          {evaluation && (
            <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0">
              <button
                onClick={() => setActiveTab('topic')}
                className={cn(
                  "md:hidden flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors",
                  activeTab === 'topic' ? "border-[#FF0000] text-[#FF0000]" : "border-transparent text-gray-400 dark:text-gray-500"
                )}
              >
                Sujet
              </button>
              <button
                onClick={() => setActiveTab('write')}
                className={cn(
                  "flex-1 py-3 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors",
                  activeTab === 'write' ? "border-[#FF0000] text-[#FF0000]" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                )}
              >
                <PenTool className="w-4 h-4 shrink-0" />
                Ma Rédaction
              </button>
              <button
                onClick={() => setActiveTab('eval')}
                className={cn(
                  "flex-1 py-3 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 border-b-2 transition-colors",
                  activeTab === 'eval' ? "border-[#FF0000] text-[#FF0000]" : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                )}
              >
                <Award className="w-4 h-4 shrink-0" />
                Correction ({evaluation.score}/100)
              </button>
            </div>
          )}

          {activeTab === 'write' || activeTab === 'topic' ? (
            <div className="relative flex-1 flex flex-col min-h-0">
              {!hasStartedSession && !evaluation ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 text-center bg-gray-50/30 dark:bg-gray-950/20 select-none overflow-y-auto">
                  <div className="max-w-md w-full p-6 sm:p-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl space-y-6">
                    <div className="w-16 h-16 bg-[#FF0000]/10 text-[#FF0000] rounded-full flex items-center justify-center mx-auto">
                      <Clock className="w-8 h-8 animate-pulse" />
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">Prêt à commencer l'exercice ?</h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-normal">
                        Vous disposez de <strong className="text-gray-800 dark:text-gray-200">25 minutes</strong> pour rédiger votre lettre d'examen.
                      </p>
                    </div>

                    <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-left space-y-2">
                      <h4 className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">⚠️ Consignes de sécurité du minuteur :</h4>
                      <ul className="text-xs text-amber-800 dark:text-amber-400 list-disc list-inside space-y-1 leading-normal">
                        <li>Le minuteur tourne en continu. Pas de pause ou de réinitialisation.</li>
                        <li><strong>Si vous fermez ou rechargez l'application, votre texte sera perdu.</strong></li>
                        <li>Écrivez directement dans la zone de saisie après le lancement.</li>
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setHasStartedSession(true);
                        start();
                      }}
                      className="w-full py-3 px-5 bg-[#FF0000] hover:bg-red-650 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-red-500/10 text-xs sm:text-sm cursor-pointer"
                    >
                      Démarrer le minuteur & Commencer
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={hasEndedRedaction && !evaluation}
                    placeholder="Sehr geehrte Damen und Herren, ..."
                    className={cn(
                      "flex-1 w-full p-4 sm:p-8 resize-none outline-none bg-transparent text-[15px] sm:text-lg leading-relaxed placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-opacity",
                      hasEndedRedaction && !evaluation && "opacity-50 grayscale cursor-not-allowed"
                    )}
                    spellCheck={false}
                  />
                  {hasEndedRedaction && !evaluation && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-[1px] pointer-events-none p-4 w-full">
                      <div className="bg-red-500 text-white px-6 py-4 rounded-2xl shadow-2xl font-bold flex flex-col items-center gap-2 text-center max-w-sm pointer-events-auto">
                        {isFinished ? (
                          <>
                            <Clock className="w-8 h-8 animate-pulse" />
                            <span>Temps écoulé !</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-8 h-8" />
                            <span>Rédaction validée !</span>
                          </>
                        )}
                        <p className="text-xs font-normal opacity-90">Choisissez une option de correction ci-dessus.</p>
                      </div>
                    </div>
                  )}

                  {/* German Special Characters helper panel */}
                  {!hasEndedRedaction && (
                    <div className="px-4 sm:px-8 py-2 border-t border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/10 flex items-center gap-1.5 flex-wrap shrink-0">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mr-1.5 select-none">Caractères Allemands :</span>
                      {['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü'].map(char => (
                        <button
                          key={char}
                          type="button"
                          onClick={() => insertSpecialChar(char)}
                          className="w-8 h-8 sm:w-9 sm:h-9 text-sm sm:text-base font-semibold bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-extralight border-gray-200 dark:border-gray-700 rounded-lg shadow-sm active:scale-95 transition-all text-gray-800 dark:text-gray-200 flex items-center justify-center shrink-0"
                          title={`Insérer ${char}`}
                        >
                          {char}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="px-4 sm:px-8 py-3 border-t border-gray-150 dark:border-gray-900 text-[10px] uppercase font-bold text-gray-400 flex justify-between shrink-0 select-none">
                    <span>{text.trim().split(/\s+/).filter(w => w.length > 0).length} mots</span>
                    <span>Telc B2 (150-200 mots)</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              {evaluation && (
                <div className="space-y-6 sm:space-y-8">
                   <div className="text-center mb-6 sm:mb-10">
                     <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white dark:bg-gray-900 border-8 border-gray-100 dark:border-gray-800 shadow-xl relative mb-4 sm:mb-6">
                       <span className="text-3xl sm:text-4xl font-black text-[#FF0000]">{evaluation.score}</span>
                       <div className="absolute inset-0 rounded-full border-4 border-[#FF0000] border-t-transparent animate-[spin_3s_linear_infinite]" />
                     </div>
                     <div className="prose dark:prose-invert max-w-2xl mx-auto italic text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-900/50 p-4 sm:p-6 rounded-2xl">
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
