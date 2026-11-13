import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/navigation/back-button';
import { ApplicationForm, ApplicationSubmission } from '@/components/applications/application-form';
import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type Service = {
  id: string;
  name: string;
  category: string;
  description: string;
  location: string;
  status: string;
  applicationDeadline: string;
  eligibility: string[];
  dataStatus: string;
  requiredDocuments: string[];
};

type Application = {
  id: string;
  serviceId?: string;
  reference: string;
  status: string;
  documents: { id: string; requirement: string; filename: string; mimeType: string; size: number }[];
};

type ApplicationFeedback = {
  serviceId: string;
  kind: 'success' | 'error';
  message: string;
};

export default function ServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const serviceId = typeof id === 'string' ? id : '';
  const [service, setService] = useState<Service | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [checkedServiceId, setCheckedServiceId] = useState('');
  const [applicationCheckError, setApplicationCheckError] = useState<{ serviceId: string; message: string } | null>(null);
  const [feedback, setFeedback] = useState<ApplicationFeedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requiredDocumentText, setRequiredDocumentText] = useState('');
  const [savingRequirements, setSavingRequirements] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const [settledRequestKey, setSettledRequestKey] = useState('');
  const requestKey = `${serviceId}:${retry}`;
  const loading = settledRequestKey !== requestKey;
  const checkingApplication = checkedServiceId !== serviceId;
  const currentApplication = application?.serviceId === serviceId ? application : null;

  useEffect(() => {
    let isCurrent = true;

    apiFetch<{ service: Service }>(`/services/${encodeURIComponent(serviceId)}`)
      .then((payload) => {
        if (isCurrent) {
          setService(payload.service);
          setRequiredDocumentText((payload.service.requiredDocuments || []).join('\n'));
          setErrorMessage('');
        }
      })
      .catch(() => {
        if (isCurrent) {
          setService(null);
          setErrorMessage('This service could not be loaded. It may be unavailable to your account.');
        }
      })
      .finally(() => {
        if (isCurrent) {
          setSettledRequestKey(requestKey);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [requestKey, serviceId]);

  useEffect(() => {
    let isCurrent = true;

    apiFetch<{ applications: Application[] }>('/applications')
      .then(({ applications }) => {
        if (isCurrent) {
          setApplication(applications.find(
            (entry) => entry.serviceId === serviceId && entry.status !== 'Withdrawn'
          ) ?? null);
          setApplicationCheckError(null);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setApplicationCheckError({
            serviceId,
            message: error instanceof Error ? error.message : 'Your application status could not be checked.',
          });
        }
      })
      .finally(() => {
        if (isCurrent) {
          setCheckedServiceId(serviceId);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [serviceId]);

  const apply = async (draft: boolean, submission: ApplicationSubmission) => {
    if (!service || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = await apiFetch<{ application: Application }>('/applications', {
        method: 'POST',
        body: JSON.stringify({ serviceId: service.id, draft, ...submission }),
      });
      setApplication(payload.application);
      setFeedback({
        serviceId,
        kind: 'success',
        message: `Your application was submitted. Reference: ${payload.application.reference}`,
      });
    } catch (error) {
      setFeedback({
        serviceId,
        kind: 'error',
        message: error instanceof Error ? error.message : 'Your application could not be submitted. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitDraft = async () => {
    if (!currentApplication || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const payload = await apiFetch<{ application: Application }>(`/applications/${encodeURIComponent(currentApplication.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'submit' }),
      });
      setApplication(payload.application);
      setFeedback({ serviceId, kind: 'success', message: `Your application was submitted. Reference: ${payload.application.reference}` });
    } catch (error) {
      setFeedback({
        serviceId,
        kind: 'error',
        message: error instanceof Error ? error.message : 'Your application could not be submitted.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const saveRequirements = async () => {
    if (!service || savingRequirements) return;
    setSavingRequirements(true);
    setFeedback(null);
    try {
      const requiredDocuments = requiredDocumentText.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
      const payload = await apiFetch<{ service: Service }>(`/admin/services/${encodeURIComponent(service.id)}/requirements`, {
        method: 'PATCH',
        body: JSON.stringify({ requiredDocuments }),
      });
      setService(payload.service);
      setRequiredDocumentText(payload.service.requiredDocuments.join('\n'));
      setFeedback({ serviceId, kind: 'success', message: 'Required documents were updated for this service.' });
    } catch (error) {
      setFeedback({
        serviceId,
        kind: 'error',
        message: error instanceof Error ? error.message : 'Service document requirements could not be saved.',
      });
    } finally {
      setSavingRequirements(false);
    }
  };

  const viewApplication = () => {
    if (!currentApplication) return;
    router.push({ pathname: '/applications', params: { id: currentApplication.id } });
  };

  if (loading || !serviceId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.page}>
          <BackButton fallbackHref="/services" />
          <View style={styles.center}>
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <BackButton fallbackHref="/services" />
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator
          persistentScrollbar
        >
          {errorMessage || !service ? (
            <View style={styles.errorState}>
              <Ionicons name="alert-circle-outline" size={40} color={palette.warning} />
              <Text style={styles.loadErrorText}>{errorMessage || 'This service could not be found.'}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setErrorMessage('');
                  setRetry((current) => current + 1);
                }}
                style={styles.button}
              >
                <Text style={styles.buttonText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.eyebrow}>{service.category}</Text>
              <Text style={styles.heading}>{service.name}</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusIcon}>
                  <Ionicons name={service.status === 'open' ? 'checkmark-circle' : 'information-circle'} size={20} color={palette.primary} />
                </View>
                <Text style={styles.statusText}>
                  {service.id === 'svc-learn'
                    ? 'Learning portal available · listings are demonstrations'
                    : service.status === 'open' ? 'Available in this prototype' : 'Prototype information only'}
                </Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>About this service</Text>
                <Text style={styles.body}>{service.description}</Text>
                <Text style={styles.meta}>{service.dataStatus}</Text>
                <Text style={styles.meta}>Access: {service.eligibility.join(', ')}</Text>
                <Text style={styles.meta}>Availability: {service.location}</Text>
                {service.applicationDeadline !== 'Not applicable' ? (
                  <Text style={styles.meta}>Application deadline: {service.applicationDeadline}</Text>
                ) : null}
                <Text style={styles.sectionTitle}>Required documents</Text>
                {service.requiredDocuments.length
                  ? service.requiredDocuments.map((document) => <Text key={document} style={styles.meta}>• {document}</Text>)
                  : <Text style={styles.meta}>No documents are required for this service.</Text>}
              </View>
              {session?.activeRole === 'administrator' ? (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Set required documents</Text>
                  <Text style={styles.meta}>Enter one item per line. Do not request identity, passport, bank, health, or biometric documents.</Text>
                  <TextInput
                    accessibilityLabel="Service required documents"
                    value={requiredDocumentText}
                    onChangeText={setRequiredDocumentText}
                    placeholder={'CV or work history\nTraining plan'}
                    multiline
                    maxLength={804}
                    style={styles.requirementsInput}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={savingRequirements}
                    onPress={() => void saveRequirements()}
                    style={[styles.button, savingRequirements && styles.buttonDisabled]}
                  >
                    <Text style={styles.buttonText}>{savingRequirements ? 'Saving...' : 'Save document requirements'}</Text>
                  </Pressable>
                </View>
              ) : null}
              {service.id === 'svc-learn' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={session?.activeRole === 'administrator'
                    ? 'Open AgriLearn learning administration'
                    : 'Open AgriLearn agricultural learning portal'}
                  onPress={() => router.push(session?.activeRole === 'administrator'
                    ? { pathname: '/learning', params: { section: 'Learning administration' } }
                    : '/learning')}
                  style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.buttonText}>
                    {session?.activeRole === 'administrator' ? 'Manage learning programmes & materials' : 'Explore AgriLearn'}
                  </Text>
                </Pressable>
              ) : null}
              {service.id !== 'svc-learn' && applicationCheckError?.serviceId === serviceId ? (
                <View style={styles.checkNotice}>
                  <Ionicons name="information-circle-outline" size={18} color={palette.warning} />
                  <Text style={styles.checkNoticeText}>
                    We could not check for an existing application. The server will still prevent duplicate applications.
                  </Text>
                </View>
              ) : null}
              {service.id !== 'svc-learn' && feedback?.serviceId === serviceId ? (
                <View
                  accessibilityRole={feedback.kind === 'error' ? 'alert' : 'text'}
                  accessibilityLiveRegion="polite"
                  style={[styles.feedback, feedback.kind === 'success' ? styles.successFeedback : styles.errorFeedback]}
                >
                  <Ionicons
                    name={feedback.kind === 'success' ? 'checkmark-circle' : 'alert-circle'}
                    size={20}
                    color={feedback.kind === 'success' ? palette.success : palette.danger}
                  />
                  <Text style={[styles.feedbackText, feedback.kind === 'success' ? styles.successText : styles.errorText]}>
                    {feedback.message}
                  </Text>
                </View>
              ) : null}
              {service.id === 'svc-learn' ? null : service.status === 'open' &&
                service.eligibility.includes(session?.activeRole || '') ? (
                currentApplication ? (
                  <View style={styles.applicationCard}>
                    <Text style={styles.applicationTitle}>Your application</Text>
                    <Text style={styles.applicationMeta}>Reference: {currentApplication.reference}</Text>
                    <Text style={styles.applicationMeta}>Status: {currentApplication.status}</Text>
                    {currentApplication.status === 'Draft' ? (
                      <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void submitDraft()} style={[styles.button, submitting && styles.buttonDisabled]}>
                        <Text style={styles.buttonText}>{submitting ? 'Submitting...' : 'Submit draft'}</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      onPress={viewApplication}
                      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                    >
                      <Text style={styles.buttonText}>View my application</Text>
                    </Pressable>
                  </View>
                ) : (
                  checkingApplication
                    ? <Text style={styles.meta}>Checking your existing application...</Text>
                    : <ApplicationForm
                      initialName={`${session?.user.firstName || ''} ${session?.user.lastName || ''}`.trim()}
                      initialEmail={session?.user.email || ''}
                      initialPhone={session?.user.phone}
                      requiredDocuments={service.requiredDocuments || []}
                      busy={submitting}
                      onSubmit={apply}
                    />
                )
              ) : (
                <View style={styles.notice}>
                  <Ionicons name="information-circle-outline" size={20} color={palette.primaryDark} />
                  <Text style={styles.noticeText}>
                    No official records or external service are connected.
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  page: { flex: 1, padding: spacing.lg },
  container: { paddingBottom: 120 },
  eyebrow: { color: palette.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  heading: { color: palette.text, fontSize: 28, fontWeight: '800', marginTop: spacing.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  statusText: { color: palette.primaryDark, fontWeight: '700' },
  card: { backgroundColor: palette.surface, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '800' },
  body: { color: palette.text, lineHeight: 23, marginTop: spacing.md },
  meta: { color: palette.muted, marginTop: spacing.md, lineHeight: 20 },
  checkNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FBF1D8',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  checkNoticeText: { flex: 1, color: palette.text, lineHeight: 20 },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  successFeedback: { backgroundColor: '#E4F3E9' },
  errorFeedback: { backgroundColor: '#F8E8E6' },
  feedbackText: { flex: 1, lineHeight: 21, fontWeight: '600' },
  successText: { color: palette.primaryDark },
  errorText: { color: palette.danger, lineHeight: 22, textAlign: 'center', marginTop: spacing.md },
  applicationCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  applicationTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  applicationMeta: { color: palette.muted, lineHeight: 20, marginTop: spacing.xs },
  requirementsInput: { minHeight: 100, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, padding: spacing.md, color: palette.text, backgroundColor: palette.surface, marginTop: spacing.md, textAlignVertical: 'top' },
  button: {
    backgroundColor: palette.primary,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  buttonDisabled: { opacity: 0.65 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: palette.surfaceAlt, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg },
  noticeText: { flex: 1, color: palette.primaryDark, lineHeight: 20, marginLeft: spacing.sm },
  errorState: { alignItems: 'center', marginTop: spacing.xxl },
  loadErrorText: { color: palette.muted, lineHeight: 22, textAlign: 'center', marginTop: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
});
