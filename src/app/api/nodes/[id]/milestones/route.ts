import { boardError, boardJson, readJson } from "@/lib/api";
import { assertCardFresh, createMilestone } from "@/lib/db";
import { guardCampaign } from "@/lib/guard";

type IdContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: IdContext) {
  try {
    const { campaignId } = await guardCampaign(request);
    const { id } = await context.params;
    const body = await readJson(request);
    await assertCardFresh(campaignId, id, body);
    return boardJson(await createMilestone(campaignId, id, body), 201);
  } catch (error) {
    return boardError(error);
  }
}
