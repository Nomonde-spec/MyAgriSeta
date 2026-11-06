import { Ionicons } from '@expo/vector-icons';
import { Href, router, useRootNavigationState } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { palette, radius, spacing } from '@/theme';

type RouteSnapshot = {
  name?: string;
  state?: {
    index?: number;
    routes?: RouteSnapshot[];
  };
};

type BackButtonProps = {
  fallbackHref?: Href;
  label?: string;
};

function activeRouteName(route: RouteSnapshot | undefined): string | undefined {
  if (!route) return undefined;
  const state = route.state;
  const activeRoute = state?.routes?.[state.index ?? 0];
  return activeRoute ? activeRouteName(activeRoute) : route.name;
}

export function BackButton({ fallbackHref = '/home', label = 'Back' }: BackButtonProps) {
  const navigationState = useRootNavigationState();
  const { session } = useAuth();

  const goBack = () => {
    const previousRoute = navigationState && navigationState.index > 0
      ? navigationState.routes[navigationState.index - 1] as RouteSnapshot | undefined
      : undefined;
    const previousName = activeRouteName(previousRoute);
    const isRestrictedRoute = previousName === 'admin' || previousName === 'audit'
      ? session?.activeRole !== 'administrator'
      : previousName === 'review'
        ? !['administrator', 'internal_staff'].includes(session?.activeRole ?? '')
        : false;

    if (
      router.canGoBack() &&
      previousName &&
      previousName !== 'login' &&
      previousName !== 'index' &&
      !isRestrictedRoute
    ) {
      router.back();
      return;
    }

    router.replace(fallbackHref);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      accessibilityHint="Returns to the previous screen"
      onPress={goBack}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="arrow-back" size={20} color={palette.primaryDark} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
  },
  label: { color: palette.primaryDark, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
