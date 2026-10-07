import { NextResponse } from "next/server";
import { BoardRequestError, requireCampaignId } from "@/lib/db";

const NO_STORE = { "Cache-Control": "no-store" };

export function boardJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function boardError(error: unknown) {
  if (error instanceof BoardRequestError) {
    return boardJson({ error: error.message }, error.status);
  }
  console.error(error);
  return boardJson({ error: "The board couldn't save that change." }, 500);
}

export function campaignOf(request: Request): string {
  return requireCampaignId(new URL(request.url).searchParams.get("campaign"));
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new BoardRequestError(400, "That request wasn't valid JSON.");
  }
}
