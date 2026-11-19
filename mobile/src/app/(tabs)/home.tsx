import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LearnerSidebar } from '@/components/navigation/learner-sidebar';
import { useAuth } from '@/context/auth-context';
import { NotificationBell } from '@/components/navigation/notification-bell';
import { apiFetch } from '@/lib/api';
import { palette, spacing } from '@/theme';

type DashboardItem = {
  id: string;
  title: string;
  body: string;
};

type DashboardData = {
  userRole: string;
  title: string;
  description: string;
  metrics: { label: string; value: number | string }[];
  sections: { title: string; emptyState: string; items: DashboardItem[] }[];
};

type QuickAction = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'green' | 'gold' | 'blue' | 'coral';
  onPress: () => void;
};

export default function HomeScreen() {
  const { session } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, 520);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const desktopLearner = session?.activeRole === 'learner' && width >= 820;

  useEffect(() => {
    let isCurrent = true;

    if (session && !desktopLearner) {
      apiFetch<DashboardData>('/dashboard')
        .then((payload) => {
          if (isCurrent) {
            setDashboard(payload);
            setErrorMessage('');
          } else {
            setLoading(false);
          }
        })
        .catch(() => {
          if (isCurrent) {
            setErrorMessage('Your dashboard could not be loaded. Check your connection and try again.');
          }
        })
        .finally(() => {
          if (isCurrent) {
            setLoading(false);
          }
        });
    }

    return () => {
      isCurrent = false;
    };
  }, [desktopLearner, retry, session]);

  if (desktopLearner && session) {
    return (
      <LearnerDashboard
        firstName={session.user.firstName}
        lastName={session.user.lastName}
        role={session.activeRole}
      />
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={palette.primary} /></View>;
  }

  const firstName = session?.user.firstName ?? 'there';
  const lastName = session?.user.lastName ?? '';
  const role = session?.activeRole ?? 'learner';
  const featuredMetric = dashboard?.metrics[0];
  const isAdministrator = role === 'administrator';
  const isInternalStaff = role === 'internal_staff';
  const latestSection = dashboard?.sections.find((section) => {
    const title = section.title.toLowerCase();
    return isAdministrator
      ? title.includes('activity')
      : isInternalStaff
        ? title.includes('review queue')
        : title.includes('opportunit');
  }) ?? dashboard?.sections[0];
  const recentItems = latestSection?.items.slice(0, 2) ?? [];
  const quickActions = getQuickActions(role);
  const roleTitle = role.replace('_', ' ');
  const latestRoute = getSectionRoute(latestSection?.title ?? '');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
        persistentScrollbar
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to dashboard"
            onPress={() => router.replace('/home')}
            style={styles.brand}
          >
            <View style={styles.brandMark}>
              <Ionicons name="leaf" size={15} color="#FFFFFF" />
            </View>
            <Text style={styles.brandName}><Text style={styles.brandStrong}>MyAgri</Text> SETA</Text>
          </Pressable>
          <View style={styles.headerActions}>
            <NotificationBell
              onPress={() => router.push('/notifications')}
              style={styles.headerIcon}
              color={palette.text}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${firstName}'s profile`}
              onPress={() => router.push('/profile')}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {`${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase()}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.eyebrow}>{`YOUR ${roleTitle.toUpperCase()} JOURNEY`}</Text>
        <Text style={styles.heading}>Keep growing, {firstName}</Text>
        <Text style={styles.subheading}>{dashboard?.description ?? 'Here is what is happening in your AgriConnect world.'}</Text>

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Ionicons name="cloud-offline-outline" size={23} color={palette.danger} />
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setLoading(true);
                setRetry((current) => current + 1);
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={quickActions[0].onPress}
              style={({ pressed }) => [styles.featureCard, pressed && styles.featurePressed]}
            >
              <View style={styles.featureHeader}>
                <View style={styles.featureIcon}>
                  <Ionicons name={getRoleIcon(role)} size={19} color={palette.primaryDark} />
                </View>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Account {session?.user.status ?? 'active'}</Text>
                </View>
              </View>
              <Text style={styles.featureEyebrow}>
                {isAdministrator ? 'PLATFORM OVERVIEW' : isInternalStaff ? 'YOUR REVIEW WORKLOAD' : 'YOUR AGRICONNECT OVERVIEW'}
              </Text>
              <Text style={styles.featureValue}>{featuredMetric?.value ?? '—'}</Text>
              <Text style={styles.featureLabel}>{featuredMetric?.label ?? 'Dashboard summary'}</Text>
              <View style={styles.featureDivider} />
              <View style={styles.featureAction}>
                <Text style={styles.featureActionText}>{getFeatureAction(role)}</Text>
                <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
              </View>
            </Pressable>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>MADE FOR YOU</Text>
                <Text style={styles.sectionTitle}>Quick actions</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={getQuickActionsDestination(role)}
                style={styles.viewAll}
              >
                <Text style={styles.viewAllText}>View all</Text>
              </Pressable>
            </View>

            <View style={styles.actionGrid}>
              {quickActions.map((action) => (
                <QuickActionCard key={action.label} action={action} />
              ))}
            </View>

            {['learner', 'farmer'].includes(role) ? <PassportSummaryCard /> : null}
            {isAdministrator ? <AdminLearningOverview /> : null}

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>STAY INFORMED</Text>
                <Text style={styles.sectionTitle}>Latest for you</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={latestRoute ?? (() => router.push('/services'))}
                style={styles.viewAll}
              >
                <Text style={styles.viewAllText}>View all</Text>
              </Pressable>
            </View>

            {recentItems.length > 0 ? recentItems.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole={getLatestItemRoute(latestSection?.title ?? '', item) ? 'button' : undefined}
                disabled={!getLatestItemRoute(latestSection?.title ?? '', item)}
                onPress={getLatestItemRoute(latestSection?.title ?? '', item)}
                style={({ pressed }) => [styles.latestCard, pressed && styles.cardPressed]}
              >
                <View style={styles.latestIcon}>
                  <Ionicons name={getLatestIcon(latestSection?.title ?? '')} size={18} color={palette.primary} />
                </View>
                <View style={styles.latestText}>
                  <Text style={styles.latestTitle}>{item.title}</Text>
                  <Text style={styles.latestDescription}>{item.body}</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={palette.muted} />
              </Pressable>
            )) : (
              <View style={styles.latestCard}>
                <View style={styles.latestIcon}>
                  <Ionicons name="information-circle-outline" size={18} color={palette.primary} />
                </View>
                <Text style={styles.latestDescription}>
                  {latestSection?.emptyState ?? 'Updates relevant to your role will appear here.'}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type LearnerEnrollment = {
  id: string;
  courseId: string;
  reference: string;
  status: string;
  updatedAt: string;
  course?: { id: string; title: string; provider?: { name: string } | null };
};

type LearnerProgress = {
  enrollmentId: string;
  progressPercent: number;
  updatedAt: string;
  completed?: boolean;
  completedModules?: number;
  totalModules?: number;
};

type LearnerActivity = {
  id: string;
  title: string;
  detail: string;
  updatedAt: string;
};

function LearnerDashboard({
  firstName,
  lastName,
  role,
}: {
  firstName: string;
  lastName: string;
  role: string;
}) {
  const [enrollments, setEnrollments] = useState<LearnerEnrollment[]>([]);
  const [progress, setProgress] = useState<LearnerProgress[]>([]);
  const [startedGuides, setStartedGuides] = useState<{ id: string; title: string; status: string; updatedAt: string }[]>([]);
  const [certificateCount, setCertificateCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch<{
      enrollments?: LearnerEnrollment[];
      progress?: LearnerProgress[];
      startedResources?: { id: string; status: string; updatedAt: string; resource?: { title: string } }[];
      certificates?: unknown[];
    }>('/learning/me')
      .then((payload) => {
        if (!active) return;
        if (
          !Array.isArray(payload.enrollments) ||
          !Array.isArray(payload.progress) ||
          !Array.isArray(payload.startedResources) ||
          !Array.isArray(payload.certificates)
        ) {
          throw new Error('Your learning summary is incomplete. Refresh the page or restart the API.');
        }
        setEnrollments(payload.enrollments);
        setProgress(payload.progress);
        setStartedGuides(payload.startedResources.map((entry) => ({
          id: entry.id,
          title: entry.resource?.title ?? 'Learning guide',
          status: entry.status,
          updatedAt: entry.updatedAt,
        })));
        setCertificateCount(payload.certificates.length);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Your learning summary could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const activeEnrollments = enrollments.filter((entry) => entry.status !== 'Withdrawn');
  const progressByEnrollment = new Map(progress.map((entry) => [entry.enrollmentId, entry]));
  const completedCount = progress.filter((entry) => entry.completed).length;
  const featuredEnrollment = activeEnrollments.find((entry) => entry.status === 'Enrolled (demo)') ?? activeEnrollments[0];
  const recentActivity: LearnerActivity[] = [
    ...activeEnrollments.map((entry) => ({
      id: `enrollment-${entry.id}`,
      title: entry.course?.title ?? 'Course enrolment',
      detail: `Enrolment status: ${entry.status}`,
      updatedAt: entry.updatedAt,
    })),
    ...startedGuides.map((entry) => ({
      id: `guide-${entry.id}`,
      title: entry.title,
      detail: `Guide ${entry.status.toLowerCase()}`,
      updatedAt: entry.updatedAt,
    })),
    ...progress.map((entry) => ({
      id: `progress-${entry.enrollmentId}`,
      title: activeEnrollments.find((enrollment) => enrollment.id === entry.enrollmentId)?.course?.title ?? 'Course progress',
      detail: `${entry.progressPercent}% course progress recorded`,
      updatedAt: entry.updatedAt,
    })),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 4);

  return (
    <SafeAreaView style={learnerDashboardStyles.safeArea}>
      <View style={learnerDashboardStyles.shell}>
        <LearnerSidebar
          active="dashboard"
          firstName={firstName}
          lastName={lastName}
          role={role}
          onDashboard={() => router.replace('/home')}
          onCourses={() => router.push({ pathname: '/learning', params: { section: 'My learning' } })}
          onOpportunities={() => router.push('/opportunities')}
          onPassport={() => router.push('/passport')}
          onNotifications={() => router.push('/notifications')}
          onProfile={() => router.push('/profile')}
        />
        <View style={learnerDashboardStyles.main}>
          <View style={learnerDashboardStyles.topbar}>
          <View style={learnerDashboardStyles.topbarSearch}>
            <Ionicons name="search-outline" size={16} color={palette.muted} />
            <Text style={learnerDashboardStyles.topbarSearchText}>Search courses, programmes and resources...</Text>
          </View>
          <View style={learnerDashboardStyles.topbarRight}>
            <NotificationBell onPress={() => router.push('/notifications')} color={palette.text} />
            <Pressable accessibilityRole="button" onPress={() => router.push('/profile')} style={learnerDashboardStyles.topbarProfile}>
              <View style={learnerDashboardStyles.topbarAvatar}><Text style={learnerDashboardStyles.topbarAvatarText}>{firstName.slice(0, 1).toUpperCase()}</Text></View>
              <Text style={learnerDashboardStyles.topbarName}>{firstName} {lastName}</Text>
            </Pressable>
          </View>
          </View>
          <ScrollView contentContainerStyle={learnerDashboardStyles.content} showsVerticalScrollIndicator>
          <View style={learnerDashboardStyles.welcomeBanner}>
            <Image source={require('@/assets/images/farm-hero-farmer.jpg')} contentFit="cover" style={StyleSheet.absoluteFill} />
            <View style={learnerDashboardStyles.welcomeShade} />
            <View style={learnerDashboardStyles.welcomeCopy}>
              <Text style={learnerDashboardStyles.welcomeEyebrow}>AGRILEARN · LEARNER DASHBOARD</Text>
              <Text style={learnerDashboardStyles.heading}>Welcome back, {firstName}!</Text>
              <Text style={learnerDashboardStyles.subheading}>Keep learning. Grow your skills. Build your future in agriculture.</Text>
            </View>
          </View>
            {error ? (
              <View accessibilityRole="alert" style={learnerDashboardStyles.errorCard}>
                <Text style={learnerDashboardStyles.errorText}>{error}</Text>
              </View>
            ) : loading ? (
              <ActivityIndicator size="large" color={palette.primary} style={learnerDashboardStyles.loader} />
            ) : (
              <>
                <View style={learnerDashboardStyles.metrics}>
                  <LearnerMetric icon="book-outline" label="Active courses" value={activeEnrollments.length} />
                  <LearnerMetric icon="trophy-outline" label="Courses completed" value={completedCount} />
                  <LearnerMetric icon="ribbon-outline" label="Certificates" value={certificateCount} />
                  <LearnerMetric icon="reader-outline" label="Guides started" value={startedGuides.length} />
                </View>
                <View style={learnerDashboardStyles.referencePanels}>
                  <DashboardPanel icon="book-outline" title="Continue Learning" action="View all" onPress={() => router.push({ pathname: '/learning', params: { section: 'My learning' } })}>
                    <Text style={learnerDashboardStyles.panelTitle}>{featuredEnrollment?.course?.title ?? 'Explore agricultural courses'}</Text>
                    <Text style={learnerDashboardStyles.meta}>{featuredEnrollment ? `${progressByEnrollment.get(featuredEnrollment.id)?.progressPercent ?? 0}% complete` : 'Find a course to begin learning.'}</Text>
                  </DashboardPanel>
                  <DashboardPanel icon="sparkles-outline" title="Recommended for You" action="View all" onPress={() => router.push('/learning')}>
                    <Text style={learnerDashboardStyles.panelTitle}>Agricultural learning pathways</Text>
                    <Text style={learnerDashboardStyles.meta}>Courses and resources matched to your learning journey.</Text>
                  </DashboardPanel>
                  <DashboardPanel icon="people-outline" title="Providers" action="Browse" onPress={() => router.push({ pathname: '/learning', params: { section: 'Providers' } })}>
                    <Text style={learnerDashboardStyles.panelTitle}>Find training providers</Text>
                    <Text style={learnerDashboardStyles.meta}>Discover organisations offering agricultural training.</Text>
                  </DashboardPanel>
                  <DashboardPanel icon="document-text-outline" title="Resources" action="Browse" onPress={() => router.push({ pathname: '/learning', params: { section: 'Resources' } })}>
                    <Text style={learnerDashboardStyles.panelTitle}>{startedGuides[0]?.title ?? 'Agricultural learning guides'}</Text>
                    <Text style={learnerDashboardStyles.meta}>{startedGuides.length ? 'Continue your started materials.' : 'Browse published learning materials.'}</Text>
                  </DashboardPanel>
                </View>
                <PassportSummaryCard />
                <View style={learnerDashboardStyles.columns}>
                  <View style={learnerDashboardStyles.primaryColumn}>
                    {featuredEnrollment ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push({ pathname: '/learning', params: { courseId: featuredEnrollment.courseId } })}
                        style={learnerDashboardStyles.featuredCourse}
                      >
                        <Text style={learnerDashboardStyles.featuredEyebrow}>
                          {featuredEnrollment.status === 'Enrolled (demo)' ? 'CONTINUE LEARNING · SAMPLE' : 'COURSE REQUEST'}
                        </Text>
                        <Text style={learnerDashboardStyles.courseName}>{featuredEnrollment.course?.title ?? 'Learning course'}</Text>
                        <Text style={learnerDashboardStyles.courseProvider}>
                          {featuredEnrollment.course?.provider?.name ?? 'Provider details unavailable'}
                        </Text>
                        <View style={learnerDashboardStyles.progressHeading}>
                          <Text style={learnerDashboardStyles.meta}>Progress</Text>
                          <Text style={learnerDashboardStyles.meta}>
                            {featuredEnrollment.status === 'Enrolled (demo)'
                              ? `${progressByEnrollment.get(featuredEnrollment.id)?.progressPercent ?? 0}%`
                              : featuredEnrollment.status}
                          </Text>
                        </View>
                        <View style={learnerDashboardStyles.progressTrack}>
                          <View style={[
                            learnerDashboardStyles.progressFill,
                            { width: `${featuredEnrollment.status === 'Enrolled (demo)' ? progressByEnrollment.get(featuredEnrollment.id)?.progressPercent ?? 0 : 0}%` },
                          ]} />
                        </View>
                      </Pressable>
                    ) : (
                      <View style={learnerDashboardStyles.emptyCard}>
                        <Text style={learnerDashboardStyles.cardHeading}>Continue Learning</Text>
                        <Text style={learnerDashboardStyles.meta}>You have no active course enrolments yet.</Text>
                        <Pressable accessibilityRole="button" onPress={() => router.push('/learning')} style={learnerDashboardStyles.actionButton}>
                          <Text style={learnerDashboardStyles.actionButtonText}>Browse courses</Text>
                        </Pressable>
                      </View>
                    )}
                    <View style={learnerDashboardStyles.coursesCard}>
                      <View style={learnerDashboardStyles.sectionHeading}>
                        <Text style={learnerDashboardStyles.cardHeading}>My Courses</Text>
                        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/learning', params: { section: 'My learning' } })}>
                          <Text style={learnerDashboardStyles.link}>View all</Text>
                        </Pressable>
                      </View>
                      {activeEnrollments.length ? activeEnrollments.map((entry) => {
                        const courseProgress = progressByEnrollment.get(entry.id);
                        const percent = entry.status === 'Enrolled (demo)' ? courseProgress?.progressPercent ?? 0 : 0;
                        return (
                          <Pressable
                            key={entry.id}
                            accessibilityRole="button"
                            onPress={() => router.push({ pathname: '/learning', params: { courseId: entry.courseId } })}
                            style={learnerDashboardStyles.courseRow}
                          >
                            <View style={learnerDashboardStyles.courseIcon}>
                              <Ionicons name="book-outline" size={18} color={palette.primary} />
                            </View>
                            <View style={learnerDashboardStyles.courseRowCopy}>
                              <Text numberOfLines={1} style={learnerDashboardStyles.courseRowName}>{entry.course?.title ?? 'Learning course'}</Text>
                              <View style={learnerDashboardStyles.progressTrack}>
                                <View style={[learnerDashboardStyles.progressFill, { width: `${percent}%` }]} />
                              </View>
                            </View>
                            <Text style={learnerDashboardStyles.meta}>
                              {entry.status === 'Enrolled (demo)' ? `${percent}%` : entry.status}
                            </Text>
                          </Pressable>
                        );
                      }) : (
                        <Text style={learnerDashboardStyles.meta}>Enrolled courses will appear here.</Text>
                      )}
                    </View>
                  </View>
                  <View style={learnerDashboardStyles.activityCard}>
                    <Text style={learnerDashboardStyles.cardHeading}>Recent Activity</Text>
                    {recentActivity.length ? recentActivity.map((item) => (
                      <View key={item.id} style={learnerDashboardStyles.activityItem}>
                        <Ionicons name="checkmark-circle-outline" size={17} color={palette.primary} />
                        <View style={learnerDashboardStyles.activityCopy}>
                          <Text style={learnerDashboardStyles.activityTitle}>{item.detail}</Text>
                          <Text numberOfLines={2} style={learnerDashboardStyles.meta}>{item.title}</Text>
                        </View>
                      </View>
                    )) : (
                      <Text style={learnerDashboardStyles.meta}>Course and guide activity will appear here when you start learning.</Text>
                    )}
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

function PassportSummaryCard() {
  const [summary, setSummary] = useState<{ skills: number; certificates: number; qualifications: number } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<{ skills: number; certificates: number; qualifications: number }>('/passport/me/summary')
      .then((payload) => {
        if (active) setSummary(payload);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => { active = false; };
  }, []);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/passport')}
      style={styles.latestCard}
    >
      <View style={styles.latestIcon}>
        <Ionicons name="id-card-outline" size={18} color={palette.primary} />
      </View>
      <View style={styles.latestText}>
        <Text style={styles.latestTitle}>AgriSkills Passport</Text>
        <Text style={styles.latestDescription}>
          {error
            ? 'Summary unavailable. Open your Passport to try again.'
            : summary
              ? `${summary.skills} skills · ${summary.qualifications} qualifications · ${summary.certificates} credentials`
              : 'Loading your skills and credentials...'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={palette.muted} />
    </Pressable>
  );
}

function DashboardPanel({
  icon,
  title,
  action,
  onPress,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  action: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={learnerDashboardStyles.panel}>
      <View style={learnerDashboardStyles.panelHeader}>
        <View style={learnerDashboardStyles.panelHeading}>
          <Ionicons name={icon} size={16} color={palette.primary} />
          <Text style={learnerDashboardStyles.cardHeading}>{title}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onPress}><Text style={learnerDashboardStyles.panelAction}>{action}</Text></Pressable>
      </View>
      {children}
    </View>
  );
}

function LearnerMetric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number }) {
  return (
    <View style={learnerDashboardStyles.metricCard}>
      <View style={learnerDashboardStyles.metricTop}>
        <Text style={learnerDashboardStyles.metricLabel}>{label}</Text>
        <Ionicons name={icon} size={16} color={palette.muted} />
      </View>
      <Text style={learnerDashboardStyles.metricValue}>{value}</Text>
    </View>
  );
}

const learnerDashboardStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FC' },
  shell: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
  topbar: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8ECEF', paddingHorizontal: 20, gap: 18 },
  topbarSearch: { flex: 1, maxWidth: 520, minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F4F7F5', borderRadius: 18, paddingHorizontal: 14 },
  topbarSearchText: { color: '#8A958F', fontSize: 11 },
  topbarRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topbarProfile: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  topbarAvatar: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#E3F1E6' },
  topbarAvatarText: { color: palette.primaryDark, fontSize: 12, fontWeight: '800' },
  topbarName: { color: '#1C2A22', fontSize: 11, fontWeight: '700' },
  topbarLabel: { color: '#39443E', fontSize: 11 },
  content: { width: '100%', maxWidth: 1160, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 24, paddingBottom: 40 },
  welcomeBanner: { minHeight: 180, overflow: 'hidden', justifyContent: 'flex-end', borderRadius: 10, backgroundColor: '#0B3B20' },
  welcomeShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5, 48, 25, 0.6)' },
  welcomeCopy: { padding: 24 },
  welcomeEyebrow: { color: '#D9B95B', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heading: { color: '#14201B', fontSize: 24, lineHeight: 31, fontWeight: '800' },
  subheading: { color: palette.muted, fontSize: 14, marginTop: 4 },
  loader: { marginTop: 42 },
  errorCard: { backgroundColor: '#F8E8E6', borderRadius: 8, padding: 16, marginTop: 22 },
  errorText: { color: palette.danger, fontSize: 13 },
  metrics: { flexDirection: 'row', gap: 12, marginTop: 26 },
  metricCard: { flex: 1, minWidth: 0, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E5E8', borderRadius: 4, padding: 14 },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  metricLabel: { color: palette.muted, fontSize: 10, textTransform: 'uppercase' },
  metricValue: { color: '#101714', fontSize: 21, fontWeight: '800', marginTop: 5 },
  referencePanels: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 },
  panel: { flex: 1, minWidth: 210, minHeight: 128, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E5E8', borderRadius: 8, padding: 14 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  panelHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  panelAction: { color: palette.primary, fontSize: 10, fontWeight: '800' },
  panelTitle: { color: '#18211D', fontSize: 12, fontWeight: '800', lineHeight: 17 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 20, marginTop: 26 },
  primaryColumn: { flex: 1, minWidth: 0, gap: 14 },
  featuredCourse: { backgroundColor: '#FFFFFF', borderLeftWidth: 2, borderLeftColor: palette.primary, borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopColor: '#E1E5E8', borderRightColor: '#E1E5E8', borderBottomColor: '#E1E5E8', padding: 18 },
  featuredEyebrow: { alignSelf: 'flex-start', color: palette.primaryDark, backgroundColor: '#E8F0FF', borderRadius: 4, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '800' },
  courseName: { color: '#14201B', fontSize: 15, fontWeight: '800', marginTop: 10 },
  courseProvider: { color: palette.muted, fontSize: 12, marginTop: 4 },
  progressHeading: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  meta: { color: palette.muted, fontSize: 10, lineHeight: 15 },
  progressTrack: { height: 7, overflow: 'hidden', backgroundColor: '#E9ECEF', borderRadius: 5, marginTop: 5 },
  progressFill: { height: '100%', backgroundColor: '#0759C7', borderRadius: 5 },
  coursesCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E5E8', borderRadius: 4, padding: 18 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardHeading: { color: '#14201B', fontSize: 14, fontWeight: '800' },
  link: { color: '#111A15', fontSize: 11, fontWeight: '700' },
  courseRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderTopColor: '#F0F2F4', paddingVertical: 8 },
  courseIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#EAF2FE' },
  courseRowCopy: { flex: 1, minWidth: 0 },
  courseRowName: { color: '#18211D', fontSize: 12, fontWeight: '700' },
  activityCard: { width: 300, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E5E8', borderRadius: 4, padding: 18 },
  activityItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 15 },
  activityCopy: { flex: 1, minWidth: 0 },
  activityTitle: { color: '#18211D', fontSize: 11, fontWeight: '700' },
  emptyCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E5E8', borderRadius: 4, padding: 18 },
  actionButton: { alignSelf: 'flex-start', backgroundColor: palette.primary, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 9, marginTop: 12 },
  actionButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});

function getQuickActions(role: string): QuickAction[] {
  const services = () => router.push('/services');
  const opportunities = () => router.push('/opportunities');
  const farmerFunding = () => router.push('/farmer-funding');
  const applications = () => router.push('/applications');
  const review = () => router.push('/review');
  const audit = () => router.push('/audit');
  const notifications = () => router.push('/notifications');
  const admin = (section: string) => () => router.push({ pathname: '/admin', params: { section } });
  const learningAdmin = () => router.push({ pathname: '/learning', params: { section: 'Learning administration' } });
  const learnerOpportunities = (category: string) => () => router.push({ pathname: '/opportunities', params: { category } });
  const employerWorkspace = (workspace: string) => () => router.push({ pathname: '/opportunities', params: { workspace } });
  const providerWorkspace = (workspace: string) => () => router.push({ pathname: '/opportunities', params: { workspace } });
  const staffReview = (section: string) => () => router.push({ pathname: '/review', params: { section } });

  const actionsByRole: Record<string, QuickAction[]> = {
    learner: [
      { label: 'Learning & study materials', icon: 'book-outline', tone: 'green', onPress: () => router.push('/learning') },
      { label: 'Bursaries', icon: 'wallet-outline', tone: 'gold', onPress: learnerOpportunities('Bursary') },
      { label: 'Learnerships', icon: 'school-outline', tone: 'blue', onPress: learnerOpportunities('Learnership') },
      { label: 'Funding opportunities', icon: 'cash-outline', tone: 'coral', onPress: learnerOpportunities('Funding') },
      { label: 'Agricultural jobs', icon: 'briefcase-outline', tone: 'coral', onPress: learnerOpportunities('Employment') },
      { label: 'Internships', icon: 'search-outline', tone: 'green', onPress: learnerOpportunities('Internship') },
      { label: 'My AgriSkills Passport', icon: 'id-card-outline', tone: 'gold', onPress: () => router.push('/passport') },
      { label: 'Applications & outcomes', icon: 'document-text-outline', tone: 'blue', onPress: applications },
      { label: 'Opportunity notifications', icon: 'notifications-outline', tone: 'coral', onPress: notifications },
    ],
    farmer: [
      { label: 'Farming resources', icon: 'book-outline', tone: 'green', onPress: () => router.push({ pathname: '/learning', params: { section: 'Resources' } }) },
      { label: 'Markets & prices', icon: 'trending-up-outline', tone: 'gold', onPress: () => router.push('/farmer-market') },
      { label: 'Funding & support', icon: 'wallet-outline', tone: 'blue', onPress: farmerFunding },
      { label: 'AgriMentor', icon: 'people-circle-outline', tone: 'coral', onPress: () => router.push('/farmer-mentors') },
      { label: 'Applications', icon: 'document-text-outline', tone: 'green', onPress: applications },
      { label: 'My farming skills passport', icon: 'id-card-outline', tone: 'blue', onPress: () => router.push('/passport') },
      { label: 'Announcements', icon: 'notifications-outline', tone: 'gold', onPress: notifications },
    ],
    employer: [
      { label: 'Employer profile', icon: 'business-outline', tone: 'green', onPress: () => router.push('/profile') },
      { label: 'Manage opportunities', icon: 'briefcase-outline', tone: 'gold', onPress: employerWorkspace('manage') },
      { label: 'Review applicants', icon: 'people-outline', tone: 'blue', onPress: employerWorkspace('applicants') },
      { label: 'Applicant skills passports', icon: 'id-card-outline', tone: 'coral', onPress: employerWorkspace('passports') },
      { label: 'Funding support', icon: 'wallet-outline', tone: 'coral', onPress: employerWorkspace('funding') },
      { label: 'Application updates', icon: 'notifications-outline', tone: 'green', onPress: notifications },
    ],
    smme: [
      { label: 'Business profile & support', icon: 'business-outline', tone: 'green', onPress: () => router.push('/role-workspace') },
      { label: 'Business opportunities', icon: 'briefcase-outline', tone: 'gold', onPress: opportunities },
      { label: 'Funding & grants', icon: 'wallet-outline', tone: 'blue', onPress: farmerFunding },
      { label: 'Business training', icon: 'school-outline', tone: 'coral', onPress: () => router.push('/learning') },
      { label: 'My applications', icon: 'document-text-outline', tone: 'green', onPress: applications },
      { label: 'Notifications', icon: 'notifications-outline', tone: 'gold', onPress: notifications },
    ],
    sdf: [
      { label: 'Workforce planning', icon: 'people-outline', tone: 'green', onPress: () => router.push({ pathname: '/sdf-workforce', params: { section: 'wsp' } }) },
      { label: 'Programme submissions', icon: 'document-text-outline', tone: 'gold', onPress: opportunities },
      { label: 'Skills resources', icon: 'school-outline', tone: 'blue', onPress: () => router.push({ pathname: '/learning', params: { section: 'Resources' } }) },
      { label: 'Workforce skills information', icon: 'id-card-outline', tone: 'green', onPress: () => router.push({ pathname: '/sdf-workforce', params: { section: 'assessment' } }) },
      { label: 'Submission updates', icon: 'notifications-outline', tone: 'coral', onPress: notifications },
    ],
    training_provider: [
      { label: 'Provider profile', icon: 'business-outline', tone: 'green', onPress: () => router.push({ pathname: '/learning', params: { section: 'Provider tools' } }) },
      { label: 'Programme submissions', icon: 'school-outline', tone: 'gold', onPress: providerWorkspace('submissions') },
      { label: 'Review outcomes', icon: 'checkmark-done-outline', tone: 'blue', onPress: providerWorkspace('outcomes') },
      { label: 'Programme notifications', icon: 'notifications-outline', tone: 'coral', onPress: notifications },
    ],
    assessor: [
      { label: 'Assigned assessments', icon: 'clipboard-outline', tone: 'green', onPress: () => router.push('/role-workspace') },
      { label: 'Assessment criteria & evidence', icon: 'list-outline', tone: 'gold', onPress: () => router.push('/role-workspace') },
      { label: 'Assessment reports', icon: 'document-text-outline', tone: 'blue', onPress: () => router.push('/role-workspace') },
      { label: 'Notifications', icon: 'notifications-outline', tone: 'coral', onPress: notifications },
    ],
    administrator: [
      { label: 'Accounts & status', icon: 'people-outline', tone: 'green', onPress: admin('accounts') },
      { label: 'Stakeholder role requests', icon: 'person-add-outline', tone: 'blue', onPress: admin('roles') },
      { label: 'Review opportunities', icon: 'checkmark-done-outline', tone: 'gold', onPress: () => router.push({ pathname: '/opportunities', params: { workspace: 'review' } }) },
      { label: 'My posted job applicants', icon: 'people-outline', tone: 'coral', onPress: () => router.push({ pathname: '/opportunities', params: { workspace: 'applicants' } }) },
      { label: 'Learning programmes', icon: 'school-outline', tone: 'blue', onPress: learningAdmin },
      { label: 'Review applications', icon: 'clipboard-outline', tone: 'coral', onPress: review },
      { label: 'Passport management', icon: 'id-card-outline', tone: 'blue', onPress: () => router.push('/passport') },
      { label: 'Reports & audit logs', icon: 'stats-chart-outline', tone: 'green', onPress: audit },
      { label: 'Announcements', icon: 'megaphone-outline', tone: 'gold', onPress: admin('announcements') },
      { label: 'Agricultural platform information', icon: 'leaf-outline', tone: 'green', onPress: admin('agricultural-information') },
      { label: 'Permissions & security', icon: 'shield-checkmark-outline', tone: 'coral', onPress: admin('permissions') },
    ],
    internal_staff: [
      { label: 'Application review queue', icon: 'clipboard-outline', tone: 'green', onPress: staffReview('queue') },
      { label: 'Documents & completeness checks', icon: 'document-attach-outline', tone: 'gold', onPress: staffReview('documents') },
      { label: 'Review feedback & information requests', icon: 'chatbox-ellipses-outline', tone: 'blue', onPress: staffReview('feedback') },
      { label: 'Review services & access limits', icon: 'shield-checkmark-outline', tone: 'coral', onPress: services },
    ],
  };

  return actionsByRole[role] ?? actionsByRole.learner;
}

function getQuickActionsDestination(role: string) {
  return getQuickActions(role)[0].onPress;
}

type AdminLearningMetric = { label: string; value: number };
type AdminLearningOverviewData = {
  metrics: AdminLearningMetric[];
  programmes: { id: string; title: string; status: string; enrolmentCount: number }[];
  recentMaterials: { id: string; title: string; programmeType?: string; uploadedAt?: string }[];
};

function AdminLearningOverview() {
  const [data, setData] = useState<AdminLearningOverviewData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    apiFetch<AdminLearningOverviewData>('/learning/admin/dashboard')
      .then((payload) => {
        if (!Array.isArray(payload.metrics) || !Array.isArray(payload.programmes) || !Array.isArray(payload.recentMaterials)) {
          throw new Error('The learning dashboard returned incomplete data.');
        }
        if (active) {
          setData(payload);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Learning programme data could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [retry]);

  const openLearningAdmin = () =>
    router.push({ pathname: '/learning', params: { section: 'Learning administration' } });
  const metrics = data?.metrics ?? [];

  return (
    <View style={styles.adminLearningPanel}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>AGRILEARN</Text>
          <Text style={styles.sectionTitle}>Learning programme management</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={openLearningAdmin} style={styles.viewAll}>
          <Text style={styles.viewAllText}>Manage</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator color={palette.primary} style={styles.adminLearningLoading} />
      ) : error ? (
        <View style={styles.adminLearningError}>
          <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setLoading(true);
              setRetry((current) => current + 1);
            }}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.adminLearningMetricGrid}>
            {metrics.map((metric) => (
              <View key={metric.label} style={styles.adminLearningMetricCard}>
                <Text style={styles.adminLearningMetricValue}>{metric.value}</Text>
                <Text style={styles.adminLearningMetricLabel}>{metric.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.adminLearningActions}>
            <Pressable accessibilityRole="button" onPress={openLearningAdmin} style={styles.adminLearningPrimary}>
              <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.adminLearningPrimaryText}>Create or manage programme</Text>
            </Pressable>
          </View>
          <Text style={styles.adminLearningSubheading}>Recently published materials</Text>
          {data?.recentMaterials.length ? data.recentMaterials.slice(0, 3).map((material) => (
            <View key={material.id} style={styles.adminLearningRecent}>
              <Ionicons name="document-text-outline" size={17} color={palette.primary} />
              <View style={styles.adminLearningRecentText}>
                <Text style={styles.latestTitle}>{material.title}</Text>
                <Text style={styles.latestDescription}>
                  {material.programmeType || 'Learning material'}
                  {material.uploadedAt ? ` · ${new Date(material.uploadedAt).toLocaleDateString()}` : ''}
                </Text>
              </View>
            </View>
          )) : (
            <Text style={styles.latestDescription}>No programme materials have been published yet.</Text>
          )}
        </>
      )}
    </View>
  );
}

function getRoleIcon(role: string): keyof typeof Ionicons.glyphMap {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    learner: 'school-outline',
    farmer: 'leaf-outline',
    employer: 'business-outline',
    sdf: 'document-text-outline',
    training_provider: 'people-outline',
    administrator: 'shield-checkmark-outline',
    internal_staff: 'clipboard-outline',
  };
  return icons[role] ?? 'leaf-outline';
}

function getFeatureAction(role: string) {
  if (role === 'administrator') return 'Manage your platform';
  if (role === 'internal_staff') return 'Open your review queue';
  if (role === 'farmer') return 'Explore farming services';
  if (role === 'employer') return 'Explore employer services';
  if (role === 'sdf') return 'Explore skills services';
  if (role === 'training_provider') return 'Explore provider services';
  return 'Continue your learning journey';
}

function getSectionRoute(title: string): (() => void) | undefined {
  const normalized = title.toLowerCase();
  if (normalized.includes('review queue')) return () => router.push('/review');
  if (normalized.includes('audit') || normalized.includes('administrative activity')) return () => router.push('/audit');
  if (normalized.includes('application') || normalized.includes('submission')) return () => router.push('/applications');
  if (normalized.includes('opportunit')) return () => router.push('/opportunities');
  if (normalized.includes('service')) return () => router.push('/services');
  return undefined;
}

function getLatestItemRoute(title: string, item: DashboardItem): (() => void) | undefined {
  const normalized = title.toLowerCase();
  if (normalized.includes('review queue')) return () => router.push('/review');
  if (normalized.includes('audit') || normalized.includes('administrative activity')) return () => router.push('/audit');
  if (normalized.includes('application') || normalized.includes('submission')) return () => router.push('/applications');
  if (normalized.includes('opportunit')) {
    return () => router.push({ pathname: '/opportunity', params: { id: item.id } });
  }
  if (normalized.includes('service')) {
    return () => router.push({ pathname: '/service', params: { id: item.id } });
  }
  return undefined;
}

function getLatestIcon(title: string): keyof typeof Ionicons.glyphMap {
  const normalized = title.toLowerCase();
  if (normalized.includes('review')) return 'clipboard-outline';
  if (normalized.includes('audit') || normalized.includes('activity')) return 'document-text-outline';
  if (normalized.includes('application') || normalized.includes('submission')) return 'reader-outline';
  if (normalized.includes('service')) return 'grid-outline';
  return 'sparkles-outline';
}

function QuickActionCard({ action }: { action: QuickAction }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={action.onPress}
      style={({ pressed }) => [styles.actionCard, pressed && styles.cardPressed]}
    >
      <View style={[styles.actionIcon, styles[`actionIcon_${action.tone}`]]}>
        <Ionicons name={action.icon} size={19} color={styles[`actionColor_${action.tone}`].color} />
      </View>
      <View style={styles.actionFooter}>
        <Text style={styles.actionLabel}>{action.label}</Text>
        <Ionicons name="arrow-forward" size={15} color={palette.muted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F8F5' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 32 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 27 },
  brand: { flexDirection: 'row', alignItems: 'center' },
  brandMark: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  brandName: { color: palette.text, fontSize: 14, marginLeft: 8, fontWeight: '500' },
  brandStrong: { fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8EFEB' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  eyebrow: { color: palette.primary, fontWeight: '800', fontSize: 9, letterSpacing: 1.1, marginBottom: 8 },
  heading: { fontSize: 21, lineHeight: 27, fontWeight: '600', color: '#16231D' },
  subheading: { color: '#7A8981', fontSize: 11, lineHeight: 17, marginTop: 5 },
  featureCard: {
    backgroundColor: '#064632',
    borderRadius: 19,
    padding: 15,
    marginTop: 16,
    shadowColor: '#113F2E',
    shadowOpacity: 0.18,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  featurePressed: { opacity: 0.9 },
  featureHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featureIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#F0D278', alignItems: 'center', justifyContent: 'center' },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#75D89E' },
  liveText: { color: '#D5E9DF', fontSize: 8, textTransform: 'capitalize' },
  featureEyebrow: { color: '#D0E6DA', fontSize: 8, fontWeight: '600', marginTop: 14 },
  featureValue: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 3, lineHeight: 32 },
  featureLabel: { color: '#DBEBE2', fontSize: 9, marginTop: 1 },
  featureDivider: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 11 },
  featureAction: { flexDirection: 'row', alignItems: 'center', marginTop: 11, gap: 7 },
  featureActionText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  sectionEyebrow: { color: palette.primary, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  sectionTitle: { color: '#17251E', fontSize: 15, fontWeight: '700', marginTop: 3 },
  viewAll: { paddingHorizontal: 2, paddingVertical: 5 },
  viewAllText: { color: palette.primary, fontSize: 9, fontWeight: '700' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  actionCard: {
    width: '48.5%',
    minHeight: 83,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 9,
    borderWidth: 1,
    borderColor: '#E9EFEB',
    justifyContent: 'space-between',
  },
  actionIcon: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  actionIcon_green: { backgroundColor: '#DDEFE6' },
  actionIcon_gold: { backgroundColor: '#FBF1D8' },
  actionIcon_blue: { backgroundColor: '#E2EFF8' },
  actionIcon_coral: { backgroundColor: '#F9E8E0' },
  actionColor_green: { color: palette.primary },
  actionColor_gold: { color: '#A87912' },
  actionColor_blue: { color: '#39749A' },
  actionColor_coral: { color: '#B65E3E' },
  actionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 },
  actionLabel: { color: '#24352C', fontSize: 9, fontWeight: '600' },
  latestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9EFEB',
    padding: 10,
    marginBottom: 8,
  },
  latestIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#E3F0E9', alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  adminLearningPanel: { marginTop: 22, padding: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5ECE7', borderRadius: 15 },
  adminLearningLoading: { marginVertical: 22 },
  adminLearningError: { alignItems: 'center', paddingVertical: 12 },
  adminLearningMetricGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginTop: 3 },
  adminLearningMetricCard: { width: '31.5%', minHeight: 65, justifyContent: 'center', backgroundColor: '#F3F8F5', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8 },
  adminLearningMetricValue: { color: palette.primary, fontSize: 18, fontWeight: '800' },
  adminLearningMetricLabel: { color: palette.muted, fontSize: 8, lineHeight: 12, marginTop: 3 },
  adminLearningActions: { gap: 7, marginTop: 12 },
  adminLearningPrimary: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: palette.primary, borderRadius: 9, paddingHorizontal: 10 },
  adminLearningPrimaryText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  adminLearningSubheading: { color: palette.text, fontSize: 10, fontWeight: '800', marginTop: 14, marginBottom: 5 },
  adminLearningRecent: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  adminLearningRecentText: { flex: 1 },
  latestText: { flex: 1, marginRight: 8 },
  latestTitle: { color: palette.text, fontSize: 10, fontWeight: '700' },
  latestDescription: { flex: 1, color: palette.muted, fontSize: 9, lineHeight: 14 },
  cardPressed: { opacity: 0.75 },
  errorCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, marginTop: 20, padding: 18 },
  errorText: { color: palette.danger, lineHeight: 19, textAlign: 'center', fontSize: 12, marginTop: 9 },
  retryButton: { backgroundColor: palette.primary, borderRadius: 9, paddingHorizontal: 18, paddingVertical: 10, marginTop: 12 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
});
