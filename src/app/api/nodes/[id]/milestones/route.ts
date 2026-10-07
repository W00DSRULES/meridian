import { boardError, boardJson, campaignOf, readJson } from "@/lib/api";
import { createMilestone } from "@/lib/db";

type IdContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: IdContext) {
  try {
    const { id } = await context.params;
    const body = await readJson(request);
    return boardJson(await createMilestone(campaignOf(request), id, body), 201);
  } catch (error) {
    return boardError(error);
  }
}
