// Assume resend is installed. If not, mock the logic.
// import { Resend } from 'resend';
// const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInviteEmail(to: string, name: string, tempPassword?: string) {
  console.log(`[Email Mock] Sending invite email to ${to}`);
  return { id: 'mock-id' };
}

export async function sendAccessRequestEmail(to: string[], trainerName: string, contestTitle: string, requestId: string) {
  console.log(`[Email Mock] Sending access request email to ${to.join(', ')} for contest ${contestTitle}`);
  return { id: 'mock-id' };
}

export async function sendAccessDecisionEmail(to: string, decision: 'approved' | 'denied', contestTitle: string) {
  console.log(`[Email Mock] Sending access decision email to ${to}. Decision: ${decision}`);
  return { id: 'mock-id' };
}
