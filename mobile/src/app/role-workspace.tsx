import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { apiFetch } from '@/lib/api';
import { palette } from '@/theme';

type Profile = { businessName: string; registrationNumber: string; province: string; sector: string; description: string };
type Request = { id: string; title: string; category: string; status: string };
type Assignment = {
  id: string;
  reference?: string;
  learnerName?: string;
  learnerNumber?: string;
  dueAt?: string;
  assessmentLocation?: string;
  assessmentMethod?: string;
  startTime?: string;
  endTime?: string;
  title: string;
  assessmentType: string;
  criteria: string[];
  status: string;
  outcome?: string | null;
  learnerId: string;
  programme?: string;
  trainingProvider?: string;
  scheduledAt?: string;
  feedback?: string;
  result?: string | null;
  report?: string;
  score?: number | null;
  evidence?: { id: string; name: string; description: string; contentType: string; size: number }[];
};
type Dashboard = {
  assignedLearners: number;
  pendingAssessments: number;
  scheduledAssessments: number;
  completedAssessments: number;
  awaitingVerification: number;
  competentLearners: number;
  notYetCompetentLearners: number;
};
type AssignedLearner = {
  id: string;
  learnerNumber: string;
  name: string;
  organization: string;
  programme: string;
  trainingProvider: string;
  assessmentCount: number;
  completedAssessments?: number;
  pendingAssessments?: number;
  latestOutcome?: string;
  progress?: number;
  programmeStartDate?: string;
  programmeEndDate?: string;
  assignmentDate?: string;
};
type AssessmentCriteria = {
  reference?: string;
  programme: string;
  assessmentType: string;
  criteria: string[];
  unitStandard?: string;
  requiredEvidence?: string[];
  assessmentMethod?: string;
  scoringRules?: string;
  minimumRequirements?: string;
};

export default function RoleWorkspaceScreen() {
  const { session } = useAuth();
  const params = useLocalSearchParams<{ section?: string }>();
  const section = typeof params.section === 'string' ? params.section : '';
  const isSmme = session?.activeRole === 'smme';
  const [profile, setProfile] = useState<Profile>({ businessName: '', registrationNumber: '', province: '', sector: '', description: '' });
  const [requests, setRequests] = useState<Request[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [learners, setLearners] = useState<AssignedLearner[]>([]);
  const [criteria, setCriteria] = useState<AssessmentCriteria[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Business development');
  const [details, setDetails] = useState('');
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [learnerStrengths, setLearnerStrengths] = useState<Record<string, string>>({});
  const [areasToImprove, setAreasToImprove] = useState<Record<string, string>>({});
  const [learningActivities, setLearningActivities] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, string>>({});
  const [evidenceNames, setEvidenceNames] = useState<Record<string, string>>({});
  const [evidenceDescriptions, setEvidenceDescriptions] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      if (isSmme) {
        const [profilePayload, requestPayload] = await Promise.all([
          apiFetch<{ profile: Profile }>('/smme/business-profile'),
          apiFetch<{ requests: Request[] }>('/smme/support-requests'),
        ]);
        setProfile(profilePayload.profile);
        setRequests(requestPayload.requests);
      } else {
        const [dashboardPayload, assignmentPayload, learnerPayload, criteriaPayload] = await Promise.all([
          apiFetch<{ counts: Dashboard }>('/assessor/dashboard'),
          apiFetch<{ assignments: Assignment[] }>('/assessor/assignments'),
          apiFetch<{ learners: AssignedLearner[] }>('/assessor/learners'),
          apiFetch<{ criteria: AssessmentCriteria[] }>('/assessor/criteria'),
        ]);
        setDashboard(dashboardPayload.counts);
        setAssignments(assignmentPayload.assignments);
        setLearners(learnerPayload.learners.map((learner) => (
          Array.isArray(learner) ? learner[1] : learner
        ) as AssignedLearner));
        setCriteria(criteriaPayload.criteria);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Workspace could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [isSmme]);

  const saveProfile = async () => {
    try {
      const payload = await apiFetch<{ profile: Profile }>('/smme/business-profile', { method: 'PATCH', body: JSON.stringify(profile) });
      setProfile(payload.profile);
      setMessage('Business profile saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Business profile could not be saved.');
    }
  };

  const submitRequest = async () => {
    try {
      await apiFetch('/smme/support-requests', { method: 'POST', body: JSON.stringify({ title, category, details }) });
      setTitle('');
      setDetails('');
      setMessage('Support request submitted.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Support request could not be submitted.');
    }
  };

  const submitAssessment = async (assignment: Assignment) => {
    const values = feedback[assignment.id] || '';
    const outcome = outcomes[assignment.id] || 'Pending Assessment';
    const evidenceName = evidenceNames[assignment.id]?.trim();
    const evidenceDescription = evidenceDescriptions[assignment.id]?.trim();
    try {
      await apiFetch(`/assessor/assignments/${assignment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          result: values,
          feedback: values,
          report: values,
          outcome,
          score: scores[assignment.id] || null,
          areasForImprovement: values,
          evidence: evidenceName ? [{
            id: `evidence-${assignment.id}`,
            name: evidenceName,
            description: evidenceDescription || '',
            contentType: 'application/pdf',
            size: 1,
          }] : undefined,
          status: outcome === 'Pending Assessment' ? 'Draft' : 'Submitted',
        }),
      });
      setMessage(outcome === 'Pending Assessment' ? 'Assessment draft saved.' : 'Assessment submitted for verification.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Assessment report could not be submitted.');
    }
  };

  const submitLearnerFeedback = async (assignment: Assignment, status: 'Draft' | 'Submitted') => {
    const strengths = learnerStrengths[assignment.id] || '';
    const improvements = areasToImprove[assignment.id] || '';
    const activities = learningActivities[assignment.id] || '';
    if (status === 'Submitted' && (!strengths || !improvements || !activities)) {
      setMessage('Learner strengths, areas for improvement, and recommended learning activities are required.');
      return;
    }
    try {
      await apiFetch(`/assessor/assignments/${assignment.id}/feedback`, {
        method: 'PATCH',
        body: JSON.stringify({
          learnerStrengths: strengths,
          areasForImprovement: improvements,
          learningActivities: activities,
          generalComments: `${strengths} ${improvements}`,
          status,
        }),
      });
      setMessage(status === 'Draft' ? 'Learner feedback saved as a draft.' : 'Learner feedback submitted.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Learner feedback could not be saved.');
    }
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={palette.primary} /></SafeAreaView>;

  const sectionTitle = section === 'learners'
    ? 'Assigned Learners'
    : section === 'schedule'
      ? 'Assessment Schedule'
      : section === 'criteria'
        ? 'Assessment Criteria'
        : section === 'results'
          ? 'Record Assessment Results'
          : section === 'feedback'
            ? 'Learner Feedback'
            : section === 'reports'
              ? 'Assessment Reports'
              : section === 'history'
                ? 'Assessment History'
                : section === 'assessments'
                  ? 'My Assigned Assessments'
                  : 'Assessor Workspace';
  const visibleAssignments = assignments.filter((assignment) => section === 'reports'
    ? ['Submitted', 'Awaiting Verification', 'Verified', 'Finalised'].includes(assignment.status)
    : section === 'history'
      ? true
      : section === 'results'
        ? !['Verified', 'Finalised'].includes(assignment.status)
        : section === 'feedback'
          ? ['Submitted', 'Awaiting Verification', 'Verified', 'Finalised'].includes(assignment.status)
          : true).filter((assignment) => {
            if (section !== 'assessments' || !search.trim()) return true;
            const query = search.trim().toLowerCase();
            return `${assignment.reference || ''} ${assignment.learnerName || ''} ${assignment.learnerNumber || ''} ${assignment.programme || ''} ${assignment.assessmentType}`.toLowerCase().includes(query);
          });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/services');
        }}><Text style={styles.back}>Back</Text></Pressable>
        <Text style={styles.eyebrow}>{isSmme ? 'SMME WORKSPACE' : 'ASSESSOR WORKSPACE'}</Text>
        <Text style={styles.heading}>{isSmme ? 'Grow your agricultural business' : 'Assess and support learners'}</Text>
        <Text style={styles.description}>{isSmme ? 'Manage your business profile, request support, and track business-development work.' : 'Review assigned learners, record evidence, provide feedback, and submit competency reports.'}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        {isSmme ? (
          <>
            <Text style={styles.section}>Business profile</Text>
            {(['businessName', 'registrationNumber', 'province', 'sector', 'description'] as const).map((field) => (
              <TextInput key={field} value={profile[field]} onChangeText={(value) => setProfile((current) => ({ ...current, [field]: value }))} placeholder={field.replace(/([A-Z])/g, ' $1')} style={[styles.input, field === 'description' && styles.multiline]} multiline={field === 'description'} />
            ))}
            <Pressable style={styles.button} onPress={saveProfile}><Text style={styles.buttonText}>Save business profile</Text></Pressable>
            <Text style={styles.section}>Request business support</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Support need title" style={styles.input} />
            <TextInput value={category} onChangeText={setCategory} placeholder="Category" style={styles.input} />
            <TextInput value={details} onChangeText={setDetails} placeholder="Describe the support, funding, training, mentorship, or market need" style={[styles.input, styles.multiline]} multiline />
            <Pressable style={styles.button} onPress={submitRequest}><Text style={styles.buttonText}>Submit support request</Text></Pressable>
            <Text style={styles.section}>Tracked requests</Text>
            {requests.map((request) => <View style={styles.card} key={request.id}><Text style={styles.cardTitle}>{request.title}</Text><Text>{request.category} · {request.status}</Text></View>)}
          </>
        ) : (
          <>
            <Text style={styles.section}>{sectionTitle}</Text>

            {section === 'assessments' && (
              <>
                <View style={styles.metricGrid}>
                  {([
                    ['Total assigned', assignments.length],
                    ['Pending', assignments.filter((item) => ['Assigned', 'Scheduled', 'In Progress', 'Draft', 'Changes Requested'].includes(item.status)).length],
                    ['Scheduled', assignments.filter((item) => item.status === 'Scheduled').length],
                    ['In progress', assignments.filter((item) => item.status === 'In Progress').length],
                    ['Submitted', assignments.filter((item) => item.status === 'Submitted').length],
                    ['Awaiting verification', assignments.filter((item) => item.status === 'Awaiting Verification').length],
                  ] as [string, number][]).map(([label, value]) => (
                    <View style={styles.metricCard} key={label}>
                      <Text style={styles.metricValue}>{value}</Text>
                      <Text style={styles.metricLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
                <TextInput value={search} onChangeText={setSearch} placeholder="Search learner, reference or programme" style={styles.input} />
              </>
            )}

            {!section && dashboard && (
              <View style={styles.metricGrid}>
                {([
                  ['Assigned learners', dashboard.assignedLearners],
                  ['Pending assessments', dashboard.pendingAssessments],
                  ['Scheduled', dashboard.scheduledAssessments],
                  ['Completed', dashboard.completedAssessments],
                  ['Awaiting verification', dashboard.awaitingVerification],
                  ['Competent', dashboard.competentLearners],
                  ['Not yet competent', dashboard.notYetCompetentLearners],
                ] as [string, number][]).map(([label, value]) => (
                  <View style={styles.metricCard} key={label}>
                    <Text style={styles.metricValue}>{value}</Text>
                    <Text style={styles.metricLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            )}

            {section === 'learners' && (
              learners.length === 0
                ? <Text style={styles.empty}>No learners are currently assigned to you.</Text>
                : learners.map((learner) => (
                    <View style={styles.card} key={learner.learnerNumber || learner.id}>
                      <Text style={styles.cardTitle}>{learner.name}</Text>
                      <Text style={styles.meta}>Learner number: {learner.learnerNumber}</Text>
                      <Text style={styles.meta}>Programme: {learner.programme}</Text>
                      <Text style={styles.meta}>Training provider: {learner.trainingProvider}</Text>
                      <Text style={styles.meta}>Programme dates: {learner.programmeStartDate || 'Not set'} to {learner.programmeEndDate || 'Not set'}</Text>
                      <Text style={styles.meta}>Assessment assignment date: {learner.assignmentDate || 'Not set'}</Text>
                      <Text style={styles.meta}>Assigned assessments: {learner.assessmentCount}</Text>
                      <Text style={styles.meta}>Completed: {learner.completedAssessments || 0} · Pending: {learner.pendingAssessments || learner.assessmentCount || 0}</Text>
                      <Text style={styles.meta}>Latest outcome: {learner.latestOutcome || 'Pending Assessment'}</Text>
                      <Text style={styles.meta}>Progress: {learner.progress || 0}%</Text>
                    </View>
                  ))
            )}

            {section === 'criteria' && (
              criteria.length === 0
                ? <Text style={styles.empty}>No assessment criteria are currently configured.</Text>
                : criteria.map((item) => (
                    <View style={styles.card} key={`${item.programme}-${item.assessmentType}`}>
                      <Text style={styles.cardTitle}>{item.programme}</Text>
                      <Text style={styles.meta}>Criteria reference: {item.reference || 'Programme criteria'}</Text>
                      <Text style={styles.meta}>Assessment type: {item.assessmentType}</Text>
                      {item.unitStandard ? <Text style={styles.meta}>Unit standard/module: {item.unitStandard}</Text> : null}
                      <Text style={styles.meta}>Assessment method: {item.assessmentMethod || 'Programme method'}</Text>
                      <Text style={styles.criteria}>{item.criteria.join(' • ')}</Text>
                      {item.requiredEvidence ? <Text style={styles.meta}>Required evidence: {item.requiredEvidence.join(', ')}</Text> : null}
                      {item.scoringRules ? <Text style={styles.meta}>Scoring: {item.scoringRules}</Text> : null}
                      {item.minimumRequirements ? <Text style={styles.meta}>Minimum requirements: {item.minimumRequirements}</Text> : null}
                    </View>
                  ))
            )}

            {section === 'schedule' && (
              assignments.filter((assignment) => assignment.scheduledAt).length === 0
                ? <Text style={styles.empty}>No assessment dates are scheduled.</Text>
                : assignments
                    .filter((assignment) => assignment.scheduledAt)
                    .sort((left, right) => (left.scheduledAt || '').localeCompare(right.scheduledAt || ''))
                    .map((assignment) => (
                      <View style={styles.card} key={assignment.id}>
                        <Text style={styles.cardTitle}>{assignment.title}</Text>
                        <Text>{assignment.status}</Text>
                        <Text style={styles.meta}>Reference: {assignment.reference || assignment.id}</Text>
                        <Text style={styles.meta}>Learner: {assignment.learnerName || 'Assigned learner'} ({assignment.learnerNumber || 'No learner number'})</Text>
                        <Text style={styles.meta}>Programme: {assignment.programme}</Text>
                        <Text style={styles.meta}>Type: {assignment.assessmentType}</Text>
                        <Text style={styles.meta}>Date: {new Date(assignment.scheduledAt as string).toLocaleString()}</Text>
                        {assignment.startTime || assignment.endTime ? <Text style={styles.meta}>Time: {assignment.startTime || '--'} to {assignment.endTime || '--'}</Text> : null}
                        {assignment.assessmentLocation ? <Text style={styles.meta}>Location: {assignment.assessmentLocation}</Text> : null}
                        {assignment.assessmentMethod ? <Text style={styles.meta}>Method: {assignment.assessmentMethod}</Text> : null}
                        <Text style={styles.meta}>Training provider: {assignment.trainingProvider}</Text>
                      </View>
                    ))
            )}

            {section === 'feedback' && (
              assignments.length === 0
                ? <Text style={styles.empty}>No assessments are available for learner feedback.</Text>
                : assignments.map((assignment) => (
                    <View style={styles.card} key={`feedback-${assignment.id}`}>
                      <Text style={styles.cardTitle}>{assignment.learnerName || 'Assigned learner'} · {assignment.reference}</Text>
                      <Text style={styles.meta}>{assignment.programme} · {assignment.assessmentType}</Text>
                      <Text style={styles.meta}>Outcome: {assignment.outcome || 'Pending Assessment'}</Text>
                      <TextInput value={learnerStrengths[assignment.id] || ''} onChangeText={(value) => setLearnerStrengths((current) => ({ ...current, [assignment.id]: value }))} placeholder="Learner strengths" style={[styles.input, styles.multiline]} multiline />
                      <TextInput value={areasToImprove[assignment.id] || ''} onChangeText={(value) => setAreasToImprove((current) => ({ ...current, [assignment.id]: value }))} placeholder="Areas requiring improvement" style={[styles.input, styles.multiline]} multiline />
                      <TextInput value={learningActivities[assignment.id] || ''} onChangeText={(value) => setLearningActivities((current) => ({ ...current, [assignment.id]: value }))} placeholder="Recommended learning activities" style={[styles.input, styles.multiline]} multiline />
                      <View style={styles.actionRow}>
                        <Pressable style={styles.secondaryButton} onPress={() => submitLearnerFeedback(assignment, 'Draft')}><Text style={styles.secondaryButtonText}>Save draft</Text></Pressable>
                        <Pressable style={styles.button} onPress={() => submitLearnerFeedback(assignment, 'Submitted')}><Text style={styles.buttonText}>Submit feedback</Text></Pressable>
                      </View>
                    </View>
                  ))
            )}

            {section === 'reports' && (
              <View style={styles.metricGrid}>
                {([
                  ['Total assessments', assignments.length],
                  ['Completed', assignments.filter((item) => ['Submitted', 'Awaiting Verification', 'Verified', 'Finalised'].includes(item.status)).length],
                  ['Competent', assignments.filter((item) => item.outcome === 'Competent').length],
                  ['Not yet competent', assignments.filter((item) => item.outcome === 'Not Yet Competent').length],
                  ['Pending', assignments.filter((item) => ['Assigned', 'Scheduled', 'In Progress', 'Draft'].includes(item.status)).length],
                  ['Awaiting verification', assignments.filter((item) => item.status === 'Awaiting Verification').length],
                ] as [string, number][]).map(([label, value]) => (
                  <View style={styles.metricCard} key={label}>
                    <Text style={styles.metricValue}>{value}</Text>
                    <Text style={styles.metricLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            )}

            {(section === '' || section === 'assessments' || section === 'results' || section === 'reports' || section === 'history') && (
              <>
            {section === '' && <Text style={styles.section}>Assigned assessments</Text>}
            {visibleAssignments.length === 0
              ? <Text style={styles.empty}>
                  {section === 'reports'
                    ? 'No completed assessment reports are available.'
                    : 'No assessments are currently assigned to you.'}
                </Text>
              : visibleAssignments.map((assignment) => (
              <View style={styles.card} key={assignment.id}>
                <Text style={styles.cardTitle}>{assignment.title}</Text>
                <Text>{assignment.assessmentType} · {assignment.status}</Text>
                <Text style={styles.meta}>Reference: {assignment.reference || assignment.id}</Text>
                {assignment.learnerName ? <Text style={styles.meta}>Learner: {assignment.learnerName} ({assignment.learnerNumber || 'No learner number'})</Text> : null}
                <Text style={styles.meta}>Programme: {assignment.programme || 'Not specified'}</Text>
                <Text style={styles.meta}>Training provider: {assignment.trainingProvider || 'Not specified'}</Text>
                {assignment.scheduledAt ? <Text style={styles.meta}>Assessment date: {new Date(assignment.scheduledAt).toLocaleString()}</Text> : null}
                {assignment.dueAt ? <Text style={styles.meta}>Due date: {new Date(assignment.dueAt).toLocaleString()}</Text> : null}
                <Text style={styles.criteria}>{assignment.criteria.join(' • ')}</Text>
                {!['Submitted', 'Awaiting Verification', 'Verified', 'Finalised'].includes(assignment.status) ? (
                  <>
                    <TextInput value={feedback[assignment.id] || ''} onChangeText={(value) => setFeedback((current) => ({ ...current, [assignment.id]: value }))} placeholder="Record performance, feedback, evidence summary, and report" style={[styles.input, styles.multiline]} multiline />
                    <TextInput value={scores[assignment.id] || ''} onChangeText={(value) => setScores((current) => ({ ...current, [assignment.id]: value }))} placeholder="Score (only where the programme defines one)" keyboardType="decimal-pad" style={styles.input} />
                    <TextInput value={evidenceNames[assignment.id] || ''} onChangeText={(value) => setEvidenceNames((current) => ({ ...current, [assignment.id]: value }))} placeholder="Evidence document name (PDF, JPEG or PNG)" style={styles.input} />
                    <TextInput value={evidenceDescriptions[assignment.id] || ''} onChangeText={(value) => setEvidenceDescriptions((current) => ({ ...current, [assignment.id]: value }))} placeholder="Evidence description" style={[styles.input, styles.multiline]} multiline />
                    <View style={styles.outcomeRow}>
                      {['Competent', 'Not Yet Competent', 'Pending Assessment'].map((option) => (
                        <Pressable
                          key={option}
                          style={[styles.outcomeButton, outcomes[assignment.id] === option && styles.outcomeButtonSelected]}
                          onPress={() => setOutcomes((current) => ({ ...current, [assignment.id]: option }))}
                        >
                          <Text style={styles.outcomeButtonText}>{option}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable style={styles.button} onPress={() => submitAssessment(assignment)}><Text style={styles.buttonText}>{(outcomes[assignment.id] || 'Pending Assessment') === 'Pending Assessment' ? 'Save assessment draft' : 'Submit for verification'}</Text></Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.outcome}>Outcome: {assignment.outcome || 'Awaiting verification'}</Text>
                    {(section === 'reports' || section === 'history') && (
                      <>
                        {assignment.result ? <Text style={styles.meta}>Result: {assignment.result}</Text> : null}
                        {assignment.feedback ? <Text style={styles.meta}>Feedback: {assignment.feedback}</Text> : null}
                        {assignment.report ? <Text style={styles.meta}>Report: {assignment.report}</Text> : null}
                        {assignment.score !== null && assignment.score !== undefined ? <Text style={styles.meta}>Score: {assignment.score}</Text> : null}
                        {assignment.evidence && assignment.evidence.length > 0 ? (
                          <Text style={styles.meta}>Evidence: {assignment.evidence.map((item) => item.name).join(', ')}</Text>
                        ) : null}
                      </>
                    )}
                  </>
                )}
              </View>
            ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F6F8F5' },
  container: { padding: 22, gap: 12 },
  back: { color: palette.primary, fontWeight: '700' },
  eyebrow: { color: palette.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 16 },
  heading: { color: '#14201B', fontSize: 25, fontWeight: '800' },
  description: { color: palette.muted, lineHeight: 20 },
  message: { backgroundColor: '#E8F3EC', color: palette.primaryDark, padding: 12, borderRadius: 8 },
  section: { color: '#14201B', fontSize: 17, fontWeight: '800', marginTop: 16 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D5DED8', borderRadius: 8, padding: 12, width: '48%' },
  metricValue: { color: palette.primaryDark, fontSize: 22, fontWeight: '800' },
  metricLabel: { color: palette.muted, fontSize: 12, marginTop: 4 },
  meta: { color: palette.muted, fontSize: 12, marginTop: 3 },
  empty: { color: palette.muted, backgroundColor: '#FFFFFF', padding: 14, borderRadius: 8 },
  outcomeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: palette.primary, borderRadius: 8, padding: 14, alignItems: 'center' },
  secondaryButtonText: { color: palette.primary, fontWeight: '800' },
  outcomeButton: { borderWidth: 1, borderColor: '#B9C9BD', borderRadius: 6, padding: 8 },
  outcomeButtonSelected: { backgroundColor: '#DDEEE3', borderColor: palette.primary },
  outcomeButtonText: { color: '#23452E', fontSize: 12, fontWeight: '700' },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D5DED8', borderRadius: 8, padding: 12 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  button: { backgroundColor: palette.primary, borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE5DF', borderRadius: 8, padding: 14, gap: 8 },
  cardTitle: { color: '#14201B', fontWeight: '800' },
  criteria: { color: palette.muted, lineHeight: 19 },
  outcome: { color: palette.primaryDark, fontWeight: '800' },
});
