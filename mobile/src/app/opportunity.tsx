import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/navigation/back-button';
import { ApplicationForm, ApplicationSubmission } from '@/components/applications/application-form';
import { AppRole, useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type Opportunity = {
  id: string;
  title: string;
  type: string;
  category: string;
  status: string;
  role: AppRole | '*';
  description: string;
  organization?: string;
  location?: string;
  employmentType?: string;
  requirements?: string[];
  qualifications?: string;
  trainingObjectives?: string;
  requiredSkills?: string[];
  participantCount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  accreditation?: string;
  duration?: string;
  deliveryMethod?: string;
  capacity?: number | null;
  fees?: number | null;
  benefits: string[];
  eligibility: string[];
  requiredDocuments: string[];
  applicationInstructions: string;
  applicationUrl?: string;
  openingDate: string | null;
  closingDate: string | null;
  opportunityDetails?: Record<string, string>;
  eligibilityCriteria?: Record<string, string>;
  applicationQuestions?: {
    title: string;
    type: string;
    required: boolean;
    description: string;
    options: string[];
  }[];
  applicationTermsAndConditions?: string;
  requiredApplicantInformation?: string[];
  sourceName?: string;
  sourceUrl?: string;
  sourceVerifiedAt?: string;
  recordExpiresAt?: string;
  dataStatus: string;
  isDemo: boolean;
  saved: boolean;
};

type Application = {
  id: string;
  reference: string;
  opportunityId?: string;
  status: string;
  submittedAt: string | null;
  updatedAt: string;
  outstandingRequirements: string[];
  documents: { id: string; requirement: string; filename: string; mimeType: string; size: number }[];
};

export default function OpportunityScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    if (!id) return;

    Promise.all([
      apiFetch<{ opportunity: Opportunity }>(`/opportunities/${encodeURIComponent(id)}`),
      apiFetch<{ applications: Application[] }>('/applications'),
    ])
      .then(([opportunityPayload, applicationPayload]) => {
        if (isCurrent) {
          setOpportunity(opportunityPayload.opportunity);
          setApplication(
            applicationPayload.applications.find(
              (entry) => entry.opportunityId === id && entry.status !== 'Withdrawn'
            ) ?? null
          );
          setErrorMessage('');
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setErrorMessage(error instanceof Error ? error.message : 'Opportunity details could not be loaded.');
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [id, retry, session]);

  const canApply = Boolean(
    opportunity && (opportunity.role === '*' || opportunity.role === session?.activeRole)
  );
  const isOpen = opportunity?.status === 'Open';
  const isClosed = opportunity?.status === 'Closed';

  const openInformationSource = async () => {
    try {
      const source = new URL(opportunity?.sourceUrl || '');
      if (!['http:', 'https:'].includes(source.protocol) || source.username || source.password) {
        throw new Error('This listing does not have a safe information-source link.');
      }
      await Linking.openURL(source.href);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The information source could not be opened.');
    }
  };

  const openApplicationPage = async () => {
    try {
      const target = new URL(opportunity?.applicationUrl || '');
      if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
        throw new Error('This listing does not have a safe application link.');
      }
      await Linking.openURL(target.href);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The application page could not be opened.');
    }
  };

  const createApplication = async (draft: boolean, submission: ApplicationSubmission) => {
    if (!id || !opportunity || busy) return;
    setBusy(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const payload = await apiFetch<{ application: Application }>('/applications', {
        method: 'POST',
        body: JSON.stringify({ opportunityId: id, draft, ...submission }),
      });
      setApplication(payload.application);
      setSuccessMessage(draft ? 'Draft saved to your application tracker.' : 'Application submitted to this prototype tracker.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Your application could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const submitDraft = async () => {
    if (!application || busy) return;
    setBusy(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const payload = await apiFetch<{ application: Application }>(`/applications/${encodeURIComponent(application.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'submit' }),
      });
      setApplication(payload.application);
      setSuccessMessage('Your application has been submitted to this prototype tracker.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Your application could not be submitted.');
    } finally {
      setBusy(false);
    }
  };

  const toggleSaved = async () => {
    if (!id || !opportunity || busy) return;
    setBusy(true);
    setErrorMessage('');
    try {
      await apiFetch(`/opportunities/${encodeURIComponent(id)}/saved`, {
        method: opportunity.saved ? 'DELETE' : 'POST',
      });
      setOpportunity({ ...opportunity, saved: !opportunity.saved });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The saved opportunity could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  if (!id) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <BackButton fallbackHref="/opportunities" />
          <View style={styles.stateBlock}>
            <Text style={styles.errorText}>This opportunity could not be found.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <BackButton fallbackHref="/opportunities" />
          <View style={styles.center}><ActivityIndicator size="large" color={palette.primary} /></View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <BackButton fallbackHref="/opportunities" />
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator
          persistentScrollbar
        >
        {errorMessage && !opportunity ? (
          <View style={styles.stateBlock}>
            <Ionicons name="alert-circle-outline" size={34} color={palette.danger} />
            <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text>
            <Pressable accessibilityRole="button" onPress={() => {
              setLoading(true);
              setErrorMessage('');
              setRetry((current) => current + 1);
            }} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : opportunity ? (
          <>
            <View style={styles.hero}>
              {imageFailed ? (
                <View accessible accessibilityLabel="Agricultural image unavailable" style={styles.imageFallback}>
                  <Ionicons name="leaf-outline" size={48} color="#FFFFFF" />
                </View>
              ) : (
                <Image
                  accessible
                  accessibilityLabel="Agricultural landscape"
                  source={require('@/assets/images/farm-hero-farmer.jpg')}
                  contentFit="cover"
                  onError={() => setImageFailed(true)}
                  style={styles.heroImage}
                />
              )}
              <View style={styles.heroTint} />
              <Text style={styles.heroCategory}>{opportunity.category || opportunity.type}</Text>
              <Text style={styles.heroTitle}>{opportunity.title}</Text>
            </View>

            <View style={styles.detail}>
              <View style={styles.audienceRow}>
                <View style={[styles.statusPill, isOpen ? styles.openPill : isClosed ? styles.closedPill : styles.prototypePill]}>
                  <Text style={[styles.statusText, isOpen ? styles.openText : isClosed ? styles.closedText : styles.prototypeText]}>
                    {opportunity.status}
                  </Text>
                </View>
                <Text style={styles.audience}>For {opportunity.role === '*' ? 'eligible users' : roleLabel(opportunity.role)}</Text>
              </View>

              <DetailSection title="About this opportunity">
                <Text style={styles.body}>{opportunity.description}</Text>
              </DetailSection>

              <DetailSection title="Organisation and location">
                <Text style={styles.body}>{opportunity.organization || 'Organisation not provided'}</Text>
                <Text style={styles.mutedBody}>{opportunity.location || 'Location not provided'}</Text>
                {opportunity.employmentType ? <Text style={styles.mutedBody}>Employment type: {opportunity.employmentType}</Text> : null}
              </DetailSection>

              <DetailSection title="Eligibility">
                <BulletList items={opportunity.eligibility} emptyText="Eligibility criteria have not been verified." />
                {Object.entries(opportunity.eligibilityCriteria || {}).filter(([, value]) => value.trim()).map(([key, value]) => (
                  <Text key={key} style={styles.mutedBody}>{key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}: {value}</Text>
                ))}
              </DetailSection>

              {Object.values(opportunity.opportunityDetails || {}).some((value) => value.trim()) ? (
                <DetailSection title="Opportunity details">
                  {Object.entries(opportunity.opportunityDetails || {}).filter(([, value]) => value.trim()).map(([key, value]) => (
                    <Text key={key} style={styles.mutedBody}>{key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}: {value}</Text>
                  ))}
                </DetailSection>
              ) : null}

              {opportunity.requirements?.length ? (
                <DetailSection title="Requirements">
                  <BulletList items={opportunity.requirements} emptyText="No requirements were provided." />
                  {opportunity.qualifications ? <Text style={styles.body}>Qualifications: {opportunity.qualifications}</Text> : null}
                  {opportunity.requiredSkills?.length ? <BulletList items={opportunity.requiredSkills} emptyText="No required skills listed." /> : null}
                </DetailSection>
              ) : opportunity.qualifications ? (
                <DetailSection title="Qualifications">
                  <Text style={styles.body}>{opportunity.qualifications}</Text>
                </DetailSection>
              ) : null}

              {opportunity.trainingObjectives || opportunity.duration || opportunity.startDate || opportunity.capacity ? (
                <DetailSection title="Programme details">
                  {opportunity.trainingObjectives ? <Text style={styles.body}>Objectives / learning outcomes: {opportunity.trainingObjectives}</Text> : null}
                  {opportunity.accreditation ? <Text style={styles.mutedBody}>Accreditation information: {opportunity.accreditation} (not independently verified)</Text> : null}
                  {opportunity.duration ? <Text style={styles.mutedBody}>Duration: {opportunity.duration}</Text> : null}
                  {opportunity.deliveryMethod ? <Text style={styles.mutedBody}>Delivery: {opportunity.deliveryMethod}</Text> : null}
                  {opportunity.startDate || opportunity.endDate ? <Text style={styles.mutedBody}>Programme dates: {opportunity.startDate || 'Not set'} to {opportunity.endDate || 'Not set'}</Text> : null}
                  {opportunity.participantCount ? <Text style={styles.mutedBody}>Participants: {opportunity.participantCount}</Text> : null}
                  {opportunity.capacity ? <Text style={styles.mutedBody}>Learner capacity: {opportunity.capacity}</Text> : null}
                  {opportunity.fees !== null && opportunity.fees !== undefined ? <Text style={styles.mutedBody}>Programme fee: R {opportunity.fees.toLocaleString('en-ZA')}</Text> : null}
                </DetailSection>
              ) : null}

              <DetailSection title="Benefits">
                <BulletList items={opportunity.benefits} emptyText="No confirmed benefits are available in this prototype." />
              </DetailSection>

              <DetailSection title="Required documents">
                <BulletList items={opportunity.requiredDocuments} emptyText="No document requirements have been published." />
              </DetailSection>

              <DetailSection title="Application instructions">
                <Text style={styles.body}>{opportunity.applicationInstructions}</Text>
                {opportunity.openingDate ? <Text style={styles.mutedBody}>Applications open: {opportunity.openingDate}</Text> : null}
                {opportunity.applicationTermsAndConditions ? <Text style={styles.mutedBody}>Terms: {opportunity.applicationTermsAndConditions}</Text> : null}
                {opportunity.applicationQuestions?.length ? (
                  <Text style={styles.mutedBody}>{opportunity.applicationQuestions.length} additional application question(s) will be asked.</Text>
                ) : null}
              </DetailSection>

              {opportunity.sourceName ? (
                <DetailSection title="Information source">
                  <Text style={styles.body}>{opportunity.sourceName}</Text>
                  {opportunity.sourceVerifiedAt ? <Text style={styles.mutedBody}>Last checked: {opportunity.sourceVerifiedAt}</Text> : null}
                  {opportunity.recordExpiresAt ? <Text style={styles.mutedBody}>Listing expires: {opportunity.recordExpiresAt}</Text> : null}
                  {opportunity.sourceUrl ? <Text selectable style={styles.mutedBody}>{opportunity.sourceUrl}</Text> : null}
                  {opportunity.sourceUrl ? (
                    <Pressable accessibilityRole="button" onPress={() => void openInformationSource()} style={styles.secondaryButton}>
                      <Text style={styles.secondaryButtonText}>Open {opportunity.sourceName} source</Text>
                    </Pressable>
                  ) : null}
                </DetailSection>
              ) : null}

              <View style={styles.datesCard}>
                <DateLine label="Opens" date={opportunity.openingDate} />
                <DateLine label="Closes" date={opportunity.closingDate} />
              </View>

              <View style={styles.dataNotice}>
                <Ionicons name="information-circle-outline" size={19} color={palette.warning} />
                <Text style={styles.dataNoticeText}>
                  {opportunity.dataStatus} Applications are stored in your account and may be reviewed by authorized platform staff. They are not sent to an external provider.
                </Text>
              </View>

              {canApply && isOpen && opportunity.applicationUrl ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void openApplicationPage()}
                  style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}
                >
                  <Text style={styles.applyText}>Apply on {opportunity.organization || 'the provider'} website</Text>
                  <Ionicons name="open-outline" size={16} color="#FFFFFF" />
                </Pressable>
              ) : null}

              {application ? (
                <View style={styles.applicationState}>
                  <Text style={styles.sectionTitle}>Your application</Text>
                  <Text style={styles.applicationReference}>Reference {application.reference}</Text>
                  <Text style={styles.applicationStatus}>{application.status}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/applications', params: { id: application.id } })}
                    style={styles.secondaryAction}
                  >
                    <Text style={styles.secondaryButtonText}>View application</Text>
                    <Ionicons name="arrow-forward" size={15} color={palette.primary} />
                  </Pressable>
                  {application.status === 'Draft' ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void submitDraft()}
                      style={({ pressed }) => [styles.applyButton, pressed && styles.pressed, busy && styles.disabled]}
                    >
                      {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.applyText}>Submit draft</Text>}
                    </Pressable>
                  ) : null}
                </View>
              ) : canApply && isOpen ? (
                <>
                  <Text style={styles.mutedBody}>
                    {opportunity.applicationUrl
                      ? 'The external application is completed on the organisation’s website. The optional form below only tracks your interest in MyAgriSETA.'
                      : 'The form below records your interest in MyAgriSETA only. Follow the published application instructions to apply with the organisation.'}
                  </Text>
                  <ApplicationForm
                    initialName={`${session?.user.firstName || ''} ${session?.user.lastName || ''}`.trim()}
                    initialEmail={session?.user.email || ''}
                    initialPhone={session?.user.phone}
                    requiredDocuments={opportunity.requiredDocuments || []}
                    customQuestions={opportunity.applicationQuestions || []}
                    requiredApplicantInformation={opportunity.requiredApplicantInformation || []}
                    applicationTermsAndConditions={opportunity.applicationTermsAndConditions || ''}
                    busy={busy}
                    reviewerNotice={opportunity.category === 'Employment' ||
                      opportunity.category === 'Internship' ||
                      opportunity.category === 'Workplace Opportunity'
                      ? `${opportunity.organization || 'the employer'} and authorized platform reviewers for recruitment`
                      : opportunity.category === 'Training Need'
                        ? `${opportunity.organization || 'the employer'} and authorized platform reviewers to respond to this training request`
                        : `${opportunity.organization || 'the opportunity owner'} and authorized platform reviewers`}
                    onSubmit={createApplication}
                  />
                </>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/services')}
                  style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryButtonText}>
                    {canApply ? 'Applications are not open' : 'Explore available services'}
                  </Text>
                  {!canApply ? <Ionicons name="arrow-forward" size={15} color={palette.primary} /> : null}
                </Pressable>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: opportunity.saved, disabled: busy }}
                disabled={busy}
                onPress={() => void toggleSaved()}
                style={({ pressed }) => [styles.bookmarkAction, pressed && styles.pressed]}
              >
                <Ionicons name={opportunity.saved ? 'bookmark' : 'bookmark-outline'} size={17} color={palette.primary} />
                <Text style={styles.secondaryButtonText}>{opportunity.saved ? 'Remove from saved' : 'Save opportunity'}</Text>
              </Pressable>

              {successMessage ? (
                <Text accessibilityRole="alert" style={styles.successText}>{successMessage}</Text>
              ) : null}
              {errorMessage ? <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text> : null}
            </View>
          </>
        ) : (
          <View style={styles.stateBlock}>
            <Text style={styles.errorText}>This opportunity could not be found.</Text>
          </View>
        )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BulletList({ items, emptyText }: { items: string[]; emptyText: string }) {
  return items.length ? (
    <View style={styles.bulletList}>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <Ionicons name="checkmark-circle-outline" size={16} color={palette.primary} />
          <Text style={styles.body}>{item}</Text>
        </View>
      ))}
    </View>
  ) : <Text style={styles.mutedBody}>{emptyText}</Text>;
}

function DateLine({ label, date }: { label: string; date: string | null }) {
  return (
    <View style={styles.dateLine}>
      <Text style={styles.dateLabel}>{label}</Text>
      <Text style={styles.dateValue}>{date ? formatDate(date) : 'No verified date published'}</Text>
    </View>
  );
}

function roleLabel(role: AppRole) {
  const labels: Record<AppRole, string> = {
    learner: 'Learners',
    farmer: 'Farmers',
    employer: 'Employers',
    smme: 'SMMEs',
    sdf: 'Skills Development Facilitators',
    training_provider: 'Training Providers',
    assessor: 'Assessors',
    administrator: 'Administrators',
    internal_staff: 'Internal staff',
  };
  return labels[role];
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  screen: { flex: 1, padding: spacing.md },
  container: { flexGrow: 1, padding: spacing.lg, paddingBottom: 100 },
  hero: { minHeight: 190, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: palette.primaryDark, justifyContent: 'flex-end' },
  heroImage: { ...StyleSheet.absoluteFill },
  imageFallback: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  heroTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4, 28, 19, 0.48)' },
  heroCategory: { color: '#F3D984', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: spacing.lg },
  heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 31, fontWeight: '800', margin: spacing.lg, marginTop: spacing.xs },
  detail: { backgroundColor: palette.surface, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md },
  audienceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusPill: { borderRadius: 16, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  openPill: { backgroundColor: '#E6F3EB' },
  closedPill: { backgroundColor: '#F8E8E6' },
  prototypePill: { backgroundColor: '#F1F0EC' },
  statusText: { fontSize: 11, fontWeight: '800' },
  openText: { color: palette.success },
  closedText: { color: palette.danger },
  prototypeText: { color: '#78672F' },
  audience: { color: palette.muted, fontSize: 12, flexShrink: 1 },
  section: { borderTopWidth: 1, borderTopColor: palette.border, marginTop: spacing.lg, paddingTop: spacing.md },
  sectionTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  body: { color: palette.text, fontSize: 13, lineHeight: 20, marginTop: spacing.xs },
  mutedBody: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
  bulletList: { gap: spacing.xs, marginTop: spacing.xs },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  datesCard: { backgroundColor: palette.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg, gap: spacing.sm },
  dateLine: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  dateLabel: { color: palette.primaryDark, fontSize: 12, fontWeight: '800' },
  dateValue: { color: palette.muted, fontSize: 12, textAlign: 'right', flexShrink: 1 },
  dataNotice: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F6F0DF', borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.md, gap: spacing.xs },
  dataNoticeText: { flex: 1, color: '#685522', fontSize: 11, lineHeight: 16 },
  applicationState: { borderTopWidth: 1, borderTopColor: palette.border, marginTop: spacing.lg, paddingTop: spacing.md },
  applicationReference: { color: palette.muted, fontSize: 12, marginTop: spacing.xs },
  applicationStatus: { color: palette.primaryDark, fontWeight: '800', fontSize: 13, marginTop: spacing.xs },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  applyButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  applyText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderColor: palette.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, marginTop: spacing.md },
  bookmarkAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm },
  secondaryButton: { minHeight: 42, justifyContent: 'center', borderWidth: 1, borderColor: palette.primary, borderRadius: radius.sm, paddingHorizontal: spacing.md, marginTop: spacing.md },
  secondaryButtonText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.65 },
  successText: { color: palette.success, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.md },
  errorText: { color: palette.danger, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.md },
  stateBlock: { alignItems: 'center', marginTop: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
});
