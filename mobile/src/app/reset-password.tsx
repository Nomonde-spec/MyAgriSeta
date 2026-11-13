import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authFormStyles as styles } from '@/components/auth/auth-form-styles';
import { BackButton } from '@/components/navigation/back-button';
import { apiFetch } from '@/lib/api';
import { palette } from '@/theme';

const RESET_CODE_PATTERN = /^[a-f0-9]{64}$/;

export default function ResetPasswordScreen() {
  // The emailed link opens this screen with ?token=...; users can also paste
  // the code from the email by hand.
  const params = useLocalSearchParams<{ token?: string }>();
  const linkToken = typeof params.token === 'string' ? params.token : '';
  const [code, setCode] = useState(linkToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async () => {
    const token = code.trim().toLowerCase();
    if (!RESET_CODE_PATTERN.test(token)) {
      setErrorMessage('Paste the full reset code from your email (64 letters and numbers).');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Your new password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('The two passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const result = await apiFetch<{ message: string }>('/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setSuccessMessage(result.message);
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to reset your password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.topBar}>
            <BackButton fallbackHref="/login" label="" />
          </View>

          <View style={styles.headingBlock}>
            <Text style={styles.eyebrow}>PASSWORD HELP</Text>
            <Text accessibilityRole="header" style={styles.heading}>Choose a new password</Text>
            <Text style={styles.subtitle}>
              Reset codes expire after 30 minutes and work once. After the reset, you are signed out on all devices.
            </Text>
          </View>

          {successMessage ? (
            <>
              <Text accessibilityLiveRegion="polite" style={styles.successMessage}>{successMessage}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace('/login')}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.primaryButtonText}>Go to sign in</Text>
              </Pressable>
            </>
          ) : (
            <>
              {linkToken ? null : (
                <>
                  <Text style={styles.label}>Reset code from your email</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="key-outline" size={18} color={palette.muted} />
                    <TextInput
                      style={styles.input}
                      value={code}
                      onChangeText={(value) => {
                        setCode(value);
                        setErrorMessage('');
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="Paste your reset code"
                      placeholderTextColor="#8A958F"
                      accessibilityLabel="Reset code from your email"
                    />
                  </View>
                </>
              )}

              <Text style={styles.label}>New password</Text>
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
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  placeholderTextColor="#8A958F"
                  accessibilityLabel="New password"
                />
              </View>

              <Text style={styles.label}>Confirm new password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={palette.muted} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={(value) => {
                    setConfirmPassword(value);
                    setErrorMessage('');
                  }}
                  secureTextEntry
                  autoComplete="new-password"
                  placeholder="Type the password again"
                  placeholderTextColor="#8A958F"
                  accessibilityLabel="Confirm new password"
                  returnKeyType="done"
                  onSubmitEditing={() => void handleSubmit()}
                />
              </View>

              {errorMessage ? <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text> : null}

              <Pressable
                accessibilityRole="button"
                onPress={() => void handleSubmit()}
                disabled={isSubmitting}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, isSubmitting && styles.buttonDisabled]}
              >
                {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Reset password</Text>}
              </Pressable>

              <Pressable accessibilityRole="button" onPress={() => router.replace('/forgot-password')} style={styles.linkButton}>
                <Text style={styles.linkText}>Request a new reset link</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
