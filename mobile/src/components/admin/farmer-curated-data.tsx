import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type MarketRecord = {
  id: string;
  commodity: string;
  market: string;
  price: number;
  unit: string;
  sourceName: string;
  expiresAt: string;
};
type Mentor = { id: string; name: string; expertise: string; status: string };
type MentorRequest = {
  id: string;
  farmerName: string;
  farmerEmail: string;
  mentorName: string;
  message: string;
  status: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyMarket = {
  commodity: '',
  grade: '',
  market: '',
  province: '',
  price: '',
  unit: '',
  observedAt: '',
  sourceName: '',
  sourceUrl: '',
  verifiedAt: today(),
  expiresAt: '',
};
const emptyMentor = {
  name: '',
  province: '',
  expertise: '',
  biography: '',
  contactEmail: '',
  sourceName: '',
  sourceUrl: '',
  verifiedAt: today(),
  expiresAt: '',
};
type MarketField = keyof typeof emptyMarket;
type MentorField = keyof typeof emptyMentor;

export function FarmerCuratedDataManagement() {
  const [marketForm, setMarketForm] = useState(emptyMarket);
  const [mentorForm, setMentorForm] = useState(emptyMentor);
  const [marketRecords, setMarketRecords] = useState<MarketRecord[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [requests, setRequests] = useState<MentorRequest[]>([]);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [consentToShare, setConsentToShare] = useState(false);
  const [consentToList, setConsentToList] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const [marketResult, mentorResult] = await Promise.all([
        apiFetch<{ records: MarketRecord[] }>('/admin/farmer-data/market'),
        apiFetch<{ mentors: Mentor[]; requests: MentorRequest[] }>('/admin/farmer-data/mentors'),
      ]);
      setMarketRecords(marketResult.records);
      setMentors(mentorResult.mentors);
      setRequests(mentorResult.requests);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Farmer directory data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => { void load(); });
    return () => cancelAnimationFrame(frame);
  }, []);

  const saveMarketRecord = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await apiFetch('/admin/farmer-data/market', {
        method: 'POST',
        body: JSON.stringify({ ...marketForm, price: Number(marketForm.price) }),
      });
      setMarketForm({ ...emptyMarket, verifiedAt: today() });
      setMessage('Sourced market record published.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Market record could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const archiveMarketRecord = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/admin/farmer-data/market/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Market record could not be removed.');
    } finally {
      setBusy(false);
    }
  };

  const saveMentor = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await apiFetch('/admin/farmer-data/mentors', {
        method: 'POST',
        body: JSON.stringify({ ...mentorForm, consentToList, consentToShare }),
      });
      setMentorForm({ ...emptyMentor, verifiedAt: today() });
      setConsentToList(false);
      setConsentToShare(false);
      setMessage('Mentor profile added to the verified directory.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Mentor profile could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const archiveMentor = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/admin/farmer-data/mentors/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Mentor profile could not be archived.');
    } finally {
      setBusy(false);
    }
  };

  const reviewRequest = async (request: MentorRequest, status: 'Under Review' | 'Connected' | 'Declined') => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/admin/farmer-data/mentor-requests/${encodeURIComponent(request.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, feedback: feedback[request.id] || '' }),
      });
      await load();
      setMessage(`Request status updated to ${status}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Mentor request could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  const marketField = (key: MarketField, label: string, placeholder: string, keyboardType?: 'default' | 'numeric') => (
    <TextInput
      key={key}
      accessibilityLabel={label}
      value={marketForm[key]}
      onChangeText={(value) => setMarketForm((current) => ({ ...current, [key]: value }))}
      placeholder={placeholder}
      keyboardType={keyboardType || 'default'}
      maxLength={key === 'sourceUrl' ? 500 : 160}
      style={styles.input}
    />
  );
  const mentorField = (key: MentorField, label: string, placeholder: string, multiline = false) => (
    <TextInput
      key={key}
      accessibilityLabel={label}
      value={mentorForm[key]}
      onChangeText={(value) => setMentorForm((current) => ({ ...current, [key]: value }))}
      placeholder={placeholder}
      maxLength={key === 'biography' ? 1000 : key === 'sourceUrl' ? 500 : 240}
      multiline={multiline}
      style={[styles.input, multiline && styles.multiline]}
    />
  );

  return (
    <View style={styles.container}>
      <Text style={styles.section}>Farmer information curation</Text>
      <Text style={styles.hint}>Add only information checked against the named source. Records expire automatically from the farmer view. Mentor contact details are shared only after approval and recorded consent.</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {error ? (
        <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void load(); }} style={styles.textButton}>
          <Text style={styles.textButtonText}>Try loading again</Text>
        </Pressable>
      ) : null}
      {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
      {loading ? <Text style={styles.meta}>Loading curated records…</Text> : null}

      <View style={styles.card}>
        <Text style={styles.subheading}>Add market information</Text>
        <Text style={styles.meta}>Amounts are in South African Rand (ZAR). Use the source&apos;s exact product grade, unit, and observation date.</Text>
        {marketField('commodity', 'Commodity', 'Commodity')}
        {marketField('grade', 'Product grade', 'Grade / quality')}
        {marketField('market', 'Market name', 'Market or exchange')}
        {marketField('province', 'Province', 'Province')}
        {marketField('price', 'Price in ZAR', 'Price in ZAR', 'numeric')}
        {marketField('unit', 'Price unit', 'Unit (for example, per kg)')}
        {marketField('observedAt', 'Observation date', 'Observed date (YYYY-MM-DD)')}
        {marketField('sourceName', 'Market source name', 'Source name')}
        {marketField('sourceUrl', 'Market source URL', 'Source URL (https://...)')}
        {marketField('verifiedAt', 'Verified date', 'Verified date (YYYY-MM-DD)')}
        {marketField('expiresAt', 'Expiry date', 'Expiry date (YYYY-MM-DD)')}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void saveMarketRecord()} style={[styles.button, busy && styles.disabled]}>
          <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Publish sourced market record'}</Text>
        </Pressable>
      </View>
      {marketRecords.map((record) => (
        <View key={record.id} style={styles.item}>
          <Text style={styles.itemTitle}>{record.commodity} · R {record.price.toLocaleString('en-ZA')} / {record.unit}</Text>
          <Text style={styles.meta}>{record.market} · {record.sourceName} · expires {record.expiresAt}</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void archiveMarketRecord(record.id)} style={styles.textButton}>
            <Text style={styles.textButtonText}>Remove record</Text>
          </Pressable>
        </View>
      ))}

      <View style={styles.card}>
        <Text style={styles.subheading}>Add a mentor profile</Text>
        <Text style={styles.meta}>Obtain the mentor&apos;s consent before entry. Their profile is public to signed-in farmers; their email remains private until staff approve an introduction.</Text>
        {mentorField('name', 'Mentor name', 'Full name')}
        {mentorField('province', 'Mentor province', 'Province')}
        {mentorField('expertise', 'Mentor expertise', 'Agricultural expertise')}
        {mentorField('biography', 'Mentor profile summary', 'Profile summary', true)}
        {mentorField('contactEmail', 'Mentor contact email', 'Contact email')}
        {mentorField('sourceName', 'Mentor verification source', 'Verification source')}
        {mentorField('sourceUrl', 'Mentor verification URL', 'Source URL (https://...)')}
        {mentorField('verifiedAt', 'Mentor verified date', 'Verified date (YYYY-MM-DD)')}
        {mentorField('expiresAt', 'Mentor profile expiry', 'Expiry date (YYYY-MM-DD)')}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consentToList }} onPress={() => setConsentToList((current) => !current)} style={styles.consent}>
          <Text style={styles.consentText}>{consentToList ? 'Consent confirmed.' : 'Confirm consent.'} Mentor consents to having their profile shown to signed-in farmers.</Text>
        </Pressable>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consentToShare }} onPress={() => setConsentToShare((current) => !current)} style={styles.consent}>
          <Text style={styles.consentText}>{consentToShare ? 'Consent confirmed.' : 'Confirm consent.'} Mentor consents to sharing contact details after an approved introduction.</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void saveMentor()} style={[styles.button, busy && styles.disabled]}>
          <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Add verified mentor'}</Text>
        </Pressable>
      </View>
      {mentors.map((mentor) => (
        <View key={mentor.id} style={styles.item}>
          <Text style={styles.itemTitle}>{mentor.name} · {mentor.expertise}</Text>
          <Text style={styles.meta}>Directory status: {mentor.status}</Text>
          {mentor.status === 'active' ? (
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void archiveMentor(mentor.id)} style={styles.textButton}>
              <Text style={styles.textButtonText}>Archive profile</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      <Text style={styles.section}>Mentor introduction requests ({requests.length})</Text>
      {requests.length === 0 && !loading ? <Text style={styles.meta}>No mentor requests have been submitted.</Text> : null}
      {requests.map((request) => (
        <View key={request.id} style={styles.item}>
          <Text style={styles.itemTitle}>{request.farmerName} → {request.mentorName}</Text>
          <Text style={styles.meta}>{request.farmerEmail} · {request.status}</Text>
          <Text style={styles.meta}>{request.message}</Text>
          {['Submitted', 'Under Review'].includes(request.status) ? (
            <>
              <TextInput
                accessibilityLabel={`Feedback for ${request.farmerName}'s mentor request`}
                value={feedback[request.id] || ''}
                onChangeText={(value) => setFeedback((current) => ({ ...current, [request.id]: value }))}
                placeholder="Staff feedback (required to decline)"
                maxLength={500}
                style={styles.input}
              />
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => void reviewRequest(request, 'Under Review')} style={styles.smallButton}>
                  <Text style={styles.buttonText}>Reviewing</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => void reviewRequest(request, 'Connected')} style={styles.smallButton}>
                  <Text style={styles.buttonText}>Share introduction</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => void reviewRequest(request, 'Declined')} style={[styles.smallButton, styles.declineButton]}>
                  <Text style={styles.buttonText}>Decline</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.xl },
  section: { color: palette.text, fontSize: 20, fontWeight: '800', marginTop: spacing.lg },
  subheading: { color: palette.text, fontSize: 16, fontWeight: '800' },
  hint: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  card: { backgroundColor: palette.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  input: { minHeight: 44, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 8, marginTop: spacing.sm, color: palette.text },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  meta: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  item: { backgroundColor: palette.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  itemTitle: { color: palette.text, fontSize: 14, fontWeight: '800' },
  button: { minHeight: 44, backgroundColor: palette.primary, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md, paddingHorizontal: spacing.sm },
  smallButton: { flex: 1, minHeight: 40, backgroundColor: palette.primary, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  declineButton: { backgroundColor: palette.danger },
  buttonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  textButton: { alignSelf: 'flex-start', marginTop: spacing.sm, paddingVertical: 7 },
  textButtonText: { color: palette.danger, fontSize: 12, fontWeight: '700' },
  consent: { marginTop: spacing.md },
  consentText: { color: palette.text, fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  error: { color: palette.danger, marginTop: spacing.sm },
  success: { color: palette.primary, marginTop: spacing.sm },
  disabled: { opacity: 0.6 },
});
