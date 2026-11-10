import { useRef, useState } from 'react';
import { useTitle } from '../components/Common';
import { useI18n } from '../i18n';
import { exportState, importState, resetState, useStore } from '../store';

export function DataPage() {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const cards = useStore((s) => Object.keys(s.srs).length);
  const own = useStore((s) => Object.values(s.local).reduce((sum, list) => sum + list.length, 0));
  const decks = useStore((s) => s.decks.length);
  useTitle(t('data.title'));

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportState()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `zdaj-pja-${new Date().toLocaleDateString('sv')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const load = async (file: File | undefined) => {
    if (!file || !confirm(t('data.importConfirm'))) return;
    try {
      importState(await file.text());
      setMessage(t('data.imported'));
    } catch {
      setMessage(t('data.bad'));
    }
  };

  return (
    <div className="narrow stack">
      <header>
        <h1>{t('data.title')}</h1>
        <p className="lead">{t('data.lead')}</p>
      </header>
      <div className="panel">
        <div className="stats">
          <div><b>{cards}</b><span>{t('data.cards')}</span></div>
          <div><b>{own}</b><span>{t('data.own')}</span></div>
          <div><b>{decks}</b><span>{t('data.decks')}</span></div>
        </div>
        <div className="row">
          <button type="button" className="btn primary" onClick={download}>{t('data.export')}</button>
          <button type="button" className="btn" onClick={() => input.current?.click()}>{t('data.import')}</button>
          <button type="button" className="btn bad" onClick={() => { if (confirm(t('data.resetConfirm'))) resetState(); }}>{t('data.reset')}</button>
          <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => { void load(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {message && <p role="status">{message}</p>}
      </div>
    </div>
  );
}
