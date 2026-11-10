import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/figtree';
import '@fontsource-variable/jetbrains-mono';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { I18nProvider } from './i18n';
import { AddMaterialPage } from './pages/AddMaterialPage';
import { AddPage } from './pages/AddPage';
import { CoursePage } from './pages/CoursePage';
import { DataPage } from './pages/DataPage';
import { GeneratePage } from './pages/GeneratePage';
import { HomePage } from './pages/HomePage';
import { NotFound } from './pages/NotFound';
import { StudyPage } from './pages/StudyPage';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="c/:courseId" element={<CoursePage />} />
            <Route path="c/:courseId/study/:mode" element={<StudyPage />} />
            <Route path="c/:courseId/generate" element={<GeneratePage />} />
            <Route path="add" element={<AddPage />} />
            <Route path="add-material" element={<AddMaterialPage />} />
            <Route path="data" element={<DataPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </I18nProvider>
  </StrictMode>,
);
