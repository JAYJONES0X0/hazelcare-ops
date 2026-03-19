import type { NourishEntry, Action, Incident, StaffMember } from './types';
import { uid } from './storage';

// ============================================================
// REALISTIC DEMO DATA — Hazelcare houses, real entry types
// ============================================================

const HOUSES = [
  'Lingfield House', 'Church House', 'Laurel House', 'Station House',
  'Canterbury', 'Glenfrome House', 'Woburn House', 'Hazelbury House',
  'Courtney Lodge', 'Cottrell House',
];

const COORDINATORS: Record<string, string> = {
  'Lingfield House': 'Sarah Mitchell',
  'Church House': 'David Clarke',
  'Laurel House': 'Emma Thompson',
  'Station House': 'Mark Williams',
  'Canterbury': 'Lisa Brown',
  'Glenfrome House': 'James Wilson',
  'Woburn House': 'Rachel Davis',
  'Hazelbury House': 'Tom Harris',
  'Courtney Lodge': 'Karen Moore',
  'Cottrell House': 'Paul Taylor',
};

const CLIENTS = [
  'Jordan Blake', 'Wayne Jefferson', 'Claire Hughes', 'Robert Ellis',
  'Sandra Peters', 'Michael Quinn', 'Deborah Lane', 'Steven Cross',
  'Patricia Webb', 'Andrew Shaw', 'Helen Barnes', 'Gary Newman',
  'Julie Foster', 'Keith Bryant', 'Donna Marshall', 'Brian Cooper',
  'Margaret Price', 'Ian Russell', 'Carol Bennett', 'Philip Howard',
];

const STAFF = [
  'Sarah Mitchell', 'David Clarke', 'Emma Thompson', 'Mark Williams',
  'Lisa Brown', 'James Wilson', 'Rachel Davis', 'Tom Harris',
  'Karen Moore', 'Paul Taylor', 'Amy Rogers', 'Chris Evans',
  'Natalie Wood', 'Daniel King', 'Sophie Turner', 'Ben Green',
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-GB');
}

const RED_ENTRIES: { type: string; entry: string; flags: string[] }[] = [
  { type: 'Accident/Incident', entry: 'Client fell in bathroom at 06:30. Staff attended immediately. Small bruise on left arm. First aid administered. GP notified. Incident form completed.', flags: ['fall', 'injury'] },
  { type: 'Medication', entry: 'Client refused morning medication including prescribed antipsychotic. Staff attempted at 08:00 and again at 09:30. GP informed via phone. Will attempt again at lunchtime.', flags: ['refused medication'] },
  { type: 'Safeguarding', entry: 'Safeguarding concern raised. Client disclosed that another resident made threatening comments. Statements taken from both parties. Manager notified. Local authority referral being considered.', flags: ['safeguarding', 'threatened'] },
  { type: 'Accident/Incident', entry: 'Client found on floor in bedroom. Ambulance called as precaution. No visible injuries but client confused and distressed. Hospital assessment recommended.', flags: ['fall', 'ambulance'] },
  { type: 'Daily 1:1 Support', entry: 'Client expressed self-harm thoughts during 1:1 session. Crisis plan activated. Staff remained with client. Mental health team contacted for urgent review.', flags: ['self-harm'] },
  { type: 'Handover', entry: 'Police attended at 22:15 regarding noise complaint from neighbour. Client was highly agitated. Officers spoke with client and left without further action. Incident logged.', flags: ['police'] },
];

const AMBER_ENTRIES: { type: string; entry: string; flags: string[] }[] = [
  { type: 'Daily 1:1 Support', entry: 'Client reported hearing voices again this morning. Appeared distressed but engaged with staff. PRN offered and accepted. Will monitor throughout the day.', flags: ['hearing voices'] },
  { type: 'Handover', entry: 'Client became agitated during dinner service. Raised voice at staff member. De-escalation techniques used successfully. Calmed after 20 minutes.', flags: ['agitated', 'escalated'] },
  { type: 'Task Note', entry: 'Property damage in communal lounge — client threw TV remote at wall causing hole in plasterboard. Maintenance notified. Client apologised later in evening.', flags: ['property damage', 'damaged'] },
  { type: 'Medication', entry: 'Medication discrepancy found during evening count. One tablet unaccounted for. All staff on shift interviewed. Searching medication area. Senior notified.', flags: ['medication discrepancy'] },
  { type: 'Handover', entry: 'Client refused to eat breakfast and lunch. Offered alternatives but declined everything. Drinking fluids. Will continue to monitor and escalate if continues past dinner.', flags: ['refused food'] },
  { type: 'Staff Performance', entry: 'Staff member arrived 45 minutes late for shift without calling ahead. Short-staffed during medication round. Spoken to by coordinator. Written warning being considered.', flags: ['late', 'lateness'] },
  { type: 'Daily 1:1 Support', entry: 'Complaint received from client family regarding cleanliness of bedroom. Room inspected — standard met but client had moved items. Family reassured. Follow-up cleaning scheduled.', flags: ['complaint'] },
  { type: 'Safeguarding', entry: 'Concerns raised about client not sleeping for 3 consecutive nights. GP referral made. Sleep hygiene discussed with client. Night staff to monitor and log.', flags: ['not sleeping', 'concern'] },
];

const GREEN_ENTRIES: { type: string; entry: string }[] = [
  { type: 'Daily 1:1 Support', entry: 'Good session. Client engaged well, discussed plans for the weekend. Positive mood throughout. Encouraged to continue attending community group on Thursday.' },
  { type: 'Handover', entry: 'Quiet night. All clients settled by 22:00. No incidents to report. Medication round completed on time. All checks completed as per rota.' },
  { type: 'Medication', entry: 'Medication audit completed for the week. All counts correct. MAR charts up to date. No discrepancies found. Next audit due Monday.' },
  { type: 'Task Note', entry: 'Weekly food shop completed. Menu plan followed. Budget within allowance. All dietary requirements met. Receipts filed.' },
  { type: 'Finance Audit', entry: 'Petty cash reconciled. Balance correct at £47.32. All receipts present and accounted for. Signed off by coordinator.' },
  { type: 'Repairs', entry: 'Maintenance completed bathroom light fitting replacement. Tested and working. No further issues to report.' },
  { type: 'Daily 1:1 Support', entry: 'Client attended day centre today. Staff reported positive engagement. Client helped prepare lunch for the group. Good social interaction observed.' },
  { type: 'Handover', entry: 'Day shift handover — all tasks completed. 3 clients attended appointments. Medication rounds on time. One maintenance request submitted for kitchen tap.' },
  { type: 'Expenses/Mileage', entry: 'Staff mileage claim submitted for client appointments this week. 47 miles total. Receipts attached for parking (£6.80).' },
  { type: 'Supervision', entry: 'Supervision completed with support worker. Discussed workload, training needs, and client progress. Next supervision booked for 4 weeks.' },
];

export function generateMockEntries(): NourishEntry[] {
  const entries: NourishEntry[] = [];

  // Generate ~280 entries across houses over 7 days
  for (const house of HOUSES) {
    // 2-3 red entries per some houses
    if (Math.random() > 0.4) {
      const count = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < count; i++) {
        const template = randomFrom(RED_ENTRIES);
        entries.push({
          id: uid(),
          date: dateStr(Math.floor(Math.random() * 7)),
          time: `${String(Math.floor(Math.random() * 12) + 6).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
          house,
          type: template.type,
          carer: COORDINATORS[house] || randomFrom(STAFF),
          client: randomFrom(CLIENTS),
          entry: template.entry,
          severity: 'red',
          flags: template.flags,
          category: 'incident',
        });
      }
    }

    // 3-5 amber entries
    const amberCount = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < amberCount; i++) {
      const template = randomFrom(AMBER_ENTRIES);
      entries.push({
        id: uid(),
        date: dateStr(Math.floor(Math.random() * 7)),
        time: `${String(Math.floor(Math.random() * 14) + 6).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        house,
        type: template.type,
        carer: randomFrom(STAFF),
        client: randomFrom(CLIENTS),
        entry: template.entry,
        severity: 'amber',
        flags: template.flags,
        category: 'other',
      });
    }

    // 15-25 green entries
    const greenCount = Math.floor(Math.random() * 11) + 15;
    for (let i = 0; i < greenCount; i++) {
      const template = randomFrom(GREEN_ENTRIES);
      entries.push({
        id: uid(),
        date: dateStr(Math.floor(Math.random() * 7)),
        time: `${String(Math.floor(Math.random() * 16) + 6).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        house,
        type: template.type,
        carer: randomFrom(STAFF),
        client: randomFrom(CLIENTS),
        entry: template.entry,
        severity: 'none',
        flags: [],
        category: 'other',
      });
    }
  }

  return entries;
}

export function generateMockActions(): Action[] {
  return [
    { id: uid(), title: 'Follow up GP referral for Jordan Blake', description: 'GP referral made after fall incident. Need confirmation of appointment date.', house: 'Lingfield House', owner: 'Sarah Mitchell', priority: 'critical', status: 'in_progress', createdAt: dateStr(3), dueDate: dateStr(-1), tags: ['medical', 'fall'] },
    { id: uid(), title: 'Review medication protocol — evening count', description: 'Discrepancy found in evening medication count. Review process and retrain staff if needed.', house: 'Church House', owner: 'David Clarke', priority: 'high', status: 'open', createdAt: dateStr(2), dueDate: dateStr(-2), tags: ['medication'] },
    { id: uid(), title: 'Schedule maintenance — bathroom light', description: 'Bathroom light reported flickering. Health & safety concern for night shifts.', house: 'Laurel House', owner: 'Emma Thompson', priority: 'medium', status: 'open', createdAt: dateStr(1), dueDate: dateStr(-4), tags: ['maintenance', 'h&s'] },
    { id: uid(), title: 'Complete safeguarding referral', description: 'Local authority referral for threatening behaviour incident. Paperwork needs completing.', house: 'Station House', owner: 'Mark Williams', priority: 'critical', status: 'in_progress', createdAt: dateStr(2), dueDate: dateStr(-1), tags: ['safeguarding'] },
    { id: uid(), title: 'Staff supervision — Amy Rogers', description: 'Supervision overdue by 2 weeks. Schedule and complete.', house: 'Canterbury', owner: 'Lisa Brown', priority: 'medium', status: 'open', createdAt: dateStr(5), dueDate: dateStr(-3), tags: ['staff', 'supervision'] },
    { id: uid(), title: 'Repair plasterboard — communal lounge', description: 'Hole in wall from thrown remote. Get quote from maintenance.', house: 'Glenfrome House', owner: 'James Wilson', priority: 'low', status: 'open', createdAt: dateStr(4), dueDate: dateStr(-7), tags: ['maintenance', 'damage'] },
    { id: uid(), title: 'Family meeting — Hughes family', description: 'Follow-up on cleanliness complaint. Arrange meeting to discuss care plan.', house: 'Woburn House', owner: 'Rachel Davis', priority: 'high', status: 'in_progress', createdAt: dateStr(3), dueDate: dateStr(-2), tags: ['family', 'complaint'] },
    { id: uid(), title: 'Night staff sleep monitoring log', description: 'Client not sleeping — set up monitoring log for night staff to complete nightly.', house: 'Hazelbury House', owner: 'Tom Harris', priority: 'high', status: 'completed', createdAt: dateStr(5), dueDate: dateStr(0), completedAt: dateStr(1), tags: ['monitoring'] },
    { id: uid(), title: 'Written warning — lateness', description: 'Staff member late 45 mins without notice. Formal process to begin.', house: 'Courtney Lodge', owner: 'Karen Moore', priority: 'medium', status: 'open', createdAt: dateStr(2), dueDate: dateStr(-5), tags: ['staff', 'disciplinary'] },
    { id: uid(), title: 'Update crisis plan — self-harm disclosure', description: 'Client disclosed self-harm thoughts. Crisis plan needs updating with MH team input.', house: 'Cottrell House', owner: 'Paul Taylor', priority: 'critical', status: 'in_progress', createdAt: dateStr(1), dueDate: dateStr(-1), tags: ['mental-health', 'crisis'] },
  ];
}

export function generateMockIncidents(): Incident[] {
  return [
    { id: uid(), title: 'Client fall — bathroom', house: 'Lingfield House', client: 'Jordan Blake', staff: 'Sarah Mitchell', date: dateStr(3), severity: 'red', stage: 'investigating', description: 'Client fell in bathroom at 06:30. Small bruise on left arm. First aid administered. GP notified.', flags: ['fall', 'injury'], actions: ['GP referral', 'Incident form filed', 'Family notified'], createdAt: dateStr(3) },
    { id: uid(), title: 'Medication refusal — antipsychotic', house: 'Church House', client: 'Wayne Jefferson', staff: 'David Clarke', date: dateStr(2), severity: 'red', stage: 'logged', description: 'Client refused morning medication including prescribed antipsychotic. GP informed.', flags: ['refused medication'], actions: ['GP notification', 'MAR chart updated'], createdAt: dateStr(2) },
    { id: uid(), title: 'Threatening behaviour disclosure', house: 'Station House', client: 'Robert Ellis', staff: 'Mark Williams', date: dateStr(2), severity: 'red', stage: 'investigating', description: 'Client disclosed threatening comments from another resident. Statements taken.', flags: ['safeguarding', 'threatened'], actions: ['Statements taken', 'Manager notified', 'LA referral pending'], createdAt: dateStr(2) },
    { id: uid(), title: 'Self-harm disclosure', house: 'Cottrell House', client: 'Patricia Webb', staff: 'Paul Taylor', date: dateStr(1), severity: 'red', stage: 'investigating', description: 'Client expressed self-harm thoughts during 1:1. Crisis plan activated. MH team contacted.', flags: ['self-harm'], actions: ['Crisis plan activated', 'MH team referral', '1:1 obs increased'], createdAt: dateStr(1) },
    { id: uid(), title: 'Property damage — lounge', house: 'Glenfrome House', client: 'Steven Cross', staff: 'James Wilson', date: dateStr(4), severity: 'amber', stage: 'resolved', description: 'Client threw remote at wall causing hole in plasterboard. Apologised later.', flags: ['property damage'], actions: ['Maintenance notified', 'Behavioural support plan reviewed'], outcome: 'Maintenance repair scheduled. BSP updated.', createdAt: dateStr(4) },
    { id: uid(), title: 'Staff lateness — medication round', house: 'Courtney Lodge', client: '', staff: 'Ben Green', date: dateStr(2), severity: 'amber', stage: 'logged', description: 'Staff arrived 45 mins late. Short-staffed during medication round.', flags: ['late'], actions: ['Coordinator spoken to staff'], createdAt: dateStr(2) },
  ];
}

export function generateMockStaff(): StaffMember[] {
  return HOUSES.flatMap(house => {
    const coord = COORDINATORS[house];
    const team: StaffMember[] = [
      { id: uid(), name: coord, role: 'House Coordinator', house, status: 'active', sicknessThisMonth: 0, latenessThisMonth: 0, nextSupervision: dateStr(-14), dbsExpiry: '15/09/2026', trainingExpiry: '01/06/2026' },
      { id: uid(), name: randomFrom(STAFF.filter(s => s !== coord)), role: 'Senior Support Worker', house, status: 'active', sicknessThisMonth: 1, latenessThisMonth: 0, nextSupervision: dateStr(-7), dbsExpiry: '22/11/2026', trainingExpiry: '15/04/2026' },
      { id: uid(), name: randomFrom(STAFF.filter(s => s !== coord)), role: 'Support Worker', house, status: Math.random() > 0.8 ? 'sickness' : 'active', sicknessThisMonth: Math.floor(Math.random() * 4), latenessThisMonth: Math.floor(Math.random() * 3), nextSupervision: dateStr(-21 + Math.floor(Math.random() * 14)), dbsExpiry: '08/03/2027', trainingExpiry: '20/05/2026' },
    ];
    return team;
  });
}
