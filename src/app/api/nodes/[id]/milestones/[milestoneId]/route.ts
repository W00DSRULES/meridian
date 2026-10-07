import { boardError, boardJson, campaignOf, readJson } from "@/lib/api";
import { deleteMilestone, updateMilestone } from "@/lib/db";

type IdContext = { params: Promise<{ id: string; milestoneId: string }> };

export async function PATCH(request: Request, context: IdContext) {
  try {
    const { id, milestoneId } = await context.params;
    const body = await readJson(request);
    return boardJson(await updateMilestone(campaignOf(request), id, milestoneId, body));
  } catch (error) {
    return boardError(error);
  }
}

export async function DELETE(request: Request, context: IdContext) {
  try {
    const { id, milestoneId } = await context.params;
    const body = await readJson(request);
    return boardJson(await deleteMilestone(campaignOf(request), id, milestoneId, body));
  } catch (error) {
    return boardError(error);
  }
}
