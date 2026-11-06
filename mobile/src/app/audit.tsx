import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/navigation/back-button';
import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type AuditEntry = {
  id: string;
  user: string;
  action: string;
  timestamp: string;
};

type Report = {
  generatedAt: string;
  period: { from: string | null; to: string | null };
  accounts: { total: number; active: number; inactive: number; byRole: Record<string, number> };
  opportunities: { submittedInPeriod: number; publishedTotal: number; byStatus: Record<string, number>; byCategory: Record<string, number> };
  applications: { submittedInPeriod: number; byStatus: Record<string, number> };
  administrativeActivity: { eventsInPeriod: number; byAction: Record<string, number> };
  privacyNote: string;
};

export default function AuditScreen() {
  const { session } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const [period, setPeriod] = useState<7 | 30 | 90 | 0>(30);
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const to = new Date().toISOString().slice(0, 10);
    const from = period ? new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : '';
    const query = new URLSearchParams({ limit: '200', ...(from ? { from } : {}), to });
    Promise.all([
      apiFetch<{ entries: AuditEntry[] }>(`/admin/audit?${query.toString()}`),
      apiFetch<Report>(`/admin/reports?${new URLSearchParams({ ...(from ? { from } : {}), to }).toString()}`),
    ])
      .then(([auditPayload, reportPayload]) => {
        if (isCurrent) {
          setEntries(auditPayload.entries);
          setReport(reportPayload);
          setErrorMessage('');
        }
      })
      .catch((error) => {
        if (isCurrent) {
          setErrorMessage(error instanceof Error ? error.message : 'Audit history could not be loaded.');
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [session, retry, period]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <BackButton fallbackHref="/home" />
          <View style={styles.center}><ActivityIndicator size="large" color={palette.primary} /></View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <BackButton fallbackHref="/home" />
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator
          persistentScrollbar
        >
          <Text style={styles.heading}>Audit history</Text>
          <Text style={styles.meta}>Generate an aggregate platform activity report for a selected period.</Text>
          <View style={styles.periodChoices}>
            {([
              [7, '7 days'],
              [30, '30 days'],
              [90, '90 days'],
              [0, 'All time'],
            ] as const).map(([days, label]) => (
              <Pressable key={days} accessibilityRole="button" accessibilityState={{ selected: period === days }} onPress={() => setPeriod(days)} style={[styles.periodButton, period === days && styles.selectedPeriod]}>
                <Text style={[styles.periodText, period === days && styles.selectedPeriodText]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {report ? (
            <View style={styles.reportCard}>
              <Text style={styles.reportHeading}>Platform report</Text>
              <Text style={styles.meta}>Generated: {new Date(report.generatedAt).toLocaleString()}</Text>
              <Text style={styles.reportLine}>Accounts: {report.accounts.total} total · {report.accounts.active} active · {report.accounts.inactive} inactive</Text>
              <Text style={styles.meta}>Accounts by role: {formatCounts(report.accounts.byRole)}</Text>
              <Text style={styles.reportLine}>Opportunities: {report.opportunities.submittedInPeriod} submitted in period · {report.opportunities.publishedTotal} currently open</Text>
              <Text style={styles.reportLine}>Applications: {report.applications.submittedInPeriod} submitted in period</Text>
              <Text style={styles.reportLine}>Administrative events: {report.administrativeActivity.eventsInPeriod}</Text>
              <Text style={styles.meta}>Applications by status: {formatCounts(report.applications.byStatus)}</Text>
              <Text style={styles.meta}>Opportunities by status: {formatCounts(report.opportunities.byStatus)}</Text>
              <Text style={styles.meta}>Opportunities by category: {formatCounts(report.opportunities.byCategory)}</Text>
              <Text style={styles.meta}>Administrative activity: {formatCounts(report.administrativeActivity.byAction)}</Text>
              <Text style={styles.meta}>{report.privacyNote}</Text>
            </View>
          ) : null}
        {errorMessage ? (
          <StateMessage message={errorMessage} onRetry={() => { setLoading(true); setRetry((value) => value + 1); }} />
        ) : entries.length === 0 ? (
          <Text style={styles.emptyState}>No audit events are available.</Text>
        ) : (
          entries.map((entry) => (
            <View key={entry.id} style={styles.row}>
              <Text style={styles.action}>{entry.action}</Text>
              <Text style={styles.meta}>{entry.user}</Text>
              <Text style={styles.meta}>{entry.timestamp}</Text>
            </View>
          ))
        )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function StateMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.stateBlock}>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  screen: { flex: 1, padding: spacing.md },
  container: { flexGrow: 1, padding: spacing.xl },
  heading: { color: palette.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.md },
  periodChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  periodButton: { borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  selectedPeriod: { backgroundColor: palette.primary, borderColor: palette.primary },
  periodText: { color: palette.primary, fontWeight: '700' },
  selectedPeriodText: { color: '#FFFFFF' },
  reportCard: { backgroundColor: palette.surface, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md },
  reportHeading: { color: palette.text, fontSize: 18, fontWeight: '800' },
  reportLine: { color: palette.text, marginTop: spacing.sm, lineHeight: 20 },
  row: { backgroundColor: palette.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  action: { color: palette.text, fontSize: 15, fontWeight: '700' },
  meta: { color: palette.muted, fontSize: 12, marginTop: spacing.xs },
  emptyState: { color: palette.muted, marginTop: spacing.lg },
  stateBlock: { alignItems: 'center', marginTop: spacing.xl },
  errorText: { color: palette.danger, textAlign: 'center', lineHeight: 20 },
  retryButton: { backgroundColor: palette.primary, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.md },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
});

function formatCounts(counts: Record<string, number>) {
  const entries = Object.entries(counts);
  return entries.length ? entries.map(([name, count]) => `${name}: ${count}`).join(' · ') : 'None';
}