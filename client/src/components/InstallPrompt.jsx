import { useEffect, useState } from 'react';

function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setVisible(false);
    }
  }, []);

  async function install() {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    setVisible(false);
  }

  if (!visible || !installEvent) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/20">
      <div className="flex items-center gap-3">
        <img src="/icon.svg" alt="Kanhaiya Gold" className="h-12 w-12 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-slate-900">Install Kanhaiya Gold</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">Open it like an app from your home screen — no browser bar.</p>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="h-9 w-9 shrink-0 rounded-xl bg-slate-100 text-sm font-bold text-slate-500"
          aria-label="Dismiss install prompt"
        >
          ×
        </button>
      </div>
      <button
        type="button"
        onClick={install}
        className="mt-3 h-11 w-full rounded-2xl bg-indigo-600 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/20"
      >
        📲 Install App
      </button>
    </div>
  );
}

export default InstallPrompt;
