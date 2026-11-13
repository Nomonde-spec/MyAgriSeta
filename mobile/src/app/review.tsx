import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/navigation/back-button';
import { downloadApplicationDocument } from '@/lib/application-documents';
import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type ReviewApplication = {
  id: string;
  reference: string;
  opportunityId?: string;
  serviceName: string;
  status: string;
  submittedAt: string | null;
  outstandingRequirements: string[];
  feedback?: string;
  documents: { id: string; requirement: string; filename: string; mimeType: string; size: number }[];
  applicationData?: {
    fullName?: string;
    email?: string;
    phone?: string;
    motivation?: string;
    organization?: string;
    accreditation?: string;
  };
  applicant: { name: string; email: string } | null;
};

export default function ReviewScreen() {
  const { section: requestedSection } = useLocalSearchParams<{ section?: string }>();
  const { session } = useAuth();
  const isInternalStaff = session?.activeRole === 'internal_staff';
  const requestedSectionValue = typeof requestedSection === 'string' ? requestedSection : '';
  const section = isInternalStaff && ['documents', 'feedback'].includes(requestedSectionValue)
    ? requestedSectionValue
    : 'queue';
  const [items, setItems] = useState<ReviewApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [documentError, setDocumentError] = useState('');
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const visibleItems = section === 'documents'
    ? items.filter((item) => item.documents.length > 0)
    : section === 'feedback'
      ? items.filter((item) => item.status === 'Additional Information Required' || Boolean(item.feedback) || item.outstandingRequirements.length > 0)
      : items;

  useEffect(() => {
    let isCurrent = true;

    apiFetch<{ applications: ReviewApplication[] }>('/staff/review-queue')
      .then((payload) => {
        if (isCurrent) {
          setItems(payload.applications);
          setErrorMessage('');
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setErrorMessage(error instanceof Error ? error.message : 'The review queue could not be loaded.');
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [session, retry]);

  const updateApplication = async (item: ReviewApplication, status: string) => {
    if (updatingId) return;
    const outstandingRequirements = status === 'Additional Information Required'
      ? (requirements[item.id] || '').split('\n').map((entry) => entry.trim()).filter(Boolean)
      : [];
    setUpdatingId(item.id);
    setActionError('');
    try {
      const payload = await apiFetch<{ application: ReviewApplication }>(
        `/admin/applications/${encodeURIComponent(item.id)}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status, outstandingRequirements, feedback: feedback[item.id] || '' }),
        }
      );
      setItems((current) => current.map((entry) => (
        entry.id === item.id ? { ...entry, ...payload.application } : entry
      )));
      setRequirements((current) => ({ ...current, [item.id]: '' }));
      setFeedback((current) => ({ ...current, [item.id]: '' }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The application status could not be updated.');
    } finally {
      setUpdatingId(null);
    }
  };

  const openDocument = async (application: ReviewApplication, document: ReviewApplication['documents'][number]) => {
    if (downloadingDocumentId) return;
    setDownloadingDocumentId(document.id);
    setDocumentError('');
    try {
      await downloadApplicationDocument(application.id, document.id, document.filename, document.mimeType);
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'The application document could not be opened.');
    } finally {
      setDownloadingDocumentId(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <BackButton fallbackHref="/home" />
          <View style={styles.center}><ActivityIndicator size="large" color={palette.primary} /></View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <BackButton fallbackHref="/home" />
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator
          persistentScrollbar
        >
          <Text style={styles.heading}>
            {isInternalStaff
              ? section === 'documents'
                ? 'Application documents and completeness'
                : section === 'feedback'
                  ? 'Review feedback and information requests'
                  : 'Staff application review queue'
              : 'Application review queue'}
          </Text>
          {isInternalStaff ? (
            <Text style={styles.meta}>
              Review access is role-protected, but individual task assignments and private reviewer notes are not configured. Your feedback is visible to the applicant. Administrators make final approval or rejection decisions.
            </Text>
          ) : null}
        {errorMessage ? (
          <View style={styles.stateBlock}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable accessibilityRole="button" onPress={() => { setLoading(true); setRetry((value) => value + 1); }} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : visibleItems.length === 0 ? (
          <Text style={styles.emptyState}>
            {section === 'documents'
              ? 'No reviewable applications currently have supporting documents.'
              : section === 'feedback'
                ? 'No applications currently need additional information or have review feedback.'
                : 'There are no applications to review.'}
          </Text>
        ) : (
          visibleItems.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={styles.serviceName}>{item.serviceName}</Text>
              <Text style={styles.meta}>Ref: {item.reference}</Text>
              <Text style={styles.meta}>
                {item.status}{item.submittedAt ? ` | Submitted ${item.submittedAt}` : ' | Draft'}
              </Text>
              {item.applicant ? (
                <Text style={styles.meta}>Applicant: {item.applicant.name} · {item.applicant.email}</Text>
              ) : null}
              {item.applicationData?.organization ? <Text style={styles.meta}>Applicant organisation: {item.applicationData.organization}</Text> : null}
              {item.applicationData?.accreditation ? <Text style={styles.meta}>Provider accreditation reference (submitted): {item.applicationData.accreditation}</Text> : null}
              {item.applicationData?.motivation ? (
                <Text style={styles.answerText}>Applicant motivation: {item.applicationData.motivation}</Text>
              ) : null}
              {item.documents.length ? (
                <View style={styles.documents}>
                  <Text style={styles.meta}>Uploaded documents</Text>
                  {item.documents.map((document) => (
                    <Pressable
                      key={document.id}
                      accessibilityRole="button"
                      disabled={downloadingDocumentId !== null}
                      onPress={() => void openDocument(item, document)}
                      style={styles.documentButton}
                    >
                      <Text style={styles.documentText}>
                        {downloadingDocumentId === document.id ? 'Opening...' : `${document.requirement}: ${document.filename}`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : <Text style={styles.meta}>No documents were required for this application.</Text>}
              {item.outstandingRequirements.length ? (
                <Text style={styles.requirementText}>
                  Outstanding: {item.outstandingRequirements.join(', ')}
                </Text>
              ) : null}
              {item.feedback ? <Text style={styles.meta}>Previous feedback: {item.feedback}</Text> : null}
              {['Submitted', 'Under Review', 'Additional Information Required'].includes(item.status) ? (
                <>
                  <TextInput
                    accessibilityLabel={`Requirements for ${item.serviceName}`}
                    multiline
                    placeholder="Additional information required (one item per line)"
                    value={requirements[item.id] ?? ''}
                    onChangeText={(value) => setRequirements((current) => ({ ...current, [item.id]: value }))}
                    style={styles.requirementsInput}
                  />
                  <TextInput
                    accessibilityLabel={`Feedback for ${item.serviceName}`}
                    maxLength={500}
                    multiline
                    placeholder="Review feedback (visible to the applicant)"
                    value={feedback[item.id] ?? ''}
                    onChangeText={(value) => setFeedback((current) => ({ ...current, [item.id]: value }))}
                    style={styles.requirementsInput}
                  />
                  <View style={styles.actions}>
                    {(isInternalStaff
                      ? ['Under Review', 'Additional Information Required']
                      : ['Under Review', 'Additional Information Required', 'Approved', 'Rejected']
                    ).map((status) => (
                      <Pressable
                        key={status}
                        accessibilityRole="button"
                        disabled={updatingId !== null}
                        onPress={() => void updateApplication(item, status)}
                        style={({ pressed }) => [styles.actionButton, pressed && styles.pressed, updatingId !== null && styles.disabled]}
                      >
                        <Text style={styles.actionText}>
                          {updatingId === item.id ? 'Updating...' : status}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ))
        )}
        {actionError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>{actionError}</Text>
        ) : null}
        {documentError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>{documentError}</Text>
        ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  screen: { flex: 1, padding: spacing.md },
  container: { flexGrow: 1, padding: spacing.xl },
  heading: { color: palette.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.md },
  row: { backgroundColor: palette.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  serviceName: { color: palette.text, fontSize: 15, fontWeight: '700' },
  meta: { color: palette.muted, fontSize: 12, marginTop: spacing.xs },
  answerText: { color: palette.text, fontSize: 13, lineHeight: 20, marginTop: spacing.sm },
  requirementText: { color: '#8B5C0A', fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  requirementsInput: { minHeight: 64, textAlignVertical: 'top', borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, padding: spacing.sm, color: palette.text, marginTop: spacing.md },
  documents: { marginTop: spacing.sm },
  documentButton: { backgroundColor: palette.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.xs },
  documentText: { color: palette.primaryDark, fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  actionButton: { minHeight: 36, justifyContent: 'center', backgroundColor: palette.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  actionText: { color: palette.primaryDark, fontSize: 11, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
  emptyState: { color: palette.muted, marginTop: spacing.lg },
  stateBlock: { alignItems: 'center', marginTop: spacing.xl },
  errorText: { color: palette.danger, textAlign: 'center', lineHeight: 20, marginTop: spacing.md },
  retryButton: { backgroundColor: palette.primary, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.md },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
});