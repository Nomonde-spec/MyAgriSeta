import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { palette } from '@/theme';

export default function AppIndex() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/home" />;
  }

  return (
    <View style={styles.background}>
      <Image
        source={require('../../assets/images/farm-hero-farmer.jpg')}
        contentFit="cover"
        style={styles.backgroundPhoto}
      />
      <View style={styles.imageTint} />
      <LinearGradient
        colors={['rgba(3, 25, 18, 0.02)', 'rgba(3, 25, 18, 0.12)', 'rgba(3, 25, 18, 0.96)']}
        locations={[0, 0.48, 1]}
        style={styles.gradient}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.topBar}>
            <View style={styles.brand}>
              <View style={styles.logoMark}>
                <Ionicons name="leaf" size={18} color={palette.primaryDark} />
              </View>
              <Text style={styles.brandName}>
                <Text style={styles.brandNameStrong}>MyAgri</Text>SETA
              </Text>
            </View>
            <View style={styles.languagePill}>
              <Ionicons name="globe-outline" size={13} color="#FFFFFF" />
              <Text style={styles.languageText}>EN</Text>
            </View>
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.eyebrow}>Agriculture. Skills. Growth.</Text>
            <Text style={styles.heading}>Grow your future in agriculture.</Text>
            <Text style={styles.description}>
              One place to learn, connect and access opportunities across South Africa&apos;s agricultural sector.
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get started with sign in"
              onPress={() => router.push('/login')}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.primaryButtonText}>Get started</Text>
              <Ionicons name="arrow-forward" size={18} color={palette.primaryDark} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/login')}
              style={({ pressed }) => [styles.signInButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.signInText}>
                Already have an account? <Text style={styles.signInEmphasis}>Sign in</Text>
              </Text>
            </Pressable>

            <Text style={styles.registerText}>
              Accounts are created by an administrator. Contact your platform administrator if you need access.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  background: {
    flex: 1,
    backgroundColor: palette.primaryDark,
  },
  backgroundPhoto: {
    ...StyleSheet.absoluteFill,
  },
  imageTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 28, 19, 0.08)',
  },
  gradient: {
    ...StyleSheet.absoluteFill,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#E8C968',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
    marginLeft: 10,
    letterSpacing: 0.1,
  },
  brandNameStrong: {
    fontWeight: '800',
  },
  languagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  languageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  heroContent: {
    paddingBottom: 6,
  },
  eyebrow: {
    color: '#E8C968',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  heading: {
    color: '#FFFFFF',
    fontSize: 36,
    lineHeight: 41,
    fontWeight: '800',
    maxWidth: 360,
  },
  description: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 14,
    maxWidth: 340,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  primaryButtonText: {
    color: palette.primaryDark,
    fontSize: 15,
    fontWeight: '800',
    marginRight: 10,
    letterSpacing: 0.1,
  },
  signInButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  registerButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  registerText: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 13,
    textAlign: 'center',
  },
  registerEmphasis: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  signInText: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 13,
    textAlign: 'center',
  },
  signInEmphasis: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
