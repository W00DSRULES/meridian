import { boardError, boardJson, readJson } from "@/lib/api";
import { updateEra } from "@/lib/db";

type IdContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: IdContext) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    return boardJson(updateEra(id, body));
  } catch (error) {
    return boardError(error);
  }
}
