import { boardError, boardJson, readJson } from "@/lib/api";
import { updateEra } from "@/lib/db";
import { guardCampaign } from "@/lib/guard";

type IdContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: IdContext) {
  try {
    const { campaignId } = await guardCampaign(request);
    const { id } = await context.params;
    const body = await readJson(request);
    return boardJson(await updateEra(campaignId, id, body));
  } catch (error) {
    return boardError(error);
  }
}
