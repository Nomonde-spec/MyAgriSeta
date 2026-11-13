import { Ionicons } from '@expo/vector-icons';
import { router, Redirect } from 'expo-router';
import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/navigation/back-button';
import { useAuth } from '@/context/auth-context';
import { palette, radius, spacing } from '@/theme';

type FarmerActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
};

const officialSources = [
  {
    title: 'ARC crop advice and farmer support',
    detail: 'Research, crop support, training and mentoring information.',
    url: 'https://www.arc.agric.za/Pages/Programmes/Crop-Sciences.aspx',
  },
  {
    title: 'NAMC smallholder market access',
    detail: 'Market-access support information; not current commodity prices.',
    url: 'https://www.namc.co.za/markets-and-economic-insights/promoting-market-access/',
  },
  {
    title: 'Land Bank production finance',
    detail: 'Finance product information; eligibility and application status must be confirmed with Land Bank.',
    url: 'https://landbank.co.za/Products-and-Services/Pages/Production%20Revolving%20Facility.aspx',
  },
  {
    title: 'Land Bank Agro Energy Fund',
    detail: 'Information about agricultural alternative-energy finance; confirm current availability and eligibility.',
    url: 'https://landbank.co.za/Products-and-Services/Pages/Agro-Energy-Fund.aspx',
  },
];

function FarmerAction({ icon, title, description, onPress }: FarmerActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={palette.primary} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={palette.muted} />
    </Pressable>
  );
}

export default function FarmerHubScreen() {
  const { session } = useAuth();

  const openOfficialSource = async (url: string) => {
    try {
      const source = new URL(url);
      if (source.protocol !== 'https:' || source.username || source.password) {
        throw new Error('This official source link is not valid.');
      }
      await Linking.openURL(source.href);
    } catch (error) {
      Alert.alert(
        'Unable to open source',
        error instanceof Error ? error.message : 'Please try again or open the source website directly.'
      );
    }
  };

  if (session?.activeRole !== 'farmer') {
    return <Redirect href="/home" />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
        persistentScrollbar
      >
        <BackButton fallbackHref="/home" />
        <Text style={styles.eyebrow}>FARMER SERVICES</Text>
        <Text style={styles.heading}>Your farm hub</Text>
        <Text style={styles.subtitle}>
          Find practical learning, support opportunities, and tools for planning your farm activities.
        </Text>

        <View style={styles.actionList}>
          <FarmerAction
            icon="book-outline"
            title="Advice and resources"
            description="Open in-app guides for crop planning, farm records, and water observations."
            onPress={() => router.push({ pathname: '/learning', params: { section: 'Resources' } })}
          />
          <FarmerAction
            icon="sparkles-outline"
            title="AgriAdvisor AI"
            description="Not available yet: an approved AI provider and agricultural safeguards are not configured."
            onPress={() => Alert.alert(
              'AgriAdvisor AI is not available',
              'An approved AI provider and agricultural safety safeguards have not been configured. Use the source-labelled farming resources instead.'
            )}
          />
          <FarmerAction
            icon="trending-up-outline"
            title="Markets and prices"
            description="View current market information with its source, check date, and expiry."
            onPress={() => router.push('/farmer-market')}
          />
          <FarmerAction
            icon="wallet-outline"
            title="Funding opportunities"
            description="Review official AgriSETA grant information and find other eligible listings."
            onPress={() => router.push('/farmer-funding')}
          />
          <FarmerAction
            icon="business-outline"
            title="AgriSMME business support"
            description="Explore support listings for planning and managing an agricultural operation."
            onPress={() => router.push({ pathname: '/opportunities', params: { category: 'Business Support' } })}
          />
          <FarmerAction
            icon="people-circle-outline"
            title="AgriMentor and my requests"
            description="Browse verified mentor profiles, request an introduction, and track its status."
            onPress={() => router.push('/farmer-mentors')}
          />
          <FarmerAction
            icon="notifications-outline"
            title="Farming announcements"
            description="Review in-app announcements and updates about your applications."
            onPress={() => router.push('/notifications')}
          />
        </View>

        <View style={styles.marketCard}>
          <View style={styles.marketHeading}>
            <View style={styles.marketIcon}>
              <Ionicons name="trending-up-outline" size={18} color={palette.primaryDark} />
            </View>
            <View style={styles.marketTitleBlock}>
              <Text style={styles.marketTitle}>Market planning</Text>
              <Text style={styles.marketTag}>Source-checked records · ZAR</Text>
            </View>
          </View>
          <Text style={styles.marketIntro}>
            Before choosing where or when to sell, compare buyer quotes using the same product grade and price unit:
          </Text>
          <MarketPoint>Confirm the date, market, product grade, and unit for each quoted price.</MarketPoint>
          <MarketPoint>Ask about packaging, transport, commissions, and other costs that affect the amount received.</MarketPoint>
          <MarketPoint>Check buyer requirements and payment terms directly before making a commitment.</MarketPoint>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/farmer-market')}
            style={({ pressed }) => [styles.marketGuideButton, pressed && styles.pressed]}
          >
            <Text style={styles.marketGuideButtonText}>View current market records</Text>
            <Ionicons name="arrow-forward" size={16} color={palette.primary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/learning', params: { resourceId: 'resource-market-planning' } })}
            style={({ pressed }) => [styles.marketGuideButton, pressed && styles.pressed]}
          >
            <Text style={styles.marketGuideButtonText}>Open the market planning guide</Text>
            <Ionicons name="arrow-forward" size={16} color={palette.primary} />
          </Pressable>
        </View>

        <View style={styles.sourcesCard}>
          <Text style={styles.sourcesTitle}>Official external sources</Text>
          <Text style={styles.sourcesIntro}>
            These organisations provide further information. Their websites are not live feeds into MyAgriSETA; confirm availability, eligibility, dates and terms directly with each organisation.
          </Text>
          {officialSources.map((source) => (
            <Pressable
              key={source.title}
              accessibilityRole="link"
              accessibilityLabel={`${source.title}. ${source.detail}`}
              onPress={() => void openOfficialSource(source.url)}
              style={({ pressed }) => [styles.sourceRow, pressed && styles.pressed]}
            >
              <View style={styles.sourceCopy}>
                <Text style={styles.sourceTitle}>{source.title}</Text>
                <Text style={styles.sourceDetail}>{source.detail}</Text>
              </View>
              <Ionicons name="open-outline" size={17} color={palette.primary} />
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/applications')}
          style={({ pressed }) => [styles.applicationsButton, pressed && styles.pressed]}
        >
          <Ionicons name="document-text-outline" size={17} color="#FFFFFF" />
          <Text style={styles.applicationsText}>Track my applications</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function MarketPoint({ children }: { children: string }) {
  return (
    <View style={styles.marketPoint}>
      <Ionicons name="checkmark-circle-outline" size={16} color={palette.primary} />
      <Text style={styles.marketPointText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F8F5' },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 92 },
  eyebrow: { color: palette.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginTop: spacing.md },
  heading: { color: palette.text, fontSize: 26, lineHeight: 32, fontWeight: '800', marginTop: 4 },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  actionList: { gap: 9, marginTop: spacing.lg },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E9E3', borderRadius: radius.md },
  pressed: { opacity: 0.78 },
  actionIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F3EC', borderRadius: 12 },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { color: palette.text, fontSize: 14, fontWeight: '800' },
  actionDescription: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  marketCard: { marginTop: spacing.lg, padding: spacing.md, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E9E3', borderRadius: radius.md },
  marketHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  marketIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBF1D8', borderRadius: 12 },
  marketTitleBlock: { flex: 1 },
  marketTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  marketTag: { color: '#8A681C', fontSize: 10, fontWeight: '700', marginTop: 3 },
  marketIntro: { color: palette.text, fontSize: 13, lineHeight: 19, marginTop: 14 },
  marketPoint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  marketPointText: { flex: 1, color: palette.text, fontSize: 12, lineHeight: 18 },
  disclaimer: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E9EEEA' },
  marketGuideButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 2 },
  marketGuideButtonText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  sourcesCard: { marginTop: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E9E3', borderRadius: radius.md },
  sourcesTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  sourcesIntro: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  sourceRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E9EEEA', marginTop: 8 },
  sourceCopy: { flex: 1 },
  sourceTitle: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  sourceDetail: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  applicationsButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: palette.primary, borderRadius: radius.md, marginTop: spacing.md, paddingHorizontal: spacing.md },
  applicationsText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', flex: 1 },
});
