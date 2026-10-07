import { boardError, boardJson } from "@/lib/api";
import { deleteEdge } from "@/lib/db";

type IdContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: IdContext) {
  try {
    const { id } = await context.params;
    return boardJson(deleteEdge(id));
  } catch (error) {
    return boardError(error);
  }
}
