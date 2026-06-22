export type Language = "ru" | "en";

export const LANGUAGES: readonly Language[] = ["ru", "en"];

export const DEFAULT_LANGUAGE: Language = "ru";

/**
 * All UI strings for both languages. Edit values here to change text
 * without touching scene code. Keys are namespaced by scene/feature.
 *
 * To add a new string:
 *   1. Add a key to the `TranslationKey` union type.
 *   2. Add the key with RU + EN values to TRANSLATIONS.
 *   3. Use t("key") in the scene code.
 */
export const TRANSLATIONS = {
  // --- MainMenu ---
  "mainmenu.title": { ru: "Arena Slaps", en: "Arena Slaps" },
  "mainmenu.tagline": { ru: "Заходи, шлёпай, повторяй.", en: "Load-in, slap in, repeat." },
  "mainmenu.start": { ru: "Начать", en: "Start" },
  "mainmenu.profile": { ru: "Профиль", en: "Profile" },
  "mainmenu.audioSettings": { ru: "Настройки звука", en: "Audio Settings" },

  // --- BattleSetup ---
  "battlesetup.title": { ru: "Настройка боя", en: "Battle Setup" },
  "battlesetup.mode": { ru: "Режим", en: "Mode" },
  "battlesetup.mode.1p": { ru: "1И против бота", en: "1P vs Bot" },
  "battlesetup.mode.2p": { ru: "2И локально", en: "2P Local" },
  "battlesetup.botDifficulty": { ru: "Сложность бота", en: "Bot Difficulty" },
  "battlesetup.difficulty.easy": { ru: "Лёгкий", en: "Easy" },
  "battlesetup.difficulty.medium": { ru: "Средний", en: "Medium" },
  "battlesetup.difficulty.hard": { ru: "Сложный", en: "Hard" },
  "battlesetup.roundLength": { ru: "Длина раунда", en: "Round Length" },
  "battlesetup.winScore": { ru: "Очки для победы", en: "Win Score" },
  "battlesetup.startBattle": { ru: "Начать бой", en: "Start Battle" },
  "battlesetup.back": { ru: "Назад", en: "Back" },
  "battlesetup.loading": { ru: "Загрузка...", en: "Loading..." },

  // --- AudioSettings ---
  "audio.title": { ru: "Настройки звука", en: "Audio Settings" },
  "audio.sfxVolume": { ru: "Громкость SFX", en: "SFX Volume" },
  "audio.sfxMute": { ru: "Заглушить SFX", en: "SFX Mute" },
  "audio.musicVolume": { ru: "Громкость музыки", en: "Music Volume" },
  "audio.musicMute": { ru: "Заглушить музыку", en: "Music Mute" },
  "audio.muted": { ru: "Заглушено", en: "Muted" },
  "audio.on": { ru: "Вкл", en: "On" },
  "audio.back": { ru: "Назад", en: "Back" },

  // --- Profile ---
  "profile.title": { ru: "Профиль", en: "Profile" },
  "profile.nickname": { ru: "Никнейм", en: "Nickname" },
  "profile.totalGames": { ru: "Всего игр", en: "Total Games" },
  "profile.wins": { ru: "Побед", en: "Wins" },
  "profile.losses": { ru: "Поражений", en: "Losses" },
  "profile.draws": { ru: "Ничьих", en: "Draws" },
  "profile.winRate": { ru: "Процент побед", en: "Win Rate" },
  "profile.ringOutsInflicted": { ru: "Выбил с арены", en: "Ring Outs (Inflicted)" },
  "profile.ringOutsSuffered": { ru: "Выбит с арены", en: "Ring Outs (Suffered)" },
  "profile.powerUpsCollected": { ru: "Собрано усилений", en: "Power-ups Collected" },
  "profile.favoritePowerUp": { ru: "Любимое усиление", en: "Favorite Power-up" },
  "profile.favoriteMode": { ru: "Любимый режим", en: "Favorite Mode" },
  "profile.changeNickname": { ru: "Сменить ник", en: "Change Nickname" },
  "profile.resetStats": { ru: "Сбросить статистику", en: "Reset Stats" },
  "profile.back": { ru: "Назад", en: "Back" },
  "profile.changeNicknamePrompt": { ru: "Введите новый никнейм:", en: "Enter new nickname:" },
  "profile.resetConfirm": { ru: "Сбросить всю статистику? Это действие нельзя отменить.", en: "Reset all statistics? This cannot be undone." },
  "profile.nicknameBanned": { ru: "Этот никнейм содержит запрещённые слова. Выберите другой.", en: "This nickname contains banned words. Please choose another." },

  // --- Power-up display labels (used by ProfileScene favorite power-up row) ---
  "powerup.speed": { ru: "Ускорение", en: "Boost" },
  "powerup.knockback": { ru: "Тяжёлая рука", en: "Heavy Hand" },
  "powerup.shield": { ru: "Щит", en: "Shield" },
  "powerup.mega-knockback": { ru: "Мега-рука", en: "Mega Hand" },
  "powerup.freeze": { ru: "Заморозка", en: "Freeze" },
  "powerup.double-slap": { ru: "Двойной слэп", en: "Double Slap" },

  // --- Battle HUD ---
  "battle.time": { ru: "Время", en: "Time" },
  "battle.controls.1p": { ru: "Движение: WASD / Стрелки   Шлёпок: Пробел, клик по арене, или тап SLAP", en: "Move: WASD / Arrows   Slap: Space, click arena, or tap SLAP" },
  "battle.controls.2p": { ru: "И1: WASD + Пробел   |   И2: Стрелки + Enter   |   Шлёпок или тап SLAP", en: "P1: WASD + Space   |   P2: Arrows + Enter   |   Slap or tap SLAP" },
  "battle.draw": { ru: "Ничья", en: "Draw" },
  "battle.playerWins": { ru: "Победил игрок", en: "Player wins" },
  "battle.botWins": { ru: "Бот победил", en: "Bot wins" },
  "battle.p1Wins": { ru: "И1 победил", en: "P1 wins" },
  "battle.p2Wins": { ru: "И2 победил", en: "P2 wins" },

  // --- Results ---
  "results.title": { ru: "Результаты матча", en: "Match Results" },
  "results.back": { ru: "В главное меню", en: "Back to menu" },
  "results.noResult": { ru: "Результатов пока нет.", en: "No result stored yet." },
  "results.score": { ru: "Счёт", en: "Score" },
  "results.rounds": { ru: "Раундов", en: "Rounds" },
  "results.powerUps": { ru: "Усилений", en: "Power-ups" },

  // --- Pause menu ---
  "pause.title": { ru: "Пауза", en: "Paused" },
  "pause.resume": { ru: "Продолжить", en: "Resume" },
  "pause.settings": { ru: "Настройки", en: "Settings" },
  "pause.mainMenu": { ru: "Главное меню", en: "Main Menu" },
  "pause.settingsTitle": { ru: "Настройки", en: "Settings" },
  "pause.back": { ru: "Назад", en: "Back" },

  // --- Preload ---
  "preload.loading": { ru: "Загрузка...", en: "Loading..." },

  // --- TopRightMuteButton ---
  "mute.sound": { ru: "🔊 Звук", en: "🔊 Sound" },
  "mute.muted": { ru: "🔇 Заглушено", en: "🔇 Muted" },

  // --- Mode descriptions (for describeMode helper) ---
  "mode.1p-vs-bot": { ru: "1И против бота", en: "1P vs Bot" },
  "mode.2p-local": { ru: "2И локально", en: "2P Local" },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS;
