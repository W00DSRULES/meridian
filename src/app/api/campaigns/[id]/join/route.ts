import { boardError, boardJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { joinCampaign, requireCampaignId } from "@/lib/db";

type IdContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: IdContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const result = await joinCampaign(user.id, requireCampaignId(id));
    return boardJson({ ...result, campaignId: id });
  } catch (error) {
    return boardError(error);
  }
}
