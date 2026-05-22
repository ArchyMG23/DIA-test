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
import { Plus, CheckCircle, Clock, WifiOff, LogIn, LogOut, Cloud, User as UserIcon, Mail, Users, GraduationCap, Menu, X } from 'lucide-react';
import { auth, loginWithGoogle, logout, db, OperationType, handleFirestoreError, updateUserRole, loginWithEmail, signUpWithEmail } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, onSnapshot, serverTimestamp, query, orderBy, where, deleteDoc } from 'firebase/firestore';
import { TeacherDashboard } from './components/TeacherDashboard';

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
  },
  {
    id: 'default-4',
    title: 'Beschwerde: Mietwagen im Urlaub',
    situation: 'Für Ihren einwöchigen Familienurlaub in Spanien haben Sie online bei "Rent-a-Car Premium" einen geräumigen SUV mit voll ausgestatteter Klimaanlage gebucht. Bei der Abholung am Flughafen erhielten Sie jedoch einen kleinen, dreitürigen Kleinwagen. Zudem funktionierte die Klimaanlage nicht, und der Kindersitz fehlte. Trotz mehrmaliger Bitten verweigerte der Kundenservice vor Ort jegliche Unterstützung oder einen Fahrzeugwechsel.',
    content: 'Schreiben Sie eine Beschwerde an die Zentrale von "Rent-a-Car Premium". Behandeln Sie folgende Punkte:\n- Grund Ihres Schreibens\n- Abweichungen zwischen Buchung und erhaltenem Fahrzeug\n- Mangelnde Ausstattung (Klimaanlage, Kindersitz) und die Folgen\n- Unkooperatives Verhalten des Kundenservices\n- Angemessene finanzielle Entschädigung',
    type: 'Beschwerde'
  },
  {
    id: 'default-5',
    title: 'Beschwerde: Festival "Rock am See"',
    situation: 'Sie haben für das zweitägige Musikfestival "Rock am See" teure VIP-Tickets erworben, die laut Veranstalter separaten Zugang, erstklassiges Catering, exklusiven VIP-Bereich nah an der Bühne und ein Treffen mit den Künstlern beinhalteten. Die Realität war enttäuschend: Es gab keinen VIP-Eingang, die Schlangen waren stundenlang, der VIP-Bereich war überfüllt und zwei Hauptbands traten ohne Ersatz nicht auf.',
    content: 'Schreiben Sie eine Beschwerde an die Eventagentur "SummerVibes GmbH". Behandeln Sie folgende Punkte:\n- Grund Ihres Schreibens\n- Fehlende vertraglich vereinbarte Leistungen (VIP-Vorteile)\n- Enttäuschung über das Catering und die Organisation\n- Ausfall der Künstler und unzureichende Kommunikation\n- Forderung auf Rückerstattung eines Teils des Ticketpreises',
    type: 'Beschwerde'
  },
  {
    id: 'default-6',
    title: 'Beschwerde: Online-Kauf eines Laptops',
    situation: 'Sie haben online über das Portal "Refurbished-Tech" ein generalüberholtes Notebook der Premiumklasse bestellt. Laut Beschreibung sollte das Gerät im Zustand "Wie neu" sein und inklusive Originalladegerät und Schutzhülle geliefert werden. Das gelieferte Notebook hatte jedoch deutliche Kratzer auf dem Bildschirm, die Akkulaufzeit lag unter 30 Minuten und das Zubehör fehlte komplett.',
    content: 'Schreiben Sie eine Beschwerde an "Refurbished-Tech Kundenservice". Behandeln Sie folgende Punkte:\n- Grund des Schreibens und Bestelldaten\n- Beschreibung der Mängel am Gerät\n- Fehlendes Zubehör (Ladegerät, Hülle)\n- Enttäuschung über die Qualitätsbeschreibung ("Wie neu")\n- Fristsetzung zur Nachbesserung, Umtausch oder Rückgabe des Geldes',
    type: 'Beschwerde'
  },
  {
    id: 'default-7',
    title: 'Bitte um Informationen: Intensivsprachkurs in Wien',
    situation: 'Sie planen, im kommenden Herbst Ihre Deutschkenntnisse zu vertiefen und sich auf die C1-Prüfung vorzubereiten. Sie stoßen auf das Angebot des "Dialog-Instituts in Wien". Das Online-Angebot klingt vielversprechend, lässt aber wesentliche organisatorische Details offen.',
    content: 'Schreiben Sie eine E-Mail an das "Dialog-Institut Wien". Bitten Sie um Informationen zu folgenden Punkten:\n- Genaue Unterrichtszeiten und Gruppengröße\n- Unterstützung bei der Wohnungssuche oder Unterkunftsmöglichkeiten\n- Spezifischer Ablauf der Vorbereitung auf die C1-Prüfung (Simulationsprüfungen)\n- Stornierungsbedingungen und Fristen bei Visumsproblemen',
    type: 'Information'
  },
  {
    id: 'default-8',
    title: 'Bitte um Informationen: Auslandspraktikum in New York',
    situation: 'Die Vermittlungsagentur "GlobalCareers" bietet sechsmonatige bezahlte Praktika im Bereich Event-Marketing und Kommunikation in New York an. Sie finden das Angebot äußerst attraktiv, benötigen jedoch klärende Details.',
    content: 'Schreiben Sie eine Anfrage-E-Mail an "GlobalCareers". Fragen Sie nach:\n- Kriterien für die Auswahl der Bewerber und notwendige Englischzertifikate\n- Durchschnittliche Höhe des Stipendiums / der Vergütung\n- Unterstützung bei der Beantragung des J-1 Visums\n- Vermittlungsgebühren und zusätzliche Kosten (z.B. Krankenversicherung)',
    type: 'Information'
  },
  {
    id: 'default-9',
    title: 'Bitte um Informationen: Messeteilnahme für Start-ups',
    situation: 'Sie vertreten das junge Food-Startup "ChocoBio" und möchten Ihr Produkt auf der Leitmesse "EcoFood Expo" in Köln präsentieren. Auf der Website finden Sie zwar das Anmeldeformular, aber keine Detailinformationen für Erstaussteller.',
    content: 'Schreiben Sie eine E-Mail an das Messeteam der "EcoFood Expo". Klären Sie folgende Punkte:\n- Kosten pro Quadratmeter für einen kleinen Ausstellungsstand\n- Möglichkeit der Beteiligung an der Startup-Area (Sonderkonditionen)\n- Zur Verfügung gestellte technische Ausstattung (Strom, Kühlgeräte)\n- Werbemöglichkeiten im offiziellen Messekatalog und auf der Website',
    type: 'Information'
  },
  {
    id: 'default-10',
    title: 'Bewerbung: Mitarbeiter an der Hotelrezeption',
    situation: 'Das Grand Hotel "Vier Jahreszeiten" in München sucht für die Sommersaison eine Aushilfe (m/w/d) an der Rezeption und für die Gästebetreuung. Vorausgesetzt werden verhandlungssichere Deutsch- und Englischkenntnisse sowie ein freundliches Auftreten.',
    content: 'Schreiben Sie Ihr Bewerbungsschreiben. Gehen Sie auf folgende Punkte ein:\n- Grund für Ihre Bewerbung und Bezugnahme auf die Stellenanzeige\n- Ihre Sprachkenntnisse und Ausbildung\n- Bisherige Kundenservice- oder Gastronomieerfahrungen\n- Motivation, für dieses renommierte Hotel zu arbeiten\n- Ihre zeitliche Verfügbarkeit im Sommer',
    type: 'Bewerbung'
  },
  {
    id: 'default-11',
    title: 'Bewerbung: Duales Studium "Tourismusmanagement"',
    situation: 'Sie interessieren sich für ein dreijähriges duales Studium im Bereich Tourismusmanagement mit einem Mix aus Theoriezeiten an der Hochschule und Praxisphasen bei der "Rheinland Reise Gruppe GmbH". Diese vergibt für das nächste Studienjahr zwei begehrte Plätze.',
    content: 'Schreiben Sie Ihre Bewerbung für das Duale Studium an die Personalabteilung der "Rheinland Reise Gruppe". Behandeln Sie folgende Punkte:\n- Warum Sie sich für den Studiengang Tourismusmanagement entschieden haben\n- Ihre schulischen Leistungen und relevanten Sprachkenntnisse (Deutsch, Englisch)\n- Erste Erfahrungen im Tourismus- oder Servicebereich\n- Warum Sie die Rheinland Reise Gruppe als Praxispartner wählen\n- Ihre Erwartungen an das duale System',
    type: 'Bewerbung'
  },
  {
    id: 'default-12',
    title: 'Bewerbung: Aushilfe in einer Buchhandlung',
    situation: 'Die traditionsreiche Buchhandlung "Buch & Kaffee" in Frankfurt sucht ab sofort eine studentische Aushilfe (m/w/d) für die Wochenenden (Samstage) zur Betreuung der Kunden und zur Pflege der Buchbestände.',
    content: 'Schreiben Sie Ihre Bewerbung an den Inhaber Herrn Peters. Behandeln Sie folgende Punkte:\n- Warum Sie in einer Buchhandlung arbeiten möchten\n- Ihre persönliche Lese-Affinität und Lieblingsgenres\n- Ihre Erfahrungen im Umgang mit Kunden (Freundlichkeit, Service)\n- Ihre Zuverlässigkeit und zeitliche Flexibilität am Samstag\n- Ihr gewünschter Arbeitsbeginn',
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
        unsubscribeProfile = onSnapshot(profileRef, async (snap) => {
          if (snap.exists()) {
            setUserProfile(snap.data());
          } else {
            console.log("No profile found in Firestore for uid:", u.uid, ". Initializing fallback...");
            const fallbackProfile = {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || '',
              photoURL: u.photoURL || null,
              role: 'student' as const,
              createdAt: new Date()
            };
            setUserProfile(fallbackProfile);
            
            // Background self-healing creation of missing profile document
            try {
              await setDoc(profileRef, {
                uid: u.uid,
                email: u.email || '',
                displayName: u.displayName || '',
                photoURL: u.photoURL || null,
                role: 'student',
                createdAt: serverTimestamp()
              }, { merge: true });
              console.log("Automatically created missing profile in Firestore.");
            } catch (createErr) {
              console.warn("Could not auto-create user profile document in Firestore:", createErr);
            }
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
    setIsSidebarOpen(false);
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

  // Synchronise local custom exercises to Firestore upon login
  useEffect(() => {
    if (!user) return;
    
    const syncLocalExercises = async () => {
      const customLocalExercises = exercises.filter(ex => !ex.id.startsWith('default-'));
      for (const ex of customLocalExercises) {
        // Sanitize first to protect against ID/keys firestore rules
        const cleanId = ex.id.replace(new RegExp("[^a-zA-Z0-9_\\-]", "g"), '_').substring(0, 100) || `ex_${Date.now()}`;
        try {
          const exRef = doc(db, 'exercises', cleanId);
          await setDoc(exRef, {
            id: cleanId,
            title: ex.title || 'Sujet sans titre',
            situation: ex.situation || '',
            content: ex.content || '',
            type: ex.type || 'Beschwerde',
            createdAt: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.warn("Silent sync error for exercise:", cleanId, err);
        }
      }
    };

    // Run sync after a brief delay to avoid race conditions
    const timer = setTimeout(() => {
      syncLocalExercises();
    }, 2500);

    return () => clearTimeout(timer);
  }, [user, exercises]);

  const handleUpload = useCallback(async (fileData: string, mimeType: string) => {
    setIsExtracting(true);
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("La clé API Gemini (GEMINI_API_KEY) est manquante.");
      }
      const extracted = await extractExercises(fileData, mimeType);
      
      const sanitizedExtracted = extracted.map(ex => {
        const cleanId = ex.id.replace(new RegExp("[^a-zA-Z0-9_\\-]", "g"), '_').substring(0, 100) || `ex_${Date.now()}`;
        return {
          id: cleanId,
          title: ex.title || 'Sujet sans titre',
          situation: ex.situation || '',
          content: ex.content || '',
          type: ex.type || 'Beschwerde'
        };
      });

      // Save to global exercises if logged in
      if (user) {
        for (const ex of sanitizedExtracted) {
          const exRef = doc(db, 'exercises', ex.id);
          await setDoc(exRef, {
            id: ex.id,
            title: ex.title,
            situation: ex.situation,
            content: ex.content,
            type: ex.type,
            createdAt: serverTimestamp()
          });
        }
      }

      setExercises(prev => {
        const filteredPrev = prev.filter(p => !sanitizedExtracted.some(s => s.id === p.id));
        return [...sanitizedExtracted, ...filteredPrev];
      });
      setIsUploading(false);
      if (sanitizedExtracted.length > 0) {
        setSelectedId(sanitizedExtracted[0].id);
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

      {/* Mobile Header Banner */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-bold text-sm tracking-widest text-[#FF0000]">DIA SCHREIBEN</span>
        <div className="w-9" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar backdrop for mobile */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-900 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:relative md:flex transition-transform duration-300 ease-in-out shrink-0`}>
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold tracking-tight text-[#FF0000]">DIA SCHREIBEN</h1>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="md:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                aria-label="Fermer le menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* User Session and Cloud Sync */}
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
                  className={
                    "w-full text-left p-4 rounded-xl border transition-all " +
                    (selectedId === ex.id && !isUploading
                      ? 'bg-white dark:bg-gray-800 border-[#FF0000] shadow-sm'
                      : 'bg-transparent border-transparent hover:bg-gray-200/50 dark:hover:bg-gray-800/50')
                  }
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
