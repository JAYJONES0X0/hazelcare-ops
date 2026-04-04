import type { EscalationItem } from './staff-monitoring';

export type CallPrepVariant = 'coaching' | 'urgent' | 'support';

export interface CallPrepScript {
  title: string;
  lines: string[];
}

function variantForTier(tier: number): CallPrepVariant {
  if (tier >= 3) return 'urgent';
  return 'coaching';
}

export function buildCallPrepScript(
  esc: EscalationItem,
  houseLabel: string,
  variant: CallPrepVariant = variantForTier(esc.tier),
): CallPrepScript {
  const who = esc.carer;
  const tierLabel = esc.tier === 3 ? 'Priority' : esc.tier === 2 ? 'Urgent follow-up' : 'Coaching';

  const lines: string[] = [
    `${tierLabel} — ${houseLabel}`,
    '',
    `1. Opening: Hi ${who.split(' ')[0] || who}, it’s [your name] from Hazel Care. I’m calling about documentation for ${houseLabel}. Is now still okay for two minutes?`,
    '',
    `2. Context: We’re reviewing diary entries in our ops system. The signal for you is: ${esc.summary}`,
    '',
    `3. Standard: We need entries to be contemporaneous, specific, and attributable — enough detail that another professional could follow what happened and what you did next.`,
    '',
  ];

  if (variant === 'coaching') {
    lines.push(
      `4. Ask: Can you walk me through what happened on your last few entries? Is there anything that made it hard to write more detail (time, environment, mobile app)?`,
      '',
      `5. Support: If useful, we can use the Staff Note Assistant or handover tool — I can send a secure link after this call.`,
      '',
      `6. Close: Can you add a fuller update to today’s notes before end of shift, and flag if you need clinical or management support?`,
    );
  } else if (variant === 'urgent') {
    lines.push(
      `4. Direct: Documentation is below the threshold we need for safeguarding and CQC-evidence. This needs correcting today.`,
      '',
      `5. Support offer: Do you need protected time, supervision, or help with wording? Say yes now so we can arrange it.`,
      '',
      `6. Escalation: If we don’t see improvement by [time], this will go to the senior on call with the same evidence pack.`,
    );
  } else {
    lines.push(
      `4. Support-first: What would help you document to standard today — quieter handover, template, or paired write?`,
      '',
      `5. Commitment: What single thing will you complete before end of shift?`,
    );
  }

  lines.push(
    '',
    `7. Notes for file: Tier ${esc.tier} · ${esc.reasons.join('; ') || 'See monitoring snapshot'}`,
  );

  return {
    title: `Call script — ${who} (${houseLabel})`,
    lines,
  };
}
