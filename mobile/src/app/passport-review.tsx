import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';

import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type VerificationRecord = {
  id: string;
  title: string;
  recordType: string;
  organisation: string;
  description: string;
  reference: string;
  status: string;
  submittedAt: string;
  documents: { id: string; filename: string; mimeType: string; size: number }[];
  verificationHistory: { decision: string; comment: string; reviewedAt: string; requirements?: string[] }[];
  owner: { firstName: string; lastName: string; role: string } | null;
};

export default function PassportReviewScreen() {
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiFetch<{ records: VerificationRecord[] }>('/admin/passport/verifications');
      setRecords(Array.isArray(payload.records) ? payload.records : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Passport review queue could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadQueue(), 0);
    return () => clearTimeout(timer);
  }, [loadQueue, retry]);

  const decide = async (record: VerificationRecord, decision: 'verify' | 'reject' | 'request_information') => {
    if (busyId) return;
    const comment = comments[record.id]?.trim() || '';
    if (decision !== 'verify' && !comment) {
      setError(decision === 'reject'
        ? 'Add a reason before rejecting a record.'
        : 'Enter the additional information required.');
      return;
    }
    setBusyId(record.id);
    setError('');
    try {
      await apiFetch(`/admin/passport/verifications/${encodeURIComponent(record.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision,
          comment,
          ...(decision === 'request_information' ? { requirements: [comment] } : {}),
        }),
      });
      setRecords((current) => current.filter((entry) => entry.id !== record.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The verification decision could not be saved.');
    } finally {
      setBusyId('');
    }
  };

  const openDocument = async (record: VerificationRecord, document: VerificationRecord['documents'][number]) => {
    try {
      const payload = await apiFetch<{ document: { filename: string; mimeType: string; data: string } }>(
        `/passport/records/${encodeURIComponent(record.id)}/documents/${encodeURIComponent(document.id)}`
      );
      if (Platform.OS === 'web') {
        const bytes = Uint8Array.from(atob(payload.document.data), (character) => character.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: payload.document.mimeType }));
        const link = window.document.createElement('a');
        link.href = url;
        link.download = payload.document.filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        return;
      }
      if (!FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) {
        throw new Error('This device cannot open or share documents.');
      }
      const uri = `${FileSystem.cacheDirectory}${record.id}-${document.id}-${payload.document.filename.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
      await FileSystem.writeAsStringAsync(uri, payload.document.data, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(uri, { mimeType: payload.document.mimeType, dialogTitle: 'Open Passport document' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The Passport document could not be opened.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ADMINISTRATION</Text>
        <Text style={styles.heading}>Passport verification</Text>
        <Text style={styles.description}>Review submitted records. Verification confirms an administrator review only; it does not replace issuer verification.</Text>
        {error ? (
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => setRetry((current) => current + 1)}>
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {loading ? <ActivityIndicator size="large" color={palette.primary} style={styles.loader} /> : null}
        {!loading && !records.length && !error ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={24} color={palette.primary} />
            <Text style={styles.title}>No submissions to review</Text>
            <Text style={styles.description}>New Passport submissions will appear here.</Text>
          </View>
        ) : null}
        {records.map((record) => (
          <View key={record.id} style={styles.card}>
            <View style={styles.recordHeader}>
              <View style={styles.icon}><Ionicons name="document-text-outline" size={18} color={palette.primary} /></View>
              <View style={styles.recordHeading}>
                <Text style={styles.title}>{record.title}</Text>
                <Text style={styles.meta}>{[record.recordType, record.organisation, record.status].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>
            <Text style={styles.meta}>
              Submitted by: {record.owner ? `${record.owner.firstName} ${record.owner.lastName} (${record.owner.role})` : 'Account unavailable'}
            </Text>
            {record.description ? <Text style={styles.description}>{record.description}</Text> : null}
            {record.verificationHistory?.map((decision, index) => (
              <Text key={`${record.id}-review-${index}`} style={styles.meta}>
                Previous review: {decision.decision.replaceAll('_', ' ')} · {decision.reviewedAt.slice(0, 10)}
                {decision.comment ? ` · ${decision.comment}` : ''}
                {decision.requirements?.length ? ` · Needed: ${decision.requirements.join(', ')}` : ''}
              </Text>
            ))}
            {record.documents?.map((document) => (
              <Pressable key={document.id} accessibilityRole="button" onPress={() => void openDocument(record, document)}>
                <Text style={styles.documentLink}>Open {document.filename}</Text>
              </Pressable>
            ))}
            <TextInput
              accessibilityLabel={`Review note for ${record.title}`}
              value={comments[record.id] || ''}
              onChangeText={(text) => setComments((current) => ({ ...current, [record.id]: text }))}
              maxLength={1000}
              multiline
              placeholder="Review note or reason (required for rejection / more information)"
              style={styles.input}
            />
            <View style={styles.actions}>
              <DecisionButton label="Verify" disabled={Boolean(busyId)} onPress={() => void decide(record, 'verify')} />
              <DecisionButton label="Request information" disabled={Boolean(busyId)} onPress={() => void decide(record, 'request_information')} secondary />
              <DecisionButton label="Reject" disabled={Boolean(busyId)} onPress={() => void decide(record, 'reject')} secondary />
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function DecisionButton({ label, onPress, disabled, secondary = false }: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary && styles.secondaryButton, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F8F5' },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: spacing.md, paddingBottom: 48 },
  eyebrow: { color: palette.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heading: { color: palette.text, fontSize: 25, fontWeight: '800', marginTop: 4 },
  description: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  loader: { marginTop: spacing.lg },
  errorCard: { backgroundColor: '#FBE8E6', borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.md },
  errorText: { color: palette.danger, fontSize: 12 },
  retry: { color: palette.primary, fontWeight: '800', marginTop: 6 },
  emptyCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md },
  card: { backgroundColor: '#FFFFFF', borderRadius: radius.md, borderWidth: 1, borderColor: '#E8EEEA', padding: spacing.md, marginTop: spacing.md },
  recordHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2F2E9', borderRadius: 10 },
  recordHeading: { flex: 1, marginLeft: spacing.sm },
  title: { color: palette.text, fontSize: 14, fontWeight: '800' },
  meta: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  documentLink: { color: palette.primary, fontSize: 11, fontWeight: '700', marginTop: 6 },
  input: { minHeight: 66, borderWidth: 1, borderColor: '#D9E3DD', borderRadius: 9, padding: 10, color: palette.text, textAlignVertical: 'top', marginTop: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  button: { minHeight: 38, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm, backgroundColor: palette.primary, borderRadius: 9 },
  secondaryButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C9D8CF' },
  buttonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  secondaryButtonText: { color: palette.primaryDark },
  disabled: { opacity: 0.55 },
});
