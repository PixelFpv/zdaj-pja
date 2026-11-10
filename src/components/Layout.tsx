import { Languages, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { REPO } from '../lib/github';
import { BASED_ON_LINKS, Linked } from './Common';

const THEME_KEY = 'zdaj-pja.theme';

const CREDIT_LINKS: Record<string, [string, string]> = {
  data: ['zdaj-se-pjatk-data', 'https://github.com/bibixx/zdaj-se-pjatk-data'],
  files: ['zdaj-se-pjatk-files', 'https://github.com/bibixx/zdaj-se-pjatk-files'],
  ccby: ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  ppj: ['PPJ-Quiz', 'https://github.com/PixelFpv/PPJ-Quiz'],
  mit: ['MIT', `https://github.com/${REPO}/blob/HEAD/LICENSE`],
};

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'light');
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* the choice just won't persist */
    }
  };
  return { theme, toggle };
}

export function Layout() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const { pathname, search } = useLocation();
  // Sessions hold state for one course and scope; a new URL must start a fresh one.
  // The course page is keyed by path alone so that switching tabs keeps it mounted.
  const pageKey = /\/(?:study|generate)/.test(pathname) ? pathname + search : pathname;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Link to="/" className="brand">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={30} height={30} />
            <span>Zdaj PJA</span>
          </Link>
          <nav className="nav">
            <NavLink to="/" end>{t('nav.courses')}</NavLink>
            <NavLink to="/add">{t('nav.add')}</NavLink>
            <NavLink to="/add-material">{t('nav.materials')}</NavLink>
            <NavLink to="/data">{t('nav.data')}</NavLink>
          </nav>
          <div className="topbar-tools">
            <button type="button" className="icon-btn" onClick={() => setLang(lang === 'pl' ? 'en' : 'pl')} title={t('lang.switch')} aria-label={t('lang.switch')}>
              <Languages size={17} aria-hidden /> <span>{lang === 'pl' ? 'EN' : 'PL'}</span>
            </button>
            <button type="button" className="icon-btn" onClick={toggle} title={t(theme === 'dark' ? 'theme.toLight' : 'theme.toDark')} aria-label={t(theme === 'dark' ? 'theme.toLight' : 'theme.toDark')}>
              {theme === 'dark' ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
            </button>
          </div>
        </div>
      </header>
      <main className="wrap main">
        <Outlet key={pageKey} />
      </main>
      <footer className="wrap footer">
        <p className="footer-based"><Linked text={t('about.based')} links={BASED_ON_LINKS} /></p>
        <p><Linked text={t('footer.credits')} links={CREDIT_LINKS} /></p>
        <p>{t('footer.local')}</p>
      </footer>
    </div>
  );
}
