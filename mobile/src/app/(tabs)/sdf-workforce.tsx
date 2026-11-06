import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';
import { palette, radius, spacing } from '@/theme';

type RecordType = 'assessment' | 'wsp' | 'atr' | 'training';
type WorkforceRecord = {
  id: string;
  type: RecordType;
  title: string;
  reportingYear: number;
  status: string;
  updatedAt: string;
  createdAt: string;
  assessmentId?: string | null;
  wspId?: string | null;
  [key: string]: string | number | null | undefined;
};

const recordTypes: { value: RecordType; label: string }[] = [
  { value: 'assessment', label: 'Skills gaps' },
  { value: 'wsp', label: 'WSP plan' },
  { value: 'atr', label: 'ATR report' },
  { value: 'training', label: 'Training' },
];

const fieldDefinitions: Record<RecordType, { key: string; label: string; placeholder: string; multiline?: boolean; numeric?: boolean }[]> = {
  assessment: [
    { key: 'title', label: 'Assessment name', placeholder: 'For example, 2027 workforce needs assessment' },
    { key: 'reportingYear', label: 'Planning year', placeholder: '2027', numeric: true },
    { key: 'assessmentDate', label: 'Assessment date', placeholder: 'YYYY-MM-DD' },
    { key: 'department', label: 'Department or work area', placeholder: 'For example, production' },
    { key: 'occupationGroup', label: 'Occupation or employee group', placeholder: 'For example, irrigation assistants' },
    { key: 'employeeCount', label: 'Employees affected', placeholder: 'Number of employees', numeric: true },
    { key: 'skillArea', label: 'Identified skill gap', placeholder: 'Skill or competency gap' },
    { key: 'currentLevel', label: 'Current skill level (1-5)', placeholder: '1 = no experience, 5 = advanced', numeric: true },
    { key: 'targetLevel', label: 'Target skill level (1-5)', placeholder: 'Target level from 1 to 5', numeric: true },
    { key: 'priority', label: 'Priority', placeholder: 'Low, Medium, or High' },
    { key: 'proposedIntervention', label: 'Proposed training or development', placeholder: 'Describe a suitable intervention', multiline: true },
  ],
  wsp: [
    { key: 'title', label: 'WSP activity title', placeholder: 'Workplace Skills Plan activity' },
    { key: 'reportingYear', label: 'WSP year', placeholder: '2027', numeric: true },
    { key: 'objective', label: 'Skills development objective', placeholder: 'What capability should improve?', multiline: true },
    { key: 'intervention', label: 'Planned intervention', placeholder: 'Course, coaching, workplace learning, etc.' },
    { key: 'skillAreas', label: 'Skills to be developed', placeholder: 'List relevant skills', multiline: true },
    { key: 'participantCount', label: 'Planned participant count', placeholder: 'Number of employees', numeric: true },
    { key: 'deliveryMethod', label: 'Delivery method', placeholder: 'Online, Physical, Hybrid, or Workplace' },
    { key: 'plannedStartDate', label: 'Planned start date', placeholder: 'YYYY-MM-DD' },
    { key: 'plannedEndDate', label: 'Planned end date', placeholder: 'YYYY-MM-DD' },
    { key: 'estimatedCostZar', label: 'Estimated cost (ZAR)', placeholder: '0.00', numeric: true },
  ],
  atr: [
    { key: 'title', label: 'ATR activity title', placeholder: 'Annual Training Report activity' },
    { key: 'reportingYear', label: 'Reporting year', placeholder: '2026', numeric: true },
    { key: 'plannedParticipantCount', label: 'Planned participants', placeholder: 'Number of employees', numeric: true },
    { key: 'actualParticipantCount', label: 'Employees who attended', placeholder: 'Number who attended', numeric: true },
    { key: 'completedParticipantCount', label: 'Employees who completed', placeholder: 'Number who completed', numeric: true },
    { key: 'expenditureZar', label: 'Actual expenditure (ZAR)', placeholder: '0.00', numeric: true },
    { key: 'outcomeSummary', label: 'Outcomes and variance explanation', placeholder: 'Summarise completion, outcomes, and differences from plan', multiline: true },
  ],
  training: [
    { key: 'title', label: 'Training cohort', placeholder: 'For example, irrigation safety cohort' },
    { key: 'reportingYear', label: 'Planning year', placeholder: '2027', numeric: true },
    { key: 'department', label: 'Department or work area', placeholder: 'Production' },
    { key: 'occupationGroup', label: 'Occupation or employee group', placeholder: 'Irrigation assistants' },
    { key: 'skillAreas', label: 'Skills to be developed', placeholder: 'List relevant skills', multiline: true },
    { key: 'employeeCount', label: 'Cohort size', placeholder: 'Number of employees', numeric: true },
    { key: 'providerName', label: 'Training provider or internal trainer', placeholder: 'Provider or internal trainer' },
    { key: 'deliveryMethod', label: 'Delivery method', placeholder: 'Online, Physical, Hybrid, or Workplace' },
    { key: 'startDate', label: 'Start date', placeholder: 'YYYY-MM-DD' },
    { key: 'endDate', label: 'End date', placeholder: 'YYYY-MM-DD' },
    { key: 'outcomeSummary', label: 'Initial outcome or delivery notes (optional)', placeholder: 'Add notes as training progresses', multiline: true },
  ],
};

function emptyFields(type: RecordType) {
  return Object.fromEntries(fieldDefinitions[type].map(({ key }) => [
    key,
    key === 'reportingYear' ? String(new Date().getFullYear()) : '',
  ]));
}

function formatField(record: WorkforceRecord, key: string, label: string) {
  const value = record[key];
  if (value === undefined || value === null || value === '') return null;
  if (key.toLowerCase().includes('zar')) return `${label}: R${Number(value).toLocaleString('en-ZA')}`;
  return `${label}: ${value}`;
}

export default function SdfWorkforceScreen() {
  const { session } = useAuth();
  const [records, setRecords] = useState<WorkforceRecord[]>([]);
  const [type, setType] = useState<RecordType>('assessment');
  const [fields, setFields] = useState<Record<string, string>>(() => emptyFields('assessment'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [completionCounts, setCompletionCounts] = useState<Record<string, string>>({});
  const [outcomeNotes, setOutcomeNotes] = useState<Record<string, string>>({});
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [editingRecordId, setEditingRecordId] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch<{ records: WorkforceRecord[] }>('/sdf/workforce')
      .then(({ records: result }) => {
        if (active) {
          setRecords(result);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'SDF workforce records could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [reload]);

  const assessments = useMemo(() => records.filter((record) => record.type === 'assessment'), [records]);
  const plans = useMemo(() => records.filter((record) => record.type === 'wsp'), [records]);
  const counts = useMemo(() => ({
    gaps: assessments.length,
    plans: plans.length,
    reports: records.filter((record) => record.type === 'atr').length,
    cohorts: records.filter((record) => record.type === 'training').length,
  }), [assessments.length, plans.length, records]);

  const selectType = (nextType: RecordType) => {
    setType(nextType);
    setFields(emptyFields(nextType));
    setEditingRecordId('');
    setSelectedAssessmentId('');
    setSelectedPlanId('');
    setError('');
    setNotice('');
  };

  const editDraft = (record: WorkforceRecord) => {
    setType(record.type);
    setEditingRecordId(record.id);
    setFields(Object.fromEntries(fieldDefinitions[record.type].map(({ key }) => [
      key,
      record[key] === undefined || record[key] === null ? '' : String(record[key]),
    ])));
    setSelectedAssessmentId(record.assessmentId || '');
    setSelectedPlanId(record.wspId || '');
    setError('');
    setNotice(`Editing draft: ${record.title}`);
  };

  const cancelEdit = () => {
    setEditingRecordId('');
    setFields(emptyFields(type));
    setSelectedAssessmentId('');
    setSelectedPlanId('');
    setError('');
    setNotice('');
  };

  const save = async (action: 'draft' | 'submit') => {
    if (saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload: Record<string, string> = { ...fields };
      if (type === 'wsp' && (selectedAssessmentId || editingRecordId)) payload.assessmentId = selectedAssessmentId;
      if ((type === 'atr' || type === 'training') && (selectedPlanId || editingRecordId)) payload.wspId = selectedPlanId;
      const { record } = await apiFetch<{ record: WorkforceRecord }>(
        editingRecordId ? `/sdf/workforce/${encodeURIComponent(editingRecordId)}` : '/sdf/workforce',
        {
        method: editingRecordId ? 'PATCH' : 'POST',
        body: JSON.stringify({ ...payload, type, action }),
      });
      setRecords((current) => editingRecordId
        ? current.map((item) => item.id === record.id ? record : item)
        : [record, ...current]);
      setFields(emptyFields(type));
      setSelectedAssessmentId('');
      setSelectedPlanId('');
      setEditingRecordId('');
      setNotice(type === 'training'
        ? 'Training cohort created. Update it as it moves through delivery.'
        : action === 'submit'
          ? 'Record submitted in MyAgriSETA and locked. External WSP/ATR submission is not connected.'
          : 'Draft saved for your organisation.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The workforce record could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const updateTraining = async (record: WorkforceRecord, status: string) => {
    const rawCount = completionCounts[record.id];
    setError('');
    setNotice('');
    try {
      const { record: updated } = await apiFetch<{ record: WorkforceRecord }>(`/sdf/workforce/${encodeURIComponent(record.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          ...(rawCount !== undefined ? { completedEmployeeCount: Number(rawCount) } : {}),
          ...(outcomeNotes[record.id] !== undefined ? { outcomeSummary: outcomeNotes[record.id] } : {}),
        }),
      });
      setRecords((current) => current.map((item) => item.id === updated.id ? updated : item));
      setCompletionCounts((current) => ({ ...current, [record.id]: String(updated.completedEmployeeCount ?? 0) }));
      setOutcomeNotes((current) => ({ ...current, [record.id]: String(updated.outcomeSummary || '') }));
      setNotice(`${updated.title}: ${updated.status}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Training progress could not be updated.');
    }
  };

  const submitDraft = async (record: WorkforceRecord) => {
    setError('');
    setNotice('');
    try {
      const { record: updated } = await apiFetch<{ record: WorkforceRecord }>(`/sdf/workforce/${encodeURIComponent(record.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'submit' }),
      });
      setRecords((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(`${updated.title} submitted in MyAgriSETA. External submission is not connected.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The draft could not be submitted.');
    }
  };

  const shareDocument = async (documentType: 'wsp' | 'atr') => {
    const selected = records.filter((record) => record.type === documentType);
    const label = documentType === 'wsp' ? 'Workplace Skills Plan' : 'Annual Training Report';
    const message = selected.length
      ? `${label}\nOrganisation: ${session?.user.organization || 'My organisation'}\n\n${selected.map((record) => {
        const details = documentType === 'wsp'
          ? [
            formatField(record, 'objective', 'Objective'),
            formatField(record, 'intervention', 'Intervention'),
            formatField(record, 'skillAreas', 'Skills'),
            formatField(record, 'participantCount', 'Participants'),
            formatField(record, 'plannedStartDate', 'Start'),
            formatField(record, 'plannedEndDate', 'End'),
            formatField(record, 'estimatedCostZar', 'Estimated cost'),
          ]
          : [
            formatField(record, 'plannedParticipantCount', 'Planned'),
            formatField(record, 'actualParticipantCount', 'Attended'),
            formatField(record, 'completedParticipantCount', 'Completed'),
            formatField(record, 'expenditureZar', 'Expenditure'),
            formatField(record, 'outcomeSummary', 'Outcomes'),
          ];
        return `${record.reportingYear} · ${record.title} (${record.status})\n${details.filter(Boolean).join('\n')}`;
      }).join('\n\n')}`
      : `No ${label} records have been prepared yet.`;
    try {
      await Share.share({ title: `${label} summary`, message });
    } catch (cause) {
      Alert.alert('Unable to share report', cause instanceof Error ? cause.message : 'Please try again.');
    }
  };

  if (session?.activeRole !== 'sdf') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.title}>SDF access only</Text>
          <Text style={styles.muted}>This workforce-planning workspace is available to an SDF account.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerIcon}><Ionicons name="people-outline" size={20} color={palette.primary} /></View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ORGANISATION WORKFORCE</Text>
            <Text style={styles.title}>SDF planning</Text>
            <Text style={styles.muted}>{session.user.organization || 'Verified organisation'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh SDF records" onPress={() => { setLoading(true); setReload((value) => value + 1); }} style={styles.refresh}>
            <Ionicons name="refresh-outline" size={19} color={palette.primary} />
          </Pressable>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Organisation-scoped, privacy-conscious records</Text>
          <Text style={styles.noticeText}>
            These records are shared with approved SDF accounts for the same verified organisation. Use employee-group counts only; do not enter employee names, ID numbers, contact details, or other sensitive personal information.
          </Text>
        </View>

        <View style={styles.metrics}>
          <Metric label="Skills gaps" value={counts.gaps} />
          <Metric label="WSP activities" value={counts.plans} />
          <Metric label="ATR activities" value={counts.reports} />
          <Metric label="Training cohorts" value={counts.cohorts} />
        </View>

        <View style={styles.quickLinks}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/opportunities')} style={styles.quickLink}>
            <Ionicons name="school-outline" size={17} color={palette.primary} />
            <Text style={styles.quickLinkText}>Programmes & opportunities</Text>
            <Ionicons name="chevron-forward" size={15} color={palette.muted} />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Create an organisation record</Text>
        <View style={styles.typePicker}>
          {recordTypes.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: type === option.value }}
              onPress={() => selectType(option.value)}
              style={[styles.typeButton, type === option.value && styles.typeButtonSelected]}
            >
              <Text style={[styles.typeText, type === option.value && styles.typeTextSelected]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        {type === 'assessment' ? <Text style={styles.formHint}>Record one identified skills gap at a time. Add a separate entry for each occupation group or skill area.</Text> : null}
        {type === 'wsp' ? (
          <RelatedRecordPicker
            title="Link to a skills-gap assessment (optional)"
            records={assessments}
            selectedId={selectedAssessmentId}
            onSelect={setSelectedAssessmentId}
            emptyText="Create an assessment first to link it here."
          />
        ) : null}
        {type === 'atr' || type === 'training' ? (
          <RelatedRecordPicker
            title="Link to a WSP activity (optional)"
            records={plans}
            selectedId={selectedPlanId}
            onSelect={setSelectedPlanId}
            emptyText="Create a WSP activity first to link it here."
          />
        ) : null}

        <View style={styles.form}>
          {fieldDefinitions[type].map((field) => (
            <View key={field.key}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput
                accessibilityLabel={field.label}
                value={fields[field.key] || ''}
                onChangeText={(value) => setFields((current) => ({ ...current, [field.key]: value }))}
                placeholder={field.placeholder}
                keyboardType={field.numeric ? 'decimal-pad' : 'default'}
                autoCapitalize={field.key.includes('Date') ? 'none' : 'sentences'}
                multiline={field.multiline}
                maxLength={field.key === 'outcomeSummary' ? 1000 : 500}
                style={[styles.input, field.multiline && styles.multiline]}
              />
            </View>
          ))}
          {type === 'assessment' ? (
            <Text style={styles.formHint}>Skill levels use a 1–5 scale. Current skill level must be lower than the target. Assessment entries use aggregate headcounts, not named employee records.</Text>
          ) : null}
          {type === 'atr' ? (
            <Text style={styles.formHint}>ATR numbers are checked against the plan: attendance cannot exceed planned participants, and completions cannot exceed attendance.</Text>
          ) : null}
          {editingRecordId ? (
            <Pressable accessibilityRole="button" onPress={cancelEdit} style={styles.cancelEdit}>
              <Text style={styles.cancelEditText}>Cancel editing</Text>
            </Pressable>
          ) : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {notice ? <Text accessibilityRole="alert" style={styles.success}>{notice}</Text> : null}
          {type === 'training' ? (
            <ActionButton label={saving ? 'Saving…' : 'Create planned cohort'} disabled={saving} onPress={() => void save('draft')} />
          ) : (
            <View style={styles.actionRow}>
              <ActionButton label={saving ? 'Saving…' : 'Save draft'} disabled={saving} secondary onPress={() => void save('draft')} />
              <ActionButton label={saving ? 'Saving…' : 'Submit in MyAgriSETA'} disabled={saving} onPress={() => void save('submit')} />
            </View>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Organisation records</Text>
          <View style={styles.exportRow}>
            <Pressable accessibilityRole="button" onPress={() => void shareDocument('wsp')} style={styles.exportButton}>
              <Text style={styles.exportText}>Share WSP</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void shareDocument('atr')} style={styles.exportButton}>
              <Text style={styles.exportText}>Share ATR</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.formHint}>Shared summaries are working drafts for review. They are not official AgriSETA submissions.</Text>
        {loading ? <ActivityIndicator size="large" color={palette.primary} style={styles.loading} /> : null}
        {!loading && records.length === 0 ? <Text style={styles.empty}>No workforce records yet. Start by adding a skills gap or training-needs assessment.</Text> : null}
        {records.map((record) => (
          <WorkforceRecordCard
            key={record.id}
            record={record}
            completionCount={completionCounts[record.id] ?? String(record.completedEmployeeCount ?? 0)}
            onCompletionCountChange={(value) => setCompletionCounts((current) => ({ ...current, [record.id]: value }))}
            outcomeSummary={outcomeNotes[record.id] ?? String(record.outcomeSummary || '')}
            onOutcomeSummaryChange={(value) => setOutcomeNotes((current) => ({ ...current, [record.id]: value }))}
            onEdit={() => editDraft(record)}
            onSubmit={() => void submitDraft(record)}
            onTrainingStatus={(status) => void updateTraining(record, status)}
          />
        ))}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  disabled,
  secondary = false,
  onPress,
}: {
  label: string;
  disabled: boolean;
  secondary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, secondary && styles.secondaryAction, disabled && styles.disabled]}
    >
      <Text style={[styles.actionButtonText, secondary && styles.secondaryActionText]}>{label}</Text>
    </Pressable>
  );
}

function RelatedRecordPicker({
  title,
  records,
  selectedId,
  onSelect,
  emptyText,
}: {
  title: string;
  records: WorkforceRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
  emptyText: string;
}) {
  return (
    <View style={styles.relatedPicker}>
      <Text style={styles.label}>{title}</Text>
      {!records.length ? <Text style={styles.muted}>{emptyText}</Text> : (
        <View style={styles.relatedList}>
          <Pressable onPress={() => onSelect('')} style={[styles.relatedItem, !selectedId && styles.relatedItemSelected]}>
            <Text style={styles.relatedText}>No linked record</Text>
          </Pressable>
          {records.map((record) => (
            <Pressable key={record.id} onPress={() => onSelect(record.id)} style={[styles.relatedItem, selectedId === record.id && styles.relatedItemSelected]}>
              <Text style={styles.relatedText}>{record.reportingYear} · {record.title} · {record.status}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function WorkforceRecordCard({
  record,
  completionCount,
  onCompletionCountChange,
  outcomeSummary,
  onOutcomeSummaryChange,
  onEdit,
  onSubmit,
  onTrainingStatus,
}: {
  record: WorkforceRecord;
  completionCount: string;
  onCompletionCountChange: (value: string) => void;
  outcomeSummary: string;
  onOutcomeSummaryChange: (value: string) => void;
  onEdit: () => void;
  onSubmit: () => void;
  onTrainingStatus: (status: string) => void;
}) {
  const label = recordTypes.find((option) => option.value === record.type)?.label || record.type;
  const details = record.type === 'assessment'
    ? [
      formatField(record, 'department', 'Work area'),
      formatField(record, 'occupationGroup', 'Employee group'),
      formatField(record, 'employeeCount', 'Employees affected'),
      formatField(record, 'skillArea', 'Skill gap'),
      formatField(record, 'currentLevel', 'Current level'),
      formatField(record, 'targetLevel', 'Target level'),
      formatField(record, 'priority', 'Priority'),
      formatField(record, 'proposedIntervention', 'Proposed intervention'),
    ]
    : record.type === 'wsp'
      ? [
        formatField(record, 'objective', 'Objective'),
        formatField(record, 'intervention', 'Intervention'),
        formatField(record, 'skillAreas', 'Skills'),
        formatField(record, 'participantCount', 'Participants'),
        formatField(record, 'deliveryMethod', 'Delivery'),
        formatField(record, 'plannedStartDate', 'Start'),
        formatField(record, 'plannedEndDate', 'End'),
        formatField(record, 'estimatedCostZar', 'Estimated cost'),
      ]
      : record.type === 'atr'
        ? [
          formatField(record, 'plannedParticipantCount', 'Planned'),
          formatField(record, 'actualParticipantCount', 'Attended'),
          formatField(record, 'completedParticipantCount', 'Completed'),
          formatField(record, 'expenditureZar', 'Expenditure'),
          formatField(record, 'outcomeSummary', 'Outcomes'),
        ]
        : [
          formatField(record, 'department', 'Work area'),
          formatField(record, 'occupationGroup', 'Employee group'),
          formatField(record, 'skillAreas', 'Skills'),
          formatField(record, 'employeeCount', 'Cohort size'),
          formatField(record, 'completedEmployeeCount', 'Completed'),
          formatField(record, 'providerName', 'Trainer/provider'),
          formatField(record, 'deliveryMethod', 'Delivery'),
          formatField(record, 'startDate', 'Start'),
          formatField(record, 'endDate', 'End'),
          formatField(record, 'outcomeSummary', 'Outcome'),
        ];
  const nextStatus: Record<string, string> = {
    Planned: 'Scheduled',
    Scheduled: 'In Progress',
    'In Progress': 'Completed',
    Cancelled: 'Scheduled',
  };
  return (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <Text style={styles.recordType}>{label} · {record.reportingYear}</Text>
        <Text style={styles.status}>{record.status}</Text>
      </View>
      <Text style={styles.recordTitle}>{record.title}</Text>
      {details.filter(Boolean).map((line) => <Text key={line} style={styles.recordDetail}>{line}</Text>)}
      {record.type !== 'training' && record.status === 'Draft' ? (
        <View style={styles.progressActions}>
          <Pressable accessibilityRole="button" onPress={onEdit} style={[styles.submitDraft, styles.editDraft]}>
            <Text style={styles.submitDraftText}>Edit draft</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onSubmit} style={styles.submitDraft}>
            <Text style={styles.submitDraftText}>Submit in MyAgriSETA</Text>
          </Pressable>
        </View>
      ) : null}
      {record.type === 'training' ? (
        <View style={styles.progressActions}>
          <TextInput
            accessibilityLabel={`Completed employee count for ${record.title}`}
            value={completionCount}
            onChangeText={onCompletionCountChange}
            placeholder="Number completed"
            keyboardType="number-pad"
            style={[styles.input, styles.progressInput]}
          />
          <TextInput
            accessibilityLabel={`Training outcome notes for ${record.title}`}
            value={outcomeSummary}
            onChangeText={onOutcomeSummaryChange}
            placeholder="Progress or outcome notes (optional)"
            multiline
            maxLength={1000}
            style={[styles.input, styles.progressNotes]}
          />
          <Pressable accessibilityRole="button" onPress={() => onTrainingStatus(record.status)} style={[styles.submitDraft, styles.editDraft]}>
            <Text style={styles.submitDraftText}>Save progress details</Text>
          </Pressable>
          {nextStatus[record.status] ? (
            <Pressable accessibilityRole="button" onPress={() => onTrainingStatus(nextStatus[record.status])} style={styles.submitDraft}>
              <Text style={styles.submitDraftText}>Mark {nextStatus[record.status]}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  container: { width: '100%', maxWidth: 920, alignSelf: 'center', padding: spacing.lg, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  headerIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: '#E6F3EB' },
  headerCopy: { flex: 1 },
  eyebrow: { color: palette.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  title: { color: palette.text, fontSize: 24, fontWeight: '800', marginTop: 2 },
  muted: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  refresh: { padding: spacing.sm },
  noticeCard: { backgroundColor: '#F6F0DF', borderRadius: radius.md, padding: spacing.md },
  noticeTitle: { color: '#685522', fontSize: 12, fontWeight: '800' },
  noticeText: { color: '#685522', fontSize: 10, lineHeight: 15, marginTop: 4 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  metric: { flexGrow: 1, minWidth: '22%', backgroundColor: palette.surface, borderRadius: radius.md, padding: spacing.sm },
  metricValue: { color: palette.primaryDark, fontSize: 20, fontWeight: '800' },
  metricLabel: { color: palette.muted, fontSize: 9, marginTop: 3 },
  quickLinks: { marginTop: spacing.md, backgroundColor: palette.surface, borderRadius: radius.md },
  quickLink: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  quickLinkText: { flex: 1, color: palette.primaryDark, fontSize: 11, fontWeight: '800' },
  sectionTitle: { color: palette.text, fontSize: 17, fontWeight: '800', marginTop: spacing.lg },
  typePicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  typeButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  typeButtonSelected: { backgroundColor: palette.primaryDark, borderColor: palette.primaryDark },
  typeText: { color: palette.primaryDark, fontSize: 10, fontWeight: '700' },
  typeTextSelected: { color: '#FFFFFF' },
  formHint: { color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: spacing.sm },
  relatedPicker: { marginTop: spacing.sm },
  relatedList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  relatedItem: { backgroundColor: palette.surface, borderRadius: 16, borderWidth: 1, borderColor: palette.border, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  relatedItemSelected: { borderColor: palette.primary, backgroundColor: '#E6F3EB' },
  relatedText: { color: palette.text, fontSize: 10 },
  form: { gap: spacing.xs, backgroundColor: palette.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, padding: spacing.md, marginTop: spacing.md },
  label: { color: palette.text, fontSize: 10, fontWeight: '700', marginTop: spacing.xs },
  input: { minHeight: 40, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, color: palette.text, backgroundColor: palette.surface, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, marginTop: 5, fontSize: 11 },
  multiline: { minHeight: 72, textAlignVertical: 'top', paddingTop: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryDark, borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  actionButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  secondaryAction: { borderWidth: 1, borderColor: palette.primaryDark, backgroundColor: palette.surface },
  secondaryActionText: { color: palette.primaryDark },
  disabled: { opacity: 0.6 },
  error: { color: palette.danger, fontSize: 11, lineHeight: 16, marginTop: spacing.xs },
  success: { color: palette.primaryDark, backgroundColor: '#E6F3EB', fontSize: 11, lineHeight: 16, padding: spacing.sm, borderRadius: radius.sm, marginTop: spacing.xs },
  sectionHeader: { marginTop: spacing.lg },
  exportRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  exportButton: { borderRadius: radius.sm, borderWidth: 1, borderColor: palette.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  exportText: { color: palette.primaryDark, fontSize: 10, fontWeight: '800' },
  loading: { marginVertical: spacing.lg },
  empty: { color: palette.muted, backgroundColor: palette.surface, padding: spacing.md, borderRadius: radius.md, fontSize: 11, marginTop: spacing.sm },
  recordCard: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  recordHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  recordType: { color: palette.primary, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  status: { color: palette.primaryDark, fontSize: 9, fontWeight: '800', backgroundColor: '#E6F3EB', borderRadius: 12, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  recordTitle: { color: palette.text, fontSize: 14, fontWeight: '800', marginTop: spacing.xs },
  recordDetail: { color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  submitDraft: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', backgroundColor: palette.primaryDark, borderRadius: radius.sm, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  submitDraftText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  editDraft: { backgroundColor: palette.primary },
  cancelEdit: { alignSelf: 'flex-end', paddingVertical: spacing.xs },
  cancelEditText: { color: palette.danger, fontSize: 10, fontWeight: '800' },
  progressActions: { gap: spacing.xs, marginTop: spacing.xs },
  progressInput: { width: '100%' },
  progressNotes: { minHeight: 56, textAlignVertical: 'top', paddingTop: spacing.sm },
});
