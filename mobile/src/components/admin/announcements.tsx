import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { apiFetch } from '@/lib/api';
import { palette } from '@/theme';

type Announcement = {
  id: string;
  title: string;
  message: string;
  audience: string[];
  status: 'draft' | 'published' | 'archived';
  startsAt: string | null;
  endsAt: string | null;
};

const audiences = [
  { value: '*', label: 'Everyone' },
  { value: 'learner', label: 'Learners' },
  { value: 'farmer', label: 'Farmers' },
  { value: 'employer', label: 'Employers' },
  { value: 'sdf', label: 'SDFs' },
  { value: 'training_provider', label: 'Providers' },
  { value: 'administrator', label: 'Administrators' },
  { value: 'internal_staff', label: 'Staff' },
];

export function AnnouncementManagement() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [messageText, setMessageText] = useState('');
  const [audience, setAudience] = useState<string[]>(['*']);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const load = useCallback(async () => {
    try {
      const payload = await apiFetch<{ announcements: Announcement[] }>('/admin/announcements');
      setItems(payload.announcements);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Announcements could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { void load(); });
    return () => cancelAnimationFrame(frame);
  }, [load]);

  const reset = () => {
    setEditingId('');
    setTitle('');
    setMessageText('');
    setAudience(['*']);
    setStartsAt('');
    setEndsAt('');
  };

  const edit = (item: Announcement) => {
    setEditingId(item.id);
    setTitle(item.title);
    setMessageText(item.message);
    setAudience(item.audience);
    setStartsAt(item.startsAt || '');
    setEndsAt(item.endsAt || '');
  };

  const save = async (status: Announcement['status']) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      await apiFetch(
        editingId ? `/admin/announcements/${encodeURIComponent(editingId)}` : '/admin/announcements',
        {
          method: editingId ? 'PATCH' : 'POST',
          body: JSON.stringify({ title, message: messageText, audience, status, startsAt, endsAt }),
        }
      );
      setFeedback(status === 'published' ? 'Announcement published.' : status === 'archived' ? 'Announcement archived.' : 'Announcement draft saved.');
      reset();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The announcement could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (item: Announcement, status: Announcement['status']) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      await apiFetch(`/admin/announcements/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: item.title,
          message: item.message,
          audience: item.audience,
          status,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
        }),
      });
      setFeedback(status === 'archived' ? 'Announcement archived.' : 'Announcement published.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Announcement status could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  const toggleAudience = (value: string) => {
    setAudience((current) => {
      if (value === '*') return current.includes('*') ? [] : ['*'];
      const withoutEveryone = current.filter((entry) => entry !== '*');
      return withoutEveryone.includes(value)
        ? withoutEveryone.filter((entry) => entry !== value)
        : [...withoutEveryone, value];
    });
  };

  return (
    <View style={{ marginTop: 24 }}>
      <Text style={{ color: palette.text, fontSize: 20, fontWeight: '800' }}>Announcements and system information</Text>
      <Text style={{ color: palette.muted, lineHeight: 20, marginTop: 6 }}>
        In-app announcements are audience-targeted. Publishing does not send email or SMS.
      </Text>
      {error ? <Text accessibilityRole="alert" style={{ color: palette.danger, marginTop: 8 }}>{error}</Text> : null}
      {feedback ? <Text accessibilityRole="alert" style={{ color: palette.primary, marginTop: 8 }}>{feedback}</Text> : null}

      <View style={{ backgroundColor: palette.surface, borderRadius: 16, padding: 16, marginTop: 14 }}>
        <Text style={{ color: palette.text, fontWeight: '700', marginBottom: 8 }}>{editingId ? 'Edit announcement' : 'Create announcement'}</Text>
        <TextInput accessibilityLabel="Announcement title" value={title} onChangeText={setTitle} placeholder="Title" maxLength={120} style={fieldStyle} />
        <TextInput accessibilityLabel="Announcement message" value={messageText} onChangeText={setMessageText} placeholder="Message" multiline maxLength={2000} style={[fieldStyle, { minHeight: 90, textAlignVertical: 'top' }]} />
        <Text style={{ color: palette.muted, marginVertical: 8 }}>Audience</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {audiences.map((item) => {
            const selected = audience.includes(item.value);
            return (
              <Pressable key={item.value} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleAudience(item.value)} style={[chipStyle, selected && { backgroundColor: palette.primary }]}>
                <Text style={{ color: selected ? '#FFFFFF' : palette.text, fontSize: 12, fontWeight: '700' }}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput accessibilityLabel="Announcement start time" value={startsAt} onChangeText={setStartsAt} placeholder="Optional start date/time (ISO format)" style={fieldStyle} />
        <TextInput accessibilityLabel="Announcement end time" value={endsAt} onChangeText={setEndsAt} placeholder="Optional end date/time (ISO format)" style={fieldStyle} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save('draft')} style={buttonStyle}>
            <Text style={buttonText}>{busy ? 'Saving…' : 'Save draft'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save('published')} style={[buttonStyle, { backgroundColor: palette.primary }]}>
            <Text style={[buttonText, { color: '#FFFFFF' }]}>{busy ? 'Saving…' : 'Publish'}</Text>
          </Pressable>
          {editingId ? (
            <Pressable accessibilityRole="button" disabled={busy} onPress={reset} style={buttonStyle}>
              <Text style={buttonText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text style={{ color: palette.text, fontSize: 17, fontWeight: '800', marginTop: 20 }}>Managed announcements</Text>
      {loading ? <ActivityIndicator color={palette.primary} style={{ marginTop: 16 }} /> : items.length === 0 ? (
        <Text style={{ color: palette.muted, marginTop: 10 }}>No announcements have been created.</Text>
      ) : items.map((item) => (
        <View key={item.id} style={{ backgroundColor: palette.surface, borderRadius: 14, padding: 14, marginTop: 10 }}>
          <Text style={{ color: palette.text, fontWeight: '800' }}>{item.title} · {item.status}</Text>
          <Text style={{ color: palette.muted, marginTop: 6 }}>{item.message}</Text>
          <Text style={{ color: palette.muted, fontSize: 12, marginTop: 6 }}>
            Audience: {item.audience.includes('*') ? 'Everyone' : item.audience.join(', ')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <Pressable accessibilityRole="button" onPress={() => edit(item)} style={buttonStyle}>
              <Text style={buttonText}>Edit</Text>
            </Pressable>
            {item.status === 'draft' ? (
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void updateStatus(item, 'published')} style={[buttonStyle, { backgroundColor: palette.primary }]}>
                <Text style={[buttonText, { color: '#FFFFFF' }]}>Publish</Text>
              </Pressable>
            ) : null}
            {item.status !== 'archived' ? (
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void updateStatus(item, 'archived')} style={buttonStyle}>
                <Text style={buttonText}>Archive</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const fieldStyle = {
  color: palette.text,
  backgroundColor: '#FFFFFF',
  borderColor: palette.border,
  borderWidth: 1,
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  marginBottom: 8,
};
const chipStyle = {
  borderColor: palette.border,
  borderWidth: 1,
  borderRadius: 18,
  paddingHorizontal: 12,
  paddingVertical: 8,
  backgroundColor: '#FFFFFF',
};
const buttonStyle = {
  borderColor: palette.border,
  borderWidth: 1,
  borderRadius: 10,
  paddingHorizontal: 14,
  paddingVertical: 10,
  backgroundColor: '#FFFFFF',
};
const buttonText = { color: palette.primary, fontWeight: '700' as const };
