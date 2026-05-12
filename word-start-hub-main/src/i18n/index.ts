import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import pt from './locales/pt.json';
import en from './locales/en.json';
import es from './locales/es.json';
import ru from './locales/ru.json';
import ko from './locales/ko.json';
import ja from './locales/ja.json';
import ar from './locales/ar.json';

export const LANGUAGES = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
] as const;

export type LanguageCode = typeof LANGUAGES[number]['code'];

// Get saved language from localStorage as fallback
const savedLang = localStorage.getItem('user_language') || 'pt';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: pt },
      en: { translation: en },
      es: { translation: es },
      ru: { translation: ru },
      ko: { translation: ko },
      ja: { translation: ja },
      ar: { translation: ar },
    },
    lng: savedLang,
    fallbackLng: 'pt',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
