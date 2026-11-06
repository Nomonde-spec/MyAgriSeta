import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/navigation/back-button';
import { downloadApplicationDocument } from '@/lib/application-documents';
import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type StatusUpdate = { status: string; date: string; feedback?: string };
type Application = {
  id: string;
  reference: string;
  opportunityId?: string;
  opportunityTitle?: string;
  serviceName: string;
  status: string;
  submittedAt: string | null;
  updatedAt: string;
  outstandingRequirements: string[];
  feedback?: string;
  statusHistory: StatusUpdate[];
  documents: { id: string; requirement: string; filename: string; mimeType: string; size: number }[];
};

const withdrawableStatuses = ['Draft', 'Submitted', 'Under Review', 'Additional Information Required'];

export default function ApplicationsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    apiFetch<{ applications: Application[] }>('/applications')
      .then((payload) => {
        if (isCurrent) {
          setApplications(payload.applications);
          setErrorMessage('');
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setErrorMessage(error instanceof Error ? error.message : 'Your applications could not be loaded.');
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [retry, session]);

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === id),
    [applications, id]
  );

  const withdrawApplication = async (application: Application) => {
    if (busy) return;
    setBusy(true);
    setErrorMessage('');
    try {
      const payload = await apiFetch<{ application: Application }>(`/applications/${encodeURIComponent(application.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'withdraw' }),
      });
      setApplications((current) => current.map((entry) => entry.id === application.id ? payload.application : entry));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The application could not be withdrawn.');
    } finally {
      setBusy(false);
    }
  };

  const backToList = () => router.replace('/applications');

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <BackButton fallbackHref={id ? '/applications' : '/home'} />
          <View style={styles.center}><ActivityIndicator size="large" color={palette.primary} /></View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <BackButton fallbackHref={id ? '/applications' : '/home'} />
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator
          persistentScrollbar
        >
        {id && selectedApplication ? (
          <ApplicationDetails
            application={selectedApplication}
            busy={busy}
            onWithdraw={() => void withdrawApplication(selectedApplication)}
          />
        ) : id ? (
          <View style={styles.stateBlock}>
            <Text style={styles.errorText}>This application could not be found in your account.</Text>
            <Pressable accessibilityRole="button" onPress={backToList} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>View my applications</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.heading}>My applications</Text>
            <Text style={styles.subtitle}>Track applications submitted or drafted by your account.</Text>

            {errorMessage ? (
              <View style={styles.stateBlock}>
                <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text>
                <Pressable accessibilityRole="button" onPress={() => {
                  setLoading(true);
                  setRetry((current) => current + 1);
                }} style={styles.retryButton}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : applications.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="documents-outline" size={28} color={palette.primary} />
                <Text style={styles.emptyText}>You have no applications yet. Open an opportunity to start an application or save a draft.</Text>
                <Pressable accessibilityRole="button" onPress={() => router.push('/opportunities')} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Explore opportunities</Text>
                </Pressable>
              </View>
            ) : (
              applications.map((application) => (
                <View key={application.id} style={styles.applicationCard}>
                  <View style={styles.applicationHeader}>
                    <View style={styles.applicationInfo}>
                      <Text style={styles.applicationTitle}>
                        {application.opportunityTitle || application.serviceName}
                      </Text>
                      <Text style={styles.reference}>Ref: {application.reference}</Text>
                    </View>
                    <StatusBadge status={application.status} />
                  </View>
                  <Text style={styles.dateText}>
                    {application.submittedAt ? `Submitted ${formatDate(application.submittedAt)}` : 'Draft not submitted'}
                  </Text>
                  <Text style={styles.dateText}>Updated {formatDate(application.updatedAt)}</Text>
                  {application.outstandingRequirements.length ? (
                    <Text style={styles.requirementAlert}>
                      {application.outstandingRequirements.length} outstanding requirement{application.outstandingRequirements.length === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/applications', params: { id: application.id } })}
                    style={({ pressed }) => [styles.viewApplicationButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.viewApplicationText}>View application</Text>
                    <Ionicons name="arrow-forward" size={15} color={palette.primary} />
                  </Pressable>
                </View>
              ))
            )}
          </>
        )}
        {id && errorMessage ? <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text> : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function ApplicationDetails({
  application,
  busy,
  onWithdraw,
}: {
  application: Application;
  busy: boolean;
  onWithdraw: () => void;
}) {
  const [documentError, setDocumentError] = useState('');
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);
  const title = application.opportunityTitle || application.serviceName;
  const openDocument = async (document: Application['documents'][number]) => {
    if (downloadingDocumentId) return;
    setDownloadingDocumentId(document.id);
    setDocumentError('');
    try {
      await downloadApplicationDocument(application.id, document.id, document.filename, document.mimeType);
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'The document could not be opened.');
    } finally {
      setDownloadingDocumentId(null);
    }
  };
  return (
    <>
      <Text style={styles.eyebrow}>APPLICATION TRACKER</Text>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.reference}>Reference: {application.reference}</Text>
      <View style={styles.detailStatus}>
        <StatusBadge status={application.status} />
      </View>
      <View style={styles.infoCard}>
        <InfoLine label="Submitted" value={application.submittedAt ? formatDate(application.submittedAt) : 'Not submitted'} />
        <InfoLine label="Last updated" value={formatDate(application.updatedAt)} />
      </View>

      <Text style={styles.sectionTitle}>Status updates</Text>
      {application.statusHistory.length ? application.statusHistory.map((update, index) => (
        <View key={`${update.status}-${update.date}-${index}`} style={styles.timelineRow}>
          <View style={styles.timelineMarker}>
            <View style={[styles.timelineDot, index === application.statusHistory.length - 1 && styles.timelineDotCurrent]} />
            {index < application.statusHistory.length - 1 ? <View style={styles.timelineLine} /> : null}
          </View>
          <View style={styles.timelineContent}>
            <Text style={styles.timelineStatus}>{update.status}</Text>
            <Text style={styles.dateText}>{formatDate(update.date)}</Text>
            {update.feedback ? <Text style={styles.mutedText}>{update.feedback}</Text> : null}
          </View>
        </View>
      )) : <Text style={styles.mutedText}>No status updates are available.</Text>}

      <Text style={styles.sectionTitle}>Outstanding requirements</Text>
      {application.outstandingRequirements.length ? application.outstandingRequirements.map((requirement) => (
        <View key={requirement} style={styles.requirementRow}>
          <Ionicons name="alert-circle-outline" size={16} color={palette.warning} />
          <Text style={styles.requirementText}>{requirement}</Text>
        </View>
      )) : <Text style={styles.mutedText}>There are no outstanding requirements recorded.</Text>}

      <Text style={styles.sectionTitle}>Uploaded documents</Text>
      {application.documents?.length ? application.documents.map((document) => (
        <Pressable
          key={document.id}
          accessibilityRole="button"
          disabled={downloadingDocumentId !== null}
          onPress={() => void openDocument(document)}
          style={styles.documentButton}
        >
          <Text style={styles.documentText}>
            {downloadingDocumentId === document.id ? 'Opening...' : `${document.requirement}: ${document.filename}`}
          </Text>
        </Pressable>
      )) : <Text style={styles.mutedText}>No documents were required for this application.</Text>}
      {documentError ? <Text accessibilityRole="alert" style={styles.errorText}>{documentError}</Text> : null}

      {application.opportunityId ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/opportunity', params: { id: application.opportunityId } })}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>
            {application.status === 'Draft' ? 'Continue application' : 'View opportunity'}
          </Text>
        </Pressable>
      ) : null}
      {withdrawableStatuses.includes(application.status) ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onWithdraw}
          style={({ pressed }) => [styles.withdrawButton, pressed && styles.pressed, busy && styles.disabled]}
        >
          {busy ? <ActivityIndicator size="small" color={palette.danger} /> : <Text style={styles.withdrawText}>Withdraw application</Text>}
        </Pressable>
      ) : null}
    </>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === 'Approved'
    ? styles.approved
    : status === 'Unsuccessful' || status === 'Rejected' || status === 'Withdrawn'
      ? styles.closed
      : status === 'Additional Information Required'
        ? styles.attention
        : styles.inProgress;
  return (
    <View style={[styles.statusBadge, tone]}>
      <Text style={styles.statusText}>{status}</Text>
    </View>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  screen: { flex: 1, padding: spacing.md },
  container: { flexGrow: 1, padding: spacing.lg, paddingBottom: 100 },
  eyebrow: { color: palette.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heading: { color: palette.text, fontSize: 25, lineHeight: 31, fontWeight: '800' },
  subtitle: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  applicationCard: { backgroundColor: palette.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: palette.border },
  applicationHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  applicationInfo: { flex: 1 },
  applicationTitle: { color: palette.text, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  reference: { color: palette.muted, fontSize: 11, marginTop: 5 },
  dateText: { color: palette.muted, fontSize: 11, marginTop: 5 },
  statusBadge: { borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5, maxWidth: 160 },
  statusText: { color: palette.primaryDark, fontSize: 10, fontWeight: '800' },
  approved: { backgroundColor: '#E4F3E9' },
  closed: { backgroundColor: '#F8E8E6' },
  attention: { backgroundColor: '#FBF1D8' },
  inProgress: { backgroundColor: '#E9EFF4' },
  requirementAlert: { color: '#8B5C0A', fontSize: 11, fontWeight: '700', marginTop: spacing.sm },
  viewApplicationButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderColor: palette.primary, borderRadius: radius.sm, marginTop: spacing.md },
  viewApplicationText: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  detailStatus: { alignSelf: 'flex-start', marginTop: spacing.md },
  infoCard: { backgroundColor: palette.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, gap: spacing.sm },
  infoLine: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  infoLabel: { color: palette.muted, fontSize: 12 },
  infoValue: { color: palette.text, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  sectionTitle: { color: palette.text, fontSize: 16, fontWeight: '800', marginTop: spacing.lg, marginBottom: spacing.sm },
  timelineRow: { flexDirection: 'row', minHeight: 48 },
  timelineMarker: { width: 18, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.border, marginTop: 5 },
  timelineDotCurrent: { backgroundColor: palette.primary },
  timelineLine: { width: 2, flex: 1, backgroundColor: palette.border, marginTop: 2 },
  timelineContent: { flex: 1, marginLeft: spacing.sm, paddingBottom: spacing.sm },
  timelineStatus: { color: palette.text, fontSize: 13, fontWeight: '700' },
  mutedText: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  requirementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginBottom: spacing.xs },
  requirementText: { flex: 1, color: palette.text, fontSize: 12, lineHeight: 18 },
  documentButton: { backgroundColor: palette.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.xs },
  documentText: { color: palette.primaryDark, fontSize: 12, fontWeight: '700' },
  secondaryButton: { minHeight: 42, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: palette.primary, borderRadius: radius.sm, marginTop: spacing.md },
  secondaryButtonText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  withdrawButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.danger, borderRadius: radius.sm, marginTop: spacing.sm },
  withdrawText: { color: palette.danger, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
  emptyState: { alignItems: 'center', backgroundColor: palette.surface, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.xl },
  emptyText: { color: palette.muted, textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  primaryButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary, borderRadius: radius.sm, paddingHorizontal: spacing.md, marginTop: spacing.md },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  stateBlock: { alignItems: 'center', padding: spacing.xl },
  errorText: { color: palette.danger, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  retryButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary, borderRadius: radius.sm, paddingHorizontal: spacing.md, marginTop: spacing.md },
  retryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
});
