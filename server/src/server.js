const { createHash, randomUUID } = require('node:crypto');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { connectAndLoad, isDatabaseConnected, persistRecord, removeRecord } = require('./database');
const {
  assertBrevoConfiguration,
  getBrevoDeliveryErrorMessage,
  sendBrevoNotification,
} = require('./email-notifications');
const learning = require('./learning-data');
const { curriculum } = require('./learning-curriculum');

const {
  buildSeedUsers,
  services,
  opportunities,
  savedOpportunities,
  notifications,
  applications,
  auditLogs,
  sdfWorkforceRecords,
  rolePermissions,
  defaultPermissions,
} = require('./data');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';

const users = buildSeedUsers();
const revokedTokens = new Set();
const announcementEmailTimers = new Map();
const learningRoles = ['learner', 'farmer', 'employer', 'sdf', 'training_provider', 'administrator', 'internal_staff'];
const selfRegistrationRoles = ['learner', 'farmer', 'employer', 'sdf', 'training_provider'];
const roleVerificationFields = {
  learner: [],
  farmer: ['farmName', 'province', 'verificationReference'],
  employer: ['organization', 'registrationNumber', 'workEmail'],
  sdf: ['organization', 'workEmail', 'authorizationReference'],
  training_provider: ['organization', 'registrationBody', 'providerReference'],
};
const opportunityAudiences = ['learner', 'farmer', 'employer', 'sdf', 'training_provider', '*'];
const opportunityCategories = [
  'Employment',
  'Internship',
  'Workplace Opportunity',
  'Bursary',
  'Learnership',
  'Funding',
  'Grants',
  'Training',
  'Mentorship',
  'Business Support',
  'Market Access',
  'Innovation',
  'Skills Development',
  'Training Need',
  'Training Service',
  'Training Partnership',
  'Accreditation',
];
const applicationDocumentTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const maxApplicationDocumentSize = 2 * 1024 * 1024;
const maxApplicationDocumentsSize = 5 * 1024 * 1024;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '8mb' }));

const sanitizeUser = (user, activeRole = user.activeRole || user.roles[0]) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  username: user.username,
  phone: user.phone,
  organization: user.organization,
  roles: user.roles,
  status: user.status,
  activeRole,
  permissions: rolePermissions[activeRole] || defaultPermissions,
  ...(activeRole === 'farmer' ? {
    farmProfile: {
      farmName: user.farmProfile?.farmName || user.roleVerificationDetails?.farmName || '',
      province: user.farmProfile?.province || user.roleVerificationDetails?.province || '',
    },
  } : {}),
  ...(['learner', 'farmer'].includes(activeRole) ? {
    candidateProfile: {
      visible: Boolean(user.candidateProfile?.visible),
      desiredRole: user.candidateProfile?.desiredRole || '',
      province: user.candidateProfile?.province || '',
      summary: user.candidateProfile?.summary || '',
    },
  } : {}),
});

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, jti: randomUUID(), version: user.tokenVersion || 0 },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function normalizeSouthAfricanPhone(value) {
  const phone = String(value || '').replace(/[\s()-]/g, '');
  const normalized = phone.startsWith('0') ? `+27${phone.slice(1)}` : phone;
  return /^\+27\d{9}$/.test(normalized) ? normalized : null;
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find((entry) => entry.id === decoded.sub);

    if (revokedTokens.has(token) || !user || user.status !== 'active' ||
        decoded.version !== (user.tokenVersion || 0)) {
      return res.status(401).json({ message: 'Account is inactive or invalid.' });
    }

    req.user = user;
    req.token = token;
    req.activeRole = user.activeRole || user.roles[0];
    if (!req.activeRole || !user.roles.includes(req.activeRole)) {
      return res.status(401).json({ message: 'Account role assignment is invalid.' });
    }
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Session expired or invalid.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.activeRole !== role) {
      return res.status(403).json({ message: 'You are not permitted to perform this action.' });
    }
    return next();
  };
}

function getOpportunityStatus(opportunity, now = Date.now()) {
  if (opportunity.status !== 'Published') return opportunity.status;
  if (opportunity.closingDate && Date.parse(`${opportunity.closingDate}T23:59:59Z`) < now) return 'Closed';
  if (opportunity.recordExpiresAt && Date.parse(`${opportunity.recordExpiresAt}T23:59:59Z`) < now) return 'Expired';
  return 'Open';
}

function needsVerifiedSource(opportunity) {
  const sourceSensitiveCategories = ['Bursary', 'Funding', 'Grants', 'Training', 'Learnership'];
  return !opportunity.isDemo && (
    (opportunity.role === 'farmer' &&
      ['Funding', 'Grants', 'Training', 'Learnership', 'Mentorship', 'Business Support'].includes(opportunity.category)) ||
    (opportunity.isAdminManaged && sourceSensitiveCategories.includes(opportunity.category))
  );
}

function getOpportunitySourceError(opportunity) {
  if (!needsVerifiedSource(opportunity)) return '';
  const today = new Date().toISOString().slice(0, 10);
  if (!opportunity.sourceName || !isValidSourceUrl(opportunity.sourceUrl) ||
      !isValidIsoDate(opportunity.sourceVerifiedAt) || opportunity.sourceVerifiedAt > today ||
      !isValidIsoDate(opportunity.recordExpiresAt) || opportunity.recordExpiresAt < today ||
      opportunity.recordExpiresAt < opportunity.sourceVerifiedAt ||
      (opportunity.closingDate && opportunity.recordExpiresAt < opportunity.closingDate)) {
    return 'Farmer-facing funding, training, support, and mentorship listings require a source name, HTTP(S) source URL, checked date, and expiry date not earlier than the closing date.';
  }
  return '';
}

function canPublishOpportunity(opportunity) {
  const provider = users.find((entry) => entry.id === opportunity.ownerUserId);
  const isProviderSubmission = opportunity.submittedByRole === 'training_provider' ||
    (!opportunity.submittedByRole && provider?.activeRole === 'training_provider');
  if (!isProviderSubmission) return true;
  return Boolean(provider && provider.status === 'active' && provider.roleVerificationStatus === 'approved');
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidSourceUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

async function addUserNotification(userId, title, message, metadata = {}) {
  const emailEnabled = process.env.BREVO_EMAIL_ENABLED === 'true';
  const notification = {
    id: `note-${randomUUID()}`,
    userId,
    title,
    message,
    read: false,
    emailDeliveryStatus: emailEnabled ? 'pending' : 'disabled',
    ...metadata,
  };
  await persistRecord('notifications', notification);
  notifications.push(notification);

  if (!emailEnabled) return;
  const recipient = users.find((user) => user.id === userId);
  if (!recipient?.email) {
    notification.emailDeliveryStatus = 'failed';
    notification.emailDeliveryError = 'No registered email address is available for this account.';
    console.error(`Email notification ${notification.id} could not be sent: recipient account/email not found.`);
  } else {
    try {
      await sendBrevoNotification({ to: recipient.email, title, message });
      notification.emailDeliveryStatus = 'sent';
      delete notification.emailDeliveryError;
    } catch (error) {
      notification.emailDeliveryStatus = 'failed';
      notification.emailDeliveryError = getBrevoDeliveryErrorMessage(error);
      console.error(`Email notification ${notification.id} failed (${error.code || error.name || 'delivery error'}).`);
    }
  }
  try {
    await persistRecord('notifications', notification);
  } catch (error) {
    console.error(`Email notification status could not be saved for ${notification.id} (${error.code || error.name || 'database error'}).`);
  }
}

async function sendAnnouncementEmails(announcement) {
  if (process.env.BREVO_EMAIL_ENABLED !== 'true') {
    announcement.emailDelivery = { status: 'disabled', recipientCount: 0, sentCount: 0, failedCount: 0 };
    return;
  }
  const recipients = users.filter((user) => {
    if (user.status !== 'active' || !user.email) return false;
    const activeRole = user.activeRole || user.roles[0];
    return announcement.audience.includes('*') || announcement.audience.includes(activeRole);
  });
  let sentCount = 0;
  let failedCount = 0;
  for (let index = 0; index < recipients.length; index += 5) {
    const batch = recipients.slice(index, index + 5);
    const results = await Promise.all(batch.map(async (recipient) => {
      try {
        await sendBrevoNotification({
          to: recipient.email,
          title: announcement.title,
          message: announcement.message,
        });
        return true;
      } catch (error) {
        console.error(`Announcement email ${announcement.id} failed for account ${recipient.id} (${error.code || error.name || 'delivery error'}).`);
        return false;
      }
    }));
    sentCount += results.filter(Boolean).length;
    failedCount += results.filter((result) => !result).length;
  }
  announcement.emailDelivery = {
    status: failedCount === 0 ? (sentCount > 0 ? 'sent' : 'no_recipients') : sentCount > 0 ? 'partial' : 'failed',
    recipientCount: recipients.length,
    sentCount,
    failedCount,
    lastAttemptAt: new Date().toISOString(),
  };
  await persistRecord('notifications', announcement);
}

function cancelAnnouncementEmail(announcementId) {
  const timer = announcementEmailTimers.get(announcementId);
  if (timer) clearTimeout(timer);
  announcementEmailTimers.delete(announcementId);
}

async function dispatchAnnouncementEmails(announcement) {
  cancelAnnouncementEmail(announcement.id);
  if (announcement.status !== 'published') return;
  if (process.env.BREVO_EMAIL_ENABLED !== 'true') {
    announcement.emailDelivery = { status: 'disabled', recipientCount: 0, sentCount: 0, failedCount: 0 };
    await persistRecord('notifications', announcement);
    return;
  }

  const startsAt = announcement.startsAt ? Date.parse(announcement.startsAt) : Date.now();
  const delay = startsAt - Date.now();
  if (delay > 0) {
    announcement.emailDelivery = {
      status: 'scheduled',
      recipientCount: 0,
      sentCount: 0,
      failedCount: 0,
      scheduledFor: announcement.startsAt,
    };
    await persistRecord('notifications', announcement);
    const timer = setTimeout(async () => {
      announcementEmailTimers.delete(announcement.id);
      const current = notifications.find((item) => item.id === announcement.id && item.isAnnouncement);
      if (!current || current.status !== 'published') return;
      if (current.startsAt && Date.parse(current.startsAt) > Date.now()) {
        await dispatchAnnouncementEmails(current);
        return;
      }
      if (current.endsAt && Date.parse(current.endsAt) < Date.now()) {
        current.emailDelivery = { ...current.emailDelivery, status: 'expired' };
        await persistRecord('notifications', current);
        return;
      }
      try {
        await sendAnnouncementEmails(current);
      } catch (error) {
        console.error(`Scheduled announcement email failed for ${current.id} (${error.code || error.name || 'delivery error'}).`);
      }
    }, Math.min(delay, 2_147_000_000));
    timer.unref();
    announcementEmailTimers.set(announcement.id, timer);
    return;
  }
  if (announcement.endsAt && Date.parse(announcement.endsAt) < Date.now()) {
    announcement.emailDelivery = { status: 'expired', recipientCount: 0, sentCount: 0, failedCount: 0 };
    await persistRecord('notifications', announcement);
    return;
  }
  await sendAnnouncementEmails(announcement);
}

function getPublicOpportunityResponse(opportunity, extra = {}) {
  return {
    id: opportunity.id,
    title: opportunity.title,
    type: opportunity.type,
    category: opportunity.category,
    status: getOpportunityStatus(opportunity),
    role: opportunity.role,
    description: opportunity.description,
    organization: opportunity.organization,
    location: opportunity.location,
    employmentType: opportunity.employmentType,
    requirements: opportunity.requirements || [],
    qualifications: opportunity.qualifications || '',
    trainingObjectives: opportunity.trainingObjectives || '',
    requiredSkills: opportunity.requiredSkills || [],
    participantCount: opportunity.participantCount ?? null,
    startDate: opportunity.startDate || null,
    endDate: opportunity.endDate || null,
    accreditation: opportunity.accreditation || '',
    duration: opportunity.duration || '',
    deliveryMethod: opportunity.deliveryMethod || '',
    capacity: opportunity.capacity ?? null,
    fees: opportunity.fees ?? null,
    benefits: opportunity.benefits || [],
    eligibility: opportunity.eligibility || [],
    requiredDocuments: opportunity.requiredDocuments || [],
    applicationInstructions: opportunity.applicationInstructions || '',
    applicationUrl: opportunity.applicationUrl || '',
    openingDate: opportunity.openingDate,
    closingDate: opportunity.closingDate,
    sourceName: opportunity.sourceName || '',
    sourceUrl: opportunity.sourceUrl || '',
    sourceVerifiedAt: opportunity.sourceVerifiedAt || '',
    recordExpiresAt: opportunity.recordExpiresAt || '',
    dataStatus: opportunity.dataStatus,
    isDemo: Boolean(opportunity.isDemo),
    ...extra,
  };
}

function getOpportunityInput(body, { employer = false, draft = false } = {}) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const location = typeof body.location === 'string' ? body.location.trim() : '';
  const applicationInstructions = typeof body.applicationInstructions === 'string'
    ? body.applicationInstructions.trim()
    : '';
  const applicationUrl = typeof body.applicationUrl === 'string' ? body.applicationUrl.trim() : '';
  const closingDate = typeof body.closingDate === 'string' ? body.closingDate.trim() : '';
  const sourceName = typeof body.sourceName === 'string' ? body.sourceName.trim() : '';
  const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '';
  const sourceVerifiedAt = typeof body.sourceVerifiedAt === 'string' ? body.sourceVerifiedAt.trim() : '';
  const recordExpiresAt = typeof body.recordExpiresAt === 'string' ? body.recordExpiresAt.trim() : '';
  const category = employer ? String(body.category || 'Employment').trim() : String(body.category || '').trim();
  const isEmployerTrainingNeed = employer && category === 'Training Need';
  const type = employer ? (isEmployerTrainingNeed ? 'Training Need' : category) : String(body.type || category).trim();
  const role = employer
    ? isEmployerTrainingNeed
      ? String(body.role || 'training_provider').trim()
      : String(body.role || 'learner').trim()
    : String(body.role || '').trim();
  const employmentType = typeof body.employmentType === 'string' ? body.employmentType.trim() : '';
  const qualifications = typeof body.qualifications === 'string' ? body.qualifications.trim() : '';
  const trainingObjectives = typeof body.trainingObjectives === 'string' ? body.trainingObjectives.trim() : '';
  const accreditation = typeof body.accreditation === 'string' ? body.accreditation.trim() : '';
  const duration = typeof body.duration === 'string' ? body.duration.trim() : '';
  const deliveryMethod = typeof body.deliveryMethod === 'string' ? body.deliveryMethod.trim() : '';
  const startDate = typeof body.startDate === 'string' ? body.startDate.trim() : '';
  const endDate = typeof body.endDate === 'string' ? body.endDate.trim() : '';
  const participantCount = body.participantCount === '' || body.participantCount === undefined || body.participantCount === null
    ? null
    : Number(body.participantCount);
  const capacity = body.capacity === '' || body.capacity === undefined || body.capacity === null
    ? null
    : Number(body.capacity);
  const fees = body.fees === '' || body.fees === undefined || body.fees === null ? null : Number(body.fees);
  const requiredSkills = Array.isArray(body.requiredSkills)
    ? body.requiredSkills.filter((entry) => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
    : typeof body.requiredSkills === 'string'
      ? body.requiredSkills.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)
      : [];
  const requirements = Array.isArray(body.requirements)
    ? body.requirements.filter((entry) => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
    : typeof body.requirements === 'string'
      ? body.requirements.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)
      : [];
  const requiredDocuments = Array.isArray(body.requiredDocuments)
    ? body.requiredDocuments.filter((entry) => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
    : typeof body.requiredDocuments === 'string'
      ? body.requiredDocuments.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)
      : [];

  if (!title || title.length > 120 || !description || description.length > 2000 ||
      location.length > 120 || applicationInstructions.length > 1000 || applicationUrl.length > 500 ||
      sourceName.length > 160 || sourceUrl.length > 500 ||
      sourceVerifiedAt.length > 10 || recordExpiresAt.length > 10 ||
      employmentType.length > 80 || qualifications.length > 500 ||
      trainingObjectives.length > 2000 || accreditation.length > 250 ||
      duration.length > 80 || !['', 'Online', 'Physical', 'Hybrid'].includes(deliveryMethod) ||
      requiredSkills.length > 20 || requiredSkills.some((entry) => entry.length > 160) ||
      requirements.length > 20 || requirements.some((entry) => entry.length > 240) ||
      requiredDocuments.length > 5 || requiredDocuments.some((entry) =>
        entry.length > 160 || /identity|passport|bank account|health|medical|biometric/i.test(entry)
      ) || new Set(requiredDocuments).size !== requiredDocuments.length) {
    return { error: 'Provide a title, description, and valid opportunity details within the allowed lengths.' };
  }
  if (!draft && (!location || !applicationInstructions || !closingDate)) {
    return { error: 'Provide a location, application instructions, and deadline before submitting for review.' };
  }
  if (!draft && !employer && !(typeof body.organization === 'string' && body.organization.trim())) {
    return { error: 'Provide the organisation or funding source before submitting for review.' };
  }
  if (sourceUrl && !isValidSourceUrl(sourceUrl)) {
    return { error: 'The source URL must use HTTP or HTTPS.' };
  }
  if (applicationUrl && !isValidSourceUrl(applicationUrl)) {
    return { error: 'The application URL must use HTTP or HTTPS.' };
  }
  if (sourceVerifiedAt && (!isValidIsoDate(sourceVerifiedAt) ||
      sourceVerifiedAt > new Date().toISOString().slice(0, 10))) {
    return { error: 'The source checked date must be a valid date no later than today.' };
  }
  if (recordExpiresAt && !isValidIsoDate(recordExpiresAt)) {
    return { error: 'The listing expiry must be a valid date in YYYY-MM-DD format.' };
  }
  if (!draft && (!isValidIsoDate(closingDate) ||
      Date.parse(`${closingDate}T23:59:59Z`) < Date.now())) {
    return { error: 'The application deadline must be a valid future date.' };
  }
  for (const date of [startDate, endDate]) {
    if (date && !isValidIsoDate(date)) {
      return { error: 'Programme start and end dates must be valid dates in YYYY-MM-DD format.' };
    }
  }
  if (startDate && endDate && startDate > endDate) {
    return { error: 'The programme end date cannot be before its start date.' };
  }
  if ([participantCount, capacity].some((value) => value !== null && (!Number.isInteger(value) || value < 1 || value > 10000)) ||
      (fees !== null && (!Number.isFinite(fees) || fees < 0 || fees > 10000000))) {
    return { error: 'Participant counts and capacity must be whole numbers from 1 to 10,000; fees must be a non-negative amount.' };
  }
  if (!opportunityCategories.includes(category) || !opportunityAudiences.includes(role)) {
    return { error: 'Choose a supported opportunity category and eligible audience.' };
  }
  if (employer && !['Employment', 'Internship', 'Workplace Opportunity', 'Training Need'].includes(category)) {
    return { error: 'Choose a job, internship, workplace opportunity, or employee training need.' };
  }
  if (employer && isEmployerTrainingNeed &&
      (!['training_provider', 'sdf'].includes(role) || !trainingObjectives || requiredSkills.length === 0 ||
       !participantCount || !startDate || !endDate)) {
    return { error: 'Training needs require a training provider or SDF audience, objectives, priority skills, employee count, and programme dates.' };
  }
  if (employer && !isEmployerTrainingNeed && (!employmentType || requirements.length === 0 || !qualifications)) {
    return { error: 'Job, internship, and workplace listings require an employment type, qualifications, and at least one requirement.' };
  }
  return {
    value: {
      title,
      description,
      location,
      applicationInstructions,
      applicationUrl,
      closingDate: closingDate || null,
      sourceName,
      sourceUrl,
      sourceVerifiedAt,
      recordExpiresAt,
      category,
      type,
      role,
      employmentType,
      qualifications,
      trainingObjectives,
      requiredSkills,
      participantCount,
      startDate: startDate || null,
      endDate: endDate || null,
      accreditation,
      duration,
      deliveryMethod,
      capacity,
      fees,
      requirements,
      requiredDocuments,
      eligibility: [role === '*' ? 'Eligible audiences vary by opportunity.' : role.replace('_', ' ')],
    },
  };
}

function getOpportunitySupportingDocuments(input) {
  if (!Array.isArray(input) || input.length > 5) {
    return { error: 'Attach up to five supporting documents.' };
  }
  const documents = [];
  let totalSize = 0;
  for (const document of input) {
    if (!document || typeof document !== 'object' || Array.isArray(document) ||
        typeof document.filename !== 'string' || typeof document.mimeType !== 'string' ||
        typeof document.data !== 'string' || !Number.isInteger(document.size)) {
      return { error: 'Each supporting document must include a filename and valid file data.' };
    }
    const filename = document.filename.trim().replace(/^.*[\\/]/, '');
    const extension = filename.split('.').pop()?.toLowerCase();
    const validExtension = document.mimeType === 'application/pdf'
      ? extension === 'pdf'
      : document.mimeType === 'image/png'
        ? extension === 'png'
        : extension === 'jpg' || extension === 'jpeg';
    const encoded = document.data;
    if (!filename || filename.length > 180 || !applicationDocumentTypes.has(document.mimeType) ||
        !validExtension || encoded.length > Math.ceil(maxApplicationDocumentSize * 4 / 3) + 4 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
      return { error: 'Supporting documents must be PDF, JPG, or PNG files no larger than 2 MB each.' };
    }
    const bytes = Buffer.from(encoded, 'base64');
    const validSignature = document.mimeType === 'application/pdf'
      ? bytes.subarray(0, 5).toString('ascii') === '%PDF-'
      : document.mimeType === 'image/png'
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!bytes.length || bytes.length > maxApplicationDocumentSize ||
        bytes.length !== document.size || bytes.toString('base64') !== encoded || !validSignature) {
      return { error: 'A supporting document is empty, oversized, or does not match its selected file type.' };
    }
    totalSize += bytes.length;
    if (totalSize > maxApplicationDocumentsSize) {
      return { error: 'Supporting documents together must be 5 MB or smaller.' };
    }
    documents.push({
      id: randomUUID(),
      filename,
      mimeType: document.mimeType,
      size: bytes.length,
      data: encoded,
      uploadedAt: new Date().toISOString(),
    });
  }
  return { value: documents };
}

function getOpportunityManagementResponse(opportunity, { administrator = false } = {}) {
  const { supportingDocuments = [], contactEmail, submittedBy, ...safeOpportunity } = opportunity;
  return {
    ...safeOpportunity,
    ...(administrator ? { submittedBy, contactEmail } : {}),
    supportingDocuments: supportingDocuments.map(({ data, ...metadata }) => metadata),
  };
}

function getApplicationData(input, user) {
  const data = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const fullName = typeof data.fullName === 'string' ? data.fullName.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const phone = typeof data.phone === 'string' ? data.phone.trim() : '';
  const motivation = typeof data.motivation === 'string' ? data.motivation.trim() : '';
  if (!fullName || fullName.length > 160 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160 ||
      phone.length > 30 || (phone && !/^[+0-9()\s-]{7,30}$/.test(phone)) ||
      motivation.length < 10 || motivation.length > 1000 || data.consent !== true) {
    return { error: 'Enter your name, a valid email address, optional phone number, a short motivation, and confirm the privacy notice.' };
  }
  if (email !== user.email.toLowerCase()) {
    return { error: 'Use the email address on your signed-in account for this application.' };
  }
  return {
    value: {
      fullName,
      email,
      phone,
      motivation,
      consentedAt: new Date().toISOString(),
    },
  };
}

function getApplicationDocuments(input, requiredDocuments) {
  if (!Array.isArray(input) || input.length > 5) {
    return { error: 'Upload each required document. You can attach up to five files.' };
  }
  const documents = [];
  let totalSize = 0;
  for (const document of input) {
    if (!document || typeof document !== 'object' || Array.isArray(document) ||
        typeof document.requirement !== 'string' ||
        !requiredDocuments.includes(document.requirement) ||
        typeof document.filename !== 'string' || typeof document.mimeType !== 'string' ||
        typeof document.data !== 'string' || !Number.isInteger(document.size)) {
      return { error: 'Each upload must match a document requested for this listing.' };
    }
    const filename = document.filename.trim().replace(/^.*[\\/]/, '');
    const encoded = document.data;
    const extension = filename.split('.').pop()?.toLowerCase();
    const validExtension = document.mimeType === 'application/pdf'
      ? extension === 'pdf'
      : document.mimeType === 'image/png'
        ? extension === 'png'
        : extension === 'jpg' || extension === 'jpeg';
    if (!filename || filename.length > 180 || !applicationDocumentTypes.has(document.mimeType) ||
        !validExtension ||
        encoded.length > Math.ceil(maxApplicationDocumentSize * 4 / 3) + 4 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
      return { error: 'Documents must be PDF, JPG, or PNG files no larger than 2 MB each.' };
    }
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length === 0 || bytes.length > maxApplicationDocumentSize ||
        bytes.length !== document.size || bytes.toString('base64') !== encoded) {
      return { error: 'The uploaded document is empty, too large, or invalid.' };
    }
    const validSignature = document.mimeType === 'application/pdf'
      ? bytes.subarray(0, 5).toString('ascii') === '%PDF-'
      : document.mimeType === 'image/png'
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!validSignature) {
      return { error: 'The file contents do not match the selected PDF, JPG, or PNG type.' };
    }
    totalSize += bytes.length;
    if (totalSize > maxApplicationDocumentsSize) {
      return { error: 'All uploaded documents together must be 5 MB or smaller.' };
    }
    documents.push({
      id: randomUUID(),
      requirement: document.requirement,
      filename,
      mimeType: document.mimeType,
      size: bytes.length,
      data: encoded,
      uploadedAt: new Date().toISOString(),
    });
  }
  if (new Set(documents.map((entry) => entry.requirement)).size !== documents.length ||
      requiredDocuments.some((requirement) => !documents.some((entry) => entry.requirement === requirement))) {
    return { error: 'Upload one file for every required document before submitting.' };
  }
  return { value: documents };
}

function getApplicationResponse(application) {
  const { documents = [], ...safeApplication } = application;
  return {
    ...safeApplication,
    documents: documents.map(({ data, ...metadata }) => metadata),
  };
}

app.get('/health', (req, res) => {
  const databaseReady = isDatabaseConnected();
  return res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ok' : 'unavailable',
    service: 'myagriseta-backend',
    storage: databaseReady ? 'neon' : 'unavailable',
    emailNotifications: process.env.BREVO_EMAIL_ENABLED === 'true' ? 'enabled' : 'disabled',
  });
});

app.post('/api/auth/register', async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const { firstName, lastName, email, username, password, role } = body;

  if (![firstName, lastName, email, username, password, role].every((value) => typeof value === 'string' && value.trim())) {
    return res.status(400).json({ message: 'Name, email, username, password, and role are required.' });
  }
  if (['roles', 'activeRole', 'status', 'permissions', 'roleVerificationStatus'].some((field) => Object.hasOwn(body, field))) {
    return res.status(400).json({ message: 'Account roles, permissions, and status are assigned by the server.' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();
  if (firstName.trim().length > 80 || lastName.trim().length > 80) {
    return res.status(400).json({ message: 'Names must be 80 characters or fewer.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'A valid email address is required.' });
  }
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username.trim())) {
    return res.status(400).json({ message: 'Username must be 3 to 30 letters, numbers, dots, underscores or hyphens.' });
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.' });
  }
  if (!selfRegistrationRoles.includes(role)) {
    return res.status(400).json({ message: 'Choose an available public account role.' });
  }

  const requiredFields = roleVerificationFields[role];
  const details = role === 'learner' && body.verificationDetails === undefined ? {} : body.verificationDetails;
  if (!details || typeof details !== 'object' || Array.isArray(details) ||
      Object.keys(details).some((field) => !requiredFields.includes(field))) {
    return res.status(400).json({ message: 'Provide only the verification fields required for the selected role.' });
  }
  for (const field of requiredFields) {
    if (typeof details[field] !== 'string' || !details[field].trim() || details[field].trim().length > 160) {
      return res.status(400).json({ message: `Provide a valid ${field.replace(/([A-Z])/g, ' $1').toLowerCase()} (160 characters maximum).` });
    }
  }
  const verificationDetails = Object.fromEntries(
    requiredFields.map((field) => [field, details[field].trim()])
  );
  if (['employer', 'sdf'].includes(role) &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verificationDetails.workEmail)) {
    return res.status(400).json({ message: 'Enter a valid work email address.' });
  }
  const reference = role === 'farmer' ? verificationDetails.verificationReference
    : role === 'employer' ? verificationDetails.registrationNumber
      : role === 'sdf' ? verificationDetails.authorizationReference
        : role === 'training_provider' ? verificationDetails.providerReference : '';
  if (reference && reference.replace(/[^a-z0-9]/gi, '').length < 4) {
    return res.status(400).json({ message: 'Enter a valid role registration reference.' });
  }
  const roleKeyText = role === 'farmer'
    ? `farmer:${verificationDetails.farmName.toLowerCase()}:${verificationDetails.province.toLowerCase()}:${reference.replace(/[^a-z0-9]/gi, '').toLowerCase()}`
    : role === 'employer'
      ? `employer:${reference.replace(/[^a-z0-9]/gi, '').toLowerCase()}`
      : role === 'sdf'
        ? `sdf:${verificationDetails.organization.toLowerCase()}:${reference.replace(/[^a-z0-9]/gi, '').toLowerCase()}`
        : role === 'training_provider'
          ? `training_provider:${verificationDetails.registrationBody.toLowerCase()}:${reference.replace(/[^a-z0-9]/gi, '').toLowerCase()}`
          : '';
  const roleVerificationKey = roleKeyText ? createHash('sha256').update(roleKeyText).digest('hex') : undefined;
  const phone = body.phone ? normalizeSouthAfricanPhone(body.phone) : '';
  if (body.phone && !phone) return res.status(400).json({ message: 'Enter a valid South African phone number.' });
  if (users.some((entry) =>
    entry.email.toLowerCase() === normalizedEmail ||
    entry.username.toLowerCase() === normalizedUsername ||
    (phone && entry.phone === phone) ||
    (roleVerificationKey && entry.roleVerificationKey === roleVerificationKey)
  )) {
    return res.status(409).json({ message: 'An account already exists for these contact details or role reference.' });
  }

  const learner = role === 'learner';
  const user = {
    id: `usr-${randomUUID()}`,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: normalizedEmail,
    username: username.trim(),
    passwordHash: await bcrypt.hash(password, 10),
    roles: [role],
    activeRole: role,
    status: learner ? 'active' : 'inactive',
    phone: phone || '',
    organization: verificationDetails.organization || '',
    roleVerificationStatus: learner ? 'approved' : 'pending',
    roleVerificationDetails: learner ? null : verificationDetails,
    roleVerificationKey,
    roleVerificationSubmittedAt: new Date().toISOString(),
    roleVerificationReviewedAt: learner ? new Date().toISOString() : null,
    roleVerificationReviewedBy: learner ? 'automatic learner registration' : null,
    roleVerificationNote: '',
  };
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: user.email,
    action: learner ? 'Created learner account through self-registration' : `Submitted a ${role} role verification request`,
    timestamp: new Date().toISOString(),
  };
  try {
    await persistRecord('users', user);
    await persistRecord('auditLogs', auditEntry);
  } catch (error) {
    if (error?.code === '23505' || error?.code === 11000) {
      return res.status(409).json({ message: 'An account already exists for these contact details or role reference.' });
    }
    throw error;
  }
  users.push(user);
  auditLogs.push(auditEntry);
  return res.status(learner ? 201 : 202).json({
    message: learner
      ? 'Account created. You can sign in now.'
      : 'Registration submitted. An administrator must review this role before sign-in is enabled.',
    role,
    status: user.status,
    roleVerificationStatus: user.roleVerificationStatus,
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body || {};

  if (!identifier || !password) {
    return res.status(400).json({ message: 'Email or username and password are required.' });
  }

  const normalizedIdentifier = normalizeSouthAfricanPhone(identifier);
  const user = users.find(
    (entry) =>
      entry.email.toLowerCase() === String(identifier).trim().toLowerCase() ||
      entry.username.toLowerCase() === String(identifier).trim().toLowerCase() ||
      (normalizedIdentifier !== null && entry.phone === normalizedIdentifier)
  );

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const validPassword = await bcrypt.compare(String(password), user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }
  if (user.roleVerificationStatus === 'pending') {
    return res.status(403).json({ message: 'Your role verification is still under review. You can sign in after it is approved.' });
  }
  if (user.roleVerificationStatus === 'rejected') {
    return res.status(403).json({ message: 'Your role verification was not approved. Contact support before submitting another request.' });
  }
  if (user.status !== 'active') {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const activeRole = user.activeRole || user.roles[0];
  const token = issueToken(user);

  return res.json({
    token,
    user: sanitizeUser(user, activeRole),
    availableRoles: user.roles,
    activeRole,
  });
});

app.get('/api/auth/roles', authenticate, (req, res) => {
  return res.json({
    availableRoles: req.user.roles,
    activeRole: req.activeRole,
  });
});

app.get('/api/me', authenticate, (req, res) => {
  return res.json({ user: sanitizeUser(req.user, req.activeRole) });
});

app.patch('/api/me', authenticate, async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const allowedFields = new Set(['firstName', 'lastName', 'phone', 'organization']);
  if (req.activeRole === 'farmer') {
    allowedFields.add('farmName');
    allowedFields.add('province');
  }
  const canManageCandidateProfile = ['learner', 'farmer'].includes(req.activeRole);
  if (canManageCandidateProfile) {
    ['candidateVisible', 'candidateDesiredRole', 'candidateProvince', 'candidateSummary']
      .forEach((field) => allowedFields.add(field));
  }
  const suppliedFields = Object.keys(body);

  if (suppliedFields.length === 0 || suppliedFields.some((field) => !allowedFields.has(field))) {
    return res.status(400).json({
      message: 'Update at least one editable profile field. Login details, roles, permissions, and account status cannot be changed here.',
    });
  }

  const updatedUser = { ...req.user };
  for (const field of ['firstName', 'lastName']) {
    if (!Object.hasOwn(body, field)) continue;
    if (typeof body[field] !== 'string' || !body[field].trim() || body[field].trim().length > 80) {
      return res.status(400).json({ message: `${field === 'firstName' ? 'First' : 'Last'} name is required and must be 80 characters or fewer.` });
    }
    updatedUser[field] = body[field].trim();
  }

  if (Object.hasOwn(body, 'phone')) {
    if (typeof body.phone !== 'string') {
      return res.status(400).json({ message: 'Phone number must be text; leave it blank to clear it.' });
    }
    const phone = body.phone.trim() ? normalizeSouthAfricanPhone(body.phone) : '';
    if (phone === null) {
      return res.status(400).json({ message: 'Enter a valid South African phone number or leave it blank.' });
    }
    if (phone && users.some((user) => user.id !== req.user.id && user.phone === phone)) {
      return res.status(409).json({ message: 'This phone number is already associated with another account.' });
    }
    updatedUser.phone = phone;
  }

  if (Object.hasOwn(body, 'organization')) {
    if (typeof body.organization !== 'string' || body.organization.trim().length > 160) {
      return res.status(400).json({ message: 'Organisation must be 160 characters or fewer.' });
    }
    updatedUser.organization = body.organization.trim();
  }

  if (req.activeRole === 'farmer' && (Object.hasOwn(body, 'farmName') || Object.hasOwn(body, 'province'))) {
    const currentFarmProfile = {
      farmName: updatedUser.farmProfile?.farmName || updatedUser.roleVerificationDetails?.farmName || '',
      province: updatedUser.farmProfile?.province || updatedUser.roleVerificationDetails?.province || '',
      ...updatedUser.farmProfile,
    };
    for (const [field, maximumLength] of [['farmName', 120], ['province', 60]]) {
      if (!Object.hasOwn(body, field)) continue;
      if (typeof body[field] !== 'string' || body[field].trim().length > maximumLength) {
        return res.status(400).json({
          message: `${field === 'farmName' ? 'Farm name' : 'Province'} must be text with ${maximumLength} characters or fewer.`,
        });
      }
      currentFarmProfile[field] = body[field].trim();
    }
    updatedUser.farmProfile = currentFarmProfile;
  }

  if (canManageCandidateProfile && suppliedFields.some((field) => field.startsWith('candidate'))) {
    const currentProfile = {
      visible: Boolean(updatedUser.candidateProfile?.visible),
      desiredRole: updatedUser.candidateProfile?.desiredRole || '',
      province: updatedUser.candidateProfile?.province || '',
      summary: updatedUser.candidateProfile?.summary || '',
      consentedAt: updatedUser.candidateProfile?.consentedAt || null,
      publicId: updatedUser.candidateProfile?.publicId || null,
    };
    for (const [field, maximumLength, label] of [
      ['candidateDesiredRole', 120, 'Desired role'],
      ['candidateProvince', 60, 'Preferred province'],
      ['candidateSummary', 500, 'Candidate summary'],
    ]) {
      if (!Object.hasOwn(body, field)) continue;
      if (typeof body[field] !== 'string' || body[field].trim().length > maximumLength) {
        return res.status(400).json({ message: `${label} must be text with ${maximumLength} characters or fewer.` });
      }
      currentProfile[field.replace('candidate', '').replace(/^./, (letter) => letter.toLowerCase())] = body[field].trim();
    }
    if (Object.hasOwn(body, 'candidateVisible')) {
      if (typeof body.candidateVisible !== 'boolean') {
        return res.status(400).json({ message: 'Candidate profile visibility must be true or false.' });
      }
      if (body.candidateVisible && !currentProfile.desiredRole) {
        return res.status(400).json({ message: 'Add a desired role before sharing your candidate profile.' });
      }
      currentProfile.visible = body.candidateVisible;
      currentProfile.consentedAt = body.candidateVisible
        ? currentProfile.consentedAt || new Date().toISOString()
        : null;
      if (body.candidateVisible && !currentProfile.publicId) currentProfile.publicId = randomUUID();
    }
    if (currentProfile.visible && !currentProfile.desiredRole) {
      return res.status(400).json({ message: 'A visible candidate profile must include a desired role.' });
    }
    updatedUser.candidateProfile = currentProfile;
  }

  try {
    await persistRecord('users', updatedUser);
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({ message: 'The phone number is already associated with another account.' });
    }
    throw error;
  }

  Object.assign(req.user, updatedUser);
  return res.json({ user: sanitizeUser(updatedUser, req.activeRole) });
});

app.get('/api/dashboard', authenticate, (req, res) => {
  const role = req.activeRole;
  const isAdministrator = role === 'administrator';
  const isInternalStaff = role === 'internal_staff';
  const eligibleServices = services.filter((service) =>
    service.eligibility.includes(role) || isAdministrator || isInternalStaff
  );
  const matchingOpportunities = opportunities.filter((opportunity) =>
    opportunity.status === 'Published' &&
    (opportunity.role === role || opportunity.role === '*' || isAdministrator || isInternalStaff)
  );
  const userApplications = applications.filter((application) => application.applicantId === req.user.id);
  const openOpportunities = matchingOpportunities.filter((opportunity) => getOpportunityStatus(opportunity) === 'Open');

  const roleContent = {
    learner: {
      title: 'Learner dashboard',
      description: 'Track your applications and find learning opportunities.',
      servicesTitle: 'Learning services',
      opportunitiesTitle: 'Opportunities for learners',
      applicationsTitle: 'My applications',
      metrics: [
        { label: 'My applications', value: userApplications.length },
        { label: 'Learning services', value: eligibleServices.length },
        { label: 'Open opportunities', value: openOpportunities.length },
      ],
    },
    farmer: {
      title: 'Farmer dashboard',
      description: 'Find farm support and follow your submitted applications.',
      servicesTitle: 'Farmer support services',
      opportunitiesTitle: 'Farming opportunities',
      applicationsTitle: 'My applications',
      metrics: [
        { label: 'My applications', value: userApplications.length },
        { label: 'Farm support services', value: eligibleServices.length },
        { label: 'Open opportunities', value: openOpportunities.length },
      ],
    },
    employer: {
      title: 'Employer dashboard',
      description: 'Explore workforce development services and employer opportunities.',
      servicesTitle: 'Employer services',
      opportunitiesTitle: 'Employer opportunities',
      applicationsTitle: 'My applications',
      metrics: [
        { label: 'My applications', value: userApplications.length },
        { label: 'Employer services', value: eligibleServices.length },
        { label: 'Open opportunities', value: openOpportunities.length },
      ],
    },
    sdf: {
      title: 'Skills development dashboard',
      description: 'Review skills development services relevant to your role.',
      servicesTitle: 'Skills development services',
      opportunitiesTitle: 'Skills development opportunities',
      applicationsTitle: 'My applications',
      metrics: [
        { label: 'My applications', value: userApplications.length },
        { label: 'Relevant services', value: eligibleServices.length },
        { label: 'Open opportunities', value: openOpportunities.length },
      ],
    },
    training_provider: {
      title: 'Training provider dashboard',
      description: 'Review provider opportunities and available platform services.',
      servicesTitle: 'Provider services',
      opportunitiesTitle: 'Provider opportunities',
      applicationsTitle: 'My submissions',
      metrics: [
        { label: 'My submissions', value: userApplications.length },
        { label: 'Provider services', value: eligibleServices.length },
        { label: 'Open opportunities', value: openOpportunities.length },
      ],
    },
  };

  if (isAdministrator) {
    return res.json({
      userRole: role,
      title: 'Administration dashboard',
      description: 'Monitor accounts and recent administrative activity.',
      metrics: [
        { label: 'User accounts', value: users.length },
        { label: 'Active accounts', value: users.filter((user) => user.status === 'active').length },
        { label: 'Inactive accounts', value: users.filter((user) => user.status !== 'active').length },
        ...['learner', 'farmer', 'employer', 'sdf', 'training_provider'].map((assignedRole) => ({
          label: `${assignedRole.replace('_', ' ')} accounts`,
          value: users.filter((user) => user.roles.includes(assignedRole)).length,
        })),
        { label: 'Audit events', value: auditLogs.length },
      ],
      sections: [
        {
          title: 'Recent administrative activity',
          emptyState: 'No administrative activity is available.',
          items: auditLogs.slice(-5).reverse().map((entry) => ({
            id: entry.id,
            title: entry.action,
            body: `${entry.user} | ${entry.timestamp}`,
          })),
        },
      ],
    });
  }

  if (isInternalStaff) {
    return res.json({
      userRole: role,
      title: 'Staff dashboard',
      description: 'Review application and submission work assigned to staff functions.',
      metrics: [
        { label: 'Applications in queue', value: applications.length },
        { label: 'Review opportunities', value: matchingOpportunities.filter((item) => item.type === 'Review').length },
        { label: 'Available services', value: eligibleServices.length },
      ],
      sections: [
        {
          title: 'Application review queue',
          emptyState: 'There are no applications to review.',
          items: applications.slice(0, 5).map((application) => ({
            id: application.id,
            title: application.serviceName,
            body: `${application.status} | ${application.submittedAt}`,
          })),
        },
        {
          title: 'Submission review opportunities',
          emptyState: 'There are no review opportunities available.',
          items: matchingOpportunities.filter((item) => item.type === 'Review').map((item) => ({
            id: item.id,
            title: item.title,
            body: `${item.type} | ${item.status}`,
          })),
        },
      ],
    });
  }

  const content = roleContent[role] || roleContent.learner;
  return res.json({
    userRole: role,
    title: content.title,
    description: content.description,
    metrics: content.metrics,
    sections: [
      {
        title: content.servicesTitle,
        emptyState: 'No services are currently available for your role.',
        items: eligibleServices.slice(0, 5).map((service) => ({
          id: service.id,
          title: service.name,
          body: service.description,
        })),
      },
      {
        title: content.opportunitiesTitle,
        emptyState: 'No opportunities are currently available for your role.',
        items: matchingOpportunities.map((opportunity) => ({
          id: opportunity.id,
          title: opportunity.title,
          body: `${opportunity.type} | ${opportunity.status}`,
        })),
      },
      {
        title: content.applicationsTitle,
        emptyState: 'You have no applications yet.',
        items: userApplications.map((application) => ({
          id: application.id,
          title: application.serviceName,
          body: `${application.status} | ${application.submittedAt}`,
        })),
      },
    ],
  });
});

app.get('/api/services', authenticate, (req, res) => {
  const filteredServices = services.filter((service) =>
    service.eligibility.includes(req.activeRole) || req.activeRole === 'administrator' || req.activeRole === 'internal_staff'
  );
  return res.json({
    services: filteredServices.map((service) => ({
      ...service,
      requiredDocuments: service.requiredDocuments || [],
    })),
  });
});

app.get('/api/services/:id', authenticate, (req, res) => {
  const service = services.find((entry) => entry.id === req.params.id);

  const canView = service && (
    service.eligibility.includes(req.activeRole) ||
    req.activeRole === 'administrator' ||
    req.activeRole === 'internal_staff'
  );
  if (!canView) {
    return res.status(404).json({ message: 'Service not found.' });
  }

  return res.json({ service: { ...service, requiredDocuments: service.requiredDocuments || [] } });
});

app.get('/api/farmer/market', authenticate, (req, res) => {
  if (req.activeRole !== 'farmer') {
    return res.status(403).json({ message: 'Only farmers can view curated market information.' });
  }
  const today = new Date().toISOString().slice(0, 10);
  const records = learning.farmerMarketRecords
    .filter((entry) => entry.status === 'published' && entry.expiresAt >= today)
    .sort((left, right) => right.observedAt.localeCompare(left.observedAt))
    .map(({ id, commodity, grade, market, province, price, unit, observedAt, sourceName, sourceUrl, verifiedAt, expiresAt }) => ({
      id, commodity, grade, market, province, price, unit, observedAt, sourceName, sourceUrl, verifiedAt, expiresAt,
    }));
  return res.json({ records, serverDate: today });
});

app.get('/api/farmer/mentors', authenticate, (req, res) => {
  if (req.activeRole !== 'farmer') {
    return res.status(403).json({ message: 'Only farmers can view the mentor directory.' });
  }
  const today = new Date().toISOString().slice(0, 10);
  const mentors = learning.farmerMentors
    .filter((entry) => entry.status === 'active' && entry.expiresAt >= today && entry.consentToList && entry.consentToShare)
    .map(({ id, name, province, expertise, biography, sourceName, sourceUrl, verifiedAt, expiresAt }) => ({
      id, name, province, expertise, biography, sourceName, sourceUrl, verifiedAt, expiresAt,
    }));
  return res.json({ mentors });
});

app.get('/api/farmer/mentor-requests', authenticate, (req, res) => {
  if (req.activeRole !== 'farmer') {
    return res.status(403).json({ message: 'Only farmers can view their mentor requests.' });
  }
  const requests = learning.farmerMentorRequests
    .filter((entry) => entry.farmerId === req.user.id)
    .map((entry) => {
      const mentor = learning.farmerMentors.find((candidate) => candidate.id === entry.mentorId);
      return {
        id: entry.id,
        mentorName: mentor?.name || 'Mentor record unavailable',
        status: entry.status,
        message: entry.message,
        feedback: entry.feedback || '',
        submittedAt: entry.submittedAt,
        ...(entry.status === 'Connected' && mentor?.status === 'active' && mentor?.consentToList &&
          mentor?.expiresAt >= new Date().toISOString().slice(0, 10) && mentor?.consentToShare
          ? { mentorContactEmail: mentor.contactEmail }
          : {}),
      };
    });
  return res.json({ requests });
});

app.post('/api/farmer/mentors/:id/requests', authenticate, async (req, res) => {
  if (req.activeRole !== 'farmer') {
    return res.status(403).json({ message: 'Only farmers can request a mentor introduction.' });
  }
  const today = new Date().toISOString().slice(0, 10);
  const mentor = learning.farmerMentors.find((entry) =>
    entry.id === req.params.id && entry.status === 'active' && entry.expiresAt >= today &&
    entry.consentToList && entry.consentToShare
  );
  if (!mentor) return res.status(404).json({ message: 'This mentor is not currently available.' });
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (message.length < 10 || message.length > 500) {
    return res.status(400).json({ message: 'Explain what guidance you need in 10 to 500 characters.' });
  }
  const existing = learning.farmerMentorRequests.find((entry) =>
    entry.farmerId === req.user.id && entry.mentorId === mentor.id &&
    ['Submitted', 'Under Review', 'Connected'].includes(entry.status)
  );
  if (existing) return res.status(409).json({ message: 'You already have an active request for this mentor.' });

  const request = {
    id: `mentor-request-${randomUUID()}`,
    farmerId: req.user.id,
    mentorId: mentor.id,
    message,
    status: 'Submitted',
    feedback: '',
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await persistRecord('farmerMentorRequests', request);
  learning.farmerMentorRequests.push(request);
  for (const administrator of users.filter((entry) =>
    entry.status === 'active' && entry.roles.includes('administrator')
  )) {
    await addUserNotification(
      administrator.id,
      'Mentor introduction request',
      `${req.user.firstName} ${req.user.lastName} requested an introduction to ${mentor.name}.`,
      { targetType: 'mentor_request', targetId: request.id }
    );
  }
  return res.status(201).json({ request: { id: request.id, mentorName: mentor.name, status: request.status } });
});

app.get('/api/admin/farmer-data/market', authenticate, requireRole('administrator'), (req, res) => {
  return res.json({ records: learning.farmerMarketRecords });
});

app.post('/api/admin/farmer-data/market', authenticate, requireRole('administrator'), async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const record = {
    id: `market-${randomUUID()}`,
    commodity: typeof body.commodity === 'string' ? body.commodity.trim() : '',
    grade: typeof body.grade === 'string' ? body.grade.trim() : '',
    market: typeof body.market === 'string' ? body.market.trim() : '',
    province: typeof body.province === 'string' ? body.province.trim() : '',
    price: Number(body.price),
    unit: typeof body.unit === 'string' ? body.unit.trim() : '',
    observedAt: typeof body.observedAt === 'string' ? body.observedAt.trim() : '',
    sourceName: typeof body.sourceName === 'string' ? body.sourceName.trim() : '',
    sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '',
    verifiedAt: typeof body.verifiedAt === 'string' ? body.verifiedAt.trim() : '',
    expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt.trim() : '',
    status: 'published',
    createdAt: new Date().toISOString(),
    createdBy: req.user.email,
  };
  const today = new Date().toISOString().slice(0, 10);
  if (!record.commodity || record.commodity.length > 120 || !record.grade || record.grade.length > 120 ||
      !record.market || record.market.length > 160 || !record.province || record.province.length > 60 ||
      !Number.isFinite(record.price) || record.price <= 0 || record.price > 100000000 ||
      !record.unit || record.unit.length > 60 || !record.sourceName || record.sourceName.length > 160 ||
      !isValidSourceUrl(record.sourceUrl) || !isValidIsoDate(record.observedAt) ||
      !isValidIsoDate(record.verifiedAt) || !isValidIsoDate(record.expiresAt) ||
      record.observedAt > today || record.verifiedAt > today || record.verifiedAt < record.observedAt || record.expiresAt < today ||
      record.expiresAt < record.observedAt) {
    return res.status(400).json({ message: 'Provide valid market details, a source URL, an observation date, a verification date, and a future expiry date.' });
  }
  await persistRecord('farmerMarketRecords', record);
  learning.farmerMarketRecords.push(record);
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `Published sourced farmer market information ${record.id}`,
    timestamp: new Date().toISOString(),
  };
  await persistRecord('auditLogs', auditEntry);
  auditLogs.push(auditEntry);
  return res.status(201).json({ record });
});

app.delete('/api/admin/farmer-data/market/:id', authenticate, requireRole('administrator'), async (req, res) => {
  const record = learning.farmerMarketRecords.find((entry) => entry.id === req.params.id);
  if (!record) return res.status(404).json({ message: 'Market record not found.' });
  await removeRecord('farmerMarketRecords', record);
  learning.farmerMarketRecords.splice(learning.farmerMarketRecords.indexOf(record), 1);
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `Removed farmer market information ${record.id}`,
    timestamp: new Date().toISOString(),
  };
  await persistRecord('auditLogs', auditEntry);
  auditLogs.push(auditEntry);
  return res.json({ deleted: true });
});

app.get('/api/admin/farmer-data/mentors', authenticate, requireRole('administrator'), (req, res) => {
  return res.json({
    mentors: learning.farmerMentors.map(({ contactEmail, ...mentor }) => ({
      ...mentor,
      contactEmail,
    })),
    requests: learning.farmerMentorRequests.map((entry) => {
      const farmer = users.find((user) => user.id === entry.farmerId);
      const mentor = learning.farmerMentors.find((candidate) => candidate.id === entry.mentorId);
      return {
        ...entry,
        farmerName: farmer ? `${farmer.firstName} ${farmer.lastName}` : 'Unavailable account',
        farmerEmail: farmer?.email || '',
        mentorName: mentor?.name || 'Mentor record unavailable',
      };
    }),
  });
});

app.post('/api/admin/farmer-data/mentors', authenticate, requireRole('administrator'), async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const mentor = {
    id: `mentor-${randomUUID()}`,
    name: typeof body.name === 'string' ? body.name.trim() : '',
    province: typeof body.province === 'string' ? body.province.trim() : '',
    expertise: typeof body.expertise === 'string' ? body.expertise.trim() : '',
    biography: typeof body.biography === 'string' ? body.biography.trim() : '',
    contactEmail: typeof body.contactEmail === 'string' ? body.contactEmail.trim().toLowerCase() : '',
    sourceName: typeof body.sourceName === 'string' ? body.sourceName.trim() : '',
    sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '',
    verifiedAt: typeof body.verifiedAt === 'string' ? body.verifiedAt.trim() : '',
    expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt.trim() : '',
    consentToList: body.consentToList === true,
    consentToShare: body.consentToShare === true,
    status: 'active',
    createdAt: new Date().toISOString(),
    createdBy: req.user.email,
  };
  const today = new Date().toISOString().slice(0, 10);
  if (!mentor.name || mentor.name.length > 120 || !mentor.province || mentor.province.length > 60 ||
      !mentor.expertise || mentor.expertise.length > 240 || !mentor.biography || mentor.biography.length > 1000 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mentor.contactEmail) || mentor.contactEmail.length > 160 ||
      !mentor.sourceName || mentor.sourceName.length > 160 || !isValidSourceUrl(mentor.sourceUrl) ||
      !isValidIsoDate(mentor.verifiedAt) || !isValidIsoDate(mentor.expiresAt) ||
      mentor.verifiedAt > today || mentor.expiresAt < today ||
      !mentor.consentToList || !mentor.consentToShare) {
    return res.status(400).json({ message: 'Provide a verified mentor profile, source, future expiry date, valid contact email, and confirmed consent to list the profile and share contact details after an approved introduction.' });
  }
  if (learning.farmerMentors.some((entry) => entry.contactEmail === mentor.contactEmail && entry.status === 'active')) {
    return res.status(409).json({ message: 'An active mentor profile already uses this contact email.' });
  }
  await persistRecord('farmerMentors', mentor);
  learning.farmerMentors.push(mentor);
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `Added sourced farmer mentor ${mentor.id}`,
    timestamp: new Date().toISOString(),
  };
  await persistRecord('auditLogs', auditEntry);
  auditLogs.push(auditEntry);
  const { contactEmail, ...publicMentor } = mentor;
  return res.status(201).json({ mentor: publicMentor });
});

app.delete('/api/admin/farmer-data/mentors/:id', authenticate, requireRole('administrator'), async (req, res) => {
  const mentor = learning.farmerMentors.find((entry) => entry.id === req.params.id);
  if (!mentor) return res.status(404).json({ message: 'Mentor not found.' });
  const updated = { ...mentor, status: 'archived' };
  await persistRecord('farmerMentors', updated);
  learning.farmerMentors[learning.farmerMentors.indexOf(mentor)] = updated;
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `Archived farmer mentor ${mentor.id}`,
    timestamp: new Date().toISOString(),
  };
  await persistRecord('auditLogs', auditEntry);
  auditLogs.push(auditEntry);
  return res.json({ archived: true });
});

app.patch('/api/admin/farmer-data/mentor-requests/:id', authenticate, requireRole('administrator'), async (req, res) => {
  const request = learning.farmerMentorRequests.find((entry) => entry.id === req.params.id);
  if (!request) return res.status(404).json({ message: 'Mentor request not found.' });
  if (!['Submitted', 'Under Review'].includes(request.status)) {
    return res.status(409).json({ message: 'This mentor request has already been resolved.' });
  }
  const status = typeof req.body?.status === 'string' ? req.body.status : '';
  const feedback = typeof req.body?.feedback === 'string' ? req.body.feedback.trim() : '';
  if (!['Under Review', 'Connected', 'Declined'].includes(status) || feedback.length > 500 ||
      (status === 'Declined' && !feedback)) {
    return res.status(400).json({ message: 'Choose a valid request status and provide feedback when declining.' });
  }
  const mentor = learning.farmerMentors.find((entry) => entry.id === request.mentorId);
  if (status === 'Connected' &&
      (!mentor || mentor.status !== 'active' || !mentor.consentToShare || mentor.expiresAt < new Date().toISOString().slice(0, 10))) {
    return res.status(409).json({ message: 'This mentor is no longer available for an introduction.' });
  }
  const updated = { ...request, status, feedback, updatedAt: new Date().toISOString() };
  await persistRecord('farmerMentorRequests', updated);
  learning.farmerMentorRequests[learning.farmerMentorRequests.indexOf(request)] = updated;
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `Updated farmer mentor request ${request.id} to ${status}`,
    timestamp: new Date().toISOString(),
  };
  await persistRecord('auditLogs', auditEntry);
  auditLogs.push(auditEntry);
  await addUserNotification(
    request.farmerId,
    'Mentor introduction request updated',
    `Your request is ${status}.${feedback ? ` ${feedback}` : ''}`,
    { targetType: 'mentor_request', targetId: request.id }
  );
  return res.json({ request: updated });
});

app.get('/api/learning/categories', authenticate, (req, res) => {
  return res.json({ categories: learning.categories });
});

app.post('/api/learning/categories', authenticate, async (req, res) => {
  if (req.activeRole !== 'administrator') {
    return res.status(403).json({ message: 'Only administrators can manage learning categories.' });
  }
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const icon = typeof body.icon === 'string' && /^[a-z-]{2,40}$/.test(body.icon) ? body.icon : 'leaf-outline';
  const idPart = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  if (!name || name.length > 80 || !description || description.length > 240 || !idPart) {
    return res.status(400).json({ message: 'Provide a category name and description within the allowed length.' });
  }
  const id = `category-${idPart}`;
  const normalizedName = name.toLowerCase().replace(/\s+/g, ' ');
  if (learning.categories.some((entry) => (
    entry.id === id || entry.name.toLowerCase().replace(/\s+/g, ' ') === normalizedName
  ))) {
    return res.status(409).json({ message: 'A learning category with that name already exists.' });
  }
  const category = { id, name, description, icon };
  await persistRecord('learningCategories', category);
  learning.categories.push(category);
  return res.status(201).json({ category });
});

app.patch('/api/learning/categories/:id', authenticate, async (req, res) => {
  if (req.activeRole !== 'administrator') {
    return res.status(403).json({ message: 'Only administrators can manage learning categories.' });
  }
  const category = learning.categories.find((entry) => entry.id === req.params.id);
  if (!category) return res.status(404).json({ message: 'Learning category not found.' });
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const icon = typeof body.icon === 'string' && /^[a-z-]{2,40}$/.test(body.icon) ? body.icon : category.icon;
  if (!name || name.length > 80 || !description || description.length > 240) {
    return res.status(400).json({ message: 'Provide a category name and description within the allowed length.' });
  }
  const updated = { ...category, name, description, icon };
  await persistRecord('learningCategories', updated);
  learning.categories[learning.categories.indexOf(category)] = updated;
  return res.json({ category: updated });
});

app.delete('/api/learning/categories/:id', authenticate, async (req, res) => {
  if (req.activeRole !== 'administrator') {
    return res.status(403).json({ message: 'Only administrators can manage learning categories.' });
  }
  const category = learning.categories.find((entry) => entry.id === req.params.id);
  if (!category) return res.status(404).json({ message: 'Learning category not found.' });
  if (learning.courses.some((course) => course.categoryId === category.id) ||
      learning.resources.some((resource) => resource.categoryId === category.id)) {
    return res.status(409).json({ message: 'This category is in use by learning content and cannot be deleted.' });
  }
  await removeRecord('learningCategories', { id: category.id });
  learning.categories.splice(learning.categories.indexOf(category), 1);
  return res.json({ deleted: true, categoryId: category.id });
});

function getLearningCourse(course) {
  const provider = learning.providers.find((entry) => entry.id === course.providerId);
  const category = learning.categories.find((entry) => entry.id === course.categoryId);
  const modules = curriculum[course.id];
  return {
    ...course,
    category: category?.name || 'Other',
    lessonTitles: Array.isArray(modules) ? modules.map(({ id, title }) => ({ id, title })) : [],
    provider: provider ? {
      id: provider.id,
      name: provider.name,
      verificationStatus: provider.verificationStatus,
      location: provider.location,
    } : null,
  };
}

function isVisibleLearningCourse(course) {
  return course.status === 'Published' || course.status === 'Demonstration';
}

app.get('/api/learning/courses', authenticate, (req, res) => {
  const { q = '', category, provider, location, deliveryMethod, duration, programmeType, availability, sort = 'newest' } = req.query;
  const query = String(q).trim().toLowerCase();
  const filtered = learning.courses.filter((course) => {
    const trainingProvider = learning.providers.find((entry) => entry.id === course.providerId);
    if (!trainingProvider || trainingProvider.status !== 'published' ||
        !isVisibleLearningCourse(course)) return false;
    const searchable = `${course.title} ${course.description} ${course.programmeType} ${course.deliveryMethod} ${course.location} ${trainingProvider.name}`.toLowerCase();
    return (!query || searchable.includes(query)) &&
      (!category || course.categoryId === String(category)) &&
      (!provider || course.providerId === String(provider)) &&
      (!location || course.location.toLowerCase().includes(String(location).toLowerCase())) &&
      (!deliveryMethod || course.deliveryMethod.toLowerCase() === String(deliveryMethod).toLowerCase()) &&
      (!duration || course.duration.toLowerCase().includes(String(duration).toLowerCase())) &&
      (!availability || course.status.toLowerCase() === String(availability).toLowerCase()) &&
      (!programmeType || course.programmeType.toLowerCase() === String(programmeType).toLowerCase());
  });
  if (sort === 'name') filtered.sort((left, right) => left.title.localeCompare(right.title));
  else if (sort === 'duration') {
    filtered.sort((left, right) => {
      const leftWeeks = Number.parseInt(left.duration, 10) || Number.MAX_SAFE_INTEGER;
      const rightWeeks = Number.parseInt(right.duration, 10) || Number.MAX_SAFE_INTEGER;
      return leftWeeks - rightWeeks || left.title.localeCompare(right.title);
    });
  } else filtered.sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.title.localeCompare(right.title));

  const savedIds = new Set(learning.savedCourses
    .filter((entry) => entry.userId === req.user.id)
    .map((entry) => entry.courseId));
  return res.json({
    courses: filtered.map((course) => ({ ...getLearningCourse(course), saved: savedIds.has(course.id) })),
  });
});

app.get('/api/learning/courses/:id', authenticate, (req, res) => {
  const course = learning.courses.find((entry) => entry.id === req.params.id);
  const provider = course && learning.providers.find((entry) => entry.id === course.providerId);
  if (!course || !provider || provider.status !== 'published' ||
      !isVisibleLearningCourse(course)) {
    return res.status(404).json({ message: 'Learning course not found.' });
  }
  const saved = learning.savedCourses.some((entry) => entry.userId === req.user.id && entry.courseId === course.id);
  const enrollment = learning.enrollments.find((entry) =>
    entry.applicantId === req.user.id && entry.courseId === course.id && entry.status !== 'Withdrawn'
  );
  return res.json({ course: { ...getLearningCourse(course), saved }, enrollment: enrollment || null });
});

app.get('/api/learning/programmes', authenticate, (req, res) => {
  return res.json({
    programmes: learning.programmes.map((programme) => ({
      ...programme,
      courseCount: learning.courses.filter((course) =>
        course.programmeType === programme.courseType && isVisibleLearningCourse(course)
      ).length,
    })),
  });
});

app.get('/api/learning/providers', authenticate, (req, res) => {
  const { q = '', location, category, programmeType } = req.query;
  const query = String(q).trim().toLowerCase();
  const filtered = learning.providers.filter((provider) => {
    if (provider.status !== 'published') return false;
    const providerCourses = learning.courses.filter((course) =>
      course.providerId === provider.id && isVisibleLearningCourse(course)
    );
    return (!query || `${provider.name} ${provider.description} ${provider.location}`.toLowerCase().includes(query)) &&
      (!location || provider.location.toLowerCase().includes(String(location).toLowerCase())) &&
      (!category || providerCourses.some((course) => course.categoryId === String(category))) &&
      (!programmeType || providerCourses.some((course) => course.programmeType.toLowerCase() === String(programmeType).toLowerCase()));
  });
  return res.json({
    providers: filtered.map((provider) => ({
      id: provider.id,
      name: provider.name,
      location: provider.location,
      description: provider.description,
      verificationStatus: provider.verificationStatus,
      dataStatus: provider.dataStatus,
      programmes: learning.courses
        .filter((course) => course.providerId === provider.id && isVisibleLearningCourse(course))
        .map((course) => ({
          id: course.id,
          title: course.title,
          programmeType: course.programmeType,
          categoryId: course.categoryId,
        })),
    })),
  });
});

app.get('/api/learning/providers/:id', authenticate, (req, res) => {
  const provider = learning.providers.find((entry) => entry.id === req.params.id && entry.status === 'published');
  if (!provider) return res.status(404).json({ message: 'Training provider not found.' });
  return res.json({
    provider: {
      id: provider.id,
      name: provider.name,
      location: provider.location,
      description: provider.description,
      verificationStatus: provider.verificationStatus,
      dataStatus: provider.dataStatus,
    },
    courses: learning.courses.filter((course) =>
      course.providerId === provider.id && isVisibleLearningCourse(course)
    ).map(getLearningCourse),
  });
});

app.get('/api/learning/resources', authenticate, (req, res) => {
  const { q = '', category } = req.query;
  const query = String(q).trim().toLowerCase();
  return res.json({
    resources: learning.resources
      .filter((resource) =>
        (!category || resource.categoryId === String(category)) &&
        (!query || `${resource.title} ${resource.summary} ${resource.format}`.toLowerCase().includes(query))
      )
      .map(({ content, ...resource }) => resource),
  });
});

app.get('/api/learning/resources/:id', authenticate, (req, res) => {
  const resource = learning.resources.find((entry) => entry.id === req.params.id);
  if (!resource) return res.status(404).json({ message: 'Learning resource not found.' });
  return res.json({ resource });
});

app.post('/api/learning/resources/:id/started', authenticate, async (req, res) => {
  const resource = learning.resources.find((entry) => entry.id === req.params.id);
  if (!resource) return res.status(404).json({ message: 'Learning resource not found.' });

  const existing = learning.resourceProgress.find((entry) =>
    entry.userId === req.user.id && entry.resourceId === resource.id
  );
  if (existing) return res.json({ progress: existing });

  const now = new Date().toISOString();
  const progress = {
    id: `resource-progress-${randomUUID()}`,
    userId: req.user.id,
    resourceId: resource.id,
    status: 'In Progress',
    startedAt: now,
    updatedAt: now,
  };
  await persistRecord('resourceProgress', progress);
  learning.resourceProgress.push(progress);
  return res.status(201).json({ progress });
});

app.post('/api/learning/resources', authenticate, async (req, res) => {
  if (req.activeRole !== 'administrator') {
    return res.status(403).json({ message: 'Only administrators can publish learning resources.' });
  }
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
  const content = Array.isArray(body.content)
    ? body.content.filter((paragraph) => typeof paragraph === 'string').map((paragraph) => paragraph.trim()).filter(Boolean)
    : [];
  if (!title || title.length > 120 || !summary || summary.length > 300 ||
      !learning.categories.some((entry) => entry.id === body.categoryId) ||
      content.length === 0 || content.length > 12 || content.some((paragraph) => paragraph.length > 1500)) {
    return res.status(400).json({ message: 'Provide a title, valid category, summary, and one to twelve paragraphs of content.' });
  }
  const resource = {
    id: `resource-${randomUUID()}`,
    title,
    categoryId: body.categoryId,
    format: 'In-app guide',
    summary,
    content,
    dataStatus: 'Administrator-managed educational content. Confirm local relevance before relying on it as technical advice.',
  };
  await persistRecord('learningResources', resource);
  learning.resources.push(resource);
  return res.status(201).json({ resource });
});

app.delete('/api/learning/resources/:id', authenticate, async (req, res) => {
  if (req.activeRole !== 'administrator') {
    return res.status(403).json({ message: 'Only administrators can manage learning resources.' });
  }
  const resourceIndex = learning.resources.findIndex((entry) => entry.id === req.params.id);
  if (resourceIndex < 0) return res.status(404).json({ message: 'Learning resource not found.' });
  const [resource] = learning.resources.splice(resourceIndex, 1);
  try {
    await removeRecord('learningResources', { id: resource.id });
  } catch (error) {
    learning.resources.splice(resourceIndex, 0, resource);
    throw error;
  }
  return res.json({ deleted: true, resourceId: resource.id });
});

function requirePassportAccess(req, res) {
  if (!['learner', 'farmer', 'sdf', 'administrator', 'internal_staff'].includes(req.activeRole)) {
    res.status(403).json({ message: 'Skills passport access is not available for this role.' });
    return false;
  }
  return true;
}

function getPassportSkillInput(body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const category = typeof input.category === 'string' ? input.category.trim() : '';
  const level = typeof input.level === 'string' ? input.level.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';

  if (name.length < 2 || name.length > 80) {
    return { error: 'Skill name must be between 2 and 80 characters.' };
  }
  if (category.length > 60 || description.length > 240) {
    return { error: 'Category must be 60 characters or fewer and description must be 240 characters or fewer.' };
  }
  if (!['Foundational', 'Developing', 'Practised', 'Advanced'].includes(level)) {
    return { error: 'Choose a valid self-assessed skill level.' };
  }
  return { value: { name, category, level, description } };
}

function getPassportSkillResponse(skill) {
  return {
    id: skill.id,
    name: skill.name,
    category: skill.category,
    level: skill.level,
    description: skill.description,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
    verificationStatus: 'Self-reported · not verified',
  };
}

app.get('/api/passport', authenticate, (req, res) => {
  if (!requirePassportAccess(req, res)) return;
  const skills = learning.passportSkills
    .filter((entry) => entry.userId === req.user.id)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(getPassportSkillResponse);
  const certificates = learning.certificates
    .filter((entry) => entry.userId === req.user.id)
    .map((entry) => ({ ...entry }));
  return res.json({ skills, certificates });
});

app.post('/api/passport/skills', authenticate, async (req, res) => {
  if (!requirePassportAccess(req, res)) return;
  const parsed = getPassportSkillInput(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  if (learning.passportSkills.filter((entry) => entry.userId === req.user.id).length >= 50) {
    return res.status(409).json({ message: 'A maximum of 50 self-reported skills can be added.' });
  }
  const now = new Date().toISOString();
  const skill = {
    id: `skill-${randomUUID()}`,
    userId: req.user.id,
    ...parsed.value,
    createdAt: now,
    updatedAt: now,
  };
  await persistRecord('passportSkills', skill);
  learning.passportSkills.push(skill);
  return res.status(201).json({ skill: getPassportSkillResponse(skill) });
});

app.patch('/api/passport/skills/:id', authenticate, async (req, res) => {
  if (!requirePassportAccess(req, res)) return;
  const existing = learning.passportSkills.find((entry) =>
    entry.id === req.params.id && entry.userId === req.user.id
  );
  if (!existing) return res.status(404).json({ message: 'Skill not found in your passport.' });
  const parsed = getPassportSkillInput(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  const updated = { ...existing, ...parsed.value, updatedAt: new Date().toISOString() };
  await persistRecord('passportSkills', updated);
  Object.assign(existing, updated);
  return res.json({ skill: getPassportSkillResponse(updated) });
});

app.delete('/api/passport/skills/:id', authenticate, async (req, res) => {
  if (!requirePassportAccess(req, res)) return;
  const index = learning.passportSkills.findIndex((entry) =>
    entry.id === req.params.id && entry.userId === req.user.id
  );
  if (index < 0) return res.status(404).json({ message: 'Skill not found in your passport.' });
  const [skill] = learning.passportSkills.splice(index, 1);
  try {
    await removeRecord('passportSkills', { id: skill.id, userId: req.user.id });
  } catch (error) {
    learning.passportSkills.splice(index, 0, skill);
    throw error;
  }
  return res.json({ deleted: true, skillId: skill.id });
});

app.get('/api/learning/me', authenticate, (req, res) => {
  const savedIds = new Set(learning.savedCourses
    .filter((entry) => entry.userId === req.user.id)
    .map((entry) => entry.courseId));
  const activeEnrollmentIds = new Set(learning.enrollments
    .filter((entry) => entry.applicantId === req.user.id && entry.active)
    .map((entry) => entry.id));
  return res.json({
    enrollments: learning.enrollments.filter((entry) => entry.applicantId === req.user.id).map((entry) => ({
      ...entry,
      course: getLearningCourse(learning.courses.find((course) => course.id === entry.courseId) || {
        id: entry.courseId,
        title: 'Course no longer available',
      }),
    })),
    savedCourses: learning.courses.filter((course) => savedIds.has(course.id) && isVisibleLearningCourse(course)).map(getLearningCourse),
    progress: learning.courseProgress.filter((entry) =>
      entry.userId === req.user.id && activeEnrollmentIds.has(entry.enrollmentId)
    ),
    moduleProgress: learning.moduleProgress.filter((entry) =>
      entry.userId === req.user.id && activeEnrollmentIds.has(entry.enrollmentId)
    ),
    certificates: learning.certificates.filter((entry) => entry.userId === req.user.id),
    startedResources: learning.resourceProgress
      .filter((entry) => entry.userId === req.user.id)
      .map((entry) => {
        const resource = learning.resources.find((item) => item.id === entry.resourceId);
        return resource ? {
          ...entry,
          resource: {
            id: resource.id,
            title: resource.title,
            summary: resource.summary,
            categoryId: resource.categoryId,
            format: resource.format,
            dataStatus: resource.dataStatus,
          },
        } : null;
      })
      .filter(Boolean),
  });
});

function getOwnedCourseworkEnrollment(enrollmentId, userId) {
  const enrollment = learning.enrollments.find((entry) =>
    entry.id === enrollmentId && entry.applicantId === userId && entry.active
  );
  if (!enrollment) return null;
  const course = learning.courses.find((entry) => entry.id === enrollment.courseId);
  const modules = curriculum[enrollment.courseId];
  if (
    enrollment.status !== 'Enrolled (demo)' ||
    course?.status !== 'Demonstration' ||
    !Array.isArray(modules)
  ) return { enrollment, course, modules: null };
  return { enrollment, course, modules };
}

app.get('/api/learning/enrollments/:id/coursework', authenticate, (req, res) => {
  const coursework = getOwnedCourseworkEnrollment(req.params.id, req.user.id);
  if (!coursework) return res.status(404).json({ message: 'Learning enrolment not found.' });
  if (!coursework.modules) {
    return res.status(409).json({ message: 'Learning modules are not available for this enrolment.' });
  }
  const moduleProgress = learning.moduleProgress.filter((entry) =>
    entry.enrollmentId === coursework.enrollment.id && entry.userId === req.user.id
  );
  return res.json({
    course: { id: coursework.course.id, title: coursework.course.title },
    dataStatus: 'Prototype learning material and knowledge checks. Not an accredited course or formal assessment.',
    passMark: 67,
    modules: coursework.modules.map((module) => ({
      id: module.id,
      title: module.title,
      content: module.content,
      questions: module.questions.map(({ id, prompt, options }, index) => ({
        id: id || `${module.id}-question-${index + 1}`,
        prompt,
        options,
      })),
      progress: moduleProgress.find((entry) => entry.moduleId === module.id) || null,
    })),
  });
});

app.post('/api/learning/enrollments/:id/modules/:moduleId/lesson-complete', authenticate, async (req, res) => {
  const coursework = getOwnedCourseworkEnrollment(req.params.id, req.user.id);
  if (!coursework) return res.status(404).json({ message: 'Learning enrolment not found.' });
  if (!coursework.modules) {
    return res.status(409).json({ message: 'Learning modules are not available for this enrolment.' });
  }
  const module = coursework.modules.find((entry) => entry.id === req.params.moduleId);
  if (!module) return res.status(404).json({ message: 'Learning module not found.' });

  const now = new Date().toISOString();
  const recordId = `${coursework.enrollment.id}:${module.id}`;
  const existing = learning.moduleProgress.find((entry) => entry.id === recordId);
  const progress = {
    ...(existing || {}),
    id: recordId,
    enrollmentId: coursework.enrollment.id,
    userId: req.user.id,
    courseId: coursework.course.id,
    moduleId: module.id,
    lessonCompleted: true,
    lessonCompletedAt: existing?.lessonCompletedAt || now,
    attempts: existing?.attempts || 0,
    bestScore: existing?.bestScore || 0,
    passed: existing?.passed || false,
    completedAt: existing?.completedAt || null,
    updatedAt: now,
  };
  await persistRecord('moduleProgress', progress);
  if (existing) learning.moduleProgress[learning.moduleProgress.indexOf(existing)] = progress;
  else learning.moduleProgress.push(progress);
  return res.json({ progress });
});

app.post('/api/learning/enrollments/:id/modules/:moduleId/assessment', authenticate, async (req, res) => {
  const coursework = getOwnedCourseworkEnrollment(req.params.id, req.user.id);
  if (!coursework) return res.status(404).json({ message: 'Learning enrolment not found.' });
  if (!coursework.modules) {
    return res.status(409).json({ message: 'Learning modules are not available for this enrolment.' });
  }
  const module = coursework.modules.find((entry) => entry.id === req.params.moduleId);
  if (!module) return res.status(404).json({ message: 'Learning module not found.' });
  const recordId = `${coursework.enrollment.id}:${module.id}`;
  const existing = learning.moduleProgress.find((entry) => entry.id === recordId);
  if (!existing?.lessonCompleted) {
    return res.status(409).json({ message: 'Complete the module lesson before taking its assessment.' });
  }

  const answers = req.body?.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return res.status(400).json({ message: 'Provide an answer for each assessment question.' });
  }
  const questions = module.questions.map((question, index) => ({
    ...question,
    id: question.id || `${module.id}-question-${index + 1}`,
  }));
  const questionIds = new Set(questions.map((question) => question.id));
  if (
    Object.keys(answers).length !== questions.length ||
    Object.keys(answers).some((questionId) => !questionIds.has(questionId)) ||
    questions.some((question) => typeof answers[question.id] !== 'string' ||
      !question.options.some((option) => option.id === answers[question.id]))
  ) {
    return res.status(400).json({ message: 'Answer every question using one of its listed options.' });
  }
  const correctCount = questions.filter((question) =>
    answers[question.id] === question.correctOptionId
  ).length;
  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= 67;
  const now = new Date().toISOString();
  const progress = {
    ...existing,
    attempts: existing.attempts + 1,
    latestScore: score,
    bestScore: Math.max(existing.bestScore || 0, score),
    passed: existing.passed || passed,
    completedAt: existing.completedAt || (passed ? now : null),
    updatedAt: now,
  };
  await persistRecord('moduleProgress', progress);
  learning.moduleProgress[learning.moduleProgress.indexOf(existing)] = progress;

  const courseModules = coursework.modules;
  const courseRecords = courseModules.map((courseModule) =>
    learning.moduleProgress.find((entry) =>
      entry.enrollmentId === coursework.enrollment.id && entry.moduleId === courseModule.id
    )
  );
  const completedModules = courseRecords.filter((entry) => entry?.passed).length;
  const courseProgress = {
    id: `${req.user.id}:${coursework.enrollment.id}`,
    userId: req.user.id,
    enrollmentId: coursework.enrollment.id,
    courseId: coursework.course.id,
    completedModules,
    totalModules: courseModules.length,
    progressPercent: Math.round((completedModules / courseModules.length) * 100),
    completed: completedModules === courseModules.length,
    updatedAt: now,
  };
  await persistRecord('courseProgress', courseProgress);
  const existingCourseProgress = learning.courseProgress.find((entry) =>
    entry.userId === req.user.id && entry.enrollmentId === coursework.enrollment.id
  );
  if (existingCourseProgress) {
    learning.courseProgress[learning.courseProgress.indexOf(existingCourseProgress)] = courseProgress;
  } else {
    learning.courseProgress.push(courseProgress);
  }
  return res.json({
    result: { score, passMark: 67, passed, correctAnswers: correctCount, totalQuestions: questions.length },
    progress,
    courseProgress,
  });
});

app.post('/api/learning/courses/:id/saved', authenticate, async (req, res) => {
  const course = learning.courses.find((entry) => entry.id === req.params.id);
  if (!course || !isVisibleLearningCourse(course)) {
    return res.status(404).json({ message: 'Learning course not found.' });
  }
  const existing = learning.savedCourses.find((entry) =>
    entry.userId === req.user.id && entry.courseId === course.id
  );
  if (!existing) {
    const saved = { userId: req.user.id, courseId: course.id, savedAt: new Date().toISOString() };
    await persistRecord('savedCourses', saved);
    learning.savedCourses.push(saved);
  }
  return res.status(existing ? 200 : 201).json({ saved: true, courseId: course.id });
});

app.delete('/api/learning/courses/:id/saved', authenticate, async (req, res) => {
  const savedIndex = learning.savedCourses.findIndex((entry) =>
    entry.userId === req.user.id && entry.courseId === req.params.id
  );
  if (savedIndex >= 0) {
    const [saved] = learning.savedCourses.splice(savedIndex, 1);
    try {
      await removeRecord('savedCourses', { userId: saved.userId, courseId: saved.courseId });
    } catch (error) {
      learning.savedCourses.splice(savedIndex, 0, saved);
      throw error;
    }
  }
  return res.json({ saved: false, courseId: req.params.id });
});

app.post('/api/learning/enrollments', authenticate, async (req, res) => {
  if (!['learner', 'farmer', 'employer', 'sdf'].includes(req.activeRole)) {
    return res.status(403).json({ message: 'Your account role cannot enrol in courses or submit enrolment requests.' });
  }
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const course = learning.courses.find((entry) => entry.id === body.courseId);
  if (!course || !isVisibleLearningCourse(course)) {
    return res.status(404).json({ message: 'Learning course not found.' });
  }
  if (!course.eligibleRoles.includes(req.activeRole)) {
    return res.status(403).json({ message: 'This learning course is not available for your role.' });
  }
  if (!course.interestEnabled) {
    return res.status(409).json({ message: 'Expressions of interest are not currently enabled for this course.' });
  }
  if (body.acknowledgedDemo !== true) {
    return res.status(400).json({ message: 'Confirm that this is a demonstration enrolment or request, not a confirmed course place.' });
  }
  if (body.applicantNote !== undefined &&
      (typeof body.applicantNote !== 'string' || body.applicantNote.trim().length > 500)) {
    return res.status(400).json({ message: 'The optional note must be 500 characters or fewer.' });
  }
  const existing = learning.enrollments.find((entry) =>
    entry.applicantId === req.user.id && entry.courseId === course.id && entry.status !== 'Withdrawn'
  );
  if (existing) return res.status(409).json({ message: 'You already have an active enrolment or request for this course.' });

  const now = new Date().toISOString();
  const status = body.draft === true
    ? 'Draft'
    : course.status === 'Demonstration'
      ? 'Enrolled (demo)'
      : 'Submitted';
  const enrollment = {
    id: `learn-${randomUUID()}`,
    reference: `LRN-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
    applicantId: req.user.id,
    courseId: course.id,
    active: true,
    status,
    submittedAt: status === 'Draft' ? null : now,
    updatedAt: now,
    applicantNote: typeof body.applicantNote === 'string' ? body.applicantNote.trim() : '',
    shareWithProvider: body.shareWithProvider === true,
    statusHistory: [{ status, date: now }],
  };
  if (status !== 'Draft' && course.status !== 'Demonstration' && body.shareWithProvider !== true) {
    return res.status(400).json({ message: 'Consent to share your name and email with this provider is required to submit an enrolment request.' });
  }
  try {
    await persistRecord('enrollments', enrollment);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'You already have an active enrolment or request for this course.' });
    }
    throw error;
  }
  learning.enrollments.push(enrollment);
  return res.status(201).json({ enrollment: { ...enrollment, course: getLearningCourse(course) } });
});

app.patch('/api/learning/enrollments/:id', authenticate, async (req, res) => {
  const enrollment = learning.enrollments.find((entry) => entry.id === req.params.id);
  if (!enrollment || enrollment.applicantId !== req.user.id) {
    return res.status(404).json({ message: 'Learning enrolment not found.' });
  }
  const { action } = req.body || {};
  const course = learning.courses.find((entry) => entry.id === enrollment.courseId);
  const now = new Date().toISOString();
  let status;
  if (action === 'submit' && enrollment.status === 'Draft' && course?.interestEnabled) {
    status = course.status === 'Demonstration' ? 'Enrolled (demo)' : 'Submitted';
  } else if (action === 'withdraw' && ['Draft', 'Submitted', 'Enrolled (demo)', 'Under Review', 'Waitlisted'].includes(enrollment.status)) {
    status = 'Withdrawn';
  }
  else return res.status(400).json({ message: 'This learning enrolment cannot be changed using that action.' });

  const updated = {
    ...enrollment,
    active: status !== 'Withdrawn',
    status,
    submittedAt: status === 'Submitted' || status === 'Enrolled (demo)' ? now : enrollment.submittedAt,
    updatedAt: now,
    statusHistory: [...enrollment.statusHistory, { status, date: now }],
  };
  await persistRecord('enrollments', updated);
  learning.enrollments[learning.enrollments.indexOf(enrollment)] = updated;
  return res.json({ enrollment: updated });
});

app.patch('/api/learning/enrollments/:id/status', authenticate, async (req, res) => {
  const enrollment = learning.enrollments.find((entry) => entry.id === req.params.id);
  if (!enrollment) return res.status(404).json({ message: 'Learning enrolment not found.' });
  const course = learning.courses.find((entry) => entry.id === enrollment.courseId);
  if (enrollment.status === 'Enrolled (demo)' || course?.status === 'Demonstration') {
    return res.status(409).json({ message: 'Demonstration enrolments are not sent for provider review.' });
  }
  const provider = course && learning.providers.find((entry) => entry.id === course.providerId);
  const canReview = ['administrator', 'internal_staff'].includes(req.activeRole) ||
    (req.activeRole === 'training_provider' && provider?.ownerUserId === req.user.id);
  if (!canReview) return res.status(403).json({ message: 'You are not permitted to review this learning enrolment request.' });

  const allowedStatuses = ['Under Review', 'Accepted', 'Waitlisted', 'Rejected'];
  const { status } = req.body || {};
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Choose a valid learning enrolment status.' });
  }
  if (['Withdrawn', 'Accepted', 'Rejected'].includes(enrollment.status)) {
    return res.status(409).json({ message: 'This learning enrolment request is already closed.' });
  }
  const now = new Date().toISOString();
  const updated = {
    ...enrollment,
    status,
    updatedAt: now,
    statusHistory: [...enrollment.statusHistory, { status, date: now }],
  };
  await persistRecord('enrollments', updated);
  learning.enrollments[learning.enrollments.indexOf(enrollment)] = updated;
  return res.json({ enrollment: updated });
});

app.patch('/api/learning/provider/enrollments/:id/progress', authenticate, async (req, res) => {
  if (req.activeRole !== 'training_provider') {
    return res.status(403).json({ message: 'Only training providers can manage learner progress.' });
  }
  const enrollment = learning.enrollments.find((entry) => entry.id === req.params.id);
  const course = enrollment && learning.courses.find((entry) => entry.id === enrollment.courseId);
  const provider = course && learning.providers.find((entry) => entry.id === course.providerId);
  if (!enrollment || !provider || provider.ownerUserId !== req.user.id) {
    return res.status(404).json({ message: 'Course participant not found.' });
  }
  if (enrollment.status !== 'Accepted') {
    return res.status(409).json({ message: 'Only accepted participants can have training progress recorded.' });
  }
  const { progress } = req.body || {};
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
    return res.status(400).json({ message: 'Training progress must be a whole number from 0 to 100.' });
  }
  const now = new Date().toISOString();
  const updated = {
    ...enrollment,
    trainingProgress: progress,
    progressUpdatedAt: now,
    statusHistory: [...(enrollment.statusHistory || []), { status: `Progress ${progress}%`, date: now }],
  };
  await persistRecord('enrollments', updated);
  learning.enrollments[learning.enrollments.indexOf(enrollment)] = updated;
  return res.json({ enrollment: { id: updated.id, trainingProgress: updated.trainingProgress, progressUpdatedAt: now } });
});

app.get('/api/learning/admin/review', authenticate, (req, res) => {
  if (!['administrator', 'internal_staff'].includes(req.activeRole)) {
    return res.status(403).json({ message: 'You are not permitted to access learning review queues.' });
  }
  return res.json({
    courses: learning.courses
      .filter((course) => course.status !== 'Demonstration' && course.status !== 'Draft')
      .map((course) => ({
        ...getLearningCourse(course),
        provider: learning.providers.find((provider) => provider.id === course.providerId)?.name ?? 'Unknown provider',
      })),
    enrollments: learning.enrollments
      .filter((entry) => ['Submitted', 'Under Review', 'Waitlisted'].includes(entry.status))
      .map((entry) => ({
        id: entry.id,
        reference: entry.reference,
        status: entry.status,
        submittedAt: entry.submittedAt,
        courseTitle: learning.courses.find((course) => course.id === entry.courseId)?.title ?? 'Course no longer available',
      })),
  });
});

app.get('/api/learning/provider/me', authenticate, (req, res) => {
  if (req.activeRole !== 'training_provider') {
    return res.status(403).json({ message: 'Only training providers can access provider management.' });
  }
  const provider = learning.providers.find((entry) => entry.ownerUserId === req.user.id);
  if (!provider) return res.status(404).json({ message: 'No training-provider profile is assigned to this account.' });
  const providerCourses = learning.courses.filter((course) => course.providerId === provider.id);
  const courseIds = new Set(providerCourses.map((course) => course.id));
  return res.json({
    provider: {
      id: provider.id,
      name: provider.name,
      location: provider.location,
      description: provider.description,
      verificationStatus: provider.verificationStatus,
      dataStatus: provider.dataStatus,
      profileStatus: provider.status,
      pendingProfileChanges: provider.pendingProfileChanges || null,
    },
    courses: providerCourses.map(getLearningCourse),
    enrollments: learning.enrollments
      .filter((entry) => courseIds.has(entry.courseId))
      .map((entry) => {
        const applicant = entry.shareWithProvider === true
          ? users.find((user) => user.id === entry.applicantId)
          : null;
        return {
          id: entry.id,
          reference: entry.reference,
          status: entry.status,
          submittedAt: entry.submittedAt,
          updatedAt: entry.updatedAt,
          courseTitle: providerCourses.find((course) => course.id === entry.courseId)?.title,
          trainingProgress: entry.trainingProgress ?? 0,
          progressUpdatedAt: entry.progressUpdatedAt || null,
          participant: applicant ? {
            firstName: applicant.firstName,
            lastName: applicant.lastName,
            email: applicant.email,
          } : null,
        };
      }),
  });
});

app.patch('/api/learning/provider/profile', authenticate, async (req, res) => {
  if (req.activeRole !== 'training_provider') {
    return res.status(403).json({ message: 'Only training providers can request profile changes.' });
  }
  const provider = learning.providers.find((entry) => entry.ownerUserId === req.user.id);
  if (!provider) return res.status(404).json({ message: 'No training-provider profile is assigned to this account.' });
  const { name, location, description } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 160 ||
      typeof location !== 'string' || !location.trim() || location.trim().length > 120 ||
      typeof description !== 'string' || !description.trim() || description.trim().length > 1000) {
    return res.status(400).json({ message: 'Provide a provider name, location, and description within the stated limits.' });
  }
  const updated = {
    ...provider,
    pendingProfileChanges: { name: name.trim(), location: location.trim(), description: description.trim() },
    profileReviewStatus: 'Pending Review',
    profileCompletionSubmitted: true,
  };
  await persistRecord('trainingProviders', updated);
  learning.providers[learning.providers.indexOf(provider)] = updated;
  return res.json({ profileStatus: updated.profileReviewStatus });
});

app.get('/api/learning/admin/providers', authenticate, (req, res) => {
  if (req.activeRole !== 'administrator') {
    return res.status(403).json({ message: 'Only an administrator can review provider profiles.' });
  }
  return res.json({
    providers: learning.providers
      .filter((provider) => provider.status === 'pending_review' || provider.pendingProfileChanges)
      .map((provider) => ({
        id: provider.id,
        name: provider.name,
        location: provider.location,
        description: provider.description,
        verificationStatus: provider.verificationStatus,
        registrationBody: provider.registrationBody || '',
        providerReference: provider.providerReference || '',
        profileStatus: provider.status,
        pendingProfileChanges: provider.pendingProfileChanges || null,
        profileCompletionSubmitted: provider.profileCompletionSubmitted === true,
      })),
  });
});

app.patch('/api/learning/admin/providers/:id', authenticate, async (req, res) => {
  if (req.activeRole !== 'administrator') {
    return res.status(403).json({ message: 'Only an administrator can review provider profiles.' });
  }
  const provider = learning.providers.find((entry) => entry.id === req.params.id);
  if (!provider || (provider.status !== 'pending_review' && !provider.pendingProfileChanges)) {
    return res.status(404).json({ message: 'Provider profile review not found.' });
  }
  const { decision, note } = req.body || {};
  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ message: 'Decision must be approve or reject.' });
  }
  if (decision === 'approve' && provider.status === 'pending_review' && provider.profileCompletionSubmitted !== true) {
    return res.status(409).json({ message: 'The provider must complete and submit its profile before approval.' });
  }
  if (decision === 'reject' && (typeof note !== 'string' || !note.trim() || note.trim().length > 500)) {
    return res.status(400).json({ message: 'Provide a rejection reason of 500 characters or fewer.' });
  }
  const now = new Date().toISOString();
  const updated = {
    ...provider,
    ...(decision === 'approve' && provider.pendingProfileChanges ? provider.pendingProfileChanges : {}),
    status: decision === 'approve' ? 'published' : provider.status === 'pending_review' ? 'rejected' : provider.status,
    pendingProfileChanges: null,
    profileReviewStatus: decision === 'approve' ? 'Approved' : 'Rejected',
    profileReviewNote: decision === 'reject' ? note.trim() : '',
    profileReviewedAt: now,
    profileReviewedBy: req.user.email,
    verificationStatus: decision === 'approve' ? 'Administrator-reviewed provider profile; accreditation not verified' : provider.verificationStatus,
    dataStatus: decision === 'approve'
      ? 'Provider profile reviewed by an administrator. Registration, accreditation, and programme availability are not independently verified.'
      : provider.dataStatus,
  };
  await persistRecord('trainingProviders', updated);
  await persistRecord('auditLogs', {
    id: `audit-${randomUUID()}`,
    user: req.user.username,
    action: `${decision === 'approve' ? 'Approved' : 'Rejected'} provider profile ${provider.id}`,
    timestamp: now,
  });
  learning.providers[learning.providers.indexOf(provider)] = updated;
  return res.json({ provider: { id: updated.id, status: updated.status, profileReviewStatus: updated.profileReviewStatus } });
});

app.post('/api/learning/provider/courses', authenticate, async (req, res) => {
  if (req.activeRole !== 'training_provider') {
    return res.status(403).json({ message: 'Only training providers can submit programme listings.' });
  }
  const provider = learning.providers.find((entry) => entry.ownerUserId === req.user.id);
  if (!provider) return res.status(403).json({ message: 'No training-provider profile is assigned to this account.' });
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const action = body.action === 'draft' ? 'draft' : 'submit';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const requirements = typeof body.requirements === 'string' ? body.requirements.trim() : '';
  const categoryExists = learning.categories.some((entry) => entry.id === body.categoryId);
  const programmeExists = learning.programmes.some((entry) => entry.courseType === body.programmeType);
  const eligibleRoles = ['learner', 'farmer', 'employer', 'sdf'].filter((role) =>
    Array.isArray(body.eligibleRoles) && body.eligibleRoles.includes(role)
  );
  if (!title || title.length > 120 || !description || description.length > 1000 ||
      !categoryExists || !programmeExists || typeof body.duration !== 'string' || !body.duration.trim() ||
      body.duration.length > 80 || requirements.length > 1000 || typeof body.deliveryMethod !== 'string' || !body.deliveryMethod.trim() ||
      body.deliveryMethod.length > 80 || typeof body.location !== 'string' || !body.location.trim() ||
      body.location.length > 120 || eligibleRoles.length === 0) {
    return res.status(400).json({ message: 'Provide a valid title, description, category, programme type, duration, delivery method, location, and eligible audience.' });
  }
  const course = {
    id: `course-${randomUUID()}`,
    title,
    description,
    requirements,
    categoryId: body.categoryId,
    providerId: provider.id,
    duration: body.duration.trim(),
    deliveryMethod: body.deliveryMethod.trim(),
    eligibleRoles,
    programmeType: body.programmeType,
    location: body.location.trim(),
    accreditation: 'Not verified',
    status: action === 'draft' ? 'Draft' : 'Pending Review',
    dataStatus: 'Provider-submitted listing pending administrator review. Accreditation and official status are not verified.',
    interestEnabled: false,
    submittedAt: action === 'submit' ? new Date().toISOString() : null,
    reviewedAt: null,
    reviewedBy: '',
    reviewNote: '',
    statusHistory: [{ status: action === 'draft' ? 'Draft' : 'Pending Review', date: new Date().toISOString(), actor: req.user.email }],
    imageKey: 'agricultural-training',
    createdAt: new Date().toISOString(),
  };
  await persistRecord('learningCourses', course);
  learning.courses.push(course);
  return res.status(201).json({ course: getLearningCourse(course) });
});

app.patch('/api/learning/provider/courses/:id', authenticate, async (req, res) => {
  if (req.activeRole !== 'training_provider') {
    return res.status(403).json({ message: 'Only training providers can manage their programme listings.' });
  }
  const provider = learning.providers.find((entry) => entry.ownerUserId === req.user.id);
  const course = learning.courses.find((entry) => entry.id === req.params.id);
  if (!provider || !course || course.providerId !== provider.id) {
    return res.status(404).json({ message: 'Programme listing not found.' });
  }
  if (['Published', 'Archived'].includes(course.status)) {
    return res.status(409).json({ message: 'Published or archived programme listings cannot be edited.' });
  }
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const action = body.action === 'draft' ? 'draft' : body.action === 'submit' ? 'submit' : '';
  if (!action) return res.status(400).json({ message: 'Choose save as draft or submit for review.' });
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const requirements = typeof body.requirements === 'string' ? body.requirements.trim() : '';
  const categoryExists = learning.categories.some((entry) => entry.id === body.categoryId);
  const programmeExists = learning.programmes.some((entry) => entry.courseType === body.programmeType);
  const eligibleRoles = ['learner', 'farmer', 'employer', 'sdf'].filter((role) =>
    Array.isArray(body.eligibleRoles) && body.eligibleRoles.includes(role)
  );
  if (!title || title.length > 120 || !description || description.length > 1000 ||
      !categoryExists || !programmeExists || typeof body.duration !== 'string' || !body.duration.trim() ||
      body.duration.length > 80 || requirements.length > 1000 || typeof body.deliveryMethod !== 'string' || !body.deliveryMethod.trim() ||
      body.deliveryMethod.length > 80 || typeof body.location !== 'string' || !body.location.trim() ||
      body.location.length > 120 || eligibleRoles.length === 0) {
    return res.status(400).json({ message: 'Provide a valid title, description, category, programme type, duration, delivery method, location, and eligible audience.' });
  }
  const now = new Date().toISOString();
  const status = action === 'draft' ? 'Draft' : 'Pending Review';
  const updated = {
    ...course,
    title,
    description,
    requirements,
    categoryId: body.categoryId,
    duration: body.duration.trim(),
    deliveryMethod: body.deliveryMethod.trim(),
    eligibleRoles,
    programmeType: body.programmeType,
    location: body.location.trim(),
    status,
    interestEnabled: false,
    submittedAt: action === 'submit' ? now : course.submittedAt,
    reviewedAt: null,
    reviewedBy: '',
    reviewNote: '',
    statusHistory: [...(course.statusHistory || []), { status, date: now, actor: req.user.email }],
  };
  await persistRecord('learningCourses', updated);
  learning.courses[learning.courses.indexOf(course)] = updated;
  return res.json({ course: getLearningCourse(updated) });
});

app.patch('/api/learning/courses/:id/status', authenticate, async (req, res) => {
  if (req.activeRole !== 'administrator') {
    return res.status(403).json({ message: 'Only an administrator can review learning listings.' });
  }
  const course = learning.courses.find((entry) => entry.id === req.params.id);
  if (!course) return res.status(404).json({ message: 'Learning course not found.' });
  const { status, note } = req.body || {};
  const allowedStatuses = {
    Draft: ['Approved', 'Rejected'],
    'Pending Review': ['Approved', 'Rejected'],
    Approved: ['Published', 'Rejected', 'Archived'],
    Published: ['Approved', 'Archived'],
  };
  if (!allowedStatuses[course.status]?.includes(status)) {
    return res.status(409).json({ message: `A ${course.status} learning listing cannot be changed to ${status}.` });
  }
  if (status === 'Approved' || status === 'Published') {
    const provider = learning.providers.find((entry) => entry.id === course.providerId);
    if (!provider || provider.status !== 'published') {
      return res.status(409).json({ message: 'A programme cannot be approved without an active provider profile.' });
    }
  }
  if (status === 'Rejected' && (typeof note !== 'string' || !note.trim() || note.trim().length > 500)) {
    return res.status(400).json({ message: 'Provide a rejection reason of 500 characters or fewer.' });
  }
  const now = new Date().toISOString();
  const updated = {
    ...course,
    status,
    dataStatus: status === 'Published'
      ? 'Administrator-reviewed and published. Course availability and accreditation are not independently verified.'
      : status === 'Approved'
        ? 'Administrator-approved but not published. Approval does not verify accreditation or course availability.'
        : status === 'Rejected'
          ? 'Administrator review rejected this listing. It is not available to learners.'
          : 'Administrator-archived listing. It is not available to learners.',
    interestEnabled: status === 'Published',
    reviewedAt: now,
    reviewedBy: req.user.email,
    reviewNote: status === 'Rejected' ? note.trim() : '',
    statusHistory: [...(course.statusHistory || []), {
      status,
      date: now,
      actor: req.user.email,
      ...(status === 'Rejected' ? { note: note.trim() } : {}),
    }],
  };
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.username,
    action: `${status} learning course ${course.id}`,
    timestamp: now,
  };
  await persistRecord('learningCourses', updated);
  await persistRecord('auditLogs', auditEntry);
  learning.courses[learning.courses.indexOf(course)] = updated;
  auditLogs.push(auditEntry);
  return res.json({ course: getLearningCourse(updated) });
});

function registerStakeholderOpportunityRoutes(path, requiredRole) {
  const isEmployer = requiredRole === 'employer';
  const isProvider = requiredRole === 'training_provider';
  const isSdf = requiredRole === 'sdf';
  const label = isEmployer ? 'job listings' : isProvider ? 'training programmes' : 'skills development opportunities';
  const pendingStatus = isEmployer ? 'Pending Review' : 'Pending Approval';
  const allowedCategories = isEmployer
    ? ['Employment', 'Internship', 'Workplace Opportunity', 'Training Need']
    : isProvider
      ? ['Training', 'Learnership', 'Training Service', 'Training Partnership']
      : ['Skills Development', 'Training Need', 'Training', 'Learnership', 'Funding', 'Training Partnership'];

  app.get(path, authenticate, (req, res) => {
    if (req.activeRole !== requiredRole) {
      return res.status(403).json({ message: `Only ${requiredRole.replace('_', ' ')} accounts can manage their ${label}.` });
    }
    return res.json({
      opportunities: opportunities
        .filter((entry) => entry.ownerUserId === req.user.id)
        .map((entry) => ({
          ...getOpportunityManagementResponse(entry),
          effectiveStatus: entry.status === 'Published' ? getOpportunityStatus(entry) : entry.status,
        })),
      ...(isProvider ? { providerVerificationStatus: req.user.roleVerificationStatus || 'pending' } : {}),
    });
  });

  app.post(path, authenticate, async (req, res) => {
    if (req.activeRole !== requiredRole) {
      return res.status(403).json({ message: `Only ${requiredRole.replace('_', ' ')} accounts can submit ${label}.` });
    }
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const action = body.action === 'draft' ? 'draft' : 'submit';
    const trustedOrganization = req.user.organization || (isEmployer ? req.user.email : '');
    if (!isEmployer && !trustedOrganization.trim()) {
      return res.status(400).json({ message: 'Your account must have an organisation before submitting an opportunity.' });
    }
    const submission = isEmployer ? body : { ...body, organization: trustedOrganization };
    const parsed = getOpportunityInput(submission, { employer: isEmployer, draft: action === 'draft' });
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    if (!allowedCategories.includes(parsed.value.category)) {
      return res.status(400).json({ message: `${requiredRole.replace('_', ' ')} accounts cannot submit this opportunity category.` });
    }
    const documents = getOpportunitySupportingDocuments(body.supportingDocuments ?? []);
    if (documents.error) return res.status(400).json({ message: documents.error });
    if ((!isEmployer || parsed.value.category === 'Training Need') && action === 'submit') {
      const isEmployerTrainingNeed = isEmployer && parsed.value.category === 'Training Need';
      const missingDetails = isEmployerTrainingNeed
        ? !parsed.value.trainingObjectives || !parsed.value.requiredSkills.length ||
          !parsed.value.participantCount || !parsed.value.startDate || !parsed.value.endDate
        : isProvider
          ? !parsed.value.trainingObjectives || !parsed.value.accreditation || !parsed.value.duration ||
            !parsed.value.deliveryMethod || !parsed.value.startDate || !parsed.value.endDate ||
            !parsed.value.capacity || !parsed.value.qualifications || !parsed.value.requirements.length
        : !parsed.value.trainingObjectives || !parsed.value.requiredSkills.length ||
          !parsed.value.requirements.length || !parsed.value.participantCount ||
          !parsed.value.startDate || !parsed.value.endDate;
      if (missingDetails) {
        return res.status(400).json({
          message: isProvider
            ? 'Provide training objectives, accreditation information, duration, delivery method, programme dates, and learner capacity.'
            : 'Provide training objectives, required skills, participant count, and programme dates.',
        });
      }
    }
    const now = new Date().toISOString();
    const opportunity = {
      id: `opp-${randomUUID()}`,
      ...parsed.value,
      status: action === 'draft' ? 'Draft' : pendingStatus,
      ownerUserId: req.user.id,
      submittedBy: req.user.email,
      submittedByRole: requiredRole,
      organization: trustedOrganization,
      contactEmail: req.user.email,
      benefits: [],
      supportingDocuments: documents.value,
      openingDate: null,
      submittedAt: action === 'submit' ? now : null,
      reviewedAt: null,
      reviewedBy: '',
      reviewNote: '',
      statusHistory: [{ status: action === 'draft' ? 'Draft' : pendingStatus, date: now, actor: req.user.email }],
      dataStatus: `${requiredRole.replace('_', ' ')} submission. Not visible to applicants until administrator approval and publication.`,
      isDemo: false,
    };
    await persistRecord('opportunities', opportunity);
    opportunities.push(opportunity);
    if (action === 'submit') {
      const admins = users.filter((entry) => entry.status === 'active' && entry.roles.includes('administrator'));
      for (const administrator of admins) {
        await addUserNotification(
          administrator.id,
          'Opportunity awaiting approval',
          `${opportunity.title} was submitted by ${requiredRole.replace('_', ' ')} ${opportunity.organization}.`,
          { targetType: 'opportunity', targetId: opportunity.id }
        );
      }
    }
    return res.status(201).json({ opportunity: getOpportunityManagementResponse(opportunity) });
  });

  app.patch(`${path}/:id`, authenticate, async (req, res) => {
    if (req.activeRole !== requiredRole) {
      return res.status(403).json({ message: `Only ${requiredRole.replace('_', ' ')} accounts can manage their ${label}.` });
    }
    const opportunity = opportunities.find((entry) =>
      entry.id === req.params.id && entry.ownerUserId === req.user.id
    );
    if (!opportunity) return res.status(404).json({ message: 'Opportunity submission not found.' });
    if (['Published', 'Archived', 'Closed'].includes(opportunity.status)) {
      return res.status(409).json({ message: 'Published or archived opportunities cannot be edited.' });
    }
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const now = new Date().toISOString();
    if (body.action === 'withdraw') {
      const updated = {
        ...opportunity,
        status: 'Archived',
        statusHistory: [...(opportunity.statusHistory || []), { status: 'Archived', date: now, actor: req.user.email }],
      };
      await persistRecord('opportunities', updated);
      opportunities[opportunities.indexOf(opportunity)] = updated;
      return res.json({ opportunity: updated });
    }
    if (!['draft', 'submit'].includes(body.action)) {
      return res.status(400).json({ message: 'Choose save as draft, submit for review, or withdraw.' });
    }
    const action = body.action;
    const submission = isEmployer ? body : { ...body, organization: req.user.organization };
    const parsed = getOpportunityInput(submission, { employer: isEmployer, draft: action === 'draft' });
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    if (!allowedCategories.includes(parsed.value.category)) {
      return res.status(400).json({ message: `${requiredRole.replace('_', ' ')} accounts cannot submit this opportunity category.` });
    }
    const documents = body.supportingDocuments === undefined
      ? { value: opportunity.supportingDocuments || [] }
      : getOpportunitySupportingDocuments(body.supportingDocuments);
    if (documents.error) return res.status(400).json({ message: documents.error });
    if ((!isEmployer || parsed.value.category === 'Training Need') && action === 'submit') {
      const isEmployerTrainingNeed = isEmployer && parsed.value.category === 'Training Need';
      const missingDetails = isEmployerTrainingNeed
        ? !parsed.value.trainingObjectives || !parsed.value.requiredSkills.length ||
          !parsed.value.participantCount || !parsed.value.startDate || !parsed.value.endDate
        : isProvider
        ? !parsed.value.trainingObjectives || !parsed.value.accreditation || !parsed.value.duration ||
          !parsed.value.deliveryMethod || !parsed.value.startDate || !parsed.value.endDate ||
          !parsed.value.capacity || !parsed.value.qualifications || !parsed.value.requirements.length
        : !parsed.value.trainingObjectives || !parsed.value.requiredSkills.length ||
          !parsed.value.requirements.length || !parsed.value.participantCount ||
          !parsed.value.startDate || !parsed.value.endDate;
      if (missingDetails) {
        return res.status(400).json({
          message: isProvider
            ? 'Provide training objectives, accreditation information, duration, delivery method, programme dates, and learner capacity.'
            : 'Provide training objectives, required skills, participant count, and programme dates.',
        });
      }
    }
    const status = action === 'draft' ? 'Draft' : pendingStatus;
    const updated = {
      ...opportunity,
      ...parsed.value,
      trainingObjectives: typeof req.body.trainingObjectives === 'string'
        ? parsed.value.trainingObjectives
        : opportunity.trainingObjectives || '',
      requiredSkills: req.body.requiredSkills === undefined
        ? opportunity.requiredSkills || []
        : parsed.value.requiredSkills,
      participantCount: req.body.participantCount === undefined
        ? opportunity.participantCount ?? null
        : parsed.value.participantCount,
      startDate: req.body.startDate === undefined ? opportunity.startDate || null : parsed.value.startDate,
      endDate: req.body.endDate === undefined ? opportunity.endDate || null : parsed.value.endDate,
      accreditation: typeof req.body.accreditation === 'string'
        ? parsed.value.accreditation
        : opportunity.accreditation || '',
      duration: typeof req.body.duration === 'string' ? parsed.value.duration : opportunity.duration || '',
      deliveryMethod: typeof req.body.deliveryMethod === 'string'
        ? parsed.value.deliveryMethod
        : opportunity.deliveryMethod || '',
      capacity: req.body.capacity === undefined ? opportunity.capacity ?? null : parsed.value.capacity,
      fees: req.body.fees === undefined ? opportunity.fees ?? null : parsed.value.fees,
      organization: trustedOrganizationForRole(req.user, isEmployer),
      supportingDocuments: documents.value,
      status,
      submittedAt: action === 'submit' ? now : opportunity.submittedAt,
      reviewedAt: null,
      reviewedBy: '',
      reviewNote: '',
      statusHistory: [...(opportunity.statusHistory || []), { status, date: now, actor: req.user.email }],
    };
    await persistRecord('opportunities', updated);
    opportunities[opportunities.indexOf(opportunity)] = updated;
    if (action === 'submit') {
      const admins = users.filter((entry) => entry.status === 'active' && entry.roles.includes('administrator'));
      for (const administrator of admins) {
        await addUserNotification(
          administrator.id,
          'Opportunity resubmitted for approval',
          `${updated.title} was updated and resubmitted by ${requiredRole.replace('_', ' ')}.`,
          { targetType: 'opportunity', targetId: updated.id }
        );
      }
    }
    return res.json({ opportunity: getOpportunityManagementResponse(updated) });
  });
}

function trustedOrganizationForRole(user, isEmployer) {
  return user.organization || (isEmployer ? user.email : '');
}

function getSdfOrganizationId(user) {
  if (!user || user.activeRole !== 'sdf' || user.status !== 'active' ||
      user.roleVerificationStatus !== 'approved') return null;
  return user.sdfOrganizationId || `sdf-user-${user.id}`;
}

function getSdfWorkforceInput(type, body, organizationId) {
  const allowedFields = {
    assessment: [
      'title', 'reportingYear', 'assessmentDate', 'department', 'occupationGroup',
      'employeeCount', 'skillArea', 'currentLevel', 'targetLevel', 'priority',
      'proposedIntervention',
    ],
    wsp: [
      'title', 'reportingYear', 'objective', 'intervention', 'skillAreas',
      'participantCount', 'deliveryMethod', 'plannedStartDate', 'plannedEndDate',
      'estimatedCostZar', 'assessmentId',
    ],
    atr: [
      'title', 'reportingYear', 'wspId', 'plannedParticipantCount', 'actualParticipantCount',
      'completedParticipantCount', 'expenditureZar', 'outcomeSummary',
    ],
    training: [
      'title', 'reportingYear', 'wspId', 'department', 'occupationGroup', 'skillAreas', 'employeeCount',
      'completedEmployeeCount', 'providerName', 'deliveryMethod', 'startDate', 'endDate',
      'outcomeSummary',
    ],
  }[type];
  if (!allowedFields) return { error: 'Choose a supported SDF workforce record type.' };
  const unexpectedFields = Object.keys(body).filter((field) =>
    !allowedFields.includes(field) && !['type', 'action'].includes(field)
  );
  if (unexpectedFields.length) return { error: `Unsupported workforce field(s): ${unexpectedFields.join(', ')}.` };

  const text = (field, label, maximum, required = true) => {
    const value = typeof body[field] === 'string' ? body[field].trim() : '';
    if ((required && !value) || value.length > maximum) {
      return { error: `${label} is required and must be ${maximum} characters or fewer.` };
    }
    return { value };
  };
  const count = (field, label, { required = true, maximum = 10000 } = {}) => {
    const raw = body[field];
    if (!required && (raw === undefined || raw === null || raw === '')) return { value: null };
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(value) || value < (required ? 1 : 0) || value > maximum) {
      return { error: `${label} must be a whole number from ${required ? 1 : 0} to ${maximum}.` };
    }
    return { value };
  };
  const money = (field, label) => {
    const raw = body[field];
    if (raw === undefined || raw === null || raw === '') return { value: 0 };
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 10000000) {
      return { error: `${label} must be between R0 and R10,000,000.` };
    }
    return { value };
  };
  const date = (field, label, required = true) => {
    const value = typeof body[field] === 'string' ? body[field].trim() : '';
    if (!value && !required) return { value: null };
    if (!isValidIsoDate(value)) return { error: `${label} must be a valid YYYY-MM-DD date.` };
    return { value };
  };
  const year = body.reportingYear;
  const currentYear = new Date().getUTCFullYear();
  if (!Number.isInteger(Number(year)) || Number(year) < currentYear - 5 || Number(year) > currentYear + 5) {
    return { error: 'Reporting year must be a valid year within five years of the current year.' };
  }
  const title = text('title', 'Record title', 120);
  if (title.error) return title;

  const record = { type, title: title.value, reportingYear: Number(year), organizationId };
  if (type === 'assessment') {
    const assessmentDate = date('assessmentDate', 'Assessment date');
    const department = text('department', 'Department or work area', 120);
    const occupationGroup = text('occupationGroup', 'Occupation or employee group', 120);
    const employeeCount = count('employeeCount', 'Affected employee count');
    const skillArea = text('skillArea', 'Skill gap', 160);
    const currentLevel = count('currentLevel', 'Current skill level', { maximum: 5 });
    const targetLevel = count('targetLevel', 'Target skill level', { maximum: 5 });
    const priority = text('priority', 'Priority', 20);
    const proposedIntervention = text('proposedIntervention', 'Proposed intervention', 500);
    const fields = [assessmentDate, department, occupationGroup, employeeCount, skillArea, currentLevel, targetLevel, priority, proposedIntervention];
    const invalid = fields.find((field) => field.error);
    if (invalid) return invalid;
    if (assessmentDate.value > new Date().toISOString().slice(0, 10)) {
      return { error: 'Assessment date cannot be in the future.' };
    }
    if (currentLevel.value >= targetLevel.value) {
      return { error: 'Target skill level must be higher than current skill level.' };
    }
    if (!['Low', 'Medium', 'High'].includes(priority.value)) return { error: 'Priority must be Low, Medium, or High.' };
    Object.assign(record, {
      assessmentDate: assessmentDate.value,
      department: department.value,
      occupationGroup: occupationGroup.value,
      employeeCount: employeeCount.value,
      skillArea: skillArea.value,
      currentLevel: currentLevel.value,
      targetLevel: targetLevel.value,
      priority: priority.value,
      proposedIntervention: proposedIntervention.value,
    });
  } else if (type === 'wsp') {
    const objective = text('objective', 'Skills development objective', 500);
    const intervention = text('intervention', 'Planned intervention', 200);
    const skillAreas = text('skillAreas', 'Skills to be developed', 500);
    const participantCount = count('participantCount', 'Planned participant count');
    const deliveryMethod = text('deliveryMethod', 'Delivery method', 30);
    const plannedStartDate = date('plannedStartDate', 'Planned start date');
    const plannedEndDate = date('plannedEndDate', 'Planned end date');
    const estimatedCostZar = money('estimatedCostZar', 'Estimated cost');
    const assessmentId = text('assessmentId', 'Assessment reference', 100, false);
    const fields = [objective, intervention, skillAreas, participantCount, deliveryMethod, plannedStartDate, plannedEndDate, estimatedCostZar, assessmentId];
    const invalid = fields.find((field) => field.error);
    if (invalid) return invalid;
    if (!['Online', 'Physical', 'Hybrid', 'Workplace'].includes(deliveryMethod.value)) {
      return { error: 'Choose Online, Physical, Hybrid, or Workplace delivery.' };
    }
    if (plannedEndDate.value < plannedStartDate.value) return { error: 'Planned end date cannot be before planned start date.' };
    if (assessmentId.value && !sdfWorkforceRecords.some((entry) =>
      entry.id === assessmentId.value && entry.type === 'assessment' && entry.organizationId === organizationId
    )) return { error: 'The linked skills-gap assessment was not found for this organisation.' };
    Object.assign(record, {
      objective: objective.value,
      intervention: intervention.value,
      skillAreas: skillAreas.value,
      participantCount: participantCount.value,
      deliveryMethod: deliveryMethod.value,
      plannedStartDate: plannedStartDate.value,
      plannedEndDate: plannedEndDate.value,
      estimatedCostZar: estimatedCostZar.value,
      assessmentId: assessmentId.value || null,
    });
  } else if (type === 'atr') {
    const plannedParticipantCount = count('plannedParticipantCount', 'Planned participant count');
    const actualParticipantCount = count('actualParticipantCount', 'Actual participant count', { required: false });
    const completedParticipantCount = count('completedParticipantCount', 'Completed participant count', { required: false });
    const expenditureZar = money('expenditureZar', 'Actual expenditure');
    const outcomeSummary = text('outcomeSummary', 'Outcome summary', 1000);
    const wspId = text('wspId', 'WSP reference', 100, false);
    const fields = [plannedParticipantCount, actualParticipantCount, completedParticipantCount, expenditureZar, outcomeSummary, wspId];
    const invalid = fields.find((field) => field.error);
    if (invalid) return invalid;
    if ((actualParticipantCount.value ?? 0) > plannedParticipantCount.value ||
        (completedParticipantCount.value ?? 0) > (actualParticipantCount.value ?? 0)) {
      return { error: 'Actual participants cannot exceed planned participants, and completions cannot exceed attendance.' };
    }
    if (wspId.value && !sdfWorkforceRecords.some((entry) =>
      entry.id === wspId.value && entry.type === 'wsp' && entry.organizationId === organizationId
    )) return { error: 'The linked WSP record was not found for this organisation.' };
    Object.assign(record, {
      plannedParticipantCount: plannedParticipantCount.value,
      actualParticipantCount: actualParticipantCount.value ?? 0,
      completedParticipantCount: completedParticipantCount.value ?? 0,
      expenditureZar: expenditureZar.value,
      outcomeSummary: outcomeSummary.value,
      wspId: wspId.value || null,
    });
  } else {
    const department = text('department', 'Department or work area', 120);
    const occupationGroup = text('occupationGroup', 'Occupation or employee group', 120);
    const skillAreas = text('skillAreas', 'Skills to be developed', 500);
    const employeeCount = count('employeeCount', 'Cohort size');
    const completedEmployeeCount = count('completedEmployeeCount', 'Completed employees', { required: false });
    const providerName = text('providerName', 'Training provider or internal trainer', 160);
    const deliveryMethod = text('deliveryMethod', 'Delivery method', 30);
    const startDate = date('startDate', 'Training start date');
    const endDate = date('endDate', 'Training end date');
    const outcomeSummary = text('outcomeSummary', 'Training outcome', 1000, false);
    const wspId = text('wspId', 'WSP reference', 100, false);
    const fields = [department, occupationGroup, skillAreas, employeeCount, completedEmployeeCount, providerName, deliveryMethod, startDate, endDate, outcomeSummary, wspId];
    const invalid = fields.find((field) => field.error);
    if (invalid) return invalid;
    if (!['Online', 'Physical', 'Hybrid', 'Workplace'].includes(deliveryMethod.value)) {
      return { error: 'Choose Online, Physical, Hybrid, or Workplace delivery.' };
    }
    if (endDate.value < startDate.value) return { error: 'Training end date cannot be before its start date.' };
    if ((completedEmployeeCount.value ?? 0) > employeeCount.value) {
      return { error: 'Completed employees cannot exceed the cohort size.' };
    }
    if (wspId.value && !sdfWorkforceRecords.some((entry) =>
      entry.id === wspId.value && entry.type === 'wsp' && entry.organizationId === organizationId
    )) return { error: 'The linked WSP record was not found for this organisation.' };
    Object.assign(record, {
      department: department.value,
      occupationGroup: occupationGroup.value,
      skillAreas: skillAreas.value,
      employeeCount: employeeCount.value,
      completedEmployeeCount: completedEmployeeCount.value ?? 0,
      providerName: providerName.value,
      deliveryMethod: deliveryMethod.value,
      startDate: startDate.value,
      endDate: endDate.value,
      outcomeSummary: outcomeSummary.value,
      wspId: wspId.value || null,
      status: 'Planned',
    });
  }
  return { value: record };
}

function recordSdfWorkforceAudit(req, action, record) {
  return {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `${action} SDF ${record.type} record ${record.id} for organisation ${record.organizationId}`,
    timestamp: new Date().toISOString(),
  };
}

function getSdfWorkforceResponse(record) {
  const response = { ...record };
  delete response.createdBy;
  delete response.organizationId;
  return response;
}

app.get('/api/sdf/workforce', authenticate, async (req, res) => {
  const organizationId = getSdfOrganizationId(req.user);
  if (!organizationId) return res.status(403).json({ message: 'An active, administrator-approved SDF account is required.' });
  const organizationRecords = sdfWorkforceRecords.filter((entry) => entry.organizationId === organizationId);
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `Viewed ${organizationRecords.length} SDF workforce record(s) for organisation ${organizationId}`,
    timestamp: new Date().toISOString(),
  };
  await persistRecord('auditLogs', auditEntry);
  auditLogs.push(auditEntry);
  return res.json({
    records: organizationRecords
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(getSdfWorkforceResponse),
  });
});

app.post('/api/sdf/workforce', authenticate, async (req, res) => {
  const organizationId = getSdfOrganizationId(req.user);
  if (!organizationId) return res.status(403).json({ message: 'An active, administrator-approved SDF account is required.' });
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const type = body.type;
  const action = body.action === undefined ? 'draft' : body.action;
  if (!['draft', 'submit'].includes(action)) return res.status(400).json({ message: 'Action must be draft or submit.' });
  if (type === 'training' && action !== 'draft') {
    return res.status(400).json({ message: 'Training cohorts are coordinated through their training status, not submitted as planning documents.' });
  }
  const parsed = getSdfWorkforceInput(type, body, organizationId);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  const now = new Date().toISOString();
  const record = {
    id: `sdf-${type}-${randomUUID()}`,
    ...parsed.value,
    status: type === 'training' ? 'Planned' : action === 'submit' ? 'Submitted' : 'Draft',
    createdBy: req.user.id,
    createdAt: now,
    updatedAt: now,
    submittedAt: action === 'submit' ? now : null,
  };
  const auditEntry = recordSdfWorkforceAudit(req, action === 'submit' ? 'Submitted' : 'Created', record);
  await persistRecord('sdfWorkforceRecords', record);
  await persistRecord('auditLogs', auditEntry);
  sdfWorkforceRecords.push(record);
  auditLogs.push(auditEntry);
  return res.status(201).json({ record: getSdfWorkforceResponse(record) });
});

app.patch('/api/sdf/workforce/:id', authenticate, async (req, res) => {
  const organizationId = getSdfOrganizationId(req.user);
  if (!organizationId) return res.status(403).json({ message: 'An active, administrator-approved SDF account is required.' });
  const record = sdfWorkforceRecords.find((entry) =>
    entry.id === req.params.id && entry.organizationId === organizationId
  );
  if (!record) return res.status(404).json({ message: 'SDF workforce record not found.' });
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  if (Object.hasOwn(body, 'id') || Object.hasOwn(body, 'organizationId') ||
      Object.hasOwn(body, 'createdBy') || (body.type !== undefined && body.type !== record.type)) {
    return res.status(400).json({ message: 'Record identity, type, and organisation are controlled by the server.' });
  }
  const now = new Date().toISOString();
  let updated;
  let auditAction;
  if (record.type === 'training') {
    const allowedStatuses = {
      Planned: ['Scheduled', 'Cancelled'],
      Scheduled: ['In Progress', 'Cancelled'],
      'In Progress': ['Completed', 'Cancelled'],
      Completed: [],
      Cancelled: ['Scheduled'],
    };
    const { status, completedEmployeeCount, outcomeSummary } = body;
    if (Object.keys(body).some((field) => !['status', 'completedEmployeeCount', 'outcomeSummary'].includes(field))) {
      return res.status(400).json({ message: 'Only training status, completed employee count, and outcome summary can be updated.' });
    }
    const nextStatus = status || record.status;
    if (!allowedStatuses[record.status]?.includes(nextStatus) && nextStatus !== record.status) {
      return res.status(409).json({ message: `Training cohort cannot transition from ${record.status} to ${status || 'that status'}.` });
    }
    const completed = completedEmployeeCount === undefined
      ? record.completedEmployeeCount
      : Number(completedEmployeeCount);
    if (!Number.isInteger(completed) || completed < 0 || completed > record.employeeCount) {
      return res.status(400).json({ message: 'Completed employees must be a whole number within the cohort size.' });
    }
    if (nextStatus === 'Completed' && completed < 1) {
      return res.status(400).json({ message: 'Record at least one completed employee before completing the cohort.' });
    }
    if (outcomeSummary !== undefined && (typeof outcomeSummary !== 'string' || outcomeSummary.trim().length > 1000)) {
      return res.status(400).json({ message: 'Training outcome must be text of 1,000 characters or fewer.' });
    }
    updated = {
      ...record,
      status: nextStatus,
      completedEmployeeCount: completed,
      outcomeSummary: outcomeSummary === undefined ? record.outcomeSummary : outcomeSummary.trim(),
      updatedAt: now,
    };
    auditAction = `Updated training cohort status to ${nextStatus}`;
  } else {
    if (record.status !== 'Draft') {
      return res.status(409).json({ message: 'Submitted SDF planning records are read-only.' });
    }
    if (Object.hasOwn(body, 'status')) {
      return res.status(400).json({ message: 'Use action "submit" to submit a planning record.' });
    }
    const action = body.action === undefined ? 'draft' : body.action;
    if (!['draft', 'submit'].includes(action)) {
      return res.status(400).json({ message: 'Action must be draft or submit.' });
    }
    const type = record.type;
    const input = { ...record, ...body };
    delete input.id;
    delete input.organizationId;
    delete input.createdBy;
    delete input.createdAt;
    delete input.updatedAt;
    delete input.submittedAt;
    delete input.status;
    input.action = action;
    const parsed = getSdfWorkforceInput(type, input, organizationId);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    updated = {
      ...record,
      ...parsed.value,
      status: action === 'submit' ? 'Submitted' : 'Draft',
      updatedAt: now,
      submittedAt: action === 'submit' ? now : null,
    };
    auditAction = action === 'submit' ? 'Submitted' : 'Updated';
  }
  const auditEntry = recordSdfWorkforceAudit(req, auditAction, updated);
  await persistRecord('sdfWorkforceRecords', updated);
  await persistRecord('auditLogs', auditEntry);
  sdfWorkforceRecords[sdfWorkforceRecords.indexOf(record)] = updated;
  auditLogs.push(auditEntry);
  return res.json({ record: getSdfWorkforceResponse(updated) });
});

registerStakeholderOpportunityRoutes('/api/employer/opportunities', 'employer');
registerStakeholderOpportunityRoutes('/api/sdf/opportunities', 'sdf');
registerStakeholderOpportunityRoutes('/api/provider/opportunities', 'training_provider');

app.get('/api/admin/opportunities', authenticate, (req, res) => {
  if (req.activeRole !== 'administrator') {
    return res.status(403).json({ message: 'Only administrators can manage opportunity content.' });
  }
  const { status, q = '' } = req.query;
  const query = String(q).trim().toLowerCase();
  const filtered = opportunities.filter((entry) => {
    const effectiveStatus = entry.status === 'Published' ? getOpportunityStatus(entry) : entry.status;
    return (!status || entry.status.toLowerCase() === String(status).toLowerCase() ||
      effectiveStatus.toLowerCase() === String(status).toLowerCase()) &&
      (!query || `${entry.title} ${entry.organization} ${entry.category} ${entry.submittedBy}`.toLowerCase().includes(query));
  });
  return res.json({
    opportunities: filtered.map((entry) => ({
      ...getOpportunityManagementResponse(entry, { administrator: true }),
      effectiveStatus: entry.status === 'Published' ? getOpportunityStatus(entry) : entry.status,
    })),
  });
});

app.post('/api/admin/opportunities', authenticate, async (req, res) => {
  if (req.activeRole !== 'administrator') {
    return res.status(403).json({ message: 'Only administrators can manage opportunity content.' });
  }
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const action = body.action === 'draft' ? 'draft' : 'approve';
  const parsed = getOpportunityInput(body, { draft: action === 'draft' });
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  if (action !== 'draft') {
    const sourceError = getOpportunitySourceError({ ...parsed.value, isDemo: false, isAdminManaged: true });
    if (sourceError) return res.status(400).json({ message: sourceError });
  }
  const now = new Date().toISOString();
  const opportunity = {
    id: `opp-${randomUUID()}`,
    ...parsed.value,
    status: action === 'draft' ? 'Draft' : 'Approved',
    ownerUserId: req.user.id,
    submittedBy: req.user.email,
    organization: typeof body.organization === 'string' ? body.organization.trim().slice(0, 160) : 'AgriSETA',
    contactEmail: typeof body.contactEmail === 'string' ? body.contactEmail.trim().slice(0, 160) : '',
    benefits: Array.isArray(body.benefits) ? body.benefits.filter((entry) => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean).slice(0, 20) : [],
    openingDate: null,
    submittedAt: action === 'approve' ? now : null,
    reviewedAt: action === 'approve' ? now : null,
    reviewedBy: action === 'approve' ? req.user.email : '',
    reviewNote: '',
    statusHistory: [{ status: action === 'draft' ? 'Draft' : 'Approved', date: now, actor: req.user.email }],
    dataStatus: 'Administrator-managed content. Confirm the source and eligibility before publication.',
    isDemo: false,
    isAdminManaged: true,
  };
  await persistRecord('opportunities', opportunity);
  opportunities.push(opportunity);
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `${opportunity.status} opportunity ${opportunity.id}`,
    timestamp: now,
  };
  await persistRecord('auditLogs', auditEntry);
  auditLogs.push(auditEntry);
  return res.status(201).json({ opportunity });
});

app.patch('/api/admin/opportunities/:id', authenticate, async (req, res) => {
  if (req.activeRole !== 'administrator') {
    return res.status(403).json({ message: 'Only administrators can review opportunity content.' });
  }
  const opportunity = opportunities.find((entry) => entry.id === req.params.id);
  if (!opportunity) return res.status(404).json({ message: 'Opportunity not found.' });
  const { action, note } = req.body || {};
  if (action === 'edit') {
    if (['Published', 'Archived'].includes(opportunity.status)) {
      return res.status(409).json({ message: 'Unpublish a listing before editing it.' });
    }
    const parsed = getOpportunityInput(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const now = new Date().toISOString();
    const updated = {
      ...opportunity,
      ...parsed.value,
      trainingObjectives: req.body.trainingObjectives === undefined
        ? opportunity.trainingObjectives || ''
        : parsed.value.trainingObjectives,
      requiredSkills: req.body.requiredSkills === undefined
        ? opportunity.requiredSkills || []
        : parsed.value.requiredSkills,
      participantCount: req.body.participantCount === undefined
        ? opportunity.participantCount ?? null
        : parsed.value.participantCount,
      startDate: req.body.startDate === undefined ? opportunity.startDate || null : parsed.value.startDate,
      endDate: req.body.endDate === undefined ? opportunity.endDate || null : parsed.value.endDate,
      accreditation: req.body.accreditation === undefined
        ? opportunity.accreditation || ''
        : parsed.value.accreditation,
      duration: req.body.duration === undefined ? opportunity.duration || '' : parsed.value.duration,
      deliveryMethod: req.body.deliveryMethod === undefined
        ? opportunity.deliveryMethod || ''
        : parsed.value.deliveryMethod,
      capacity: req.body.capacity === undefined ? opportunity.capacity ?? null : parsed.value.capacity,
      fees: req.body.fees === undefined ? opportunity.fees ?? null : parsed.value.fees,
      organization: req.body.organization.trim(),
      contactEmail: typeof req.body.contactEmail === 'string' ? req.body.contactEmail.trim().slice(0, 160) : '',
      status: 'Draft',
      submittedAt: null,
      reviewedAt: null,
      reviewedBy: '',
      reviewNote: '',
      statusHistory: [...(opportunity.statusHistory || []), { status: 'Draft', date: now, actor: req.user.email }],
    };
    const auditEntry = {
      id: `audit-${randomUUID()}`,
      user: req.user.email,
      action: `Edited opportunity ${opportunity.id}; returned it to draft`,
      timestamp: now,
    };
    await persistRecord('opportunities', updated);
    await persistRecord('auditLogs', auditEntry);
    opportunities[opportunities.indexOf(opportunity)] = updated;
    auditLogs.push(auditEntry);
    return res.json({ opportunity: updated });
  }
  const allowedActions = {
    'Pending Review': ['approve', 'reject', 'request_changes', 'archive'],
    'Pending Approval': ['approve', 'reject', 'request_changes', 'archive'],
    'Changes Requested': ['archive'],
    Approved: ['publish', 'reject', 'request_changes', 'archive'],
    Published: ['unpublish', 'archive', 'close'],
    Rejected: ['archive'],
    Draft: ['approve', 'reject', 'archive'],
    Open: ['archive'],
    Prototype: ['archive'],
    Expired: ['archive'],
    Closed: [],
  };
  if (!allowedActions[opportunity.status]?.includes(action)) {
    return res.status(409).json({ message: `This ${opportunity.status} opportunity cannot be changed using that action.` });
  }
  if (action === 'approve') {
    const parsed = getOpportunityInput(opportunity);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const sourceError = getOpportunitySourceError(opportunity);
    if (sourceError) return res.status(400).json({ message: sourceError });
  }
  if (action === 'publish') {
    const sourceError = getOpportunitySourceError(opportunity);
    if (sourceError) return res.status(400).json({ message: sourceError });
  }
  if (['reject', 'request_changes'].includes(action) &&
      (typeof note !== 'string' || !note.trim() || note.trim().length > 500)) {
    return res.status(400).json({ message: 'Provide a review note of 500 characters or fewer.' });
  }
  if (action === 'publish' && !canPublishOpportunity(opportunity)) {
    return res.status(403).json({ message: 'Only an active, administrator-verified training provider can publish an approved programme.' });
  }
  const nextStatus = {
    approve: 'Approved',
    reject: 'Rejected',
    request_changes: 'Changes Requested',
    publish: 'Published',
    unpublish: 'Approved',
    archive: 'Archived',
    close: 'Closed',
  }[action];
  const now = new Date().toISOString();
  const updated = {
    ...opportunity,
    status: nextStatus,
    reviewedAt: ['approve', 'reject', 'request_changes'].includes(action) ? now : opportunity.reviewedAt,
    reviewedBy: ['approve', 'reject', 'request_changes'].includes(action) ? req.user.email : opportunity.reviewedBy,
    reviewNote: ['reject', 'request_changes'].includes(action) ? note.trim() : opportunity.reviewNote,
    statusHistory: [...(opportunity.statusHistory || []), {
      status: nextStatus,
      date: now,
      actor: req.user.email,
      ...(['reject', 'request_changes'].includes(action) ? { note: note.trim() } : {}),
    }],
  };
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `${nextStatus} opportunity ${opportunity.id}`,
    timestamp: now,
  };
  await persistRecord('opportunities', updated);
  await persistRecord('auditLogs', auditEntry);
  opportunities[opportunities.indexOf(opportunity)] = updated;
  auditLogs.push(auditEntry);
  if (['approve', 'reject', 'request_changes', 'publish', 'close'].includes(action) && opportunity.ownerUserId) {
    const message = action === 'request_changes'
      ? `Changes are requested for ${opportunity.title}: ${note.trim()}`
      : action === 'reject'
        ? `${opportunity.title} was rejected: ${note.trim()}`
        : action === 'approve'
          ? `${opportunity.title} was approved.`
          : action === 'publish'
            ? `${opportunity.title} is now published.`
            : `${opportunity.title} was closed.`;
    await addUserNotification(
      opportunity.ownerUserId,
      'Opportunity review update',
      message,
      { targetType: 'opportunity', targetId: opportunity.id }
    );
  }
  return res.json({ opportunity: updated });
});

app.get('/api/admin/opportunities/:id/documents/:documentId', authenticate, async (req, res) => {
  if (req.activeRole !== 'administrator') {
    return res.status(403).json({ message: 'Only administrators can access opportunity submission documents.' });
  }
  const opportunity = opportunities.find((entry) => entry.id === req.params.id);
  if (!opportunity) return res.status(404).json({ message: 'Opportunity not found.' });
  const document = (opportunity.supportingDocuments || []).find((entry) => entry.id === req.params.documentId);
  if (!document) return res.status(404).json({ message: 'Opportunity supporting document not found.' });
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `Viewed opportunity supporting document for ${opportunity.id}`,
    timestamp: new Date().toISOString(),
  };
  await persistRecord('auditLogs', auditEntry);
  auditLogs.push(auditEntry);
  return res.json({ document: { ...document } });
});

app.patch('/api/admin/services/:id/requirements', authenticate, async (req, res) => {
  if (req.activeRole !== 'administrator') {
    return res.status(403).json({ message: 'Only administrators can change service application requirements.' });
  }
  const service = services.find((entry) => entry.id === req.params.id);
  if (!service) return res.status(404).json({ message: 'Service not found.' });
  const { requiredDocuments } = req.body || {};
  if (!Array.isArray(requiredDocuments) || requiredDocuments.length > 5 ||
      requiredDocuments.some((entry) =>
        typeof entry !== 'string' || !entry.trim() || entry.trim().length > 160 ||
        /identity|passport|bank account|health|medical|biometric/i.test(entry)
      ) || new Set(requiredDocuments.map((entry) => entry.trim())).size !== requiredDocuments.length) {
    return res.status(400).json({ message: 'Add up to five distinct, relevant document requirements of 160 characters or fewer.' });
  }
  const updatedService = { ...service, requiredDocuments: requiredDocuments.map((entry) => entry.trim()) };
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `Updated application document requirements for service ${service.id}`,
    timestamp: new Date().toISOString(),
  };
  await persistRecord('services', updatedService);
  await persistRecord('auditLogs', auditEntry);
  services[services.indexOf(service)] = updatedService;
  auditLogs.push(auditEntry);
  return res.json({ service: updatedService });
});

app.get('/api/opportunities', authenticate, (req, res) => {
  const { q = '', category, audience, status, employmentType, sort = 'deadline' } = req.query;
  const normalizedQuery = String(q).trim().toLowerCase();
  const filteredOpportunities = opportunities.filter((entry) => {
    if (entry.status !== 'Published' || getOpportunityStatus(entry) !== 'Open' || !canPublishOpportunity(entry)) return false;
    const matchesRole = ['administrator', 'internal_staff'].includes(req.activeRole) ||
      entry.role === req.activeRole || entry.role === '*';
    const matchesSearch = !normalizedQuery ||
      `${entry.title} ${entry.type} ${entry.category} ${entry.description} ${entry.role} ${entry.organization || ''} ${entry.location || ''} ${entry.employmentType || ''} ${entry.trainingObjectives || ''} ${(entry.requiredSkills || []).join(' ')}`.toLowerCase().includes(normalizedQuery);
    const matchesCategory = !category || entry.category.toLowerCase() === String(category).toLowerCase();
    const matchesAudience = !audience || entry.role === audience;
    const matchesEmployment = !employmentType ||
      String(entry.employmentType || '').toLowerCase() === String(employmentType).toLowerCase();
    const matchesStatus = !status || getOpportunityStatus(entry).toLowerCase() === String(status).toLowerCase();
    return matchesRole && matchesSearch && matchesCategory && matchesAudience && matchesEmployment && matchesStatus;
  });

  const sorters = {
    deadline: (left, right) => {
      if (!left.closingDate) return right.closingDate ? 1 : left.title.localeCompare(right.title);
      if (!right.closingDate) return -1;
      return left.closingDate.localeCompare(right.closingDate);
    },
    title: (left, right) => left.title.localeCompare(right.title),
    newest: (left, right) => (right.openingDate || '').localeCompare(left.openingDate || ''),
  };
  filteredOpportunities.sort(sorters[sort] || sorters.deadline);
  return res.json({
    opportunities: filteredOpportunities.map((entry) => getPublicOpportunityResponse(entry)),
    serverDate: new Date().toISOString(),
  });
});

app.get('/api/opportunities/saved', authenticate, (req, res) => {
  const savedIds = new Set(
    savedOpportunities.filter((entry) => entry.userId === req.user.id).map((entry) => entry.opportunityId)
  );
  return res.json({
    opportunities: opportunities
      .filter((entry) =>
        savedIds.has(entry.id) &&
        entry.status === 'Published' &&
        getOpportunityStatus(entry) === 'Open' &&
        canPublishOpportunity(entry) &&
        (['administrator', 'internal_staff'].includes(req.activeRole) || entry.role === req.activeRole || entry.role === '*')
      )
      .map((entry) => getPublicOpportunityResponse(entry)),
  });
});

app.post('/api/opportunities/:id/saved', authenticate, async (req, res) => {
  const opportunity = opportunities.find((entry) => entry.id === req.params.id);
  if (!opportunity || opportunity.status !== 'Published' || getOpportunityStatus(opportunity) !== 'Open' ||
      !canPublishOpportunity(opportunity) ||
      (!['administrator', 'internal_staff'].includes(req.activeRole) && opportunity.role !== req.activeRole && opportunity.role !== '*')) {
    return res.status(404).json({ message: 'Opportunity not found.' });
  }
  const existing = savedOpportunities.find(
    (entry) => entry.userId === req.user.id && entry.opportunityId === opportunity.id
  );
  if (!existing) {
    const saved = { userId: req.user.id, opportunityId: opportunity.id, savedAt: new Date().toISOString() };
    await persistRecord('savedOpportunities', saved);
    savedOpportunities.push(saved);
  }
  return res.status(existing ? 200 : 201).json({ saved: true, opportunityId: opportunity.id });
});

app.delete('/api/opportunities/:id/saved', authenticate, async (req, res) => {
  const savedIndex = savedOpportunities.findIndex(
    (entry) => entry.userId === req.user.id && entry.opportunityId === req.params.id
  );
  if (savedIndex >= 0) {
    const [saved] = savedOpportunities.splice(savedIndex, 1);
    try {
      await removeRecord('savedOpportunities', { userId: saved.userId, opportunityId: saved.opportunityId });
    } catch (error) {
      savedOpportunities.splice(savedIndex, 0, saved);
      throw error;
    }
  }
  return res.json({ saved: false, opportunityId: req.params.id });
});

app.get('/api/opportunities/:id', authenticate, (req, res) => {
  const opportunity = opportunities.find((entry) => entry.id === req.params.id);
  if (!opportunity || opportunity.status !== 'Published' || getOpportunityStatus(opportunity) !== 'Open' ||
      !canPublishOpportunity(opportunity) ||
      (!['administrator', 'internal_staff'].includes(req.activeRole) && opportunity.role !== req.activeRole && opportunity.role !== '*')) {
    return res.status(404).json({ message: 'Opportunity not found.' });
  }

  const saved = savedOpportunities.some(
    (entry) => entry.userId === req.user.id && entry.opportunityId === opportunity.id
  );
  return res.json({
    opportunity: getPublicOpportunityResponse(opportunity, { saved }),
  });
});

app.get('/api/notifications', authenticate, (req, res) => {
  const now = Date.now();
  return res.json({
    notifications: notifications
      .filter((entry) => {
        if (entry.userId && entry.userId !== req.user.id) return false;
        if (!entry.userId && Array.isArray(entry.audience) &&
            !entry.audience.includes('*') && !entry.audience.includes(req.activeRole)) return false;
        if (entry.isAnnouncement && (entry.status !== 'published' ||
            (entry.startsAt && Date.parse(entry.startsAt) > now) ||
            (entry.endsAt && Date.parse(entry.endsAt) < now))) return false;
        return true;
      })
      .map((entry) => entry.isAnnouncement
        ? {
          id: entry.id,
          title: entry.title,
          message: entry.message,
          read: false,
          canMarkRead: false,
          isAnnouncement: true,
          createdAt: entry.createdAt,
        }
        : { ...entry, canMarkRead: entry.userId === req.user.id }),
  });
});

app.patch('/api/notifications/:id/read', authenticate, async (req, res) => {
  const notification = notifications.find((entry) =>
    entry.id === req.params.id && (!entry.userId || entry.userId === req.user.id)
  );
  if (!notification) return res.status(404).json({ message: 'Notification not found.' });
  if (!notification.userId) {
    return res.status(403).json({ message: 'Shared announcements cannot be marked as read.' });
  }
  const updated = { ...notification, read: true };
  await persistRecord('notifications', updated);
  notifications[notifications.indexOf(notification)] = updated;
  return res.json({ notification: updated });
});

app.post('/api/notifications/resend-application-status', authenticate, async (req, res) => {
  const pendingNotifications = notifications.filter((entry) =>
    entry.userId === req.user.id &&
    ['Application status updated', 'Application approved', 'Application rejected', 'Recruitment application updated'].includes(entry.title) &&
    entry.emailDeliveryStatus !== 'sent'
  );
  if (pendingNotifications.length === 0) {
    return res.json({ sentCount: 0, failedCount: 0 });
  }
  if (process.env.BREVO_EMAIL_ENABLED !== 'true') {
    return res.status(503).json({ message: 'Email notifications are not enabled.' });
  }

  const recipient = users.find((user) => user.id === req.user.id);
  if (!recipient?.email) {
    return res.status(409).json({ message: 'No registered email address is available for this account.' });
  }

  let sentCount = 0;
  let failedCount = 0;
  for (const notification of pendingNotifications) {
    let sent = false;
    let deliveryError = '';
    try {
      await sendBrevoNotification({
        to: recipient.email,
        title: notification.title,
        message: notification.message,
      });
      sent = true;
    } catch (error) {
      deliveryError = getBrevoDeliveryErrorMessage(error);
      console.error(`Email notification ${notification.id} failed (${error.code || error.name || 'delivery error'}).`);
    }

    notification.emailDeliveryStatus = sent ? 'sent' : 'failed';
    if (sent) delete notification.emailDeliveryError;
    else notification.emailDeliveryError = deliveryError;
    try {
      await persistRecord('notifications', notification);
    } catch (error) {
      console.error(`Email notification status could not be saved for ${notification.id} (${error.code || error.name || 'database error'}).`);
      failedCount += 1;
      continue;
    }
    if (sent) sentCount += 1;
    else failedCount += 1;
  }

  return res.json({ sentCount, failedCount });
});

app.get('/api/admin/announcements', authenticate, requireRole('administrator'), (req, res) => {
  return res.json({
    announcements: notifications
      .filter((entry) => entry.isAnnouncement === true)
      .sort((left, right) => String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt))),
  });
});

function parseAnnouncement(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const audience = Array.isArray(body.audience) ? [...new Set(body.audience)] : [];
  const allowedAudiences = [...learningRoles, '*'];
  const status = body.status || 'draft';
  const startsAt = body.startsAt === undefined || body.startsAt === null ? '' : body.startsAt;
  const endsAt = body.endsAt === undefined || body.endsAt === null ? '' : body.endsAt;
  if (!title || title.length > 120 || !message || message.length > 2000 ||
      audience.length === 0 || audience.some((role) => !allowedAudiences.includes(role)) ||
      !['draft', 'published', 'archived'].includes(status) ||
      typeof startsAt !== 'string' || typeof endsAt !== 'string') {
    return { error: 'Provide a title, message, one or more valid audiences, and a valid status.' };
  }
  for (const [field, value] of [['start date', startsAt], ['end date', endsAt]]) {
    if (value && !Number.isFinite(Date.parse(value))) return { error: `Provide a valid announcement ${field}.` };
  }
  if (startsAt && endsAt && Date.parse(endsAt) < Date.parse(startsAt)) {
    return { error: 'The announcement end date cannot be earlier than its start date.' };
  }
  return { value: { title, message, audience, status, startsAt: startsAt || null, endsAt: endsAt || null } };
}

app.post('/api/admin/announcements', authenticate, requireRole('administrator'), async (req, res) => {
  const parsed = parseAnnouncement(req.body || {});
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  const now = new Date().toISOString();
  const announcement = {
    id: `announcement-${randomUUID()}`,
    ...parsed.value,
    isAnnouncement: true,
    createdAt: now,
    updatedAt: now,
    createdBy: req.user.email,
    read: false,
  };
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `${announcement.status === 'published' ? 'Published' : 'Created'} announcement ${announcement.id}`,
    timestamp: now,
  };
  await persistRecord('notifications', announcement);
  await persistRecord('auditLogs', auditEntry);
  notifications.push(announcement);
  auditLogs.push(auditEntry);
  await dispatchAnnouncementEmails(announcement);
  return res.status(201).json({ announcement });
});

app.patch('/api/admin/announcements/:id', authenticate, requireRole('administrator'), async (req, res) => {
  const announcement = notifications.find((entry) => entry.id === req.params.id && entry.isAnnouncement === true);
  if (!announcement) return res.status(404).json({ message: 'Announcement not found.' });
  const parsed = parseAnnouncement(req.body || {});
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  const now = new Date().toISOString();
  const updated = { ...announcement, ...parsed.value, updatedAt: now, updatedBy: req.user.email };
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `${updated.status === 'published' ? 'Updated' : updated.status === 'archived' ? 'Archived' : 'Saved'} announcement ${updated.id}`,
    timestamp: now,
  };
  await persistRecord('notifications', updated);
  await persistRecord('auditLogs', auditEntry);
  notifications[notifications.indexOf(announcement)] = updated;
  auditLogs.push(auditEntry);
  await dispatchAnnouncementEmails(updated);
  return res.json({ announcement: updated });
});

app.get('/api/applications', authenticate, (req, res) => {
  const userApplications = applications.filter((entry) => entry.applicantId === req.user.id);
  return res.json({
    applications: userApplications.map((entry) => getApplicationResponse({
      ...entry,
      reference: entry.reference || `AGR-${new Date(entry.submittedAt).getFullYear()}-${entry.id}`,
      updatedAt: entry.updatedAt || entry.submittedAt,
      outstandingRequirements: entry.outstandingRequirements || [],
      statusHistory: entry.statusHistory || [{ status: entry.status, date: entry.submittedAt }],
      opportunityTitle: entry.opportunityId
        ? opportunities.find((opportunity) => opportunity.id === entry.opportunityId)?.title
        : undefined,
    })),
  });
});

app.get('/api/employer/applications', authenticate, async (req, res) => {
  if (req.activeRole !== 'employer') {
    return res.status(403).json({ message: 'Only employer accounts can review job applicants.' });
  }
  const ownedOpportunities = new Map(
    opportunities
      .filter((entry) => entry.ownerUserId === req.user.id &&
        ['Employment', 'Internship', 'Workplace Opportunity', 'Training Need'].includes(entry.category))
      .map((entry) => [entry.id, entry])
  );
  const candidateApplications = applications
    .filter((entry) => entry.opportunityId && ownedOpportunities.has(entry.opportunityId) &&
      !['Draft', 'Withdrawn'].includes(entry.status))
    .map((entry) => {
      const opportunity = ownedOpportunities.get(entry.opportunityId);
      return {
        id: entry.id,
        reference: entry.reference || entry.id,
        opportunityId: entry.opportunityId,
        opportunityTitle: opportunity.title,
        applicationData: entry.applicationData || {},
        status: entry.status,
        submittedAt: entry.submittedAt,
        updatedAt: entry.updatedAt || entry.submittedAt,
        feedback: entry.feedback || '',
        documents: (entry.documents || []).map(({ data, ...metadata }) => metadata),
      };
    });
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `Viewed ${candidateApplications.length} candidate application(s) for owned opportunities`,
    timestamp: new Date().toISOString(),
  };
  await persistRecord('auditLogs', auditEntry);
  auditLogs.push(auditEntry);
  return res.json({ applications: candidateApplications });
});

app.get('/api/employer/candidates', authenticate, async (req, res) => {
  if (req.activeRole !== 'employer') {
    return res.status(403).json({ message: 'Only employer accounts can search opted-in candidates.' });
  }
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100).toLowerCase() : '';
  const province = typeof req.query.province === 'string' ? req.query.province.trim().slice(0, 60).toLowerCase() : '';
  const candidates = users
    .filter((user) => user.status === 'active' &&
      ['learner', 'farmer'].includes(user.activeRole) &&
      user.candidateProfile?.visible === true &&
      Boolean(user.candidateProfile.publicId))
    .map((user) => {
      const profile = user.candidateProfile;
      const skills = learning.passportSkills
        .filter((skill) => skill.userId === user.id)
        .map((skill) => ({
          name: skill.name,
          category: skill.category,
          level: skill.level,
          verificationStatus: 'Self-reported · not verified',
        }));
      return {
        id: profile.publicId,
        firstName: user.firstName,
        desiredRole: profile.desiredRole,
        province: profile.province,
        summary: profile.summary,
        skills,
      };
    })
    .filter((candidate) => {
      const searchable = `${candidate.firstName} ${candidate.desiredRole} ${candidate.province} ${candidate.summary} ${candidate.skills.map((skill) => `${skill.name} ${skill.category}`).join(' ')}`.toLowerCase();
      return (!query || searchable.includes(query)) &&
        (!province || candidate.province.toLowerCase().includes(province));
    })
    .slice(0, 50);
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `Searched opted-in candidate profiles; returned ${candidates.length} result(s)`,
    timestamp: new Date().toISOString(),
  };
  await persistRecord('auditLogs', auditEntry);
  auditLogs.push(auditEntry);
  return res.json({ candidates });
});

app.post('/api/employer/candidates/:candidateId/invitations', authenticate, async (req, res) => {
  if (req.activeRole !== 'employer') {
    return res.status(403).json({ message: 'Only employer accounts can invite candidates to apply.' });
  }
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const opportunity = opportunities.find((entry) =>
    entry.id === body.opportunityId &&
    entry.ownerUserId === req.user.id &&
    ['Employment', 'Internship', 'Workplace Opportunity'].includes(entry.category) &&
    entry.status === 'Published' &&
    getOpportunityStatus(entry) === 'Open'
  );
  const candidate = users.find((entry) =>
    entry.candidateProfile?.publicId === req.params.candidateId &&
    entry.status === 'active' &&
    ['learner', 'farmer'].includes(entry.activeRole) &&
    entry.candidateProfile?.visible === true
  );
  if (!opportunity || !candidate) {
    return res.status(404).json({ message: 'An open employer listing or opted-in candidate could not be found.' });
  }
  const existingInvitation = notifications.find((entry) =>
    entry.userId === candidate.id &&
    entry.type === 'employer_candidate_invitation' &&
    entry.employerId === req.user.id &&
    entry.opportunityId === opportunity.id
  );
  if (existingInvitation) {
    return res.status(409).json({ message: 'You have already invited this candidate to this listing.' });
  }
  const now = new Date().toISOString();
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `Invited an opted-in candidate to apply for ${opportunity.id}`,
    timestamp: now,
  };
  await persistRecord('auditLogs', auditEntry);
  auditLogs.push(auditEntry);
  await addUserNotification(
    candidate.id,
    'Invitation to apply',
    `${req.user.organization || 'An agricultural employer'} invited you to consider ${opportunity.title}. Review the listing in Opportunities and apply only if you choose to.`,
    {
      type: 'employer_candidate_invitation',
      employerId: req.user.id,
      opportunityId: opportunity.id,
      targetType: 'opportunity',
      targetId: opportunity.id,
    }
  );
  return res.status(201).json({ invited: true });
});

app.patch('/api/employer/applications/:id/status', authenticate, async (req, res) => {
  if (req.activeRole !== 'employer') {
    return res.status(403).json({ message: 'Only employer accounts can manage candidate applications.' });
  }
  const application = applications.find((entry) => entry.id === req.params.id);
  const opportunity = application?.opportunityId
    ? opportunities.find((entry) => entry.id === application.opportunityId)
    : null;
  if (!application || !opportunity || opportunity.ownerUserId !== req.user.id ||
      !['Employment', 'Internship', 'Workplace Opportunity', 'Training Need'].includes(opportunity.category)) {
    return res.status(404).json({ message: 'Candidate application not found.' });
  }
  const { status, feedback = '' } = req.body || {};
  const allowedStatuses = ['Under Review', 'Shortlisted', 'Interview', 'Hired', 'Unsuccessful', 'Rejected'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Choose a valid recruitment status.' });
  }
  if (typeof feedback !== 'string' || feedback.trim().length > 500) {
    return res.status(400).json({ message: 'Candidate feedback must be text of 500 characters or fewer.' });
  }
  if (!['Submitted', 'Under Review', 'Shortlisted', 'Interview'].includes(application.status)) {
    return res.status(409).json({ message: 'This application is no longer active in recruitment.' });
  }
  const now = new Date().toISOString();
  const updatedApplication = {
    ...application,
    status,
    updatedAt: now,
    feedback: feedback.trim(),
    statusHistory: [...(application.statusHistory || []), {
      status,
      date: now,
      ...(feedback.trim() ? { feedback: feedback.trim() } : {}),
    }],
  };
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `Updated recruitment application ${application.reference || application.id} to ${status}`,
    timestamp: now,
  };
  await persistRecord('applications', updatedApplication);
  await persistRecord('auditLogs', auditEntry);
  Object.assign(application, updatedApplication);
  auditLogs.push(auditEntry);
  await addUserNotification(
    application.applicantId,
    'Recruitment application updated',
    `Your application for ${opportunity.title} is now ${status}.${feedback.trim() ? ` ${feedback.trim()}` : ''}`,
    { targetType: 'application', targetId: application.id }
  );
  return res.json({ application: getApplicationResponse(updatedApplication) });
});

app.get('/api/applications/:id/documents/:documentId', authenticate, async (req, res) => {
  const application = applications.find((entry) => entry.id === req.params.id);
  if (!application) return res.status(404).json({ message: 'Application not found.' });
  const canReview = ['administrator', 'internal_staff'].includes(req.activeRole);
  const opportunity = application.opportunityId
    ? opportunities.find((entry) => entry.id === application.opportunityId)
    : null;
  const isOwnerEmployer = req.activeRole === 'employer' &&
    opportunity?.ownerUserId === req.user.id &&
    ['Employment', 'Internship', 'Workplace Opportunity', 'Training Need'].includes(opportunity.category);
  if (application.applicantId !== req.user.id && !canReview && !isOwnerEmployer) {
    return res.status(404).json({ message: 'Application document not found.' });
  }
  const document = (application.documents || []).find((entry) => entry.id === req.params.documentId);
  if (!document) return res.status(404).json({ message: 'Application document not found.' });
  if ((canReview || isOwnerEmployer) && application.applicantId !== req.user.id) {
    const auditEntry = {
      id: `audit-${randomUUID()}`,
      user: req.user.email,
      action: `Viewed application document for ${application.reference}`,
      timestamp: new Date().toISOString(),
    };
    await persistRecord('auditLogs', auditEntry);
    auditLogs.push(auditEntry);
  }
  return res.json({ document: { ...document } });
});

app.post('/api/applications', authenticate, async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const { serviceId, opportunityId } = body;
  const initialStatus = body.draft === true ? 'Draft' : 'Submitted';
  const hasService = typeof serviceId === 'string' && serviceId.trim().length > 0;
  const hasOpportunity = typeof opportunityId === 'string' && opportunityId.trim().length > 0;
  if (hasService === hasOpportunity) {
    return res.status(400).json({ message: 'Select exactly one service or opportunity to apply for.' });
  }

  let applicationTarget;
  if (hasOpportunity) {
    applicationTarget = opportunities.find((entry) => entry.id === opportunityId);
    if (!applicationTarget || applicationTarget.status !== 'Published') {
      return res.status(404).json({ message: 'Opportunity not found.' });
    }
    if (getOpportunityStatus(applicationTarget) !== 'Open' || !canPublishOpportunity(applicationTarget)) {
      return res.status(409).json({ message: 'This opportunity is no longer open.' });
    }
    if (applicationTarget.role !== req.activeRole && applicationTarget.role !== '*') {
      return res.status(403).json({ message: 'This opportunity is not available for your role.' });
    }
    if (applications.some((entry) => entry.applicantId === req.user.id && entry.opportunityId === opportunityId && entry.status !== 'Withdrawn')) {
      return res.status(409).json({ message: 'You have already applied for this opportunity.' });
    }
  } else {
    applicationTarget = services.find((entry) => entry.id === serviceId);
    if (!applicationTarget) {
      return res.status(404).json({ message: 'Service not found.' });
    }
    if (applicationTarget.status !== 'open') {
      return res.status(409).json({ message: 'Applications are not open for this service.' });
    }
    if (!applicationTarget.eligibility.includes(req.activeRole)) {
      return res.status(403).json({ message: 'This service is not available for your role.' });
    }
    if (applications.some((entry) => entry.applicantId === req.user.id && entry.serviceId === serviceId && entry.status !== 'Withdrawn')) {
      return res.status(409).json({ message: 'You have already applied for this service.' });
    }
  }

  const applicationData = getApplicationData(body.applicationData, req.user);
  if (applicationData.error) return res.status(400).json({ message: applicationData.error });
  const documentResult = getApplicationDocuments(body.documents || [], applicationTarget.requiredDocuments || []);
  if (documentResult.error) return res.status(400).json({ message: documentResult.error });
  if (req.activeRole === 'training_provider') {
    applicationData.value.organization = req.user.organization || '';
    const verification = req.user.roleVerificationDetails || {};
    applicationData.value.accreditation = [
      verification.registrationBody,
      verification.providerReference,
    ].filter((value) => typeof value === 'string' && value.trim()).join(' · ');
  }

  const now = new Date().toISOString();
  const application = {
    id: `app-${randomUUID()}`,
    reference: `AGR-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
    applicantId: req.user.id,
    ...(hasOpportunity ? { opportunityId } : { serviceId }),
    serviceName: applicationTarget.title || applicationTarget.name,
    status: initialStatus,
    submittedAt: initialStatus === 'Submitted' ? now : null,
    updatedAt: now,
    outstandingRequirements: [],
    applicationData: applicationData.value,
    documents: documentResult.value,
    statusHistory: [{ status: initialStatus, date: now }],
  };

  await persistRecord('applications', application);
  applications.push(application);
  if (applicationTarget.ownerUserId &&
      ['employer', 'sdf', 'training_provider'].includes(applicationTarget.submittedByRole)) {
    await addUserNotification(
      applicationTarget.ownerUserId,
      'New opportunity application',
      `A new application was submitted for ${applicationTarget.title || applicationTarget.name}.`,
      { targetType: 'recruitment', targetId: applicationTarget.id }
    );
  }
  return res.status(201).json({ application: getApplicationResponse(application) });
});

app.patch('/api/applications/:id', authenticate, async (req, res) => {
  const application = applications.find((entry) => entry.id === req.params.id);
  if (!application || application.applicantId !== req.user.id) {
    return res.status(404).json({ message: 'Application not found.' });
  }

  const { action } = req.body || {};
  const updatedApplication = { ...application, statusHistory: [...(application.statusHistory || [])] };
  const now = new Date().toISOString();
  if (action === 'submit' && application.status === 'Draft') {
    if (application.opportunityId) {
      const opportunity = opportunities.find((entry) => entry.id === application.opportunityId);
      if (!opportunity || getOpportunityStatus(opportunity) !== 'Open' || !canPublishOpportunity(opportunity)) {
        return res.status(409).json({ message: 'This opportunity is no longer open.' });
      }
      if (opportunity.role !== req.activeRole && opportunity.role !== '*') {
        return res.status(403).json({ message: 'This opportunity is not available for your role.' });
      }
      if ((opportunity.requiredDocuments || []).some((requirement) =>
        !(application.documents || []).some((document) => document.requirement === requirement)
      )) {
        return res.status(400).json({ message: 'Upload every required document before submitting this application.' });
      }
    } else if (application.serviceId) {
      const service = services.find((entry) => entry.id === application.serviceId);
      if (!service || service.status !== 'open') {
        return res.status(409).json({ message: 'Applications are no longer open for this service.' });
      }
      if (!service.eligibility.includes(req.activeRole)) {
        return res.status(403).json({ message: 'This service is not available for your role.' });
      }
      if ((service.requiredDocuments || []).some((requirement) =>
        !(application.documents || []).some((document) => document.requirement === requirement)
      )) {
        return res.status(400).json({ message: 'Upload every required document before submitting this application.' });
      }
    }
    const checkedData = getApplicationData({
      ...(application.applicationData || {}),
      consent: true,
    }, req.user);
    if (checkedData.error) {
      return res.status(400).json({ message: 'Complete the application form before submitting.' });
    }
    updatedApplication.status = 'Submitted';
    updatedApplication.submittedAt = now;
  } else if (
    action === 'withdraw' &&
    ['Draft', 'Submitted', 'Under Review', 'Additional Information Required'].includes(application.status)
  ) {
    updatedApplication.status = 'Withdrawn';
  } else {
    return res.status(400).json({ message: 'This application action is not available for its current status.' });
  }

  updatedApplication.updatedAt = now;
  updatedApplication.statusHistory.push({ status: updatedApplication.status, date: now });
  await persistRecord('applications', updatedApplication);
  Object.assign(application, updatedApplication);
  return res.json({ application: getApplicationResponse(updatedApplication) });
});

app.patch('/api/admin/applications/:id/status', authenticate, (req, res, next) => {
  if (req.activeRole !== 'administrator' && req.activeRole !== 'internal_staff') {
    return res.status(403).json({ message: 'You are not permitted to update application statuses.' });
  }
  return next();
}, async (req, res) => {
  const application = applications.find((entry) => entry.id === req.params.id);
  if (!application) {
    return res.status(404).json({ message: 'Application not found.' });
  }

  const allowedStatuses = ['Under Review', 'Additional Information Required', 'Approved', 'Rejected', 'Unsuccessful'];
  const { status, outstandingRequirements = [], feedback = '' } = req.body || {};
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'A valid review status is required.' });
  }
  if (typeof feedback !== 'string' || feedback.trim().length > 500) {
    return res.status(400).json({ message: 'Feedback must be text of 500 characters or fewer.' });
  }
  if (
    !Array.isArray(outstandingRequirements) ||
    outstandingRequirements.length > 10 ||
    outstandingRequirements.some((item) => typeof item !== 'string' || !item.trim() || item.length > 300)
  ) {
    return res.status(400).json({ message: 'Outstanding requirements must be a list of text items.' });
  }
  if (status === 'Additional Information Required' && outstandingRequirements.length === 0) {
    return res.status(400).json({ message: 'List the additional information required.' });
  }
  if (!['Submitted', 'Under Review', 'Additional Information Required'].includes(application.status)) {
    return res.status(409).json({ message: 'This application is no longer available for review.' });
  }

  const now = new Date().toISOString();
  const updatedApplication = {
    ...application,
    status,
    updatedAt: now,
    outstandingRequirements,
    feedback: feedback.trim(),
    statusHistory: [...(application.statusHistory || []), {
      status,
      date: now,
      ...(feedback.trim() ? { feedback: feedback.trim() } : {}),
    }],
  };
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `Updated application ${application.reference || application.id} status to ${status}`,
    timestamp: now,
  };
  await persistRecord('applications', updatedApplication);
  await persistRecord('auditLogs', auditEntry);
  Object.assign(application, updatedApplication);
  auditLogs.push(auditEntry);
  const notificationTitle = status === 'Approved'
    ? 'Application approved'
    : ['Rejected', 'Unsuccessful'].includes(status)
      ? 'Application rejected'
      : 'Application status updated';
  await addUserNotification(
    application.applicantId,
    notificationTitle,
    `Your application ${application.reference || application.id} is now ${status}.${feedback.trim() ? ` ${feedback.trim()}` : ''}`,
    { targetType: 'application', targetId: application.id }
  );
  return res.json({ application: getApplicationResponse(updatedApplication) });
});

app.get('/api/users', authenticate, requireRole('administrator'), (req, res) => {
  return res.json({
    permissionsByRole: rolePermissions,
    users: users.map((user) => ({
      ...sanitizeUser(user, user.activeRole || user.roles[0]),
      roleVerificationStatus: user.roleVerificationStatus || null,
    })),
  });
});

app.get('/api/admin/role-requests', authenticate, requireRole('administrator'), (req, res) => {
  const requests = users
    .filter((user) => user.roleVerificationStatus === 'pending')
    .map((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.roles[0],
      submittedAt: user.roleVerificationSubmittedAt,
      verificationDetails: user.roleVerificationDetails,
    }));
  return res.json({ requests });
});

app.patch('/api/admin/role-requests/:id', authenticate, requireRole('administrator'), async (req, res) => {
  const { decision, note } = req.body || {};
  const user = users.find((entry) => entry.id === req.params.id);
  if (!user || user.roleVerificationStatus !== 'pending') {
    return res.status(404).json({ message: 'Pending role request not found.' });
  }
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ message: 'Decision must be approved or rejected.' });
  }
  if (note !== undefined && (typeof note !== 'string' || note.trim().length > 500)) {
    return res.status(400).json({ message: 'Review note must be 500 characters or fewer.' });
  }
  if (decision === 'rejected' && (!note || !note.trim())) {
    return res.status(400).json({ message: 'Provide a reason when rejecting a role request.' });
  }

  const now = new Date().toISOString();
  const updatedUser = {
    ...user,
    status: decision === 'approved' ? 'active' : 'inactive',
    roleVerificationStatus: decision,
    roleVerificationDetails: null,
    ...(decision === 'approved' && user.roles.includes('sdf') ? {
      sdfOrganizationId: `sdf-org-${createHash('sha256')
        .update(`${user.roleVerificationDetails.organization.trim().toLowerCase()}|${user.roleVerificationDetails.workEmail.split('@').pop().toLowerCase()}`)
        .digest('hex')}`,
    } : {}),
    roleVerificationReviewedAt: now,
    roleVerificationReviewedBy: req.user.email,
    roleVerificationNote: typeof note === 'string' ? note.trim() : '',
  };
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `${decision === 'approved' ? 'Approved' : 'Rejected'} ${user.roles[0]} role verification for ${user.email}`,
    timestamp: now,
  };
  if (decision === 'approved' && user.roles.includes('training_provider')) {
    const verification = user.roleVerificationDetails || {};
    const existingProvider = learning.providers.find((entry) => entry.ownerUserId === user.id);
    const provider = {
      ...(existingProvider || {}),
      id: existingProvider?.id || `provider-${randomUUID()}`,
      ownerUserId: user.id,
      name: verification.organization || user.organization || `${user.firstName} ${user.lastName}`,
      location: 'South Africa',
      description: 'Complete this profile and submit it for administrator review.',
      contact: null,
      registrationBody: verification.registrationBody || '',
      providerReference: verification.providerReference || '',
      verificationStatus: 'Registration details submitted; profile review pending',
      dataStatus: 'Provider profile pending administrator review. Registration, accreditation, and programme availability are not verified.',
      status: 'pending_review',
      profileCompletionSubmitted: false,
    };
    await persistRecord('trainingProviders', provider);
    if (existingProvider) {
      learning.providers[learning.providers.indexOf(existingProvider)] = provider;
    } else {
      learning.providers.push(provider);
    }
  }
  await persistRecord('users', updatedUser);
  await persistRecord('auditLogs', auditEntry);
  Object.assign(user, updatedUser);
  auditLogs.push(auditEntry);
  return res.json({
    user: sanitizeUser(updatedUser, updatedUser.activeRole),
    roleVerificationStatus: decision,
  });
});

app.post('/api/users', authenticate, requireRole('administrator'), async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const { firstName, lastName, email, username, password, roles, status } = body;

  if (![firstName, lastName, email, username, password].every((value) => typeof value === 'string' && value.trim())) {
    return res.status(400).json({ message: 'All required user fields must be provided.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim().toLowerCase();
  if (firstName.trim().length > 80 || lastName.trim().length > 80) {
    return res.status(400).json({ message: 'Names must be 80 characters or fewer.' });
  }
  const allowedRoles = learningRoles;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'A valid email address is required.' });
  }
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username.trim())) {
    return res.status(400).json({ message: 'Username must be 3 to 30 letters, numbers, dots, underscores or hyphens.' });
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.' });
  }
  if (body.organization !== undefined &&
      (typeof body.organization !== 'string' || body.organization.trim().length > 160)) {
    return res.status(400).json({ message: 'Organisation must be 160 characters or fewer.' });
  }
  let phone = '';
  if (body.phone !== undefined && body.phone !== null && body.phone !== '') {
    phone = normalizeSouthAfricanPhone(body.phone);
    if (!phone) return res.status(400).json({ message: 'Enter a valid South African phone number.' });
  }
  if (!Array.isArray(roles) || roles.length === 0 || roles.some((role) => !allowedRoles.includes(role))) {
    return res.status(400).json({ message: 'Assign one or more supported platform roles.' });
  }
  if (new Set(roles).size !== roles.length) {
    return res.status(400).json({ message: 'Roles must not contain duplicates.' });
  }
  const activeRole = body.activeRole || roles[0];
  if (!roles.includes(activeRole)) {
    return res.status(400).json({ message: 'The active role must be one of the assigned roles.' });
  }
  if (status !== undefined && !['active', 'inactive'].includes(status)) {
    return res.status(400).json({ message: 'Account status must be active or inactive.' });
  }

  const existingUser = users.find(
    (entry) =>
      entry.email.toLowerCase() === normalizedEmail ||
      entry.username.toLowerCase() === normalizedUsername ||
      (phone !== '' && entry.phone === phone)
  );

  if (existingUser) {
    return res.status(409).json({ message: 'A user with this email or username already exists.' });
  }

  const hashedPassword = await bcrypt.hash(String(password), 10);

  const newUser = {
    id: `usr-${Date.now()}-${users.length}`,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    email: normalizedEmail,
    username: String(username).trim(),
    passwordHash: hashedPassword,
    roles: [...roles],
    activeRole,
    status: status === 'inactive' ? 'inactive' : 'active',
    phone,
    organization: typeof body.organization === 'string' && body.organization.trim()
      ? body.organization.trim()
      : 'Newly created account',
    roleVerificationStatus: 'approved',
    roleVerificationReviewedAt: new Date().toISOString(),
    roleVerificationReviewedBy: req.user.email,
    roleVerificationDetails: null,
  };
  if (roles.includes('sdf')) {
    const domain = normalizedEmail.split('@').pop();
    newUser.sdfOrganizationId = `sdf-org-${createHash('sha256')
      .update(`${newUser.organization.toLowerCase()}|${domain}`)
      .digest('hex')}`;
  }

  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `Created ${newUser.roles.join(', ')} account for ${newUser.email}`,
    timestamp: new Date().toISOString(),
  };
  await persistRecord('users', newUser);
  await persistRecord('auditLogs', auditEntry);
  if (roles.includes('training_provider')) {
    const provider = {
      id: `provider-${randomUUID()}`,
      ownerUserId: newUser.id,
      name: newUser.organization,
      location: 'South Africa',
      description: 'Complete this profile and submit it for administrator review.',
      contact: null,
      registrationBody: '',
      providerReference: '',
      verificationStatus: 'Administrator-provisioned account; provider details not verified',
      dataStatus: 'Provider profile pending completion and administrator review. Registration, accreditation, and programme availability are not verified.',
      status: 'pending_review',
      profileCompletionSubmitted: false,
    };
    await persistRecord('trainingProviders', provider);
    learning.providers.push(provider);
  }
  users.push(newUser);
  auditLogs.push(auditEntry);
  return res.status(201).json({ user: sanitizeUser(newUser, newUser.activeRole) });
});

app.patch('/api/users/:id', authenticate, requireRole('administrator'), async (req, res) => {
  const user = users.find((entry) => entry.id === req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const allowedFields = new Set(['firstName', 'lastName', 'email', 'username', 'phone', 'organization', 'roles', 'activeRole', 'password']);
  if (Object.keys(body).length === 0 || Object.keys(body).some((field) => !allowedFields.has(field))) {
    return res.status(400).json({ message: 'Update only account details, assigned roles, or password.' });
  }
  const updatedUser = { ...user };
  for (const [field, maximum] of [['firstName', 80], ['lastName', 80], ['username', 30], ['organization', 160]]) {
    if (!Object.hasOwn(body, field)) continue;
    if (typeof body[field] !== 'string' || !body[field].trim() || body[field].trim().length > maximum) {
      return res.status(400).json({ message: `${field} is required and must be ${maximum} characters or fewer.` });
    }
    if (field === 'username' && !/^[a-zA-Z0-9._-]{3,30}$/.test(body.username.trim())) {
      return res.status(400).json({ message: 'Username must be 3 to 30 letters, numbers, dots, underscores or hyphens.' });
    }
    updatedUser[field] = body[field].trim();
  }
  if (Object.hasOwn(body, 'email')) {
    if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      return res.status(400).json({ message: 'Provide a valid email address.' });
    }
    updatedUser.email = body.email.trim().toLowerCase();
  }
  if (Object.hasOwn(body, 'phone')) {
    if (typeof body.phone !== 'string') return res.status(400).json({ message: 'Phone number must be text.' });
    const phone = body.phone.trim() ? normalizeSouthAfricanPhone(body.phone) : '';
    if (phone === null) return res.status(400).json({ message: 'Enter a valid South African phone number or leave it blank.' });
    updatedUser.phone = phone;
  }
  if (Object.hasOwn(body, 'roles')) {
    if (!Array.isArray(body.roles) || body.roles.length === 0 ||
        body.roles.some((role) => !learningRoles.includes(role)) ||
        new Set(body.roles).size !== body.roles.length) {
      return res.status(400).json({ message: 'Assign one or more unique supported platform roles.' });
    }
    const newlyGrantedRoles = body.roles.filter((role) => !user.roles.includes(role));
    if (newlyGrantedRoles.some((role) => !['administrator', 'internal_staff'].includes(role)) &&
        user.roleVerificationStatus !== 'approved') {
      return res.status(409).json({ message: 'Approve the account role-verification request before assigning stakeholder roles.' });
    }
    if (body.activeRole !== undefined && !body.roles.includes(body.activeRole)) {
      return res.status(400).json({ message: 'The active role must be one of the assigned roles.' });
    }
    if (user.status === 'active' && user.roles.includes('administrator') && !body.roles.includes('administrator') &&
        users.filter((entry) => entry.status === 'active' && entry.roles.includes('administrator')).length <= 1) {
      return res.status(409).json({ message: 'The last active administrator cannot be unassigned.' });
    }
    if (req.user.id === user.id && !body.roles.includes('administrator')) {
      return res.status(409).json({ message: 'You cannot remove your own administrator role.' });
    }
    updatedUser.roles = [...body.roles];
    updatedUser.activeRole = body.activeRole
      ? body.activeRole
      : body.roles.includes(user.activeRole) ? user.activeRole : body.roles[0];
  } else if (Object.hasOwn(body, 'activeRole')) {
    if (!user.roles.includes(body.activeRole)) {
      return res.status(400).json({ message: 'The active role must be one of the assigned roles.' });
    }
    if (req.user.id === user.id && body.activeRole !== 'administrator') {
      return res.status(409).json({ message: 'You cannot change your own active administrator role.' });
    }
    updatedUser.activeRole = body.activeRole;
  }
  if (Object.hasOwn(body, 'password')) {
    if (typeof body.password !== 'string' || body.password.length < 8 || Buffer.byteLength(body.password, 'utf8') > 72) {
      return res.status(400).json({ message: 'Password must be at least 8 characters and no more than 72 UTF-8 bytes.' });
    }
    updatedUser.passwordHash = await bcrypt.hash(body.password, 10);
    updatedUser.tokenVersion = (user.tokenVersion || 0) + 1;
  }
  const duplicate = users.find((entry) =>
    entry.id !== user.id &&
    (entry.email.toLowerCase() === updatedUser.email.toLowerCase() ||
      entry.username.toLowerCase() === updatedUser.username.toLowerCase() ||
      (updatedUser.phone && entry.phone === updatedUser.phone))
  );
  if (duplicate) return res.status(409).json({ message: 'Email, username, or phone number is already in use.' });
  if (updatedUser.roles.includes('sdf') &&
      (!updatedUser.sdfOrganizationId || Object.hasOwn(body, 'organization') || Object.hasOwn(body, 'email'))) {
    const organization = updatedUser.organization;
    const domain = updatedUser.email.split('@').pop();
    updatedUser.sdfOrganizationId = `sdf-org-${createHash('sha256')
      .update(`${organization.trim().toLowerCase()}|${domain.toLowerCase()}`)
      .digest('hex')}`;
  }
  if (updatedUser.roles.includes('training_provider') &&
      !learning.providers.some((entry) => entry.ownerUserId === updatedUser.id)) {
    const provider = {
      id: `provider-${randomUUID()}`,
      ownerUserId: updatedUser.id,
      name: updatedUser.organization,
      location: 'South Africa',
      description: 'Complete this profile and submit it for administrator review.',
      contact: null,
      registrationBody: '',
      providerReference: '',
      verificationStatus: 'Administrator-assigned role; provider details not verified',
      dataStatus: 'Provider profile pending completion and administrator review. Registration, accreditation, and programme availability are not verified.',
      status: 'pending_review',
      profileCompletionSubmitted: false,
    };
    await persistRecord('trainingProviders', provider);
    learning.providers.push(provider);
  }
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `Updated account fields (${Object.keys(body).join(', ')}) for ${user.id}`,
    timestamp: new Date().toISOString(),
  };
  await persistRecord('users', updatedUser);
  await persistRecord('auditLogs', auditEntry);
  Object.assign(user, updatedUser);
  auditLogs.push(auditEntry);
  return res.json({ user: sanitizeUser(updatedUser, updatedUser.activeRole) });
});

app.patch('/api/users/:id/status', authenticate, requireRole('administrator'), async (req, res) => {
  const { status } = req.body || {};
  const user = users.find((entry) => entry.id === req.params.id);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ message: 'Account status must be active or inactive.' });
  }
  if (status === 'active' && ['pending', 'rejected'].includes(user.roleVerificationStatus)) {
    return res.status(409).json({ message: 'A role-verification request must be approved before this account can be activated.' });
  }

  if (status === 'inactive' && user.id === req.user.id) {
    return res.status(409).json({ message: 'You cannot deactivate your own administrator account.' });
  }
  if (status === 'inactive' && user.roles.includes('administrator') && user.status === 'active') {
    const activeAdministrators = users.filter(
      (entry) => entry.status === 'active' && entry.roles.includes('administrator')
    );
    if (activeAdministrators.length <= 1) {
      return res.status(409).json({ message: 'The last active administrator cannot be deactivated.' });
    }
  }

  const updatedUser = { ...user, status };
  const auditEntry = {
    id: `audit-${randomUUID()}`,
    user: req.user.email,
    action: `${status === 'active' ? 'Activated' : 'Deactivated'} account ${user.email}`,
    timestamp: new Date().toISOString(),
  };
  await persistRecord('users', updatedUser);
  await persistRecord('auditLogs', auditEntry);
  Object.assign(user, updatedUser);
  auditLogs.push(auditEntry);
  return res.json({ user: sanitizeUser(updatedUser, updatedUser.activeRole || updatedUser.roles[0]) });
});

app.get('/api/admin/reports', authenticate, requireRole('administrator'), (req, res) => {
  const { from, to } = req.query;
  const validDate = (value) => typeof value === 'string' && isValidIsoDate(value);
  if ((from && !validDate(from)) || (to && !validDate(to))) {
    return res.status(400).json({ message: 'Report dates must use YYYY-MM-DD format.' });
  }
  if (from && to && from > to) {
    return res.status(400).json({ message: 'Report start date must not be after the end date.' });
  }
  const start = from ? Date.parse(`${from}T00:00:00Z`) : 0;
  const end = to ? Date.parse(`${to}T23:59:59.999Z`) : Date.now();
  const withinRange = (value) => {
    const timestamp = Date.parse(value || '');
    return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end;
  };
  const rangeApplications = applications.filter((entry) => withinRange(entry.submittedAt));
  const rangeOpportunities = opportunities.filter((entry) => withinRange(entry.submittedAt || entry.createdAt));
  const rangeAudit = auditLogs.filter((entry) => withinRange(entry.timestamp));
  const countBy = (records, field) => records.reduce((counts, record) => {
    const key = String(record[field] || 'Unknown');
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const countAuditActions = (records) => records.reduce((counts, record) => {
    const action = String(record.action || '').toLowerCase();
    const category = action.includes('account') ? 'Account management'
      : action.includes('announcement') ? 'Announcements'
        : action.includes('opportunity') ? 'Opportunities'
          : action.includes('application') || action.includes('candidate') ? 'Applications and recruitment'
            : action.includes('provider') ? 'Training providers'
              : action.includes('farmer market') || action.includes('farmer mentor') ? 'Farmer information'
                : action.includes('sdf') ? 'SDF records'
                  : action.includes('service') || action.includes('course') ? 'Services and learning'
                    : 'Other activity';
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});
  return res.json({
    generatedAt: new Date().toISOString(),
    period: { from: from || null, to: to || null },
    accounts: {
      total: users.length,
      active: users.filter((entry) => entry.status === 'active').length,
      inactive: users.filter((entry) => entry.status !== 'active').length,
      byRole: Object.fromEntries(learningRoles.map((role) => [
        role,
        users.filter((entry) => entry.roles.includes(role)).length,
      ])),
    },
    opportunities: {
      submittedInPeriod: rangeOpportunities.length,
      byStatus: countBy(rangeOpportunities, 'status'),
      byCategory: countBy(rangeOpportunities, 'category'),
      publishedTotal: opportunities.filter((entry) => entry.status === 'Published' && getOpportunityStatus(entry) === 'Open').length,
    },
    applications: {
      submittedInPeriod: rangeApplications.length,
      byStatus: countBy(rangeApplications, 'status'),
    },
    administrativeActivity: {
      eventsInPeriod: rangeAudit.length,
      byAction: countAuditActions(rangeAudit),
    },
    privacyNote: 'Aggregate counts only; no applicant or account personal details are included.',
  });
});

app.get('/api/admin/audit', authenticate, requireRole('administrator'), (req, res) => {
  const { from, to, limit = '200' } = req.query;
  if ((from && (typeof from !== 'string' || !isValidIsoDate(from))) ||
      (to && (typeof to !== 'string' || !isValidIsoDate(to)))) {
    return res.status(400).json({ message: 'Audit dates must use YYYY-MM-DD format.' });
  }
  if (from && to && from > to) return res.status(400).json({ message: 'Audit start date must not be after the end date.' });
  const parsedLimit = Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) {
    return res.status(400).json({ message: 'Audit limit must be a whole number from 1 to 500.' });
  }
  const start = from ? Date.parse(`${from}T00:00:00Z`) : 0;
  const end = to ? Date.parse(`${to}T23:59:59.999Z`) : Date.now();
  const entries = auditLogs
    .filter((entry) => {
      const timestamp = Date.parse(entry.timestamp || '');
      return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end;
    })
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, parsedLimit);
  return res.json({ entries });
});

app.get('/api/staff/review-queue', authenticate, (req, res) => {
  if (req.activeRole !== 'internal_staff' && req.activeRole !== 'administrator') {
    return res.status(403).json({ message: 'You are not permitted to access the application review queue.' });
  }
  return res.json({
    applications: applications.map((application) => ({
      id: application.id,
      reference: application.reference || application.id,
      opportunityId: application.opportunityId,
      serviceName: application.serviceName,
      status: application.status,
      submittedAt: application.submittedAt,
      outstandingRequirements: application.outstandingRequirements || [],
      feedback: application.feedback || '',
      applicationData: application.applicationData ? {
        fullName: application.applicationData.fullName,
        email: application.applicationData.email,
        phone: application.applicationData.phone,
        motivation: application.applicationData.motivation,
        organization: application.applicationData.organization,
        accreditation: application.applicationData.accreditation,
      } : undefined,
      documents: (application.documents || []).map(({ data, ...metadata }) => metadata),
      applicant: (() => {
        const applicant = users.find((user) => user.id === application.applicantId);
        return applicant ? { name: `${applicant.firstName} ${applicant.lastName}`, email: applicant.email } : null;
      })(),
    })),
  });
});

app.post('/api/auth/logout', authenticate, (req, res) => {
  revokedTokens.add(req.token);
  return res.json({ message: 'Logged out successfully.' });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error(`API request failed (${error.name || 'Error'}).`);
  return res.status(500).json({ message: 'The request could not be completed.' });
});

if (require.main === module) {
  const start = async () => {
    if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
      throw new Error('Production requires a JWT_SECRET of at least 32 characters.');
    }
    assertBrevoConfiguration();

    const databaseConnected = await connectAndLoad({
      users,
      services,
      learningCategories: learning.categories,
      trainingProviders: learning.providers,
      learningCourses: learning.courses,
      learningProgrammes: learning.programmes,
      learningResources: learning.resources,
      farmerMarketRecords: learning.farmerMarketRecords,
      farmerMentors: learning.farmerMentors,
      farmerMentorRequests: learning.farmerMentorRequests,
      enrollments: learning.enrollments,
      resourceProgress: learning.resourceProgress,
      savedCourses: learning.savedCourses,
      courseProgress: learning.courseProgress,
      moduleProgress: learning.moduleProgress,
      certificates: learning.certificates,
      passportSkills: learning.passportSkills,
      opportunities,
      savedOpportunities,
      notifications,
      applications,
      auditLogs,
      sdfWorkforceRecords,
    });

    for (const announcement of notifications.filter((entry) =>
      entry.isAnnouncement === true &&
      entry.status === 'published' &&
      entry.emailDelivery?.status === 'scheduled'
    )) {
      await dispatchAnnouncementEmails(announcement);
    }

    app.listen(PORT, () => {
      console.log(`MyAgriSETA backend running on http://localhost:${PORT}`);
      if (!databaseConnected) throw new Error('Neon PostgreSQL persistence is required.');
      console.log('Neon PostgreSQL persistence is enabled.');
    });
  };

  start().catch((error) => {
    console.error(`MyAgriSETA backend startup failed (${error.name || 'Error'}).`);
    process.exitCode = 1;
  });
}

module.exports = app;
