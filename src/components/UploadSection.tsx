import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2 } from 'lucide-react';

interface UploadSectionProps {
  onUpload: (fileData: string, mimeType: string) => void;
  isExtracting: boolean;
  isOnline: boolean;
}

export function UploadSection({ onUpload, isExtracting, isOnline }: UploadSectionProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (!isOnline) return;
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extract base64 data
      const base64Data = result.split(',')[1];
      onUpload(base64Data, file.type);
    };
    reader.readAsDataURL(file);
  }, [onUpload, isOnline]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png']
    },
    maxFiles: 1,
    disabled: isExtracting || !isOnline
  });

  return (
    <div className="max-w-2xl mx-auto w-full p-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Schreiben</h1>
        <p className="text-lg text-gray-500 dark:text-gray-400">
          Uploadez un sujet Telc B2 (PDF ou Image) pour commencer l'entraînement.
        </p>
      </div>

      <div 
        {...getRootProps()} 
        className={`
          border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200
          ${!isOnline ? 'border-gray-300 bg-gray-100 opacity-60 cursor-not-allowed' : isDragActive ? 'border-[#FF0000] bg-[#FF0000]/5 cursor-pointer' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 cursor-pointer'}
          ${isExtracting ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center justify-center gap-4">
          {!isOnline ? (
            <>
              <div className="p-4 bg-gray-200 dark:bg-gray-800 rounded-full">
                <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <div>
                <p className="text-lg font-medium mb-1 text-gray-500">
                  Connexion internet requise
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Vous devez être en ligne pour analyser un nouveau document.
                </p>
              </div>
            </>
          ) : isExtracting ? (
            <>
              <Loader2 className="w-12 h-12 text-[#FF0000] animate-spin" />
              <p className="text-lg font-medium">Analyse du document en cours...</p>
              <p className="text-sm text-gray-500">L'IA extrait les sujets d'expression écrite.</p>
            </>
          ) : (
            <>
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full">
                <Upload className="w-8 h-8 text-gray-600 dark:text-gray-300" />
              </div>
              <div>
                <p className="text-lg font-medium mb-1">
                  {isDragActive ? "Déposez le fichier ici" : "Glissez-déposez votre fichier ici"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ou cliquez pour parcourir (PDF, JPG, PNG)
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
