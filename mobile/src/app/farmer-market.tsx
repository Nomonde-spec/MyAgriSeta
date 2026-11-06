import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/navigation/back-button';
import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type MarketRecord = {
  id: string;
  commodity: string;
  grade: string;
  market: string;
  province: string;
  price: number;
  unit: string;
  observedAt: string;
  sourceName: string;
  sourceUrl: string;
  verifiedAt: string;
  expiresAt: string;
};

export default function FarmerMarketScreen() {
  const { session } = useAuth();
  const [records, setRecords] = useState<MarketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  const openSource = async (url: string) => {
    try {
      const source = new URL(url);
      if (!['http:', 'https:'].includes(source.protocol) || source.username || source.password) {
        throw new Error('This market record does not have a safe source link.');
      }
      await Linking.openURL(source.href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The market source could not be opened.');
    }
  };

  useEffect(() => {
    let active = true;
    apiFetch<{ records: MarketRecord[] }>('/farmer/market')
      .then(({ records: result }) => {
        if (active) {
          setRecords(result);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Market information could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [retry, session]);

  if (session?.activeRole !== 'farmer') return <Redirect href="/home" />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton fallbackHref="/farmer" />
        <Text style={styles.eyebrow}>AGRIMARKET</Text>
        <Text style={styles.heading}>Market information</Text>
        <Text style={styles.subtitle}>
          Prices are shown only when an administrator has recorded a source, checked the information, and set an expiry date. Confirm offers directly before making a decision.
        </Text>

        {loading ? <ActivityIndicator size="large" color={palette.primary} style={styles.loading} /> : null}
        {error ? (
          <View style={styles.notice}>
            <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => { setLoading(true); setRetry((value) => value + 1); }} style={styles.retry}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {!loading && !error && records.length === 0 ? (
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={22} color={palette.primary} />
            <Text style={styles.noticeText}>There are no current, source-checked market records available. No prices or buyer information are fabricated.</Text>
          </View>
        ) : null}
        {records.map((record) => (
          <View key={record.id} style={styles.card}>
            <View style={styles.recordHeading}>
              <Text style={styles.recordTitle}>{record.commodity}</Text>
              <Text style={styles.price}>R {record.price.toLocaleString('en-ZA')} / {record.unit}</Text>
            </View>
            <Text style={styles.detail}>Grade: {record.grade}</Text>
            <Text style={styles.detail}>{record.market} · {record.province}</Text>
            <Text style={styles.meta}>Observed {record.observedAt} · Checked {record.verifiedAt}</Text>
            <Text style={styles.source}>Source: {record.sourceName}</Text>
            <Pressable accessibilityRole="link" onPress={() => void openSource(record.sourceUrl)} style={styles.sourceLink}>
              <Text selectable style={styles.url}>{record.sourceUrl}</Text>
            </Pressable>
            <Text style={styles.meta}>Record expires {record.expiresAt}. Confirm current price and terms with the source.</Text>
          </View>
        ))}
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Use the market-planning guide to compare grade, unit, transport, deductions, and payment terms.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/learning', params: { resourceId: 'resource-market-planning' } })} style={styles.retry}>
            <Text style={styles.retryText}>Open market-planning guide</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F8F5' },
  content: { padding: spacing.md, paddingBottom: 100 },
  eyebrow: { color: palette.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginTop: spacing.md },
  heading: { color: palette.text, fontSize: 26, fontWeight: '800', marginTop: 4 },
  subtitle: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  loading: { marginTop: spacing.xl },
  notice: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E9E3', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  noticeText: { color: palette.text, fontSize: 13, lineHeight: 19, marginTop: 4 },
  error: { color: palette.danger, fontSize: 13 },
  retry: { alignSelf: 'flex-start', marginTop: spacing.sm, paddingVertical: 8 },
  retryText: { color: palette.primary, fontSize: 13, fontWeight: '800' },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E9E3', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  recordHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  recordTitle: { flex: 1, color: palette.text, fontSize: 16, fontWeight: '800' },
  price: { color: palette.primary, fontSize: 15, fontWeight: '800' },
  detail: { color: palette.text, fontSize: 13, marginTop: 8 },
  meta: { color: palette.muted, fontSize: 11, lineHeight: 17, marginTop: 8 },
  source: { color: palette.text, fontSize: 12, fontWeight: '700', marginTop: 10 },
  url: { color: palette.primary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  sourceLink: { alignSelf: 'flex-start' },
});
