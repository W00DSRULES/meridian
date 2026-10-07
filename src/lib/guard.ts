import { campaignOf } from "@/lib/api";
import { requireUser, type SessionUser } from "@/lib/auth";
import { assertMember } from "@/lib/db";

export async function guardCampaign(request: Request): Promise<{ user: SessionUser; campaignId: string }> {
  const user = await requireUser();
  const campaignId = campaignOf(request);
  await assertMember(user.id, campaignId);
  return { user, campaignId };
}
