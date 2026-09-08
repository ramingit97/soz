import type { ParentUILanguage } from '@soz/shared-types';

export interface Strings {
  common: {
    continue: string;
    back: string;
    skip: string;
    next: string;
    done: string;
    yes: string;
    no: string;
  };
  language: {
    pickPrompt: string;
    azLabel: string;
    ruLabel: string;
  };
  welcome: {
    title: string;
    subtitle: string;
    cta: string;
    haveAccount: string;
  };
  tour: {
    slide1Title: string;
    slide1Body: string;
    slide2Title: string;
    slide2Body: string;
    slide3Title: string;
    slide3Body: string;
    cta: string;
  };
  learningLanguages: {
    title: string;
    subtitle: string;
    onlyEnglish: string;
    onlyEnglishDesc: string;
    onlyRussian: string;
    onlyRussianDesc: string;
    both: string;
    bothDesc: string;
    bothBadge: string;
  };
}

const az: Strings = {
  common: {
    continue: 'Davam et',
    back: 'Geri',
    skip: 'Keç',
    next: 'Növbəti',
    done: 'Bitti',
    yes: 'Bəli',
    no: 'Xeyr',
  },
  language: {
    pickPrompt: 'Dilinizi seçin',
    azLabel: 'Azərbaycanca',
    ruLabel: 'Rus dili',
  },
  welcome: {
    title: 'Övladınız oyun zamanı\niki dil öyrənir',
    subtitle: 'AI-dostu Bobo ilə ingilis və rus dilləri.\nGündə 15 dəqiqə. Repetitordan 5 dəfə ucuz.',
    cta: 'Başlayaq',
    haveAccount: 'Artıq hesabım var',
  },
  tour: {
    slide1Title: 'Bobo — dost,\nmüəllim deyil',
    slide1Body: 'Övladınız robot Bobo ilə həqiqi söhbət edir. Sıxıcı dərslər yox, real ünsiyyət.',
    slide2Title: 'Hər iki dildə\nirəliləyiş',
    slide2Body: 'İngilis və rus dillərində nailiyyətləri ayrıca görəcəksiniz.',
    slide3Title: '7 gün pulsuz.\nKart lazım deyil.',
    slide3Body: 'Ödəmədən əvvəl bütün xüsusiyyətləri sınayın. İstənilən vaxt ləğv edin.',
    cta: 'Davam et',
  },
  learningLanguages: {
    title: 'Hansı dilləri\nöyrənəcək?',
    subtitle: 'Sonra dəyişə bilərsiniz',
    onlyEnglish: 'Yalnız ingilis',
    onlyEnglishDesc: 'Gələcək karyera və təhsil üçün',
    onlyRussian: 'Yalnız rus',
    onlyRussianDesc: 'Regional ünsiyyət və qohumlar üçün',
    both: 'Hər iki dil',
    bothDesc: 'Bir tətbiqdə paralel iki dil',
    bothBadge: 'Tövsiyə olunur',
  },
};

const ru: Strings = {
  common: {
    continue: 'Продолжить',
    back: 'Назад',
    skip: 'Пропустить',
    next: 'Далее',
    done: 'Готово',
    yes: 'Да',
    no: 'Нет',
  },
  language: {
    pickPrompt: 'Выберите язык',
    azLabel: 'Азербайджанский',
    ruLabel: 'Русский',
  },
  welcome: {
    title: 'Ваш ребёнок учит\nдва языка в игре',
    subtitle: 'Английский и русский с AI-другом Bobo.\n15 минут в день. В 5 раз дешевле репетитора.',
    cta: 'Начнём',
    haveAccount: 'У меня уже есть аккаунт',
  },
  tour: {
    slide1Title: 'Bobo — друг,\nа не учитель',
    slide1Body: 'Ребёнок ведёт настоящий диалог с роботом Bobo. Никаких скучных уроков, только живое общение.',
    slide2Title: 'Прогресс по\nдвум языкам',
    slide2Body: 'Видите успехи отдельно по английскому и русскому. Каждое выученное слово — на видном месте.',
    slide3Title: '7 дней бесплатно.\nКарта не нужна.',
    slide3Body: 'Попробуйте все функции до оплаты. Отмените в любой момент в один клик.',
    cta: 'Дальше',
  },
  learningLanguages: {
    title: 'Какие языки\nбудем учить?',
    subtitle: 'Можно изменить позже',
    onlyEnglish: 'Только английский',
    onlyEnglishDesc: 'Для будущей карьеры и образования',
    onlyRussian: 'Только русский',
    onlyRussianDesc: 'Для общения с роднёй и регионом',
    both: 'Оба языка',
    bothDesc: 'Параллельные дорожки в одном приложении',
    bothBadge: 'Рекомендуется',
  },
};

const STRINGS: Record<ParentUILanguage, Strings> = { az, ru };

export function getStrings(lang: ParentUILanguage): Strings {
  return STRINGS[lang];
}
