import React, { useState } from 'react';
import { Exercise } from '../services/gemini';
import { BookOpen, FileText, CheckCircle, Clock, Sparkles, PlusCircle, ArrowRight, Search } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('Tous');

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

  const filteredExercises = exercises.filter(ex => {
    const title = ex.title || '';
    const situation = ex.situation || '';
    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          situation.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'Tous' || ex.type === filterType;
    return matchesSearch && matchesType;
  });

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

        {/* Recommended and Not Started Subjects */}
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

        {/* All Exercises Section */}
        <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" />
                Tous les sujets disponibles ({filteredExercises.length})
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Recherchez ou filtrez pour commencer un exercice de votre choix.</p>
            </div>
            
            {/* Search and Filters controls */}
            <div className="flex flex-col sm:flex-row gap-2 max-w-md w-full sm:w-auto shrink-0">
              <div className="relative flex-1 sm:w-48">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un sujet..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-[#FF0000] text-gray-800 dark:text-gray-200"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-[#FF0000] text-gray-700 dark:text-gray-300 font-medium"
              >
                <option value="Tous">Tous les types</option>
                <option value="Beschwerde">Beschwerde</option>
                <option value="Bewerbung">Bewerbung</option>
                <option value="Information">Information</option>
              </select>
            </div>
          </div>

          {filteredExercises.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredExercises.map(ex => {
                const prog = progress[ex.id];
                const isDone = !!prog?.evaluation;
                const hasStarted = !!prog?.text;
                
                return (
                  <div 
                    key={ex.id}
                    className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-gray-50 dark:bg-gray-900 border border-gray-255 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
                          {ex.type}
                        </span>
                        {isDone ? (
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 rounded-full border border-green-100 dark:border-green-900/30">
                            Complété
                          </span>
                        ) : hasStarted ? (
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 rounded-full border border-orange-100 dark:border-orange-900/30">
                            En cours
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-900/30">
                            Disponible
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-gray-950 dark:text-white text-sm group-hover:text-[#FF0000] cursor-pointer transition-colors leading-snug line-clamp-1" onClick={() => onSelectExercise(ex.id)}>
                        {ex.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-3 leading-relaxed">
                        {ex.situation}
                      </p>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-750 flex items-center justify-between shrink-0">
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                        {isDone ? (
                          <span className="text-green-500 font-bold">Note: {prog.evaluation?.score !== undefined ? prog.evaluation.score : 'N/A'}/100</span>
                        ) : hasStarted ? (
                          <span>Brouillon sauvegardé</span>
                        ) : (
                          <span>Pas commencé</span>
                        )}
                      </div>
                      <button
                        onClick={() => onSelectExercise(ex.id)}
                        className="py-1 px-2.5 bg-gray-50 dark:bg-gray-700 hover:bg-[#FF0000] hover:text-white text-gray-700 dark:text-gray-200 text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                      >
                        {isDone ? "Voir l'évaluation" : hasStarted ? "Reprendre" : "S'entraîner"}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">Aucun sujet ne correspond à vos critères de recherche. 🔍</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
