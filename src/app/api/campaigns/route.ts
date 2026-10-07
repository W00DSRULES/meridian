import { boardError, boardJson, readJson } from "@/lib/api";
import { createCampaign, listCampaigns } from "@/lib/db";

export async function GET() {
  try {
    return boardJson({ campaigns: await listCampaigns() });
  } catch (error) {
    return boardError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    return boardJson(await createCampaign(body), 201);
  } catch (error) {
    return boardError(error);
  }
}
