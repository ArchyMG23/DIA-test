import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

export function InstallPWA() {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setSupportsPWA(true);
      setPromptInstall(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const onClick = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.preventDefault();
    if (!promptInstall) {
      return;
    }
    promptInstall.prompt();
    promptInstall.userChoice.then((choiceResult: { outcome: string }) => {
      if (choiceResult.outcome === 'accepted') {
        setSupportsPWA(false);
      }
    });
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  if (!supportsPWA) {
    if (isIOS) {
      return (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-lg text-[10px] text-blue-600 dark:text-blue-400">
          <strong>iOS:</strong> Pour installer l'app, appuyez sur <span className="font-bold">Partager</span> puis <span className="font-bold">Sur l'écran d'accueil</span>.
        </div>
      );
    }
    return null;
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 px-4 py-2 mt-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium border border-gray-200 dark:border-gray-700"
      title="Installer l'application sur votre appareil"
    >
      <Download className="w-4 h-4" />
      Installer l'application
    </button>
  );
}