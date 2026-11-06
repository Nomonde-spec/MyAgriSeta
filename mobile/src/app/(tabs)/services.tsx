import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type Service = {
  id: string;
};

type DirectoryService = {
  id: string;
  title: string;
  description: string;
  category: Exclude<ServiceFilter, 'All services'>;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  background: string;
  sourceId: string;
  status: string;
  searchTerms: string;
  destination:
    | { type: 'learning'; section?: string }
    | { type: 'opportunities'; category?: string }
    | { type: 'service'; id: string }
    | { type: 'passport' }
    | { type: 'notice'; title: string; message: string };
};

const serviceFilters = ['All services', 'Learning', 'Funding', 'Work'] as const;
type ServiceFilter = typeof serviceFilters[number];

const directoryServices: DirectoryService[] = [
  {
    id: 'learning-programmes',
    title: 'Learning Programmes',
    description: 'Browse agricultural learning and course listings.',
    category: 'Learning',
    icon: 'book-outline',
    color: '#347A5A',
    background: '#E2F2E9',
    sourceId: 'svc-learn',
    status: 'Demo listings · accreditation not verified',
    searchTerms: 'courses training accredited',
    destination: { type: 'learning' },
  },
  {
    id: 'bursaries-funding',
    title: 'Bursaries & Funding',
    description: 'Search agricultural funding listings and track an application within the app.',
    category: 'Funding',
    icon: 'wallet-outline',
    color: '#A47A20',
    background: '#FBF1D8',
    sourceId: 'svc-2',
    status: 'Sample listings · in-app tracking only',
    searchTerms: 'bursary funding learnership',
    destination: { type: 'opportunities', category: 'Funding' },
  },
  {
    id: 'workplace-experience',
    title: 'Workplace Experience',
    description: 'Explore work placement and internship opportunities.',
    category: 'Work',
    icon: 'briefcase-outline',
    color: '#4385A8',
    background: '#E3F0F7',
    sourceId: 'svc-opportunity',
    status: 'Browse published listings · availability varies',
    searchTerms: 'internship placement workplace experience',
    destination: { type: 'opportunities', category: 'Employment' },
  },
  {
    id: 'agrijobs',
    title: 'AgriJobs',
    description: 'Explore sample and published agricultural job opportunities.',
    category: 'Work',
    icon: 'search-outline',
    color: '#BD704D',
    background: '#F9E9E1',
    sourceId: 'svc-opportunity',
    status: 'Sample entries are not real vacancies',
    searchTerms: 'jobs employment work',
    destination: { type: 'opportunities', category: 'Employment' },
  },
  {
    id: 'provider-directory',
    title: 'Provider Directory',
    description: 'Browse training-provider records and programme listings.',
    category: 'Learning',
    icon: 'business-outline',
    color: '#8065A7',
    background: '#EEE8F6',
    sourceId: 'svc-provider',
    status: 'Demo records · providers are not verified',
    searchTerms: 'provider directory accredited training',
    destination: { type: 'learning', section: 'Providers' },
  },
  {
    id: 'career-pathways',
    title: 'Career Pathways',
    description: 'Explore career and mentorship information for agriculture.',
    category: 'Learning',
    icon: 'map-outline',
    color: '#738A35',
    background: '#EEF2DC',
    sourceId: 'svc-mentor',
    status: 'Prototype information · no mentor matching',
    searchTerms: 'career pathway mentor guidance',
    destination: { type: 'service', id: 'svc-mentor' },
  },
  {
    id: 'skills-passport',
    title: 'Skills Passport',
    description: 'View and manage your self-reported skills and credential records.',
    category: 'Learning',
    icon: 'id-card-outline',
    color: '#347A5A',
    background: '#E2F2E9',
    sourceId: 'svc-passport',
    status: 'Self-reported skills · no trusted issuer connected',
    searchTerms: 'skills credentials qualification passport',
    destination: { type: 'passport' },
  },
  {
    id: 'grant-applications',
    title: 'Grant Applications',
    description: 'Browse grant-related listings and funding information.',
    category: 'Funding',
    icon: 'document-text-outline',
    color: '#A47A20',
    background: '#FBF1D8',
    sourceId: 'svc-2',
    status: 'No grant application service is connected',
    searchTerms: 'grant application discretionary funding',
    destination: { type: 'opportunities', category: 'Grants' },
  },
  {
    id: 'employer-services',
    title: 'Employer Services',
    description: 'Explore workforce-development information for employers.',
    category: 'Work',
    icon: 'people-outline',
    color: '#4385A8',
    background: '#E3F0F7',
    sourceId: 'svc-employer',
    status: 'Prototype information · employer systems not connected',
    searchTerms: 'employer workforce services',
    destination: {
      type: 'notice',
      title: 'Skills Planning',
      message: 'WSP and ATR submission is not connected in this prototype.',
    },
  },
  {
    id: 'skills-planning',
    title: 'Skills Planning',
    description: 'Explore skills-planning information for agricultural workplaces.',
    category: 'Work',
    icon: 'bar-chart-outline',
    color: '#BD704D',
    background: '#F9E9E1',
    sourceId: 'svc-employer',
    status: 'Prototype · WSP/ATR submission is not connected',
    searchTerms: 'skills planning WSP ATR',
    destination: { type: 'service', id: 'svc-employer' },
  },
  {
    id: 'support-centre',
    title: 'Support Centre',
    description: 'Get account-help information and platform guidance.',
    category: 'Work',
    icon: 'heart-outline',
    color: '#8065A7',
    background: '#EEE8F6',
    sourceId: 'svc-intel',
    status: 'Prototype · support contact channel not connected',
    searchTerms: 'support help contact assistance',
    destination: {
      type: 'notice',
      title: 'Support Centre',
      message: 'A support contact channel is not connected in this prototype. Please contact your platform administrator for account help.',
    },
  },
];

export default function ServicesScreen() {
  const { session } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ServiceFilter>('All services');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    apiFetch<{ services: Service[] }>('/services')
      .then((payload) => {
        if (isCurrent) {
          setServices(payload.services);
          setErrorMessage('');
        }
      })
      .catch(() => {
        if (isCurrent) {
          setErrorMessage('Services could not be loaded. Check your connection and try again.');
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [session, retry]);

  const filtered = useMemo(
    () => {
      const availableIds = new Set(services.map((service) => service.id));
      const query = search.trim().toLowerCase();
      return directoryServices.filter((service) => {
        const roleCanAccess = availableIds.has(service.sourceId);
        const matchesSearch = !query ||
          `${service.title} ${service.description} ${service.searchTerms}`.toLowerCase().includes(query);
        const matchesFilter = activeFilter === 'All services' || service.category === activeFilter;
        return roleCanAccess && matchesSearch && matchesFilter;
      });
    },
    [activeFilter, search, services]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headingBlock}>
          <Text style={styles.eyebrow}>AGRICONNECT 360</Text>
          <Text style={styles.heading}>Explore services</Text>
          <Text style={styles.subheading}>Everything you need to grow, in one place.</Text>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={palette.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search services"
            placeholderTextColor="#839188"
            style={styles.search}
            accessibilityLabel="Search services"
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear service search"
              onPress={() => setSearch('')}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={palette.muted} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show all services"
              onPress={() => {
                setActiveFilter('All services');
                setSearch('');
              }}
              hitSlop={8}
            >
              <Ionicons name="options-outline" size={18} color={palette.primary} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          style={styles.filterScroll}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          accessibilityLabel="Service categories"
        >
          {serviceFilters.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: item === activeFilter }}
              onPress={() => setActiveFilter(item)}
              style={[styles.filterChip, item === activeFilter && styles.filterChipSelected]}
            >
              <Text style={[styles.filterText, item === activeFilter && styles.filterTextSelected]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator
          persistentScrollbar
          keyboardShouldPersistTaps="handled"
        >
          {errorMessage ? (
            <View style={styles.emptyState}>
              <Ionicons name="cloud-offline-outline" size={28} color={palette.danger} />
              <Text style={styles.empty}>{errorMessage}</Text>
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
          ) : filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={28} color={palette.muted} />
              <Text style={styles.empty}>No services match your search.</Text>
            </View>
          ) : (
            filtered.map((service) => {
              return (
                <Pressable
                  key={service.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${service.title}. ${service.status}.`}
                  onPress={() => {
                    if (service.destination.type === 'learning') {
                      router.push({
                        pathname: '/learning',
                        params: service.destination.section ? { section: service.destination.section } : {},
                      });
                    } else if (service.destination.type === 'opportunities') {
                      router.push({
                        pathname: '/opportunities',
                        params: service.destination.category ? { category: service.destination.category } : {},
                      });
                    } else if (service.destination.type === 'service') {
                      router.push({ pathname: '/service', params: { id: service.destination.id } });
                    } else if (service.destination.type === 'passport') {
                      router.push('/passport');
                    } else {
                      Alert.alert(service.destination.title, service.destination.message);
                    }
                  }}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: service.background }]}>
                    <Ionicons name={service.icon} size={19} color={service.color} />
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle}>{service.title}</Text>
                    <Text style={styles.cardDescription} numberOfLines={2}>{service.description}</Text>
                    <Text style={styles.status}>{service.status}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color="#93A198" />
                </Pressable>
              );
            })
          )}

          {!errorMessage && (
            <View style={styles.guidanceCard}>
              <View style={styles.guidanceIcon}>
                <Ionicons name="heart-outline" size={18} color={palette.primaryDark} />
              </View>
              <View style={styles.guidanceCopy}>
                <Text style={styles.guidanceTitle}>Not sure where to start?</Text>
                <Text style={styles.guidanceText}>Browse opportunities available to your account.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Browse opportunities"
                onPress={() => router.push('/opportunities')}
                style={styles.guidanceAction}
              >
                <Ionicons name="arrow-forward" size={19} color={palette.primaryDark} />
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  container: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  headingBlock: { marginBottom: spacing.md },
  eyebrow: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 5,
  },
  heading: { fontSize: 27, lineHeight: 33, fontWeight: '800', color: palette.text },
  subheading: { fontSize: 13, lineHeight: 19, color: palette.muted, marginTop: 4 },
  searchWrap: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E5EBE7',
  },
  search: { flex: 1, paddingVertical: spacing.sm, color: palette.text, fontSize: 13 },
  filterScroll: { height: 42, flexGrow: 0, flexShrink: 0 },
  filters: { alignItems: 'center', gap: spacing.xs },
  filterChip: {
    minHeight: 30,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E3EAE5',
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
  },
  filterChipSelected: { backgroundColor: palette.primaryDark, borderColor: palette.primaryDark },
  filterText: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  filterTextSelected: { color: '#FFFFFF' },
  list: { paddingBottom: 96 },
  card: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#E8EEEA',
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  cardPressed: { opacity: 0.78 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { flex: 1 },
  cardTitle: { color: palette.text, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  cardDescription: { color: palette.muted, fontSize: 10, lineHeight: 14, marginTop: 2 },
  status: { color: palette.primaryDark, fontSize: 9, lineHeight: 13, fontWeight: '700', marginTop: 3 },
  emptyState: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  empty: { color: palette.muted, marginTop: spacing.sm, textAlign: 'center', fontSize: 13, lineHeight: 19 },
  retryButton: {
    backgroundColor: palette.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  guidanceCard: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FBF3DB',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  guidanceIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidanceCopy: { flex: 1 },
  guidanceTitle: { color: palette.text, fontSize: 11, fontWeight: '800' },
  guidanceText: { color: palette.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  guidanceAction: { padding: spacing.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
});
