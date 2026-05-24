import { loadClients, type FullClient } from './client-store';

/**
 * Stress Test Script for CareOps Task Pack Generator.
 * Generates 1,000 synthetic tasks across all domains to verify UI performance 
 * and DOCX export reliability under high load.
 */
export async function runTaskStressTest() {
  console.log('🚀 INITIALIZING CAREOPS STRESS TEST: 1,000 TASKS');
  const start = performance.now();
  
  const clients = loadClients();
  if (clients.length === 0) {
    throw new Error('No clients found in store. Please create a dummy client first.');
  }
  
  const target = clients[0];
  console.log(`Targeting client: ${target.name}`);

  // Create a massive care plan with 50 unique domains, each with heavy content
  const domains = [];
  const domainTitles = [
    'Medication Management & Safety', 'Mental Health & Emotional Wellbeing', 
    'Personal Care & Physical Presentation', 'Continence & Personal Hygiene',
    'Nutrition, Hydration & Diet', 'Life Skills & Daily Routine',
    'Social Engagement & Relationships', 'Mobility, Movement & Exercise',
    'Pain Management & Comfort', 'Rest & Sleep Patterns',
    'Infection Control & Public Health', 'Communication & Sensory Integration',
    'Environment & Physical Safety', 'Adaptive Living Environment',
    'Skin Integrity & Pressure Care', 'Financial Management & Autonomy',
    'Rights, Choice & Inclusion', 'Holistic Health & Vitality',
    'Respiratory Health & Support', 'Cultural, Spiritual & Personal Beliefs'
  ];

  for (let i = 0; i < 1000; i++) {
    const baseTitle = domainTitles[i % domainTitles.length];
    domains.push({
      id: `stress-${i}`,
      title: `${baseTitle} (Iteration ${i})`,
      enabled: true,
      identifiedNeed: `STRESS TEST NEED ${i}: This is a high-volume data injection to verify clinical instruction preservation. Matthew requires support with ${baseTitle} to ensure safety and well-being. Detailed evidence follows: ${'X'.repeat(500)}`,
      howToAchieve: `STRESS TEST METHOD ${i}: Staff must follow the premium protocol for ${baseTitle}. This involves complex steps and detailed recording in Nourish. Full clinical length is mandatory. ${'Y'.repeat(500)}`,
      riskTitle: `STRESS TEST RISK ${i}: Potential failure in ${baseTitle} reporting.`,
      riskMitigation: `STRESS TEST MITIGATION ${i}: Monitor closely and escalate if any deviations are noted. ${'Z'.repeat(500)}`,
      plannedOutcomes: `Outcome ${i}: Success for client.`
    });
  }

  const stressClient: FullClient = {
    ...target,
    id: 'STRESS-TEST-1000',
    name: 'STRESS TEST MATTHEW',
    carePlan: {
      ...target.carePlan!,
      domains: domains as any
    }
  };

  const end = performance.now();
  console.log(`✅ SYNTHETIC DATA READY: 1,000 domains injected in ${(end - start).toFixed(2)}ms`);
  
  return stressClient;
}
