"use client";

import type { Node, NodeProps } from "@xyflow/react";

export type EraData = {
  numeral: string;
  title: string;
  blurb: string;
  hot: boolean;
};

export type EraFlowNode = Node<EraData, "era">;

export function EraBand({ data }: NodeProps<EraFlowNode>) {
  return (
    <div
      className={`h-full w-full rounded-[22px] border px-4 pt-3 ${
        data.hot
          ? "border-[#e0c088]/70 bg-[#e0c088]/12"
          : "border-[#e0c088]/18 bg-[#e0c088]/[0.04]"
      }`}
    >
      <p className="text-[10px] font-semibold tracking-[0.28em] text-[#e0c088]/85">{data.numeral}</p>
      <h2 className="font-display text-lg leading-tight text-[#f6f0e6]">{data.title}</h2>
      <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-[#93a0b0]">{data.blurb}</p>
    </div>
  );
}
