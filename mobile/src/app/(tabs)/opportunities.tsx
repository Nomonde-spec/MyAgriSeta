import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as NativeTextInput,
  TextInputProps,
  Modal,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/navigation/back-button';
import { FilterDropdown } from '@/components/filter-dropdown';
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
  applicationCount?: number;
  opportunityDetails?: Record<string, string>;
  eligibilityCriteria?: Record<string, string>;
  applicationConfiguration?: Record<string, string | number | boolean | null>;
  applicationQuestions?: {
    title: string;
    type: string;
    required: boolean;
    description: string;
    options: string[];
  }[];
};

type OpportunityApplication = {
  id: string;
  reference: string;
  applicantName: string;
  status: string;
  submittedAt: string | null;
};

const categories = [
  'Bursary',
  'Funding',
  'Learnership',
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
const farmerCategories = ['Funding', 'Grants', 'Business Support', 'Mentorship'];
const employerCategories = ['Employment', 'Internship', 'Workplace Opportunity', 'Training Need'];
const administratorDetailFields: Record<string, { key: string; label: string }[]> = {
  Funding: [
    { key: 'programmeName', label: 'Funding programme name' },
    { key: 'fundingType', label: 'Funding type' },
    { key: 'minimumFundingAmount', label: 'Minimum funding amount (ZAR)' },
    { key: 'maximumFundingAmount', label: 'Maximum funding amount (ZAR)' },
    { key: 'fundingPurpose', label: 'Funding purpose' },
    { key: 'eligibleSectors', label: 'Eligible agricultural sectors' },
    { key: 'projectObjectives', label: 'Project objectives' },
    { key: 'expectedOutcomes', label: 'Expected outcomes' },
  ],
  Grants: [
    { key: 'programmeName', label: 'Grant programme name' },
    { key: 'fundingType', label: 'Grant type' },
    { key: 'minimumFundingAmount', label: 'Minimum grant amount (ZAR)' },
    { key: 'maximumFundingAmount', label: 'Maximum grant amount (ZAR)' },
    { key: 'fundingPurpose', label: 'Grant purpose' },
    { key: 'eligibleSectors', label: 'Eligible agricultural sectors' },
    { key: 'projectObjectives', label: 'Project objectives' },
    { key: 'expectedOutcomes', label: 'Expected outcomes' },
  ],
  Bursary: [
    { key: 'programmeName', label: 'Bursary programme name' },
    { key: 'academicYear', label: 'Academic year' },
    { key: 'institution', label: 'Institution(s)' },
    { key: 'qualificationLevel', label: 'Qualification level' },
    { key: 'fieldOfStudy', label: 'Field of study' },
    { key: 'studyMode', label: 'Full-time or part-time' },
    { key: 'coverage', label: 'Covered benefits' },
    { key: 'bursaryValue', label: 'Bursary value (ZAR)' },
  ],
  Internship: [
    { key: 'programmeName', label: 'Programme name' },
    { key: 'agriculturalField', label: 'Agricultural field' },
    { key: 'hostOrganization', label: 'Host organisation' },
    { key: 'positions', label: 'Number of positions' },
    { key: 'duration', label: 'Duration' },
    { key: 'stipend', label: 'Monthly stipend (ZAR)' },
    { key: 'requiredSkills', label: 'Required skills and qualifications' },
  ],
  Learnership: [
    { key: 'programmeName', label: 'Programme name' },
    { key: 'agriculturalField', label: 'Agricultural field' },
    { key: 'hostOrganization', label: 'Host organisation' },
    { key: 'positions', label: 'Number of positions' },
    { key: 'duration', label: 'Duration' },
    { key: 'stipend', label: 'Monthly stipend (ZAR)' },
    { key: 'programmeOutcomes', label: 'Programme outcomes' },
  ],
  Employment: [
    { key: 'hostOrganization', label: 'Hiring organisation' },
    { key: 'positions', label: 'Number of positions' },
    { key: 'employmentType', label: 'Employment type' },
    { key: 'requiredSkills', label: 'Required skills and qualifications' },
  ],
  'Workplace Opportunity': [
    { key: 'hostOrganization', label: 'Host organisation' },
    { key: 'positions', label: 'Number of positions' },
    { key: 'employmentType', label: 'Employment type' },
    { key: 'duration', label: 'Duration' },
    { key: 'requiredSkills', label: 'Required skills and qualifications' },
  ],
  Mentorship: [
    { key: 'programmeName', label: 'Programme name' },
    { key: 'programmeType', label: 'Mentorship category' },
    { key: 'programmeObjectives', label: 'Learning objectives' },
    { key: 'duration', label: 'Duration' },
    { key: 'deliveryMethod', label: 'Delivery method' },
    { key: 'programmeBenefits', label: 'Programme benefits' },
  ],
  Training: [
    { key: 'programmeName', label: 'Programme name' },
    { key: 'programmeType', label: 'Programme type' },
    { key: 'programmeObjectives', label: 'Learning objectives' },
    { key: 'duration', label: 'Duration' },
    { key: 'deliveryMethod', label: 'Delivery method' },
    { key: 'programmeBenefits', label: 'Programme benefits' },
  ],
  'Skills Development': [
    { key: 'programmeName', label: 'Programme name' },
    { key: 'programmeType', label: 'Programme type' },
    { key: 'programmeObjectives', label: 'Learning objectives' },
    { key: 'duration', label: 'Duration' },
    { key: 'deliveryMethod', label: 'Delivery method' },
    { key: 'programmeBenefits', label: 'Programme benefits' },
  ],
};
const applicationInformationOptions = [
  'Personal information',
  'Contact information',
  'Academic information',
  'Employment information',
  'Business information',
  'Agricultural experience',
  'Motivation statement',
  'Project proposal',
  'Funding budget',
  'Relevant skills',
];
const audiences = [
  { value: 'learner', label: 'Learners' },
  { value: 'farmer', label: 'Farmers' },
  { value: 'employer', label: 'Employers' },
  { value: 'sdf', label: 'SDFs' },
  { value: 'training_provider', label: 'Training providers' },
];
const statuses = ['Open', 'Upcoming', 'Closed'];
const employmentTypes = ['Permanent', 'Fixed term', 'Seasonal', 'Contract', 'Internship'];
const sortOptions = [
  { value: 'deadline', label: 'Deadline' },
  { value: 'title', label: 'Title' },
  { value: 'newest', label: 'Newest' },
];
const durationOptions = ['4 weeks', '8 weeks', '12 weeks', '6 months', '12 months'];
const accreditationOptions = ['Accredited programme', 'Provider-recognised programme', 'Non-accredited skills programme', 'Pending confirmation'];
const capacityOptions = ['10 learners', '20 learners', '30 learners', '50 learners', '100 learners'];
const feeOptions = ['Free', 'R500', 'R1 000', 'R2 500', 'R5 000', 'Contact provider'];
const locationOptions = ['Online only', 'Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'];
const qualificationOptions = ['No prior qualification required', 'Grade 9 or equivalent', 'Grade 12 or equivalent', 'Relevant agricultural experience', 'Relevant certificate or diploma'];
const requirementOptions = ['No additional requirements', 'Basic computer literacy', 'Access to a smartphone or computer', 'Relevant agricultural experience', 'Attend an orientation session'];
const documentOptions = ['No documents required', 'CV or learner profile', 'Proof of qualification', 'Proof of agricultural experience', 'Motivation statement'];
const trainingTitleOptions = [
  'Crop Production Skills Programme',
  'Animal Production Skills Programme',
  'Horticulture and Vegetable Production',
  'Agricultural Business Management',
  'Farm Safety and Compliance Training',
];
const trainingDescriptionOptions = [
  'Practical agricultural training that develops workplace-ready skills for sustainable farming.',
  'A structured programme combining agricultural knowledge, practical activities, and learner support.',
  'Training designed to help participants improve production, business planning, and farm management skills.',
  'An introductory agricultural programme for learners preparing for work or further study.',
];
const learningOutcomeOptions = [
  'Apply safe and sustainable agricultural production practices.',
  'Demonstrate practical crop, livestock, or horticultural skills.',
  'Use basic farm records, budgets, and production plans.',
  'Identify workplace safety, quality, and compliance requirements.',
  'Develop entry-level skills for agricultural employment or enterprise.',
];

function TextInput({ accessibilityLabel, placeholder, ...props }: TextInputProps) {
  const label = accessibilityLabel || placeholder;
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <NativeTextInput
        {...props}
        accessibilityLabel={accessibilityLabel}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
      />
    </View>
  );
}

function OptionField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <FilterDropdown
      label={label}
      items={[{ id: '', name: `Select ${label.toLowerCase()}` }, ...options.map((item) => ({ id: item, name: item }))]}
      selectedId={value}
      onSelect={onChange}
    />
  );
}

function CalendarField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const initial = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date();
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const days = Array.from({ length: firstDay + daysInMonth }, (_, index) => index < firstDay ? null : index - firstDay + 1);
  const formatDate = (day: number) => `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={styles.dateField}>
        <Text style={value ? styles.dateValue : styles.datePlaceholder}>{value || 'Select a date'}</Text>
        <Ionicons name="calendar-outline" size={18} color={palette.primaryDark} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.calendarBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.calendarCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.calendarHeader}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setMonth(new Date(year, monthIndex - 1, 1))}><Ionicons name="chevron-back" size={20} color={palette.primary} /></Pressable>
              <Text style={styles.calendarTitle}>{month.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth(new Date(year, monthIndex + 1, 1))}><Ionicons name="chevron-forward" size={20} color={palette.primary} /></Pressable>
            </View>
            <View style={styles.calendarWeek}><Text style={styles.calendarWeekText}>Su</Text><Text style={styles.calendarWeekText}>Mo</Text><Text style={styles.calendarWeekText}>Tu</Text><Text style={styles.calendarWeekText}>We</Text><Text style={styles.calendarWeekText}>Th</Text><Text style={styles.calendarWeekText}>Fr</Text><Text style={styles.calendarWeekText}>Sa</Text></View>
            <View style={styles.calendarGrid}>
              {days.map((day, index) => day ? (
                <Pressable key={index} accessibilityRole="button" accessibilityLabel={formatDate(day)} onPress={() => { onChange(formatDate(day)); setOpen(false); }} style={[styles.calendarDay, value === formatDate(day) && styles.calendarDaySelected]}>
                  <Text style={[styles.calendarDayText, value === formatDate(day) && styles.calendarDayTextSelected]}>{day}</Text>
                </Pressable>
              ) : <View key={index} style={styles.calendarDay} />)}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function OpportunitiesScreen() {
  const params = useLocalSearchParams<{ category?: string; workspace?: string }>();
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
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setCategory(
        typeof params.category === 'string' && categories.includes(params.category)
          ? params.category
          : ''
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [params.category]);
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
  const hasBeenFocused = useRef(false);
  const visibleCategories = session?.activeRole === 'farmer'
    ? farmerCategories
    : session?.activeRole === 'employer'
      ? employerCategories
      : session?.activeRole === 'training_provider'
        ? ['Training', 'Learnership', 'Skills Development', 'Training Service', 'Training Partnership', 'Funding']
      : categories;
  const selectedAdminWorkspace = params.workspace === 'review' || params.workspace === 'published'
    ? params.workspace
    : 'all';
  const isAdminPublisherApplicantView = session?.activeRole === 'administrator' && params.workspace === 'applicants';

  useFocusEffect(useCallback(() => {
    if (hasBeenFocused.current) setRetry((current) => current + 1);
    hasBeenFocused.current = true;
  }, []));

  useEffect(() => {
    let isCurrent = true;
    if (session?.activeRole === 'sdf' || session?.activeRole === 'employer') {
      return () => {
        isCurrent = false;
      };
    }
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
    if (session?.activeRole === 'sdf' || session?.activeRole === 'employer') {
      return () => {
        isCurrent = false;
      };
    }
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
  }, [retry, session]);

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

  if (session?.activeRole === 'sdf') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <BackButton />
          <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>ORGANISATION WORKFORCE</Text>
                <Text style={styles.heading}>Programme submissions</Text>
                <Text style={styles.subtitle}>Submit and track skills development programmes and approval outcomes.</Text>
              </View>
            </View>
            <StakeholderOpportunityManagement
              activeRole="sdf"
              contactEmail={session.user.email}
            />
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  if (session?.activeRole === 'employer') {
    const requestedWorkspace = typeof params.workspace === 'string' ? params.workspace : 'manage';
    const workspace = ['manage', 'applicants', 'passports', 'funding'].includes(requestedWorkspace)
      ? requestedWorkspace
      : 'manage';
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <BackButton />
          <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>EMPLOYER WORKSPACE</Text>
                <Text style={styles.heading}>
                  {workspace === 'applicants' ? 'Applicant review' : workspace === 'passports' ? 'Applicant skills passports' : workspace === 'funding' ? 'Funding support' : 'Employer opportunities'}
                </Text>
                <Text style={styles.subtitle}>
                  {workspace === 'applicants'
                    ? 'Review applications for your own published opportunities.'
                    : workspace === 'passports'
                      ? 'View skills and credentials only for applicants who have shared their Passport with you.'
                      : workspace === 'funding'
                        ? 'Find official employer funding and training support information.'
                        : 'Create and manage your organisation’s job and workplace opportunity submissions.'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Manage employer profile"
                onPress={() => router.push('/profile')}
                style={styles.headerButton}
              >
                <Ionicons name="business-outline" size={19} color={palette.primary} />
              </Pressable>
            </View>
            {workspace === 'manage' ? (
              <StakeholderOpportunityManagement
                activeRole="employer"
                contactEmail={session.user.email}
              />
            ) : null}
            {workspace === 'applicants' ? <EmployerApplicantManagement /> : null}
            {workspace === 'passports' ? <EmployerApplicantManagement view="passports" /> : null}
            {workspace === 'funding' ? <EmployerFundingSupport /> : null}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  if (isAdminPublisherApplicantView) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <BackButton />
          <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>PUBLISHER WORKSPACE</Text>
                <Text style={styles.heading}>My posted job applicants</Text>
                <Text style={styles.subtitle}>Review and schedule applicants only for job opportunities you posted.</Text>
              </View>
            </View>
            <EmployerApplicantManagement />
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  if (session?.activeRole === 'training_provider') {
    const requestedWorkspace = typeof params.workspace === 'string' ? params.workspace : 'submissions';
    const workspace = requestedWorkspace === 'outcomes' ? 'outcomes' : 'submissions';
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <BackButton />
          <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>TRAINING PROVIDER WORKSPACE</Text>
                <Text style={styles.heading}>{workspace === 'outcomes' ? 'Programme review outcomes' : 'Programme submissions'}</Text>
                <Text style={styles.subtitle}>
                  {workspace === 'outcomes'
                    ? 'Track administrator decisions and review notes for your submitted programmes.'
                    : 'Submit courses, learnerships, training services, partnerships, and eligible training-related funding for review.'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Manage training provider profile"
                onPress={() => router.push({ pathname: '/learning', params: { section: 'Provider tools' } })}
                style={styles.headerButton}
              >
                <Ionicons name="business-outline" size={19} color={palette.primary} />
              </Pressable>
            </View>
            <StakeholderOpportunityManagement
              activeRole="training_provider"
              contactEmail={session.user.email}
              workspace={workspace}
            />
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.eyebrow}>{session?.activeRole === 'administrator' ? 'ADMINISTRATION' : 'AGRICONNECT 360'}</Text>
            <Text style={styles.heading}>{session?.activeRole === 'administrator'
              ? selectedAdminWorkspace === 'review'
                ? 'Submission review'
                : selectedAdminWorkspace === 'published' ? 'Published listings' : 'Opportunity administration'
              : 'Opportunities'}</Text>
            <Text style={styles.subtitle}>{session?.activeRole === 'administrator'
              ? selectedAdminWorkspace === 'review'
                ? 'Review submitted opportunities and programmes.'
                : selectedAdminWorkspace === 'published'
                  ? 'Manage approved and published opportunity listings.'
                  : 'Review and manage opportunity submissions.'
              : 'Find agriculture opportunities relevant to your journey.'}</Text>
            </View>
          {session?.activeRole !== 'administrator' ? <Pressable
            accessibilityRole="button"
            accessibilityLabel="View my applications"
            onPress={() => router.push('/applications')}
            style={styles.headerButton}
          >
            <Ionicons name="reader-outline" size={19} color={palette.primary} />
          </Pressable> : null}
        </View>

        {session?.activeRole === 'administrator' ? (
          <AdministratorOpportunityManagement
            workspace={selectedAdminWorkspace}
          />
        ) : null}
        {session && !['administrator', 'employer', 'sdf', 'training_provider'].includes(session.activeRole) ? (
          <View style={styles.managementPanel}>
            <Text style={styles.managementSubheading}>Posting access</Text>
            <Text style={styles.sectionHint}>
              Your assigned role is {session.activeRole.replace('_', ' ')}. Opportunity submissions are available to Employer, SDF, and Training Provider accounts. The audience filter below only filters listings; it does not grant permission to post. Contact an administrator if your account needs a different assigned role.
            </Text>
          </View>
        ) : null}

        {session?.activeRole !== 'administrator' ? (
        <>
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
        <FilterDropdown
          label="Category"
          items={[{ id: '', name: 'All' }, ...visibleCategories.map((item) => ({ id: item, name: item }))]}
          selectedId={category}
          onSelect={setCategory}
        />

        <Text style={styles.filterLabel}>Employment type</Text>
        <FilterDropdown
          items={[{ id: '', name: 'All types' }, ...employmentTypes.map((item) => ({ id: item, name: item }))]}
          selectedId={employmentTypeFilter}
          onSelect={setEmploymentTypeFilter}
        />

        <Text style={styles.filterLabel}>Audience</Text>
        <FilterDropdown
          items={[{ id: '', name: 'All audiences' }, ...audiences.map((item) => ({ id: item.value, name: item.label }))]}
          selectedId={audience}
          onSelect={setAudience}
        />

        <Text style={styles.filterLabel}>Application status</Text>
        <FilterDropdown
          items={[{ id: '', name: 'All statuses' }, ...statuses.map((item) => ({ id: item, name: item }))]}
          selectedId={status}
          onSelect={setStatus}
        />

        <View style={styles.filterHeading}>
          <Text style={styles.filterLabel}>Sort by</Text>
          {updating ? <ActivityIndicator size="small" color={palette.primary} /> : null}
        </View>
        <FilterDropdown
          items={sortOptions.map((item) => ({ id: item.value, name: item.label }))}
          selectedId={sort}
          onSelect={setSort}
        />

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
        </>
        ) : null}
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
  workspace = 'submissions',
}: {
  activeRole: 'employer' | 'sdf' | 'training_provider';
  contactEmail: string;
  workspace?: 'submissions' | 'outcomes';
}) {
  const isEmployer = activeRole === 'employer';
  const isSdf = activeRole === 'sdf';
  const isProvider = activeRole === 'training_provider';
  const isOutcomesView = isProvider && workspace === 'outcomes';
  const endpoint = isEmployer ? '/employer/opportunities' : isSdf ? '/sdf/opportunities' : '/provider/opportunities';
  const listingLabel = isEmployer ? 'job listings' : isSdf ? 'skills development opportunities' : 'training programmes';
  const opportunityCategories = isEmployer
    ? ['Employment', 'Internship', 'Workplace Opportunity', 'Training Need']
    : isProvider
    ? ['Training', 'Learnership', 'Skills Development', 'Training Service', 'Training Partnership', 'Funding']
    : ['Skills Development', 'Training Need', 'Training', 'Learnership', 'Training Partnership'];
  const [submissions, setSubmissions] = useState<Opportunity[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [category, setCategory] = useState(activeRole === 'employer' ? 'Employment' : 'Training');
  const [opportunityDetails, setOpportunityDetails] = useState<Record<string, string>>({});
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
  const [isFormExpanded, setIsFormExpanded] = useState(false);
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
    setIsFormExpanded(false);
    setTitle('');
    setDescription('');
    setLocation('');
    setEmploymentType('');
    setCategory(isEmployer ? 'Employment' : 'Training');
    setOpportunityDetails({});
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
    setIsFormExpanded(true);
    setTitle(item.title);
    setDescription(item.description);
    setLocation(item.location || '');
    setEmploymentType(item.employmentType || '');
    setCategory(item.category);
    setOpportunityDetails(item.opportunityDetails || {});
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
        ...(isProvider && category === 'Funding' ? { opportunityDetails } : {}),
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

  const visibleSubmissions = isOutcomesView
    ? submissions.filter((item) => item.status !== 'Draft')
    : submissions;
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
      {!isEmployer && !isOutcomesView ? (
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
      {!isOutcomesView ? (
      <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isFormExpanded }}
        onPress={() => setIsFormExpanded((expanded) => !expanded)}
        style={styles.createContentCard}
      >
        <View style={styles.createContentIcon}>
          <Ionicons name={isFormExpanded ? 'create-outline' : 'add-circle-outline'} size={24} color={palette.primary} />
        </View>
        <View style={styles.fundingStatusCopy}>
          <Text style={styles.managementTitle}>
            {editingId ? `Editing: ${title || 'submission'}` : isFormExpanded ? 'Opportunity form' : isEmployer ? 'Create a job or training opportunity' : isSdf ? 'Submit a skills development opportunity' : 'Submit a training programme'}
          </Text>
          <Text style={styles.managementMeta}>{isFormExpanded ? 'Tap to minimise this form.' : 'Open the form when you are ready to create a submission.'}</Text>
        </View>
        <Ionicons name={isFormExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={palette.primary} />
      </Pressable>
      {isFormExpanded ? (
      <>
      <Text style={styles.managementSubheading}>
        {editingId
          ? `Editing: ${title || 'submission'}`
          : isEmployer
            ? isEmployerTrainingNeed ? 'Submit an employee training need' : 'Submit a job, internship, or workplace opportunity'
            : isSdf
              ? 'Submit a skills development opportunity'
              : 'Submit a training programme'}
      </Text>
      {!isEmployer && !isEmployerTrainingNeed ? (
        <>
          <OptionField label="Training opportunity title" value={title} options={trainingTitleOptions} onChange={setTitle} />
          <OptionField label="Opportunity description" value={description} options={trainingDescriptionOptions} onChange={setDescription} />
        </>
      ) : (
        <>
          <TextInput accessibilityLabel={`${isEmployerTrainingNeed ? 'Training need' : 'Job or workplace opportunity'} title`} value={title} onChangeText={setTitle} placeholder={`${isEmployerTrainingNeed ? 'Training need' : 'Job or workplace opportunity'} title`} style={styles.managementInput} maxLength={120} />
          <TextInput accessibilityLabel="Opportunity description" value={description} onChangeText={setDescription} placeholder="Description" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={2000} />
        </>
      )}
      {isEmployer ? (
        <>
          <FilterDropdown
            label="Opportunity type"
            items={[{ id: '', name: 'Select an opportunity type' }, ...opportunityCategories.map((item) => ({ id: item, name: item }))]}
            selectedId={category}
            onSelect={(item) => {
                setCategory(item);
                setAudience(item === 'Training Need' ? 'training_provider' : 'learner');
              }}
          />
          {isEmployerTrainingNeed ? (
            <>
              <FilterDropdown
                label="Training sponsor or delivery partner"
                items={[
                  { value: '', label: 'Select a delivery partner' },
                  { value: 'training_provider', label: 'Training providers' },
                  { value: 'sdf', label: 'SDFs' },
                ].map((item) => ({ id: item.value, name: item.label }))}
                selectedId={audience}
                onSelect={setAudience}
              />
              <Text style={styles.managementMeta}>This listing is for learners seeking training. Select the training provider or SDF sponsoring or delivering it. Learners can apply after administrator approval and publication. Do not include employee names or sensitive personal information.</Text>
            </>
          ) : null}
        </>
      ) : null}
      {!isEmployer || isEmployerTrainingNeed ? (
        <>
          {!isEmployer ? (
            <FilterDropdown
              label="Opportunity category"
              items={[{ id: '', name: 'Select a category' }, ...opportunityCategories.map((item) => ({ id: item, name: item }))]}
              selectedId={category}
              onSelect={setCategory}
            />
          ) : null}
          {!isEmployerTrainingNeed ? (
            <>
              <FilterDropdown
                label="Eligible audience"
                items={[
                  { id: '', name: 'Select an audience' },
                  ...audiences.map((item) => ({ id: item.value, name: item.label })),
                  { id: '*', name: 'All eligible users' },
                ]}
                selectedId={audience}
                onSelect={setAudience}
              />
            </>
          ) : null}
          {isProvider && category === 'Funding' ? (
            <>
              <Text style={styles.managementSubheading}>Training-related funding details</Text>
              {administratorDetailFields.Funding.map((field) => (
                <TextInput
                  key={field.key}
                  accessibilityLabel={field.label}
                  value={opportunityDetails[field.key] || ''}
                  onChangeText={(value) => setOpportunityDetails((current) => ({ ...current, [field.key]: value }))}
                  placeholder={field.label}
                  style={[styles.managementInput, ['fundingPurpose', 'projectObjectives', 'expectedOutcomes'].includes(field.key) && styles.managementMultiline]}
                  multiline={['fundingPurpose', 'projectObjectives', 'expectedOutcomes'].includes(field.key)}
                  maxLength={500}
                />
              ))}
              <Text style={styles.managementMeta}>Funding submissions must support agricultural training or skills development. Administrator review does not guarantee funding approval.</Text>
            </>
          ) : null}
          {!isEmployer && !isEmployerTrainingNeed ? (
            <OptionField label="Learning outcomes" value={trainingObjectives} options={learningOutcomeOptions} onChange={setTrainingObjectives} />
          ) : (
            <TextInput
              accessibilityLabel={isEmployerTrainingNeed ? 'Employee training objectives' : 'Training objectives'}
              value={trainingObjectives}
              onChangeText={setTrainingObjectives}
              placeholder={isEmployerTrainingNeed ? 'What training do employees need?' : 'Training objectives'}
              style={[styles.managementInput, styles.managementMultiline]}
              multiline
              maxLength={2000}
            />
          )}
          {isProvider ? (
            <>
              <OptionField label="Accreditation information" value={accreditation} options={accreditationOptions} onChange={setAccreditation} />
              <OptionField label="Programme duration" value={duration} options={durationOptions} onChange={setDuration} />
              <FilterDropdown
                label="Training delivery method"
                items={[{ id: '', name: 'Select a delivery method' }, ...['Online', 'Physical', 'Hybrid'].map((item) => ({ id: item, name: item }))]}
                selectedId={deliveryMethod}
                onSelect={setDeliveryMethod}
              />
              <OptionField label="Learner capacity" value={capacity} options={capacityOptions} onChange={setCapacity} />
              <OptionField label="Programme fee in ZAR" value={fees} options={feeOptions} onChange={setFees} />
            </>
          ) : (
            <>
              <TextInput accessibilityLabel="Required skills" value={requiredSkills} onChangeText={setRequiredSkills} placeholder="Required or priority skills (one per line)" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={1200} />
              <TextInput accessibilityLabel="Number of participants" value={participantCount} onChangeText={setParticipantCount} placeholder="Number of employees / participants" style={styles.managementInput} keyboardType="number-pad" maxLength={5} />
            </>
          )}
          <CalendarField label="Programme start date" value={startDate} onChange={setStartDate} />
          <CalendarField label="Programme end date" value={endDate} onChange={setEndDate} />
        </>
      ) : null}
      <OptionField label="Opportunity location" value={location} options={locationOptions} onChange={setLocation} />
      {isEmployer && !isEmployerTrainingNeed ? (
        <TextInput accessibilityLabel="Employment type" value={employmentType} onChangeText={setEmploymentType} placeholder="Employment type (for example, permanent)" style={styles.managementInput} maxLength={80} />
      ) : null}
      {!isEmployerTrainingNeed ? (
        <OptionField label={isEmployer ? 'Qualifications' : 'Entry qualifications'} value={qualifications} options={qualificationOptions} onChange={setQualifications} />
      ) : null}
      <OptionField label={isEmployerTrainingNeed ? 'Training request requirements' : isEmployer ? 'Job requirements' : 'Eligibility requirements'} value={requirements} options={requirementOptions} onChange={setRequirements} />
      <OptionField label="Required application documents" value={requiredDocuments} options={documentOptions} onChange={setRequiredDocuments} />
      <Text style={styles.managementMeta}>Do not request identity, passport, bank, health, or biometric documents. Applicants can upload PDF, JPG, or PNG files up to 2 MB each.</Text>
      <CalendarField label="Application deadline" value={closingDate} onChange={setClosingDate} />
      <TextInput accessibilityLabel="Application instructions" value={applicationInstructions} onChangeText={setApplicationInstructions} placeholder="How to apply" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={1000} />
      {!isEmployer ? (
        <>
          <Text style={styles.managementMeta}>Contact email on this submission: {contactEmail}. Submissions are not visible publicly until an administrator approves and publishes them.</Text>
          <Text style={styles.managementSubheading}>{isProvider ? 'Accreditation & supporting documents' : 'Supporting documents'}</Text>
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
            <Text style={styles.managementButtonText}>{pickingDocument ? 'Selecting…' : isProvider ? 'Add accreditation or supporting document' : 'Add supporting document'}</Text>
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
      </>
      ) : null}
      </>
      ) : null}

      <Text style={styles.managementSubheading}>{isOutcomesView ? 'Review decisions and status' : 'Your submissions'}</Text>
      {visibleSubmissions.length ? visibleSubmissions.map((item) => (
        <View key={item.id} style={styles.managementCard}>
          <Text style={styles.managementTitle}>{item.title}</Text>
          <Text style={styles.managementMeta}>{item.organization} · {item.category} · {item.status}</Text>
          {item.reviewNote ? <Text style={styles.managementError}>Review note: {item.reviewNote}</Text> : null}
          {item.startDate || item.endDate ? <Text style={styles.managementMeta}>Programme dates: {item.startDate || 'Not set'} to {item.endDate || 'Not set'}</Text> : null}
          {item.trainingObjectives ? <Text style={styles.managementMeta}>Objectives: {item.trainingObjectives}</Text> : null}
          {item.supportingDocuments?.map((document) => <Text key={document.id} style={styles.managementMeta}>Supporting document: {document.filename}</Text>)}
          {!isOutcomesView ? <View style={styles.managementActions}>
            {isProvider && item.status === 'Published' ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => Alert.alert(
                  'Archive approved listing?',
                  'This will remove the listing from public opportunities. It cannot be edited or republished from this workspace.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Archive listing', style: 'destructive', onPress: () => void withdraw(item) },
                  ]
                )}
                style={[styles.managementButton, styles.rejectManagementButton, busy && styles.managementDisabled]}
              >
                <Text style={styles.managementButtonText}>Archive approved listing</Text>
              </Pressable>
            ) : null}
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
          </View> : null}
        </View>
      )) : <EmptyState text={isOutcomesView
        ? 'No submitted programmes have review outcomes yet.'
        : `You have not submitted any ${listingLabel}.`} />}
    </View>
  );
}

type EmployerCandidate = {
  id: string;
  reference: string;
  opportunityId: string;
  opportunityTitle: string;
  opportunityCategory: string;
  applicationData: {
    fullName?: string;
    email?: string;
    phone?: string;
    motivation?: string;
  };
  status: string;
  submittedAt: string | null;
  feedback: string;
  interviewAt: string;
  inductionDate: string;
  employmentStartDate: string;
  documents: { id: string; requirement: string; filename: string; mimeType: string; size: number }[];
};

type ApplicantPassport = {
  skills: { id: string; name: string; category: string; level: string; verificationStatus: string }[];
  certificates: { courseId: string; issuer: string; issuedAt: string; verificationStatus: string }[];
  records: { id: string; recordType: string; title: string; organisation: string; level: string; status: string; verificationStatus: string }[];
};

function EmployerApplicantPassport({ applicationId }: { applicationId: string }) {
  const [passport, setPassport] = useState<ApplicantPassport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPassport = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const payload = await apiFetch<ApplicantPassport>(
        `/employer/applications/${encodeURIComponent(applicationId)}/passport`
      );
      setPassport(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Applicant passport could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.applicationList}>
      <Pressable accessibilityRole="button" disabled={loading} onPress={() => void loadPassport()} style={styles.summaryLink}>
        <Text style={styles.summaryLinkText}>{loading ? 'Loading passport…' : passport ? 'Refresh applicant skills passport' : 'View applicant skills passport'}</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.managementError}>{error}</Text> : null}
      {passport ? (
        <View>
          <Text style={styles.managementMeta}>Self-reported skills · not independently verified</Text>
          {passport.skills.length ? passport.skills.map((skill) => (
            <Text key={skill.id} style={styles.managementMeta}>
              {skill.name}{skill.category ? ` · ${skill.category}` : ''} · {skill.level}
            </Text>
          )) : <Text style={styles.managementMeta}>No skills recorded.</Text>}
          <Text style={styles.managementMeta}>Recorded credentials</Text>
          {passport.certificates.length ? passport.certificates.map((credential) => (
            <Text key={`${credential.courseId}-${credential.issuedAt}-${credential.issuer}`} style={styles.managementMeta}>
              {credential.issuer} · {credential.issuedAt} · {credential.verificationStatus}
            </Text>
          )) : <Text style={styles.managementMeta}>No credentials recorded. A trusted credential issuer is not connected.</Text>}
          <Text style={styles.managementMeta}>Qualifications and experience</Text>
          {passport.records.length ? passport.records.map((record) => (
            <Text key={record.id} style={styles.managementMeta}>
              {record.title} · {[record.recordType, record.organisation, record.level, record.status, record.verificationStatus].filter(Boolean).join(' · ')}
            </Text>
          )) : <Text style={styles.managementMeta}>No additional Passport records provided.</Text>}
        </View>
      ) : null}
    </View>
  );
}

function EmployerApplicantManagement({ view = 'recruitment' }: { view?: 'recruitment' | 'passports' }) {
  const [applications, setApplications] = useState<EmployerCandidate[]>([]);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState<Record<string, {
    interviewAt: string;
    inductionDate: string;
    employmentStartDate: string;
  }>>({});
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
      const currentSchedule = schedule[application.id] || {
        interviewAt: application.interviewAt || '',
        inductionDate: application.inductionDate || '',
        employmentStartDate: application.employmentStartDate || '',
      };
      const { application: updated } = await apiFetch<{ application: EmployerCandidate }>(
        `/employer/applications/${encodeURIComponent(application.id)}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status,
            feedback: feedback[application.id] || '',
            interviewAt: currentSchedule.interviewAt,
            inductionDate: currentSchedule.inductionDate,
            employmentStartDate: currentSchedule.employmentStartDate,
          }),
        }
      );
      setApplications((current) => current.map((item) => item.id === application.id
        ? { ...item, ...updated }
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
  const isPassportView = view === 'passports';
  const isRecruitmentOpportunity = (application: EmployerCandidate) =>
    ['Employment', 'Internship', 'Workplace Opportunity'].includes(application.opportunityCategory);

  return (
    <View style={styles.managementPanel}>
      <SectionHeading title={isPassportView ? 'Applicant skills passports' : 'Candidates and recruitment'} count={applications.length} />
      <Text style={styles.sectionHint}>
        {isPassportView
          ? 'Passport information is available only for applicants who have shared it with your organisation. Records are limited to the applicants for your published opportunities.'
          : 'Review only candidates who applied to your own published jobs, internships, workplace opportunities, or training needs. Applicant details and files are private recruitment information; access is recorded.'}
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
        accessibilityLabel={isPassportView ? 'Search applicants' : 'Search candidates'}
        value={search}
        onChangeText={setSearch}
        placeholder={isPassportView ? 'Search applicants or opportunities' : 'Search candidates, applications, or motivation'}
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
          {!isPassportView ? (
            <>
              <Text style={styles.managementMeta}>{application.applicationData.email || 'Email not provided'}{application.applicationData.phone ? ` · ${application.applicationData.phone}` : ''}</Text>
              <Text style={styles.managementMeta}>{application.status}{application.submittedAt ? ` · Submitted ${formatDate(application.submittedAt.slice(0, 10))}` : ''}</Text>
              {application.applicationData.motivation ? <Text style={styles.description}>{application.applicationData.motivation}</Text> : null}
              {application.feedback ? <Text style={styles.managementMeta}>Feedback shared with applicant: {application.feedback}</Text> : null}
              {isRecruitmentOpportunity(application) ? (
                <View style={styles.schedulePanel}>
                  <Text style={styles.managementTitle}>Interview and employment schedule</Text>
                  <Text style={styles.managementMeta}>Only you, as the opportunity publisher, can set these dates.</Text>
                  <TextInput
                    accessibilityLabel={`Interview date and time for ${application.applicationData.fullName || 'candidate'}`}
                    value={schedule[application.id]?.interviewAt ?? application.interviewAt ?? ''}
                    onChangeText={(value) => setSchedule((current) => ({
                      ...current,
                      [application.id]: {
                        interviewAt: value,
                        inductionDate: current[application.id]?.inductionDate ?? application.inductionDate ?? '',
                        employmentStartDate: current[application.id]?.employmentStartDate ?? application.employmentStartDate ?? '',
                      },
                    }))}
                    placeholder="Interview date & time (YYYY-MM-DDTHH:MM)"
                    style={styles.managementInput}
                    maxLength={16}
                    autoCapitalize="none"
                  />
                  <TextInput
                    accessibilityLabel={`Induction date for ${application.applicationData.fullName || 'candidate'}`}
                    value={schedule[application.id]?.inductionDate ?? application.inductionDate ?? ''}
                    onChangeText={(value) => setSchedule((current) => ({
                      ...current,
                      [application.id]: {
                        interviewAt: current[application.id]?.interviewAt ?? application.interviewAt ?? '',
                        inductionDate: value,
                        employmentStartDate: current[application.id]?.employmentStartDate ?? application.employmentStartDate ?? '',
                      },
                    }))}
                    placeholder="Induction date (YYYY-MM-DD)"
                    style={styles.managementInput}
                    maxLength={10}
                    autoCapitalize="none"
                  />
                  <TextInput
                    accessibilityLabel={`Job start date for ${application.applicationData.fullName || 'candidate'}`}
                    value={schedule[application.id]?.employmentStartDate ?? application.employmentStartDate ?? ''}
                    onChangeText={(value) => setSchedule((current) => ({
                      ...current,
                      [application.id]: {
                        interviewAt: current[application.id]?.interviewAt ?? application.interviewAt ?? '',
                        inductionDate: current[application.id]?.inductionDate ?? application.inductionDate ?? '',
                        employmentStartDate: value,
                      },
                    }))}
                    placeholder="Job start date (YYYY-MM-DD)"
                    style={styles.managementInput}
                    maxLength={10}
                    autoCapitalize="none"
                  />
                </View>
              ) : null}
            </>
          ) : <Text style={styles.managementMeta}>{application.opportunityTitle} · {application.status}</Text>}
          <EmployerApplicantPassport applicationId={application.id} />
          {!isPassportView ? application.documents.map((document) => (
            <ApplicationCandidateDocument key={document.id} applicationId={application.id} document={document} />
          )) : null}
          {!isPassportView && [...activeStatuses, 'Approved'].includes(application.status) ? (
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

function AdministratorOpportunityManagement({ workspace }: { workspace: 'all' | 'review' | 'published' }) {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [applicationsByOpportunity, setApplicationsByOpportunity] = useState<Record<string, OpportunityApplication[]>>({});
  const [applicationLoadingId, setApplicationLoadingId] = useState('');
  const [applicationErrors, setApplicationErrors] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState(workspace === 'review' ? 'Review queue' : workspace === 'published' ? 'Published' : 'All');
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
  const [formStep, setFormStep] = useState(0);
  const [opportunityDetails, setOpportunityDetails] = useState<Record<string, string>>({});
  const [eligibilityCriteria, setEligibilityCriteria] = useState<Record<string, string>>({});
  const [applicationOpeningDate, setApplicationOpeningDate] = useState('');
  const [maximumApplications, setMaximumApplications] = useState('');
  const [applicationTerms, setApplicationTerms] = useState('');
  const [applicationInformation, setApplicationInformation] = useState<string[]>([]);
  const [applicationQuestions, setApplicationQuestions] = useState<{
    title: string;
    type: string;
    required: boolean;
    description: string;
    options: string[];
  }[]>([]);
  const [allowSaveAsDraft, setAllowSaveAsDraft] = useState(true);
  const [allowEditsBeforeClosing, setAllowEditsBeforeClosing] = useState(true);
  const [allowWithdrawal, setAllowWithdrawal] = useState(true);
  const [enableReferenceNumbers, setEnableReferenceNumbers] = useState(true);
  const [enableStatusTracking, setEnableStatusTracking] = useState(true);
  const [reviewDepartment, setReviewDepartment] = useState('');
  const [reviewInstructions, setReviewInstructions] = useState('');
  const [confirmSubmission, setConfirmSubmission] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [submissionCutoff, setSubmissionCutoff] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [focusedFundingStatus, setFocusedFundingStatus] = useState<string | null>(null);
  const statusFilters = ['All', 'Review queue', 'Pending Approval', 'Pending Review', 'Changes Requested', 'Draft', 'Approved', 'Published', 'Closed', 'Rejected', 'Archived', 'Open', 'Prototype', 'Not approved / pending approval'];
  const contentCategories = ['Bursary', 'Learnership', 'Funding', 'Employment', 'Internship', 'Workplace Opportunity', 'Grants', 'Training', 'Mentorship', 'Skills Development', 'Training Need', 'Training Service', 'Training Partnership', 'Accreditation'];
  const dateFilters = ['All time', 'Last 7 days', 'Last 30 days'];
  const formSteps = [
    'Basic information',
    'Opportunity details',
    'Eligibility',
    'Application',
    'Documents',
    'Review setup',
    'Preview',
  ];
  const bursaryFundingCategories = ['Bursary', 'Funding', 'Grants'];
  const isBursaryFundingOpportunity = (item: Opportunity) =>
    bursaryFundingCategories.includes(item.category) ||
    /\b(bursary|funding|grants?)\b/i.test(`${item.type} ${item.title}`);

  useEffect(() => {
    setFilter(workspace === 'review' ? 'Review queue' : workspace === 'published' ? 'Published' : 'All');
    setCategoryFilter('All');
    setDateFilter('All time');
    setSubmissionCutoff(0);
    setSearchText('');
    setFocusedFundingStatus(null);
    setShowCreateForm(false);
  }, [workspace]);

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

  const visibleItems = items.filter((item) => {
    const pendingOrNotApproved = ['Pending Approval', 'Pending Review', 'Changes Requested', 'Draft', 'Rejected'].includes(item.status);
    const effectiveStatus = item.effectiveStatus || item.status;
    const matchesStatus = filter === 'All' ||
      (filter === 'Review queue' ? ['Pending Approval', 'Pending Review', 'Changes Requested'].includes(item.status) :
      (filter === 'Published' ? item.status === 'Published' :
        filter === 'Closed' ? item.status === 'Closed' || effectiveStatus === 'Closed' :
          filter === 'Not approved / pending approval' ? pendingOrNotApproved :
            filter === 'Open' ? effectiveStatus === 'Open' : item.status === filter));
    return matchesStatus &&
    (categoryFilter === 'All' ||
      (categoryFilter === 'Bursaries & funding' ? isBursaryFundingOpportunity(item) : item.category === categoryFilter)) &&
    (dateFilter === 'All time' || Boolean(item.submittedAt &&
      Date.parse(item.submittedAt) >= submissionCutoff)) &&
    `${item.title} ${item.organization || ''} ${item.category}`.toLowerCase().includes(searchText.trim().toLowerCase());
  });
  const hasReviewFilter = filter !== 'All' ||
    categoryFilter !== 'All' ||
    dateFilter !== 'All time' ||
    Boolean(searchText.trim());
  const bursaryFundingItems = items.filter(isBursaryFundingOpportunity);
  const fundingStatusCards = [
    { title: 'Published', description: 'Live bursary and funding listings.', count: bursaryFundingItems.filter((item) => item.status === 'Published').length, filter: 'Published' },
    { title: 'Approved', description: 'Approved and waiting to be published.', count: bursaryFundingItems.filter((item) => item.status === 'Approved').length, filter: 'Approved' },
    {
      title: 'Not approved / pending approval',
      description: 'Drafts, awaiting review, changes requested, and rejected listings.',
      count: bursaryFundingItems.filter((item) =>
        ['Pending Approval', 'Pending Review', 'Changes Requested', 'Draft', 'Rejected'].includes(item.status)
      ).length,
      filter: 'Not approved / pending approval',
    },
  ];
  const summaryCards = [
    { title: 'Total', count: items.length, filter: 'All' },
    { title: 'Published', count: items.filter((item) => item.status === 'Published' && item.effectiveStatus !== 'Closed').length, filter: 'Published' },
    { title: 'Pending approval', count: items.filter((item) => ['Pending Approval', 'Pending Review', 'Changes Requested'].includes(item.status)).length, filter: 'Not approved / pending approval' },
    { title: 'Drafts', count: items.filter((item) => item.status === 'Draft').length, filter: 'Draft' },
    { title: 'Closed', count: items.filter((item) => item.status === 'Closed' || item.effectiveStatus === 'Closed').length, filter: 'Closed' },
  ];

  const createDraft = async (action: 'draft' | 'approve' = 'draft') => {
    if (busy) return;
    if (!title.trim() || !description.trim()) {
      setError('Add an opportunity title and description before saving.');
      setFormStep(0);
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await apiFetch<{ opportunity: Opportunity }>(
        editingId ? `/admin/opportunities/${encodeURIComponent(editingId)}` : '/admin/opportunities',
        {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          action: editingId ? 'edit' : action,
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
          opportunityDetails,
          eligibilityCriteria,
          applicationQuestions,
          openingDate: applicationOpeningDate || null,
          applicationConfiguration: {
            openingDate: applicationOpeningDate,
            maximumApplications,
            termsAndConditions: applicationTerms,
            requiredInformation: applicationInformation,
            allowSaveAsDraft,
            allowEditsBeforeClosing,
            allowAfterClosing: false,
            allowWithdrawal,
            enableReferenceNumbers,
            enableStatusTracking,
            assignReviewDepartment: reviewDepartment,
            reviewInstructions,
          },
        }),
      });
      setMessage(action === 'approve' && !editingId
        ? `${result.opportunity.title} submitted for approval. Publish it only after confirming its source and eligibility.`
        : `${result.opportunity.title} saved as a draft. Review and publish it when ready.`);
      setEditingId('');
      setFormStep(0);
      setConfirmSubmission(false);
      setTitle('');
      setDescription('');
      setCategory('Bursary');
      setAudience('learner');
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
      setOpportunityDetails({});
      setEligibilityCriteria({});
      setApplicationOpeningDate('');
      setMaximumApplications('');
      setApplicationTerms('');
      setApplicationInformation([]);
      setApplicationQuestions([]);
      setAllowSaveAsDraft(true);
      setAllowEditsBeforeClosing(true);
      setAllowWithdrawal(true);
      setEnableReferenceNumbers(true);
      setEnableStatusTracking(true);
      setReviewDepartment('');
      setReviewInstructions('');
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
    setOpportunityDetails(item.opportunityDetails || {});
    setEligibilityCriteria(item.eligibilityCriteria || {});
    setApplicationQuestions(item.applicationQuestions || []);
    const configuration = item.applicationConfiguration || {};
    setApplicationInformation(Array.isArray(configuration.requiredInformation)
      ? configuration.requiredInformation.filter((entry): entry is string => typeof entry === 'string')
      : []);
    setApplicationOpeningDate(typeof configuration.openingDate === 'string' ? configuration.openingDate : '');
    setMaximumApplications(configuration.maximumApplications ? String(configuration.maximumApplications) : '');
    setApplicationTerms(typeof configuration.termsAndConditions === 'string' ? configuration.termsAndConditions : '');
    setAllowSaveAsDraft(configuration.allowSaveAsDraft !== false);
    setAllowEditsBeforeClosing(configuration.allowEditsBeforeClosing !== false);
    setAllowWithdrawal(configuration.allowWithdrawal !== false);
    setEnableReferenceNumbers(configuration.enableReferenceNumbers !== false);
    setEnableStatusTracking(configuration.enableStatusTracking !== false);
    setReviewDepartment(typeof configuration.assignReviewDepartment === 'string' ? configuration.assignReviewDepartment : '');
    setReviewInstructions(typeof configuration.reviewInstructions === 'string' ? configuration.reviewInstructions : '');
    setFormStep(0);
    setConfirmSubmission(false);
    setShowCreateForm(true);
    setError('');
    setMessage('');
  };

  const addApplicationQuestion = () => {
    if (applicationQuestions.length >= 20) {
      setError('You can add up to 20 custom application questions.');
      return;
    }
    setApplicationQuestions((current) => [...current, {
      title: '',
      type: 'Short Text',
      required: false,
      description: '',
      options: [],
    }]);
  };

  const updateApplicationQuestion = (
    index: number,
    update: Partial<(typeof applicationQuestions)[number]>
  ) => {
    setApplicationQuestions((current) => current.map((question, questionIndex) =>
      questionIndex === index ? { ...question, ...update } : question
    ));
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

  const toggleOpportunityApplications = async (item: Opportunity) => {
    if (applicationsByOpportunity[item.id]) {
      setApplicationsByOpportunity((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      return;
    }
    if (applicationLoadingId) return;
    setApplicationLoadingId(item.id);
    setApplicationErrors((current) => ({ ...current, [item.id]: '' }));
    try {
      const { applications: results } = await apiFetch<{ applications: OpportunityApplication[] }>(
        `/admin/opportunities/${encodeURIComponent(item.id)}/applications`
      );
      setApplicationsByOpportunity((current) => ({ ...current, [item.id]: results }));
    } catch (cause) {
      setApplicationErrors((current) => ({
        ...current,
        [item.id]: cause instanceof Error ? cause.message : 'Applications could not be loaded.',
      }));
    } finally {
      setApplicationLoadingId('');
    }
  };

  return (
    <View style={styles.managementPanel}>
      <SectionHeading
        title={workspace === 'review'
          ? 'Opportunity & programme review'
          : workspace === 'published'
            ? 'Published opportunities'
            : 'Opportunity management and approval'}
        count={workspace === 'published'
          ? items.filter((item) => item.status === 'Published').length
          : workspace === 'review'
            ? items.filter((item) => ['Pending Approval', 'Pending Review', 'Changes Requested'].includes(item.status)).length
            : items.filter((item) => ['Draft', 'Pending Approval', 'Pending Review', 'Changes Requested'].includes(item.status)).length}
      />
      <Text style={styles.sectionHint}>
        {workspace === 'review'
          ? 'Review submitted employer, SDF, and provider opportunities and programmes. Request changes or reject with a review note. Approval does not establish accreditation.'
          : workspace === 'published'
            ? 'Manage listings that have been approved and published. Review their status and archive or unpublish where permitted.'
            : 'Review SDF, provider, and employer submissions. Use Request changes or Reject with a review note. Only approved and published listings appear to eligible users; a provider&apos;s role verification is required to publish a provider programme. Approval does not mean official accreditation.'}
      </Text>
      {error ? <Text accessibilityRole="alert" style={styles.managementError}>{error}</Text> : null}
      {message ? <Text accessibilityRole="alert" style={styles.managementMessage}>{message}</Text> : null}

      {workspace === 'all' && !focusedFundingStatus ? (
        <>
          <Text style={styles.managementSubheading}>Opportunity overview</Text>
          <View style={styles.fundingStatusCards}>
            {summaryCards.map((card) => (
              <Pressable
                key={card.title}
                accessibilityRole="button"
                onPress={() => {
                  setFilter(card.filter);
                  setCategoryFilter('All');
                  setSearchText('');
                }}
                style={styles.fundingStatusCard}
              >
                <View style={styles.fundingStatusCopy}>
                  <Text style={styles.managementTitle}>{card.title}</Text>
                </View>
                <Text style={styles.fundingStatusCount}>{card.count}</Text>
              </Pressable>
            ))}
          </View>
          <SectionHeading
            title={filter === 'All' || categoryFilter !== 'Bursaries & funding'
              ? 'Review and publication history'
              : `${filter} bursary & funding listings`}
            count={visibleItems.length}
          />
          <TextInput accessibilityLabel="Search content submissions" value={searchText} onChangeText={setSearchText} placeholder="Search title or organisation" style={styles.managementInput} />
          <FilterDropdown
            label="Status"
            items={statusFilters.map((item) => ({ id: item, name: item }))}
            selectedId={filter}
            onSelect={setFilter}
          />
          <FilterDropdown
            label="Filter by category"
            items={['All', 'Bursaries & funding', ...contentCategories].map((item) => ({ id: item, name: item }))}
            selectedId={categoryFilter}
            onSelect={setCategoryFilter}
          />
          <FilterDropdown
            label="Submitted"
            items={dateFilters.map((item) => ({ id: item, name: item }))}
            selectedId={dateFilter}
            onSelect={(item) => {
              setDateFilter(item);
              setSubmissionCutoff(item === 'All time' ? 0 : Date.now() - (item === 'Last 7 days' ? 7 : 30) * 86_400_000);
            }}
          />
        </>
      ) : null}

      {workspace === 'review' ? (
        <>
          <TextInput accessibilityLabel="Search submitted opportunities" value={searchText} onChangeText={setSearchText} placeholder="Search title or organisation" style={styles.managementInput} />
          <FilterDropdown
            label="Review status"
            items={['Review queue', ...statusFilters.filter((item) => ['Pending Approval', 'Pending Review', 'Changes Requested'].includes(item))]
              .map((item) => ({ id: item, name: item }))}
            selectedId={filter}
            onSelect={setFilter}
          />
          <FilterDropdown
            label="Category"
            items={['All', ...contentCategories].map((item) => ({ id: item, name: item }))}
            selectedId={categoryFilter}
            onSelect={setCategoryFilter}
          />
        </>
      ) : null}

      {workspace === 'published' ? (
        <>
          <TextInput accessibilityLabel="Search published opportunities" value={searchText} onChangeText={setSearchText} placeholder="Search title or organisation" style={styles.managementInput} />
          <FilterDropdown
            label="Category"
            items={['All', ...contentCategories].map((item) => ({ id: item, name: item }))}
            selectedId={categoryFilter}
            onSelect={setCategoryFilter}
          />
        </>
      ) : null}

      {focusedFundingStatus ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setFocusedFundingStatus(null);
            setFilter('All');
            setCategoryFilter('All');
            setSearchText('');
            setDateFilter('All time');
            setSubmissionCutoff(0);
          }}
          style={styles.fundingStatusBack}
        >
          <Ionicons name="arrow-back" size={16} color={palette.primary} />
          <Text style={styles.clearText}>Back to bursary & funding statuses</Text>
        </Pressable>
      ) : null}
      {workspace === 'all' ? <Text style={styles.managementSubheading}>Bursaries & funding</Text> : null}
      {workspace !== 'all' ? (
        <SectionHeading
          title={workspace === 'review' ? 'Submissions awaiting review' : 'Published listings'}
          count={visibleItems.length}
        />
      ) : focusedFundingStatus ? (
        <Text style={styles.managementMeta}>{focusedFundingStatus} bursary & funding listings</Text>
      ) : (
        <>
          {!showCreateForm ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowCreateForm(true)}
              style={styles.createContentCard}
            >
              <View style={styles.createContentIcon}>
                <Ionicons name="add-circle-outline" size={24} color={palette.primary} />
              </View>
              <View style={styles.fundingStatusCopy}>
                <Text style={styles.managementTitle}>Create New Opportunity</Text>
                <Text style={styles.managementMeta}>Manage funding, bursaries, training programmes and agricultural opportunities.</Text>
                <Text style={styles.createContentAction}>Create content →</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.primary} />
            </Pressable>
          ) : null}
          <Text style={styles.managementMeta}>Select a status card to view only its matching listings.</Text>
          <View style={styles.fundingStatusCards}>
            {fundingStatusCards.map((card) => (
              <Pressable
                key={card.filter}
                accessibilityRole="button"
                accessibilityState={{ selected: false }}
                onPress={() => {
                  setCategoryFilter('Bursaries & funding');
                  setFilter(card.filter);
                  setSearchText('');
                  setDateFilter('All time');
                  setSubmissionCutoff(0);
                  setShowCreateForm(false);
                  setFocusedFundingStatus(card.filter);
                }}
                style={styles.fundingStatusCard}
              >
                <View style={styles.fundingStatusCopy}>
                  <Text style={styles.managementTitle}>{card.title}</Text>
                  <Text style={styles.managementMeta}>{card.description}</Text>
                </View>
                <Text style={styles.fundingStatusCount}>{card.count}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {workspace === 'all' && !focusedFundingStatus && showCreateForm ? (
      <View style={styles.managementCard}>
        <View style={styles.createFormHeader}>
          <Text style={styles.managementSubheading}>{editingId ? 'Edit opportunity draft' : 'Create an opportunity'}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close content form"
            onPress={() => {
              setShowCreateForm(false);
              setConfirmSubmission(false);
            }}
            style={styles.closeCreateForm}
          >
            <Ionicons name="close" size={20} color={palette.muted} />
          </Pressable>
        </View>
        <Text style={styles.managementMeta}>Step {formStep + 1} of {formSteps.length} · {formSteps[formStep]}</Text>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: formSteps.length, now: formStep + 1 }} style={{ flexDirection: 'row', gap: 4, marginTop: spacing.sm }}>
          {formSteps.map((step, index) => (
            <View key={step} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: index <= formStep ? palette.primary : palette.border }} />
          ))}
        </View>

        {formStep === 0 ? (
          <>
            <TextInput accessibilityLabel="Opportunity title" value={title} onChangeText={setTitle} placeholder="Opportunity title *" style={styles.managementInput} maxLength={120} />
            <FilterDropdown
              label="Opportunity category *"
              items={[{ id: '', name: 'Select a category' }, ...contentCategories.map((item) => ({ id: item, name: item }))]}
              selectedId={category}
              onSelect={setCategory}
            />
            <FilterDropdown
              label="Primary eligible audience *"
              items={[
                { id: '', name: 'Select an audience' },
                ...audiences.map((item) => ({ id: item.value, name: item.label })),
                { id: '*', name: 'All eligible users' },
              ]}
              selectedId={audience}
              onSelect={setAudience}
            />
            <TextInput accessibilityLabel="Organisation or institution" value={organization} onChangeText={setOrganization} placeholder="Organisation or institution *" style={styles.managementInput} maxLength={160} />
            <TextInput accessibilityLabel="Opportunity location" value={location} onChangeText={setLocation} placeholder="Province or location *" style={styles.managementInput} maxLength={120} />
            <TextInput accessibilityLabel="Opportunity description" value={description} onChangeText={setDescription} placeholder="Opportunity description *" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={2000} />
          </>
        ) : null}

        {formStep === 1 ? (
          <>
            <Text style={styles.sectionHint}>Complete the fields relevant to this category. Funding amounts are in South African Rand (ZAR).</Text>
            {(administratorDetailFields[category] || []).map((field) => (
              <TextInput
                key={field.key}
                accessibilityLabel={field.label}
                value={opportunityDetails[field.key] || ''}
                onChangeText={(value) => setOpportunityDetails((current) => ({ ...current, [field.key]: value }))}
                placeholder={field.label}
                style={styles.managementInput}
                maxLength={1000}
                keyboardType={/amount|value|stipend|positions/.test(field.key) ? 'decimal-pad' : 'default'}
              />
            ))}
            {category === 'Funding' || category === 'Grants' ? (
              <>
                <TextInput accessibilityLabel="Co-funding requirement" value={opportunityDetails.coFundingRequirement || ''} onChangeText={(value) => setOpportunityDetails((current) => ({ ...current, coFundingRequirement: value }))} placeholder="Co-funding requirement (Yes / No)" style={styles.managementInput} />
                <TextInput accessibilityLabel="Repayment requirement" value={opportunityDetails.repaymentRequirement || ''} onChangeText={(value) => setOpportunityDetails((current) => ({ ...current, repaymentRequirement: value }))} placeholder="Repayment requirement (Yes / No / Not applicable)" style={styles.managementInput} />
                <TextInput accessibilityLabel="Funding conditions" value={opportunityDetails.fundingConditions || ''} onChangeText={(value) => setOpportunityDetails((current) => ({ ...current, fundingConditions: value }))} placeholder="Funding conditions" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={1000} />
              </>
            ) : null}
            {category === 'Bursary' ? (
              <TextInput accessibilityLabel="Additional bursary conditions" value={opportunityDetails.bursaryConditions || ''} onChangeText={(value) => setOpportunityDetails((current) => ({ ...current, bursaryConditions: value }))} placeholder="Renewal and additional bursary conditions" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={1000} />
            ) : null}
            {!administratorDetailFields[category] ? <Text style={styles.managementMeta}>Add category details in the opportunity description and eligibility section.</Text> : null}
          </>
        ) : null}

        {formStep === 2 ? (
          <>
            <Text style={styles.sectionHint}>List clear, fair eligibility requirements. Leave optional items blank if they do not apply.</Text>
            <TextInput accessibilityLabel="Eligible provinces" value={eligibilityCriteria.provinces || ''} onChangeText={(value) => setEligibilityCriteria((current) => ({ ...current, provinces: value }))} placeholder="Eligible provinces (comma-separated)" style={styles.managementInput} maxLength={500} />
            <TextInput accessibilityLabel="Eligible municipalities" value={eligibilityCriteria.municipalities || ''} onChangeText={(value) => setEligibilityCriteria((current) => ({ ...current, municipalities: value }))} placeholder="Eligible municipalities (optional)" style={styles.managementInput} maxLength={500} />
            <TextInput accessibilityLabel="Minimum age" value={eligibilityCriteria.minimumAge || ''} onChangeText={(value) => setEligibilityCriteria((current) => ({ ...current, minimumAge: value }))} placeholder="Minimum age (optional)" style={styles.managementInput} keyboardType="number-pad" />
            <TextInput accessibilityLabel="Maximum age" value={eligibilityCriteria.maximumAge || ''} onChangeText={(value) => setEligibilityCriteria((current) => ({ ...current, maximumAge: value }))} placeholder="Maximum age (optional)" style={styles.managementInput} keyboardType="number-pad" />
            <TextInput accessibilityLabel="Minimum qualification" value={eligibilityCriteria.minimumQualification || ''} onChangeText={(value) => setEligibilityCriteria((current) => ({ ...current, minimumQualification: value }))} placeholder="Minimum qualification" style={styles.managementInput} maxLength={500} />
            <TextInput accessibilityLabel="Agricultural sector" value={eligibilityCriteria.sector || ''} onChangeText={(value) => setEligibilityCriteria((current) => ({ ...current, sector: value }))} placeholder="Agricultural sector" style={styles.managementInput} maxLength={500} />
            <TextInput accessibilityLabel="Employment status" value={eligibilityCriteria.employmentStatus || ''} onChangeText={(value) => setEligibilityCriteria((current) => ({ ...current, employmentStatus: value }))} placeholder="Employment status" style={styles.managementInput} maxLength={200} />
            <TextInput accessibilityLabel="Additional eligibility conditions" value={eligibilityCriteria.additionalConditions || ''} onChangeText={(value) => setEligibilityCriteria((current) => ({ ...current, additionalConditions: value }))} placeholder="Additional eligibility conditions" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={1000} />
          </>
        ) : null}

        {formStep === 3 ? (
          <>
            <TextInput accessibilityLabel="Application opening date" value={applicationOpeningDate} onChangeText={setApplicationOpeningDate} placeholder="Application opening date (YYYY-MM-DD) *" style={styles.managementInput} maxLength={10} />
            <TextInput accessibilityLabel="Application closing date" value={deadline} onChangeText={setDeadline} placeholder="Application closing date (YYYY-MM-DD) *" style={styles.managementInput} maxLength={10} />
            <TextInput accessibilityLabel="Maximum applications" value={maximumApplications} onChangeText={setMaximumApplications} placeholder="Maximum number of applications (optional)" style={styles.managementInput} keyboardType="number-pad" />
            <TextInput accessibilityLabel="Application instructions" value={instructions} onChangeText={setInstructions} placeholder="Application instructions *" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={1000} />
            <Text style={styles.filterLabel}>Information requested from applicants</Text>
            <View style={styles.chipRow}>
              {applicationInformationOptions.map((item) => (
                <FilterChip
                  key={item}
                  label={item}
                  selected={applicationInformation.includes(item)}
                  onPress={() => setApplicationInformation((current) =>
                    current.includes(item) ? current.filter((entry) => entry !== item) : [...current, item]
                  )}
                />
              ))}
            </View>
            <TextInput accessibilityLabel="Application terms and conditions" value={applicationTerms} onChangeText={setApplicationTerms} placeholder="Application terms and conditions" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={5000} />
            <Text style={styles.filterLabel}>Custom application questions</Text>
            {applicationQuestions.map((question, index) => (
              <View key={`question-${index}`} style={styles.managementCard}>
                <TextInput accessibilityLabel={`Question ${index + 1} title`} value={question.title} onChangeText={(value) => updateApplicationQuestion(index, { title: value })} placeholder="Question title *" style={styles.managementInput} maxLength={240} />
                <TextInput accessibilityLabel={`Question ${index + 1} help text`} value={question.description} onChangeText={(value) => updateApplicationQuestion(index, { description: value })} placeholder="Help text (optional)" style={styles.managementInput} maxLength={500} />
                <View style={styles.chipRow}>
                  {['Short Text', 'Long Text', 'Dropdown', 'Multiple Choice', 'Checkboxes', 'Date', 'Number'].map((type) => (
                    <FilterChip key={type} label={type} selected={question.type === type} onPress={() => updateApplicationQuestion(index, { type })} />
                  ))}
                </View>
                {['Dropdown', 'Multiple Choice', 'Checkboxes'].includes(question.type) ? (
                  <TextInput accessibilityLabel={`Question ${index + 1} answer choices`} value={question.options.join(', ')} onChangeText={(value) => updateApplicationQuestion(index, { options: value.split(',').map((option) => option.trim()).filter(Boolean) })} placeholder="Answer choices, separated by commas (at least 2)" style={styles.managementInput} maxLength={1000} />
                ) : null}
                <FilterChip label={question.required ? 'Required' : 'Optional'} selected={question.required} onPress={() => updateApplicationQuestion(index, { required: !question.required })} />
                <Pressable accessibilityRole="button" onPress={() => setApplicationQuestions((current) => current.filter((_, questionIndex) => questionIndex !== index))} style={styles.cancelEditButton}>
                  <Text style={styles.clearText}>Remove question</Text>
                </Pressable>
              </View>
            ))}
            <Pressable accessibilityRole="button" onPress={addApplicationQuestion} style={[styles.managementButton, styles.secondaryManagementButton]}>
              <Text style={styles.secondaryManagementText}>Add a question</Text>
            </Pressable>
          </>
        ) : null}

        {formStep === 4 ? (
          <>
            <TextInput accessibilityLabel="Required application documents" value={requiredDocuments} onChangeText={setRequiredDocuments} placeholder="Required documents (one per line)" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={804} />
            <Text style={styles.managementMeta}>Use only documents that are necessary for this opportunity. Do not request identity, passport, bank, health, or biometric documents. Applicants can upload PDF, JPG, or PNG files up to 2 MB each.</Text>
          </>
        ) : null}

        {formStep === 5 ? (
          <>
            <Text style={styles.sectionHint}>Provide a reliable public source and configure review settings. Source details support review but do not independently verify official status or eligibility.</Text>
            <TextInput accessibilityLabel="Information source name" value={sourceName} onChangeText={setSourceName} placeholder="Information source name *" style={styles.managementInput} maxLength={160} />
            <TextInput accessibilityLabel="Information source URL" value={sourceUrl} onChangeText={setSourceUrl} placeholder="Source URL (https://...) *" style={styles.managementInput} maxLength={500} autoCapitalize="none" keyboardType="url" />
            <TextInput accessibilityLabel="External application URL" value={applicationUrl} onChangeText={setApplicationUrl} placeholder="Official application page URL (optional)" style={styles.managementInput} maxLength={500} autoCapitalize="none" keyboardType="url" />
            <TextInput accessibilityLabel="Source checked date" value={sourceVerifiedAt} onChangeText={setSourceVerifiedAt} placeholder="Source checked (YYYY-MM-DD) *" style={styles.managementInput} maxLength={10} />
            <TextInput accessibilityLabel="Listing expiry date" value={recordExpiresAt} onChangeText={setRecordExpiresAt} placeholder="Listing expires (YYYY-MM-DD) *" style={styles.managementInput} maxLength={10} />
            <TextInput accessibilityLabel="Reviewing department" value={reviewDepartment} onChangeText={setReviewDepartment} placeholder="Reviewing department" style={styles.managementInput} maxLength={160} />
            <TextInput accessibilityLabel="Review instructions" value={reviewInstructions} onChangeText={setReviewInstructions} placeholder="Reviewer instructions" style={[styles.managementInput, styles.managementMultiline]} multiline maxLength={1000} />
            <View style={styles.chipRow}>
              <FilterChip label="Allow draft applications" selected={allowSaveAsDraft} onPress={() => setAllowSaveAsDraft((value) => !value)} />
              <FilterChip label="Allow edits before closing" selected={allowEditsBeforeClosing} onPress={() => setAllowEditsBeforeClosing((value) => !value)} />
              <FilterChip label="Allow withdrawal" selected={allowWithdrawal} onPress={() => setAllowWithdrawal((value) => !value)} />
              <FilterChip label="Application references" selected={enableReferenceNumbers} onPress={() => setEnableReferenceNumbers((value) => !value)} />
              <FilterChip label="Status tracking" selected={enableStatusTracking} onPress={() => setEnableStatusTracking((value) => !value)} />
            </View>
            <Text style={styles.managementMeta}>Applications after the closing date are disabled by default. Only an authorised administrator can approve and publish this opportunity.</Text>
          </>
        ) : null}

        {formStep === 6 ? (
          <View style={styles.managementCard}>
            <Text style={styles.managementTitle}>{title || 'Opportunity title'}</Text>
            <Text style={styles.managementMeta}>{category} · {organization || 'Organisation'} · {audiences.find((entry) => entry.value === audience)?.label || 'Eligible users'}</Text>
            <Text style={styles.managementMeta}>Location: {location || 'Not provided'} · Deadline: {deadline || 'Not provided'}</Text>
            <Text style={styles.description}>{description || 'Opportunity description'}</Text>
            {Object.entries(opportunityDetails).filter(([, value]) => value.trim()).map(([key, value]) => (
              <Text key={key} style={styles.managementMeta}>{key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}: {value}</Text>
            ))}
            {Object.entries(eligibilityCriteria).filter(([, value]) => value.trim()).map(([key, value]) => (
              <Text key={key} style={styles.managementMeta}>{key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}: {value}</Text>
            ))}
            <Text style={styles.managementMeta}>Application opens: {applicationOpeningDate || 'Not specified'}</Text>
            <Text style={styles.managementMeta}>Application instructions: {instructions || 'Not provided'}</Text>
            <Text style={styles.managementMeta}>Required documents: {requiredDocuments.split(/\r?\n/).map((value) => value.trim()).filter(Boolean).join(', ') || 'None specified'}</Text>
            <Text style={styles.managementMeta}>Custom questions: {applicationQuestions.length}</Text>
            <Text style={styles.managementMeta}>Source: {sourceName || 'Not provided'}{sourceUrl ? ` · ${sourceUrl}` : ''}</Text>
          </View>
        ) : null}

        <View style={styles.managementActions}>
          {formStep > 0 ? (
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => setFormStep((step) => Math.max(0, step - 1))} style={[styles.managementButton, styles.secondaryManagementButton]}>
              <Text style={styles.secondaryManagementText}>Previous</Text>
            </Pressable>
          ) : null}
          {formStep < formSteps.length - 1 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (formStep === 0 && (!title.trim() || !description.trim())) {
                  setError('Opportunity title and description are required to continue.');
                  return;
                }
                setError('');
                setFormStep((step) => Math.min(formSteps.length - 1, step + 1));
              }}
              style={styles.managementButton}
            >
              <Text style={styles.managementButtonText}>Continue</Text>
            </Pressable>
          ) : (
            <>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void createDraft()} style={[styles.managementButton, styles.secondaryManagementButton, busy && styles.managementDisabled]}>
                <Text style={styles.secondaryManagementText}>{busy ? 'Saving…' : 'Save as draft'}</Text>
              </Pressable>
              {!editingId ? (
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirmSubmission(true)} style={[styles.managementButton, busy && styles.managementDisabled]}>
                  <Text style={styles.managementButtonText}>Submit for approval</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
        {confirmSubmission && !editingId ? (
          <View style={styles.managementCard}>
            <Text style={styles.managementTitle}>Submit this opportunity for approval?</Text>
            <Text style={styles.managementMeta}>The listing will not be visible to applicants until it is approved and published. Check dates, source details, eligibility and documents first.</Text>
            <View style={styles.managementActions}>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirmSubmission(false)} style={[styles.managementButton, styles.secondaryManagementButton]}>
                <Text style={styles.secondaryManagementText}>Cancel</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void createDraft('approve')} style={[styles.managementButton, busy && styles.managementDisabled]}>
                <Text style={styles.managementButtonText}>{busy ? 'Submitting…' : 'Confirm submission'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
      ) : null}

      {focusedFundingStatus ? (
        <SectionHeading title={`${focusedFundingStatus} listings`} count={visibleItems.length} />
      ) : null}
      {hasReviewFilter && visibleItems.length === 0 ? (
        <Text style={styles.managementMeta}>
          {workspace === 'review'
            ? 'There are no submitted opportunities or programmes in this review queue.'
            : workspace === 'published'
              ? 'There are no published opportunities matching these filters.'
              : 'No opportunities match the selected filters.'}
        </Text>
      ) : null}
      {hasReviewFilter && visibleItems.length ? visibleItems.map((item) => {
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
            {item.status === 'Published' && isBursaryFundingOpportunity(item) ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: Boolean(applicationsByOpportunity[item.id]) }}
                  disabled={Boolean(applicationLoadingId && applicationLoadingId !== item.id)}
                  onPress={() => void toggleOpportunityApplications(item)}
                  style={[styles.managementButton, styles.secondaryManagementButton, styles.applicationToggle]}
                >
                  <Text style={styles.secondaryManagementText}>
                    {applicationLoadingId === item.id
                      ? 'Loading applications…'
                      : applicationsByOpportunity[item.id]
                        ? 'Hide applicants'
                        : `View applications (${item.applicationCount ?? 0})`}
                  </Text>
                </Pressable>
                {applicationErrors[item.id] ? <Text accessibilityRole="alert" style={styles.managementError}>{applicationErrors[item.id]}</Text> : null}
                {applicationsByOpportunity[item.id] ? (
                  <View style={styles.applicationList}>
                    {applicationsByOpportunity[item.id].length ? applicationsByOpportunity[item.id].map((application) => (
                      <View key={application.id} style={styles.applicationRow}>
                        <View style={styles.fundingStatusCopy}>
                          <Text style={styles.managementTitle}>{application.applicantName}</Text>
                          <Text style={styles.managementMeta}>{application.reference}</Text>
                        </View>
                        <View style={styles.applicationStatus}>
                          <Text style={styles.applicationStatusText}>{application.status}</Text>
                          {application.submittedAt ? <Text style={styles.managementMeta}>{formatDate(application.submittedAt.slice(0, 10))}</Text> : null}
                        </View>
                      </View>
                    )) : <Text style={styles.managementMeta}>No one has applied to this published listing yet.</Text>}
                  </View>
                ) : null}
              </>
            ) : null}
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
      }) : hasReviewFilter ? <EmptyState text={
        categoryFilter === 'Bursaries & funding' && filter !== 'All'
          ? `No ${filter.toLowerCase()} bursary or funding listings.`
          : 'No opportunity submissions match this filter.'
      } /> : (
        <Text style={styles.managementMeta}>Choose a status card or apply a filter to view listings.</Text>
      )}
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
        <Text style={styles.managementButtonText}>{opening ? 'Opening official page…' : 'Open AgriSETA employer funding information'}</Text>
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
  managementPanel: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#E2EAE4',
    shadowColor: '#10291F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  managementCard: {
    backgroundColor: palette.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2EAE4',
  },
  fundingStatusCards: { gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md },
  fundingStatusBack: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs, paddingVertical: spacing.sm },
  fundingStatusCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, padding: spacing.md },
  fundingStatusCardSelected: { borderColor: palette.primary, backgroundColor: '#E6F3EB' },
  fundingStatusCopy: { flex: 1 },
  applicationToggle: { flexGrow: 0, marginTop: spacing.sm },
  applicationList: { backgroundColor: palette.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: spacing.sm, marginTop: spacing.sm },
  applicationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: spacing.sm },
  applicationStatus: { alignItems: 'flex-end' },
  applicationStatusText: { color: palette.primaryDark, fontSize: 11, fontWeight: '800' },
  fundingStatusCount: { color: palette.primaryDark, fontSize: 24, fontWeight: '800' },
  createContentCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  createContentIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#E6F3EB' },
  createContentAction: { color: palette.primary, fontSize: 12, fontWeight: '800', marginTop: spacing.sm },
  createFormHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  closeCreateForm: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  managementSubheading: { color: palette.text, fontSize: 15, fontWeight: '800', marginTop: spacing.md, marginBottom: spacing.xs },
  managementTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  managementMeta: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: spacing.xs },
  schedulePanel: { padding: spacing.sm, marginTop: spacing.md, backgroundColor: palette.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border },
  field: { marginTop: spacing.sm },
  fieldLabel: { color: palette.text, fontSize: 12, fontWeight: '700', marginBottom: 5 },
  dateField: { minHeight: 42, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, backgroundColor: palette.surface, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateValue: { color: palette.text, fontSize: 14 },
  datePlaceholder: { color: palette.muted, fontSize: 14 },
  calendarBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  calendarCard: { width: '100%', maxWidth: 360, backgroundColor: palette.surface, borderRadius: radius.lg, padding: spacing.md },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  calendarTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  calendarWeek: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.xs },
  calendarWeekText: { color: palette.muted, fontSize: 12, fontWeight: '700', textAlign: 'center', width: '14.28%' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDay: { width: '14.28%', height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  calendarDaySelected: { backgroundColor: palette.primary },
  calendarDayText: { color: palette.text, fontSize: 14 },
  calendarDayTextSelected: { color: '#FFFFFF', fontWeight: '800' },
  managementInput: { minHeight: 42, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, backgroundColor: palette.surface, color: palette.text, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
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
