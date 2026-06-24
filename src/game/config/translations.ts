/**
 * i18n strings for Arena Slaps.
 *
 * Single source of truth for every user-visible string. Each key maps to a
 * `{ ru, en }` pair. Lookups go through {@link translate} which falls back to
 * English if the active language lacks a key, then to the key itself if the
 * key is entirely missing (so missing translations show up as the key string
 * rather than crashing the UI).
 *
 * Adding a new string:
 *   1. Add a key with `{ ru, en }` to {@link TRANSLATIONS} below.
 *   2. Use `translate(t, "your.key", lang)` at the call site.
 */

export type Language = "ru" | "en";

export type TranslationEntry = {
  ru: string;
  en: string;
};

export type TranslationMap = Record<string, TranslationEntry>;

export const TRANSLATIONS: TranslationMap = {
  // --- Main menu ---
  "mainmenu.title": { ru: "Arena Slaps", en: "Arena Slaps" },
  "mainmenu.tagline": {
    ru: "Залетай, давай пощёчину, повторяй.",
    en: "Load-in, slap in, repeat.",
  },
  "mainmenu.start": { ru: "Начать", en: "Start" },
  "mainmenu.loading": { ru: "Загрузка...", en: "Loading..." },
  "mainmenu.mode": { ru: "Режим", en: "Mode" },
  "mainmenu.difficulty": { ru: "Сложность бота", en: "Bot Difficulty" },
  "mainmenu.round_length": { ru: "Длина раунда", en: "Round Length" },
  "mainmenu.win_score": { ru: "Очки победы", en: "Win Score" },
  "mainmenu.volume": { ru: "Громкость", en: "Volume" },
  "mainmenu.mute": { ru: "Без звука", en: "Mute" },
  "mainmenu.achievements": { ru: "Достижения", en: "Achievements" },

  // --- Achievements scene ---
  "achievements.title": { ru: "Достижения", en: "Achievements" },
  "achievements.back": { ru: "Назад", en: "Back" },
  "achievements.unlocked": { ru: "Открыто", en: "Unlocked" },
  "achievements.locked": { ru: "Закрыто", en: "Locked" },

  // --- Achievement name + desc (18 × 2 = 36 keys) ---
  "achievement.first_blood.name": { ru: "Первая кровь", en: "First Blood" },
  "achievement.first_blood.desc": {
    ru: "Выиграй первый бой",
    en: "Win your first battle",
  },
  "achievement.first_loss.name": { ru: "Первый синяк", en: "First Bruise" },
  "achievement.first_loss.desc": {
    ru: "Проиграй первый бой",
    en: "Lose your first battle",
  },
  "achievement.streak_5.name": { ru: "Непобедимый", en: "Unstoppable" },
  "achievement.streak_5.desc": {
    ru: "Победи 5 раз подряд",
    en: "Win 5 battles in a row",
  },
  "achievement.comeback_king.name": {
    ru: "Король камбэков",
    en: "Comeback King",
  },
  "achievement.comeback_king.desc": {
    ru: "Победи после счёта 0-3",
    en: "Win after being down 0-3",
  },
  "achievement.flawless.name": { ru: "Безупречный", en: "Flawless" },
  "achievement.flawless.desc": { ru: "Победи со счётом 5-0", en: "Win 5-0" },
  "achievement.speed_demon.name": {
    ru: "Скоростной демон",
    en: "Speed Demon",
  },
  "achievement.speed_demon.desc": {
    ru: "Победи быстрее, чем за 30 секунд",
    en: "Win in under 30 seconds",
  },
  "achievement.power_collector.name": {
    ru: "Коллекционер",
    en: "Collector",
  },
  "achievement.power_collector.desc": {
    ru: "Собери 5 бонусов за один бой",
    en: "Collect 5 power-ups in one battle",
  },
  "achievement.all_powerups.name": {
    ru: "Энциклопедист",
    en: "Encyclopedia",
  },
  "achievement.all_powerups.desc": {
    ru: "Собери все 6 типов бонусов",
    en: "Collect all 6 power-up types",
  },
  "achievement.combo_5.name": { ru: "Мега-комбо", en: "Mega Combo" },
  "achievement.combo_5.desc": {
    ru: "Достигни комбо x5",
    en: "Reach combo x5",
  },
  "achievement.dodge_master.name": {
    ru: "Мастер уклонения",
    en: "Dodge Master",
  },
  "achievement.dodge_master.desc": {
    ru: "10 уклонений за один бой",
    en: "10 dodges in one battle",
  },
  "achievement.ringout_master.name": {
    ru: "Мастер выбивания",
    en: "Ring-out Master",
  },
  "achievement.ringout_master.desc": {
    ru: "100 выбиваний за карьеру",
    en: "100 total ring-outs inflicted",
  },
  "achievement.first_flight.name": {
    ru: "Первый полёт",
    en: "First Flight",
  },
  "achievement.first_flight.desc": {
    ru: "Будь выбит впервые",
    en: "Get knocked out for the first time",
  },
  "achievement.survivor.name": { ru: "Выживший", en: "Survivor" },
  "achievement.survivor.desc": {
    ru: "Будь выбит 3 раза за бой и победи",
    en: "Get knocked out 3x in one battle AND win",
  },
  "achievement.level_5.name": { ru: "Половина пути", en: "Halfway There" },
  "achievement.level_5.desc": {
    ru: "Достигни 5 уровня",
    en: "Reach level 5",
  },
  "achievement.level_10.name": { ru: "Максимум", en: "Maxed Out" },
  "achievement.level_10.desc": {
    ru: "Достигни 10 уровня",
    en: "Reach level 10",
  },
  "achievement.all_maps.name": { ru: "Исследователь", en: "Explorer" },
  "achievement.all_maps.desc": {
    ru: "Сыграй на всех 6 картах",
    en: "Play on all 6 maps",
  },
  "achievement.social.name": { ru: "Дуэлянт", en: "Duelist" },
  "achievement.social.desc": {
    ru: "Сыграй 10 боёв в режиме 2P",
    en: "Play 10 battles in 2P mode",
  },
  "achievement.veteran.name": { ru: "Ветеран", en: "Veteran" },
  "achievement.veteran.desc": {
    ru: "Сыграй 50 боев всего",
    en: "Play 50 battles total",
  },
};

/**
 * Resolve a translation key to a localized string. Falls back to English if
 * the active language lacks the key, then to the key itself if the key is
 * entirely missing from the map (so the UI never throws on a typo).
 */
export function translate(
  key: string,
  lang: Language = "en",
): string {
  const entry = TRANSLATIONS[key];
  if (!entry) {
    return key;
  }
  if (lang === "ru") {
    return entry.ru;
  }
  return entry.en;
}

/** Get the list of all translation keys (used to validate coverage). */
export function getTranslationKeys(): readonly string[] {
  return Object.keys(TRANSLATIONS);
}
