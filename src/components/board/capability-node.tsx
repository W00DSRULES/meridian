"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { GlyphMark } from "@/components/board/glyphs";
import { COMMITMENT_META, milestoneCounts } from "@/lib/board-model";
import type { Commitment, Glyph, Milestone, Proficiency } from "@/lib/types";

export type CapabilityData = {
  title: string;
  description: string;
  detail: string;
  glyph: Glyph;
  proficiency: Proficiency;
  commitment: Commitment;
  author: string;
  milestones: Milestone[];
};

export type CapabilityFlowNode = Node<CapabilityData, "capability">;

export function CapabilityNode({ data, selected }: NodeProps<CapabilityFlowNode>) {
  const { done, total } = milestoneCounts(data.milestones);
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  const commitment = COMMITMENT_META[data.commitment];

  return (
    <article
      data-testid="capability-node"
      data-proficiency={data.proficiency}
      data-selected={selected ? "true" : "false"}
      data-commitment={data.commitment}
      className="tech-card"
      aria-label={`${data.title}, ${done} of ${total} milestones`}
    >
      <div className="tech-card-frame">
        <div className="tech-medallion">
          <GlyphMark glyph={data.glyph} />
        </div>
        {data.commitment === "not_doing" ? null : (
          <span className={`tech-mark tech-mark-${data.commitment}`} aria-label={commitment.label} />
        )}
        <h3 className="tech-title">{data.title}</h3>
        {data.description ? <p className="tech-subtitle">{data.description}</p> : <p className="tech-subtitle tech-subtitle-empty"> </p>}
        <div className="tech-progress">
          <span className="tech-fraction">
            {done}/{total}
          </span>
          <span className="tech-bar" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </span>
        </div>
        <ul className="tech-pips" aria-hidden="true">
          {data.milestones.map((milestone) => (
            <li key={milestone.id} data-done={milestone.done ? "true" : "false"} />
          ))}
        </ul>
      </div>
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        title="Drop a prerequisite here"
        className="meridian-handle"
      />
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        title="Drag to what this leads to"
        className="meridian-handle"
      />
    </article>
  );
}
