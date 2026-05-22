import React from 'react';
import { Exercise } from '../services/gemini';
import { BookOpen, FileText, CheckCircle, Clock, Sparkles, PlusCircle, ArrowRight } from 'lucide-react';
import { User } from 'firebase/auth';

interface SavedProgress {
  text: string;
  evaluation: any | null;
}

interface StudentDashboardProps {
  exercises: Exercise[];
  progress: Record<string, SavedProgress>;
  user: User | null;
  userProfile: any;
  onSelectExercise: (id: string) => void;
  onStartUpload: () => void;
}

export function StudentDashboard({
  exercises,
  progress,
  user,
  userProfile,
  onSelectExercise,
  onStartUpload
}: StudentDashboardProps) {
  // Stats
  const totalExercises = exercises.length;
  const progressEntries = Object.entries(progress);
  
  const completedCount = exercises.filter(ex => !!progress[ex.id]?.evaluation).length;
  const draftsCount = exercises.filter(ex => !!progress[ex.id]?.text && !progress[ex.id]?.evaluation).length;

  const completionRate = totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0;

  // Active Drafts list to display
  const activeDrafts = exercises.filter(ex => {
    const prog = progress[ex.id];
    return prog && prog.text && !prog.evaluation;
  });

  // Not started subjects
  const notStarted = exercises.filter(ex => {
    const prog = progress[ex.id];
    return !prog || !prog.text;
  }).slice(0, 3); // top 3 recomendations

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-950/20 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Guten Tag{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''} ! 👋
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Préparez sereinement votre examen d'allemand B2 à votre rythme.
            </p>
          </div>
          <div>
            <button
              onClick={onStartUpload}
              className="px-4 py-2 bg-[#FF0000] text-white rounded-xl font-bold text-sm shadow-md shadow-red-500/10 hover:bg-red-600 active:scale-95 transition-all flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Importer un sujet
            </button>
          </div>
        </div>

        {/* Stats Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-sm flex items-start gap-4">
            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sujets complétés</p>
              <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white mt-1">{completedCount}</h3>
              <p className="text-xs text-green-600 font-medium mt-1">{completionRate}% de taux de réussite</p>
            </div>
          </div>

          <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-sm flex items-start gap-4">
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Brouillons actifs</p>
              <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white mt-1">{draftsCount}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Modifications sauvegardées</p>
            </div>
          </div>

          <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-sm flex items-start gap-4">
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total des sujets</p>
              <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white mt-1">{totalExercises}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Prêts pour l'entraînement</p>
            </div>
          </div>

        </div>

        {/* Active Drafts (Brouillons en cours) */}
        {activeDrafts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#FF0000]" />
              Vos rédactions en cours {draftsCount > 0 && `(${draftsCount})`}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeDrafts.map(ex => {
                const prog = progress[ex.id];
                const charCount = prog?.text?.length || 0;
                
                return (
                  <div 
                    key={ex.id}
                    className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 rounded-full border border-orange-100 dark:border-orange-900/40">
                          Brouillon
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">{charCount} caractères</span>
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">{ex.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">{ex.situation}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex justify-end">
                      <button
                        onClick={() => onSelectExercise(ex.id)}
                        className="py-1.5 px-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-[#FF0000] hover:text-white text-[#FF0000] dark:text-red-400 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        Reprendre l'écriture
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommended / Not Started Subjects */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Sujets suggérés pour aujourd'hui
          </h2>
          {notStarted.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 overflow-hidden shadow-sm">
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {notStarted.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => onSelectExercise(ex.id)}
                    className="w-full text-left p-5 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors flex items-center justify-between gap-4 group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{ex.type}</span>
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm group-hover:text-[#FF0000] transition-colors">{ex.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{ex.situation}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-400 group-hover:bg-[#FF0000]/10 group-hover:text-[#FF0000] transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">Excellent travail ! Vous avez démarré tous les sujets disponibles. 🎉 </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
