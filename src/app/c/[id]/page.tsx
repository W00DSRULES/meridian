import { Board } from "@/components/board/board";

export const instant = false;

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Board campaignId={id} />;
}
