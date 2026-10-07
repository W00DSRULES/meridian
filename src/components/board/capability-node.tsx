"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useBoardChrome } from "@/components/board/board-chrome";
import { GlyphMark } from "@/components/board/glyphs";
import { COMMITMENT_META, milestoneCounts, researchState } from "@/lib/board-model";
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

const STATE_LABEL = {
  waiting: "Waiting",
  progress: "In progress",
  researched: "Researched",
} as const;

export function CapabilityNode({ id, data, selected }: NodeProps<CapabilityFlowNode>) {
  const chrome = useBoardChrome();
  const { done, total } = milestoneCounts(data.milestones);
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  const state = researchState(data.milestones);
  const commitment = COMMITMENT_META[data.commitment];
  const awaiting = chrome.awaitingIds.has(id);
  const linkRole = chrome.linkingFromId === id ? "source" : chrome.linkingFromId ? "target" : "idle";

  return (
    <article
      data-testid="capability-node"
      data-proficiency={data.proficiency}
      data-selected={selected ? "true" : "false"}
      data-commitment={data.commitment}
      data-research={state}
      data-awaiting={awaiting ? "true" : "false"}
      data-linking={linkRole}
      data-flash={chrome.flashId === id ? "true" : "false"}
      className="tech-card"
      aria-label={`${data.title}, ${done} of ${total} milestones, ${STATE_LABEL[state]}`}
    >
      <div className="tech-card-frame">
        <div className="tech-medallion">
          <GlyphMark glyph={data.glyph} />
        </div>
        {state === "researched" ? (
          <span className="tech-seal" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="18" height="18">
              <circle cx="16" cy="16" r="11" />
              <path d="m11 16.5 3.2 3.2 7-7.4" />
            </svg>
          </span>
        ) : null}
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
        <div className="tech-status-row">
          <span className="tech-state" data-testid="research-state">
            {STATE_LABEL[state]}
          </span>
          {awaiting ? <span className="tech-awaiting">Awaiting</span> : null}
        </div>
        <button
          type="button"
          data-link-action
          data-testid="link-action"
          className="nodrag nopan tech-link"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            chrome.startLink(id);
          }}
        >
          {linkRole === "source" ? "Cancel link" : "Link"}
        </button>
      </div>
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        title="Drop a prerequisite here"
        className="meridian-handle meridian-handle-in"
      >
        <span>In</span>
      </Handle>
      <Handle
        id="out"
        type="source"
        position={Position.Right}
        title="Drag to what this leads to"
        className="meridian-handle meridian-handle-out"
      >
        <span>Drag</span>
      </Handle>
    </article>
  );
}
