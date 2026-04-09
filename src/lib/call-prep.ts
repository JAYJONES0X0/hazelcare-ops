import type { EscalationItem } from './staff-monitoring';

export type CallPrepVariant = 'coaching' | 'urgent' | 'support-first';

export interface CallPrepScript {
  title: string;
  lines: string[];
}

function buildNotePattern(reasons: string[]): string {
  const mainReason = reasons[0] || '';
  const low = mainReason.toLowerCase();
  if (low.includes('short') || low.includes('length') || low.includes('brief')) {
    return '"Prompted but refused" or "Staff supported with personal care" — very brief, no context';
  }
  if (low.includes('first') || low.includes('person')) {
    return '"Staff supported…" or "Carer prompted…" — written about you, not by you';
  }
  return '"Care provided" or similar — not enough detail for another professional to follow';
}

function buildGoldExample(reasons: string[]): string {
  const mainReason = reasons[0] || '';
  const low = mainReason.toLowerCase();
  if (low.includes('short') || low.includes('length') || low.includes('brief') || low.includes('first') || low.includes('person')) {
    return '"I prompted James, but he declined, stating he would do it later. I respected his choice and monitored from a distance to avoid escalation — he self-settled within 20 minutes."';
  }
  return '"I administered medication as prescribed. Client was calm and cooperative. I observed no adverse reactions and noted mood as settled throughout."';
}

function buildWhatsMissing(reasons: string[]): string {
  // Personalise using top gaps from reasons array
  const topGaps = reasons.slice(0, 2);
  if (topGaps.length === 0) return 'documentation quality';
  return topGaps.join(' and ').toLowerCase();
}

export function buildCallPrepScript(
  esc: EscalationItem,
  houseLabel: string,
  variant: CallPrepVariant = 'coaching',
): CallPrepScript {
  const firstName = esc.carer.split(' ')[0] || esc.carer;
  const notePattern = buildNotePattern(esc.reasons);
  const goldExample = buildGoldExample(esc.reasons);
  const whatsMissing = buildWhatsMissing(esc.reasons);
  const fileNote = [
    `─────────────────────────`,
    `FILE NOTE: ${esc.carer} · ${houseLabel} · Tier ${esc.tier}`,
    esc.reasons.map(r => `  · ${r}`).join('\n'),
  ];

  let lines: string[];

  if (variant === 'urgent') {
    // Direct, formal — Tier 3 tone
    lines = [
      `You: "Good [morning/afternoon], ${firstName}. This is [Your Name] calling from Hazel Care management. Is now an acceptable time to speak for a few minutes?"`,
      ``,
      `(Pause for response)`,
      ``,
      `You: "Thank you. I'm calling regarding a Tier 3 documentation concern on your account for ${houseLabel}. I need to speak with you about this today."`,
      ``,
      `(Brief pause)`,
      ``,
      `You: "We have identified a pattern in your care entries specifically around ${whatsMissing}. This is not a minor administrative issue — documentation at this level is a professional and legal requirement under our CQC registration."`,
      ``,
      `"The current pattern looks like this: ${notePattern}."`,
      ``,
      `"This is a Tier 3 escalation. That means we need to see a demonstrable change starting from your next shift — not next week, today."`,
      ``,
      `(Brief pause)`,
      ``,
      `"What we require going forward is contemporaneous, first-person documentation that is specific and attributable. For example: ${goldExample}"`,
      ``,
      `"Do you understand what is being asked of you and why this is urgent?"`,
      ``,
      `(Pause for response)`,
      ``,
      `You: "I'm logging this conversation as a formal coaching contact. You will receive written guidance to your staff email within the hour. If the pattern continues beyond two shifts, this moves to a formal HR process."`,
      ``,
      `"I want to be clear — the quality of your actual care is not in question. This is about the written record. Do you have any questions about what is required?"`,
      ``,
      `(Pause for response)`,
      ``,
      `You: "Thank you, ${firstName}. I'll confirm this conversation in writing. Please check your email before your next shift."`,
      ``,
      `(Click)`,
      ``,
      ...fileNote,
    ];
  } else if (variant === 'support-first') {
    // Curious before challenging — explore barriers first
    lines = [
      `You: "Hi ${firstName}, it's [Your Name] from Hazel Care. How are you getting on generally at the moment?"`,
      ``,
      `(Pause — listen actively)`,
      ``,
      `You: "Glad to hear it. I wanted to have a quick chat — nothing to worry about — just checking in on how things feel on shift. Is now a good two minutes?"`,
      ``,
      `(Pause for response)`,
      ``,
      `You: "So I'm looking at diary entries across the houses and I noticed some patterns with your notes for ${houseLabel}. Before I say anything about what I'm seeing — how are you finding the documentation side of things? Any barriers there — time pressure, the app, anything like that?"`,
      ``,
      `(Pause — listen carefully, note any barriers mentioned)`,
      ``,
      `You: "That's really useful to know. I ask because what I'm seeing in the entries is ${whatsMissing} — things like: ${notePattern}."`,
      ``,
      `"I don't think that reflects what you're actually doing on shift. I think you're doing good work and it's just not coming through in the notes yet."`,
      ``,
      `(Brief pause)`,
      ``,
      `You: "What I'd love to see instead is something like: ${goldExample}"`,
      ``,
      `"Can you see how that version tells a fuller story — even if the actual care was identical?"`,
      ``,
      `(Pause for response)`,
      ``,
      `You: "Exactly. And it protects you too — if anything ever gets reviewed, that first-person detail is what shows you were making active professional decisions."`,
      ``,
      `"I'm going to send you a before-and-after example based on one of your recent entries. No pressure — just a reference point. Is that okay?"`,
      ``,
      `(Pause for response)`,
      ``,
      `You: "Brilliant. And if any of those barriers we talked about are something I can help with — time, the app, anything — come and grab me at handover. This isn't about catching anyone out, it's about making sure your work is visible."`,
      ``,
      `"Have a good shift, ${firstName}."`,
      ``,
      `(Click)`,
      ``,
      ...fileNote,
    ];
  } else {
    // coaching (default) — warm, developmental
    lines = [
      `You: "Hi ${firstName}, it's [Your Name] from Hazel Care. How are you doing today?"`,
      ``,
      `(Pause for response)`,
      ``,
      `You: "Glad to hear it. I'm giving a quick call about documentation — is now still okay for two minutes?"`,
      ``,
      `(Pause for response)`,
      ``,
      `You: "Perfect. So we're reviewing diary entries across all the houses, and I wanted to speak to you specifically about your notes for ${houseLabel}."`,
      ``,
      `"First — I want to be clear — the actual care you're providing looks solid. No concerns there at all. What we're working on is how we document it."`,
      ``,
      `(Brief pause)`,
      ``,
      `You: "Right now, your entries are coming through like this: ${notePattern}."`,
      ``,
      `"The specific areas we'd like to see improve are: ${whatsMissing}."`,
      ``,
      `"What we need moving forward are notes that are contemporaneous, specific, and attributable — enough detail that another professional could read it and picture exactly what happened, and what you did next."`,
      ``,
      `"So instead of third-person or one-liners, we want your voice. Something like: ${goldExample}"`,
      ``,
      `"Do you see how that shows the actual decision-making behind the support you gave?"`,
      ``,
      `(Pause for response)`,
      ``,
      `You: "Exactly. It protects you legally, and it shows the high level of active care you're already providing — rather than it reading like a checklist."`,
      ``,
      `"We're flagging this now so we can get ahead of it before it becomes a formal concern — let's get your paperwork to match the care you're delivering."`,
      ``,
      `"Is there anything on shift that's making it hard to write with more detail — time pressure, the mobile app, anything like that?"`,
      ``,
      `(Pause for response)`,
      ``,
      `You: "Good to know. I'm going to send you over a Gold Standard version of one of your recent entries so you can see the before-and-after and use it as a template for your next shift. Keep an eye out for that message."`,
      ``,
      `"Keep up the good work with the actual care — let's just get the paperwork to match it. Any questions at all, catch me at handover. Have a great rest of your shift, ${firstName}."`,
      ``,
      `(Click)`,
      ``,
      ...fileNote,
    ];
  }

  return {
    title: `Call prep — ${esc.carer} [${variant}]`,
    lines,
  };
}
