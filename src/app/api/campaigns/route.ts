import { boardError, boardJson, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createCampaign, listMemberCampaigns } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireUser();
    return boardJson({ campaigns: await listMemberCampaigns(user.id) });
  } catch (error) {
    return boardError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    return boardJson(await createCampaign(body, user.id), 201);
  } catch (error) {
    return boardError(error);
  }
}
