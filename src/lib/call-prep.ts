import type { EscalationItem } from './staff-monitoring';
import { ORG_CONFIG } from './config';

export type CallPrepVariant = 'coaching' | 'urgent' | 'support-first' | 'message' | 'email';

export interface CallPrepScript {
  title: string;
  lines: string[];
}

/** Returns a human-readable house label — never leaks "General", "—", "multiple" */
function resolveHouseLabel(houseLabel: string): string {
  const generic = ['general', 'multiple', 'all houses', '—', '-', ''];
  if (generic.includes(houseLabel.trim().toLowerCase())) return 'this week';
  return `at ${houseLabel}`;
}

function buildNotePattern(reasons: string[], avgChars: number): string {
  const joined = reasons.join(' ').toLowerCase();
  if (joined.includes('short') || joined.includes('length') || avgChars < 40) {
    return `very brief entries — sometimes just a single line like "care provided" or "staff supported" with no detail behind it`;
  }
  if (joined.includes('first') || joined.includes('person')) {
    return `entries written in third person — "staff supported…", "carer prompted…" — rather than in your own voice`;
  }
  if (joined.includes('handover')) {
    return `handover notes that don't capture what the next shift actually needs to know`;
  }
  return `entries that don't show the decision-making behind the care — someone reading them can't tell what you did or why`;
}

function buildGoldExample(reasons: string[]): string {
  const joined = reasons.join(' ').toLowerCase();
  if (joined.includes('short') || joined.includes('length') || joined.includes('brief')) {
    return `"I prompted James with his morning routine. He declined at first, saying he wanted to stay in bed. I gave him ten minutes, checked back in, and he agreed to get up. I supported him with washing and dressing — he needed prompting at each stage but completed tasks independently once prompted. Mood appeared flat this morning, I noted this for the next shift."`;
  }
  if (joined.includes('first') || joined.includes('person')) {
    return `"I supported Maria with her evening meal. She was reluctant to eat initially so I sat with her and encouraged conversation about her day — this helped her engage and she finished around 60% of her meal. I monitored her fluid intake and recorded it in the MAR. No concerns to escalate."`;
  }
  return `"I attended to David during his distressed episode at 14:30. He was pacing and raised his voice. I used a calm, low tone and offered him a walk to the garden — he accepted. Within 20 minutes his presentation settled. I did not need to escalate. I recorded this for the senior on duty and flagged it in handover."`;
}

export function buildCallPrepScript(
  esc: EscalationItem,
  houseLabel: string,
  variant: CallPrepVariant = 'coaching',
): CallPrepScript {
  const firstName = esc.carer.split(' ')[0] || esc.carer;
  const locationRef = resolveHouseLabel(houseLabel);
  const shortPct = Math.round(esc.shortEntryRatio * 100);
  const notePattern = buildNotePattern(esc.reasons, esc.avgEntryChars);
  const goldExample = buildGoldExample(esc.reasons);
  const topGap = esc.topGaps[0] || esc.reasons[0] || 'documentation detail';

  const fileNote = [
    `─────────────────────────`,
    `FILE NOTE: ${esc.carer} · ${houseLabel} · Tier ${esc.tier}`,
    `Quality: ${esc.qualityScore}/100 · ${esc.entryCount} entries · ${shortPct}% short · avg ${esc.avgEntryChars} chars`,
    ...esc.reasons.map(r => `  · ${r}`),
  ];

  let lines: string[];

  if (variant === 'message') {
    // Direct message — suitable for CarePlanner Chat, SMS or internal messenger
    lines = [
      `Hi ${firstName},`,
      ``,
      `Quick note on your recent documentation — your quality score is currently at ${esc.qualityScore}/100 and ${shortPct}% of entries are too brief.`,
      ``,
      `The main gap is: ${topGap}.`,
      ``,
      `Your entries are showing ${notePattern}. This doesn't cover you during a CQC review.`,
      ``,
      `Next entry standard expected:`,
      `${goldExample}`,
      ``,
      `Please adopt this going forward. I'll review your next shift notes.`,
      ``,
      `— ${ORG_CONFIG.name} Operations`,
    ];
  } else if (variant === 'email') {
    // Formal email — professional, structured, paper-trail ready
    lines = [
      `To: ${firstName} [Insert email]`,
      `Subject: Documentation Standards Review — Action Required`,
      ``,
      `Dear ${firstName},`,
      ``,
      `I am writing following a review of your care diary entries ${locationRef} for the current period.`,
      ``,
      `While I have no concern regarding the quality of care you are delivering, your written documentation is currently not meeting the clinical standard required by ${ORG_CONFIG.name} and expected under CQC inspection.`,
      ``,
      `REVIEW SUMMARY`,
      `──────────────────────────────`,
      `Quality Score:       ${esc.qualityScore} / 100`,
      `Total Entries:       ${esc.entryCount}`,
      `Short Note Ratio:    ${shortPct}%`,
      `Priority Gap:        ${topGap}`,
      ``,
      `WHAT HAS BEEN OBSERVED`,
      `──────────────────────────────`,
      `Your notes are currently presenting as ${notePattern}. Written records of this standard do not adequately evidence the care delivered and do not protect you, the client, or the service in the event of an audit or complaint.`,
      ``,
      `REQUIRED STANDARD`,
      `──────────────────────────────`,
      `All entries must be written in the first person, reflect individual client presentation, and show the decision-making behind the care delivered. Below is an example of a gold standard entry based on your current caseload:`,
      ``,
      `"${goldExample}"`,
      ``,
      `ACTION REQUIRED`,
      `──────────────────────────────`,
      `Please ensure your next and all subsequent diary entries meet this standard. This email constitutes a formal coaching contact and will be retained on your supervision record.`,
      ``,
      `If you have any questions or require support with documentation, please speak with your line manager at your next shift or contact the operations team directly.`,
      ``,
      `Yours sincerely,`,
      ``,
      `${ORG_CONFIG.name} Operations`,
    ];
  } else if (variant === 'urgent') {
    lines = [
      `You: "Hi ${firstName}, it's [Your Name] from ${ORG_CONFIG.name} management. Have you got two minutes — it's important."`,
      ``,
      `(Pause for response)`,
      ``,
      `You: "I'm calling about your documentation. I've been through your entries ${locationRef} and I need to speak with you about this today — it can't wait."`,
      ``,
      `"You've put in ${esc.entryCount} entries this period. ${shortPct}% of them are not meeting our required documentation standard — they're coming in as single lines without the detail we need."`,
      ``,
      `"What I'm seeing is ${notePattern}."`,
      ``,
      `"This is a Tier 3 concern. That means under our documentation policy, we need to see a clear change starting from your very next shift — not gradually, from the next entry you write."`,
      ``,
      `(Brief pause)`,
      ``,
      `"Here is what an acceptable entry looks like: ${goldExample}"`,
      ``,
      `"Do you understand what's being asked of you?"`,
      ``,
      `(Pause for response)`,
      ``,
      `"I'm logging this call as a formal coaching contact. You'll receive written guidance before your next shift. If the pattern continues after two shifts, this goes to a formal HR process."`,
      ``,
      `"I want to be absolutely clear — it's not your care we're questioning. It's the written record. Any questions?"`,
      ``,
      `(Pause for response)`,
      ``,
      `You: "I'll confirm this in writing. Check your messages before you next go on shift."`,
      ``,
      `(End call)`,
      ``,
      ...fileNote,
    ];
  } else if (variant === 'support-first') {
    lines = [
      `You: "Hi ${firstName}, it's [Your Name] from ${ORG_CONFIG.name} — have you got a couple of minutes?"`,
      ``,
      `(Pause for response)`,
      ``,
      `You: "I've been going through this week's diary entries ${locationRef} and I wanted to check in with you — not a problem, just a conversation. How are you finding things on shift at the moment? Anything making the job harder than it should be?"`,
      ``,
      `(Pause — listen carefully. Note any barriers: time, app issues, workload, confidence)`,
      ``,
      `You: "That's really useful — I ask because what I'm seeing in your notes is ${notePattern}. And I don't think that's the care you're actually delivering. I think something's getting in the way of it landing on paper."`,
      ``,
      `"You've got ${esc.entryCount} entries in ${locationRef} — the activity is there. But ${shortPct}% of them are single-liners and the main thing missing from the written record is ${topGap}."`,
      ``,
      `(Brief pause)`,
      ``,
      `"What I want to see instead is something like this: ${goldExample}"`,
      ``,
      `"Can you see how that tells the full story — even if the actual care was identical?"`,
      ``,
      `(Pause for response)`,
      ``,
      `"And it protects you. If anything ever gets reviewed — by CQC, by a family member — that's what shows you were making active professional decisions."`,
      ``,
      `"I'm going to send you a before-and-after based on one of your recent entries. No pressure, just a reference point. And if any of those barriers you mentioned are something I can actually fix — time, the app, anything — come and find me at handover."`,
      ``,
      `You: "Have a good shift, ${firstName}."`,
      ``,
      `(End call)`,
      ``,
      ...fileNote,
    ];
  } else {
    // coaching — warm, direct, data-backed
    lines = [
      `You: "Hi ${firstName}, it's [Your Name] from ${ORG_CONFIG.name} — have you got two minutes?"`,
      ``,
      `(Pause for response)`,
      ``,
      `You: "I've been going through this week's diary entries ${locationRef} and I want to give you some quick feedback on documentation."`,
      ``,
      `"First thing — the care you're delivering isn't the issue here. What I'm looking at is how it's being recorded."`,
      ``,
      `"You've got ${esc.entryCount} entries in ${locationRef} — the activity is there. But ${shortPct}% of them are coming in as single-liners, and the main thing I can't see from the written record is ${topGap}."`,
      ``,
      `(Brief pause)`,
      ``,
      `"What the entries currently look like is ${notePattern}."`,
      ``,
      `"What we need instead — and this is what a CQC-ready entry looks like — is something like: ${goldExample}"`,
      ``,
      `"Do you see the difference? Same care — but the second version shows your decision-making, not just that the task happened."`,
      ``,
      `(Pause for response)`,
      ``,
      `You: "Exactly. And it protects you as much as it protects us — if anything ever gets queried, that first-person detail is your evidence."`,
      ``,
      `"I'm going to send you a comparison of one of your actual entries alongside a gold standard version so you've got something to use as a template. Keep an eye out for that."`,
      ``,
      `"Anything on shift making it difficult to write in more detail — time pressure, the mobile app?"`,
      ``,
      `(Pause for response)`,
      ``,
      `You: "Good to know. Any questions catch me at handover. Have a good one, ${firstName}."`,
      ``,
      `(End call)`,
      ``,
      ...fileNote,
    ];
  }

  const channelLabel = variant === 'message' ? 'Message' : variant === 'email' ? 'Email' : 'Call Script';
  return {
    title: `${channelLabel} — ${esc.carer} · Q:${esc.qualityScore} · T${esc.tier}`,
    lines,
  };
}
