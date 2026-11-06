const choice = (prompt, correct, distractorA, distractorB) => ({
  prompt,
  options: [correct, distractorA, distractorB].map((text, index, choices) => ({
    id: ['a', 'b', 'c'][index],
    text: choices[(index + (prompt.length % 3)) % 3],
  })),
  correctOptionId: ['a', 'b', 'c'][(3 - (prompt.length % 3)) % 3],
});

const curriculum = {
  'course-crop': [
    {
      id: 'crop-planning',
      title: '1. Plan a crop cycle',
      content: [
        'A crop plan starts with the intended crop and the conditions on the specific farm. Soil, local climate, available water, timing, labour, and access to planting material all affect what may be practical.',
        'Write down assumptions and costs before planting. Local conditions vary, so use this learning material as a planning prompt and confirm technical decisions with a qualified local adviser.',
      ],
      questions: [
        choice('Which is a useful first step when planning a crop cycle?', 'Consider the crop together with local soil, climate, water, and timing.', 'Choose a crop only because it performed well somewhere else.', 'Plant first and decide what resources are needed later.'),
        choice('Why should a farm plan record its assumptions?', 'So decisions can be reviewed when conditions or costs change.', 'So the assumptions can be treated as guaranteed results.', 'So observations do not need to be recorded during the season.'),
        choice('What is a sensible response when local growing conditions are uncertain?', 'Seek advice suited to the farm and check relevant local information.', 'Rely on a general guide as a site-specific instruction.', 'Ignore water and soil conditions until harvest.'),
      ],
    },
    {
      id: 'crop-planting-records',
      title: '2. Planting and keeping records',
      content: [
        'Before planting, plan for land preparation, planting material, water, labour, likely costs, and the records you will keep. The right timing and method depend on the crop and local conditions.',
        'Date notes about planting, inputs, field observations, and harvest make it easier to review what happened. Records support learning; they do not guarantee a particular yield.',
      ],
      questions: [
        choice('Which record is most useful for reviewing a crop cycle?', 'Dated notes about planting, inputs, observations, and harvest.', 'A single undated estimate made after the season.', 'Only the crop name, with no field observations.'),
        choice('What should be considered before planting?', 'Planting material, land preparation, water, labour, and likely costs.', 'Only the preferred harvest date.', 'Only the name of the equipment used.'),
        choice('Do farm records guarantee a particular crop yield?', 'No. They help review decisions but cannot guarantee results.', 'Yes. Complete records guarantee the planned yield.', 'Yes, if records are stored digitally.'),
      ],
    },
  ],
  'course-livestock': [
    {
      id: 'livestock-observation',
      title: '1. Observe animals and keep records',
      content: [
        'Regular observation helps a farm notice changes in animal behaviour, condition, feed, water, and surroundings. Record the date and what was observed, and follow an appropriate escalation process when an animal may need attention.',
        'This introductory material is not veterinary advice. Animal-health concerns should be discussed with a qualified animal-health professional.',
      ],
      questions: [
        choice('What is a useful livestock record?', 'A dated note of an observation or action for the relevant animal or group.', 'A memory-based summary with no date or animal group.', 'A list of feed purchases without any context.'),
        choice('What should you do when an animal appears unwell?', 'Follow the farm process and seek qualified animal-health advice.', 'Assume the cause and treat every animal the same way.', 'Wait until the next routine record review.'),
        choice('Why observe animals regularly?', 'To notice and record changes that may need attention.', 'To replace veterinary support.', 'To guarantee there will be no livestock losses.'),
      ],
    },
    {
      id: 'livestock-welfare',
      title: '2. Welfare and daily routines',
      content: [
        'Good daily routines consider access to suitable feed and clean water, safe handling, shelter where needed, and an environment appropriate to the animals. Requirements vary by species and production setting.',
        'Keep routines practical and consistent, and record concerns and actions. Use current local requirements and professional guidance for animal welfare and health decisions.',
      ],
      questions: [
        choice('Which is part of a responsible daily livestock routine?', 'Check that animals can access suitable feed and clean water.', 'Handle animals quickly without regard to safety.', 'Use one routine for every species and setting.'),
        choice('What should be done when an animal welfare concern is identified?', 'Record the concern and follow appropriate farm and professional guidance.', 'Remove the concern from the record if it is resolved.', 'Assume that no further action is ever needed.'),
        choice('Why might livestock routines differ between farms?', 'Animal species, conditions, and production settings differ.', 'Records are not useful for livestock.', 'Every farm has the same resources and risks.'),
      ],
    },
  ],
  'course-poultry': [
    {
      id: 'poultry-planning',
      title: '1. Plan a poultry enterprise',
      content: [
        'A poultry plan considers the intended production, housing, feed and water needs, labour, costs, and a route to market. Local regulations, climate, and available services can affect the plan.',
        'Start with realistic assumptions and seek locally appropriate support before investing. This overview is educational and is not a production prescription.',
      ],
      questions: [
        choice('What belongs in an initial poultry enterprise plan?', 'Housing, feed, water, labour, costs, and a route to market.', 'Only the number of birds to buy.', 'Only the expected selling price.'),
        choice('Why should a plan use realistic local assumptions?', 'Costs, climate, rules, and services vary by location.', 'A plan removes all business risk.', 'Every poultry operation has identical needs.'),
        choice('What is a careful step before investing?', 'Check local requirements and seek appropriate advice.', 'Assume that a general guide covers every site.', 'Skip cost planning until birds are purchased.'),
      ],
    },
    {
      id: 'poultry-care',
      title: '2. Flock care and hygiene',
      content: [
        'Routine observations of flock behaviour, feed and water use, housing, and cleanliness help operators identify changes. Keep dated records and act on concerns through suitable local guidance.',
        'Cleanliness and biosecurity practices should fit the operation and current professional advice. This module does not replace veterinary or regulatory guidance.',
      ],
      questions: [
        choice('What helps identify changes in a flock?', 'Regular observation and dated records of relevant conditions.', 'Only checking the flock when a sale is due.', 'Changing feed without recording the change.'),
        choice('How should biosecurity practices be selected?', 'Use practices suited to the operation and current professional advice.', 'Copy any routine without considering local conditions.', 'Treat hygiene as optional when birds look healthy.'),
        choice('What should be done with a concerning change in flock health?', 'Record it and seek suitable animal-health guidance.', 'Ignore it if production has not changed yet.', 'Use this introductory module as a diagnosis.'),
      ],
    },
  ],
  'course-business': [
    {
      id: 'business-records',
      title: '1. Farm records and cash flow',
      content: [
        'A basic farm record can include the date, enterprise, activity, income or expense, and any supporting reference. Keep income and expenses distinguishable and review entries regularly.',
        'Cash-flow planning compares when money may come in with when costs are due. Estimates are planning tools, not guarantees; actual results should be recorded and compared with the plan.',
      ],
      questions: [
        choice('Which information makes an expense entry easier to review?', 'Date, enterprise or activity, amount, and a useful reference.', 'Only the amount, with no date or description.', 'A total written from memory at year-end.'),
        choice('What does a simple cash-flow plan help compare?', 'Expected timing of income and costs.', 'The guaranteed profit of the business.', 'The market price of every future sale.'),
        choice('How should estimates in a farm budget be treated?', 'As assumptions to compare with actual results.', 'As guaranteed income and expenses.', 'As a reason not to keep transaction records.'),
      ],
    },
    {
      id: 'business-decisions',
      title: '2. Budgeting and review',
      content: [
        'A budget organises expected costs and income for a defined period or activity. Separate assumptions from known amounts and update the plan when better information becomes available.',
        'Regular review can highlight differences between plans and actual records. Significant financial, tax, or legal decisions should be checked with an appropriately qualified adviser.',
      ],
      questions: [
        choice('What should a useful budget distinguish?', 'Known amounts and estimates or assumptions.', 'Business costs and income as one undifferentiated figure.', 'Expected results from actual records.'),
        choice('What is a useful purpose of comparing budget and actual records?', 'To understand differences and improve future planning.', 'To guarantee next season will be profitable.', 'To remove the need for dated records.'),
        choice('Where should complex tax or financial questions be directed?', 'To an appropriately qualified adviser.', 'To an unverified example in a general course.', 'To a budget spreadsheet without further review.'),
      ],
    },
  ],
  'course-irrigation': [
    {
      id: 'water-planning',
      title: '1. Observe and plan water use',
      content: [
        'Begin by noting where and when water is used, how it is delivered, and any visible interruptions or leaks. Consider crop and soil observations alongside water use.',
        'Water availability, rights, infrastructure, and suitable irrigation decisions are location-specific. Check current local requirements and obtain technical advice before changing a system.',
      ],
      questions: [
        choice('What is a useful first step when reviewing farm water use?', 'Record where and when water is used and note visible issues.', 'Change the system before observing it.', 'Estimate use from memory once a year.'),
        choice('Why consider crop and soil observations alongside water use?', 'They provide context for understanding farm conditions.', 'They determine an exact irrigation schedule for every farm.', 'They make local water requirements irrelevant.'),
        choice('What should happen before a major system change?', 'Check local requirements and seek suitable technical advice.', 'Rely only on this general learning material.', 'Assume the same system is suitable everywhere.'),
      ],
    },
    {
      id: 'irrigation-checks',
      title: '2. Basic system checks',
      content: [
        'Routine visual checks can note leaks, blockages, unusual pressure indications, and interruptions. Record what was observed, where it occurred, and when it was checked.',
        'Do not work on equipment beyond your training or use unsafe procedures. Follow manufacturer guidance and seek a qualified technician where needed.',
      ],
      questions: [
        choice('Which detail helps make a system observation useful?', 'What was noticed, where, and when.', 'A guess about the cause with no observation.', 'Only the name of the irrigation method.'),
        choice('What should you do if a repair is outside your training?', 'Follow safety procedures and contact a qualified technician.', 'Attempt it because a visual check was completed.', 'Disable safety features to finish faster.'),
        choice('Why record repeated checks?', 'To help identify changes and follow up on issues.', 'To prove that no future failures can occur.', 'To replace manufacturer instructions.'),
      ],
    },
  ],
  'course-soil': [
    {
      id: 'soil-observation',
      title: '1. Observe soil conditions',
      content: [
        'Soil observations may include surface cover, visible erosion, drainage patterns, and differences between areas. Note the place, date, and conditions so observations can be compared over time.',
        'A visual observation is not a laboratory analysis. Ask a qualified local adviser about sampling and interpretation before making major soil or input decisions.',
      ],
      questions: [
        choice('How can a soil observation be made more useful?', 'Record the location, date, conditions, and what was observed.', 'Describe the whole farm from one undated note.', 'Treat appearance as a complete soil test.'),
        choice('What does a visual soil observation not replace?', 'Appropriate soil testing and qualified interpretation.', 'The need to note where an observation was made.', 'The need to consider local conditions.'),
        choice('Why compare observations over time?', 'To notice changes in different places or conditions.', 'To prove that soil never changes.', 'To avoid seeking advice when needed.'),
      ],
    },
    {
      id: 'soil-care',
      title: '2. Protect and review soil',
      content: [
        'Soil-care choices depend on slope, rainfall, soil type, crop, and farm practice. Maintaining cover and observing water movement are examples of topics to discuss with a local adviser.',
        'Record the practice used and review what happens under local conditions. This general module does not prescribe a treatment or guarantee a particular soil outcome.',
      ],
      questions: [
        choice('Why should soil-care decisions consider local conditions?', 'Soils, slopes, rainfall, and farm practices vary.', 'One practice guarantees the same result everywhere.', 'Local observations are not relevant to soil.'),
        choice('What is a useful way to review a soil-care practice?', 'Record the practice and observe local results over time.', 'Assume the intended result without checking.', 'Change several practices without recording them.'),
        choice('Does this module prescribe a soil treatment?', 'No. It provides general learning prompts, not a site-specific prescription.', 'Yes. It replaces soil tests and local advice.', 'Yes. It guarantees improved soil for every farm.'),
      ],
    },
  ],
  'course-sustainable': [
    {
      id: 'sustainable-planning',
      title: '1. Plan with resources in mind',
      content: [
        'A resource-conscious farm plan considers production goals alongside soil, water, energy, labour, and financial constraints. The balance will differ between enterprises and local environments.',
        'Identify practical measures that can be observed and recorded. Seek context-specific advice before making changes that may affect production or natural resources.',
      ],
      questions: [
        choice('What is considered in a resource-conscious farm plan?', 'Production goals together with relevant resource and business constraints.', 'Production targets only, regardless of available resources.', 'A single practice assumed to fit all farms.'),
        choice('Why identify measures that can be observed?', 'To review whether a practice is working in the local context.', 'To guarantee a particular environmental outcome.', 'To avoid recording farm activity.'),
        choice('How should significant changes be planned?', 'Consider local conditions and seek suitable advice.', 'Use a general example as a guarantee.', 'Ignore possible production and resource effects.'),
      ],
    },
    {
      id: 'sustainable-review',
      title: '2. Monitor and adapt',
      content: [
        'Regular notes about inputs, practices, weather conditions, and observations help a farm review changes. Comparing records over time can inform future questions and plans.',
        'No single indicator describes every outcome. Use relevant local measures and qualified guidance, and update plans when evidence or conditions change.',
      ],
      questions: [
        choice('What helps a farm review a change in practice?', 'Dated records of the practice and relevant observations.', 'Memory alone after a long period.', 'An assumption that the first result will continue unchanged.'),
        choice('Should one indicator be used to describe every sustainability outcome?', 'No. Relevant measures depend on the local goal and context.', 'Yes. One measure covers every farm and outcome.', 'Yes, if the indicator is easy to collect.'),
        choice('When is it sensible to update a plan?', 'When conditions or useful evidence change.', 'Never, once an initial plan is written.', 'Only after the farm stops keeping records.'),
      ],
    },
  ],
  'course-technology': [
    {
      id: 'technology-selection',
      title: '1. Choose a useful digital tool',
      content: [
        'Start with a practical farm task or decision, then consider whether a digital tool can help. Check cost, connectivity, training needs, data formats, and what happens if the tool is unavailable.',
        'A tool should fit the users and workflow. Test it with non-sensitive information before relying on it for important operations.',
      ],
      questions: [
        choice('What is a sensible starting point when choosing farm technology?', 'Identify the task or problem the tool should help address.', 'Choose the newest tool regardless of need.', 'Collect as much personal data as possible.'),
        choice('What should be checked before relying on a digital tool?', 'Cost, connectivity, user needs, and how information can be accessed.', 'Only the colour of the interface.', 'Whether it promises guaranteed production results.'),
        choice('How can a new tool be tried safely?', 'Test it with non-sensitive information and check that it fits the workflow.', 'Immediately make it essential to every operation.', 'Enter personal data before checking its purpose.'),
      ],
    },
    {
      id: 'digital-records',
      title: '2. Keep and protect farm data',
      content: [
        'Digital records should be accurate, understandable, and collected for a clear purpose. Restrict access to people who need the information and follow suitable backup and retention practices.',
        'Do not enter sensitive personal or business data into a tool unless its security, privacy, and intended use have been checked.',
      ],
      questions: [
        choice('What is a sound approach to collecting farm data?', 'Collect information needed for a clear purpose and keep it accurate.', 'Collect all available information without a defined use.', 'Let every user access all records by default.'),
        choice('Who should have access to private records?', 'People who need the information for an authorised purpose.', 'Anyone who can open the device.', 'All users regardless of their role.'),
        choice('What should happen before entering sensitive information in a tool?', 'Check its security, privacy, purpose, and access controls.', 'Assume every digital service is safe.', 'Share credentials with other users.'),
      ],
    },
  ],
  'course-mechanisation': [
    {
      id: 'equipment-safety',
      title: '1. Equipment awareness and safety',
      content: [
        'Before using equipment, understand the task, relevant hazards, and the operator training required. Follow the manufacturer instructions, workplace procedures, and applicable safety requirements.',
        'Do not operate machinery when untrained or when safety guards are missing or damaged. Stop and report unsafe conditions through the appropriate process.',
      ],
      questions: [
        choice('What should an operator do before using unfamiliar equipment?', 'Check the instructions, hazards, and required training.', 'Start the equipment to learn how it works.', 'Remove guards that make the task slower.'),
        choice('What is the appropriate response to damaged safety equipment?', 'Stop and report the unsafe condition using the proper process.', 'Continue if the task is nearly finished.', 'Ask an untrained person to operate it.'),
        choice('When should machinery be operated?', 'When the operator is trained and safe procedures are followed.', 'Whenever production is behind schedule.', 'Without checking the work area.'),
      ],
    },
    {
      id: 'equipment-maintenance',
      title: '2. Maintenance planning',
      content: [
        'A maintenance plan can record equipment identification, inspections, reported issues, service dates, and the person responsible for follow-up. Use the manufacturer schedule and local workplace procedures.',
        'Maintenance should be carried out by people with appropriate competence. A record of a check does not prove that equipment is safe to use if a fault remains.',
      ],
      questions: [
        choice('What information can help organise maintenance?', 'Equipment identity, inspection dates, issues, and follow-up responsibility.', 'Only the purchase price.', 'An unrecorded verbal reminder.'),
        choice('Who should perform work requiring specialist competence?', 'A person with the appropriate training and authorisation.', 'Anyone available at the time.', 'An operator using a general guide only.'),
        choice('Does recording an inspection guarantee equipment is safe?', 'No. Faults still need appropriate attention before use.', 'Yes, regardless of what was found.', 'Yes, if the record is digital.'),
      ],
    },
  ],
  'course-food-safety': [
    {
      id: 'food-hygiene',
      title: '1. Clean handling and contamination',
      content: [
        'Food-handling routines should reduce avoidable contamination. Clean hands and surfaces, suitable equipment, and separation of raw and ready-to-eat items are common topics to include in a site-specific hygiene process.',
        'Follow current food-safety requirements and workplace procedures. This introduction does not replace formal training or a food-safety plan.',
      ],
      questions: [
        choice('Which practice can help reduce cross-contamination?', 'Keep raw items separate from ready-to-eat foods using suitable procedures.', 'Use the same unclean surface for every item.', 'Skip hand hygiene when work is busy.'),
        choice('What should a food-handling routine follow?', 'Current requirements and the workplace food-safety process.', 'A general example as a complete legal standard.', 'Unrecorded habits only.'),
        choice('Does this module replace formal food-safety training?', 'No. It is an introductory learning aid only.', 'Yes. It certifies every food handler.', 'Yes. It approves a processing facility.'),
      ],
    },
    {
      id: 'food-storage',
      title: '2. Storage and process records',
      content: [
        'Safe storage depends on the type of food, the process, and applicable requirements. Keep relevant checks and actions in a clear record that responsible staff can review.',
        'If a storage condition or process falls outside the approved procedure, follow the workplace response and seek guidance from the responsible food-safety lead.',
      ],
      questions: [
        choice('What should storage practices be based on?', 'The food, process, and applicable requirements.', 'A single rule assumed to fit every product.', 'Appearance alone.'),
        choice('Why keep records of relevant process checks?', 'To support review and follow-up by responsible staff.', 'To avoid acting on an issue.', 'To prove no issue can ever occur.'),
        choice('What should happen when a process is outside its procedure?', 'Follow the workplace response and contact the responsible lead.', 'Continue without recording it.', 'Change the procedure informally and say nothing.'),
      ],
    },
  ],
};

module.exports = { curriculum };
