/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UploadSection } from './components/UploadSection';
import { TrainingInterface } from './components/TrainingInterface';
import { InstallPWA } from './components/InstallPWA';
import { extractExercises, evaluateWriting, Exercise, Evaluation } from './services/gemini';
import { Plus, CheckCircle, Clock, WifiOff } from 'lucide-react';

interface SavedProgress {
  text: string;
  evaluation: Evaluation | null;
}

export default function App() {
  const [exercises, setExercises] = useState<Exercise[]>(() => {
    const saved = localStorage.getItem('dia_exercises');
    if (saved) return JSON.parse(saved);
    
    // Default exercises if none exist
    return [
      {
        id: 'default-1',
        title: 'Beschwerde: Sprachreise nach Berlin',
        situation: 'Sie haben eine zweiwöchige Sprachreise nach Berlin gebucht. In der Anzeige stand: "Zentrale Unterkunft, kleine Gruppen (max. 8 Personen), erfahrene Lehrer". Vor Ort war die Unterkunft jedoch 45 Minuten vom Zentrum entfernt, die Gruppe bestand aus 15 Personen und der Lehrer war oft unpünktlich.',
        content: 'Schreiben Sie eine Beschwerde an den Veranstalter "Global Languages". Behandeln Sie folgende Punkte:\n- Grund Ihres Schreibens\n- Erwartungen vs. Realität (Unterkunft, Gruppengröße)\n- Kritik am Unterricht\n- Forderung (z.B. Teilrückzahlung)',
        type: 'Beschwerde'
      },
      {
        id: 'default-2',
        title: 'Bitte um Informationen: Freiwilligenarbeit',
        situation: 'Sie interessieren sich für ein Projekt zur Freiwilligenarbeit im Umweltschutz in den Alpen. Sie haben eine Anzeige im Internet gesehen, aber es fehlen wichtige Details.',
        content: 'Schreiben Sie eine E-Mail an die Organisation "Alpen-Natur". Bitten Sie um Informationen zu folgenden Punkten:\n- Dauer des Projekts und tägliche Arbeitszeit\n- Unterkunft und Verpflegung\n- Voraussetzungen (Sprachkenntnisse, Erfahrung)\n- Kosten oder Aufwandsentschädigung',
        type: 'Information'
      }
    ];
  });
  
  const [progress, setProgress] = useState<Record<string, SavedProgress>>(() => {
    const saved = localStorage.getItem('dia_progress');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const saved = localStorage.getItem('dia_exercises');
    const ex = saved ? JSON.parse(saved) : null;
    if (ex && ex.length > 0) return ex[0].id;
    return 'default-1'; // Default if no saved exercises
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('dia_exercises', JSON.stringify(exercises));
  }, [exercises]);

  useEffect(() => {
    localStorage.setItem('dia_progress', JSON.stringify(progress));
  }, [progress]);

  const handleUpload = async (fileData: string, mimeType: string) => {
    setIsExtracting(true);
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("La clé API Gemini (GEMINI_API_KEY) est manquante. Veuillez l'ajouter dans les variables d'environnement sur Render et relancer le déploiement.");
      }
      const extracted = await extractExercises(fileData, mimeType);
      setExercises(prev => {
        // Avoid duplicates by ID if necessary, but here we just prepend
        return [...extracted, ...prev];
      });
      setIsUploading(false);
      if (extracted.length > 0) {
        setSelectedId(extracted[0].id);
      } else {
        alert("Aucun exercice n'a été trouvé dans ce document.");
      }
    } catch (error: any) {
      console.error(error);
      alert(`Erreur lors de l'extraction: ${error.message || "Erreur inconnue"}`);
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
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("La clé API Gemini (GEMINI_API_KEY) est manquante.");
      }
      const result = await evaluateWriting(exercise, text);
      setProgress(prev => ({
        ...prev,
        [id]: { text, evaluation: result }
      }));
    } catch (error: any) {
      console.error(error);
      alert(`Erreur lors de l'évaluation: ${error.message || "Erreur inconnue"}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  const selectedExercise = exercises.find(e => e.id === selectedId);
  const currentProgress = selectedId ? progress[selectedId] : null;

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans overflow-hidden">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-orange-500 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 shrink-0">
          <WifiOff className="w-4 h-4" />
          Mode hors-ligne actif. Vous pouvez continuer à écrire, mais l'extraction et l'évaluation nécessitent une connexion.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-900/50 shrink-0">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <h1 className="text-xl font-bold tracking-tight mb-4 text-[#FF0000]">DIA SCHREIBEN</h1>
            
            {!process.env.GEMINI_API_KEY ? (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
                <div className="font-bold mb-1 flex items-center gap-1">
                  <WifiOff className="w-3 h-3" /> Clé API manquante
                </div>
                L'IA ne fonctionnera pas. Ajoutez <strong>GEMINI_API_KEY</strong> dans les variables d'environnement sur Render.
              </div>
            ) : (
              <div className="mb-4 p-2 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-lg text-[10px] text-green-600 dark:text-green-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                IA Connectée (Gemini 3.1 Pro)
              </div>
            )}

            <button
              onClick={() => { setIsUploading(true); setSelectedId(null); }}
              disabled={!isOnline}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              title={!isOnline ? "Connexion internet requise" : ""}
            >
              <Plus className="w-4 h-4" />
              Ajouter un sujet
            </button>
            <InstallPWA />
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
              <UploadSection onUpload={handleUpload} isExtracting={isExtracting} isOnline={isOnline} />
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
              isOnline={isOnline}
            />
          )}
        </div>
      </div>
    </div>
  );
}
