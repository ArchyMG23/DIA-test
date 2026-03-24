/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UploadSection } from './components/UploadSection';
import { TrainingInterface } from './components/TrainingInterface';
import { extractExercises, evaluateWriting, Exercise, Evaluation } from './services/gemini';
import { Plus, CheckCircle, Clock } from 'lucide-react';

interface SavedProgress {
  text: string;
  evaluation: Evaluation | null;
}

export default function App() {
  const [exercises, setExercises] = useState<Exercise[]>(() => {
    const saved = localStorage.getItem('dia_exercises');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [progress, setProgress] = useState<Record<string, SavedProgress>>(() => {
    const saved = localStorage.getItem('dia_progress');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(exercises.length === 0);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    localStorage.setItem('dia_exercises', JSON.stringify(exercises));
  }, [exercises]);

  useEffect(() => {
    localStorage.setItem('dia_progress', JSON.stringify(progress));
  }, [progress]);

  const handleUpload = async (fileData: string, mimeType: string) => {
    setIsExtracting(true);
    try {
      const extracted = await extractExercises(fileData, mimeType);
      setExercises(prev => {
        // Avoid duplicates by ID if necessary, but here we just prepend
        return [...extracted, ...prev];
      });
      setIsUploading(false);
      if (extracted.length > 0) {
        setSelectedId(extracted[0].id);
      }
    } catch (error) {
      console.error(error);
      alert("Erreur lors de l'extraction des exercices.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleTextChange = (id: string, text: string) => {
    setProgress(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { evaluation: null }), text }
    }));
  };

  const handleEvaluate = async (id: string, text: string) => {
    const exercise = exercises.find(e => e.id === id);
    if (!exercise) return;
    
    setIsEvaluating(true);
    try {
      const result = await evaluateWriting(exercise, text);
      setProgress(prev => ({
        ...prev,
        [id]: { text, evaluation: result }
      }));
    } catch (error) {
      console.error(error);
      alert("Erreur lors de l'évaluation.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const selectedExercise = exercises.find(e => e.id === selectedId);
  const currentProgress = selectedId ? progress[selectedId] : null;

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-900/50 shrink-0">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-xl font-bold tracking-tight mb-4 text-[#FF0000]">DIA Schreiben</h1>
          <button
            onClick={() => { setIsUploading(true); setSelectedId(null); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Ajouter un sujet
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {exercises.map(ex => {
            const prog = progress[ex.id];
            const isDone = !!prog?.evaluation;
            const hasStarted = !!prog?.text;
            
            return (
              <button
                key={ex.id}
                onClick={() => { setSelectedId(ex.id); setIsUploading(false); }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${selectedId === ex.id && !isUploading ? 'bg-white dark:bg-gray-800 border-[#FF0000] shadow-sm' : 'bg-transparent border-transparent hover:bg-gray-200/50 dark:hover:bg-gray-800/50'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold truncate text-sm">{ex.title}</h3>
                  {isDone ? (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  ) : hasStarted ? (
                    <Clock className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  ) : null}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{ex.type}</p>
              </button>
            );
          })}
          {exercises.length === 0 && (
            <p className="text-sm text-gray-500 text-center mt-10">Aucun exercice sauvegardé.</p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {isUploading || !selectedExercise ? (
          <div className="flex-1 overflow-y-auto flex items-center justify-center">
            <UploadSection onUpload={handleUpload} isExtracting={isExtracting} />
          </div>
        ) : (
          <TrainingInterface
            key={selectedExercise.id}
            exercise={selectedExercise}
            initialText={currentProgress?.text || ''}
            evaluation={currentProgress?.evaluation || null}
            onTextChange={(text) => handleTextChange(selectedExercise.id, text)}
            onEvaluate={(text) => handleEvaluate(selectedExercise.id, text)}
            isEvaluating={isEvaluating}
          />
        )}
      </div>
    </div>
  );
}
