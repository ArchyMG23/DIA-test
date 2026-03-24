import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  vocabulary: string;
  structure: string;
  connectors: string;
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

  const response = await ai.models.generateContent({
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
    1. Correction grammaticale (Grammatik)
    2. Vocabulaire niveau B2 (Wortschatz)
    3. Structure de la lettre (Aufbau)
    4. Connecteurs logiques (Verknüpfungsmittel)
    5. Feedback global et note estimée (ex: "Bon travail, niveau B2 atteint").
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER, description: "Note estimée sur 100" },
          grammar: { type: Type.STRING, description: "Feedback sur la grammaire" },
          vocabulary: { type: Type.STRING, description: "Feedback sur le vocabulaire B2" },
          structure: { type: Type.STRING, description: "Feedback sur la structure" },
          connectors: { type: Type.STRING, description: "Feedback sur les connecteurs" },
          overallFeedback: { type: Type.STRING, description: "Feedback global" },
        },
        required: ["score", "grammar", "vocabulary", "structure", "connectors", "overallFeedback"],
      },
    },
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    console.error("Failed to parse evaluation", e);
    throw new Error("Failed to evaluate");
  }
}
