"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { COMMITMENT_META, PROFICIENCY_META } from "@/lib/board-model";
import type { Commitment, Proficiency } from "@/lib/types";

export type CapabilityData = {
  title: string;
  description: string;
  proficiency: Proficiency;
  commitment: Commitment;
  author: string;
};

export type CapabilityFlowNode = Node<CapabilityData, "capability">;

function commitmentClass(commitment: Commitment): string {
  if (commitment === "doing") {
    return "rounded-full bg-[#e0c088] px-2 py-0.5 text-[10px] font-semibold text-[#2a2112]";
  }
  if (commitment === "next") {
    return "rounded-full border border-dashed border-[#e0c088] px-2 py-0.5 text-[10px] font-semibold text-[#e0c088]";
  }
  return "rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-[#9aa6b2]";
}

export function CapabilityNode({ data, selected }: NodeProps<CapabilityFlowNode>) {
  const proficiency = PROFICIENCY_META[data.proficiency];
  const commitment = COMMITMENT_META[data.commitment];

  return (
    <article
      data-testid="capability-node"
      className={`relative w-[248px] rounded-xl border bg-[#17202a] shadow-[0_18px_40px_rgba(0,0,0,0.38)] ${
        selected ? "border-[#e0c088] ring-2 ring-[#e0c088]/80" : "border-[#e0c088]/20"
      }`}
    >
      <span
        className="absolute inset-y-3 left-0 w-1 rounded-full"
        style={{ background: proficiency.stripe }}
      />
      <div className="px-3.5 pt-3 pb-2.5">
        <p
          className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.16em] uppercase"
          style={{ color: proficiency.ink }}
        >
          <span className="size-1.5 rounded-full" style={{ background: proficiency.stripe }} />
          {proficiency.label}
        </p>
        <h3 className="font-display mt-1 text-[15px] leading-snug break-words text-[#f4efe6]">
          {data.title}
        </h3>
        {data.description ? (
          <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-[#a7b1bd]">
            {data.description}
          </p>
        ) : null}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className={commitmentClass(data.commitment)}>{commitment.label}</span>
          <span className="max-w-[7.5rem] truncate text-[11px] text-[#8b97a6]">{data.author}</span>
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        title="Drop a prerequisite here"
        className="meridian-handle"
      />
      <Handle
        type="source"
        position={Position.Right}
        title="Drag to what this leads to"
        className="meridian-handle"
      />
    </article>
  );
}
