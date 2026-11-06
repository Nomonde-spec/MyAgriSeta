import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/navigation/back-button';
import { downloadApplicationDocument, downloadOpportunityDocument } from '@/lib/application-documents';
import { useAuth } from '@/context/auth-context';
import { ApiError, apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type Opportunity = {
  id: string;
  title: string;
  type: string;
  category: string;
  status: string;
  role: string;
  description: string;
  requiredDocuments?: string[];
  closingDate: string | null;
  sourceName?: string;
  sourceUrl?: string;
  applicationUrl?: string;
  sourceVerifiedAt?: string;
  recordExpiresAt?: string;
  dataStatus: string;
  isDemo: boolean;
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
  supportingDocuments?: { id: string; filename: string; mimeType: string; size: number }[];
  applicationInstructions?: string;
  ownerUserId?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string;
  statusHistory?: { status: string; date: string; actor?: string; note?: string }[];
  effectiveStatus?: string;
};

const categories = [
  'Funding',
  'Training',
  'Training Need',
  'Internship',
  'Workplace Opportunity',
  'Mentorship',
  'Employment',
  'Grants',
  'Business Support',
  'Market Access',
  'Innovation',
];
const audiences = [
  { value: 'learner', label: 'Learners' },
  { value: 'farmer', label: 'Farmers' },
  { value: 'employer', label: 'Employers' },
  { value: 'sdf', label: 'SDFs' },
  { value: 'training_provider', label: 'Training providers' },
];
const statuses = ['Open', 'Closed'];
const employmentTypes = ['Permanent', 'Fixed term', 'Seasonal', 'Contract', 'Internship'];
const sortOptions = [
  { value: 'deadline', label: 'Deadline' },
  { value: 'title', label: 'Title' },
  { value: 'newest', label: 'Newest' },
];

export default function OpportunitiesScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const { session } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [serverDate, setServerDate] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(() =>
    typeof params.category === 'string' && categories.includes(params.category)
      ? params.category
      : ''
  );
  const [audience, setAudience] = useState('');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('deadline');
  const [showSaved, setShowSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [savedError, setSavedError] = useState('');
  const [saveBusy, setSaveBusy] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (category) params.set('category', category);
      if (audience) params.set('audience', audience);
      if (employmentTypeFilter) params.set('employmentType', employmentTypeFilter);
      if (status) params.set('status', status);
      params.set('sort', sort);

      setUpdating(true);
      apiFetch<{ opportunities: Opportunity[]; serverDate: string }>(`/opportunities?${params.toString()}`)
        .then((payload) => {
          if (isCurrent) {
            setOpportunities(payload.opportunities);
            setServerDate(payload.serverDate);
            setErrorMessage('');
          }
        })
        .catch((error: unknown) => {
          if (isCurrent) {
            setErrorMessage(error instanceof Error ? error.message : 'Opportunities could not be loaded.');
          }
        })
        .finally(() => {
          if (isCurrent) {
            setLoading(false);
            setUpdating(false);
          }
        });
    }, search.trim() ? 250 : 0);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [audience, category, employmentTypeFilter, retry, search, sort, status, session]);

  useEffect(() => {
    let isCurrent = true;
    apiFetch<{ opportunities: Opportunity[] }>('/opportunities/saved')
      .then((payload) => {
        if (isCurrent) {
          setSavedIds(new Set(payload.opportunities.map((entry) => entry.id)));
          setSavedError('');
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setSavedError(error instanceof Error ? error.message : 'Saved opportunities could not be loaded.');
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [session]);

  const visibleOpportunities = useMemo(
    () => opportunities.filter((opportunity) => !showSaved || savedIds.has(opportunity.id)),
    [opportunities, savedIds, showSaved]
  );
  const recommended = visibleOpportunities.filter(
    (opportunity) => opportunity.role === session?.activeRole && opportunity.status === 'Open'
  );
  const closingSoon = visibleOpportunities.filter((opportunity) => {
    if (!opportunity.closingDate || opportunity.status !== 'Open' || !serverDate) return false;
    const daysUntilClosing = Math.ceil(
      (Date.parse(`${opportunity.closingDate}T00:00:00Z`) - Date.parse(serverDate)) / 86_400_000
    );
    return daysUntilClosing >= 0 && daysUntilClosing <= 30;
  });
  const remaining = visibleOpportunities.filter(
    (opportunity) => !recommended.some((entry) => entry.id === opportunity.id)
  );

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setAudience('');
    setEmploymentTypeFilter('');
    setStatus('');
    setSort('deadline');
  };

  const toggleSaved = async (opportunity: Opportunity) => {
    if (saveBusy) return;
    setSaveBusy(opportunity.id);
    setSavedError('');
    try {
      if (savedIds.has(opportunity.id)) {
        await apiFetch(`/opportunities/${encodeURIComponent(opportunity.id)}/saved`, { method: 'DELETE' });
        setSavedIds((current) => {
          const next = new Set(current);
          next.delete(opportunity.id);
          return next;
        });
      } else {
        await apiFetch(`/opportunities/${encodeURIComponent(opportunity.id)}/saved`, { method: 'POST' });
        setSavedIds((current) => new Set(current).add(opportunity.id));
      }
    } catch (error) {
      setSavedError(error instanceof Error ? error.message : 'The saved opportunity could not be updated.');
    } finally {
      setSaveBusy(null);
    }
  };

  const retryLoading = () => {
    setLoading(true);
    setRetry((current) => current + 1);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <BackButton />
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          persistentScrollbar
        >
          <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>AGRICONNECT 360</Text>
            <Text style={styles.heading}>Opportunities</Text>
            <Text style={styles.subtitle}>Find agriculture opportunities relevant to your journey.</Text>
            </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View my applications"
            onPress={() => router.push('/applications')}
            style={styles.headerButton}
          >
            <Ionicons name="reader-outline" size={19} color={palette.primary} />
          </Pressable>
        </View>

        {session?.activeRole === 'administrator' ? <AdministratorOpportunityManagement /> : null}
        {session?.activeRole === 'employer' ? (
          <>
            <StakeholderOpportunityManagement activeRole="employer" contactEmail={session.user.email} />
            <EmployerApplicantManagement />
            <EmployerCandidateDiscovery />
            <EmployerFundingSupport />
          </>
        ) : null}
        {session?.activeRole === 'sdf' ? (
          <>
            <View style={styles.managementPanel}>
              <Text style={styles.managementSubheading}>Workforce skills planning</Text>
              <Text style={styles.sectionHint}>Assess organisation skills gaps, prepare WSP and ATR working records, and coordinate training cohorts.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/sdf-workforce')} style={styles.managementButton}>
                <Text style={styles.managementButtonText}>Open SDF planning workspace</Text>
              </Pressable>
            </View>
            <StakeholderOpportunityManagement activeRole="sdf" contactEmail={session.user.email} />
          </>
        ) : null}
        {session?.activeRole === 'training_provider' ? <StakeholderOpportunityManagement activeRole="training_provider" contactEmail={session.user.email} /> : null}
        {session && !['administrator', 'employer', 'sdf', 'training_provider'].includes(session.activeRole) ? (
          <View style={styles.managementPanel}>
            <Text style={styles.managementSubheading}>Posting access</Text>
            <Text style={styles.sectionHint}>
              Your assigned role is {session.activeRole.replace('_', ' ')}. Opportunity submissions are available to Employer, SDF, and Training Provider accounts. The audience filter below only filters listings; it does not grant permission to post. Contact an administrator if your account needs a different assigned role.
            </Text>
          </View>
        ) : null}

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={palette.muted} />
          <TextInput
            accessibilityLabel="Search opportunities"
            placeholder="Search opportunities"
            placeholderTextColor={palette.muted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={palette.muted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filterHeading}>
          <Text style={styles.filterLabel}>Category</Text>
          <Pressable accessibilityRole="button" onPress={clearFilters}>
            <Text style={styles.clearText}>Clear filters</Text>
          </Pressable>
        </View>
        <View style={styles.chipRow}>
          <FilterChip label="All" selected={!category} onPress={() => setCategory('')} />
          {categories.map((item) => (
            <FilterChip key={item} label={item} selected={category === item} onPress={() => setCategory(item)} />
          ))}
        </View>

        <Text style={styles.filterLabel}>Employment type</Text>
        <View style={styles.chipRow}>
          <FilterChip label="All types" selected={!employmentTypeFilter} onPress={() => setEmploymentTypeFilter('')} />
          {employmentTypes.map((item) => (
            <FilterChip key={item} label={item} selected={employmentTypeFilter === item} onPress={() => setEmploymentTypeFilter(employmentTypeFilter === item ? '' : item)} />
          ))}
        </View>

        <Text style={styles.filterLabel}>Audience</Text>
        <View style={styles.chipRow}>
          <FilterChip label="All audiences" selected={!audience} onPress={() => setAudience('')} />
          {audiences.map((item) => (
            <FilterChip
              key={item.value}
              label={item.label}
              selected={audience === item.value}
              onPress={() => setAudience(audience === item.value ? '' : item.value)}
            />
          ))}
        </View>

        <Text style={styles.filterLabel}>Application status</Text>
        <View style={styles.chipRow}>
          <FilterChip label="All statuses" selected={!status} onPress={() => setStatus('')} />
          {statuses.map((item) => (
            <FilterChip key={item} label={item} selected={status === item} onPress={() => setStatus(item)} />
          ))}
        </View>

        <View style={styles.filterHeading}>
          <Text style={styles.filterLabel}>Sort by</Text>
          {updating ? <ActivityIndicator size="small" color={palette.primary} /> : null}
        </View>
        <View style={styles.chipRow}>
          {sortOptions.map((item) => (
            <FilterChip key={item.value} label={item.label} selected={sort === item.value} onPress={() => setSort(item.value)} />
          ))}
        </View>

        <View style={styles.modeRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !showSaved }}
            onPress={() => setShowSaved(false)}
            style={[styles.modeButton, !showSaved && styles.modeButtonSelected]}
          >
            <Text style={[styles.modeText, !showSaved && styles.modeTextSelected]}>All opportunities</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: showSaved }}
            onPress={() => setShowSaved(true)}
            style={[styles.modeButton, showSaved && styles.modeButtonSelected]}
          >
            <Ionicons name="bookmark-outline" size={14} color={showSaved ? '#FFFFFF' : palette.primary} />
            <Text style={[styles.modeText, showSaved && styles.modeTextSelected]}>Saved ({savedIds.size})</Text>
          </Pressable>
        </View>

        <View style={styles.prototypeNotice}>
          <Ionicons name="information-circle-outline" size={18} color={palette.primaryDark} />
          <Text style={styles.prototypeText}>
            Listings are prototype information unless an official source is identified. No deadlines are shown unless verified.
          </Text>
        </View>

        {savedError ? <Text accessibilityRole="alert" style={styles.inlineError}>{savedError}</Text> : null}

        {loading ? (
          <ActivityIndicator size="large" color={palette.primary} style={styles.loading} />
        ) : errorMessage ? (
          <View style={styles.stateBlock}>
            <Ionicons name="cloud-offline-outline" size={30} color={palette.danger} />
            <Text style={styles.stateText}>{errorMessage}</Text>
            <Pressable accessibilityRole="button" onPress={retryLoading} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : showSaved ? (
          <View>
            <SectionHeading title="Saved opportunities" count={visibleOpportunities.length} />
            {visibleOpportunities.length ? visibleOpportunities.map((entry) => (
              <OpportunityCard
                key={entry.id}
                opportunity={entry}
                isSaved={savedIds.has(entry.id)}
                saveBusy={saveBusy === entry.id}
                recommended={entry.role === session?.activeRole}
                onSave={() => void toggleSaved(entry)}
              />
            )) : <EmptyState text="You have no saved opportunities matching these filters." />}
          </View>
        ) : visibleOpportunities.length === 0 ? (
          <EmptyState text="No opportunities match your filters. Try changing or clearing the filters." />
        ) : (
          <>
            <SectionHeading title="Recommended for your role" count={recommended.length} />
            <Text style={styles.sectionHint}>
              Recommendations use your account’s assigned role. Profile interests and qualifications are not yet available.
            </Text>
            {recommended.length ? recommended.map((entry) => (
              <OpportunityCard
                key={`recommended-${entry.id}`}
                opportunity={entry}
                isSaved={savedIds.has(entry.id)}
                saveBusy={saveBusy === entry.id}
                recommended
                onSave={() => void toggleSaved(entry)}
              />
            )) : <EmptyState text="No open opportunities currently match your assigned role." />}

            <SectionHeading title="Closing soon" count={closingSoon.length} />
            {closingSoon.length ? closingSoon.map((entry) => (
              <OpportunityCard
                key={`closing-${entry.id}`}
                opportunity={entry}
                isSaved={savedIds.has(entry.id)}
                saveBusy={saveBusy === entry.id}
                recommended={entry.role === session?.activeRole}
                onSave={() => void toggleSaved(entry)}
              />
            )) : <EmptyState text="No verified deadlines are approaching in the next 30 days." />}

            <SectionHeading title="More opportunities" count={remaining.length} />
            {remaining.length ? remaining.map((entry) => (
              <OpportunityCard
                key={`more-${entry.id}`}
                opportunity={entry}
                isSaved={savedIds.has(entry.id)}
                saveBusy={saveBusy === entry.id}
                recommended={false}
                onSave={() => void toggleSaved(entry)}
              />
            )) : <EmptyState text="There are no additional opportunities matching the selected filters." />}
          </>
        )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count !== undefined ? <Text style={styles.sectionCount}>{count}</Text> : null}
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="leaf-outline" size={20} color={palette.primary} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function OpportunityCard({
  opportunity,
  isSaved,
  saveBusy,
  recommended,
  onSave,
}: {
  opportunity: Opportunity;
  isSaved: boolean;
  saveBusy: boolean;
  recommended: boolean;
  onSave: () => void;
}) {
  const { session } = useAuth();
  const [imageFailed, setImageFailed] = useState(false);
  const isOpen = opportunity.status === 'Open';
  const isClosed = opportunity.status === 'Closed';
  const canApply = opportunity.role === '*' || opportunity.role === session?.activeRole;
  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        {imageFailed ? (
          <View accessible accessibilityLabel="Agricultural image unavailable" style={styles.imageFallback}>
            <Ionicons name="leaf-outline" size={40} color="#FFFFFF" />
          </View>
        ) : (
          <Image
            accessible
            accessibilityLabel="Agricultural landscape"
            source={require('@/assets/images/farm-hero-farmer.jpg')}
            contentFit="cover"
            onError={() => setImageFailed(true)}
            style={styles.cardImage}
          />
        )}
        <View style={styles.imageTint} />
        {recommended ? (
          <View style={styles.recommendedBadge}>
            <Ionicons name="sparkles" size={12} color={palette.primaryDark} />
            <Text style={styles.recommendedText}>Recommended for you</Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${isSaved ? 'Remove' : 'Save'} ${opportunity.title}`}
          accessibilityState={{ disabled: saveBusy, selected: isSaved }}
          disabled={saveBusy}
          onPress={onSave}
          style={styles.bookmarkButton}
        >
          {saveBusy ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={palette.primary} />
          )}
        </Pressable>
        <View style={styles.imageTitle}>
          <Text style={styles.imageCategory}>{opportunity.category || opportunity.type}</Text>
          <Text style={styles.cardTitle}>{opportunity.title}</Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.metadataRow}>
          <Text style={styles.audienceTag}>{roleLabel(opportunity.role)}</Text>
          <View style={[styles.statusTag, isOpen ? styles.openTag : isClosed ? styles.closedTag : styles.prototypeTag]}>
            <View style={[styles.statusDot, isOpen ? styles.openDot : isClosed ? styles.closedDot : styles.prototypeDot]} />
            <Text style={[styles.statusText, isOpen ? styles.openText : isClosed ? styles.closedText : styles.prototypeStatusText]}>
              {opportunity.status}
            </Text>
          </View>
        </View>
        <Text numberOfLines={3} style={styles.description}>{opportunity.description}</Text>
        {opportunity.organization || opportunity.location ? (
          <Text style={styles.dataStatus}>
            {[opportunity.organization, opportunity.location, opportunity.employmentType].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        <View style={styles.deadlineRow}>
          <Ionicons name="calendar-outline" size={15} color={palette.muted} />
          <Text style={styles.deadlineText}>
            {opportunity.closingDate ? `Closes ${formatDate(opportunity.closingDate)}` : 'No verified deadline published'}
          </Text>
        </View>
        <Text style={styles.dataStatus}>{opportunity.dataStatus}</Text>
        {opportunity.sourceName ? (
          <View>
           <Text style={styles.dataStatus}>
             Source: {opportunity.sourceName} · Checked {opportunity.sourceVerifiedAt || 'date unavailable'} · Expires {opportunity.recordExpiresAt || 'not set'}
           </Text>
           {opportunity.sourceUrl ? <Text selectable style={styles.dataStatus}>{opportunity.sourceUrl}</Text> : null}
          </View>
        ) : null}
        <View style={styles.cardActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View details for ${opportunity.title}`}
            onPress={() => router.push({ pathname: '/opportunity', params: { id: opportunity.id } })}
            style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}
          >
            <Text style={styles.detailsText}>View details</Text>
          </Pressable>
          {isOpen && canApply ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Apply now for ${opportunity.title}`}
              onPress={() => router.push({ pathname: '/opportunity', params: { id: opportunity.id } })}
              style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}
            >
              <Text style={styles.applyText}>Apply now</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function StakeholderOpportunityManagement({
  activeRole,
  contactEmail,
}: {
  activeRole: 'employer' | 'sdf' | 'training_provider';
  contactEmail: string;
}) {
  const isEmployer = activeRole === 'employer';
  const isSdf = activeRole === 'sdf';
  const isProvider = activeRole === 'training_provider';
  const endpoint = isEmployer ? '/employer/opportunities' : isSdf ? '/sdf/opportunities' : '/provider/opportunities';
  const listingLabel = isEmployer ? 'job listings' : isSdf ? 'skills development opportunities' : 'training programmes';
  const opportunityCategories = isEmployer
    ? ['Employment', 'Internship', 'Workplace Opportunity', 'Training Need']
    : isProvider
    ? ['Training', 'Learnership', 'Training Service', 'Training Partnership']
    : ['Skills Development', 'Training Need', 'Training', 'Learnership', 'Funding', 'Training Partnership'];
  const [submissions, setSubmissions] = useState<Opportunity[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [category, setCategory] = useState(activeRole === 'employer' ? 'Employment' : 'Training');
  const isEmployerTrainingNeed = isEmployer && category === 'Training Need';
  const [audience, setAudience] = useState('learner');
  const [requirements, setRequirements] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [trainingObjectives, setTrainingObjectives] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [participantCount, setParticipantCount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accreditation, setAccreditation] = useState('');
  const [duration, setDuration] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [capacity, setCapacity] = useState('');
  const [fees, setFees] = useState('');
  const [requiredDocuments, setRequiredDocuments] = useState('');
  const [supportingDocuments, setSupportingDocuments] = useState<{
    filename: string;
    mimeType: string;
    size: number;
    data: string;
  }[]>([]);
  const [savedDocumentNames, setSavedDocumentNames] = useState<string[]>([]);
  const [providerVerificationStatus, setProviderVerificationStatus] = useState('');
  const [pickingDocument, setPickingDocument] = useState(false);
  const [closingDate, setClosingDate] = useState('');
  const [applicationInstructions, setApplicationInstructions] = useState('');
  const [editingId, setEditingId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    apiFetch<{ opportunities: Opportunity[]; providerVerificationStatus?: string }>(endpoint)
      .then(({ opportunities: mine, providerVerificationStatus: verificationStatus }) => {
        if (active) {
          setSubmissions(mine);
          if (verificationStatus) setProviderVerificationStatus(verificationStatus);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof ApiError && cause.status === 404
            ? 'The running backend does not have the opportunity-submission routes loaded. Restart the backend, then retry. Your form entries will remain on this screen.'
            : cause instanceof Error ? cause.message : 'Your opportunity submissions could not be loaded.');
        }
      });
    return () => { active = false; };
  }, [endpoint, reload]);

  const resetForm = () => {
    setEditingId('');
    setTitle('');
    setDescription('');
    setLocation('');
    setEmploymentType('');
    setCategory(isEmployer ? 'Employment' : 'Training');
    setAudience('learner');
    setRequirements('');
    setQualifications('');
    setTrainingObjectives('');
    setRequiredSkills('');
    setParticipantCount('');
    setStartDate('');
    setEndDate('');
    setAccreditation('');
    setDuration('');
    setDeliveryMethod('');
    setCapacity('');
    setFees('');
    setRequiredDocuments('');
    setSupportingDocuments([]);
    setSavedDocumentNames([]);
    setClosingDate('');
    setApplicationInstructions('');
  };

  const editSubmission = (item: Opportunity) => {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description);
    setLocation(item.location || '');
    setEmploymentType(item.employmentType || '');
    setCategory(item.category);
    setAudience(item.role);
    setRequirements((item.requirements || []).join('\n'));
    setQualifications(item.qualifications || '');
    setTrainingObjectives(item.trainingObjectives || '');
    setRequiredSkills((item.requiredSkills || []).join('\n'));
    setParticipantCount(item.participantCount ? String(item.participantCount) : '');
    setStartDate(item.startDate || '');
    setEndDate(item.endDate || '');
    setAccreditation(item.accreditation || '');
    setDuration(item.duration || '');
    setDeliveryMethod(item.deliveryMethod || '');
    setCapacity(item.capacity ? String(item.capacity) : '');
    setFees(item.fees === null || item.fees === undefined ? '' : String(item.fees));
    setRequiredDocuments((item.requiredDocuments || []).join('\n'));
    setSupportingDocuments([]);
    setSavedDocumentNames((item.supportingDocuments || []).map((document) => document.filename));
    setClosingDate(item.closingDate || '');
    setApplicationInstructions(item.applicationInstructions || '');
    setMessage('');
    setError('');
  };

  const selectSupportingDocument = async () => {
    if (pickingDocument || busy) return;
    if (supportingDocuments.length >= 5) {
      setError('You can attach up to five supporting documents.');
      return;
    }
    setPickingDocument(true);
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
        multiple: false,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType?.toLowerCase() || mimeFromFilename(asset.name);
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(mimeType)) {
        setError('Choose a PDF, JPG, or PNG supporting document.');
        return;
      }
      const data = (asset.base64 || await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      })).replace(/^data:[^,]+,/, '');
      const size = Math.floor(data.length * 3 / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
      const total = [...supportingDocuments.map((document) => document.size), size].reduce((sum, value) => sum + value, 0);
      if (!size || size > 2 * 1024 * 1024 || total > 5 * 1024 * 1024 ||
          (asset.size !== undefined && asset.size !== size)) {
        setError('Supporting documents must be 2 MB or smaller each and 5 MB or smaller altogether.');
        return;
      }
      setSupportingDocuments((current) => [...current, {
        filename: asset.name,
        mimeType,
        size,
        data,
      }]);
      setSavedDocumentNames([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The supporting document could not be selected.');
    } finally {
      setPickingDocument(false);
    }
  };

  const submit = async (action: 'draft' | 'submit') => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const body = {
        action,
        title,
        description,
        location,
        ...(isEmployer
          ? {
            category,
            role: audience,
            ...(isEmployerTrainingNeed ? {
              trainingObjectives,
              requiredSkills: requiredSkills.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
              participantCount,
              startDate,
              endDate,
            } : { employmentType }),
          }
          : { category, role: audience }),
        requirements: requirements.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
        requiredDocuments: requiredDocuments.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
        qualifications,
        ...(!isEmployer ? {
          trainingObjectives,
          requiredSkills: requiredSkills.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
          startDate,
          endDate,
          ...(isSdf ? { participantCount } : {
            accreditation,
            duration,
            deliveryMethod,
            capacity,
            fees,
          }),
        } : {}),
        closingDate,
        applicationInstructions,
        ...(supportingDocuments.length ? { supportingDocuments } : {}),
      };
      const result = await apiFetch<{ opportunity: Opportunity }>(
        editingId ? `${endpoint}/${encodeURIComponent(editingId)}` : endpoint,
        { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(body) }
      );
      setMessage(`${result.opportunity.title} ${action === 'draft' ? 'saved as a draft' : 'submitted for administrator approval'}.`);
      resetForm();
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 404
        ? 'The running backend does not have the opportunity-submission routes loaded. Restart the backend, then submit again. Your form entries are still here.'
        : cause instanceof Error ? cause.message : 'The opportunity could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (item: Opportunity) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await apiFetch(`${endpoint}/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'withdraw' }),
      });
      setMessage(`${item.title} was withdrawn.`);
      if (editingId === item.id) resetForm();
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The opportunity could not be withdrawn.');
    } finally {
      setBusy(false);
    }
  };

  const submissionCounts = {
    pending: submissions.filter((item) => ['Pending Approval', 'Pending Review', 'Changes Requested'].includes(item.status)).length,
    approved: submissions.filter((item) => ['Approved', 'Published'].includes(item.status)).length,
    rejected: submissions.filter((item) => item.status === 'Rejected').length,
  };

  return (
    <View style={styles.managementPanel}>
      <SectionHeading
        title={isEmployer ? 'Employer opportunity submissions' : isSdf ? 'SDF opportunity management' : 'Training-provider programme management'}
        count={submissions.length}
      />
      <Text style={styles.sectionHint}>
        {isEmployer
          ? 'Publish jobs and internships, request training for your workforce, and review applicants to your own published opportunities.'
          : isSdf
            ? 'Submit workplace skills plans, employee training needs and development opportunities for administrator approval.'
            : 'Submit courses, learnerships and training services for administrator approval. Only active, administrator-verified provider accounts may publish approved programmes.'}
      </Text>
      {isProvider ? (
        <Text style={styles.managementMeta}>
          Provider account verification: {providerVerificationStatus || 'Loading'}. Programme accreditation information is a provider submission and is not independently verified by this prototype.
        </Text>
      ) : null}
      {!isEmployer ? (
        <View style={styles.submissionSummary}>
          <Text style={styles.summaryItem}>Pending approval: {submissionCounts.pending}</Text>
          <Text style={styles.summaryItem}>Approved / published: {submissionCounts.approved}</Text>
          <Text style={styles.summaryItem}>Rejected: {submissionCounts.rejected}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/notifications')} style={styles.summaryLink}>
            <Text style={styles.summaryLinkText}>Notifications</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? (
        <View>
          <Text accessibilityRole="alert" style={styles.managementError}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => setReload((value) => value + 1)} style={styles.summaryLink}>
            <Text style={styles.summaryLinkText}>Retry submissions</Text>
          </Pressable>
        </View>
      ) : null}
      {message ? <Text accessibilityRole="alert" style={styles.managementMessage}>{message}</Text> : null}
      <Text style={styles.managementSubheading}>
        {editingId
          ? 'Edit submission'
          : isEmployer
            ? isEmployerTrainingNeed ? 'Submit an employee training need' : 'Submit a job, internship, or workplace opportunity'
            : isSdf
              ? 'Submit a skills development opportunity'
              : 'Submit a training programme'}
      </Text>
      <TextInput accessibilityLabel={`${isEmployerTrainingNeed ? 'Training need' : isEmployer ? 'Job or workplace opportunity' : 'Training opportunity'} title`} value={title} onChangeText={setTitle} placeholder={`${isEmployerTrainingNeed ? 'Training need' : isEmployer ? 'Job or workplace opportunity' : 'Training opportunity'} title`} style={styles.managementInput} maxLength={120} />
      <TextInput accessibilityLabel="Opportunity description" value={description} onChangeText={setDescription} placeholder="Description" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={2000} />
      {isEmployer ? (
        <>
          <Text style={styles.filterLabel}>Opportunity type</Text>
          <View style={styles.chipRow}>
            {opportunityCategories.map((item) => (
              <FilterChip key={item} label={item} selected={category === item} onPress={() => {
                setCategory(item);
                setAudience(item === 'Training Need' ? 'training_provider' : 'learner');
              }} />
            ))}
          </View>
          {isEmployerTrainingNeed ? (
            <>
              <Text style={styles.filterLabel}>Who should respond?</Text>
              <View style={styles.chipRow}>
                {[{ value: 'training_provider', label: 'Training providers' }, { value: 'sdf', label: 'SDFs' }].map((item) => (
                  <FilterChip key={item.value} label={item.label} selected={audience === item.value} onPress={() => setAudience(item.value)} />
                ))}
              </View>
              <Text style={styles.managementMeta}>Training needs are shared with the selected provider/SDF audience only after administrator approval. Do not include employee names or sensitive personal information.</Text>
            </>
          ) : null}
        </>
      ) : null}
      {!isEmployer || isEmployerTrainingNeed ? (
        <>
          {!isEmployer ? <><Text style={styles.filterLabel}>Opportunity category</Text><View style={styles.chipRow}>
            {opportunityCategories.map((item) => (
              <FilterChip key={item} label={item} selected={category === item} onPress={() => setCategory(item)} />
            ))}
          </View></> : null}
          {!isEmployerTrainingNeed ? (
            <>
              <Text style={styles.filterLabel}>Eligible audience</Text>
              <View style={styles.chipRow}>
                {audiences.map((item) => (
              <FilterChip key={item.value} label={item.label} selected={audience === item.value} onPress={() => setAudience(item.value)} />
            ))}
            <FilterChip label="All eligible users" selected={audience === '*'} onPress={() => setAudience('*')} />
              </View>
            </>
          ) : null}
          <TextInput
            accessibilityLabel={isEmployerTrainingNeed ? 'Employee training objectives' : isSdf ? 'Training objectives' : 'Learning outcomes'}
            value={trainingObjectives}
            onChangeText={setTrainingObjectives}
            placeholder={isEmployerTrainingNeed ? 'What training do employees need?' : isSdf ? 'Training objectives' : 'Learning outcomes'}
            style={[styles.managementInput, styles.managementMultiline]}
            multiline
            maxLength={2000}
          />
          {isProvider ? (
            <>
              <TextInput accessibilityLabel="Accreditation information" value={accreditation} onChangeText={setAccreditation} placeholder="Accreditation information or reference" style={styles.managementInput} maxLength={250} />
              <TextInput accessibilityLabel="Programme duration" value={duration} onChangeText={setDuration} placeholder="Training duration" style={styles.managementInput} maxLength={80} />
              <Text style={styles.filterLabel}>Training delivery method</Text>
              <View style={styles.chipRow}>
                {['Online', 'Physical', 'Hybrid'].map((item) => (
                  <FilterChip key={item} label={item} selected={deliveryMethod === item} onPress={() => setDeliveryMethod(item)} />
                ))}
              </View>
              <TextInput accessibilityLabel="Learner capacity" value={capacity} onChangeText={setCapacity} placeholder="Available learner capacity" style={styles.managementInput} keyboardType="number-pad" maxLength={5} />
              <TextInput accessibilityLabel="Programme fee in ZAR" value={fees} onChangeText={setFees} placeholder="Programme fee in ZAR (optional)" style={styles.managementInput} keyboardType="decimal-pad" maxLength={12} />
            </>
          ) : (
            <>
              <TextInput accessibilityLabel="Required skills" value={requiredSkills} onChangeText={setRequiredSkills} placeholder="Required or priority skills (one per line)" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={1200} />
              <TextInput accessibilityLabel="Number of participants" value={participantCount} onChangeText={setParticipantCount} placeholder="Number of employees / participants" style={styles.managementInput} keyboardType="number-pad" maxLength={5} />
            </>
          )}
          <TextInput accessibilityLabel="Programme start date" value={startDate} onChangeText={setStartDate} placeholder="Start date (YYYY-MM-DD)" style={styles.managementInput} maxLength={10} />
          <TextInput accessibilityLabel="Programme end date" value={endDate} onChangeText={setEndDate} placeholder="End date (YYYY-MM-DD)" style={styles.managementInput} maxLength={10} />
        </>
      ) : null}
      <TextInput accessibilityLabel="Opportunity location" value={location} onChangeText={setLocation} placeholder="Location" style={styles.managementInput} maxLength={120} />
      {isEmployer && !isEmployerTrainingNeed ? (
        <TextInput accessibilityLabel="Employment type" value={employmentType} onChangeText={setEmploymentType} placeholder="Employment type (for example, permanent)" style={styles.managementInput} maxLength={80} />
      ) : null}
      {!isEmployerTrainingNeed ? (
        <TextInput accessibilityLabel={isEmployer ? 'Qualifications' : 'Entry qualifications'} value={qualifications} onChangeText={setQualifications} placeholder={isEmployer ? 'Required qualifications' : 'Entry qualifications'} style={styles.managementInput} maxLength={500} />
      ) : null}
      <TextInput accessibilityLabel={isEmployerTrainingNeed ? 'Training request requirements' : isEmployer ? 'Job requirements' : 'Eligibility requirements'} value={requirements} onChangeText={setRequirements} placeholder={isEmployerTrainingNeed ? 'Additional training requirements (optional)' : 'Requirements (one per line)'} style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={1200} />
      <TextInput accessibilityLabel="Required application documents" value={requiredDocuments} onChangeText={setRequiredDocuments} placeholder="Required application documents (one per line)" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={804} />
      <Text style={styles.managementMeta}>Do not request identity, passport, bank, health, or biometric documents. Applicants can upload PDF, JPG, or PNG files up to 2 MB each.</Text>
      <TextInput accessibilityLabel="Application deadline" value={closingDate} onChangeText={setClosingDate} placeholder="Deadline (YYYY-MM-DD)" style={styles.managementInput} maxLength={10} />
      <TextInput accessibilityLabel="Application instructions" value={applicationInstructions} onChangeText={setApplicationInstructions} placeholder="How to apply" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={1000} />
      {!isEmployer ? (
        <>
          <Text style={styles.managementMeta}>Contact email on this submission: {contactEmail}. Submissions are not visible publicly until an administrator approves and publishes them.</Text>
          <Text style={styles.managementSubheading}>Supporting documents</Text>
          {savedDocumentNames.map((name) => <Text key={name} style={styles.managementMeta}>Attached: {name}</Text>)}
          {supportingDocuments.map((document, index) => (
            <View key={`${document.filename}-${index}`} style={styles.supportingDocumentRow}>
              <Text numberOfLines={1} style={styles.managementMeta}>{document.filename}</Text>
              <Pressable accessibilityRole="button" onPress={() => setSupportingDocuments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                <Text style={styles.clearText}>Remove</Text>
              </Pressable>
            </View>
          ))}
          <Pressable accessibilityRole="button" disabled={busy || pickingDocument || supportingDocuments.length >= 5} onPress={() => void selectSupportingDocument()} style={[styles.managementButton, (busy || pickingDocument) && styles.managementDisabled]}>
            <Text style={styles.managementButtonText}>{pickingDocument ? 'Selecting…' : 'Add supporting document'}</Text>
          </Pressable>
          <Text style={styles.managementMeta}>PDF, JPG or PNG; 2 MB each, 5 MB total. Only administrators can view submission files. Selecting files replaces existing attachments when you save.</Text>
        </>
      ) : null}
      <View style={styles.managementActions}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit('draft')} style={[styles.managementButton, styles.secondaryManagementButton, busy && styles.managementDisabled]}>
          <Text style={styles.secondaryManagementText}>{busy ? 'Saving…' : 'Save draft'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit('submit')} style={[styles.managementButton, busy && styles.managementDisabled]}>
          <Text style={styles.managementButtonText}>{busy ? 'Submitting…' : editingId ? 'Resubmit for review' : 'Submit for review'}</Text>
        </Pressable>
      </View>
      {editingId ? (
        <Pressable accessibilityRole="button" onPress={resetForm} style={styles.cancelEditButton}>
          <Text style={styles.clearText}>Cancel editing</Text>
        </Pressable>
      ) : null}

      <Text style={styles.managementSubheading}>Your submissions</Text>
      {submissions.length ? submissions.map((item) => (
        <View key={item.id} style={styles.managementCard}>
          <Text style={styles.managementTitle}>{item.title}</Text>
          <Text style={styles.managementMeta}>{item.organization} · {item.category} · {item.status}</Text>
          {item.reviewNote ? <Text style={styles.managementError}>Review note: {item.reviewNote}</Text> : null}
          {item.startDate || item.endDate ? <Text style={styles.managementMeta}>Programme dates: {item.startDate || 'Not set'} to {item.endDate || 'Not set'}</Text> : null}
          {item.trainingObjectives ? <Text style={styles.managementMeta}>Objectives: {item.trainingObjectives}</Text> : null}
          {item.supportingDocuments?.map((document) => <Text key={document.id} style={styles.managementMeta}>Supporting document: {document.filename}</Text>)}
          <View style={styles.managementActions}>
            {!['Published', 'Archived'].includes(item.status) ? (
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => editSubmission(item)} style={[styles.managementButton, styles.secondaryManagementButton]}>
                <Text style={styles.secondaryManagementText}>Edit</Text>
              </Pressable>
            ) : null}
            {!['Archived', 'Published'].includes(item.status) ? (
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void withdraw(item)} style={[styles.managementButton, styles.rejectManagementButton]}>
                <Text style={styles.managementButtonText}>Withdraw</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )) : <EmptyState text={`You have not submitted any ${listingLabel}.`} />}
    </View>
  );
}

type EmployerCandidate = {
  id: string;
  reference: string;
  opportunityId: string;
  opportunityTitle: string;
  applicationData: {
    fullName?: string;
    email?: string;
    phone?: string;
    motivation?: string;
  };
  status: string;
  submittedAt: string | null;
  feedback: string;
  documents: { id: string; requirement: string; filename: string; mimeType: string; size: number }[];
};

function EmployerApplicantManagement() {
  const [applications, setApplications] = useState<EmployerCandidate[]>([]);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    apiFetch<{ applications: EmployerCandidate[] }>('/employer/applications')
      .then(({ applications: result }) => {
        if (active) {
          setApplications(result);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Candidate applications could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [reload]);

  const updateApplication = async (application: EmployerCandidate, status: string) => {
    if (busy) return;
    setBusy(application.id);
    setError('');
    setMessage('');
    try {
      const { application: updated } = await apiFetch<{ application: { status: string; feedback?: string } }>(
        `/employer/applications/${encodeURIComponent(application.id)}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status, feedback: feedback[application.id] || '' }),
        }
      );
      setApplications((current) => current.map((item) => item.id === application.id
        ? { ...item, status: updated.status, feedback: updated.feedback || '' }
        : item));
      setMessage(`${application.applicationData.fullName || 'Candidate'} moved to ${updated.status}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The recruitment status could not be updated.');
    } finally {
      setBusy('');
    }
  };

  const visibleApplications = applications.filter((application) =>
    `${application.opportunityTitle} ${application.applicationData.fullName || ''} ${application.applicationData.email || ''} ${application.applicationData.motivation || ''}`
      .toLowerCase().includes(search.trim().toLowerCase())
  );
  const activeStatuses = ['Submitted', 'Under Review', 'Shortlisted', 'Interview'];

  return (
    <View style={styles.managementPanel}>
      <SectionHeading title="Candidates and recruitment" count={applications.length} />
      <Text style={styles.sectionHint}>
        Review only candidates who applied to your own published jobs, internships, workplace opportunities, or training needs. Applicant details and files are private recruitment information; access is recorded.
      </Text>
      {error ? (
        <View>
          <Text accessibilityRole="alert" style={styles.managementError}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => { setLoading(true); setReload((value) => value + 1); }} style={styles.summaryLink}>
            <Text style={styles.summaryLinkText}>Retry candidate list</Text>
          </Pressable>
        </View>
      ) : null}
      {message ? <Text accessibilityRole="alert" style={styles.managementMessage}>{message}</Text> : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => { setLoading(true); setReload((value) => value + 1); }}
        style={styles.summaryLink}
      >
        <Text style={styles.summaryLinkText}>Refresh candidates</Text>
      </Pressable>
      <TextInput
        accessibilityLabel="Search candidates"
        value={search}
        onChangeText={setSearch}
        placeholder="Search candidates, applications, or motivation"
        style={styles.managementInput}
      />
      {loading ? <ActivityIndicator size="small" color={palette.primary} style={styles.loading} /> : null}
      {!loading && visibleApplications.length === 0 ? (
        <EmptyState text={applications.length ? 'No applicants match this search.' : 'No candidates have applied to your published opportunities yet.'} />
      ) : null}
      {visibleApplications.map((application) => (
        <View key={application.id} style={styles.managementCard}>
          <Text style={styles.managementTitle}>{application.applicationData.fullName || 'Applicant'}</Text>
          <Text style={styles.managementMeta}>{application.opportunityTitle} · {application.reference}</Text>
          <Text style={styles.managementMeta}>{application.applicationData.email || 'Email not provided'}{application.applicationData.phone ? ` · ${application.applicationData.phone}` : ''}</Text>
          <Text style={styles.managementMeta}>{application.status}{application.submittedAt ? ` · Submitted ${formatDate(application.submittedAt.slice(0, 10))}` : ''}</Text>
          {application.applicationData.motivation ? <Text style={styles.description}>{application.applicationData.motivation}</Text> : null}
          {application.feedback ? <Text style={styles.managementMeta}>Feedback shared with applicant: {application.feedback}</Text> : null}
          {application.documents.map((document) => (
            <ApplicationCandidateDocument key={document.id} applicationId={application.id} document={document} />
          ))}
          {activeStatuses.includes(application.status) ? (
            <>
              <TextInput
                accessibilityLabel={`Recruitment feedback for ${application.applicationData.fullName || 'candidate'}`}
                value={feedback[application.id] || ''}
                onChangeText={(value) => setFeedback((current) => ({ ...current, [application.id]: value }))}
                placeholder="Optional feedback for applicant"
                maxLength={500}
                style={styles.managementInput}
              />
              <View style={styles.managementActions}>
                {['Under Review', 'Shortlisted', 'Interview', 'Hired', 'Unsuccessful', 'Rejected'].map((status) => (
                  <Pressable
                    key={status}
                    accessibilityRole="button"
                    disabled={Boolean(busy)}
                    onPress={() => void updateApplication(application, status)}
                    style={[styles.managementButton, styles.secondaryManagementButton, busy === application.id && styles.managementDisabled]}
                  >
                    <Text style={styles.secondaryManagementText}>{busy === application.id ? 'Saving…' : status}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function ApplicationCandidateDocument({
  applicationId,
  document,
}: {
  applicationId: string;
  document: { id: string; requirement: string; filename: string; mimeType: string; size: number };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const openDocument = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await downloadApplicationDocument(applicationId, document.id, document.filename, document.mimeType);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The candidate document could not be opened.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void openDocument()} style={styles.supportingDocumentButton}>
        <Text style={styles.secondaryManagementText}>{busy ? 'Opening…' : `Review ${document.requirement}: ${document.filename}`}</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.managementError}>{error}</Text> : null}
    </View>
  );
}

function AdministratorOpportunityManagement() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [filter, setFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All time');
  const [searchText, setSearchText] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Bursary');
  const [audience, setAudience] = useState('learner');
  const [organization, setOrganization] = useState('');
  const [location, setLocation] = useState('');
  const [deadline, setDeadline] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [sourceVerifiedAt, setSourceVerifiedAt] = useState('');
  const [recordExpiresAt, setRecordExpiresAt] = useState('');
  const [instructions, setInstructions] = useState('');
  const [requiredDocuments, setRequiredDocuments] = useState('');
  const [editingId, setEditingId] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [submissionCutoff, setSubmissionCutoff] = useState(0);
  const statusFilters = ['All', 'Pending Approval', 'Pending Review', 'Changes Requested', 'Draft', 'Approved', 'Published', 'Closed', 'Rejected', 'Archived', 'Open', 'Prototype'];
  const contentCategories = ['Bursary', 'Learnership', 'Funding', 'Employment', 'Internship', 'Workplace Opportunity', 'Grants', 'Training', 'Mentorship', 'Skills Development', 'Training Need', 'Training Service', 'Training Partnership', 'Accreditation'];
  const dateFilters = ['All time', 'Last 7 days', 'Last 30 days'];

  useEffect(() => {
    let active = true;
    apiFetch<{ opportunities: Opportunity[] }>('/admin/opportunities')
      .then(({ opportunities: records }) => {
        if (active) {
          setItems(records);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Opportunity review queue could not be loaded.');
      });
    return () => { active = false; };
  }, [reload]);

  const visibleItems = items.filter((item) =>
    (filter === 'All' || (item.effectiveStatus || item.status) === filter) &&
    (categoryFilter === 'All' || item.category === categoryFilter) &&
    (dateFilter === 'All time' || Boolean(item.submittedAt &&
      Date.parse(item.submittedAt) >= submissionCutoff)) &&
    `${item.title} ${item.organization || ''} ${item.category}`.toLowerCase().includes(searchText.trim().toLowerCase())
  );

  const createDraft = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await apiFetch<{ opportunity: Opportunity }>(
        editingId ? `/admin/opportunities/${encodeURIComponent(editingId)}` : '/admin/opportunities',
        {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          action: editingId ? 'edit' : 'draft',
          title,
          description,
          category,
          type: category,
          role: audience,
          organization,
          location,
          closingDate: deadline,
          sourceName,
          sourceUrl,
          applicationUrl,
          sourceVerifiedAt,
          recordExpiresAt,
          applicationInstructions: instructions,
          requiredDocuments: requiredDocuments.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
        }),
      });
      setMessage(`${result.opportunity.title} saved as a draft. Approve and publish it after reviewing the source.`);
      setEditingId('');
      setTitle('');
      setDescription('');
      setOrganization('');
      setLocation('');
      setDeadline('');
      setSourceName('');
      setSourceUrl('');
      setApplicationUrl('');
      setSourceVerifiedAt('');
      setRecordExpiresAt('');
      setInstructions('');
      setRequiredDocuments('');
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The content draft could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const editDraft = (item: Opportunity) => {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description);
    setCategory(item.category);
    setAudience(item.role);
    setOrganization(item.organization || '');
    setLocation(item.location || '');
    setDeadline(item.closingDate || '');
    setSourceName(item.sourceName || '');
    setSourceUrl(item.sourceUrl || '');
    setApplicationUrl(item.applicationUrl || '');
    setSourceVerifiedAt(item.sourceVerifiedAt || '');
    setRecordExpiresAt(item.recordExpiresAt || '');
    setInstructions(item.applicationInstructions || '');
    setRequiredDocuments((item.requiredDocuments || []).join('\n'));
    setError('');
    setMessage('');
  };

  const updateStatus = async (item: Opportunity, action: string) => {
    if (busy) return;
    const note = rejectionNotes[item.id]?.trim() || '';
    if (['reject', 'request_changes'].includes(action) && !note) {
      setError(`Add a review note before updating ${item.title}.`);
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await apiFetch<{ opportunity: Opportunity }>(`/admin/opportunities/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, ...(['reject', 'request_changes'].includes(action) ? { note } : {}) }),
      });
      setMessage(`${result.opportunity.title} is now ${result.opportunity.status.toLowerCase()}.`);
      setRejectionNotes((current) => ({ ...current, [item.id]: '' }));
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The opportunity could not be reviewed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.managementPanel}>
      <SectionHeading title="Opportunity management and approval" count={items.filter((item) => ['Draft', 'Pending Approval', 'Pending Review', 'Changes Requested'].includes(item.status)).length} />
      <Text style={styles.sectionHint}>Review SDF, provider, and employer submissions. Use Request changes or Reject with a review note. Only approved and published listings appear to eligible users; a provider&apos;s role verification is required to publish a provider programme. Approval does not mean official accreditation.</Text>
      {error ? <Text accessibilityRole="alert" style={styles.managementError}>{error}</Text> : null}
      {message ? <Text accessibilityRole="alert" style={styles.managementMessage}>{message}</Text> : null}

      <View style={styles.managementCard}>
        <Text style={styles.managementSubheading}>{editingId ? 'Edit content draft' : 'Create bursary, learnership or funding content'}</Text>
        <TextInput accessibilityLabel="Content title" value={title} onChangeText={setTitle} placeholder="Title" style={styles.managementInput} maxLength={120} />
        <TextInput accessibilityLabel="Content description" value={description} onChangeText={setDescription} placeholder="Description" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={2000} />
        <Text style={styles.filterLabel}>Content category</Text>
        <View style={styles.chipRow}>
          {contentCategories.map((item) => <FilterChip key={item} label={item} selected={category === item} onPress={() => setCategory(item)} />)}
        </View>
        <Text style={styles.filterLabel}>Eligible audience</Text>
        <View style={styles.chipRow}>
          {audiences.map((item) => <FilterChip key={item.value} label={item.label} selected={audience === item.value} onPress={() => setAudience(item.value)} />)}
          <FilterChip label="All eligible users" selected={audience === '*'} onPress={() => setAudience('*')} />
        </View>
        <TextInput accessibilityLabel="Organisation" value={organization} onChangeText={setOrganization} placeholder="Organisation or funding source" style={styles.managementInput} maxLength={160} />
        <TextInput accessibilityLabel="Content location" value={location} onChangeText={setLocation} placeholder="Location" style={styles.managementInput} maxLength={120} />
        <TextInput accessibilityLabel="Content deadline" value={deadline} onChangeText={setDeadline} placeholder="Application deadline (YYYY-MM-DD)" style={styles.managementInput} maxLength={10} />
        <Text style={styles.managementMeta}>Bursary, funding, grant, learnership, and training content needs a source name, HTTP(S) source URL, checked date, and expiry date before an administrator can approve or publish it. Source details support review but do not independently verify official status or eligibility.</Text>
        <TextInput accessibilityLabel="Information source name" value={sourceName} onChangeText={setSourceName} placeholder="Verified information source name" style={styles.managementInput} maxLength={160} />
        <TextInput accessibilityLabel="Information source URL" value={sourceUrl} onChangeText={setSourceUrl} placeholder="Source URL (https://...)" style={styles.managementInput} maxLength={500} autoCapitalize="none" keyboardType="url" />
        <TextInput accessibilityLabel="External application URL" value={applicationUrl} onChangeText={setApplicationUrl} placeholder="Official application page URL (optional)" style={styles.managementInput} maxLength={500} autoCapitalize="none" keyboardType="url" />
        <TextInput accessibilityLabel="Source checked date" value={sourceVerifiedAt} onChangeText={setSourceVerifiedAt} placeholder="Source checked (YYYY-MM-DD)" style={styles.managementInput} maxLength={10} />
        <TextInput accessibilityLabel="Listing expiry date" value={recordExpiresAt} onChangeText={setRecordExpiresAt} placeholder="Listing expires (YYYY-MM-DD)" style={styles.managementInput} maxLength={10} />
        <TextInput accessibilityLabel="Application instructions" value={instructions} onChangeText={setInstructions} placeholder="Application instructions" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={1000} />
        <TextInput accessibilityLabel="Required application documents" value={requiredDocuments} onChangeText={setRequiredDocuments} placeholder="Required documents (one per line)" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={804} />
        <Text style={styles.managementMeta}>Do not request identity, passport, bank, health, or biometric documents. Applicants can upload PDF, JPG, or PNG files up to 2 MB each.</Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void createDraft()} style={[styles.managementButton, busy && styles.managementDisabled]}>
          <Text style={styles.managementButtonText}>{busy ? 'Saving…' : editingId ? 'Save changes as draft' : 'Save content draft'}</Text>
        </Pressable>
        {editingId ? (
          <Pressable accessibilityRole="button" onPress={() => {
            setEditingId('');
            setTitle('');
            setDescription('');
            setOrganization('');
            setLocation('');
            setDeadline('');
            setSourceName('');
            setSourceUrl('');
            setApplicationUrl('');
            setSourceVerifiedAt('');
            setRecordExpiresAt('');
            setInstructions('');
            setRequiredDocuments('');
          }} style={styles.cancelEditButton}>
            <Text style={styles.clearText}>Cancel editing</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.managementSubheading}>Review and publication history</Text>
      <TextInput accessibilityLabel="Search content submissions" value={searchText} onChangeText={setSearchText} placeholder="Search title or organisation" style={styles.managementInput} />
      <View style={styles.chipRow}>
        {statusFilters.map((item) => <FilterChip key={item} label={item} selected={filter === item} onPress={() => setFilter(item)} />)}
      </View>
      <Text style={styles.filterLabel}>Filter by category</Text>
      <View style={styles.chipRow}>
        {['All', ...contentCategories].map((item) => <FilterChip key={item} label={item} selected={categoryFilter === item} onPress={() => setCategoryFilter(item)} />)}
      </View>
      <Text style={styles.filterLabel}>Submitted</Text>
      <View style={styles.chipRow}>
        {dateFilters.map((item) => <FilterChip key={item} label={item} selected={dateFilter === item} onPress={() => {
          setDateFilter(item);
          setSubmissionCutoff(item === 'All time' ? 0 : Date.now() - (item === 'Last 7 days' ? 7 : 30) * 86_400_000);
        }} />)}
      </View>
      {visibleItems.length ? visibleItems.map((item) => {
        const actions = ['Pending Approval', 'Pending Review', 'Changes Requested', 'Draft'].includes(item.status)
          ? ['approve', 'request_changes', 'reject']
          : item.status === 'Approved'
            ? ['publish', 'request_changes', 'reject', 'archive']
            : item.status === 'Published'
              ? ['unpublish', 'close', 'archive']
              : ['Rejected', 'Open', 'Prototype', 'Expired', 'Closed'].includes(item.status) ? ['archive'] : [];
        return (
          <View key={item.id} style={styles.managementCard}>
            <Text style={styles.managementTitle}>{item.title}</Text>
            <Text style={styles.managementMeta}>{item.organization || 'Organisation not provided'} · {item.category} · {roleLabel(item.role)}</Text>
            <Text style={styles.managementMeta}>Status: {item.effectiveStatus || item.status}{item.submittedAt ? ` · Submitted ${formatDate(item.submittedAt.slice(0, 10))}` : ''}</Text>
            {item.sourceName ? (
              <Text style={styles.managementMeta}>
                Source: {item.sourceName} · Checked {item.sourceVerifiedAt || 'date unavailable'} · Expires {item.recordExpiresAt || 'not set'} · {item.sourceUrl}
              </Text>
            ) : null}
            {item.applicationUrl ? <Text selectable style={styles.managementMeta}>External application page: {item.applicationUrl}</Text> : null}
            <Text style={styles.description}>{item.description}</Text>
            {item.trainingObjectives ? <Text style={styles.managementMeta}>Objectives / outcomes: {item.trainingObjectives}</Text> : null}
            {item.requiredSkills?.length ? <Text style={styles.managementMeta}>Required skills: {item.requiredSkills.join(', ')}</Text> : null}
            {item.requirements?.length ? <Text style={styles.managementMeta}>Eligibility / entry requirements: {item.requirements.join(', ')}</Text> : null}
            {item.accreditation ? <Text style={styles.managementMeta}>Accreditation information: {item.accreditation} (not independently verified)</Text> : null}
            {item.duration ? <Text style={styles.managementMeta}>Duration: {item.duration} · Delivery: {item.deliveryMethod || 'Not specified'}</Text> : null}
            {item.participantCount ? <Text style={styles.managementMeta}>Participants: {item.participantCount}</Text> : null}
            {item.capacity ? <Text style={styles.managementMeta}>Learner capacity: {item.capacity}</Text> : null}
            {item.fees !== null && item.fees !== undefined ? <Text style={styles.managementMeta}>Fee: R {item.fees.toLocaleString('en-ZA')}</Text> : null}
            {item.startDate || item.endDate ? <Text style={styles.managementMeta}>Programme dates: {item.startDate || 'Not set'} – {item.endDate || 'Not set'}</Text> : null}
            {item.reviewNote ? <Text style={styles.managementError}>Rejection reason: {item.reviewNote}</Text> : null}
            {item.statusHistory?.length ? (
              <Text style={styles.managementMeta}>
                Latest decision: {item.statusHistory[item.statusHistory.length - 1].status} · {new Date(item.statusHistory[item.statusHistory.length - 1].date).toLocaleString('en-ZA')}
              </Text>
            ) : null}
            {!['Published', 'Archived'].includes(item.status) ? (
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => editDraft(item)} style={[styles.managementButton, styles.secondaryManagementButton]}>
                <Text style={styles.secondaryManagementText}>Edit content</Text>
              </Pressable>
            ) : null}
            {['Pending Approval', 'Pending Review', 'Changes Requested', 'Draft', 'Approved'].includes(item.status) ? (
              <TextInput
                accessibilityLabel={`Administrator review note for ${item.title}`}
                value={rejectionNotes[item.id] || ''}
                onChangeText={(value) => setRejectionNotes((current) => ({ ...current, [item.id]: value }))}
                placeholder="Review note required to reject or request changes"
                style={styles.managementInput}
                maxLength={500}
              />
            ) : null}
            {item.supportingDocuments?.map((document) => (
              <OpportunityDocumentButton
                key={document.id}
                opportunityId={item.id}
                document={document}
              />
            ))}
            <View style={styles.managementActions}>
              {actions.map((action) => (
                <Pressable
                  key={action}
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void updateStatus(item, action)}
                  style={[
                    styles.managementButton,
                    ['reject', 'archive', 'close'].includes(action) ? styles.rejectManagementButton : null,
                    busy && styles.managementDisabled,
                  ]}
                >
                  <Text style={styles.managementButtonText}>
                    {action === 'approve' ? 'Approve' : action === 'publish' ? 'Publish' : action === 'unpublish' ? 'Unpublish' : action === 'request_changes' ? 'Request changes' : action === 'reject' ? 'Reject' : action === 'close' ? 'Close' : 'Archive'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      }) : <EmptyState text="No opportunity submissions match this filter." />}
    </View>
  );
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    learner: 'Learners',
    farmer: 'Farmers',
    employer: 'Employers',
    sdf: 'SDFs',
    training_provider: 'Training providers',
    administrator: 'Administrators',
    internal_staff: 'Internal staff',
    '*': 'Eligible users',
  };
  return labels[role] ?? role;
}

function mimeFromFilename(filename: string) {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  return '';
}

function OpportunityDocumentButton({
  opportunityId,
  document,
}: {
  opportunityId: string;
  document: { id: string; filename: string; mimeType: string; size: number };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const openDocument = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await downloadOpportunityDocument(opportunityId, document.id, document.filename, document.mimeType);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The supporting document could not be opened.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void openDocument()} style={styles.supportingDocumentButton}>
        <Text style={styles.secondaryManagementText}>{busy ? 'Opening…' : `Review supporting document: ${document.filename}`}</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.managementError}>{error}</Text> : null}
    </View>
  );
}

type DiscoverableCandidate = {
  id: string;
  firstName: string;
  desiredRole: string;
  province: string;
  summary: string;
  skills: { name: string; category: string; level: string; verificationStatus: string }[];
};

function EmployerCandidateDiscovery() {
  const [candidates, setCandidates] = useState<DiscoverableCandidate[]>([]);
  const [listings, setListings] = useState<{ id: string; title: string; category: string; status: string; effectiveStatus: string }[]>([]);
  const [search, setSearch] = useState('');
  const [selectedListingId, setSelectedListingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [listingError, setListingError] = useState('');
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    apiFetch<{ opportunities: { id: string; title: string; category: string; status: string; effectiveStatus: string }[] }>('/employer/opportunities')
      .then(({ opportunities }) => {
        if (active) {
          setListings(opportunities.filter((entry) =>
            entry.effectiveStatus === 'Open' && ['Employment', 'Internship', 'Workplace Opportunity'].includes(entry.category)
          ));
          setListingError('');
        }
      })
      .catch((cause: unknown) => {
        if (active) setListingError(cause instanceof Error ? cause.message : 'Your published job listings could not be loaded.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      const query = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
      apiFetch<{ candidates: DiscoverableCandidate[] }>(`/employer/candidates${query}`)
        .then(({ candidates: result }) => {
          if (active) {
            setCandidates(result);
            setError('');
          }
        })
        .catch((cause: unknown) => {
          if (active) setError(cause instanceof Error ? cause.message : 'Opted-in candidates could not be loaded.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, reload]);

  const invite = async (candidate: DiscoverableCandidate) => {
    if (!selectedListingId || busy) return;
    setBusy(candidate.id);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/employer/candidates/${encodeURIComponent(candidate.id)}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ opportunityId: selectedListingId }),
      });
      setMessage(`Invitation sent to ${candidate.firstName}. They can choose whether to apply.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The invitation could not be sent.');
    } finally {
      setBusy('');
    }
  };

  return (
    <View style={styles.managementPanel}>
      <SectionHeading title="Discover candidates" count={candidates.length} />
      <Text style={styles.sectionHint}>
        Search only candidates who chose to share a limited profile. Names are limited to first name; contact details and documents are not shown. Skills are self-reported, not verified. Invitations are in-app and candidates decide whether to apply.
      </Text>
      <TextInput
        accessibilityLabel="Search opted-in candidates"
        value={search}
        onChangeText={setSearch}
        placeholder="Search role, province, skills, or experience"
        style={styles.managementInput}
      />
      <Text style={styles.managementMeta}>Choose one of your open, published job listings to invite candidates to consider.</Text>
      {listings.length ? (
        <View style={styles.managementActions}>
          {listings.map((listing) => (
            <Pressable
              key={listing.id}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedListingId === listing.id }}
              onPress={() => setSelectedListingId(listing.id)}
              style={[styles.managementButton, styles.secondaryManagementButton, selectedListingId === listing.id && styles.candidateListingSelected]}
            >
              <Text style={styles.secondaryManagementText}>{listing.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : <Text style={styles.managementMeta}>No published job, internship, or workplace listings are available to invite candidates to.</Text>}
      {listingError ? <Text accessibilityRole="alert" style={styles.managementError}>{listingError}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => setReload((value) => value + 1)} style={styles.summaryLink}>
        <Text style={styles.summaryLinkText}>Refresh candidate search</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.managementError}>{error}</Text> : null}
      {message ? <Text accessibilityRole="alert" style={styles.managementMessage}>{message}</Text> : null}
      {loading ? <ActivityIndicator size="small" color={palette.primary} style={styles.loading} /> : null}
      {!loading && candidates.length === 0 ? (
        <EmptyState text={search.trim() ? 'No opted-in candidates match this search.' : 'No candidates have chosen to share their profiles yet.'} />
      ) : null}
      {candidates.map((candidate) => (
        <View key={candidate.id} style={styles.managementCard}>
          <Text style={styles.managementTitle}>{candidate.firstName}</Text>
          <Text style={styles.managementMeta}>{candidate.desiredRole}{candidate.province ? ` · ${candidate.province}` : ''}</Text>
          {candidate.summary ? <Text style={styles.description}>{candidate.summary}</Text> : null}
          {candidate.skills.length ? (
            <Text style={styles.managementMeta}>
              Skills: {candidate.skills.map((skill) => `${skill.name} (${skill.level}, self-reported)`).join(' · ')}
            </Text>
          ) : <Text style={styles.managementMeta}>No Skills Passport skills shared.</Text>}
          <Pressable
            accessibilityRole="button"
            disabled={!selectedListingId || Boolean(busy)}
            onPress={() => void invite(candidate)}
            style={[styles.managementButton, (!selectedListingId || Boolean(busy)) && styles.managementDisabled]}
          >
            <Text style={styles.managementButtonText}>{busy === candidate.id ? 'Sending invitation…' : 'Invite to apply'}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function EmployerFundingSupport() {
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const openOfficialInformation = async () => {
    setOpening(true);
    setError('');
    try {
      await Linking.openURL('https://www.agriseta.co.za/discretionary-grant-funding/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The official AgriSETA page could not be opened.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={styles.managementPanel}>
      <SectionHeading title="Employer funding and training support" />
      <Text style={styles.sectionHint}>
        MyAgriSETA does not have a verified live funding feed or submit applications to funders. Check current windows, eligibility, and instructions directly with AgriSETA. No details from your account are sent when opening the external page.
      </Text>
      <Pressable
        accessibilityRole="link"
        disabled={opening}
        onPress={() => void openOfficialInformation()}
        style={[styles.managementButton, opening && styles.managementDisabled]}
      >
        <Text style={styles.managementButtonText}>{opening ? 'Opening official page…' : 'Open AgriSETA grants and WSP/ATR information'}</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.managementError}>{error}</Text> : null}
      <Text style={styles.managementMeta}>Official source: agriseta.co.za · Confirm application dates and employer eligibility on the source page.</Text>
    </View>
  );
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  screen: { flex: 1 },
  page: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: spacing.lg, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  eyebrow: { color: palette.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  heading: { color: palette.text, fontSize: 28, fontWeight: '800', marginTop: 4 },
  subtitle: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 4, maxWidth: 290 },
  headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface },
  searchBox: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, minHeight: 44, color: palette.text, fontSize: 14 },
  filterHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  filterLabel: { color: palette.text, fontSize: 12, fontWeight: '800', marginTop: spacing.md },
  clearText: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingVertical: spacing.sm },
  chip: { minHeight: 34, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: spacing.md },
  chipSelected: { backgroundColor: palette.primaryDark, borderColor: palette.primaryDark },
  chipText: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  chipTextSelected: { color: '#FFFFFF' },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modeButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: palette.border, borderRadius: 20, paddingHorizontal: spacing.md },
  modeButtonSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  modeText: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  modeTextSelected: { color: '#FFFFFF' },
  managementPanel: { backgroundColor: palette.surfaceAlt, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg },
  managementCard: { backgroundColor: palette.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  managementSubheading: { color: palette.text, fontSize: 15, fontWeight: '800', marginTop: spacing.md, marginBottom: spacing.xs },
  managementTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  managementMeta: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: spacing.xs },
  managementInput: { minHeight: 42, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, backgroundColor: palette.surface, color: palette.text, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, marginTop: spacing.sm },
  managementMultiline: { minHeight: 76, textAlignVertical: 'top' },
  managementActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  submissionSummary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, backgroundColor: palette.surface, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm },
  summaryItem: { color: palette.text, fontSize: 11, fontWeight: '700' },
  summaryLink: { marginLeft: 'auto', padding: spacing.xs },
  summaryLinkText: { color: palette.primary, fontSize: 11, fontWeight: '800' },
  supportingDocumentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  supportingDocumentButton: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: palette.primary, borderRadius: radius.sm, paddingHorizontal: spacing.sm, marginTop: spacing.xs },
  managementButton: { minHeight: 40, flexGrow: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary, borderRadius: radius.sm, paddingHorizontal: spacing.md },
  secondaryManagementButton: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.primary },
  rejectManagementButton: { backgroundColor: palette.danger },
  managementButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  secondaryManagementText: { color: palette.primary, fontSize: 11, fontWeight: '800' },
  managementDisabled: { opacity: 0.6 },
  candidateListingSelected: { backgroundColor: '#E6F3EB', borderColor: palette.primaryDark },
  managementError: { color: palette.danger, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  managementMessage: { color: palette.primaryDark, backgroundColor: '#E6F3EB', borderRadius: radius.sm, fontSize: 12, lineHeight: 18, padding: spacing.sm, marginTop: spacing.sm },
  cancelEditButton: { alignSelf: 'flex-end', paddingVertical: spacing.sm },
  prototypeNotice: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F6F0DF', borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.md },
  prototypeText: { flex: 1, color: '#685522', fontSize: 11, lineHeight: 16, marginLeft: spacing.xs },
  inlineError: { color: palette.danger, fontSize: 12, marginTop: spacing.sm },
  loading: { marginVertical: spacing.xl },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '800' },
  sectionCount: { minWidth: 22, textAlign: 'center', color: palette.primary, backgroundColor: palette.surfaceAlt, overflow: 'hidden', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, fontSize: 11, fontWeight: '800' },
  sectionHint: { color: palette.muted, fontSize: 11, lineHeight: 16, marginBottom: spacing.sm },
  card: { backgroundColor: palette.surface, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md, borderWidth: 1, borderColor: '#E7EDE9', shadowColor: '#10291F', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  imageWrap: { height: 156, backgroundColor: palette.primaryDark, justifyContent: 'flex-end' },
  imageFallback: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  cardImage: { ...StyleSheet.absoluteFill },
  imageTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(4, 28, 19, 0.43)' },
  recommendedBadge: { position: 'absolute', top: spacing.sm, left: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F3D984', borderRadius: 14, paddingHorizontal: 9, paddingVertical: 6 },
  recommendedText: { color: palette.primaryDark, fontSize: 10, fontWeight: '800' },
  bookmarkButton: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  imageTitle: { padding: spacing.md },
  imageCategory: { color: '#F3D984', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  cardTitle: { color: '#FFFFFF', fontSize: 19, lineHeight: 24, fontWeight: '800', marginTop: 4 },
  cardContent: { padding: spacing.md },
  metadataRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  audienceTag: { color: palette.primaryDark, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  statusTag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5 },
  openTag: { backgroundColor: '#E6F3EB' },
  closedTag: { backgroundColor: '#F8E8E6' },
  prototypeTag: { backgroundColor: '#F1F0EC' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  openDot: { backgroundColor: palette.success },
  closedDot: { backgroundColor: palette.danger },
  prototypeDot: { backgroundColor: palette.warning },
  statusText: { fontSize: 10, fontWeight: '800' },
  openText: { color: palette.success },
  closedText: { color: palette.danger },
  prototypeStatusText: { color: '#78672F' },
  description: { color: palette.text, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  deadlineText: { color: palette.muted, fontSize: 11 },
  dataStatus: { color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: spacing.xs },
  cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  detailsButton: { minHeight: 40, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.primary, borderRadius: radius.sm },
  detailsText: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  applyButton: { minHeight: 40, flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary, borderRadius: radius.sm },
  applyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.78 },
  emptyState: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  emptyText: { flex: 1, color: palette.muted, fontSize: 12, lineHeight: 18 },
  stateBlock: { alignItems: 'center', padding: spacing.xl },
  stateText: { color: palette.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: spacing.sm },
  retryButton: { minHeight: 42, justifyContent: 'center', backgroundColor: palette.primary, borderRadius: radius.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  retryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
