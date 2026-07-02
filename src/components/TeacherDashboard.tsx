import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, auth, Submission } from '../lib/firebase';
import { CheckCircle, Clock, AlertCircle, Send, Highlighter, GraduationCap, ArrowLeft } from 'lucide-react';
import Markdown from 'react-markdown';

export function TeacherDashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [correctionData, setCorrectionData] = useState({
    grammarScore: 0,
    vocabularyScore: 0,
    structureScore: 0,
    connectorsScore: 0,
    overallFeedback: '',
    highlightedText: ''
  });

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'submissions'),
      where('teacherId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Submission[] = [];
      snapshot.forEach(doc => list.push(doc.data() as Submission));
      setSubmissions(list);
    }, (error) => console.error("Submissions sync error:", error));

    return () => unsubscribe();
  }, []);

  const handleCorrect = async () => {
    if (!selectedSub) return;
    
    const score = correctionData.grammarScore + correctionData.vocabularyScore + correctionData.structureScore + correctionData.connectorsScore;
    
    try {
      await updateDoc(doc(db, 'submissions', selectedSub.id), {
        status: 'corrected',
        correction: {
          ...correctionData,
          score
        },
        updatedAt: serverTimestamp()
      });
      setSelectedSub(null);
      alert("Correction envoyée avec succès !");
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'envoi de la correction.");
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Submissions List */}
      <div className={`${selectedSub ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 border-r border-[#E5E7EB] dark:border-gray-800 bg-[#F9FAFB] dark:bg-gray-900/50 flex-col shrink-0 h-full`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-bold flex items-center gap-2 text-sm sm:text-base">
            <Clock className="w-4 h-4 text-indigo-500" />
            Copies à corriger
          </h2>
          <span className="bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded text-[10px]">
            {submissions.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {submissions.map(sub => (
            <button
              key={sub.id}
              onClick={() => {
                setSelectedSub(sub);
                if (sub.correction) setCorrectionData(sub.correction as any);
                else setCorrectionData({
                  grammarScore: 0, vocabularyScore: 0, structureScore: 0, connectorsScore: 0, overallFeedback: '', highlightedText: sub.text
                });
              }}
              className={`w-full text-left p-4 rounded-xl border transition-all ${selectedSub?.id === sub.id ? 'bg-white dark:bg-gray-800 border-indigo-500 shadow-sm' : 'bg-transparent border-transparent hover:bg-gray-250/50 dark:hover:bg-gray-800/50'}`}
            >
              <div className="flex justify-between items-start gap-2 mb-1">
                <h3 className="font-semibold text-sm truncate">{sub.exerciseTitle}</h3>
                {sub.status === 'corrected' ? (
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0 animation-fadeIn" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
                )}
              </div>
              <p className="text-[10px] text-gray-500">Étudiant: {sub.studentId?.substring(0, 8) || "Inconnu"}...</p>
            </button>
          ))}
          {submissions.length === 0 && (
            <div className="text-center py-10 opacity-50">
              <p className="text-sm text-gray-500 dark:text-gray-400">Aucune copie reçue.</p>
            </div>
          )}
        </div>
      </div>

      {/* Correction Zone */}
      <div className={`${!selectedSub ? 'hidden lg:block' : 'block'} flex-1 overflow-y-auto p-4 sm:p-8`}>
        {selectedSub ? (
          <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-150 dark:border-gray-800 pb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedSub(null)}
                  className="lg:hidden p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl text-gray-700 dark:text-gray-300 transition-colors"
                  title="Retourner à la liste"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{selectedSub.exerciseTitle}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Statut : {selectedSub.status === 'corrected' ? 'Déjà corrigé' : 'En attente'}</p>
                </div>
              </div>
              {selectedSub.status === 'pending' && (
                <button 
                  onClick={handleCorrect}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 w-full sm:w-auto text-sm shrink-0"
                >
                  <Send className="w-4 h-4" /> Envoyer la correction
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Student Text Area with Highlight editing */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-bold uppercase tracking-wider text-gray-400">Texte de l'étudiant / Zone de correction</label>
                  {selectedSub.status !== 'corrected' && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setCorrectionData(prev => ({ ...prev, highlightedText: prev.highlightedText + '\n\n> ❌ **Erreur :** [Insérez votre correction ici]' }))}
                        className="text-[10px] bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded border border-red-200 dark:border-red-800 hover:bg-red-100 transition-colors font-bold"
                      >
                        + Bloc Erreur
                      </button>
                      <button 
                        onClick={() => setCorrectionData(prev => ({ ...prev, highlightedText: prev.highlightedText + '\n\n> ✨ **Suggestion :** [Insérez votre suggestion ici]' }))}
                        className="text-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-2 py-1 rounded border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors font-bold"
                      >
                        + Bloc Suggestion
                      </button>
                    </div>
                  )}
                </div>
                <div className="relative group">
                  <textarea
                    value={correctionData.highlightedText}
                    onChange={(e) => setCorrectionData(prev => ({ ...prev, highlightedText: e.target.value }))}
                    disabled={selectedSub.status === 'corrected'}
                    className="w-full h-[500px] p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-inner focus:ring-2 focus:ring-indigo-500 outline-none font-sans leading-relaxed resize-none"
                    placeholder="Utilisez des marqueurs comme [ERREUR](commentaire) pour souligner..."
                  />
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-500">Zone de correction active</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 italic flex items-center gap-1">
                  <Highlighter className="w-3 h-3 text-indigo-500" />
                  Astuce : Vous pouvez utiliser du Markdown pour souligner ou ajouter des commentaires directement dans le texte.
                </p>
              </div>

              {/* Grading Sidebar */}
              <div className="space-y-6">
                <label className="block text-sm font-bold uppercase tracking-wider text-gray-400">Critères Telc B2</label>
                
                <div className="space-y-4 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
                  <ScoreInput 
                    label="Grammaire (Grammatik)" 
                    value={correctionData.grammarScore} 
                    onChange={(v) => setCorrectionData(p => ({ ...p, grammarScore: v }))} 
                    disabled={selectedSub.status === 'corrected'}
                  />
                  <ScoreInput 
                    label="Vocabulaire (Wortschatz)" 
                    value={correctionData.vocabularyScore} 
                    onChange={(v) => setCorrectionData(p => ({ ...p, vocabularyScore: v }))}
                    disabled={selectedSub.status === 'corrected'}
                  />
                  <ScoreInput 
                    label="Structure (Aufbau)" 
                    value={correctionData.structureScore} 
                    onChange={(v) => setCorrectionData(p => ({ ...p, structureScore: v }))}
                    disabled={selectedSub.status === 'corrected'}
                  />
                  <ScoreInput 
                    label="Connecteurs (Verknüpfungsmittel)" 
                    value={correctionData.connectorsScore} 
                    onChange={(v) => setCorrectionData(p => ({ ...p, connectorsScore: v }))}
                    disabled={selectedSub.status === 'corrected'}
                  />
                  
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-sm font-bold">TOTAL</span>
                       <span className="text-xl font-black text-indigo-600">{correctionData.grammarScore + correctionData.vocabularyScore + correctionData.structureScore + correctionData.connectorsScore} / 100</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-gray-400">Feedback Global Synthétique</label>
                  <textarea
                    value={correctionData.overallFeedback}
                    onChange={(e) => setCorrectionData(prev => ({ ...prev, overallFeedback: e.target.value }))}
                    disabled={selectedSub.status === 'corrected'}
                    className="w-full h-32 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-sm"
                    placeholder="Conseils pour l'examen..."
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 grayscale">
            <GraduationCap className="w-24 h-24 mb-4" />
            <h3 className="text-2xl font-bold">Tableau de bord Enseignant</h3>
            <p>Sélectionnez une copie pour commencer la correction.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreInput({ label, value, onChange, disabled }: { label: string, value: number, onChange: (v: number) => void, disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-bold uppercase tracking-tighter text-gray-500">
        <span>{label}</span>
        <span>{value} / 25</span>
      </div>
      <input 
        type="range" min="0" max="25" step="1" 
        value={value} 
        onChange={(e) => onChange(parseInt(e.target.value))}
        disabled={disabled}
        className="w-full accent-indigo-600 h-1"
      />
    </div>
  );
}
