import { boardError, boardJson, readJson } from "@/lib/api";
import { assertCardFresh, deleteMilestone, updateMilestone } from "@/lib/db";
import { guardCampaign } from "@/lib/guard";

type IdContext = { params: Promise<{ id: string; milestoneId: string }> };

export async function PATCH(request: Request, context: IdContext) {
  try {
    const { campaignId } = await guardCampaign(request);
    const { id, milestoneId } = await context.params;
    const body = await readJson(request);
    await assertCardFresh(campaignId, id, body);
    return boardJson(await updateMilestone(campaignId, id, milestoneId, body));
  } catch (error) {
    return boardError(error);
  }
}

export async function DELETE(request: Request, context: IdContext) {
  try {
    const { campaignId } = await guardCampaign(request);
    const { id, milestoneId } = await context.params;
    const body = await readJson(request);
    await assertCardFresh(campaignId, id, body);
    return boardJson(await deleteMilestone(campaignId, id, milestoneId, body));
  } catch (error) {
    return boardError(error);
  }
}
