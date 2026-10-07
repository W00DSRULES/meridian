import { boardError, boardJson, campaignOf, readJson } from "@/lib/api";
import { deleteNode, updateNode } from "@/lib/db";

type IdContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: IdContext) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    return boardJson(await updateNode(campaignOf(request), id, body));
  } catch (error) {
    return boardError(error);
  }
}

export async function DELETE(request: Request, context: IdContext) {
  try {
    const { id } = await context.params;
    return boardJson(await deleteNode(campaignOf(request), id));
  } catch (error) {
    return boardError(error);
  }
}
