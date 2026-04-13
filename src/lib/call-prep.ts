import type { EscalationItem } from './staff-monitoring';
import { ORG_CONFIG } from './config';

export type CallPrepVariant = 'coaching' | 'urgent' | 'support-first' | 'message';

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
    // Sharp, professional message for WhatsApp / CarePlanner Chat
    lines = [
      `Subject: URGENT: Documentation Standards - Feedback for ${firstName}`,
      ``,
      `Hi ${firstName},`,
      ``,
      `I have been reviewing the diary entries ${locationRef}. While the care you are delivering looks good, your documentation is currently not meeting the ${ORG_CONFIG.name} clinical standard.`,
      ``,
      `DATA SUMMARY:`,
      `• Quality Score: ${esc.qualityScore}/100`,
      `• Short Note Ratio: ${shortPct}%`,
      `• Priority Gap: ${topGap}`,
      ``,
      `THE CONCERN:`,
      `Your notes are currently showing ${notePattern}. These one-liners do not protect you or the service during a CQC inspection.`,
      ``,
      `REQUIRED STANDARD:`,
      `We need first-person, descriptive notes that show your decision-making.`,
      ``,
      `EXAMPLE OF GOLD STANDARD:`,
      `${goldExample}`,
      ``,
      `Please ensure your very next entry follows this format. I will be checking the dashboard in one hour for an update.`,
      ``,
      `Regards,`,
      `Operations Team`,
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

  return {
    title: `${variant === 'message' ? 'Message' : 'Call'} prep — ${esc.carer} · Q:${esc.qualityScore} · T${esc.tier}`,
    lines,
  };
}
