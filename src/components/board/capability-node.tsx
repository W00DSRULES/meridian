"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useBoardChrome } from "@/components/board/board-chrome";
import { GlyphMark } from "@/components/board/glyphs";
import { milestoneCounts, PROFICIENCY_MARK, PROFICIENCY_META, progressPaint } from "@/lib/board-model";
import type { Commitment, Glyph, Milestone, Proficiency } from "@/lib/types";

export type CapabilityData = {
  title: string;
  description: string;
  detail: string;
  glyph: Glyph;
  proficiency: Proficiency;
  commitment: Commitment;
  eraId: string;
  author: string;
  milestones: Milestone[];
};

export type CapabilityFlowNode = Node<CapabilityData, "capability">;

export function CapabilityNode({ id, data, selected }: NodeProps<CapabilityFlowNode>) {
  const chrome = useBoardChrome();
  const { done, total } = milestoneCounts(data.milestones);
  const paint = progressPaint(done, total);
  const awaiting = chrome.awaitingIds.has(id);
  const mark = PROFICIENCY_MARK[data.proficiency];

  return (
    <article
      data-testid="capability-node"
      data-selected={selected ? "true" : "false"}
      data-progress={paint.fraction === 0 ? "none" : paint.fraction === 1 ? "done" : "partial"}
      data-awaiting={awaiting ? "true" : "false"}
      data-flash={chrome.flashId === id ? "true" : "false"}
      className="tech-card"
      style={{
        ["--frame" as string]: paint.frame,
        ["--wash" as string]: paint.wash,
        ["--glow" as string]: paint.glow,
        ["--ink" as string]: paint.ink,
      }}
      aria-label={`${data.title}, ${PROFICIENCY_META[data.proficiency].label}, ${done} of ${total} milestones`}
    >
      <div className="tech-card-frame">
        <div className="tech-medallion">
          <GlyphMark glyph={data.glyph} />
        </div>
        <h3 className="tech-title">
          <span className="tech-title-text">{data.title}</span>
          <span className="tech-proficiency" aria-hidden="true">
            {mark}
          </span>
        </h3>
        <ul className="tech-pips" aria-hidden="true">
          {data.milestones.map((milestone) => (
            <li key={milestone.id} data-done={milestone.done ? "true" : "false"} />
          ))}
        </ul>
        <span className="tech-fraction">
          {done}/{total}
        </span>
      </div>
      <Handle id="in" type="target" position={Position.Left} className="meridian-handle" />
      <Handle id="out" type="source" position={Position.Right} className="meridian-handle" />
    </article>
  );
}
