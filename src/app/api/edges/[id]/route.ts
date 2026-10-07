import { boardError, boardJson, campaignOf } from "@/lib/api";
import { deleteEdge } from "@/lib/db";

type IdContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: IdContext) {
  try {
    const { id } = await context.params;
    return boardJson(await deleteEdge(campaignOf(request), id));
  } catch (error) {
    return boardError(error);
  }
}
