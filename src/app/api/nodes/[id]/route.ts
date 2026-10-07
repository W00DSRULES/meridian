import { boardError, boardJson, readJson } from "@/lib/api";
import { deleteNode, updateNode } from "@/lib/db";

type IdContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: IdContext) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    return boardJson(updateNode(id, body));
  } catch (error) {
    return boardError(error);
  }
}

export async function DELETE(_request: Request, context: IdContext) {
  try {
    const { id } = await context.params;
    return boardJson(deleteNode(id));
  } catch (error) {
    return boardError(error);
  }
}
