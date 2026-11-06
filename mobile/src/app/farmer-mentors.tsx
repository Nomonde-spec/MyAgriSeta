import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/navigation/back-button';
import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type Mentor = {
  id: string;
  name: string;
  province: string;
  expertise: string;
  biography: string;
  sourceName: string;
  sourceUrl: string;
  verifiedAt: string;
  expiresAt: string;
};
type MentorRequest = {
  id: string;
  mentorName: string;
  status: string;
  message: string;
  feedback: string;
  submittedAt: string;
  mentorContactEmail?: string;
};

export default function FarmerMentorsScreen() {
  const { session } = useAuth();
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [requests, setRequests] = useState<MentorRequest[]>([]);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<{ mentors: Mentor[] }>('/farmer/mentors'),
      apiFetch<{ requests: MentorRequest[] }>('/farmer/mentor-requests'),
    ])
      .then(([mentorResult, requestResult]) => {
        if (active) {
          setMentors(mentorResult.mentors);
          setRequests(requestResult.requests);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Mentor information could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [retry, session]);

  if (session?.activeRole !== 'farmer') return <Redirect href="/home" />;

  const requestIntroduction = async (mentor: Mentor) => {
    if (busy) return;
    setBusy(mentor.id);
    setError('');
    setFeedback('');
    try {
      await apiFetch(`/farmer/mentors/${encodeURIComponent(mentor.id)}/requests`, {
        method: 'POST',
        body: JSON.stringify({ message: messages[mentor.id] || '' }),
      });
      const { requests: updated } = await apiFetch<{ requests: MentorRequest[] }>('/farmer/mentor-requests');
      setRequests(updated);
      setMessages((current) => ({ ...current, [mentor.id]: '' }));
      setFeedback(`Your introduction request to ${mentor.name} has been sent for staff review.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The mentor request could not be submitted.');
    } finally {
      setBusy('');
    }
  };

  const openLink = async (url: string) => {
    try {
      const target = new URL(url);
      if (!['http:', 'https:', 'mailto:'].includes(target.protocol) || target.username || target.password) {
        throw new Error('This contact link is not valid.');
      }
      await Linking.openURL(target.href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The contact link could not be opened.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton fallbackHref="/farmer" />
        <Text style={styles.eyebrow}>AGRIMENTOR</Text>
        <Text style={styles.heading}>Agricultural mentors</Text>
        <Text style={styles.subtitle}>Browse source-checked profiles. Contact details are shared only after authorized staff approve an introduction.</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {error ? (
          <Pressable accessibilityRole="button" onPress={() => { setLoading(true); setRetry((value) => value + 1); }} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        ) : null}
        {feedback ? <Text accessibilityRole="alert" style={styles.success}>{feedback}</Text> : null}
        {loading ? <ActivityIndicator size="large" color={palette.primary} style={styles.loading} /> : null}
        {!loading && mentors.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.body}>No verified mentor profiles are currently available. The directory does not display sample identities.</Text>
          </View>
        ) : null}
        {mentors.map((mentor) => (
          <View key={mentor.id} style={styles.card}>
            <Text style={styles.name}>{mentor.name}</Text>
            <Text style={styles.meta}>{mentor.expertise} · {mentor.province}</Text>
            <Text style={styles.body}>{mentor.biography}</Text>
            <Text style={styles.meta}>Profile checked {mentor.verifiedAt} · Expires {mentor.expiresAt} · Source: {mentor.sourceName}</Text>
            <Pressable accessibilityRole="link" onPress={() => void openLink(mentor.sourceUrl)} style={styles.contact}>
              <Text style={styles.contact}>Verification source: {mentor.sourceUrl}</Text>
            </Pressable>
            <TextInput
              accessibilityLabel={`Guidance requested from ${mentor.name}`}
              value={messages[mentor.id] || ''}
              onChangeText={(value) => setMessages((current) => ({ ...current, [mentor.id]: value }))}
              placeholder="What farming topic would you like guidance on?"
              maxLength={500}
              multiline
              style={styles.input}
            />
            <Pressable accessibilityRole="button" disabled={Boolean(busy)} onPress={() => void requestIntroduction(mentor)} style={[styles.button, busy && styles.disabled]}>
              <Text style={styles.buttonText}>{busy === mentor.id ? 'Sending…' : 'Request introduction'}</Text>
            </Pressable>
          </View>
        ))}
        <Text style={styles.section}>My requests</Text>
        {!loading && requests.length === 0 ? <Text style={styles.meta}>You have no mentor introduction requests.</Text> : null}
        {requests.map((request) => (
          <View key={request.id} style={styles.card}>
            <Text style={styles.name}>{request.mentorName}</Text>
            <Text style={styles.meta}>{request.status} · {new Date(request.submittedAt).toLocaleDateString('en-ZA')}</Text>
            {request.feedback ? <Text style={styles.body}>Staff response: {request.feedback}</Text> : null}
            {request.mentorContactEmail ? (
              <Pressable accessibilityRole="link" onPress={() => void openLink(`mailto:${request.mentorContactEmail}`)} style={styles.contact}>
                <Text selectable style={styles.contact}>Contact mentor: {request.mentorContactEmail}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F8F5' },
  content: { padding: spacing.md, paddingBottom: 100 },
  eyebrow: { color: palette.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginTop: spacing.md },
  heading: { color: palette.text, fontSize: 26, fontWeight: '800', marginTop: 4 },
  subtitle: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  loading: { marginTop: spacing.xl },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E9E3', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  name: { color: palette.text, fontSize: 16, fontWeight: '800' },
  meta: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 7 },
  body: { color: palette.text, fontSize: 13, lineHeight: 20, marginTop: 9 },
  input: { minHeight: 76, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.md, textAlignVertical: 'top', color: palette.text },
  button: { minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary, borderRadius: radius.sm, marginTop: spacing.sm, padding: spacing.sm },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  error: { color: palette.danger, marginTop: spacing.md },
  success: { color: palette.primary, marginTop: spacing.md },
  retry: { alignSelf: 'flex-start', marginTop: spacing.sm, paddingVertical: 8 },
  retryText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  section: { color: palette.text, fontSize: 19, fontWeight: '800', marginTop: spacing.xl },
  contact: { color: palette.primary, fontSize: 13, fontWeight: '700', marginTop: spacing.sm },
});
