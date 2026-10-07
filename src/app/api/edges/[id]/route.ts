import { boardError, boardJson } from "@/lib/api";
import { deleteEdge } from "@/lib/db";
import { guardCampaign } from "@/lib/guard";

type IdContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: IdContext) {
  try {
    const { campaignId } = await guardCampaign(request);
    const { id } = await context.params;
    return boardJson(await deleteEdge(campaignId, id));
  } catch (error) {
    return boardError(error);
  }
}
