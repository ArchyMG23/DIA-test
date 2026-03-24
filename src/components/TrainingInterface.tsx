import React, { useState, useEffect } from 'react';
import { useTimer } from '../hooks/useTimer';
import { Exercise, Evaluation } from '../services/gemini';
import { Play, Pause, RotateCcw, CheckCircle, PenTool, Award } from 'lucide-react';
import { cn } from '../lib/utils';
import Markdown from 'react-markdown';

interface TrainingInterfaceProps {
  exercise: Exercise;
  initialText: string;
  evaluation: Evaluation | null;
  onTextChange: (text: string) => void;
  onEvaluate: (text: string) => void;
  isEvaluating: boolean;
  isOnline: boolean;
}

export function TrainingInterface({ exercise, initialText, evaluation, onTextChange, onEvaluate, isEvaluating, isOnline }: TrainingInterfaceProps) {
  const [text, setText] = useState(initialText);
  const [activeTab, setActiveTab] = useState<'write' | 'eval'>(evaluation ? 'eval' : 'write');
  const { minutes, seconds, isActive, isWarning, isFinished, start, pause, reset } = useTimer(30);

  // Auto-start timer on mount if not evaluated
  useEffect(() => {
    if (!evaluation) {
      start();
    }
    return () => pause();
  }, [start, pause, evaluation]);

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

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold truncate max-w-md">{exercise.title}</h1>
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
                {isWarning && !isFinished && <span className="relative flex h-3 w-3 ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF0000] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF0000]"></span>
                </span>}
              </div>
              
              <div className="flex items-center gap-1">
                {isActive ? (
                  <button onClick={pause} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full" title="Pause">
                    <Pause className="w-5 h-5" />
                  </button>
                ) : (
                  <button onClick={start} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full" title="Reprendre" disabled={isFinished}>
                    <Play className="w-5 h-5" />
                  </button>
                )}
                <button onClick={reset} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full" title="Réinitialiser">
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
            </>
          )}

          <button
            onClick={handleEvaluate}
            disabled={text.trim().length === 0 || isEvaluating || !isOnline}
            title={!isOnline ? "Connexion internet requise pour évaluer" : ""}
            className="flex items-center gap-2 px-6 py-2 bg-[#FF0000] hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-[#FF0000] disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isEvaluating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            {evaluation ? 'Réévaluer' : 'Évaluer ma rédaction'}
          </button>
        </div>
      </header>

      {/* Split Screen Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Column: Topic */}
        <div className="w-1/2 h-full overflow-y-auto p-8 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <div className="mb-8">
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Situation / Offre</h2>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-lg leading-relaxed">
                {exercise.situation}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Consigne (Aufgabe)</h2>
            <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-lg leading-relaxed">
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
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Sehr geehrte Damen und Herren, ..."
                className="flex-1 w-full p-8 resize-none outline-none bg-transparent text-lg leading-relaxed placeholder:text-gray-400 dark:placeholder:text-gray-600"
                spellCheck={false}
              />
              <div className="px-8 py-4 border-t border-gray-100 dark:border-gray-900 text-sm text-gray-500 flex justify-between">
                <span>{text.trim().split(/\s+/).filter(w => w.length > 0).length} mots</span>
                <span>Telc B2 recommande environ 150-200 mots</span>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-8">
              {evaluation && (
                <div className="space-y-8">
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 dark:bg-gray-900 border-4 border-[#FF0000] mb-4">
                      <span className="text-2xl font-bold">{evaluation.score}</span>
                    </div>
                    <div className="prose dark:prose-invert max-w-none">
                      <Markdown>{evaluation.overallFeedback}</Markdown>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <FeedbackCard title="Correction Grammaticale" content={evaluation.grammar} />
                    <FeedbackCard title="Vocabulaire (B2)" content={evaluation.vocabulary} />
                    <FeedbackCard title="Structure de la lettre" content={evaluation.structure} />
                    <FeedbackCard title="Connecteurs Logiques" content={evaluation.connectors} />
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

function FeedbackCard({ title, content }: { title: string, content: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
      <h3 className="font-semibold text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{title}</h3>
      <div className="prose dark:prose-invert prose-sm max-w-none text-gray-700 dark:text-gray-300">
        <Markdown>{content}</Markdown>
      </div>
    </div>
  );
}
