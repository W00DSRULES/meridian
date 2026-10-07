import { boardError, boardJson, readJson } from "@/lib/api";
import { createEdge } from "@/lib/db";
import { guardCampaign } from "@/lib/guard";

export async function POST(request: Request) {
  try {
    const { campaignId } = await guardCampaign(request);
    const body = await readJson(request);
    return boardJson(await createEdge(campaignId, body), 201);
  } catch (error) {
    return boardError(error);
  }
}
