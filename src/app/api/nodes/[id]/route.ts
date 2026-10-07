import { boardError, boardJson, readJson } from "@/lib/api";
import { assertCardFresh, deleteNode, updateNode } from "@/lib/db";
import { guardCampaign } from "@/lib/guard";

type IdContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: IdContext) {
  try {
    const { campaignId } = await guardCampaign(request);
    const { id } = await context.params;
    const body = await readJson(request);
    await assertCardFresh(campaignId, id, body);
    return boardJson(await updateNode(campaignId, id, body));
  } catch (error) {
    return boardError(error);
  }
}

export async function DELETE(request: Request, context: IdContext) {
  try {
    const { campaignId } = await guardCampaign(request);
    const { id } = await context.params;
    const body = await readJson(request);
    await assertCardFresh(campaignId, id, body);
    return boardJson(await deleteNode(campaignId, id));
  } catch (error) {
    return boardError(error);
  }
}
