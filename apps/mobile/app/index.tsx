import { Redirect } from 'expo-router';

import { useSettings } from '@/store/settings';

export default function Index() {
  const parentUILanguage = useSettings((s) => s.parentUILanguage);
  const onboardingComplete = useSettings((s) => s.onboardingComplete);
  const learningLanguages = useSettings((s) => s.learningLanguages);
  const authToken = useSettings((s) => s.authToken);
  const isGuestAccount = useSettings((s) => s.isGuestAccount);
  const currentDay = useSettings((s) => s.currentDay);
  const profileType = useSettings((s) => s.profileType);

  // A guest holds a real token now (the trial runs on an anonymous account), so
  // "signed up" is `authToken && !isGuestAccount` — testing the token alone would
  // route every trial user into the registered-parent flow.
  const registered = !!authToken && !isGuestAccount;
  const onboarded = onboardingComplete && learningLanguages.length > 0;

  // Full onboarding done and registered — go to profile picker
  if (onboarded && registered) {
    return <Redirect href={'/profile-select' as any} />;
  }

  // Trial mode — onboarded, not registered, still on day 1: free trial, no account
  if (onboarded && !registered && currentDay <= 1) {
    return <Redirect href="/home" />;
  }

  // Onboarding done but day 2+ without an account — must sign up to continue.
  // Guests go to register (their trial upgrades in place); someone with no token
  // at all is a returning user who cleared storage, so send them to login.
  if (onboarded && !registered && currentDay > 1) {
    return <Redirect href={(isGuestAccount ? '/auth/register' : '/auth/login') as never} />;
  }

  // No UI language — very first launch
  if (!parentUILanguage) {
    return <Redirect href="/language" />;
  }

  // Picked languages but hasn't done questionnaire — resume the right path by profile
  if (learningLanguages.length > 0) {
    return <Redirect href={(profileType === 'adult' ? '/setup/goal' : '/setup/name') as never} />;
  }

  // Has UI language but hasn't picked learning languages
  return <Redirect href="/welcome" />;
}
