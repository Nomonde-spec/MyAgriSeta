import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authFormStyles as styles } from '@/components/auth/auth-form-styles';
import { BackButton } from '@/components/navigation/back-button';
import { apiFetch } from '@/lib/api';
import { palette } from '@/theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setErrorMessage('Enter the email address on your account.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const result = await apiFetch<{ message: string }>('/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email: trimmed }),
      });
      setSuccessMessage(result.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to send a reset link. Please try again.');
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
            <Text accessibilityRole="header" style={styles.heading}>Forgot your password?</Text>
            <Text style={styles.subtitle}>
              Enter the email address on your account. We will email you a link and a reset code.
            </Text>
          </View>

          <Text style={styles.label} nativeID="forgot-email-label">Email address</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={palette.muted} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setErrorMessage('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              placeholder="name@example.co.za"
              placeholderTextColor="#8A958F"
              accessibilityLabel="Email address"
              accessibilityLabelledBy="forgot-email-label"
              returnKeyType="send"
              onSubmitEditing={() => void handleSubmit()}
            />
          </View>

          {errorMessage ? <Text accessibilityRole="alert" style={styles.errorMessage}>{errorMessage}</Text> : null}
          {successMessage ? <Text accessibilityLiveRegion="polite" style={styles.successMessage}>{successMessage}</Text> : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => void handleSubmit()}
            disabled={isSubmitting}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, isSubmitting && styles.buttonDisabled]}
          >
            {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Send reset link</Text>}
          </Pressable>

          <Pressable accessibilityRole="button" onPress={() => router.push('/reset-password')} style={styles.linkButton}>
            <Text style={styles.linkText}>I already have a reset code</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.linkButton}>
            <Text style={styles.linkText}>Back to sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
