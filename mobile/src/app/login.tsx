import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/navigation/back-button';
import { useAuth } from '@/context/auth-context';
import { palette, spacing } from '@/theme';

export default function LoginScreen() {
  const { login, session } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  React.useEffect(() => {
    if (session) {
      router.replace('/home');
    }
  }, [session]);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      setErrorMessage('Enter your email, username or mobile number and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await login(identifier.trim(), password);
      router.replace('/home');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in. Please try again.';
      setErrorMessage(
        message === 'Failed to fetch' || message === 'Network request failed'
          ? 'Could not reach the sign-in service. Check that the backend is running, then try again.'
          : message
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        persistentScrollbar
      >
        <View style={styles.content}>
          <View style={styles.topBar}>
            <BackButton fallbackHref="/" label="" />
            <View style={styles.brand}>
              <View style={styles.brandMark}>
                <Ionicons name="leaf" size={15} color={palette.primaryDark} />
              </View>
              <Text style={styles.brandName}><Text style={styles.brandStrong}>MyAgri</Text> SETA</Text>
            </View>
          </View>

          <View style={styles.headingBlock}>
            <Text style={styles.eyebrow}>WELCOME BACK</Text>
            <Text style={styles.heading}>Sign in to MyAgriSETA</Text>
            <Text style={styles.subtitle}>Continue growing your future in agriculture.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email, username or mobile number</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="id-card-outline" size={18} color={palette.muted} />
              <TextInput
                style={styles.input}
                value={identifier}
                onChangeText={(value) => {
                  setIdentifier(value);
                  setErrorMessage('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="Enter your details"
                placeholderTextColor="#A1ABA5"
                accessibilityLabel="Email, username or mobile number"
                returnKeyType="next"
              />
            </View>

            <Text style={[styles.label, styles.passwordLabel]}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={palette.muted} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setErrorMessage('');
                }}
                secureTextEntry
                placeholder="Enter your password"
                placeholderTextColor="#A1ABA5"
                accessibilityLabel="Password"
                returnKeyType="done"
                onSubmitEditing={() => void handleLogin()}
              />
            </View>

            {errorMessage ? (
              <Text accessibilityRole="alert" style={styles.errorMessage}>
                {errorMessage}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => Alert.alert('Password recovery', 'Contact your administrator to reset your password.')}
              style={styles.forgotButton}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/register')}
              style={styles.accountButton}
            >
              <Text style={styles.accountNote}>
                New to MyAgriSETA? <Text style={styles.accountNoteStrong}>Create an account</Text>
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => void handleLogin()}
              disabled={isSubmitting}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, isSubmitting && styles.buttonDisabled]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Sign in</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </Pressable>

            <View style={styles.privacyNote}>
              <Ionicons name="shield-checkmark-outline" size={15} color={palette.muted} />
              <Text style={styles.privacyText}>Learners can sign in after registering. Other stakeholder roles require administrator verification.</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  content: {
    width: '100%',
    maxWidth: 414,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0F5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { flexDirection: 'row', alignItems: 'center' },
  brandMark: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#E8C968',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { color: palette.text, fontSize: 15, marginLeft: 8, fontWeight: '500' },
  brandStrong: { fontWeight: '800' },
  headingBlock: { marginBottom: 27 },
  eyebrow: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 7,
  },
  heading: { color: '#18241E', fontSize: 27, lineHeight: 34, fontWeight: '700' },
  subtitle: { color: '#76827B', fontSize: 13, lineHeight: 20, marginTop: 7 },
  registrationNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    marginBottom: 16,
    borderRadius: 11,
    backgroundColor: '#E8F2EB',
  },
  registrationNoticeText: { flex: 1, color: palette.primaryDark, fontSize: 12, lineHeight: 18 },
  form: { width: '100%' },
  label: { color: '#34433A', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  passwordLabel: { marginTop: 16 },
  inputWrap: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: '#DDE3DF',
    backgroundColor: '#FCFDFC',
    borderRadius: 11,
    paddingHorizontal: 15,
  },
  input: { flex: 1, minWidth: 0, color: palette.text, fontSize: 14, paddingVertical: 13 },
  errorMessage: {
    color: palette.danger,
    backgroundColor: '#F8E8E6',
    borderRadius: 11,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  forgotButton: { alignSelf: 'flex-end', paddingVertical: 10, paddingLeft: 10 },
  forgotText: { color: palette.primaryDark, fontSize: 11, fontWeight: '700' },
  primaryButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#0A4532',
    shadowColor: '#0A4532',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  buttonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.72 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  accountButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  accountNote: { color: '#78837D', fontSize: 12, textAlign: 'center', lineHeight: 19 },
  accountNoteStrong: { color: palette.primaryDark, fontWeight: '700' },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 20,
  },
  privacyText: { color: '#7D8982', fontSize: 10, textAlign: 'center' },
});
