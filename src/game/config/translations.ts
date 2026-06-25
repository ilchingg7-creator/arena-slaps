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
  "mainmenu.progression": { ru: "Прогрессия", en: "Progression" },

  // --- Progression ---
  "progression.title": { ru: "Прогрессия", en: "Progression" },
  "progression.level": { ru: "Уровень", en: "Level" },
  "progression.xp": { ru: "Опыт", en: "XP" },
  "progression.unlocks": { ru: "Открыто", en: "Unlocks" },
  "progression.maxLevel": { ru: "Максимальный уровень!", en: "Max level!" },
  "progression.back": { ru: "Назад", en: "Back" },

  // --- Unlock display names ---
  "unlock.bot-easy": { ru: "Бот: Лёгкий", en: "Bot: Easy" },
  "unlock.bot-medium": { ru: "Бот: Средний", en: "Bot: Medium" },
  "unlock.bot-hard": { ru: "Бот: Сложный", en: "Bot: Hard" },
  "unlock.arena-default": { ru: "Карта: Базовая", en: "Map: Default" },
  "unlock.arena-neon": { ru: "Карта: Неон", en: "Map: Neon" },
  "unlock.arena-cosmic": { ru: "Карта: Космос", en: "Map: Cosmic" },
  "unlock.arena-volcano": { ru: "Карта: Вулкан", en: "Map: Volcano" },
  "unlock.arena-ice": { ru: "Карта: Лёд", en: "Map: Ice" },
  "unlock.arena-grass": { ru: "Карта: Трава", en: "Map: Grass" },
  "unlock.all-maps": { ru: "Все карты", en: "All Maps" },
  "unlock.title-rookie": { ru: "Титул: Новичок", en: "Title: Rookie" },
  "unlock.title-fighter": { ru: "Титул: Боец", en: "Title: Fighter" },
  "unlock.title-master": { ru: "Титул: Мастер", en: "Title: Master" },
  "unlock.title-champion": { ru: "Титул: Чемпион", en: "Title: Champion" },
  "unlock.title-veteran": { ru: "Титул: Ветеран", en: "Title: Veteran" },
  "unlock.title-legend": { ru: "Титул: Легенда", en: "Title: Legend" },

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
  "battlesetup.map": { ru: "Карта", en: "Map" },
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
  "battle.controls.1p": { ru: "Движение: WASD / Стрелки   |   Шлёпок: Пробел или клик   |   Пауза: Esc", en: "Move: WASD / Arrows   |   Slap: Space or click   |   Pause: Esc" },
  "battle.controls.2p": { ru: "И1: WASD + Пробел   |   И2: Стрелки + Enter   |   Пауза: Esc", en: "P1: WASD + Space   |   P2: Arrows + Enter   |   Pause: Esc" },
  "battle.draw": { ru: "Ничья", en: "Draw" },
  "battle.playerWins": { ru: "Победил игрок", en: "Player wins" },
  "battle.botWins": { ru: "Бот победил", en: "Bot wins" },
  "battle.p1Wins": { ru: "И1 победил", en: "P1 wins" },
  "battle.p2Wins": { ru: "И2 победил", en: "P2 wins" },

  // --- Results ---
  "results.title": { ru: "Результаты матча", en: "Match Results" },
  "results.back": { ru: "В главное меню", en: "Back to menu" },
  "results.doubleXp": { ru: "×2 Опыт (Реклама)", en: "×2 XP (Watch Ad)" },
  "results.noResult": { ru: "Результатов пока нет.", en: "No result stored yet." },
  "results.score": { ru: "Счёт", en: "Score" },
  "results.rounds": { ru: "Раундов", en: "Rounds" },
  "results.powerUps": { ru: "Усилений", en: "Power-ups" },
  "results.wins": { ru: "победил", en: "wins" },
  "results.xp": { ru: "Опыт", en: "XP" },
  "results.level": { ru: "Уровень", en: "Level" },
  "results.levelUp": { ru: "Новый уровень!", en: "Level up!" },
  "results.newUnlocks": { ru: "открыто", en: "new" },
  "results.achievementUnlocked": { ru: "Достижение открыто", en: "Achievement unlocked" },
  "battle.player": { ru: "Игрок", en: "Player" },
  "battle.bot": { ru: "Бот", en: "Bot" },
  "battle.p1": { ru: "И1", en: "P1" },
  "battle.p2": { ru: "И2", en: "P2" },

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

  // --- Maps ---
  "map.default": { ru: "Базовая арена", en: "Default Arena" },
  "map.default.desc": { ru: "Классическая арена для начинающих", en: "Classic arena for beginners" },
  "map.neon": { ru: "Неоновая арена", en: "Neon Arena" },
  "map.neon.desc": { ru: "Яркие неоновые огни", en: "Bright neon lights" },
  "map.cosmic": { ru: "Космическая арена", en: "Cosmic Arena" },
  "map.cosmic.desc": { ru: "Среди звёзд и туманностей", en: "Among stars and nebulae" },
  "map.volcano": { ru: "Вулканическая арена", en: "Volcano Arena" },
  "map.volcano.desc": { ru: "У жерла вулкана", en: "At the volcano's mouth" },
  "map.ice": { ru: "Ледяная арена", en: "Ice Arena" },
  "map.ice.desc": { ru: "Скользкий лёд и мороз", en: "Slippery ice and frost" },
  "map.grass": { ru: "Травяная арена", en: "Grass Arena" },
  "map.grass.desc": { ru: "Зелёные просторы", en: "Green fields" },

  // --- Achievements ---
  "mainmenu.achievements": { ru: "Достижения", en: "Achievements" },
  "achievements.title": { ru: "Достижения", en: "Achievements" },
  "achievements.back": { ru: "Назад", en: "Back" },
  "achievements.unlocked": { ru: "Открыто", en: "Unlocked" },
  "achievements.locked": { ru: "Закрыто", en: "Locked" },
  "achievement.first_blood.name": { ru: "Первая кровь", en: "First Blood" },
  "achievement.first_blood.desc": { ru: "Выиграй первый бой", en: "Win your first battle" },
  "achievement.first_loss.name": { ru: "Первый синяк", en: "First Bruise" },
  "achievement.first_loss.desc": { ru: "Проиграй первый бой", en: "Lose your first battle" },
  "achievement.streak_5.name": { ru: "Непобедимый", en: "Unstoppable" },
  "achievement.streak_5.desc": { ru: "Выиграй 5 боёв подряд", en: "Win 5 battles in a row" },
  "achievement.comeback_king.name": { ru: "Король камбэков", en: "Comeback King" },
  "achievement.comeback_king.desc": { ru: "Выиграй, проигрывая 0-3", en: "Win after being down 0-3" },
  "achievement.flawless.name": { ru: "Безупречный", en: "Flawless" },
  "achievement.flawless.desc": { ru: "Выиграй 5-0", en: "Win 5-0" },
  "achievement.speed_demon.name": { ru: "Скоростной демон", en: "Speed Demon" },
  "achievement.speed_demon.desc": { ru: "Выиграй за 30 секунд", en: "Win in under 30 seconds" },
  "achievement.power_collector.name": { ru: "Коллекционер", en: "Collector" },
  "achievement.power_collector.desc": { ru: "Собери 5 усилений за один бой", en: "Collect 5 power-ups in one battle" },
  "achievement.all_powerups.name": { ru: "Энциклопедист", en: "Encyclopedia" },
  "achievement.all_powerups.desc": { ru: "Собери все 6 типов усилений", en: "Collect all 6 power-up types" },
  "achievement.combo_5.name": { ru: "Мега-комбо", en: "Mega Combo" },
  "achievement.combo_5.desc": { ru: "Достигни комбо x5", en: "Reach combo x5" },
  "achievement.dodge_master.name": { ru: "Мастер уклонения", en: "Dodge Master" },
  "achievement.dodge_master.desc": { ru: "10 уклонений за один бой", en: "10 dodges in one battle" },
  "achievement.ringout_master.name": { ru: "Мастер выбивания", en: "Ring-out Master" },
  "achievement.ringout_master.desc": { ru: "Выбей 100 противников всего", en: "100 total ring-outs inflicted" },
  "achievement.first_flight.name": { ru: "Первый полёт", en: "First Flight" },
  "achievement.first_flight.desc": { ru: "Будь выбит впервые", en: "Get knocked out for the first time" },
  "achievement.survivor.name": { ru: "Выживший", en: "Survivor" },
  "achievement.survivor.desc": { ru: "Будь выбит 3 раза за бой и выиграй", en: "Get knocked out 3x in one battle AND win" },
  "achievement.level_5.name": { ru: "Половина пути", en: "Halfway There" },
  "achievement.level_5.desc": { ru: "Достигни 5 уровня", en: "Reach level 5" },
  "achievement.level_10.name": { ru: "Максимум", en: "Maxed Out" },
  "achievement.level_10.desc": { ru: "Достигни 10 уровня", en: "Reach level 10" },
  "achievement.all_maps.name": { ru: "Исследователь", en: "Explorer" },
  "achievement.all_maps.desc": { ru: "Играй на всех 6 картах", en: "Play on all 6 maps" },
  "achievement.social.name": { ru: "Дуэлянт", en: "Duelist" },
  "achievement.social.desc": { ru: "Сыграй 10 боёв в 2P режиме", en: "Play 10 battles in 2P mode" },
  "achievement.veteran.name": { ru: "Ветеран", en: "Veteran" },
  "achievement.veteran.desc": { ru: "Сыграй 50 боёв всего", en: "Play 50 battles total" },

  // --- Cosmetics UI ---
  "cosmetics.title": { ru: "Внешний вид", en: "Appearance" },
  "cosmetics.category.color": { ru: "Цвет", en: "Color" },
  "cosmetics.category.outline": { ru: "Обводка", en: "Outline" },
  "cosmetics.category.trail": { ru: "След", en: "Trail" },
  "cosmetics.category.slapFx": { ru: "Эффект слэпа", en: "Slap FX" },
  "cosmetics.category.title": { ru: "Титул", en: "Title" },
  "cosmetics.category.powerUpSkin": { ru: "Скин усилений", en: "Power-up Skin" },
  "cosmetics.category.headwear": { ru: "Головной убор", en: "Headwear" },
  "cosmetics.locked": { ru: "Откроется на уровне", en: "Unlocks at level" },
  "cosmetics.p2Free": { ru: "2P: бесплатно", en: "2P: free" },
  "cosmetics.equipped": { ru: "Надето", en: "Equipped" },
  "cosmetics.player1": { ru: "Игрок 1", en: "Player 1" },
  "cosmetics.player2": { ru: "Игрок 2", en: "Player 2" },

  // --- Cosmetic names (colors) ---
  "cosmetic.color.navy": { ru: "Тёмно-синий", en: "Navy" },
  "cosmetic.color.orange": { ru: "Оранжевый", en: "Orange" },
  "cosmetic.color.crimson": { ru: "Багровый", en: "Crimson" },
  "cosmetic.color.emerald": { ru: "Изумрудный", en: "Emerald" },
  "cosmetic.color.gold": { ru: "Золотой", en: "Gold" },
  "cosmetic.color.sky": { ru: "Небесный", en: "Sky" },
  "cosmetic.color.violet": { ru: "Фиолетовый", en: "Violet" },
  "cosmetic.color.magenta": { ru: "Маджента", en: "Magenta" },
  "cosmetic.color.mint": { ru: "Мятный", en: "Mint" },
  "cosmetic.color.coral": { ru: "Коралловый", en: "Coral" },
  "cosmetic.color.2p-azure": { ru: "Лазурный (2P)", en: "Azure (2P)" },

  // --- Cosmetic names (outlines) ---
  "cosmetic.outline.none": { ru: "Нет", en: "None" },
  "cosmetic.outline.white": { ru: "Белый", en: "White" },
  "cosmetic.outline.cyan": { ru: "Голубой", en: "Cyan" },

  // --- Cosmetic names (trails) ---
  "cosmetic.trail.none": { ru: "Нет", en: "None" },
  "cosmetic.trail.dust": { ru: "Пыль", en: "Dust" },
  "cosmetic.trail.sparkle": { ru: "Искры", en: "Sparkle" },

  // --- Cosmetic names (slap FX) ---
  "cosmetic.slapfx.none": { ru: "Нет", en: "None" },
  "cosmetic.slapfx.star": { ru: "Звёзды", en: "Star Burst" },
  "cosmetic.slapfx.lightning": { ru: "Молния", en: "Lightning" },

  // --- Cosmetic names (titles) — mirror the progression titles ---
  "cosmetic.title.none": { ru: "Нет", en: "None" },
  "cosmetic.title.rookie": { ru: "Новичок", en: "Rookie" },
  "cosmetic.title.fighter": { ru: "Боец", en: "Fighter" },
  "cosmetic.title.master": { ru: "Мастер", en: "Master" },
  "cosmetic.title.champion": { ru: "Чемпион", en: "Champion" },
  "cosmetic.title.veteran": { ru: "Ветеран", en: "Veteran" },
  "cosmetic.title.legend": { ru: "Легенда", en: "Legend" },

  // --- Cosmetic names (power-up skins) ---
  "cosmetic.powerupskin.default": { ru: "По умолчанию", en: "Default" },
  "cosmetic.powerupskin.rounded": { ru: "Округлый", en: "Rounded" },

  // --- Cosmetic names (headwear) ---
  "cosmetic.headwear.none": { ru: "Нет", en: "None" },
  "cosmetic.headwear.cap": { ru: "Кепка", en: "Cap" },
  "cosmetic.headwear.crown": { ru: "Корона", en: "Crown" },
  "cosmetic.headwear.horns": { ru: "Рога", en: "Horns" },
  "cosmetic.headwear.halo": { ru: "Нимб", en: "Halo" },
  "cosmetic.headwear.helmet": { ru: "Шлем", en: "Helmet" },
  "cosmetic.headwear.2p-party-hat": { ru: "Колпак (2P)", en: "Party Hat (2P)" },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS;
