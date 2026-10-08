import { boardError } from "@/lib/api";
import { readBoard } from "@/lib/db";
import { guardCampaign } from "@/lib/guard";
import { portableFileName, renderPortableHtml, toPortableCampaign } from "@/lib/portable-html";

export async function GET(request: Request) {
  try {
    const { campaignId } = await guardCampaign(request);
    const portable = toPortableCampaign(await readBoard(campaignId));
    const filename = portableFileName(portable.name);
    return new Response(renderPortableHtml(portable), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return boardError(error);
  }
}
