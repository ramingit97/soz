# Söz — App Store & Google Play Metadata

## App Info

| Field | Value |
|-------|-------|
| App Name | Söz — Learn Azerbaijani |
| Bundle ID (iOS) | az.soz.app |
| Package (Android) | az.soz.app |
| Version | 1.0.0 |
| Category | Education |
| Age Rating | 4+ |
| Price | Free (in-app purchase) |

---

## App Store (iOS)

### Short Description (30 chars)
```
AI language tutor for kids
```

### Subtitle (30 chars)
```
Azerbaijani with Bobo the Owl
```

### Description (4000 chars max)
```
Söz helps children aged 8–12 learn Azerbaijani and English through daily AI-powered conversations with Bobo, a friendly animated character.

🎯 30 DAYS TO FLUENCY
Each day unlocks a new theme — from greetings and family to school and nature. Bite-sized 15-minute lessons fit into any schedule.

🗣️ TALK WITH BOBO
Bobo listens, understands, and responds to your child in real time. Our AI detects mistakes gently and keeps kids engaged with encouragement.

🎮 GRAMMAR QUESTS
Fun fill-in-the-blank and word ordering games make grammar stick without feeling like homework.

⭐ STAR MAP & STREAKS
Kids earn stars every lesson and build streaks for daily learning. The visual star map shows exactly how far they've come.

📱 DESIGNED FOR FAMILIES
Parents get their own dashboard showing progress, streaks, and activity. Set a daily reminder and your child never misses a lesson.

🆓 FREE TO START
The first 7 days are completely free — no credit card required. Upgrade to Söz Premium to unlock all 30 days.

Languages: Azerbaijani (az), Russian (ru) as instruction language
```

### Keywords (100 chars, comma-separated)
```
azerbaijani,language learning,kids,children,AI tutor,english,vocabulary,education,bilingual
```

### Privacy Policy URL
```
https://YOUR-DOMAIN/privacy
```

### Support URL
```
https://YOUR-DOMAIN/support
```

### Marketing URL
```
https://YOUR-DOMAIN/soz
```

---

## Google Play

### Short Description (80 chars)
```
AI-powered Azerbaijani language tutor for children aged 8–12
```

### Full Description (4000 chars)
*(Same as App Store description above — adapt as needed)*

### Content Rating
- ESRB: Everyone
- PEGI: 3+

---

## In-App Purchase Products

Configure these in both App Store Connect and Google Play Console:

| ID | Type | Price (USD) |
|----|------|-------------|
| `soz_premium_monthly` | Auto-Renewable Subscription | $13.00/month |
| `soz_premium_annual` | Auto-Renewable Subscription | $99.99/year |

**Почему $13, а не $4.99** (решено 2026-09-08). Цена якорится не на приложения,
а на репетитора: в Баку языковой преподаватель стоит от 100 AZN (~$60) в месяц —
мы в 4,6 раза дешевле. Второй якорь: Lingokids, ближайший конкурент по типу
продукта, берёт $14.99/мес, то есть мы чуть ниже него. При $4.99 расходы на ИИ
съедали половину поступления и активный ребёнок уносил всю маржу; при $13 они
составляют 23%, и появляется запас на ошибку.

Годовой $99.99 — это 36% скидки (эквивалент $8.33/мес). Прежняя пара 4.99/29.99
давала 50% скидки; при $13 такая же скидка означала бы $79.99, но годовой
подписчик тогда приносит меньше, чем стоит его обслуживание в активные месяцы.
Если решишь вернуться к 50% — это $79.99, поменять надо здесь и в RELEASE.md.

**Цену задавать по странам, а не одну на весь мир.** $13 в Азербайджане и $13 в
Германии — разные вещи. Для АЗ имеет смысл поставить цену в манатах (~22 AZN),
для остальных рынков свою.

**Якорь на репетитора поднимает планку.** Родитель, заплативший пятую часть цены
преподавателя, спросит «ребёнок заговорил?». При $4.99 на это можно было не
отвечать, при $13 — нет. Отсюда приоритет идеи №2 из `context/WOW-IDEAS`:
голосовые фрагменты речи ребёнка в родительском отчёте.

### Subscription Group Name
`Söz Premium`

### Entitlement ID (RevenueCat)
`premium`

---

## Required Assets

| Asset | Size | Notes |
|-------|------|-------|
| App Icon | 1024×1024 px | No alpha channel, no rounded corners |
| iPhone 6.9" screenshots | 1320×2868 px | 3–10 required |
| iPhone 6.5" screenshots | 1242×2688 px | 3–10 required |
| iPad 13" screenshots | 2064×2752 px | Required if iPad supported |
| Android feature graphic | 1024×500 px | |
| Android screenshots | 1080×1920 px | 2–8 required |

---

## EAS Build Commands

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Initialize project (get EAS_PROJECT_ID)
cd apps/mobile
eas init

# Development build (real device, no Expo Go)
eas build --profile development --platform ios
eas build --profile development --platform android

# Preview build (internal testing)
eas build --profile preview --platform all

# Production build
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## Pre-submission Checklist

- [ ] App icons created and placed in `assets/icon.png` (1024×1024)
- [ ] Splash screen created and placed in `assets/splash.png`
- [ ] `EAS_PROJECT_ID` set in `.env` (run `eas init`)
- [ ] `EXPO_PUBLIC_RC_IOS_KEY` set
- [ ] `EXPO_PUBLIC_RC_ANDROID_KEY` set
- [ ] RevenueCat products created (`soz_premium_monthly`, `soz_premium_annual`)
- [ ] RevenueCat entitlement `premium` created and linked to products
- [ ] App Store Connect app record created
- [ ] Google Play Console app record created
- [ ] Privacy policy URL live
- [ ] Store screenshots prepared
- [ ] Apple Developer Program membership active ($99/year)
- [ ] `eas.json` `ascAppId` and `appleTeamId` filled in
- [ ] Production build tested on real device
