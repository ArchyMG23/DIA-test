import { GoogleGenAI, Type } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("Clé API Gemini manquante. Veuillez configurer la variable d'environnement GEMINI_API_KEY.");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

export interface Exercise {
  id: string;
  title: string;
  situation: string;
  content: string;
  type: string;
}

export interface Evaluation {
  score: number;
  grammar: string;
  grammarScore: number;
  vocabulary: string;
  vocabularyScore: number;
  structure: string;
  structureScore: number;
  connectors: string;
  connectorsScore: number;
  overallFeedback: string;
}

export async function extractExercises(fileData: string, mimeType: string): Promise<Exercise[]> {
  const prompt = `
    Tu es un expert du test d'allemand Telc B2.
    Analyse le document fourni et extrais uniquement les sujets d'expression écrite (Schreiben).
    Ces sujets concernent généralement des lettres de réclamation (Beschwerdebrief), des demandes d'informations (Bitte um Informationen), ou des lettres de candidature (Bewerbung).
    
    Pour chaque exercice trouvé, fournis :
    - Un titre clair (ex: "Beschwerdebrief: Sprachreise")
    - La situation ou l'offre intégrale (le texte de base, l'annonce, ou le contexte de la lettre).
    - Le contenu de la consigne (les points spécifiques à traiter dans la lettre).
    - Le type de lettre (ex: "Beschwerde", "Information", "Bewerbung").
  `;

  const response = await getAiClient().models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            data: fileData,
            mimeType: mimeType,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Un identifiant unique (ex: ex-1)" },
            title: { type: Type.STRING, description: "Titre de l'exercice" },
            situation: { type: Type.STRING, description: "La situation de base ou l'offre intégrale" },
            content: { type: Type.STRING, description: "Consigne complète de l'exercice et points à traiter" },
            type: { type: Type.STRING, description: "Type de lettre" },
          },
          required: ["id", "title", "situation", "content", "type"],
        },
      },
    },
  });

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Failed to parse exercises", e);
    return [];
  }
}

export async function evaluateWriting(exercise: Exercise, userText: string): Promise<Evaluation> {
  const prompt = `
    Tu es un examinateur officiel du test d'allemand Telc B2.
    Évalue la rédaction suivante en fonction de la situation et de la consigne données.
    
    Situation / Offre :
    """
    ${exercise.situation}
    """
    
    Consigne de l'exercice :
    """
    ${exercise.content}
    """
    
    Rédaction de l'étudiant :
    """
    ${userText}
    """
    
    Fournis une évaluation détaillée et constructive en français, structurée selon les critères du Telc B2 :
    1. Grammaire (Grammatik): Précision et complexité (B2 attend une bonne maîtrise des structures complexes). Score /25.
    2. Vocabulaire (Wortschatz): Variété et adéquation au thème (B2 attend un lexique riche et des expressions idiomatiques). Score /25.
    3. Structure de la lettre (Aufbau): Respect des codes de la lettre (date, objet, salutations, conclusion). Score /25.
    4. Connecteurs logiques (Verknüpfungsmittel): Fluidité et cohérence de l'argumentation. Score /25.
    5. Feedback global et note finale sur 100.

    IMPORTANT: Retourne UNIQUEMENT un objet JSON valide correspondant au schéma demandé.
  `;

  try {
    const response = await getAiClient().models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "Note globale sur 100" },
            grammar: { type: Type.STRING, description: "Feedback détaillé grammaire" },
            grammarScore: { type: Type.NUMBER, description: "Note grammaire /25" },
            vocabulary: { type: Type.STRING, description: "Feedback détaillé vocabulaire" },
            vocabularyScore: { type: Type.NUMBER, description: "Note vocabulaire /25" },
            structure: { type: Type.STRING, description: "Feedback détaillé structure" },
            structureScore: { type: Type.NUMBER, description: "Note structure /25" },
            connectors: { type: Type.STRING, description: "Feedback détaillé connecteurs" },
            connectorsScore: { type: Type.NUMBER, description: "Note connecteurs /25" },
            overallFeedback: { type: Type.STRING, description: "Synthèse globale" },
          },
          required: [
            "score", "grammar", "grammarScore", "vocabulary", "vocabularyScore", 
            "structure", "structureScore", "connectors", "connectorsScore", "overallFeedback"
          ],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Le modèle n'a renvoyé aucun contenu. Cela peut être dû à un filtre de sécurité ou à une erreur interne.");
    }

    try {
      const result = JSON.parse(text);
      // Ensure score is a number
      if (typeof result.score === 'string') {
        result.score = parseInt(result.score, 10) || 0;
      }
      return result;
    } catch (parseError) {
      console.error("JSON Parse Error. Raw text:", text);
      throw new Error("Le format de la réponse de l'IA est invalide. Veuillez réessayer.");
    }
  } catch (e: any) {
    console.error("Evaluation error details:", e);
    
    // Handle specific API errors
    if (e.message?.includes("429") || e.message?.includes("quota")) {
      throw new Error("Limite de requêtes atteinte (Quota exceeded). Veuillez réessayer dans une minute.");
    }
    if (e.message?.includes("API key not valid")) {
      throw new Error("La clé API configurée est invalide. Vérifiez vos variables d'environnement.");
    }
    if (e.message?.includes("safety") || e.message?.includes("blocked")) {
      throw new Error("Le contenu a été bloqué par les filtres de sécurité de l'IA. Essayez de reformuler votre texte.");
    }
    
    throw new Error(e.message || "Erreur lors de la communication avec l'IA.");
  }
}
