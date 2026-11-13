const categories = [
  { id: 'crop-plant', name: 'Crop and Plant Production', icon: 'leaf-outline', description: 'Crop planning, planting, and production basics.' },
  { id: 'animal', name: 'Animal Production', icon: 'paw-outline', description: 'Livestock and poultry production topics.' },
  { id: 'agribusiness', name: 'Agribusiness', icon: 'briefcase-outline', description: 'Business skills for agricultural enterprises.' },
  { id: 'agri-tech', name: 'Agricultural Technology', icon: 'hardware-chip-outline', description: 'Digital tools and technology in agriculture.' },
  { id: 'natural-resources', name: 'Natural Resource Management', icon: 'water-outline', description: 'Soil, water, and sustainable resource topics.' },
  { id: 'farm-management', name: 'Farm Management', icon: 'clipboard-outline', description: 'Planning and managing a farm operation.' },
  { id: 'mechanisation', name: 'Agricultural Mechanisation', icon: 'construct-outline', description: 'Farm equipment awareness and safe use.' },
  { id: 'food-safety', name: 'Food Safety and Processing', icon: 'shield-checkmark-outline', description: 'Food handling, safety, and processing basics.' },
];

const providers = [
  {
    id: 'provider-greenfields',
    ownerUserId: 'usr-provider',
    name: 'GreenFields Training Centre',
    location: 'South Africa (demonstration listing)',
    description: 'Synthetic directory record for demonstrating provider discovery.',
    contact: null,
    verificationStatus: 'Unverified demonstration listing',
    dataStatus: 'Synthetic example. Provider identity, contact details, accreditation, and programmes are not verified.',
    status: 'published',
  },
  {
    id: 'provider-rural-skills',
    ownerUserId: null,
    name: 'Rural Skills Learning Hub',
    location: 'South Africa (demonstration listing)',
    description: 'Synthetic directory record for demonstrating provider discovery.',
    contact: null,
    verificationStatus: 'Unverified demonstration listing',
    dataStatus: 'Synthetic example. This is not a verified training provider.',
    status: 'published',
  },
  {
    id: 'provider-agri-practice',
    ownerUserId: null,
    name: 'Agri Practice Studio',
    location: 'South Africa (demonstration listing)',
    description: 'Synthetic directory record for demonstrating provider discovery.',
    contact: null,
    verificationStatus: 'Unverified demonstration listing',
    dataStatus: 'Synthetic example. This is not a verified training provider.',
    status: 'published',
  },
];

const courseDefinitions = [
  ['course-crop', 'Crop Production', 'Explore crop planning, seed selection, planting, and basic crop care.', 'crop-plant', 'provider-greenfields', '6 weeks', 'Blended', ['learner', 'farmer', 'sdf'], 'Short Course'],
  ['course-livestock', 'Livestock Management', 'An introductory overview of herd records, animal welfare, and daily livestock care.', 'animal', 'provider-rural-skills', '8 weeks', 'Practical demonstration', ['learner', 'farmer', 'sdf'], 'Practical Farm Training'],
  ['course-poultry', 'Poultry Farming', 'Learn the fundamentals of small-scale poultry planning and flock care.', 'animal', 'provider-agri-practice', '4 weeks', 'Blended', ['learner', 'farmer'], 'Workshop'],
  ['course-business', 'Agricultural Business Management', 'Build foundational skills in farm budgeting, record keeping, and business planning.', 'agribusiness', 'provider-greenfields', '10 weeks', 'Online', ['learner', 'farmer', 'employer', 'sdf'], 'Skills Development Programme'],
  ['course-irrigation', 'Irrigation and Water Management', 'Explore water-use planning, irrigation approaches, and basic system checks.', 'natural-resources', 'provider-rural-skills', '5 weeks', 'Practical demonstration', ['learner', 'farmer', 'sdf'], 'Short Course'],
  ['course-soil', 'Soil Management', 'Learn introductory soil observation, erosion prevention, and soil-care practices.', 'natural-resources', 'provider-agri-practice', '4 weeks', 'Blended', ['learner', 'farmer'], 'Workshop'],
  ['course-sustainable', 'Sustainable Agriculture', 'Explore practical concepts for resilient and resource-conscious farming.', 'farm-management', 'provider-greenfields', '6 weeks', 'Online', ['learner', 'farmer', 'employer', 'sdf'], 'Learnership'],
  ['course-technology', 'Agricultural Technology', 'Discover digital record keeping, farm data, and technology-use considerations.', 'agri-tech', 'provider-greenfields', '3 weeks', 'Online', ['learner', 'farmer', 'employer', 'sdf'], 'Internship'],
  ['course-mechanisation', 'Agricultural Mechanisation', 'Introduction to farm equipment types, maintenance planning, and safe-work practices.', 'mechanisation', 'provider-rural-skills', '5 weeks', 'Practical demonstration', ['learner', 'farmer', 'employer'], 'Short Course'],
  ['course-food-safety', 'Food Safety and Processing', 'Explore clean handling, storage, and basic value-add processing principles.', 'food-safety', 'provider-agri-practice', '4 weeks', 'Blended', ['learner', 'farmer', 'employer', 'sdf'], 'Workshop'],
];

const courses = courseDefinitions.map(([
  id, title, description, categoryId, providerId, duration, deliveryMethod, eligibleRoles, programmeType,
]) => ({
  id,
  title,
  description,
  categoryId,
  providerId,
  duration,
  deliveryMethod,
  eligibleRoles,
  programmeType,
  location: 'South Africa (demonstration listing)',
  accreditation: 'Not verified',
  status: 'Demonstration',
  dataStatus: 'Synthetic demonstration content. No course delivery, provider, accreditation, or official AgriSETA connection is confirmed.',
  interestEnabled: true,
  imageKey: 'agricultural-training',
  createdAt: '2026-10-30T00:00:00.000Z',
}));

const programmes = [
  { id: 'programme-learnership', name: 'Learnerships', description: 'Structured work-and-learning programme information.', courseType: 'Learnership' },
  { id: 'programme-internship', name: 'Internships', description: 'Workplace learning and experience programme information.', courseType: 'Internship' },
  { id: 'programme-short-course', name: 'Short Courses', description: 'Focused learning on a defined agricultural topic.', courseType: 'Short Course' },
  { id: 'programme-workshop', name: 'Workshops', description: 'Short, topic-based practical or facilitated learning.', courseType: 'Workshop' },
  { id: 'programme-practical', name: 'Practical Farm Training', description: 'Demonstration-based agricultural learning information.', courseType: 'Practical Farm Training' },
  { id: 'programme-skills', name: 'Skills Development Programmes', description: 'Workforce and occupational skills programme information.', courseType: 'Skills Development Programme' },
];

const resources = [
  {
    id: 'resource-crop-planning',
    title: 'Crop planning: a starting checklist',
    categoryId: 'crop-plant',
    format: 'In-app guide',
    summary: 'A short planning checklist for thinking through a crop cycle.',
    content: [
      'Start with the intended crop and the growing conditions on the specific farm. Local climate, soil, water availability, and timing can change what is suitable.',
      'Before planting, make a simple plan for seed or planting material, land preparation, water, labour, likely costs, and record keeping.',
      'Keep dated notes about planting, inputs, observations, and harvest. Seek locally appropriate advice from a qualified agricultural adviser or extension officer.',
    ],
    dataStatus: 'Demonstration educational material. Not an official study guide or farm-specific advice.',
  },
  {
    id: 'resource-farm-records',
    title: 'Farm records: simple weekly routine',
    categoryId: 'farm-management',
    format: 'In-app guide',
    summary: 'A basic guide to organising farm activity and expense notes.',
    content: [
      'Choose a notebook or digital record that is practical to use. Record the date, activity, field or enterprise, and the people or equipment involved.',
      'Keep income and expense entries separate, retain source documents where appropriate, and review the records at a regular time each week.',
      'This guide is general information only. Accounting, tax, employment, and regulatory requirements depend on the farm and should be confirmed with an appropriate adviser.',
    ],
    dataStatus: 'Demonstration educational material. Not an official study guide or professional advice.',
  },
  {
    id: 'resource-water-check',
    title: 'Water-use observation notes',
    categoryId: 'natural-resources',
    format: 'In-app guide',
    summary: 'Questions to help organise observations about farm water use.',
    content: [
      'Note where water is used, how it is delivered, and any visible leaks or interruptions. Record observations with dates rather than relying on memory.',
      'Consider soil and crop conditions alongside water use. Local water rules, safety, and suitable irrigation decisions require local context.',
      'Ask a qualified local adviser for help interpreting measurements or making changes to a water system.',
    ],
    dataStatus: 'Demonstration educational material. Not an official study guide or technical specification.',
  },
  {
    id: 'resource-soil-observations',
    title: 'Soil observations and erosion checks',
    categoryId: 'natural-resources',
    format: 'In-app guide',
    summary: 'A field-note checklist for observing soil condition and visible erosion.',
    content: [
      'Choose consistent observation points and record the date, recent weather, field or grazing area, and what you can see. Photos can help compare the same point over time.',
      'Note surface cover, exposed soil, standing water, rills, gullies, and changes after heavy rain. These are observations, not a soil test or diagnosis.',
      'Record the crop or land use and any recent activities that may help explain a change. Avoid changing inputs or cultivation based only on a visual observation.',
      'For soil sampling, erosion-control choices, or farm-specific recommendations, contact a qualified local agricultural adviser or extension service.',
    ],
    dataStatus: 'General educational information. Not a soil test, technical specification, or farm-specific recommendation.',
  },
  {
    id: 'resource-crop-scouting',
    title: 'Crop scouting and field notes',
    categoryId: 'crop-plant',
    format: 'In-app guide',
    summary: 'A repeatable checklist for recording crop changes and seeking timely advice.',
    content: [
      'Walk a consistent route and record the date, field, crop, growth stage if known, and recent weather. Note both healthy and affected areas rather than only unusual plants.',
      'Describe visible symptoms, where they occur, how widespread they appear, and whether they are changing. Photographs with a scale and a wider view can help an adviser understand what you observed.',
      'Record recent field operations and inputs with dates. Do not identify a pest or disease, mix chemicals, or apply a treatment based only on this guide or an image.',
      'For diagnosis and safe, lawful control options, contact a qualified agricultural adviser or extension officer and follow product labels and applicable requirements.',
    ],
    dataStatus: 'General observation guide only. It does not diagnose crop problems or recommend pesticide use.',
  },
  {
    id: 'resource-livestock-observations',
    title: 'Livestock observation and records',
    categoryId: 'animal',
    format: 'In-app guide',
    summary: 'A basic routine for recording herd observations and escalating concerns.',
    content: [
      'Keep dated records of animal groups, movements, feed and water observations, and routine care. Use an identification method that is appropriate for the operation.',
      'During regular checks, note changes in behaviour, appetite, movement, or condition and which animals are affected. Record when the change was first noticed.',
      'This guide cannot assess animal health, diagnose illness, or replace veterinary care. Contact a veterinarian or animal-health professional promptly when an animal is unwell, injured, or deteriorating.',
      'Follow applicable animal identification, welfare, movement, and biosecurity requirements. Confirm current requirements with the relevant authority or qualified adviser.',
    ],
    dataStatus: 'General record-keeping information only. Not veterinary advice or an animal-health diagnosis.',
  },
  {
    id: 'resource-funding-readiness',
    title: 'Preparing to assess a funding opportunity',
    categoryId: 'agribusiness',
    format: 'In-app guide',
    summary: 'A checklist for checking a funding notice before sharing information or applying.',
    content: [
      'Confirm the funder using contact details from its official website or another independently verified channel. Check that the opportunity is open and that its closing date is current.',
      'Read the eligibility rules, eligible costs, location, required contribution, selection process, and reporting conditions. Do not assume that applying guarantees approval or payment.',
      'Prepare a clear project summary and a realistic budget using records you already maintain. Submit only documents the verified funder requires through its confirmed application channel.',
      'Be cautious of upfront fees, requests for passwords or one-time PINs, and pressure to act quickly. Do not send identity or banking documents through this prototype.',
      'MyAgriSETA currently has no connected funder or verified live funding feed. This guide is not a funding offer, financial advice, or confirmation of eligibility.',
    ],
    dataStatus: 'General application-readiness information. No funder, live funding offer, or eligibility decision is provided.',
  },
  {
    id: 'resource-market-planning',
    title: 'Market planning: comparing buyer offers',
    categoryId: 'agribusiness',
    format: 'In-app guide',
    summary: 'A practical checklist for recording and comparing market information from buyers.',
    content: [
      'For each offer, record the date, buyer or market name, product, grade, quantity, and price unit. Do not compare prices unless the product grade and unit are the same.',
      'Ask how the price was determined and whether it can change before delivery. Confirm the delivery location, packaging, quality checks, and who pays transport or other fees.',
      'Write down payment timing, any deductions, and the contact person. Calculate the expected amount after known costs, and keep a copy of the quote or agreement.',
      'This guide contains general planning information only. It does not provide current prices, verified buyers, a sales offer, or farm-specific financial advice. Confirm details directly with each buyer or market before making a decision.',
    ],
    dataStatus: 'General educational information. No live South African market prices, verified buyer listings, or external market data are connected.',
  },
];

const farmerMarketRecords = [];
const farmerMentors = [];
const farmerMentorRequests = [];
const enrollments = [];
const resourceProgress = [];
const savedCourses = [];
const courseProgress = [];
const moduleProgress = [];
const certificates = [];
const passportSkills = [];
const passportRecords = [];

module.exports = {
  categories,
  providers,
  courses,
  programmes,
  resources,
  farmerMarketRecords,
  farmerMentors,
  farmerMentorRequests,
  enrollments,
  resourceProgress,
  savedCourses,
  courseProgress,
  moduleProgress,
  certificates,
  passportSkills,
  passportRecords,
};
