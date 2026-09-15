/**
 * HBPet — персонаж Söz: медвежонок у детей до 10 лет, робот у подростков и
 * взрослых (решение владельца 2026-09-14; тот же порог у сервера в
 * `apps/api/src/ai/persona.ts`, чтобы на экране и в разговоре был один персонаж).
 *
 * Рисунок — данные из `./mascot/art.ts`, здесь только отрисовка и движение:
 *  - дыхание и редкие жесты (наклон, потягивание, покачивание) — вся фигура;
 *  - моргание — слой глаз сжимается по вертикали вокруг линии глаз;
 *  - речь (`talking`) — слой рта открывается и закрывается.
 * Всё на shared values Reanimated: прежний таймер моргания через React-state
 * перерисовывал каждого питомца раз в 3–6 секунд.
 *
 * Без `hue` берётся цвет из стора (раньше 25 из 58 вызовов теряли выбранный
 * ребёнком цвет), без `kind` — персонаж текущего профиля.
 */

import { useEffect, useId, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import {
  FULL_BODY_FROM,
  LOW_DETAIL_BELOW,
  petArt,
  type CompanionKind,
  type PetArt,
  type PetMood,
  type PetVariant,
  type Prim,
} from '@/components/mascot/art';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSettings } from '@/store/settings';
import { uiModeFor } from '@/theme/mode';
import { petPaletteFor } from '@/theme/petPalette';

export type HBPetMood = PetMood;
export type { CompanionKind };

export interface HBPetProps {
  size?: number;
  /** Цвет питомца (ключи `PET_HUES`). По умолчанию — выбранный ребёнком. */
  hue?: number;
  /** Медвежонок или робот. По умолчанию — по возрасту текущего профиля. */
  kind?: CompanionKind;
  mood?: PetMood;
  /** Персонаж говорит: рот открывается и закрывается. */
  talking?: boolean;
  /** Без движения. По умолчанию включено на мелком размере. */
  still?: boolean;
  /** Голова или фигурка целиком. По умолчанию целиком от 100 dp. */
  variant?: PetVariant;
  /** Редкие жесты в покое. Сами выключаются, пока говорит, спит или неподвижен. */
  idleGestures?: boolean;
  /** Питомец нажимается и радостно подпрыгивает. */
  onTap?: () => void;
}

/** Персонаж профиля. Не через `useUIMode`: в родительской зоне режим принудительно
 * взрослый, а персонаж ребёнка там остаётся его медвежонком. */
export function useCompanionKind(): CompanionKind {
  return useSettings((s) =>
    uiModeFor(s.profileType, s.childAge, s.childAgeRange) === 'kid' ? 'bear' : 'robot',
  );
}

const VB = 120;

export function HBPet({
  size = 110,
  hue,
  kind,
  mood = 'happy',
  talking = false,
  still,
  variant,
  idleGestures = true,
  onTap,
}: HBPetProps) {
  const storedHue = useSettings((s) => s.petHue);
  const profileKind = useCompanionKind();
  const effectiveKind = kind ?? profileKind;
  const effectiveHue = hue ?? storedHue ?? 55;
  const low = size < LOW_DETAIL_BELOW;
  const effectiveVariant = variant ?? (size >= FULL_BODY_FROM ? 'full' : 'head');
  const isSleepy = mood === 'sleepy';

  const art = useMemo(
    () =>
      petArt({
        kind: effectiveKind,
        mood,
        palette: petPaletteFor(effectiveHue),
        variant: effectiveVariant,
        detail: low ? 'low' : 'high',
        talking,
      }),
    [effectiveKind, mood, effectiveHue, effectiveVariant, low, talking],
  );

  // id градиента уникален на экран: в браузере все SVG делят одно пространство id.
  const uid = `pet${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const reduced = useReducedMotion();
  const motionOff = (still ?? low) || reduced;

  // ─── Движение всей фигуры ────────────────────────────────────────────────
  const bobY = useSharedValue(0);
  const breathe = useSharedValue(1);
  const pulse = useSharedValue(1);
  const gRot = useSharedValue(0);
  const gTx = useSharedValue(0);
  const gScaleY = useSharedValue(1);
  // ─── Лицо ────────────────────────────────────────────────────────────────
  const blink = useSharedValue(1);
  const jaw = useSharedValue(1);

  const wiggle = () => {
    gScaleY.value = withSequence(withTiming(1.1, { duration: 140 }), withSpring(1, { damping: 8 }));
    gRot.value = withSequence(
      withTiming(-5, { duration: 80 }),
      withTiming(5, { duration: 80 }),
      withTiming(0, { duration: 140 }),
    );
  };

  // Дыхание: быстрый вдох, короткая пауза, медленный выдох — не ровная синусоида.
  useEffect(() => {
    if (motionOff || isSleepy) {
      bobY.value = withTiming(0, { duration: 200 });
      breathe.value = withTiming(1, { duration: 200 });
      return;
    }
    bobY.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 900 }),
        withTiming(-3.4, { duration: 300 }),
        withTiming(0, { duration: 1500 }),
      ),
      -1,
      false,
    );
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.025, { duration: 900 }),
        withTiming(1.025, { duration: 300 }),
        withTiming(1, { duration: 1500 }),
      ),
      -1,
      false,
    );
  }, [motionOff, isSleepy, bobY, breathe]);

  // Речь: рот открывается, фигура чуть пружинит.
  useEffect(() => {
    if (motionOff || !talking) {
      cancelAnimation(jaw);
      jaw.value = withTiming(1, { duration: 120 });
      pulse.value = withTiming(1, { duration: 200 });
      return;
    }
    jaw.value = withRepeat(
      withSequence(withTiming(0.35, { duration: 150 }), withTiming(1, { duration: 170 })),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withSequence(withTiming(1.03, { duration: 260 }), withTiming(0.99, { duration: 260 })),
      -1,
      true,
    );
  }, [motionOff, talking, jaw, pulse]);

  // Моргание: раз в ~4 с, иногда дважды подряд. Первая задержка случайная, чтобы
  // несколько питомцев на экране не моргали хором.
  useEffect(() => {
    if (motionOff || isSleepy) {
      cancelAnimation(blink);
      blink.value = 1;
      return;
    }
    const close = () => withTiming(0.08, { duration: 70 });
    const open = () => withTiming(1, { duration: 90 });
    blink.value = withDelay(
      Math.round(800 + Math.random() * 2500),
      withRepeat(
        withSequence(
          close(),
          open(),
          withDelay(4200, close()),
          open(),
          withDelay(160, close()),
          open(),
          withDelay(3300, withTiming(1, { duration: 10 })),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(blink);
  }, [motionOff, isSleepy, blink]);

  // Редкие жесты, чтобы питомец не выглядел заевшей петлёй.
  useEffect(() => {
    if (motionOff || isSleepy || talking || !idleGestures) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = () => {
      const pick = Math.floor(Math.random() * 4);
      if (pick === 0) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        gRot.value = withSequence(withTiming(6 * dir, { duration: 320 }), withTiming(0, { duration: 520 }));
      } else if (pick === 1) {
        gScaleY.value = withSequence(withTiming(1.08, { duration: 360 }), withSpring(1, { damping: 9 }));
      } else if (pick === 2) {
        gTx.value = withSequence(
          withTiming(4, { duration: 420 }),
          withTiming(-4, { duration: 620 }),
          withTiming(0, { duration: 420 }),
        );
      } else {
        wiggle();
      }
    };
    const schedule = () => {
      timer = setTimeout(() => {
        if (cancelled) return;
        run();
        schedule();
      }, 6000 + Math.random() * 6000);
    };
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionOff, isSleepy, talking, idleGestures]);

  const figureStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: gTx.value },
      { translateY: bobY.value },
      { rotate: `${gRot.value}deg` },
      { scale: pulse.value },
      { scaleY: breathe.value * gScaleY.value },
    ],
  }));

  // Сжатие слоя вокруг горизонтали `y` (в пикселях от верха): сдвинуть ось в
  // центр блока, сжать, вернуть. transformOrigin не везде одинаково понимается.
  const k = size / VB;
  const eyeAxis = (art.place.ty + art.place.s * art.eyeY) * k - size / 2;
  const mouthAxis = (art.place.ty + art.place.s * art.mouthY) * k - size / 2;
  const eyesStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: eyeAxis }, { scaleY: blink.value }, { translateY: -eyeAxis }],
  }));
  const mouthStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: mouthAxis }, { scaleY: jaw.value }, { translateY: -mouthAxis }],
  }));

  const headTransform = `translate(${art.place.tx} ${art.place.ty}) scale(${art.place.s})`;

  const figure = motionOff ? (
    // Неподвижный питомец — одним SVG: на экранах со списками их бывает много.
    <View style={{ width: size, height: size }}>
      <PetSvg art={art} uid={uid} size={size} layers={['body', 'head', 'eyes', 'mouth', 'over']} transform={headTransform} />
    </View>
  ) : (
    <Animated.View style={[{ width: size, height: size }, figureStyle]}>
      <PetSvg art={art} uid={uid} size={size} layers={['body', 'head']} transform={headTransform} />
      <Animated.View style={[StyleSheet.absoluteFill, eyesStyle]} pointerEvents="none">
        <PetSvg art={art} uid={uid} size={size} layers={['eyes']} transform={headTransform} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, mouthStyle]} pointerEvents="none">
        <PetSvg art={art} uid={uid} size={size} layers={['mouth']} transform={headTransform} />
      </Animated.View>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <PetSvg art={art} uid={uid} size={size} layers={['over']} transform={headTransform} />
      </View>
    </Animated.View>
  );

  if (onTap) {
    return (
      <Pressable
        onPress={() => {
          if (!motionOff) wiggle();
          onTap();
        }}
        hitSlop={8}
      >
        {figure}
      </Pressable>
    );
  }
  return figure;
}

type Layer = 'body' | 'head' | 'eyes' | 'mouth' | 'over';

const pct = (v: number) => `${Math.round(v * 100)}%`;

function PetSvg({
  art,
  uid,
  size,
  layers,
  transform,
}: {
  art: PetArt;
  uid: string;
  size: number;
  layers: Layer[];
  transform: string;
}) {
  const withDefs = layers.includes('body') || layers.includes('head');
  const headLayers = layers.filter((l) => l !== 'body');
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
      {withDefs && art.defs.length > 0 ? (
        <Defs>
          {art.defs.map((g) => (
            <RadialGradient
              key={g.id}
              id={`${uid}${g.id}`}
              cx={pct(g.cx)}
              cy={pct(g.cy)}
              fx={pct(g.cx)}
              fy={pct(g.cy)}
              r={pct(g.r)}
            >
              {g.stops.map(([offset, color]) => (
                <Stop key={offset} offset={offset} stopColor={color} stopOpacity={1} />
              ))}
            </RadialGradient>
          ))}
        </Defs>
      ) : null}
      {layers.includes('body') ? art.body.map((p, i) => <PrimShape key={`b${i}`} p={p} uid={uid} />) : null}
      <G transform={transform}>
        {headLayers.flatMap((l) => art[l].map((p, i) => <PrimShape key={`${l}${i}`} p={p} uid={uid} />))}
      </G>
    </Svg>
  );
}

function PrimShape({ p, uid }: { p: Prim; uid: string }) {
  const fill = !p.fill ? undefined : p.fill.startsWith('grad:') ? `url(#${uid}${p.fill.slice(5)})` : p.fill;
  const common = {
    fill,
    stroke: p.stroke,
    strokeWidth: p.sw,
    strokeLinecap: p.stroke ? ('round' as const) : undefined,
    strokeLinejoin: p.stroke ? ('round' as const) : undefined,
    opacity: p.op,
  };
  switch (p.k) {
    case 'path':
      return <Path d={p.d} {...common} />;
    case 'ellipse':
      return <Ellipse cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} {...common} />;
    case 'rect':
      return <Rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r} ry={p.r} {...common} />;
  }
}

export default HBPet;
