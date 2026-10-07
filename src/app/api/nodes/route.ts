import { boardError, boardJson, readJson } from "@/lib/api";
import { createNode, requireClientRevision } from "@/lib/db";
import { guardCampaign } from "@/lib/guard";

export async function POST(request: Request) {
  try {
    const { campaignId } = await guardCampaign(request);
    const body = await readJson(request);
    requireClientRevision(body);
    return boardJson(await createNode(campaignId, body), 201);
  } catch (error) {
    return boardError(error);
  }
}
