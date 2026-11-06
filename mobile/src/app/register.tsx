import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/navigation/back-button';
import { SelfRegistrationRole, useAuth } from '@/context/auth-context';
import { palette, radius, spacing } from '@/theme';

const roles: { role: SelfRegistrationRole; label: string }[] = [
  { role: 'learner', label: 'Learner' },
  { role: 'farmer', label: 'Farmer' },
  { role: 'employer', label: 'Employer' },
  { role: 'sdf', label: 'SDF' },
  { role: 'training_provider', label: 'Training provider' },
];

const verificationFields: Record<SelfRegistrationRole, { key: string; label: string }[]> = {
  learner: [],
  farmer: [
    { key: 'farmName', label: 'Farm or operation name' },
    { key: 'province', label: 'Province' },
    { key: 'verificationReference', label: 'Agricultural reference' },
  ],
  employer: [
    { key: 'organization', label: 'Registered organisation' },
    { key: 'registrationNumber', label: 'CIPC registration number' },
    { key: 'workEmail', label: 'Work email' },
  ],
  sdf: [
    { key: 'organization', label: 'Employer or organisation' },
    { key: 'workEmail', label: 'Work email' },
    { key: 'authorizationReference', label: 'SDF authorisation reference' },
  ],
  training_provider: [
    { key: 'organization', label: 'Provider legal name' },
    { key: 'registrationBody', label: 'Registration or accreditation body' },
    { key: 'providerReference', label: 'Provider registration reference' },
  ],
};

export default function RegisterScreen() {
  const { register, session } = useAuth();
  const [values, setValues] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [role, setRole] = useState<SelfRegistrationRole>('learner');
  const [verificationDetails, setVerificationDetails] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (session) router.replace('/home');
  }, [session]);

  const submit = async () => {
    if (isSubmitting) return;
    if (Object.values(values).slice(0, 4).some((value) => !value.trim()) ||
        !values.password || values.password !== values.confirmPassword || values.password.length < 8 ||
        verificationFields[role].some(({ key }) => !verificationDetails[key]?.trim())) {
      setErrorMessage('Complete all required fields and make sure your passwords match (at least 8 characters).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const result = await register({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        username: values.username.trim(),
        phone: values.phone.trim() || undefined,
        password: values.password,
        role,
        verificationDetails,
      });
      setSuccessMessage(result.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Your registration could not be submitted.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <BackButton fallbackHref="/login" />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Create an account</Text>
          <Text style={styles.help}>Learners can sign in as soon as they register. Other stakeholder roles require administrator verification.</Text>
          <Text style={styles.label}>Account role</Text>
          <View style={styles.roleList}>
            {roles.map(({ role: item, label }) => (
              <Pressable key={item} accessibilityRole="radio" accessibilityState={{ selected: role === item }} onPress={() => {
                setRole(item);
                setVerificationDetails({});
                setErrorMessage('');
                setSuccessMessage('');
              }} style={[styles.roleButton, role === item && styles.roleSelected]}>
                <Text style={[styles.roleText, role === item && styles.roleTextSelected]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {([
            ['firstName', 'First name'],
            ['lastName', 'Last name'],
            ['email', 'Email'],
            ['username', 'Username'],
            ['phone', 'Phone (optional)'],
            ...verificationFields[role].map(({ key, label }) => [key, label] as const),
            ['password', 'Password'],
            ['confirmPassword', 'Confirm password'],
          ] as const).map(([field, label]) => (
            <TextInput
              key={field}
              accessibilityLabel={label}
              value={verificationFields[role].some(({ key }) => key === field)
                ? verificationDetails[field] || ''
                : values[field as keyof typeof values]}
              onChangeText={(value) => {
                if (field in verificationDetails || verificationFields[role].some(({ key }) => key === field)) {
                  setVerificationDetails((current) => ({ ...current, [field]: value }));
                } else {
                  setValues((current) => ({ ...current, [field]: value }));
                }
              }}
              placeholder={label}
              autoCapitalize={field === 'email' || field === 'username' || field === 'workEmail' ? 'none' : 'words'}
              keyboardType={field === 'email' || field === 'workEmail' ? 'email-address' : 'default'}
              secureTextEntry={field === 'password' || field === 'confirmPassword'}
              style={styles.input}
            />
          ))}
          {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
          {successMessage ? (
            <View accessibilityRole="alert">
              <Text style={styles.success}>{successMessage}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.replace('/login')} style={styles.submitButton}>
                <Text style={styles.submitText}>Continue to sign in</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => void submit()} style={[styles.submitButton, isSubmitting && styles.disabled]}>
              {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Register</Text>}
            </Pressable>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  screen: { flex: 1, padding: spacing.md },
  content: { padding: spacing.xl, paddingBottom: 80 },
  heading: { color: palette.text, fontSize: 28, fontWeight: '800' },
  help: { color: palette.muted, lineHeight: 21, marginTop: spacing.sm, marginBottom: spacing.md },
  label: { color: palette.text, fontWeight: '700', marginTop: spacing.sm },
  roleList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.md },
  roleButton: { borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  roleSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  roleText: { color: palette.text, fontWeight: '700' },
  roleTextSelected: { color: '#FFFFFF' },
  input: { backgroundColor: palette.surface, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.sm, color: palette.text },
  error: { color: palette.danger, marginTop: spacing.md, lineHeight: 20 },
  success: { color: palette.primary, marginTop: spacing.md, lineHeight: 21 },
  submitButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg, borderRadius: radius.md, backgroundColor: palette.primary, padding: spacing.md },
  submitText: { color: '#FFFFFF', fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
