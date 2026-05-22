/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { UploadSection } from './components/UploadSection';
import { TrainingInterface } from './components/TrainingInterface';
import { StudentDashboard } from './components/StudentDashboard';
import { InstallPWA } from './components/InstallPWA';
import { extractExercises, evaluateWriting, Exercise, Evaluation } from './services/gemini';
import { Plus, CheckCircle, Clock, WifiOff, LogIn, LogOut, Cloud, User as UserIcon, Mail } from 'lucide-react';
import { auth, loginWithGoogle, logout, db, OperationType, handleFirestoreError, updateUserRole, loginWithEmail, signUpWithEmail } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, onSnapshot, serverTimestamp, query, orderBy, where, deleteDoc } from 'firebase/firestore';
import { TeacherDashboard } from './components/TeacherDashboard';
import { Users, GraduationCap } from 'lucide-react';

interface SavedProgress {
  text: string;
  evaluation: Evaluation | null;
}

const DEFAULT_EXERCISES: Exercise[] = [
  {
    id: 'default-1',
    title: 'Beschwerde: Sprachreise nach Berlin',
    situation: 'Sie haben eine zweiwöchige Sprachreise nach Berlin gebucht. In der Anzeige stand: "Zentrale Unterkunft, kleine Gruppen (max. 8 Personen), erfahrene Lehrer". Vor Ort war die Unterkunft jedoch 45 Minuten vom Zentrum entfernt, die Gruppe bestand aus 15 Personen und der Lehrer war oft unpünktlich.',
    content: 'Schreiben Sie eine Beschwerde an den Veranstalter "Global Languages". Behandeln Sie folgende Punkte:\n- Grund Ihres Schreibens\n- Erwartungen vs. Realité (Unterkunft, Gruppengröße)\n- Kritik am Unterricht\n- Forderung (z.B. Teilrückzahlung)',
    type: 'Beschwerde'
  },
  {
    id: 'default-2',
    title: 'Bitte um Informationen: Freiwilligenarbeit',
    situation: 'Sie interessieren sich für ein Projekt zur Freiwilligenarbeit im Umweltschutz in den Alpen. Sie haben eine Anzeige im Internet gesehen, aber es fehlen wichtige Details.',
    content: 'Schreiben Sie eine E-Mail an die Organisation "Alpen-Natur". Bitten Sie um Informationen zu folgenden Punkten:\n- Dauer des Projekts und tägliche Arbeitszeit\n- Unterkunft und Verpflegung\n- Voraussetzungen (Sprachkenntnisse, Erfahrung)\n- Kosten oder Aufwandsentschädigung',
    type: 'Information'
  },
  {
    id: 'default-3',
    title: 'Bewerbung um ein Praktikum',
    situation: 'Sie haben im Internet eine Anzeige für ein dreimonatiges Praktikum im Bereich Marketing bei der Firma "Mediadesign" in Hamburg gefunden.',
    content: 'Schreiben Sie Ihre Bewerbung. Behandeln Sie folgende Punkte:\n- Grund für Ihre Bewerbung\n- Ihre bisherigen Erfahrungen and Sprachkenntnisse\n- Warum Sie für dieses Unternehmen arbeiten möchten\n- Fragen zum genauen Arbeitsbeginn',
    type: 'Bewerbung'
  }
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>(() => {
    const saved = localStorage.getItem('dia_exercises');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) return parsed;
    }
    return DEFAULT_EXERCISES;
  });
  const [progress, setProgress] = useState<Record<string, SavedProgress>>(() => {
    const saved = localStorage.getItem('dia_progress');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Email login/signup states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [emailRole, setEmailRole] = useState<'student' | 'teacher'>('student');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [teacherCode, setTeacherCode] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (isSignUp && !fullName) {
      alert("Veuillez saisir votre nom complet.");
      return;
    }
    if (isSignUp && emailRole === 'teacher' && teacherCode.trim().toUpperCase() !== 'B2PROF') {
      alert("Le code d'accès enseignant est incorrect. Veuillez utiliser le bon code pour créer un compte Prof (Ex: B2PROF).");
      return;
    }

    setAuthLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, fullName, emailRole);
      } else {
        await loginWithEmail(email, password);
      }
      // Reset form on success
      setEmail('');
      setPassword('');
      setFullName('');
      setTeacherCode('');
      setShowEmailForm(false);
    } catch (err: any) {
      console.error(err);
    } finally {
      setAuthLoading(false);
    }
  };

  // Sync Auth & Profile
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      
      // Cleanup previous profile listener
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (u) {
        const profileRef = doc(db, 'users', u.uid);
        unsubscribeProfile = onSnapshot(profileRef, (snap) => {
          if (snap.exists()) {
            setUserProfile(snap.data());
          }
        }, (err) => {
          console.error("Profile sync error:", err);
          handleFirestoreError(err, OperationType.GET, `users/${u.uid}`);
        });
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // Fetch Teachers
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(doc => list.push(doc.data()));
      setTeachers(list);
    });
    return () => unsubscribe();
  }, [user]);

  // Sync exercises from global collection
  useEffect(() => {
    const q = query(collection(db, 'exercises'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cloudExercises: Exercise[] = [];
      snapshot.forEach((doc) => {
        cloudExercises.push(doc.data() as Exercise);
      });
      
      setExercises(prev => {
        const combined = [...cloudExercises];
        
        // Ensure defaults are present
        DEFAULT_EXERCISES.forEach(def => {
          if (!combined.find(c => c.id === def.id)) {
            combined.push(def);
          }
        });

        // Keep local manual uploads that haven't hit the cloud yet
        prev.forEach(ex => {
          if (!combined.find(c => c.id === ex.id)) {
            combined.push(ex);
          }
        });

        return combined;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'exercises');
    });

    return () => unsubscribe();
  }, []);

  // Sync progress from Firestore
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'progress'), (snapshot) => {
      const cloudProgress: Record<string, SavedProgress> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        cloudProgress[doc.id] = {
          text: data.text,
          evaluation: data.evaluation || null
        };
      });
      
      if (Object.keys(cloudProgress).length > 0) {
        setProgress(prev => ({ ...prev, ...cloudProgress }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/progress`);
    });

    return () => unsubscribe();
  }, [user]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const pendingTextsRef = useRef<Record<string, string>>({});

  const flushPendingSave = useCallback(async (id: string) => {
    if (saveTimeoutRef.current[id]) {
      clearTimeout(saveTimeoutRef.current[id]);
      delete saveTimeoutRef.current[id];
    }

    const pendingText = pendingTextsRef.current[id];
    if (pendingText !== undefined && user) {
      try {
        const progRef = doc(db, 'users', user.uid, 'progress', id);
        await setDoc(progRef, {
          exerciseId: id,
          text: pendingText,
          updatedAt: serverTimestamp()
        }, { merge: true });
        delete pendingTextsRef.current[id];
      } catch (e) {
        console.warn("Error flushing save:", e);
      }
    }
  }, [user]);

  const selectExercise = async (id: string | null) => {
    if (selectedId) {
      await flushPendingSave(selectedId);
    }

    if (isTimerRunning) {
      if (confirm("Le minuteur est en cours. Voulez-vous suspendre l'exercice et enregistrer votre brouillon pour continuer plus tard ?")) {
        setIsTimerRunning(false);
      } else {
        return;
      }
    }
    setSelectedId(id);
    setIsUploading(false);
  };

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

  const handleUpload = useCallback(async (fileData: string, mimeType: string) => {
    setIsExtracting(true);
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("La clé API Gemini (GEMINI_API_KEY) est manquante.");
      }
      const extracted = await extractExercises(fileData, mimeType);
      
      // Save to global exercises if logged in
      if (user) {
        for (const ex of extracted) {
          const exRef = doc(db, 'exercises', ex.id);
          await setDoc(exRef, {
            ...ex,
            createdAt: serverTimestamp()
          });
        }
      }

      setExercises(prev => {
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
  }, [user]);

  const handleTextChange = useCallback((id: string, text: string) => {
    // Only update state immediately for smooth typing
    setProgress(prev => {
      if (prev[id]?.text === text) return prev;
      return {
        ...prev,
        [id]: { ...(prev[id] || { evaluation: null }), text }
      };
    });

    // Save pending text reference
    pendingTextsRef.current[id] = text;

    // Clear previous timeout for this id
    if (saveTimeoutRef.current[id]) {
      clearTimeout(saveTimeoutRef.current[id]);
    }

    // Save to Firestore with a debounce delay if user is logged in
    if (user) {
      const timeout = setTimeout(async () => {
        try {
          const progRef = doc(db, 'users', user.uid, 'progress', id);
          await setDoc(progRef, {
            exerciseId: id,
            text,
            updatedAt: serverTimestamp()
          }, { merge: true });
          delete pendingTextsRef.current[id];
        } catch (e) {
          console.warn("Silent save error:", e);
        }
      }, 1500);
      saveTimeoutRef.current[id] = timeout;
    }
  }, [user]);

  const handleEvaluate = useCallback(async (id: string, text: string) => {
    const exercise = exercises.find(e => e.id === id);
    if (!exercise) return;
    
    setIsEvaluating(true);
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("La clé API Gemini (GEMINI_API_KEY) est manquante.");
      }
      const result = await evaluateWriting(exercise, text);
      
      // Save to Firestore if logged in
      if (user) {
        const progRef = doc(db, 'users', user.uid, 'progress', id);
        await setDoc(progRef, {
          exerciseId: id,
          text,
          evaluation: result,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

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
  }, [exercises, user]);

  const selectedExercise = exercises.find(e => e.id === selectedId);
  const currentProgress = selectedId ? progress[selectedId] : null;

  // Memoize handlers that depend on the selected exercise id to prevent infinite loops in TrainingInterface
  const onTextChange = useMemo(() => {
    if (!selectedId) return () => {};
    return (text: string) => handleTextChange(selectedId, text);
  }, [selectedId, handleTextChange]);

  const onEvaluate = useMemo(() => {
    if (!selectedId) return () => {};
    return (text: string) => handleEvaluate(selectedId, text);
  }, [selectedId, handleEvaluate]);

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
            
            {/* User Session / Cloud Sync */}
            <div className="mb-6">
              {user ? (
                <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <UserIcon className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate leading-none mb-1">{user.displayName || 'Utilisateur'}</p>
                      <p className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Cloud className="w-2 h-2" /> {userProfile?.role === 'teacher' ? 'Enseignant' : 'Étudiant'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Role Switcher */}
                  <div className="mb-3">
                    {userProfile?.role === 'teacher' ? (
                      <button 
                        onClick={() => user && updateUserRole(user.uid, 'student')}
                        className="w-full py-1.5 px-3 rounded-lg text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-750 hover:bg-[#FF0000] hover:text-white transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5" /> Basculer en vue Étudiant
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (user) {
                            const code = prompt("Veuillez saisir le code d'accès enseignant pour activer le rôle de 'Prof' :");
                            if (code === null) return;
                            if (code.trim().toUpperCase() === "B2PROF") {
                              updateUserRole(user.uid, 'teacher');
                              alert("Rôle Enseignant activé !");
                            } else {
                              alert("Code d'accès enseignant incorrect.");
                            }
                          }
                        }}
                        className="w-full py-1 px-2 text-[9px] font-medium text-gray-400 hover:text-[#FF0000] hover:underline transition-all text-center"
                      >
                        ⚠️ Déverrouiller l'accès Enseignant
                      </button>
                    )}
                  </div>

                  <button 
                    onClick={logout}
                    className="w-full py-1.5 px-3 text-xs flex items-center justify-center gap-2 text-gray-500 hover:text-red-500 transition-colors border border-gray-100 dark:border-gray-700 rounded-lg"
                  >
                    <LogOut className="w-3 h-3" /> Déconnexion
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {!showEmailForm ? (
                    <div className="space-y-2">
                      <button
                        onClick={loginWithGoogle}
                        className="w-full p-4 bg-[#FF0000] text-white rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all active:scale-95 flex flex-col items-center gap-2 group"
                      >
                        <div className="flex items-center gap-2 font-bold">
                          <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          Connexion avec Google
                        </div>
                        <p className="text-[10px] text-white/80 font-normal">Retrouvez votre progression partout.</p>
                      </button>

                      <button
                        onClick={() => { setShowEmailForm(true); setIsSignUp(false); }}
                        className="w-full py-3 px-4 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-50 dark:hover:bg-gray-750 transition-all flex items-center justify-center gap-2"
                      >
                        <Mail className="w-4 h-4" />
                        Se connecter par Email
                      </button>

                      <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-[10px] text-amber-600 dark:text-amber-400 leading-normal">
                        <strong>Problème de connexion ?</strong> Si la fenêtre Google ne s'ouvre pas ou se ferme, utilisez l'option <strong>par Email</strong> ci-dessus qui fonctionne directement sans fenêtre popup !
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleEmailAuth} className="space-y-2.5 p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm text-left">
                      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-1.5">
                        <h3 className="text-[11px] font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                          {isSignUp ? "Créer un compte" : "Connexion Email"}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowEmailForm(false)}
                          className="text-[10px] text-gray-500 hover:text-gray-900 dark:hover:text-white underline font-medium"
                        >
                          Retour
                        </button>
                      </div>

                      {isSignUp && (
                        <div className="space-y-0.5">
                          <label className="text-[9px] uppercase font-bold text-gray-400 block">Nom complet</label>
                          <input
                            type="text"
                            className="w-full text-xs p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:border-[#FF0000]"
                            placeholder="Ex: Victor Y."
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                          />
                        </div>
                      )}

                      <div className="space-y-0.5">
                        <label className="text-[9px] uppercase font-bold text-gray-400 block">Email</label>
                        <input
                          type="email"
                          className="w-full text-xs p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:border-[#FF0000]"
                          placeholder="exemple@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[9px] uppercase font-bold text-gray-400 block">Mot de passe</label>
                        <input
                          type="password"
                          className="w-full text-xs p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:border-[#FF0000]"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                        />
                      </div>

                      {isSignUp && (
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-bold text-gray-400 block">Votre rôle</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEmailRole('student')}
                              className={`flex-1 py-1 rounded text-[10px] font-bold border transition-colors ${emailRole === 'student' ? 'bg-[#FF0000] text-white border-transparent' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 border-gray-250 dark:border-transparent'}`}
                            >
                              Élève
                            </button>
                            <button
                              type="button"
                              onClick={() => setEmailRole('teacher')}
                              className={`flex-1 py-1 rounded text-[10px] font-bold border transition-colors ${emailRole === 'teacher' ? 'bg-indigo-600 text-white border-transparent' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 border-gray-250 dark:border-transparent'}`}
                            >
                              Prof
                            </button>
                          </div>
                        </div>
                      )}

                      {isSignUp && emailRole === 'teacher' && (
                        <div className="space-y-0.5 animate-fadeIn">
                          <label className="text-[9px] uppercase font-bold text-amber-500 block">Code d'accès enseignant</label>
                          <input
                            type="text"
                            className="w-full text-xs p-2 border border-amber-300 dark:border-amber-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:border-indigo-600 font-mono"
                            placeholder="Entrez le code Prof (ex: B2PROF)"
                            value={teacherCode}
                            onChange={(e) => setTeacherCode(e.target.value)}
                            required
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full py-2 px-3 bg-[#FF0000] text-white rounded-lg font-bold text-xs hover:bg-red-600 disabled:opacity-50 transition-colors shadow-sm shadow-red-500/10"
                      >
                        {authLoading ? "En cours..." : isSignUp ? "S'inscrire et se connecter" : "Se connecter"}
                      </button>

                      <div className="text-center pt-1 border-t border-gray-100 dark:border-gray-700/50">
                        <button
                          type="button"
                          onClick={() => { setIsSignUp(!isSignUp); setPassword(''); }}
                          className="text-[10px] text-gray-500 hover:text-gray-900 dark:hover:text-white underline font-medium"
                        >
                          {isSignUp ? "Déjà membre ? Connectez-vous" : "Pas de compte ? Inscrivez-vous"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

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
                  onClick={() => selectExercise(ex.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${selectedId === ex.id && !isUploading ? 'bg-white dark:bg-gray-800 border-[#FF0000] shadow-sm' : 'bg-transparent border-transparent hover:bg-gray-200/50 dark:hover:bg-gray-800/50'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold truncate text-sm">{ex.title}</h3>
                    {isDone ? (
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    ) : hasStarted ? (
                      <Clock className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-3">{ex.type}</p>
                  
                  {/* Progress Bar */}
                  <div className="h-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${isDone ? 'w-full bg-green-500' : hasStarted ? 'w-1/2 bg-orange-500' : 'w-0'}`}
                    />
                  </div>
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
          {userProfile?.role === 'teacher' ? (
            <TeacherDashboard />
          ) : isUploading ? (
            <div className="flex-1 overflow-y-auto flex items-center justify-center">
              <UploadSection onUpload={handleUpload} isExtracting={isExtracting} isOnline={isOnline} />
            </div>
          ) : selectedExercise ? (
            <TrainingInterface
              key={selectedExercise.id}
              exercise={selectedExercise}
              initialText={currentProgress?.text || ''}
              evaluation={currentProgress?.evaluation || null}
              onTextChange={onTextChange}
              onEvaluate={onEvaluate}
              isEvaluating={isEvaluating}
              isOnline={isOnline}
              isTimerRunning={isTimerRunning}
              setIsTimerRunning={setIsTimerRunning}
              teachers={teachers}
              user={user}
              lastTeacherId={userProfile?.lastTeacherId}
              onExit={() => selectExercise(null)}
            />
          ) : (
            <StudentDashboard
              exercises={exercises}
              progress={progress}
              user={user}
              userProfile={userProfile}
              onSelectExercise={(id) => selectExercise(id)}
              onStartUpload={() => { setIsUploading(true); setSelectedId(null); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
