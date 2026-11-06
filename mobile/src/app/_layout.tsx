import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AuthProvider } from '@/context/auth-context';
import { NotificationCountProvider } from '@/context/notification-count-context';
import { palette } from '@/theme';

export default function RootLayout() {
  const { width, height } = useWindowDimensions();
  const [previewReady, setPreviewReady] = useState(Platform.OS !== 'web');
  const showPhoneFrame = Platform.OS === 'web' && previewReady && width > 700;
  const frameHeight = Math.min(850, height - 40);
  const frameWidth = Math.min(360, width - 48);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const frame = requestAnimationFrame(() => setPreviewReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <View style={[styles.previewStage, showPhoneFrame && styles.desktopPreviewStage]}>
        <View style={[styles.appViewport, showPhoneFrame && styles.phoneFrame, showPhoneFrame && { width: frameWidth, height: frameHeight }]}>
        <AuthProvider>
          <NotificationCountProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />
              <Stack.Screen name="applications" />
              <Stack.Screen name="farmer-market" />
              <Stack.Screen name="farmer-mentors" />
              <Stack.Screen name="opportunity" />
              <Stack.Screen name="service" />
              <Stack.Screen name="learning" />
              <Stack.Screen name="audit" />
              <Stack.Screen name="review" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </NotificationCountProvider>
        </AuthProvider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  previewStage: {
    flex: 1,
    backgroundColor: palette.background,
  },
  desktopPreviewStage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#E8ECE8',
  },
  appViewport: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: palette.background,
  },
  phoneFrame: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    borderWidth: 8,
    borderColor: '#18221C',
    borderRadius: 38,
    shadowColor: '#111A14',
    shadowOpacity: 0.24,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
  },
});
