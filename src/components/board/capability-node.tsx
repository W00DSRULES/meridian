"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useBoardChrome } from "@/components/board/board-chrome";
import { GlyphMark } from "@/components/board/glyphs";
import { COMMITMENT_META, milestoneCounts, progressPaint } from "@/lib/board-model";
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

export function CapabilityNode({ id, data, selected }: NodeProps<CapabilityFlowNode>) {
  const chrome = useBoardChrome();
  const { done, total } = milestoneCounts(data.milestones);
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  const paint = progressPaint(done, total);
  const commitment = COMMITMENT_META[data.commitment];
  const awaiting = chrome.awaitingIds.has(id);

  return (
    <article
      data-testid="capability-node"
      data-selected={selected ? "true" : "false"}
      data-commitment={data.commitment}
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
        {data.description ? (
          <p className="tech-subtitle">{data.description}</p>
        ) : (
          <p className="tech-subtitle tech-subtitle-empty"> </p>
        )}
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
      <Handle id="in" type="target" position={Position.Left} className="meridian-handle" />
      <Handle id="out" type="source" position={Position.Right} className="meridian-handle" />
    </article>
  );
}
