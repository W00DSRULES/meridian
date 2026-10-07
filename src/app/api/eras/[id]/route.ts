import { boardError, boardJson, campaignOf, readJson } from "@/lib/api";
import { updateEra } from "@/lib/db";

type IdContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: IdContext) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    return boardJson(await updateEra(campaignOf(request), id, body));
  } catch (error) {
    return boardError(error);
  }
}
