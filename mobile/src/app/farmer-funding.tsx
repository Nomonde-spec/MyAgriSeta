import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/navigation/back-button';
import { useAuth } from '@/context/auth-context';
import { palette, radius, spacing } from '@/theme';

const officialFundingUrl = 'https://www.agriseta.co.za/discretionary-grant-funding/';
const fundingStreams = [
  'Graduate placement',
  'Internships',
  'Bursaries',
  'Artisan development',
  'Skills programmes and short courses',
  'Support to rural structures, including mentorship',
  'Commodity organisations',
  'Adult Education and Training (AET)',
  'Learnerships 18.1 and 18.2',
];

export default function FarmerFundingScreen() {
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const [openingSource, setOpeningSource] = useState(false);
  const wideLayout = width >= 760;

  const openOfficialFunding = async () => {
    if (openingSource) return;
    setOpeningSource(true);
    try {
      await Linking.openURL(officialFundingUrl);
    } catch (error) {
      Alert.alert(
        'Unable to open AgriSETA',
        error instanceof Error ? error.message : 'Please try again or visit agriseta.co.za directly.'
      );
    } finally {
      setOpeningSource(false);
    }
  };

  if (session?.activeRole !== 'farmer') return <Redirect href="/home" />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <View style={styles.page}>
          <BackButton fallbackHref="/farmer" />
          <Text style={styles.eyebrow}>AGRIFUNDING · OFFICIAL INFORMATION</Text>
          <Text style={styles.heading}>Discretionary Grant Funding</Text>
          <Text style={styles.subtitle}>
            AgriSETA’s official funding information for agricultural skills development.
          </Text>

          <View style={[styles.overview, wideLayout && styles.overviewWide]}>
            <Image
              source={require('../../assets/images/farm-hero-farmer.jpg')}
              contentFit="cover"
              accessibilityLabel="Farmer standing in a crop field"
              style={[styles.heroImage, wideLayout && styles.heroImageWide]}
            />
            <View style={[styles.windowCard, wideLayout && styles.windowCardWide]}>
              <View style={styles.windowIcon}>
                <Ionicons name="calendar-outline" size={22} color={palette.primaryDark} />
              </View>
              <Text style={styles.windowLabel}>Published application window</Text>
              <Text style={styles.windowDates}>01 August – 15 September</Text>
              <Text style={styles.windowNote}>
                The official page lists this period without a financial-year label. Check the current cycle and whether applications are open on AgriSETA’s website.
              </Text>
              <Pressable
                accessibilityRole="link"
                disabled={openingSource}
                onPress={() => void openOfficialFunding()}
                style={({ pressed }) => [styles.sourceButton, pressed && styles.pressed, openingSource && styles.disabled]}
              >
                <Text style={styles.sourceButtonText}>{openingSource ? 'Opening source…' : 'Check official funding page'}</Text>
                <Ionicons name="open-outline" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <View style={styles.noticeCard}>
            <View style={styles.noticeIcon}>
              <Ionicons name="alert-circle-outline" size={21} color="#8A5A00" />
            </View>
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>Important: individuals cannot apply directly</Text>
              <Text style={styles.noticeText}>
                AgriSETA states that it does not fund individuals. Learners and recipients apply through the relevant employer or an accredited training provider delivering the training or qualification.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View style={styles.headingIcon}>
                <Ionicons name="leaf-outline" size={19} color={palette.primary} />
              </View>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>Funding programme areas</Text>
                <Text style={styles.sectionDescription}>The official page lists these areas for the discretionary grant window.</Text>
              </View>
            </View>
            <View style={[styles.streamGrid, wideLayout && styles.streamGridWide]}>
              {fundingStreams.map((stream, index) => (
                <View key={stream} style={[styles.streamRow, wideLayout && styles.streamRowWide]}>
                  <View style={styles.streamNumber}>
                    <Text style={styles.streamNumberText}>{String(index + 1).padStart(2, '0')}</Text>
                  </View>
                  <Text style={styles.streamText}>{stream}</Text>
                  <Ionicons name="checkmark-circle-outline" size={18} color={palette.primary} />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.bottomActions}>
            <Text style={styles.bottomTitle}>Looking for other funding opportunities?</Text>
            <Text style={styles.bottomDescription}>
              Browse in-app listings separately. Availability, eligibility, and application instructions depend on each listing; these are not confirmed AgriSETA grants.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/opportunities', params: { category: 'Funding' } })}
              style={({ pressed }) => [styles.listingsButton, pressed && styles.pressed]}
            >
              <Text style={styles.listingsButtonText}>Browse available listings</Text>
              <Ionicons name="arrow-forward" size={17} color={palette.primary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/applications')}
              style={({ pressed }) => [styles.applicationsButton, pressed && styles.pressed]}
            >
              <Ionicons name="document-text-outline" size={17} color="#FFFFFF" />
              <Text style={styles.applicationsButtonText}>Track my applications</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.sourceFooter}>
            <Ionicons name="shield-checkmark-outline" size={17} color={palette.primary} />
            <Text style={styles.sourceFooterText}>
              Source: AgriSETA Discretionary Grants Funding. MyAgriSETA does not accept or submit AgriSETA grant applications.
            </Text>
          </View>
          <Pressable accessibilityRole="link" onPress={() => void openOfficialFunding()} style={styles.sourceLink}>
            <Text style={styles.sourceLinkText}>Open agriseta.co.za</Text>
            <Ionicons name="open-outline" size={15} color={palette.primary} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 100 },
  page: { width: '100%', maxWidth: 1040, alignSelf: 'center' },
  eyebrow: { color: palette.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginTop: spacing.md },
  heading: { color: palette.primaryDark, fontSize: 27, lineHeight: 34, fontWeight: '800', marginTop: 4 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  overview: { gap: spacing.md, marginTop: spacing.lg },
  overviewWide: { flexDirection: 'row', alignItems: 'stretch' },
  heroImage: { width: '100%', height: 210, borderRadius: radius.md, backgroundColor: palette.surfaceAlt },
  heroImageWide: { flex: 1.2, height: 280 },
  windowCard: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  windowCardWide: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  windowIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E6F3EB', alignItems: 'center', justifyContent: 'center' },
  windowLabel: { color: palette.muted, fontSize: 12, fontWeight: '700', marginTop: spacing.sm },
  windowDates: { color: palette.text, fontSize: 20, lineHeight: 27, fontWeight: '800', marginTop: 3 },
  windowNote: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  sourceButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, marginTop: spacing.md, borderRadius: radius.md, backgroundColor: palette.primary },
  sourceButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  noticeCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: '#E9D7AE', borderRadius: radius.md, backgroundColor: '#FBF4E4' },
  noticeIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6E6C3' },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: '#654600', fontSize: 14, lineHeight: 20, fontWeight: '800' },
  noticeText: { color: '#675A41', fontSize: 12, lineHeight: 19, marginTop: 4 },
  section: { padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, backgroundColor: palette.surface },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  headingIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E6F3EB', alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: palette.text, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  sectionDescription: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  streamGrid: { gap: spacing.xs },
  streamGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  streamRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: palette.surfaceAlt },
  streamRowWide: { width: '49%', flexGrow: 1 },
  streamNumber: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#FFFFFF' },
  streamNumberText: { color: palette.primaryDark, fontSize: 10, fontWeight: '800' },
  streamText: { flex: 1, color: palette.text, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  bottomActions: { padding: spacing.md, marginTop: spacing.md, borderRadius: radius.md, backgroundColor: '#EAF3EC' },
  bottomTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  bottomDescription: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  listingsButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: palette.primary, borderRadius: radius.md, backgroundColor: palette.surface },
  listingsButtonText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  applicationsButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: radius.md, backgroundColor: palette.primary },
  applicationsButtonText: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  sourceFooter: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.lg },
  sourceFooterText: { flex: 1, color: palette.muted, fontSize: 11, lineHeight: 16 },
  sourceLink: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sourceLinkText: { color: palette.primary, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.6 },
});
