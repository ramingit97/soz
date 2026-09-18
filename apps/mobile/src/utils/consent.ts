/**
 * Текст единственной галочки согласия (решение владельца 2026-09-14: одна
 * галочка на всё — родитель, данные, голос). Один источник для онбординга
 * (`setup/profile-type`) и для экрана согласия, куда ведёт «Говорить», если
 * согласия ещё нет: формулировки не должны расходиться.
 */
import type { ProfileType } from '../store/settings';

export function consentLabel(who: ProfileType | null | undefined, az: boolean): string {
  if (who === 'adult') {
    return az
      ? 'Məlumatlarımın və tərəqqimin saxlanmasına, söhbət zamanı səsimin AI tərəfdaşlarına göndərilməsinə razıyam (səs yazılmır).'
      : 'Разрешаю сохранять мои данные и прогресс и отправлять голос AI-партнёрам во время разговоров (голос не записывается).';
  }
  return az
    ? 'Mən valideyn və ya qəyyumam. Uşağın adının və tərəqqisinin saxlanmasına, söhbət zamanı səsinin AI tərəfdaşlarına göndərilməsinə razıyam (səs yazılmır).'
    : 'Я родитель или опекун. Разрешаю сохранять имя и прогресс ребёнка и отправлять его голос AI-партнёрам во время разговоров (голос не записывается).';
}
