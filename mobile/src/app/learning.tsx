import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/navigation/back-button';
import {
  LearnerSidebar,
  LearnerSidebarDrawer,
  LearnerSidebarMenuButton,
} from '@/components/navigation/learner-sidebar';
import { AppRole, useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type LearningCategory = { id: string; name: string; icon: keyof typeof Ionicons.glyphMap; description: string };
type Programme = { id: string; name: string; description: string; courseType: string; courseCount: number };
type ProviderSummary = {
  id: string;
  name: string;
  location: string;
  description: string;
  verificationStatus: string;
  dataStatus: string;
  programmes: { id: string; title: string; programmeType: string; categoryId?: string }[];
};
type ProviderProfile = Omit<ProviderSummary, 'programmes'> & {
  profileStatus?: string;
  pendingProfileChanges?: { name: string; location: string; description: string } | null;
};
type Course = {
  id: string;
  title: string;
  description: string;
  requirements?: string;
  categoryId: string;
  category: string;
  providerId: string;
  provider: { id: string; name: string; verificationStatus: string; location: string } | null;
  duration: string;
  deliveryMethod: string;
  eligibleRoles: AppRole[];
  programmeType: string;
  location: string;
  accreditation: string;
  status: string;
  dataStatus: string;
  interestEnabled: boolean;
  saved: boolean;
  lessonTitles?: { id: string; title: string }[];
  reviewNote?: string;
};
type Enrollment = {
  id: string;
  reference: string;
  courseId: string;
  course?: Course;
  status: string;
  submittedAt: string | null;
  updatedAt: string;
  applicantNote: string;
  trainingProgress?: number;
  statusHistory: { status: string; date: string }[];
};
type LearningResource = {
  id: string;
  title: string;
  categoryId: string;
  format: string;
  summary: string;
  content?: string[];
  dataStatus: string;
};
type LearningHome = {
  enrollments: Enrollment[];
  savedCourses: Course[];
  progress: { courseId: string; enrollmentId?: string; progressPercent: number; updatedAt: string; completed?: boolean; completedModules?: number; totalModules?: number }[];
  moduleProgress: ModuleProgress[];
  certificates: { id: string; courseId: string; issuedAt: string; issuer: string; verificationStatus: string }[];
  startedResources: StartedResource[];
};
type ModuleProgress = {
  lessonCompleted: boolean;
  attempts: number;
  bestScore: number;
  latestScore?: number;
  passed: boolean;
  completedAt?: string | null;
};
type CourseModule = {
  id: string;
  title: string;
  content: string[];
  questions: { id: string; prompt: string; options: { id: string; text: string }[] }[];
  progress: ModuleProgress | null;
};
type Coursework = {
  course: { id: string; title: string };
  dataStatus: string;
  passMark: number;
  modules: CourseModule[];
};
type StartedResource = {
  id: string;
  resourceId: string;
  status: string;
  startedAt: string;
  updatedAt: string;
  resource: Pick<LearningResource, 'id' | 'title' | 'summary' | 'categoryId' | 'format' | 'dataStatus'>;
};

function normalizeLearningHome(payload: Partial<LearningHome>): LearningHome {
  return {
    enrollments: Array.isArray(payload.enrollments) ? payload.enrollments : [],
    savedCourses: Array.isArray(payload.savedCourses) ? payload.savedCourses : [],
    progress: Array.isArray(payload.progress) ? payload.progress : [],
    moduleProgress: Array.isArray(payload.moduleProgress) ? payload.moduleProgress : [],
    certificates: Array.isArray(payload.certificates) ? payload.certificates : [],
    startedResources: Array.isArray(payload.startedResources) ? payload.startedResources : [],
  };
}

const standardSections = ['Courses', 'Programmes', 'Providers', 'Resources', 'My learning'] as const;
type Section = typeof standardSections[number] | 'Provider tools' | 'Learning review' | 'Learning administration';

export default function LearningScreen() {
  const params = useLocalSearchParams<{
    courseId?: string;
    fromMyLearning?: string;
    providerId?: string;
    resourceId?: string;
    section?: string;
  }>();
  const courseId = typeof params.courseId === 'string' ? params.courseId : '';
  const providerId = typeof params.providerId === 'string' ? params.providerId : '';
  const resourceId = typeof params.resourceId === 'string' ? params.resourceId : '';
  const { session } = useAuth();
  const showLearnerSidebar = params.fromMyLearning === 'true' &&
    Boolean(courseId) &&
    session?.activeRole === 'learner';
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, 520);
  const [section, setSection] = useState<Section>(
    () => standardSections.find((item) => item === params.section) ?? 'Courses'
  );
  const [search, setSearch] = useState('');
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('');
  const [durationFilter, setDurationFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [locationFilter, setLocationFilter] = useState('');
  const [categories, setCategories] = useState<LearningCategory[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [learningHome, setLearningHome] = useState<LearningHome>({
    enrollments: [],
    savedCourses: [],
    progress: [],
    moduleProgress: [],
    certificates: [],
    startedResources: [],
  });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [courseResultKey, setCourseResultKey] = useState('');
  const [courseError, setCourseError] = useState('');
  const [retry, setRetry] = useState(0);
  const [courseDetail, setCourseDetail] = useState<{ id: string; course: Course; enrollment: Enrollment | null } | null>(null);
  const [providerDetail, setProviderDetail] = useState<{ id: string; provider: ProviderProfile; courses: Course[] } | null>(null);
  const [resourceDetail, setResourceDetail] = useState<LearningResource | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailBusy, setDetailBusy] = useState(false);
  const [learnerNavOpen, setLearnerNavOpen] = useState(false);
  const [applicantNote, setApplicantNote] = useState('');
  const [acknowledgedDemo, setAcknowledgedDemo] = useState(false);
  const [shareWithProvider, setShareWithProvider] = useState(false);
  const [detailFeedback, setDetailFeedback] = useState('');
  const visibleSections: Section[] = [
    ...standardSections,
    ...(session?.activeRole === 'training_provider' ? ['Provider tools' as const] : []),
    ...(session?.activeRole === 'administrator' ? ['Learning administration' as const] : []),
    ...(session?.activeRole === 'internal_staff' ? ['Learning review' as const] : []),
  ];

  const courseParams = useMemo(() => {
    const query = new URLSearchParams();
    if (search.trim()) query.set('q', search.trim());
    if (categoryId) query.set('category', categoryId);
    if (providerFilter) query.set('provider', providerFilter);
    if (deliveryFilter) query.set('deliveryMethod', deliveryFilter);
    if (programmeFilter) query.set('programmeType', programmeFilter);
    if (durationFilter) query.set('duration', durationFilter);
    if (locationFilter) query.set('location', locationFilter);
    if (availabilityFilter) query.set('availability', availabilityFilter);
    query.set('sort', sort);
    return query.toString();
  }, [availabilityFilter, categoryId, deliveryFilter, durationFilter, locationFilter, programmeFilter, providerFilter, search, sort]);
  const courseRequestKey = `${courseParams}:${retry}`;

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<{ categories: LearningCategory[] }>('/learning/categories'),
      apiFetch<{ programmes: Programme[] }>('/learning/programmes'),
      apiFetch<{ providers: ProviderSummary[] }>('/learning/providers'),
      apiFetch<{ resources: LearningResource[] }>('/learning/resources'),
      apiFetch<Partial<LearningHome>>('/learning/me'),
    ])
      .then(([categoryPayload, programmePayload, providerPayload, resourcePayload, homePayload]) => {
        if (!active) return;
        if (
          !Array.isArray(categoryPayload.categories) ||
          !Array.isArray(programmePayload.programmes) ||
          !Array.isArray(providerPayload.providers) ||
          !Array.isArray(resourcePayload.resources)
        ) {
          throw new Error('AgriLearn returned incomplete catalogue data. Refresh the page or restart the API.');
        }
        setCategories(categoryPayload.categories);
        setProgrammes(programmePayload.programmes);
        setProviders(providerPayload.providers);
        setResources(resourcePayload.resources);
        setLearningHome(normalizeLearningHome(homePayload));
        setCatalogError('');
      })
      .catch((error: unknown) => {
        if (active) setCatalogError(error instanceof Error ? error.message : 'AgriLearn could not be loaded.');
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => { active = false; };
  }, [retry, session]);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      apiFetch<{ courses: Course[] }>(`/learning/courses?${courseParams}`)
        .then(({ courses: results }) => {
          if (active) {
            if (!Array.isArray(results)) {
              throw new Error('AgriLearn returned an invalid course list. Refresh the page or restart the API.');
            }
            setCourses(results);
            setCourseError('');
          }
        })
        .catch((error: unknown) => {
          if (active) setCourseError(error instanceof Error ? error.message : 'Courses could not be loaded.');
        })
        .finally(() => {
          if (active) setCourseResultKey(courseRequestKey);
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [courseParams, courseRequestKey, session]);

  useEffect(() => {
    let active = true;
    if (!courseId) return () => { active = false; };
    apiFetch<{ course: Course; enrollment: Enrollment | null }>(`/learning/courses/${encodeURIComponent(courseId)}`)
      .then((payload) => {
        if (active) {
          if (!payload.course || typeof payload.course !== 'object') {
            throw new Error('AgriLearn returned invalid course details. Refresh the page or restart the API.');
          }
          setCourseDetail({ id: courseId, ...payload });
          setDetailError('');
        }
      })
      .catch((error: unknown) => {
        if (active) setDetailError(error instanceof Error ? error.message : 'Course details could not be loaded.');
      });
    return () => { active = false; };
  }, [courseId, session]);

  useEffect(() => {
    let active = true;
    if (!providerId) return () => { active = false; };
    apiFetch<{ provider: ProviderProfile; courses: Course[] }>(`/learning/providers/${encodeURIComponent(providerId)}`)
      .then((payload) => {
        if (active) {
          if (!payload.provider || typeof payload.provider !== 'object' || !Array.isArray(payload.courses)) {
            throw new Error('AgriLearn returned incomplete provider details. Refresh the page or restart the API.');
          }
          setProviderDetail({ id: providerId, ...payload });
          setDetailError('');
        }
      })
      .catch((error: unknown) => {
        if (active) setDetailError(error instanceof Error ? error.message : 'Provider details could not be loaded.');
      });
    return () => { active = false; };
  }, [providerId, session]);

  useEffect(() => {
    let active = true;
    if (!resourceId) return () => { active = false; };
    apiFetch<{ resource: LearningResource }>(`/learning/resources/${encodeURIComponent(resourceId)}`)
      .then(({ resource }) => {
        if (active) {
          setResourceDetail(resource);
          setDetailError('');
        }
      })
      .catch((error: unknown) => {
        if (active) setDetailError(error instanceof Error ? error.message : 'Learning material could not be opened.');
      });
    return () => { active = false; };
  }, [resourceId, session]);

  const visibleResources = resources.filter((resource) => {
    const query = search.trim().toLowerCase();
    return (!categoryId || resource.categoryId === categoryId) &&
      (!query || `${resource.title} ${resource.summary}`.toLowerCase().includes(query));
  });
  const visibleProviders = providers.filter((provider) => {
    const query = search.trim().toLowerCase();
    return (!query || `${provider.name} ${provider.description} ${provider.location}`.toLowerCase().includes(query)) &&
      (!locationFilter || provider.location.toLowerCase().includes(locationFilter.toLowerCase())) &&
      (!categoryId || provider.programmes.some((programme) => programme.categoryId === categoryId)) &&
      (!programmeFilter || provider.programmes.some((programme) => programme.programmeType === programmeFilter));
  });
  const visibleCourses = courses.filter((course) => !showSavedOnly || course.saved);
  const coursesLoading = courseResultKey !== courseRequestKey;
  const isDetail = Boolean(courseId || providerId || resourceId);
  const isDesktopCoursePage = width >= 820 && showLearnerSidebar;
  const columns = width >= 980 ? 3 : width >= 620 ? 2 : 1;
  const cardWidth = columns === 1 ? '100%' : `${(100 - (columns - 1) * 2.5) / columns}%`;

  const reloadLearningHome = async () => {
    const payload = await apiFetch<Partial<LearningHome>>('/learning/me');
    setLearningHome(normalizeLearningHome(payload));
  };

  const startResource = async (id: string, openAfterStart = false) => {
    setDetailBusy(true);
    setDetailFeedback('');
    try {
      await apiFetch(`/learning/resources/${encodeURIComponent(id)}/started`, { method: 'POST' });
      await reloadLearningHome();
      setDetailFeedback('Guide added to My learning.');
      if (openAfterStart) router.push({ pathname: '/learning', params: { resourceId: id } });
    } catch (error) {
      setDetailFeedback(error instanceof Error ? error.message : 'The guide could not be added to My learning.');
    } finally {
      setDetailBusy(false);
    }
  };

  const toggleSavedCourse = async (course: Course) => {
    setDetailBusy(true);
    setDetailFeedback('');
    try {
      await apiFetch(`/learning/courses/${encodeURIComponent(course.id)}/saved`, {
        method: course.saved ? 'DELETE' : 'POST',
      });
      setCourses((current) => current.map((entry) => entry.id === course.id ? { ...entry, saved: !course.saved } : entry));
      if (courseDetail?.id === course.id) {
        setCourseDetail({
          ...courseDetail,
          course: { ...courseDetail.course, saved: !course.saved },
        });
      }
      await reloadLearningHome();
      setDetailFeedback(course.saved ? 'Course removed from your saved list.' : 'Course added to your saved list.');
    } catch (error) {
      setDetailFeedback(error instanceof Error ? error.message : 'The saved course could not be updated.');
    } finally {
      setDetailBusy(false);
    }
  };

  const submitEnrollment = async (draft: boolean) => {
    if (!courseDetail || detailBusy || !acknowledgedDemo) return;
    setDetailBusy(true);
    setDetailFeedback('');
    try {
      const { enrollment } = await apiFetch<{ enrollment: Enrollment }>('/learning/enrollments', {
        method: 'POST',
        body: JSON.stringify({
          courseId: courseDetail.course.id,
          draft,
          acknowledgedDemo,
          shareWithProvider,
          applicantNote,
        }),
      });
      setCourseDetail({ ...courseDetail, enrollment });
      await reloadLearningHome();
      setDetailFeedback(draft
        ? `Enrolment draft saved. Reference: ${enrollment.reference}`
        : enrollment.status === 'Enrolled (demo)'
          ? `You're enrolled in this demonstration course. Reference: ${enrollment.reference}. No course place is reserved.`
          : `Your enrolment request was submitted. Reference: ${enrollment.reference}. The provider must confirm your place.`);
    } catch (error) {
      setDetailFeedback(error instanceof Error ? error.message : 'Your learning enrolment could not be saved.');
    } finally {
      setDetailBusy(false);
    }
  };

  const withdrawEnrollment = async (enrollment: Enrollment) => {
    setDetailBusy(true);
    setDetailFeedback('');
    try {
      await apiFetch(`/learning/enrollments/${encodeURIComponent(enrollment.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'withdraw' }),
      });
      await reloadLearningHome();
      setDetailFeedback(`Enrolment ${enrollment.reference} withdrawn.`);
    } catch (error) {
      setDetailFeedback(error instanceof Error ? error.message : 'The learning enrolment could not be withdrawn.');
    } finally {
      setDetailBusy(false);
    }
  };

  const openCourse = (id: string, fromMyLearning = false) => {
    setShareWithProvider(false);
    router.push({
      pathname: '/learning',
      params: {
        courseId: id,
        ...(fromMyLearning ? { fromMyLearning: 'true' } : {}),
      },
    });
  };
  const openProvider = (id: string) => router.push({ pathname: '/learning', params: { providerId: id } });
  const openResource = (id: string) => router.push({ pathname: '/learning', params: { resourceId: id } });
  const selectCategory = (id: string) => {
    setCategoryId(id);
    setSection('Courses');
  };
  const clearFilters = () => {
    setSearch('');
    setCategoryId('');
    setProviderFilter('');
    setDeliveryFilter('');
    setProgrammeFilter('');
    setDurationFilter('');
    setLocationFilter('');
    setAvailabilityFilter('');
    setSort('newest');
    setShowSavedOnly(false);
  };

  if (catalogLoading && !categories.length) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {showLearnerSidebar ? (
          <LearnerSidebarDrawer
            visible={learnerNavOpen}
            onClose={() => setLearnerNavOpen(false)}
            active="courses"
            firstName={session.user.firstName}
            lastName={session.user.lastName}
            role={session.activeRole}
            onDashboard={() => {
              setLearnerNavOpen(false);
              router.replace('/home');
            }}
            onCourses={() => {
              setLearnerNavOpen(false);
              setSection('My learning');
              router.replace({ pathname: '/learning', params: { section: 'My learning' } });
            }}
          />
        ) : null}
        <View style={[styles.screen, isDesktopCoursePage && styles.courseDesktopScreen]}>
          {isDesktopCoursePage ? (
            <LearnerSidebar
              active={session?.activeRole === 'learner' ? 'courses' : 'dashboard'}
              firstName={session?.user.firstName ?? ''}
              lastName={session?.user.lastName ?? ''}
              role={session?.activeRole ?? 'learner'}
              onDashboard={() => router.replace('/home')}
              onCourses={() => {
                setSection('My learning');
                router.replace({ pathname: '/learning', params: { section: 'My learning' } });
              }}
            />
          ) : null}
          <View style={[styles.courseMainArea, isDesktopCoursePage && styles.courseMainAreaDesktop]}>
            {isDesktopCoursePage ? (
              <View style={styles.courseTopbar}>
                <Text style={styles.courseTopbarLabel}>Courses</Text>
                <Text style={styles.courseTopbarBrand}>AgriLearn</Text>
              </View>
            ) : null}
            <View style={[styles.coursePageBody, isDesktopCoursePage && styles.coursePageBodyDesktop]}>
          <View style={styles.mobileLearnerNavigation}>
            {showLearnerSidebar ? (
              <LearnerSidebarMenuButton onPress={() => setLearnerNavOpen(true)} />
            ) : null}
            <BackButton fallbackHref={isDetail ? '/learning' : '/services'} label={courseId ? 'Back to courses' : 'Back'} />
          </View>
          <View style={styles.center}><ActivityIndicator size="large" color={palette.primary} /></View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {showLearnerSidebar ? (
        <LearnerSidebarDrawer
          visible={learnerNavOpen}
          onClose={() => setLearnerNavOpen(false)}
          active="courses"
          firstName={session.user.firstName}
          lastName={session.user.lastName}
          role={session.activeRole}
          onDashboard={() => {
            setLearnerNavOpen(false);
            router.replace('/home');
          }}
          onCourses={() => {
            setLearnerNavOpen(false);
            setSection('My learning');
            router.replace({ pathname: '/learning', params: { section: 'My learning' } });
          }}
        />
      ) : null}
      <View style={[styles.screen, isDesktopCoursePage && styles.courseDesktopScreen]}>
        {isDesktopCoursePage ? (
          <LearnerSidebar
            active={session?.activeRole === 'learner' ? 'courses' : 'dashboard'}
            firstName={session?.user.firstName ?? ''}
            lastName={session?.user.lastName ?? ''}
            role={session?.activeRole ?? 'learner'}
            onDashboard={() => router.replace('/home')}
            onCourses={() => {
              setSection('My learning');
              router.replace({ pathname: '/learning', params: { section: 'My learning' } });
            }}
          />
        ) : null}
        <View style={[styles.courseMainArea, isDesktopCoursePage && styles.courseMainAreaDesktop]}>
          {isDesktopCoursePage ? (
            <View style={styles.courseTopbar}>
              <Text style={styles.courseTopbarLabel}>Courses</Text>
              <Text style={styles.courseTopbarBrand}>AgriLearn</Text>
            </View>
          ) : null}
          <View style={[styles.coursePageBody, isDesktopCoursePage && styles.coursePageBodyDesktop]}>
        <View style={styles.mobileLearnerNavigation}>
          {showLearnerSidebar ? (
            <LearnerSidebarMenuButton onPress={() => setLearnerNavOpen(true)} />
          ) : null}
          <BackButton fallbackHref={isDetail ? '/learning' : '/services'} label={courseId ? 'Back to courses' : 'Back'} />
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          persistentScrollbar
        >
          {isDetail ? (
            <DetailScreen
              courseId={courseId}
              providerId={providerId}
              resourceId={resourceId}
              courseDetail={courseDetail?.id === courseId ? courseDetail : null}
              providerDetail={providerDetail?.id === providerId ? providerDetail : null}
              resourceDetail={resourceId && resourceDetail?.id === resourceId ? resourceDetail : null}
              detailError={detailError}
              detailBusy={detailBusy}
              feedback={detailFeedback}
              applicantNote={applicantNote}
              acknowledgedDemo={acknowledgedDemo}
              shareWithProvider={shareWithProvider}
              isResourceStarted={learningHome.startedResources.some((entry) => entry.resourceId === resourceId)}
              eligibleToEnrol={['learner', 'farmer', 'employer', 'sdf'].includes(session?.activeRole ?? '')}
              onProgressChange={reloadLearningHome}
              onNoteChange={setApplicantNote}
              onAcknowledge={() => setAcknowledgedDemo((value) => !value)}
              onShareWithProvider={() => setShareWithProvider((value) => !value)}
              onSaveCourse={toggleSavedCourse}
              onSubmitEnrollment={(draft) => void submitEnrollment(draft)}
              onStartResource={() => void startResource(resourceId)}
              onOpenCourse={openCourse}
            />
          ) : (
            <>
              <View style={styles.hero}>
                <Image
                  accessible
                  accessibilityLabel="Agricultural field photograph used as AgriLearn catalogue artwork; it does not depict a verified course or provider."
                  source={require('@/assets/images/farm-hero-farmer.jpg')}
                  contentFit="cover"
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.heroShade} />
                <View style={styles.heroCopy}>
                  <Text style={styles.heroEyebrow}>AGRILEARN · AGRICULTURAL LEARNING</Text>
                  <Text style={styles.heroTitle}>Grow Your Skills. Build Your Agricultural Future.</Text>
                  <Text style={styles.heroDescription}>
                    Discover agricultural courses, training programmes, learning resources, and opportunities to develop your skills and knowledge.
                  </Text>
                </View>
              </View>

              <View style={styles.searchWrap}>
                <Ionicons name="search" size={20} color={palette.muted} />
                <TextInput
                  accessibilityLabel="Search courses, skills, training or providers"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search courses, skills, training or providers..."
                  placeholderTextColor={palette.muted}
                  style={styles.searchInput}
                  returnKeyType="search"
                />
                {search ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={20} color={palette.muted} />
                  </Pressable>
                ) : null}
              </View>

              {catalogError ? (
                <View style={styles.errorCard}>
                  <Text accessibilityRole="alert" style={styles.errorText}>{catalogError}</Text>
                  <Pressable accessibilityRole="button" onPress={() => {
                    setCatalogLoading(true);
                    setRetry((value) => value + 1);
                  }} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Try again</Text>
                  </Pressable>
                </View>
              ) : null}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionTabs}>
                {visibleSections.map((item) => (
                  <Pressable
                    key={item}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: item === section }}
                    onPress={() => setSection(item)}
                    style={[styles.sectionTab, section === item && styles.sectionTabSelected]}
                  >
                    <Text style={[styles.sectionTabText, section === item && styles.sectionTabTextSelected]}>{item}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {section === 'Courses' ? (
                <>
                  <SectionHeading
                    title={showSavedOnly ? 'Saved courses' : 'Explore agricultural courses'}
                    subtitle={showSavedOnly ? 'Courses saved to your account.' : 'Search and filter the current course catalogue.'}
                  />
                  <FilterChips items={[{ id: '', name: 'All topics' }, ...categories]} selectedId={categoryId} onSelect={setCategoryId} />
                  <View style={styles.filterRow}>
                    <FilterChips
                      items={[{ id: '', name: 'All delivery' }, ...Array.from(new Set(courses.map((course) => course.deliveryMethod))).map((name) => ({ id: name, name }))]}
                      selectedId={deliveryFilter}
                      onSelect={setDeliveryFilter}
                    />
                    </View>
                    <FilterChips
                      items={[{ id: '', name: 'All programme types' }, ...programmes.map((item) => ({ id: item.courseType, name: item.name }))]}
                      selectedId={programmeFilter}
                      onSelect={setProgrammeFilter}
                    />
                    <FilterChips
                      items={[
                        { id: '', name: 'All availability' },
                        { id: 'Demonstration', name: 'Demonstration' },
                        { id: 'Published', name: 'Published' },
                      ]}
                      selectedId={availabilityFilter}
                      onSelect={setAvailabilityFilter}
                    />
                    <View style={styles.courseFilterInputs}>
                      <TextInput
                        accessibilityLabel="Filter by location"
                      value={locationFilter}
                      onChangeText={setLocationFilter}
                      placeholder="Filter by location"
                      placeholderTextColor={palette.muted}
                      style={styles.filterInput}
                    />
                    <TextInput
                      accessibilityLabel="Filter by duration"
                      value={durationFilter}
                      onChangeText={setDurationFilter}
                      placeholder="Filter by duration, e.g. weeks"
                      placeholderTextColor={palette.muted}
                      style={styles.filterInput}
                    />
                  </View>
                  <FilterChips
                    items={[{ id: '', name: 'All providers' }, ...providers.map((provider) => ({ id: provider.id, name: provider.name }))]}
                    selectedId={providerFilter}
                    onSelect={setProviderFilter}
                  />
                  <View style={styles.sortRow}>
                    <Text style={styles.filterLabel}>Sort</Text>
                    {[
                      ['newest', 'Newest'],
                      ['name', 'Course name'],
                      ['duration', 'Duration'],
                    ].map(([value, label]) => (
                      <Pressable
                        key={value}
                        accessibilityRole="button"
                        accessibilityState={{ selected: sort === value }}
                        onPress={() => setSort(value)}
                        style={[styles.sortChip, sort === value && styles.sortChipSelected]}
                      >
                        <Text style={[styles.sortText, sort === value && styles.sortTextSelected]}>{label}</Text>
                      </Pressable>
                    ))}
                    <Pressable accessibilityRole="button" accessibilityLabel="Clear course filters" onPress={clearFilters}>
                      <Text style={styles.clearText}>Clear filters</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.disclaimer}>
                    Demonstration catalogue only. Providers and course details are unverified; listings do not confirm course availability, accreditation, or official AgriSETA status.
                  </Text>
                  {coursesLoading ? <ActivityIndicator color={palette.primary} style={styles.inlineLoader} /> : null}
                  {courseError ? <Text accessibilityRole="alert" style={styles.errorText}>{courseError}</Text> : null}
                  {!coursesLoading && !courseError && visibleCourses.length === 0 ? (
                    <EmptyState
                      title={showSavedOnly ? 'No saved courses found' : 'No courses found'}
                      detail={showSavedOnly ? 'Save a course from the catalogue to see it here.' : 'Try another search or clear some filters.'}
                    />
                  ) : (
                    <View style={styles.cardGrid}>
                      {visibleCourses.map((course) => (
                        <CourseCard
                          key={course.id}
                          course={course}
                          width={cardWidth}
                          onOpen={() => openCourse(course.id)}
                          onSave={() => void toggleSavedCourse(course)}
                          busy={detailBusy}
                        />
                      ))}
                    </View>
                  )}
                  <SectionHeading title="Browse by category" subtitle="Choose a topic to filter the catalogue." />
                  <View style={styles.categoryGrid}>
                    {categories.map((category) => (
                      <Pressable
                        key={category.id}
                        accessibilityRole="button"
                        onPress={() => selectCategory(category.id)}
                        style={styles.categoryCard}
                      >
                        <View style={styles.categoryIcon}><Ionicons name={category.icon} size={22} color={palette.primary} /></View>
                        <Text style={styles.categoryTitle}>{category.name}</Text>
                        <Text style={styles.categoryDescription}>{category.description}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              {section === 'Programmes' ? (
                <>
                  <SectionHeading title="Training programmes" subtitle="Browse the programme types represented in this demonstration catalogue." />
                  <View style={styles.cardGrid}>
                    {programmes.map((programme) => (
                      <Pressable
                        key={programme.id}
                        accessibilityRole="button"
                        onPress={() => {
                          setProgrammeFilter(programme.courseType);
                          setSection('Courses');
                        }}
                        style={[styles.programmeCard, { width: cardWidth }]}
                      >
                        <Ionicons name="school-outline" size={24} color={palette.primary} />
                        <Text style={styles.courseTitle}>{programme.name}</Text>
                        <Text style={styles.bodyText}>{programme.description}</Text>
                        <Text style={styles.metaText}>{programme.courseCount} demonstration listings</Text>
                        <Text style={styles.linkText}>Browse this programme type →</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              {section === 'Providers' ? (
                <>
                  <SectionHeading title="Training provider directory" subtitle="Provider records below are examples and have not been independently verified." />
                  <TextInput
                    accessibilityLabel="Filter provider location"
                    value={locationFilter}
                    onChangeText={setLocationFilter}
                    placeholder="Filter by location"
                    placeholderTextColor={palette.muted}
                    style={styles.locationInput}
                  />
                  <FilterChips items={[{ id: '', name: 'All categories' }, ...categories]} selectedId={categoryId} onSelect={setCategoryId} />
                  <FilterChips
                    items={[{ id: '', name: 'All programme types' }, ...programmes.map((item) => ({ id: item.courseType, name: item.name }))]}
                    selectedId={programmeFilter}
                    onSelect={setProgrammeFilter}
                  />
                  <Pressable accessibilityRole="button" accessibilityLabel="Clear provider filters" onPress={clearFilters} style={styles.filterClearButton}>
                    <Text style={styles.clearText}>Clear filters</Text>
                  </Pressable>
                  {visibleProviders.length === 0 ? <EmptyState title="No providers found" detail="Change the provider filters to see matching examples." /> : (
                    <View style={[styles.cardGrid, styles.providerDirectoryGrid]}>
                      {visibleProviders.map((provider) => (
                        <View key={provider.id} style={[styles.providerCard, styles.providerDirectoryCard]}>
                          <View style={styles.providerHeading}>
                            <View style={styles.providerIcon}><Ionicons name="business-outline" size={23} color={palette.primary} /></View>
                            <View style={styles.providerHeadingCopy}>
                              <Text style={styles.courseTitle}>{provider.name}</Text>
                              <Text style={styles.metaText}>{provider.location}</Text>
                            </View>
                          </View>
                          <Text style={styles.bodyText}>{provider.description}</Text>
                          <Text style={styles.unverifiedBadge}>{provider.verificationStatus}</Text>
                          <Text style={styles.disclaimer}>{provider.dataStatus}</Text>
                          <Pressable accessibilityRole="button" onPress={() => openProvider(provider.id)} style={styles.secondaryButton}>
                            <Text style={styles.secondaryButtonText}>View provider and programmes</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              ) : null}

              {section === 'Resources' ? (
                <>
                  <SectionHeading title="Learning resources" subtitle="Read short demonstration guides directly in the app. No external files or videos are linked." />
                  <FilterChips items={[{ id: '', name: 'All topics' }, ...categories]} selectedId={categoryId} onSelect={setCategoryId} />
                  <Pressable accessibilityRole="button" accessibilityLabel="Clear resource filters" onPress={clearFilters} style={styles.filterClearButton}>
                    <Text style={styles.clearText}>Clear filters</Text>
                  </Pressable>
                  {visibleResources.length === 0 ? <EmptyState title="No resources found" detail="Try a different keyword or topic." /> : (
                    <View style={styles.cardGrid}>
                      {visibleResources.map((resource) => (
                        <View key={resource.id} style={[styles.resourceCard, { width: cardWidth }]}>
                          <View style={styles.resourceIcon}><Ionicons name="book-outline" size={23} color={palette.primary} /></View>
                          <Text style={styles.courseTitle}>{resource.title}</Text>
                          <Text style={styles.bodyText}>{resource.summary}</Text>
                          <Text style={styles.metaText}>{resource.format} · Demonstration material</Text>
                          <Pressable
                            accessibilityRole="button"
                            disabled={detailBusy}
                            onPress={() => void startResource(resource.id, true)}
                            style={styles.secondaryButton}
                          >
                            <Text style={styles.secondaryButtonText}>
                              {learningHome.startedResources.some((entry) => entry.resourceId === resource.id)
                                ? 'Continue guide'
                                : 'Start guide'}
                            </Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              ) : null}

              {section === 'My learning' ? (
                <MyLearning
                  learningHome={learningHome}
                  width={cardWidth}
                  busy={detailBusy}
                  feedback={detailFeedback}
                  onOpenCourse={(id) => openCourse(id, true)}
                  onOpenResource={openResource}
                  onWithdraw={(enrollment) => void withdrawEnrollment(enrollment)}
                  onProgressChange={() => void reloadLearningHome()}
                  onShowSaved={() => {
                    setSection('Courses');
                    setShowSavedOnly(true);
                    setSearch('');
                    setCategoryId('');
                    setProviderFilter('');
                    setDeliveryFilter('');
                    setProgrammeFilter('');
                    setDurationFilter('');
                    setLocationFilter('');
                    setAvailabilityFilter('');
                    setSort('newest');
                  }}
                  onBrowseCourses={() => {
                    setSection('Courses');
                    clearFilters();
                  }}
                />
              ) : null}
              {section === 'Provider tools' ? (
                <ProviderManagement categories={categories} programmes={programmes} />
              ) : null}
              {section === 'Learning administration' || section === 'Learning review' ? (
                <LearningAdministration
                  categories={categories}
                  canManageCatalog={session?.activeRole === 'administrator'}
                  onCatalogChange={() => setRetry((value) => value + 1)}
                />
              ) : null}
            </>
          )}
        </ScrollView>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function DetailScreen({
  courseId,
  providerId,
  resourceId,
  courseDetail,
  providerDetail,
  resourceDetail,
  detailError,
  detailBusy,
  feedback,
  applicantNote,
  acknowledgedDemo,
  shareWithProvider,
  isResourceStarted,
  eligibleToEnrol,
  onProgressChange,
  onNoteChange,
  onAcknowledge,
  onShareWithProvider,
  onSaveCourse,
  onSubmitEnrollment,
  onStartResource,
  onOpenCourse,
}: {
  courseId: string;
  providerId: string;
  resourceId: string;
  courseDetail: { id: string; course: Course; enrollment: Enrollment | null } | null;
  providerDetail: { id: string; provider: ProviderProfile; courses: Course[] } | null;
  resourceDetail: LearningResource | null;
  detailError: string;
  detailBusy: boolean;
  feedback: string;
  applicantNote: string;
  acknowledgedDemo: boolean;
  shareWithProvider: boolean;
  isResourceStarted: boolean;
  eligibleToEnrol: boolean;
  onProgressChange: () => void;
  onNoteChange: (value: string) => void;
  onAcknowledge: () => void;
  onShareWithProvider: () => void;
  onSaveCourse: (course: Course) => void;
  onSubmitEnrollment: (draft: boolean) => void;
  onStartResource: () => void;
  onOpenCourse: (id: string) => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, 520);

  if (courseId) {
    if (!courseDetail) return <DetailLoading error={detailError} />;
    const { course, enrollment } = courseDetail;
    const eligibleRoles = Array.isArray(course.eligibleRoles) ? course.eligibleRoles : [];
    const alreadyEnrolled = enrollment && enrollment.status !== 'Withdrawn';
    const canEnroll = eligibleToEnrol && eligibleRoles.length > 0 && course.interestEnabled;
    if (alreadyEnrolled) {
      return (
        <>
          <View style={styles.coursePageHeader}>
            <View style={styles.coursePageBadges}>
              <Text style={styles.coursePageBadge}>{course.category}</Text>
              <Text style={styles.coursePageBadge}>{course.programmeType}</Text>
            </View>
            <Text style={styles.detailTitle}>{course.title}</Text>
            <Text style={styles.courseProviderLine}>
              by {course.provider?.name ?? 'Provider record unavailable'} · {course.duration} · {course.deliveryMethod}
            </Text>
          </View>
          {enrollment.status === 'Enrolled (demo)' ? (
            <CourseworkPanel
              enrollmentId={enrollment.id}
              onProgressChange={onProgressChange}
            />
          ) : (
            <View style={[styles.courseworkLayout, width >= 820 && styles.courseworkLayoutWide, styles.courseworkPanel]}>
              <View style={styles.courseContentCard}>
                <Text style={styles.courseContentHeading}>Course Content</Text>
                <CourseLessonOutline lessonTitles={course.lessonTitles} enrollmentStatus={enrollment.status} />
              </View>
              <View style={[styles.courseProgressCard, width >= 820 && styles.courseProgressCardWide]}>
                <View style={styles.courseProgressHeading}>
                  <Text style={styles.courseProgressTitle}>Your Progress</Text>
                  <Text style={styles.courseProgressPercent}>—</Text>
                </View>
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: 0 }}
                  style={styles.courseProgressTrack}
                >
                  <View style={[styles.courseProgressFill, { width: '0%' }]} />
                </View>
                <Text style={styles.courseContentSummary}>Progress becomes available when lessons are provided.</Text>
                <Pressable accessibilityRole="button" disabled style={[styles.startCourseButton, styles.disabledButton]}>
                  <Text style={styles.startCourseButtonText}>Start Course</Text>
                </Pressable>
              </View>
            </View>
          )}
          <View style={styles.courseDetailsCard}>
            <Text style={styles.courseContentHeading}>Course details</Text>
            <Text style={styles.detailBody}>{course.description}</Text>
            <DetailInfo label="Training provider status" value={course.provider?.verificationStatus ?? 'Unverified'} />
            <DetailInfo label="Accreditation" value={course.accreditation} />
            {course.requirements ? <DetailInfo label="Programme requirements" value={course.requirements} /> : null}
            <DetailInfo label="Availability" value={course.status} />
            <Text style={styles.disclaimer}>
              {course.dataStatus}
              {enrollment.status === 'Enrolled (demo)'
                ? ' This demonstration enrolment does not reserve a place or provide an accredited result or certificate.'
                : ' Your enrolment request is not confirmed until the training provider responds.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={detailBusy}
              onPress={() => onSaveCourse(course)}
              style={styles.secondaryButton}
            >
              <Ionicons name={course.saved ? 'bookmark' : 'bookmark-outline'} size={18} color={palette.primary} />
              <Text style={styles.secondaryButtonText}>{course.saved ? 'Remove saved course' : 'Save course'}</Text>
            </Pressable>
            <Text style={styles.metaText}>Enrolment reference: {enrollment.reference}</Text>
          </View>
          {feedback ? <Text accessibilityRole="alert" style={styles.feedback}>{feedback}</Text> : null}
        </>
      );
    }
    return (
      <>
        <Image
          accessible
          accessibilityLabel="Agricultural field catalogue photograph; not a photograph of course delivery."
          source={require('@/assets/images/farm-hero-farmer.jpg')}
          contentFit="cover"
          style={styles.detailImage}
        />
        <Text style={styles.eyebrow}>{course.category} · {course.programmeType}</Text>
        <Text style={styles.detailTitle}>{course.title}</Text>
        <View style={styles.courseMetadata}>
          <MetaChip icon="time-outline" label={course.duration} />
          <MetaChip icon="laptop-outline" label={course.deliveryMethod} />
          <MetaChip icon="location-outline" label={course.location} />
        </View>
        <Text style={styles.detailBody}>{course.description}</Text>
        <DetailInfo label="Training provider" value={course.provider?.name ?? 'Provider record unavailable'} />
        <DetailInfo label="Provider status" value={course.provider?.verificationStatus ?? 'Unverified'} />
        <DetailInfo label="Accreditation" value={course.accreditation} />
        {course.requirements ? <DetailInfo label="Programme requirements" value={course.requirements} /> : null}
        <DetailInfo label="Eligible roles" value={eligibleRoles.join(', ') || 'No eligible audiences listed'} />
        <DetailInfo label="Availability" value={course.status} />
        <Text style={styles.disclaimer}>{course.dataStatus}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={detailBusy}
          onPress={() => onSaveCourse(course)}
          style={styles.secondaryButton}
        >
          <Ionicons name={course.saved ? 'bookmark' : 'bookmark-outline'} size={18} color={palette.primary} />
          <Text style={styles.secondaryButtonText}>{course.saved ? 'Remove saved course' : 'Save course'}</Text>
        </Pressable>
        {alreadyEnrolled ? (
          <>
            <View style={styles.enrollmentCard}>
              <Text style={styles.courseTitle}>Your course enrolment</Text>
              <Text style={styles.bodyText}>Reference: {enrollment.reference}</Text>
              <Text style={styles.bodyText}>
                Status: {enrollment.status === 'Enrolled (demo)' ? 'Enrolled · demo' : enrollment.status}
              </Text>
              <Text style={styles.disclaimer}>
                {enrollment.status === 'Enrolled (demo)'
                  ? 'Demonstration course only. Progress is prototype activity and does not reserve a place or provide an accredited result or certificate.'
                  : 'Your enrolment request is not confirmed until the training provider responds.'}
              </Text>
            </View>
            {enrollment.status === 'Enrolled (demo)' ? (
              <CourseworkPanel
                enrollmentId={enrollment.id}
                onProgressChange={onProgressChange}
              />
            ) : null}
          </>
        ) : canEnroll ? (
          <View style={styles.enrollmentCard}>
            <Text style={styles.courseTitle}>
              {course.status === 'Demonstration' ? 'Enrol in this course' : 'Request course enrolment'}
            </Text>
            <Text style={styles.bodyText}>
              {course.status === 'Demonstration'
                ? 'This records a demonstration enrolment under your account. It is not a real course place and does not provide course delivery or accreditation.'
                : 'This submits your enrolment request to the provider. Your place is not confirmed until the provider responds.'}
            </Text>
            <TextInput
              accessibilityLabel="Optional message"
              value={applicantNote}
              onChangeText={onNoteChange}
              placeholder="Optional message (up to 500 characters)"
              placeholderTextColor={palette.muted}
              multiline
              maxLength={500}
              style={styles.noteInput}
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acknowledgedDemo }}
              onPress={onAcknowledge}
              style={styles.acknowledgement}
            >
              <Ionicons
                name={acknowledgedDemo ? 'checkbox' : 'square-outline'}
                size={22}
                color={palette.primary}
              />
              <Text style={styles.acknowledgementText}>
                {course.status === 'Demonstration'
                  ? 'I understand this is a demonstration enrolment only; no place is reserved and no accreditation is provided.'
                  : 'I understand submitting this request does not confirm my place or provide accreditation.'}
              </Text>
            </Pressable>
            {course.status !== 'Demonstration' ? (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: shareWithProvider }}
                onPress={onShareWithProvider}
                style={styles.acknowledgement}
              >
                <Ionicons name={shareWithProvider ? 'checkbox' : 'square-outline'} size={20} color={palette.primary} />
                <Text style={styles.disclaimer}>I consent to sharing my name and email with this provider to manage this enrolment.</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={detailBusy || !acknowledgedDemo || (course.status !== 'Demonstration' && !shareWithProvider)}
              onPress={() => onSubmitEnrollment(false)}
              style={[styles.primaryButton, (detailBusy || !acknowledgedDemo || (course.status !== 'Demonstration' && !shareWithProvider)) && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>
                {detailBusy
                  ? 'Submitting...'
                  : course.status === 'Demonstration'
                    ? 'Enrol in course'
                    : 'Submit enrolment request'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={detailBusy || !acknowledgedDemo}
              onPress={() => onSubmitEnrollment(true)}
              style={styles.textButton}
            >
              <Text style={styles.linkText}>Save as draft</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.notice}>
            <Text style={styles.bodyText}>
              {eligibleToEnrol
                ? 'Enrolment requests are not enabled for this listing.'
                : 'Your assigned role can browse this listing but cannot enrol in this course.'}
            </Text>
          </View>
        )}
        {feedback ? <Text accessibilityRole="alert" style={styles.feedback}>{feedback}</Text> : null}
      </>
    );
  }

  if (providerId) {
    if (!providerDetail) return <DetailLoading error={detailError} />;
    const { provider, courses } = providerDetail;
    return (
      <>
        <View style={styles.providerHeroIcon}><Ionicons name="business-outline" size={34} color={palette.primary} /></View>
        <Text style={styles.detailTitle}>{provider.name}</Text>
        <DetailInfo label="Location" value={provider.location} />
        <DetailInfo label="Verification" value={provider.verificationStatus} />
        <Text style={styles.detailBody}>{provider.description}</Text>
        <Text style={styles.disclaimer}>{provider.dataStatus}</Text>
        <SectionHeading title="Listed programmes" />
        {courses.length === 0 ? <EmptyState title="No listed programmes" detail="There are no published programmes for this provider." /> : (
          <View style={styles.cardGrid}>
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} width="100%" onOpen={() => onOpenCourse(course.id)} />
            ))}
          </View>
        )}
      </>
    );
  }

  if (resourceId) {
    if (!resourceDetail) return <DetailLoading error={detailError} />;
    return (
      <>
        <View style={styles.resourceIconLarge}><Ionicons name="book-outline" size={28} color={palette.primary} /></View>
        <Text style={styles.eyebrow}>LEARNING RESOURCE · {resourceDetail.format}</Text>
        <Text style={styles.detailTitle}>{resourceDetail.title}</Text>
        <Text style={styles.detailBody}>{resourceDetail.summary}</Text>
        <Text style={styles.disclaimer}>{resourceDetail.dataStatus}</Text>
        {resourceDetail.content?.map((paragraph, index) => (
          <Text key={`${resourceDetail.id}-${index}`} style={styles.resourceParagraph}>{paragraph}</Text>
        ))}
        <View style={styles.notice}>
          <Text style={styles.bodyText}>This guide is available to read in the app. There is no separate download or external media link.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={detailBusy || isResourceStarted}
          onPress={onStartResource}
          style={[styles.primaryButton, (detailBusy || isResourceStarted) && styles.disabledButton]}
        >
          <Text style={styles.primaryButtonText}>
            {isResourceStarted ? 'Guide added to My learning' : detailBusy ? 'Adding guide...' : 'Start guide'}
          </Text>
        </Pressable>
        {isResourceStarted ? (
          <Text style={styles.metaText}>In progress · This guide is listed under My learning.</Text>
        ) : null}
        {feedback ? <Text accessibilityRole="alert" style={styles.feedback}>{feedback}</Text> : null}
      </>
    );
  }
  return null;
}

function CourseCard({
  course,
  width,
  onOpen,
  onSave,
  busy = false,
}: {
  course: Course;
  width: string;
  onOpen: () => void;
  onSave?: () => void;
  busy?: boolean;
}) {
  return (
    <View style={[styles.courseCard, { width }]}>
      <Image
        accessible
        accessibilityLabel="Agricultural field catalogue artwork. This image does not show the listed course or provider."
        source={require('@/assets/images/farm-hero-farmer.jpg')}
        contentFit="cover"
        style={styles.courseImage}
      />
      <View style={styles.courseCardBody}>
        <Text style={styles.categoryLabel}>{course.category}</Text>
        <Text style={styles.courseTitle}>{course.title}</Text>
        <Text numberOfLines={3} style={styles.bodyText}>{course.description}</Text>
        <Text style={styles.metaText}>{course.provider?.name ?? 'Provider unlisted'}</Text>
        <Text style={styles.metaText}>{course.duration} · {course.deliveryMethod}</Text>
        <Text style={styles.unverifiedBadge}>Demonstration · Accreditation not verified</Text>
        <View style={styles.cardActions}>
          <Pressable accessibilityRole="button" onPress={onOpen} style={[styles.secondaryButton, styles.flexOne]}>
            <Text style={styles.secondaryButtonText}>View details & enrol</Text>
          </Pressable>
          {onSave ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={course.saved ? `Remove ${course.title} from saved courses` : `Save ${course.title}`}
              disabled={busy}
              onPress={onSave}
              style={styles.saveButton}
            >
              <Ionicons name={course.saved ? 'bookmark' : 'bookmark-outline'} size={20} color={palette.primary} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function MyLearning({
  learningHome,
  width,
  busy,
  feedback,
  onOpenCourse,
  onOpenResource,
  onWithdraw,
  onProgressChange,
  onShowSaved,
  onBrowseCourses,
}: {
  learningHome: LearningHome;
  width: string;
  busy: boolean;
  feedback: string;
  onOpenCourse: (id: string) => void;
  onOpenResource: (id: string) => void;
  onWithdraw: (enrollment: Enrollment) => void;
  onProgressChange: () => void;
  onShowSaved: () => void;
  onBrowseCourses: () => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const screenWidth = Math.min(windowWidth, 520);
  const [openEnrollmentId, setOpenEnrollmentId] = useState('');
  const active = learningHome.enrollments.filter((entry) => entry.status !== 'Withdrawn');
  const demoEnrollments = active.filter((entry) => entry.status === 'Enrolled (demo)');
  const requests = active.filter((entry) => !['Draft', 'Enrolled (demo)'].includes(entry.status));
  return (
    <>
      {screenWidth >= 820 ? (
        <DesktopMyCourses
          active={active}
          progress={learningHome.progress}
          onOpenCourse={onOpenCourse}
          onWithdraw={onWithdraw}
          busy={busy}
        />
      ) : (
        <>
          <SectionHeading title="My learning" subtitle="Your course enrolments, module lessons, assessments, and started guides are linked to your account." />
          <Text style={styles.sectionTitle}>Courses</Text>
          {active.length === 0 ? (
            <EmptyState title="No courses yet" detail="Explore the catalogue and enrol in an available course to see it here." />
          ) : (
            <View style={styles.cardGrid}>
              {active.map((enrollment) => (
                <View key={enrollment.id} style={[styles.enrollmentCard, { width }]}>
                  <Text style={styles.courseTitle}>{enrollment.course?.title ?? 'Learning course'}</Text>
                  <Text style={styles.metaText}>Reference: {enrollment.reference}</Text>
                  <Text style={styles.bodyText}>
                    Status: {enrollment.status === 'Enrolled (demo)' ? 'Enrolled · demo' : enrollment.status}
                  </Text>
                  <Text style={styles.metaText}>
                    {enrollment.submittedAt
                      ? `${enrollment.status === 'Enrolled (demo)' ? 'Enrolled' : 'Submitted'} ${formatDate(enrollment.submittedAt)}`
                      : 'Draft not submitted'}
                  </Text>
                  <Text style={styles.disclaimer}>
                    {enrollment.status === 'Enrolled (demo)'
                      ? 'Prototype course only. Modules and knowledge checks record demo progress; they do not reserve a real place or provide an accredited result or certificate.'
                      : enrollment.status === 'Draft'
                        ? 'This enrolment request is still a draft and has not been submitted.'
                        : enrollment.status === 'Accepted'
                          ? 'The provider marked this request accepted. Confirm delivery details with them; learning modules are not configured for this published listing.'
                          : 'Enrolment request only. Check the request status and wait for provider confirmation before planning attendance.'}
                  </Text>
                  {enrollment.status === 'Enrolled (demo)' ? (
                    <View style={styles.courseworkActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded: openEnrollmentId === enrollment.id }}
                        onPress={() => setOpenEnrollmentId((current) => current === enrollment.id ? '' : enrollment.id)}
                        style={styles.secondaryButton}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {openEnrollmentId === enrollment.id ? 'Hide modules' : 'Modules & assessments'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {openEnrollmentId === enrollment.id ? (
                    <CourseworkPanel
                      enrollmentId={enrollment.id}
                      onProgressChange={onProgressChange}
                    />
                  ) : null}
                  <View style={styles.cardActions}>
                    <Pressable accessibilityRole="button" onPress={() => onOpenCourse(enrollment.courseId)} style={[styles.secondaryButton, styles.flexOne]}>
                      <Text style={styles.secondaryButtonText}>View course</Text>
                    </Pressable>
                    {['Draft', 'Submitted', 'Enrolled (demo)', 'Under Review', 'Waitlisted'].includes(enrollment.status) ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => onWithdraw(enrollment)}
                        style={styles.withdrawButton}
                      >
                        <Text style={styles.withdrawText}>Withdraw</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
      {feedback ? <Text accessibilityRole="alert" style={styles.feedback}>{feedback}</Text> : null}
      <View style={styles.metricsRow}>
        <MetricCard label="Enrolled · demo" value={demoEnrollments.length} />
        <MetricCard label="Requests" value={requests.length} />
        <MetricCard label="Guides started" value={learningHome.startedResources.length} />
      </View>
      <Text style={styles.sectionTitle}>Started guides</Text>
      {learningHome.startedResources.length === 0 ? (
        <EmptyState title="No guides started" detail="Start a guide from Resources and it will appear here." />
      ) : (
        <View style={styles.cardGrid}>
          {learningHome.startedResources.map((entry) => (
            <View key={entry.id} style={[styles.enrollmentCard, { width }]}>
              <Text style={styles.courseTitle}>{entry.resource.title}</Text>
              <Text style={styles.metaText}>{entry.resource.format} · {entry.status}</Text>
              <Text style={styles.bodyText}>{entry.resource.summary}</Text>
              <Text style={styles.disclaimer}>{entry.resource.dataStatus}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => onOpenResource(entry.resourceId)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Continue guide</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.sectionTitle}>Saved courses</Text>
      {learningHome.savedCourses.length === 0 ? (
        <View style={styles.notice}>
          <Text style={styles.bodyText}>You have no saved courses.</Text>
          <Pressable accessibilityRole="button" onPress={onBrowseCourses}><Text style={styles.linkText}>Browse the catalogue</Text></Pressable>
        </View>
      ) : (
        <>
          <Pressable accessibilityRole="button" onPress={onShowSaved} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Browse saved courses</Text>
          </Pressable>
          <View style={styles.cardGrid}>
            {learningHome.savedCourses.map((course) => (
              <CourseCard key={course.id} course={{ ...course, saved: true }} width={width} onOpen={() => onOpenCourse(course.id)} />
            ))}
          </View>
        </>
      )}
      <Text style={styles.sectionTitle}>Learning progress</Text>
      {learningHome.progress.length === 0 ? (
        <EmptyState title="No course progress recorded" detail="Open an enrolled demonstration course, complete its module lessons, and pass the knowledge checks to record prototype progress." />
      ) : (
        learningHome.progress.map((entry) => (
          <View key={`${entry.courseId}-${entry.updatedAt}`} style={styles.progressCard}>
            <Text style={styles.courseTitle}>{learningHome.enrollments.find((enrollment) => enrollment.courseId === entry.courseId)?.course?.title ?? 'Course progress'}</Text>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${entry.progressPercent}%` }]} /></View>
            <Text style={styles.metaText}>
              {entry.completed ? 'Course complete · prototype' : `${entry.completedModules ?? 0} of ${entry.totalModules ?? 0} modules passed`}
              {' · '}{entry.progressPercent}%
            </Text>
          </View>
        ))
      )}
      <Text style={styles.sectionTitle}>Certificates and achievements</Text>
      {learningHome.certificates.length === 0 ? (
        <EmptyState title="No certificates recorded" detail="Certificates are not issued by this prototype. No credentials are fabricated." />
      ) : learningHome.certificates.map((certificate) => (
        <View key={certificate.id} style={styles.enrollmentCard}>
          <Text style={styles.courseTitle}>{certificate.issuer}</Text>
          <Text style={styles.metaText}>{certificate.verificationStatus} · {formatDate(certificate.issuedAt)}</Text>
        </View>
      ))}
    </>
  );
}

function DesktopMyCourses({
  active,
  progress,
  onOpenCourse,
  onWithdraw,
  busy,
}: {
  active: Enrollment[];
  progress: LearningHome['progress'];
  onOpenCourse: (id: string) => void;
  onWithdraw: (enrollment: Enrollment) => void;
  busy: boolean;
}) {
  const demoCourses = active.filter((enrollment) => enrollment.status === 'Enrolled (demo)');
  const requests = active.filter((enrollment) => !['Enrolled (demo)', 'Withdrawn'].includes(enrollment.status));

  return (
    <>
      <View style={styles.myCoursesHeading}>
        <Text style={styles.desktopPageTitle}>My Courses</Text>
        <Text style={styles.coursePageSubtitle}>
          {active.length} {active.length === 1 ? 'course or request' : 'courses and requests'} in your learning list
        </Text>
      </View>
      <View style={styles.myCoursesSectionHeading}>
        <Ionicons name="time-outline" size={18} color={palette.primary} />
        <Text style={styles.myCoursesSectionTitle}>In Progress ({demoCourses.length})</Text>
      </View>
      {demoCourses.length === 0 ? (
        <EmptyState
          title="No enrolled courses yet"
          detail={requests.length
            ? 'Courses appear here after enrolment is confirmed. Pending requests are listed below.'
            : 'Browse the AgriLearn catalogue to find a course and submit an enrolment request.'}
        />
      ) : (
        <View style={styles.desktopCourseGrid}>
          {demoCourses.map((enrollment) => (
            <DesktopCourseCard
              key={enrollment.id}
              enrollment={enrollment}
              progress={progress}
              onOpenCourse={onOpenCourse}
              onWithdraw={onWithdraw}
              busy={busy}
            />
          ))}
        </View>
      )}
      {requests.length ? (
        <>
          <View style={[styles.myCoursesSectionHeading, styles.enrolmentRequestHeading]}>
            <Ionicons name="hourglass-outline" size={18} color={palette.primary} />
            <Text style={styles.myCoursesSectionTitle}>Enrolment requests ({requests.length})</Text>
          </View>
          <View style={styles.desktopCourseGrid}>
            {requests.map((enrollment) => (
              <DesktopCourseCard
                key={enrollment.id}
                enrollment={enrollment}
                progress={progress}
                onOpenCourse={onOpenCourse}
                onWithdraw={onWithdraw}
                busy={busy}
              />
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

function DesktopCourseCard({
  enrollment,
  progress,
  onOpenCourse,
  onWithdraw,
  busy,
}: {
  enrollment: Enrollment;
  progress: LearningHome['progress'];
  onOpenCourse: (id: string) => void;
  onWithdraw: (enrollment: Enrollment) => void;
  busy: boolean;
}) {
  const course = enrollment.course;
  const isDemoCourse = enrollment.status === 'Enrolled (demo)';
  const courseProgress = progress.find((entry) =>
    entry.enrollmentId === enrollment.id ||
    (!entry.enrollmentId && entry.courseId === enrollment.courseId)
  );
  const percent = isDemoCourse ? courseProgress?.progressPercent ?? 0 : null;
  const lessonCount = course?.lessonTitles?.length;

  return (
    <View style={styles.desktopCourseCard}>
      <View style={styles.desktopCourseCardTop}>
        <View style={styles.courseCardTitleCopy}>
          <Text numberOfLines={2} style={styles.desktopCourseTitle}>{course?.title ?? 'Learning course'}</Text>
          <Text numberOfLines={1} style={styles.desktopCourseProvider}>
            by {course?.provider?.name ?? 'Provider details unavailable'}
          </Text>
        </View>
        <Text style={[styles.courseStatusBadge, isDemoCourse ? styles.courseStatusBadgeActive : styles.courseStatusBadgePending]}>
          {isDemoCourse ? 'In Progress · demo' : enrollment.status}
        </Text>
      </View>
      {course?.description ? (
        <Text numberOfLines={2} style={styles.desktopCourseDescription}>{course.description}</Text>
      ) : null}
      <View style={styles.desktopCourseProgressLabels}>
        <Text style={styles.metaText}>
          {lessonCount === undefined ? 'Lesson outline unavailable' : `${lessonCount} lessons`}
        </Text>
        <Text style={styles.metaText}>{percent === null ? 'Progress not available' : `${percent}% complete`}</Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent ?? 0 }}
        style={styles.courseProgressTrack}
      >
        <View style={[styles.courseProgressFill, { width: `${percent ?? 0}%` }]} />
      </View>
      <View style={styles.desktopCourseActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpenCourse(enrollment.courseId)}
          style={[styles.primaryButton, styles.desktopViewCourseButton]}
        >
          <Text style={styles.primaryButtonText}>View course</Text>
        </Pressable>
        {['Draft', 'Submitted', 'Enrolled (demo)', 'Under Review', 'Waitlisted'].includes(enrollment.status) ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onWithdraw(enrollment)}
            style={styles.desktopWithdrawButton}
          >
            <Text style={styles.withdrawText}>Withdraw</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function CourseLessonOutline({
  lessonTitles,
  enrollmentStatus,
}: {
  lessonTitles: { id: string; title: string }[] | undefined;
  enrollmentStatus: string;
}) {
  const [expandedLessonId, setExpandedLessonId] = useState('');
  const lessonCount = lessonTitles?.length ?? 0;

  return (
    <>
      <Text style={styles.courseContentSummary}>
        {lessonTitles === undefined
          ? 'Lesson outline unavailable · access pending'
          : `${lessonCount} ${lessonCount === 1 ? 'lesson' : 'lessons'} · access pending`}
      </Text>
      {lessonCount === 0 ? (
        <View style={styles.emptyCourseLessons}>
          <Text style={styles.metaText}>
            {lessonTitles === undefined
              ? 'Lesson outline information is unavailable.'
              : 'The provider has not published a lesson outline.'}
          </Text>
        </View>
      ) : (lessonTitles ?? []).map((lesson) => {
        const expanded = expandedLessonId === lesson.id;
        return (
          <View key={lesson.id} style={styles.moduleAccordion}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setExpandedLessonId((current) => current === lesson.id ? '' : lesson.id)}
              style={[styles.moduleAccordionHeader, expanded && styles.moduleAccordionHeaderOpen]}
            >
              <Ionicons name="document-text-outline" size={16} color={palette.muted} />
              <Text style={styles.moduleAccordionTitle}>{lesson.title}</Text>
              <Text style={styles.moduleLessonCount}>Locked</Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={palette.muted} />
            </Pressable>
            {expanded ? (
              <Text style={styles.lockedLessonMessage}>
                Lesson material is available after the provider confirms your enrolment. Current status: {enrollmentStatus}.
              </Text>
            ) : null}
          </View>
        );
      })}
    </>
  );
}

function CourseworkPanel({
  enrollmentId,
  onProgressChange,
}: {
  enrollmentId: string;
  onProgressChange: () => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, 520);
  const [coursework, setCoursework] = useState<Coursework | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyModuleId, setBusyModuleId] = useState('');
  const [error, setError] = useState('');
  const [openModuleId, setOpenModuleId] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch<Coursework>(`/learning/enrollments/${encodeURIComponent(enrollmentId)}/coursework`)
      .then((payload) => {
        if (active) {
          if (!Array.isArray(payload.modules)) {
            throw new Error('Course content is incomplete. Refresh the page or restart the API.');
          }
          setCoursework(payload);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Course modules could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [enrollmentId]);

  const completeLesson = async (moduleId: string) => {
    setBusyModuleId(moduleId);
    setError('');
    try {
      const { progress } = await apiFetch<{ progress: ModuleProgress }>(
        `/learning/enrollments/${encodeURIComponent(enrollmentId)}/modules/${encodeURIComponent(moduleId)}/lesson-complete`,
        { method: 'POST' }
      );
      setCoursework((current) => current ? {
        ...current,
        modules: current.modules.map((module) => module.id === moduleId ? { ...module, progress } : module),
      } : current);
      onProgressChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The module could not be marked complete.');
    } finally {
      setBusyModuleId('');
    }
  };

  const submitAssessment = async (moduleId: string, answers: Record<string, string>) => {
    setBusyModuleId(moduleId);
    setError('');
    try {
      const result = await apiFetch<{
        result: { score: number; passMark: number; passed: boolean; correctAnswers: number; totalQuestions: number };
        progress: ModuleProgress;
      }>(
        `/learning/enrollments/${encodeURIComponent(enrollmentId)}/modules/${encodeURIComponent(moduleId)}/assessment`,
        { method: 'POST', body: JSON.stringify({ answers }) }
      );
      setCoursework((current) => current ? {
        ...current,
        modules: current.modules.map((module) => module.id === moduleId
          ? { ...module, progress: result.progress }
          : module),
      } : current);
      onProgressChange();
      return result.result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The assessment could not be submitted.');
      return null;
    } finally {
      setBusyModuleId('');
    }
  };

  if (loading) return <ActivityIndicator color={palette.primary} style={styles.inlineLoader} />;
  if (error && !coursework) return <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>;
  if (!coursework) return null;

  const totalModules = coursework.modules.length;
  const completedLessons = coursework.modules.filter((module) => module.progress?.lessonCompleted).length;
  const progressPercent = totalModules === 0 ? 0 : Math.round((completedLessons / totalModules) * 100);
  const nextModule = coursework.modules.find((module) => !module.progress?.passed);
  const hasStarted = coursework.modules.some((module) => module.progress?.lessonCompleted);
  const startLabel = !hasStarted ? 'Start Course' : nextModule ? 'Continue Course' : 'Review Course';

  return (
    <View style={styles.courseworkPanel}>
      <View style={[styles.courseworkLayout, width >= 820 && styles.courseworkLayoutWide]}>
        <View style={styles.courseContentCard}>
          <Text style={styles.courseContentHeading}>Course Content</Text>
          <Text style={styles.courseContentSummary}>
            {totalModules} {totalModules === 1 ? 'lesson' : 'lessons'} · {completedLessons} completed
          </Text>
          {totalModules === 0 ? (
            <View style={styles.emptyCourseLessons}>
              <Text style={styles.metaText}>Course content has not been added yet.</Text>
            </View>
          ) : coursework.modules.map((module) => {
            const expanded = openModuleId === module.id;
            const passed = module.progress?.passed === true;
            const lessonComplete = module.progress?.lessonCompleted === true;
            return (
              <View key={module.id} style={styles.moduleAccordion}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => setOpenModuleId((current) => current === module.id ? '' : module.id)}
                  style={[styles.moduleAccordionHeader, expanded && styles.moduleAccordionHeaderOpen]}
                >
                  <Text style={styles.moduleAccordionTitle}>{module.title}</Text>
                  <Text style={styles.moduleLessonCount}>{passed || lessonComplete ? '1/1' : '0/1'}</Text>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={palette.muted} />
                </Pressable>
                {expanded ? (
                  <CourseModuleCard
                    module={module}
                    busy={busyModuleId === module.id}
                    onCompleteLesson={() => void completeLesson(module.id)}
                    onSubmitAssessment={(answers) => submitAssessment(module.id, answers)}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
        <View style={[styles.courseProgressCard, width >= 820 && styles.courseProgressCardWide]}>
          <View style={styles.courseProgressHeading}>
            <Text style={styles.courseProgressTitle}>Your Progress</Text>
            <Text style={styles.courseProgressPercent}>{progressPercent}%</Text>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: progressPercent }}
            style={styles.courseProgressTrack}
          >
            <View style={[styles.courseProgressFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.courseContentSummary}>{completedLessons} of {totalModules} lessons completed</Text>
          <Pressable
            accessibilityRole="button"
            disabled={totalModules === 0}
            onPress={() => {
              const target = nextModule ?? coursework.modules[0];
              if (target) setOpenModuleId(target.id);
            }}
            style={[styles.startCourseButton, totalModules === 0 && styles.disabledButton]}
          >
            <Text style={styles.startCourseButtonText}>{startLabel}</Text>
          </Pressable>
        </View>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function CourseModuleCard({
  module,
  busy,
  onCompleteLesson,
  onSubmitAssessment,
}: {
  module: CourseModule;
  busy: boolean;
  onCompleteLesson: () => void;
  onSubmitAssessment: (answers: Record<string, string>) => Promise<{
    score: number;
    passMark: number;
    passed: boolean;
    correctAnswers: number;
    totalQuestions: number;
  } | null>;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const allAnswered = module.questions.every((question) => answers[question.id]);
  const lessonComplete = module.progress?.lessonCompleted === true;

  const submit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setFeedback('');
    const result = await onSubmitAssessment(answers);
    if (result) {
      setFeedback(result.passed
        ? `Passed: ${result.score}% (${result.correctAnswers}/${result.totalQuestions}).`
        : `Not passed yet: ${result.score}% (${result.correctAnswers}/${result.totalQuestions}). The pass mark is ${result.passMark}%. You can try again.`);
    }
    setSubmitting(false);
  };

  return (
    <View style={styles.moduleCard}>
      <Text style={styles.moduleLessonHeading}>Lesson</Text>
      {module.progress?.passed ? (
        <Text style={styles.metaText}>
          Passed · best score {module.progress.bestScore}% · {module.progress.attempts} attempt{module.progress.attempts === 1 ? '' : 's'}
        </Text>
      ) : null}
      {module.content.map((paragraph, index) => (
        <Text key={`${module.id}-content-${index}`} style={styles.bodyText}>{paragraph}</Text>
      ))}
      {!lessonComplete ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onCompleteLesson}
          style={[styles.secondaryButton, busy && styles.disabledButton]}
        >
          <Text style={styles.secondaryButtonText}>{busy ? 'Saving...' : 'Mark lesson complete'}</Text>
        </Pressable>
      ) : (
        <>
          <Text style={styles.moduleLessonHeading}>Knowledge check</Text>
          {module.questions.map((question, questionIndex) => (
            <View key={question.id} style={styles.assessmentQuestion}>
              <Text style={styles.bodyText}>{questionIndex + 1}. {question.prompt}</Text>
              {question.options.map((option) => (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: answers[question.id] === option.id }}
                  disabled={submitting || busy}
                  onPress={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                  style={[
                    styles.assessmentOption,
                    answers[question.id] === option.id && styles.assessmentOptionSelected,
                  ]}
                >
                  <Ionicons
                    name={answers[question.id] === option.id ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={palette.primary}
                  />
                  <Text style={styles.bodyText}>{option.text}</Text>
                </Pressable>
              ))}
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            disabled={!allAnswered || submitting || busy}
            onPress={() => void submit()}
            style={[styles.primaryButton, (!allAnswered || submitting || busy) && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {submitting || busy ? 'Submitting...' : module.progress?.passed ? 'Retake knowledge check' : 'Submit assessment'}
            </Text>
          </Pressable>
          {module.progress?.attempts ? (
            <Text style={styles.metaText}>
              Attempts: {module.progress.attempts} · Latest: {module.progress.latestScore ?? 0}% · Best: {module.progress.bestScore}%
            </Text>
          ) : null}
          {feedback ? <Text accessibilityRole="alert" style={styles.feedback}>{feedback}</Text> : null}
        </>
      )}
    </View>
  );
}

function ProviderManagement({
  categories,
  programmes,
}: {
  categories: LearningCategory[];
  programmes: Programme[];
}) {
  type ProviderData = {
    provider: ProviderProfile;
    courses: Course[];
    enrollments: (Enrollment & {
      courseTitle: string;
      participant: { firstName: string; lastName: string; email: string } | null;
      progressUpdatedAt: string | null;
    })[];
  };
  const [data, setData] = useState<ProviderData | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [programmeType, setProgrammeType] = useState('');
  const [duration, setDuration] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [location, setLocation] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileLocation, setProfileLocation] = useState('');
  const [profileDescription, setProfileDescription] = useState('');
  const [eligibleRoles, setEligibleRoles] = useState<AppRole[]>(['learner', 'farmer']);
  const [editingCourseId, setEditingCourseId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    apiFetch<ProviderData>('/learning/provider/me')
      .then((payload) => {
        if (active) {
          setData(payload);
          setProfileName(payload.provider.pendingProfileChanges?.name || payload.provider.name);
          setProfileLocation(payload.provider.pendingProfileChanges?.location || payload.provider.location);
          setProfileDescription(payload.provider.pendingProfileChanges?.description || payload.provider.description);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Provider tools could not be loaded.');
      });
    return () => { active = false; };
  }, [reload]);

  const toggleRole = (role: AppRole) => {
    setEligibleRoles((current) => current.includes(role)
      ? current.filter((value) => value !== role)
      : [...current, role]);
  };

  const editCourse = (course: Course) => {
    setEditingCourseId(course.id);
    setTitle(course.title);
    setDescription(course.description);
    setRequirements(course.requirements || '');
    setCategoryId(course.categoryId);
    setProgrammeType(course.programmeType);
    setDuration(course.duration);
    setDeliveryMethod(course.deliveryMethod);
    setLocation(course.location);
    setEligibleRoles(course.eligibleRoles.filter((role) => ['learner', 'farmer', 'employer', 'sdf'].includes(role)));
    setError('');
    setMessage('');
  };

  const submitListing = async (action: 'draft' | 'submit') => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const { course } = await apiFetch<{ course: Course }>(
        editingCourseId ? `/learning/provider/courses/${encodeURIComponent(editingCourseId)}` : '/learning/provider/courses',
        {
        method: editingCourseId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          action,
          title,
          description,
          requirements,
          categoryId,
          programmeType,
          duration,
          deliveryMethod,
          location,
          eligibleRoles,
        }),
      });
      setMessage(`${course.title} ${action === 'draft' ? 'was saved as a draft' : 'was submitted for administrator review'}.`);
      setEditingCourseId('');
      setTitle('');
      setDescription('');
      setRequirements('');
      setDuration('');
      setDeliveryMethod('');
      setLocation('');
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Programme listing could not be submitted.');
    } finally {
      setBusy(false);
    }
  };

  const updateEnrollment = async (enrollment: Enrollment, status: string) => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await apiFetch(`/learning/enrollments/${encodeURIComponent(enrollment.id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setMessage(`Enrolment request ${enrollment.reference} updated to ${status}.`);
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enrolment request status could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  const submitProfile = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await apiFetch<{ profileStatus: string }>('/learning/provider/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: profileName, location: profileLocation, description: profileDescription }),
      });
      setMessage(`Provider profile submitted for administrator review (${result.profileStatus}).`);
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Provider profile could not be submitted.');
    } finally {
      setBusy(false);
    }
  };

  const updateProgress = async (enrollment: ProviderData['enrollments'][number], progress: number) => {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await apiFetch(`/learning/provider/enrollments/${encodeURIComponent(enrollment.id)}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({ progress }),
      });
      setMessage(`Training progress for ${enrollment.reference} updated to ${progress}%.`);
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Training progress could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionHeading title="Provider tools" subtitle="Manage your provider profile, programme submissions, learner participation, and training progress." />
      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
      {message ? <Text accessibilityRole="alert" style={styles.feedback}>{message}</Text> : null}
      {data ? (
        <View style={styles.providerCard}>
          <Text style={styles.courseTitle}>{data.provider.name}</Text>
          <Text style={styles.metaText}>{data.provider.location}</Text>
          <Text style={styles.unverifiedBadge}>{data.provider.verificationStatus}</Text>
          <Text style={styles.metaText}>Profile review: {data.provider.profileStatus || 'Published'}</Text>
          <Text style={styles.disclaimer}>{data.provider.dataStatus}</Text>
          {data.provider.pendingProfileChanges ? <Text style={styles.disclaimer}>Pending changes are awaiting administrator review.</Text> : null}
          <TextInput accessibilityLabel="Provider name" value={profileName} onChangeText={setProfileName} placeholder="Provider name" placeholderTextColor={palette.muted} style={styles.formInput} maxLength={160} />
          <TextInput accessibilityLabel="Provider location" value={profileLocation} onChangeText={setProfileLocation} placeholder="Location" placeholderTextColor={palette.muted} style={styles.formInput} maxLength={120} />
          <TextInput accessibilityLabel="Provider description" value={profileDescription} onChangeText={setProfileDescription} placeholder="Provider description" placeholderTextColor={palette.muted} style={[styles.formInput, styles.multilineInput]} multiline maxLength={1000} />
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submitProfile()} style={[styles.primaryButton, busy && styles.disabledButton]}>
            <Text style={styles.primaryButtonText}>{busy ? 'Submitting...' : 'Submit profile for review'}</Text>
          </Pressable>
        </View>
      ) : <ActivityIndicator color={palette.primary} style={styles.inlineLoader} />}

      <View style={styles.enrollmentCard}>
        <Text style={styles.sectionTitle}>Submit a programme listing</Text>
        <Text style={styles.disclaimer}>New listings remain hidden until an administrator reviews them. Submission does not establish accreditation or course availability.</Text>
        <TextInput accessibilityLabel="Programme title" value={title} onChangeText={setTitle} placeholder="Programme title" placeholderTextColor={palette.muted} style={styles.formInput} maxLength={120} />
        <TextInput accessibilityLabel="Programme description" value={description} onChangeText={setDescription} placeholder="Programme description" placeholderTextColor={palette.muted} style={[styles.formInput, styles.multilineInput]} multiline maxLength={1000} />
        <TextInput accessibilityLabel="Programme entry requirements" value={requirements} onChangeText={setRequirements} placeholder="Entry requirements and prerequisites (optional)" placeholderTextColor={palette.muted} style={[styles.formInput, styles.multilineInput]} multiline maxLength={1000} />
        <Text style={styles.filterLabel}>Category</Text>
        <FilterChips items={categories.map((item) => ({ id: item.id, name: item.name }))} selectedId={categoryId} onSelect={setCategoryId} />
        <Text style={styles.filterLabel}>Programme type</Text>
        <FilterChips items={programmes.map((item) => ({ id: item.courseType, name: item.name }))} selectedId={programmeType} onSelect={setProgrammeType} />
        <TextInput accessibilityLabel="Course duration" value={duration} onChangeText={setDuration} placeholder="Duration" placeholderTextColor={palette.muted} style={styles.formInput} maxLength={80} />
        <TextInput accessibilityLabel="Delivery method" value={deliveryMethod} onChangeText={setDeliveryMethod} placeholder="Delivery method" placeholderTextColor={palette.muted} style={styles.formInput} maxLength={80} />
        <TextInput accessibilityLabel="Programme location" value={location} onChangeText={setLocation} placeholder="Location" placeholderTextColor={palette.muted} style={styles.formInput} maxLength={120} />
        <Text style={styles.filterLabel}>Eligible audiences</Text>
        <View style={styles.roleChoices}>
          {(['learner', 'farmer', 'employer', 'sdf'] as AppRole[]).map((role) => (
            <Pressable key={role} accessibilityRole="checkbox" accessibilityState={{ checked: eligibleRoles.includes(role) }} onPress={() => toggleRole(role)} style={styles.roleChoice}>
              <Ionicons name={eligibleRoles.includes(role) ? 'checkbox' : 'square-outline'} size={19} color={palette.primary} />
              <Text style={styles.metaText}>{role.replace('_', ' ')}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.reviewActions}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submitListing('draft')} style={[styles.reviewAction, busy && styles.disabledButton]}>
            <Text style={styles.secondaryButtonText}>{busy ? 'Saving...' : 'Save draft'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submitListing('submit')} style={[styles.primaryButton, busy && styles.disabledButton]}>
            <Text style={styles.primaryButtonText}>{busy ? 'Submitting...' : editingCourseId ? 'Resubmit for review' : 'Submit for review'}</Text>
          </Pressable>
        </View>
        {editingCourseId ? (
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => {
            setEditingCourseId('');
            setTitle('');
            setDescription('');
            setRequirements('');
            setCategoryId('');
            setProgrammeType('');
            setDuration('');
            setDeliveryMethod('');
            setLocation('');
          }}>
            <Text style={styles.clearText}>Cancel editing</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>Your programme listings</Text>
      {data?.courses.length ? data.courses.map((course) => (
        <View key={course.id} style={styles.providerCard}>
          <Text style={styles.courseTitle}>{course.title}</Text>
          <Text style={styles.metaText}>{course.programmeType} · {course.status}</Text>
          <Text style={styles.disclaimer}>{course.dataStatus}</Text>
          {course.reviewNote ? <Text style={styles.errorText}>Review note: {course.reviewNote}</Text> : null}
          {!['Published', 'Archived'].includes(course.status) ? (
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => editCourse(course)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Edit submission</Text>
            </Pressable>
          ) : null}
        </View>
      )) : <EmptyState title="No programme listings" detail="Submitted programmes will appear here with their review status." />}

      <Text style={styles.sectionTitle}>Course enrolment requests</Text>
      {data?.enrollments.length ? data.enrollments.map((entry) => (
        <View key={entry.id} style={styles.providerCard}>
          <Text style={styles.courseTitle}>{entry.courseTitle}</Text>
          <Text style={styles.metaText}>Reference: {entry.reference} · {entry.status}</Text>
          {entry.participant ? <Text style={styles.metaText}>{entry.participant.firstName} {entry.participant.lastName} · {entry.participant.email}</Text> : <Text style={styles.disclaimer}>Participant contact details are not shared because consent was not recorded.</Text>}
          {['Submitted', 'Under Review', 'Waitlisted'].includes(entry.status) ? (
            <View style={styles.reviewActions}>
              {['Under Review', 'Waitlisted', 'Accepted', 'Rejected'].map((status) => (
                <Pressable key={status} accessibilityRole="button" disabled={busy} onPress={() => void updateEnrollment(entry, status)} style={styles.reviewAction}>
                  <Text style={styles.secondaryButtonText}>{status}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {entry.status === 'Accepted' ? (
            <View>
              <Text style={styles.metaText}>Training progress: {entry.trainingProgress ?? 0}%{entry.progressUpdatedAt ? ` · Updated ${new Date(entry.progressUpdatedAt).toLocaleDateString()}` : ''}</Text>
              <View style={styles.reviewActions}>
                {[0, 25, 50, 75, 100].map((progress) => (
                  <Pressable key={progress} accessibilityRole="button" disabled={busy} onPress={() => void updateProgress(entry, progress)} style={styles.reviewAction}>
                    <Text style={styles.secondaryButtonText}>{progress}%</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )) : <EmptyState title="No enrolment requests" detail="Requests for your approved provider profile will be listed here." />}
    </>
  );
}

function LearningAdministration({
  categories,
  canManageCatalog,
  onCatalogChange,
}: {
  categories: LearningCategory[];
  canManageCatalog: boolean;
  onCatalogChange: () => void;
}) {
  type ReviewCourse = { id: string; title: string; provider: string; status: string; reviewNote?: string; statusHistory?: { status: string; date: string; actor?: string; note?: string }[] };
  type ReviewEnrollment = { id: string; reference: string; status: string; courseTitle: string; submittedAt: string | null };
  type ReviewProvider = {
    id: string;
    name: string;
    location: string;
    description: string;
    verificationStatus: string;
    registrationBody: string;
    providerReference: string;
    profileStatus: string;
    profileCompletionSubmitted: boolean;
    pendingProfileChanges: { name: string; location: string; description: string } | null;
  };
  type ReviewData = { courses: ReviewCourse[]; enrollments: ReviewEnrollment[] };
  const [review, setReview] = useState<ReviewData>({ courses: [], enrollments: [] });
  const [providerProfiles, setProviderProfiles] = useState<ReviewProvider[]>([]);
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceSummary, setResourceSummary] = useState('');
  const [resourceContent, setResourceContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<ReviewData>('/learning/admin/review'),
      apiFetch<{ resources: LearningResource[] }>('/learning/resources'),
      canManageCatalog
        ? apiFetch<{ providers: ReviewProvider[] }>('/learning/admin/providers')
        : Promise.resolve({ providers: [] }),
    ])
      .then(([reviewPayload, resourcePayload, providerPayload]) => {
        if (active) {
          setReview(reviewPayload);
          setResources(resourcePayload.resources);
          setProviderProfiles(providerPayload.providers);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Learning review queue could not be loaded.');
      });
    return () => { active = false; };
  }, [canManageCatalog, reload]);

  const refresh = () => setReload((value) => value + 1);
  const runAction = async (path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: object, success?: string): Promise<boolean> => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      setMessage(success || 'Learning records updated.');
      refresh();
      onCatalogChange();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The learning record could not be updated.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionHeading title={canManageCatalog ? 'Learning administration' : 'Learning review'} subtitle="Review submissions using the permissions attached to your signed-in account." />
      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
      {message ? <Text accessibilityRole="alert" style={styles.feedback}>{message}</Text> : null}

      {canManageCatalog ? (
        <>
          <Text style={styles.sectionTitle}>Provider profiles awaiting review</Text>
          {providerProfiles.length ? providerProfiles.map((provider) => {
            const submitted = provider.pendingProfileChanges;
            return (
              <View key={provider.id} style={styles.providerCard}>
                <Text style={styles.courseTitle}>{submitted?.name || provider.name}</Text>
                <Text style={styles.metaText}>{submitted?.location || provider.location} · {provider.profileStatus}</Text>
                <Text style={styles.metaText}>{provider.registrationBody} · Reference: {provider.providerReference}</Text>
                <Text style={styles.bodyText}>{submitted?.description || provider.description}</Text>
                <Text style={styles.disclaimer}>{provider.verificationStatus}. Review does not verify accreditation.</Text>
                {!provider.profileCompletionSubmitted ? <Text style={styles.disclaimer}>The provider must submit a completed profile before approval.</Text> : null}
                <View style={styles.reviewActions}>
                  <Pressable accessibilityRole="button" disabled={busy || !provider.profileCompletionSubmitted} onPress={() => void runAction(`/learning/admin/providers/${encodeURIComponent(provider.id)}`, 'PATCH', { decision: 'approve' }, `${provider.name} profile approved.`)} style={[styles.reviewAction, (!provider.profileCompletionSubmitted || busy) && styles.disabledButton]}>
                    <Text style={styles.secondaryButtonText}>Approve profile</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => void runAction(`/learning/admin/providers/${encodeURIComponent(provider.id)}`, 'PATCH', { decision: 'reject', note: 'Please contact the administrator for profile review feedback.' }, `${provider.name} profile rejected.`)} style={styles.reviewAction}>
                    <Text style={styles.withdrawText}>Reject profile</Text>
                  </Pressable>
                </View>
              </View>
            );
          }) : <EmptyState title="No provider profiles awaiting review" detail="New provider accounts and profile changes appear here for administrator review." />}
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Programme listings awaiting review</Text>
      {review.courses.length ? review.courses.map((course) => (
        <View key={course.id} style={styles.providerCard}>
          <Text style={styles.courseTitle}>{course.title}</Text>
          <Text style={styles.metaText}>{course.provider} · {course.status}</Text>
          {course.reviewNote ? <Text style={styles.errorText}>Rejection reason: {course.reviewNote}</Text> : null}
          {course.statusHistory?.length ? (
            <Text style={styles.metaText}>
              Latest decision: {course.statusHistory[course.statusHistory.length - 1].status} · {formatDate(course.statusHistory[course.statusHistory.length - 1].date)}
            </Text>
          ) : null}
          {canManageCatalog ? (
            <View style={styles.reviewActions}>
              {course.status === 'Pending Review' ? (
                <>
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => void runAction(`/learning/courses/${encodeURIComponent(course.id)}/status`, 'PATCH', { status: 'Approved' }, `${course.title} approved. Publish it when ready.`)} style={styles.reviewAction}>
                    <Text style={styles.secondaryButtonText}>Approve</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => void runAction(`/learning/courses/${encodeURIComponent(course.id)}/status`, 'PATCH', { status: 'Rejected', note: rejectionNotes[course.id] }, `${course.title} rejected.`)} style={styles.reviewAction}>
                    <Text style={styles.withdrawText}>Reject</Text>
                  </Pressable>
                </>
              ) : null}
              {course.status === 'Approved' ? (
                <>
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => void runAction(`/learning/courses/${encodeURIComponent(course.id)}/status`, 'PATCH', { status: 'Published' }, `${course.title} published.`)} style={styles.reviewAction}>
                    <Text style={styles.secondaryButtonText}>Publish</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => void runAction(`/learning/courses/${encodeURIComponent(course.id)}/status`, 'PATCH', { status: 'Rejected', note: rejectionNotes[course.id] }, `${course.title} rejected.`)} style={styles.reviewAction}>
                    <Text style={styles.withdrawText}>Reject</Text>
                  </Pressable>
                </>
              ) : null}
              {course.status === 'Published' ? (
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => void runAction(`/learning/courses/${encodeURIComponent(course.id)}/status`, 'PATCH', { status: 'Approved' }, `${course.title} unpublished.`)} style={styles.reviewAction}>
                  <Text style={styles.secondaryButtonText}>Unpublish</Text>
                </Pressable>
              ) : null}
            </View>
          ) : <Text style={styles.disclaimer}>Only an administrator can publish a submitted course listing.</Text>}
          {canManageCatalog && ['Pending Review', 'Approved'].includes(course.status) ? (
            <TextInput
              accessibilityLabel={`Rejection reason for ${course.title}`}
              value={rejectionNotes[course.id] || ''}
              onChangeText={(value) => setRejectionNotes((current) => ({ ...current, [course.id]: value }))}
              placeholder="Reason required to reject"
              placeholderTextColor={palette.muted}
              style={styles.formInput}
              maxLength={500}
            />
          ) : null}
        </View>
      )) : <EmptyState title="No programme submissions to review" detail="Provider-submitted listings will appear here with their review history." />}

      <Text style={styles.sectionTitle}>Course enrolment requests</Text>
      {review.enrollments.length ? review.enrollments.map((entry) => (
        <View key={entry.id} style={styles.providerCard}>
          <Text style={styles.courseTitle}>{entry.courseTitle}</Text>
          <Text style={styles.metaText}>Reference: {entry.reference} · {entry.status}</Text>
          <View style={styles.reviewActions}>
            {['Under Review', 'Waitlisted', 'Accepted', 'Rejected'].map((status) => (
              <Pressable key={status} accessibilityRole="button" disabled={busy} onPress={() => void runAction(`/learning/enrollments/${encodeURIComponent(entry.id)}/status`, 'PATCH', { status }, `Enrolment request ${entry.reference} updated to ${status}.`)} style={styles.reviewAction}>
                <Text style={styles.secondaryButtonText}>{status}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )) : <EmptyState title="No open enrolment requests" detail="Submitted, under-review, and waitlisted enrolment requests appear here." />}

      {canManageCatalog ? (
        <>
          <View style={styles.enrollmentCard}>
            <Text style={styles.sectionTitle}>Manage learning categories</Text>
            {categories.map((category) => (
              <View key={category.id} style={styles.manageRow}>
                <Text style={styles.bodyText}>{category.name}</Text>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => void runAction(`/learning/categories/${encodeURIComponent(category.id)}`, 'DELETE', undefined, `Category ${category.name} deleted if it was not in use.`)}>
                  <Ionicons name="trash-outline" size={20} color={palette.danger} />
                </Pressable>
              </View>
            ))}
            <TextInput accessibilityLabel="New category name" value={categoryName} onChangeText={setCategoryName} placeholder="New category name" placeholderTextColor={palette.muted} style={styles.formInput} maxLength={80} />
            <TextInput accessibilityLabel="New category description" value={categoryDescription} onChangeText={setCategoryDescription} placeholder="Category description" placeholderTextColor={palette.muted} style={styles.formInput} maxLength={240} />
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => {
              void runAction('/learning/categories', 'POST', { name: categoryName, description: categoryDescription }, 'Learning category added.')
                .then((succeeded) => {
                  if (succeeded) {
                    setCategoryName('');
                    setCategoryDescription('');
                  }
                });
            }} style={[styles.primaryButton, busy && styles.disabledButton]}>
              <Text style={styles.primaryButtonText}>Add category</Text>
            </Pressable>
          </View>

          <View style={styles.enrollmentCard}>
            <Text style={styles.sectionTitle}>Manage in-app learning guides</Text>
            <TextInput accessibilityLabel="Guide title" value={resourceTitle} onChangeText={setResourceTitle} placeholder="Guide title" placeholderTextColor={palette.muted} style={styles.formInput} maxLength={120} />
            <TextInput accessibilityLabel="Guide summary" value={resourceSummary} onChangeText={setResourceSummary} placeholder="Short summary" placeholderTextColor={palette.muted} style={styles.formInput} maxLength={300} />
            <FilterChips items={categories.map((item) => ({ id: item.id, name: item.name }))} selectedId={selectedCategory} onSelect={setSelectedCategory} />
            <TextInput accessibilityLabel="Guide paragraphs" value={resourceContent} onChangeText={setResourceContent} placeholder="Guide text. Put each paragraph on a new line." placeholderTextColor={palette.muted} style={[styles.formInput, styles.multilineInput]} multiline />
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => {
              const content = resourceContent.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
              void runAction('/learning/resources', 'POST', {
                title: resourceTitle,
                summary: resourceSummary,
                categoryId: selectedCategory,
                content,
              }, 'Learning guide added.')
                .then((succeeded) => {
                  if (succeeded) {
                    setResourceTitle('');
                    setResourceSummary('');
                    setResourceContent('');
                  }
                });
            }} style={[styles.primaryButton, busy && styles.disabledButton]}>
              <Text style={styles.primaryButtonText}>Add in-app guide</Text>
            </Pressable>
            {resources.map((resource) => (
              <View key={resource.id} style={styles.manageRow}>
                <Text style={styles.bodyText}>{resource.title}</Text>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => void runAction(`/learning/resources/${encodeURIComponent(resource.id)}`, 'DELETE', undefined, `Guide ${resource.title} deleted.`)}>
                  <Ionicons name="trash-outline" size={20} color={palette.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

function FilterChips({
  items,
  selectedId,
  onSelect,
}: {
  items: { id: string; name: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
      {items.map((item) => (
        <Pressable
          key={item.id || `all-${item.name}`}
          accessibilityRole="button"
          accessibilityState={{ selected: item.id === selectedId }}
          onPress={() => onSelect(item.id)}
          style={[styles.filterChip, item.id === selectedId && styles.filterChipSelected]}
        >
          <Text style={[styles.filterChipText, item.id === selectedId && styles.filterChipTextSelected]}>{item.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function DetailLoading({ error }: { error: string }) {
  if (error) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="alert-circle-outline" size={28} color={palette.danger} />
        <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  return <ActivityIndicator color={palette.primary} style={styles.inlineLoader} />;
}

function DetailInfo({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailInfo}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function MetaChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={15} color={palette.primary} />
      <Text style={styles.metaChipText}>{label}</Text>
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="leaf-outline" size={26} color={palette.primary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.bodyText}>{detail}</Text>
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
  screen: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  mobileLearnerNavigation: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  courseDesktopScreen: { flexDirection: 'row', paddingHorizontal: 0, paddingTop: 0 },
  courseMainArea: { flex: 1, minWidth: 0 },
  courseMainAreaDesktop: { backgroundColor: '#F7F9FC' },
  courseTopbar: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8ECEF', paddingHorizontal: 20 },
  courseTopbarLabel: { color: '#39443E', fontSize: 11 },
  courseTopbarBrand: { color: palette.primaryDark, fontSize: 12, fontWeight: '800' },
  coursePageBody: { flex: 1, minHeight: 0 },
  coursePageBodyDesktop: { paddingHorizontal: 28, paddingTop: 20 },
  content: { width: '100%', maxWidth: 1080, alignSelf: 'center', paddingBottom: 110 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { minHeight: 224, overflow: 'hidden', justifyContent: 'flex-end', borderRadius: radius.xl, backgroundColor: palette.primaryDark },
  heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(5, 33, 22, 0.62)' },
  heroCopy: { padding: spacing.lg },
  heroEyebrow: { color: '#E8C778', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 31, fontWeight: '800', marginTop: spacing.xs },
  heroDescription: { color: '#FFFFFF', fontSize: 13, lineHeight: 20, marginTop: spacing.sm },
  searchWrap: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: palette.surface, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, paddingHorizontal: spacing.md, marginTop: spacing.md },
  searchInput: { flex: 1, minWidth: 0, color: palette.text, paddingVertical: spacing.sm, fontSize: 14 },
  sectionTabs: { gap: spacing.xs, paddingVertical: spacing.md },
  sectionTab: { minHeight: 40, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, paddingHorizontal: spacing.md },
  sectionTabSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  sectionTabText: { color: palette.text, fontSize: 12, fontWeight: '700' },
  sectionTabTextSelected: { color: '#FFFFFF' },
  sectionHeading: { marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { color: palette.text, fontSize: 19, lineHeight: 25, fontWeight: '800' },
  subtitle: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  filterChips: { gap: spacing.xs, paddingVertical: spacing.xs },
  filterRow: { marginTop: spacing.xs },
  filterClearButton: { alignSelf: 'flex-start', marginTop: spacing.xs, minHeight: 44, justifyContent: 'center' },
  courseFilterInputs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  filterInput: { flex: 1, minWidth: 140, minHeight: 42, backgroundColor: palette.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: palette.border, color: palette.text, paddingHorizontal: spacing.sm },
  formInput: { minHeight: 44, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, color: palette.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.sm },
  multilineInput: { minHeight: 88, textAlignVertical: 'top' },
  roleChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  roleChoice: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: spacing.xs, paddingRight: spacing.xs },
  reviewActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  reviewAction: { minHeight: 38, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: palette.primary, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  manageRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: spacing.xs },
  filterChip: { borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 9 },
  filterChipSelected: { backgroundColor: palette.surfaceAlt, borderColor: palette.primary },
  filterChipText: { color: palette.text, fontSize: 12, fontWeight: '600' },
  filterChipTextSelected: { color: palette.primaryDark, fontWeight: '800' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap', marginTop: spacing.sm },
  filterLabel: { color: palette.muted, fontSize: 12, fontWeight: '700', marginRight: 2 },
  sortChip: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 7, backgroundColor: palette.surfaceAlt },
  sortChipSelected: { backgroundColor: palette.primary },
  sortText: { color: palette.text, fontSize: 11, fontWeight: '700' },
  sortTextSelected: { color: '#FFFFFF' },
  clearText: { color: palette.primary, fontSize: 12, fontWeight: '800', padding: spacing.xs },
  disclaimer: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: spacing.sm },
  inlineLoader: { marginVertical: spacing.lg },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: spacing.md },
  providerDirectoryGrid: { flexDirection: 'column', justifyContent: 'flex-start' },
  courseCard: { backgroundColor: palette.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, overflow: 'hidden', marginBottom: spacing.md },
  courseImage: { width: '100%', height: 150, backgroundColor: palette.surfaceAlt },
  courseCardBody: { padding: spacing.md },
  categoryLabel: { color: palette.primary, fontSize: 10, letterSpacing: 0.7, textTransform: 'uppercase', fontWeight: '800' },
  courseTitle: { color: palette.text, fontSize: 16, lineHeight: 21, fontWeight: '800', marginTop: spacing.xs },
  bodyText: { color: palette.text, fontSize: 13, lineHeight: 20, marginTop: spacing.xs },
  metaText: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: spacing.xs },
  unverifiedBadge: { alignSelf: 'flex-start', color: palette.primaryDark, backgroundColor: palette.surfaceAlt, borderRadius: 999, overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: 6, fontSize: 10, lineHeight: 14, fontWeight: '700', marginTop: spacing.sm },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  secondaryButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderColor: palette.primary, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginTop: spacing.sm },
  secondaryButtonText: { color: palette.primary, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  saveButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: palette.border },
  flexOne: { flex: 1 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm },
  categoryCard: { width: '48%', minWidth: 140, flexGrow: 1, backgroundColor: palette.surface, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, padding: spacing.md },
  categoryIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: palette.surfaceAlt },
  categoryTitle: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '800', marginTop: spacing.sm },
  categoryDescription: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: spacing.xs },
  programmeCard: { backgroundColor: palette.surface, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, padding: spacing.md, marginBottom: spacing.md },
  linkText: { color: palette.primary, fontSize: 12, fontWeight: '800', marginTop: spacing.sm },
  locationInput: { minHeight: 44, backgroundColor: palette.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: palette.border, color: palette.text, paddingHorizontal: spacing.md, marginTop: spacing.xs, marginBottom: spacing.sm },
  providerCard: { backgroundColor: palette.surface, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, padding: spacing.md, marginBottom: spacing.md },
  providerDirectoryCard: { width: '100%' },
  providerHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  providerHeadingCopy: { flex: 1, minWidth: 0 },
  providerIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: palette.surfaceAlt },
  resourceCard: { backgroundColor: palette.surface, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, padding: spacing.md, marginBottom: spacing.md },
  resourceIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: palette.surfaceAlt },
  resourceIconLarge: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, backgroundColor: palette.surfaceAlt },
  emptyState: { alignItems: 'center', backgroundColor: palette.surface, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, padding: spacing.lg, marginTop: spacing.md },
  emptyTitle: { color: palette.text, fontSize: 15, fontWeight: '800', marginTop: spacing.sm },
  errorCard: { backgroundColor: '#F8E8E6', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  errorText: { color: palette.danger, fontSize: 13, lineHeight: 19 },
  detailImage: { width: '100%', height: 188, borderRadius: radius.lg, backgroundColor: palette.surfaceAlt, marginBottom: spacing.md },
  coursePageHeader: { marginBottom: spacing.sm },
  coursePageBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  coursePageBadge: { color: palette.text, backgroundColor: palette.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 5, fontSize: 11, fontWeight: '700' },
  courseProviderLine: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
  myCoursesHeading: { marginTop: spacing.sm, marginBottom: spacing.lg },
  desktopPageTitle: { color: palette.text, fontSize: 25, lineHeight: 32, fontWeight: '800' },
  coursePageSubtitle: { color: palette.muted, fontSize: 13, marginTop: 3 },
  myCoursesSectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  enrolmentRequestHeading: { marginTop: spacing.lg },
  myCoursesSectionTitle: { color: palette.text, fontSize: 14, fontWeight: '800' },
  desktopCourseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  desktopCourseCard: { width: '32%', minWidth: 250, flexGrow: 1, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, padding: spacing.md },
  desktopCourseCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  courseCardTitleCopy: { flex: 1, minWidth: 0 },
  desktopCourseTitle: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  desktopCourseProvider: { color: palette.muted, fontSize: 11, marginTop: 4 },
  courseStatusBadge: { overflow: 'hidden', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 4, fontSize: 9, lineHeight: 13, fontWeight: '700' },
  courseStatusBadgeActive: { color: '#0759C7', backgroundColor: '#E8F0FF' },
  courseStatusBadgePending: { color: '#705B1A', backgroundColor: '#F7F1DE' },
  desktopCourseDescription: { color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: spacing.md, minHeight: 30 },
  desktopCourseProgressLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs, marginTop: spacing.md },
  desktopCourseActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  desktopViewCourseButton: { flex: 1, minHeight: 38, marginTop: spacing.sm },
  desktopWithdrawButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, marginTop: spacing.sm },
  courseDetailsCard: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  detailTitle: { color: palette.text, fontSize: 26, lineHeight: 32, fontWeight: '800', marginTop: spacing.xs },
  eyebrow: { color: palette.primary, fontSize: 10, letterSpacing: 1, fontWeight: '800', marginTop: spacing.sm },
  courseMetadata: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: palette.surfaceAlt, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  metaChipText: { color: palette.text, fontSize: 11, fontWeight: '600' },
  detailBody: { color: palette.text, fontSize: 14, lineHeight: 23, marginTop: spacing.md },
  detailInfo: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: spacing.sm },
  detailLabel: { flex: 1, color: palette.muted, fontSize: 12 },
  detailValue: { flex: 1, color: palette.text, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  enrollmentCard: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  courseworkActions: { marginTop: spacing.xs },
  courseworkPanel: { marginTop: spacing.md },
  courseworkLayout: { gap: spacing.md },
  courseworkLayoutWide: { flexDirection: 'row', alignItems: 'flex-start' },
  courseContentCard: { flex: 1, minWidth: 0, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, padding: spacing.lg },
  courseContentHeading: { color: palette.text, fontSize: 17, fontWeight: '800' },
  courseContentSummary: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
  emptyCourseLessons: { minHeight: 74, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: spacing.sm },
  courseProgressCard: { minWidth: 0, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, padding: spacing.lg },
  courseProgressCardWide: { width: 344 },
  courseProgressHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  courseProgressTitle: { color: palette.text, fontSize: 13, fontWeight: '700' },
  courseProgressPercent: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  courseProgressTrack: { height: 9, overflow: 'hidden', backgroundColor: palette.surfaceAlt, borderRadius: 5, marginTop: spacing.sm },
  courseProgressFill: { height: '100%', backgroundColor: palette.primary, borderRadius: 5 },
  startCourseButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.primary, borderRadius: radius.sm, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  startCourseButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  moduleAccordion: { borderBottomWidth: 1, borderBottomColor: palette.border },
  moduleAccordionHeader: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  moduleAccordionHeaderOpen: { backgroundColor: palette.surfaceAlt, paddingHorizontal: spacing.xs, borderRadius: radius.sm },
  lessonStatusIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.background },
  lessonStatusIconComplete: { backgroundColor: palette.primary, borderColor: palette.primary },
  moduleAccordionCopy: { flex: 1, minWidth: 0 },
  moduleAccordionTitle: { flex: 1, color: palette.text, fontSize: 13, fontWeight: '700' },
  moduleLessonCount: { color: palette.muted, fontSize: 11, minWidth: 28, textAlign: 'right' },
  lockedLessonMessage: { color: palette.muted, fontSize: 12, lineHeight: 18, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  moduleCard: { backgroundColor: palette.surface, paddingBottom: spacing.md },
  moduleLessonHeading: { color: palette.text, fontSize: 14, fontWeight: '800', marginTop: spacing.md },
  assessmentQuestion: { backgroundColor: palette.background, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm },
  assessmentOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.xs },
  assessmentOptionSelected: { borderColor: palette.primary, backgroundColor: palette.surfaceAlt },
  noteInput: { minHeight: 76, textAlignVertical: 'top', backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, color: palette.text, padding: spacing.sm, marginTop: spacing.md },
  acknowledgement: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.md },
  acknowledgementText: { flex: 1, color: palette.text, fontSize: 12, lineHeight: 18 },
  primaryButton: { minHeight: 46, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.primary, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.sm },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  disabledButton: { opacity: 0.55 },
  textButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  feedback: { color: palette.primaryDark, backgroundColor: palette.surfaceAlt, borderRadius: radius.sm, padding: spacing.md, lineHeight: 20, marginTop: spacing.md },
  notice: { backgroundColor: palette.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  providerHeroIcon: { width: 64, height: 64, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.surfaceAlt, borderRadius: 32 },
  resourceParagraph: { color: palette.text, fontSize: 14, lineHeight: 24, marginTop: spacing.lg },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  metricCard: { flex: 1, minWidth: 90, alignItems: 'center', backgroundColor: palette.surface, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, padding: spacing.md },
  metricValue: { color: palette.primary, fontSize: 20, fontWeight: '800' },
  progressCard: { backgroundColor: palette.surface, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, padding: spacing.md, marginTop: spacing.sm },
  progressTrack: { height: 8, overflow: 'hidden', backgroundColor: palette.surfaceAlt, borderRadius: 4, marginTop: spacing.sm },
  progressFill: { height: '100%', backgroundColor: palette.primary, borderRadius: 4 },
  withdrawButton: { minHeight: 42, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: palette.danger, borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  withdrawText: { color: palette.danger, fontSize: 11, fontWeight: '800' },
});
