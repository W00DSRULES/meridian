"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { GlyphMark } from "@/components/board/glyphs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  COMMITMENT_META,
  LIMITS,
  PROFICIENCY_META,
  milestoneCounts,
  normalizeText,
  validateCapability,
  validateDetail,
  validateIdentity,
  validateMilestoneName,
} from "@/lib/board-model";
import {
  COMMITMENTS,
  PROFICIENCIES,
  type Commitment,
  type Glyph,
  type Milestone,
  type Proficiency,
} from "@/lib/types";

export type DraftMilestone = {
  id: string;
  name: string;
  done: boolean;
};

export type CapabilityDraft = {
  title: string;
  description: string;
  detail: string;
  proficiency: Proficiency;
  commitment: Commitment;
  milestones: DraftMilestone[];
};

export const EMPTY_DRAFT: CapabilityDraft = {
  title: "",
  description: "",
  detail: "",
  proficiency: "neutral",
  commitment: "next",
  milestones: [],
};

function freshMilestoneId(): string {
  return `draft-${crypto.randomUUID()}`;
}

export function NameDialog({
  open,
  required,
  initialName,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  required: boolean;
  initialName: string;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const message = validateIdentity(name);
    if (message) {
      setError(message);
      return;
    }
    onSave(normalizeText(name));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (required && !next ? undefined : onOpenChange(next))}>
      <DialogContent
        showCloseButton={!required}
        className="sm:max-w-md"
        onPointerDownOutside={(event) => {
          if (required) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (required) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {required ? "What should we call you?" : "Update your name"}
          </DialogTitle>
          <DialogDescription>
            Meridian has no accounts. This name stays in this browser and is stamped on
            capabilities you add or edit, so everyone else can see who moved the tree.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              autoFocus
              autoComplete="name"
              maxLength={LIMITS.author}
              placeholder="Priya Shah"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit">Use this name</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CapabilityDialog({
  open,
  mode,
  seed,
  glyph,
  author,
  milestones,
  saving,
  error,
  onOpenChange,
  onSubmit,
  onDelete,
  onAddMilestone,
  onToggleMilestone,
  onRenameMilestone,
  onDeleteMilestone,
  leadsTo,
  comesFrom,
  linkChoices,
  onAddLink,
  onRemoveLink,
}: {
  open: boolean;
  mode: "create" | "edit";
  seed: CapabilityDraft;
  glyph: Glyph;
  author: string;
  milestones: Milestone[];
  saving: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: CapabilityDraft) => void;
  onDelete?: () => void;
  onAddMilestone?: (name: string) => Promise<void>;
  onToggleMilestone?: (milestone: Milestone) => Promise<void>;
  onRenameMilestone?: (milestone: Milestone, name: string) => Promise<void>;
  onDeleteMilestone?: (milestone: Milestone) => Promise<void>;
  leadsTo: { id: string; title: string }[];
  comesFrom: { id: string; title: string }[];
  linkChoices: { id: string; title: string }[];
  onAddLink?: (targetId: string) => Promise<void>;
  onRemoveLink?: (edgeId: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CapabilityDraft>(seed);
  const [localError, setLocalError] = useState<string | null>(null);
  const [nextName, setNextName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [linkTarget, setLinkTarget] = useState("");

  const liveMilestones = mode === "edit" ? milestones : draft.milestones;
  const counts = milestoneCounts(liveMilestones);
  const shownError = localError ?? error;
  const chosenTarget = linkChoices.some((choice) => choice.id === linkTarget) ? linkTarget : "";

  function submit() {
    const message = validateCapability({ ...draft, author }) ?? validateDetail(draft.detail);
    if (message) {
      setLocalError(message);
      return;
    }
    const pending = mode === "create" ? draft.milestones : [];
    for (const milestone of pending) {
      const nameError = validateMilestoneName(milestone.name);
      if (nameError) {
        setLocalError(nameError);
        return;
      }
    }
    onSubmit({
      ...draft,
      title: normalizeText(draft.title),
      description: normalizeText(draft.description),
      detail: draft.detail.trim(),
      milestones: pending.map((milestone) => ({ ...milestone, name: normalizeText(milestone.name) })),
    });
  }

  async function addLink() {
    if (!chosenTarget || !onAddLink) return;
    setLocalError(null);
    setBusyId("link");
    try {
      await onAddLink(chosenTarget);
      setLinkTarget("");
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "Couldn't add that link.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeLink(edgeId: string) {
    if (!onRemoveLink) return;
    setLocalError(null);
    setBusyId(edgeId);
    try {
      await onRemoveLink(edgeId);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "Couldn't remove that link.");
    } finally {
      setBusyId(null);
    }
  }

  async function addMilestone() {
    const message = validateMilestoneName(nextName);
    if (message) {
      setLocalError(message);
      return;
    }
    const name = normalizeText(nextName);
    setLocalError(null);
    if (mode === "create") {
      setDraft((current) => ({
        ...current,
        milestones: [...current.milestones, { id: freshMilestoneId(), name, done: false }],
      }));
      setNextName("");
      return;
    }
    if (!onAddMilestone) return;
    setBusyId("add");
    try {
      await onAddMilestone(name);
      setNextName("");
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "Couldn't add that milestone.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleMilestone(milestone: Milestone | DraftMilestone) {
    setLocalError(null);
    if (mode === "create") {
      setDraft((current) => ({
        ...current,
        milestones: current.milestones.map((item) =>
          item.id === milestone.id ? { ...item, done: !item.done } : item,
        ),
      }));
      return;
    }
    if (!onToggleMilestone) return;
    setBusyId(milestone.id);
    try {
      await onToggleMilestone(milestone as Milestone);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "Couldn't update that milestone.");
    } finally {
      setBusyId(null);
    }
  }

  async function renameMilestone(milestone: Milestone | DraftMilestone, name: string) {
    const message = validateMilestoneName(name);
    if (message) {
      setLocalError(message);
      return;
    }
    const cleaned = normalizeText(name);
    if (cleaned === milestone.name) return;
    setLocalError(null);
    if (mode === "create") {
      setDraft((current) => ({
        ...current,
        milestones: current.milestones.map((item) => (item.id === milestone.id ? { ...item, name: cleaned } : item)),
      }));
      return;
    }
    if (!onRenameMilestone) return;
    setBusyId(milestone.id);
    try {
      await onRenameMilestone(milestone as Milestone, cleaned);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "Couldn't rename that milestone.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeMilestone(milestone: Milestone | DraftMilestone) {
    setLocalError(null);
    if (mode === "create") {
      setDraft((current) => ({
        ...current,
        milestones: current.milestones.filter((item) => item.id !== milestone.id),
      }));
      return;
    }
    if (!onDeleteMilestone) return;
    setBusyId(milestone.id);
    try {
      await onDeleteMilestone(milestone as Milestone);
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "Couldn't remove that milestone.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (saving ? undefined : onOpenChange(next))}>
      <DialogContent
        data-testid="tech-detail"
        className="tech-popup sm:max-w-4xl"
      >
        <DialogHeader className="tech-popup-head">
          <div className="tech-popup-medallion" data-proficiency={draft.proficiency}>
            <GlyphMark glyph={glyph} />
          </div>
          <DialogTitle className="sr-only">
            {draft.title.trim() || (mode === "create" ? "New capability" : "Capability")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Write the longer description and keep the milestone list. Saving stamps this as {author || "you"}.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="tech-popup-grid">
          <div className="grid gap-4">
          <div className="grid gap-1">
            <Label htmlFor="capability-title" className="text-[10px] tracking-[0.18em] text-[#e0c088] uppercase">
              Title
            </Label>
            <Input
              id="capability-title"
              value={draft.title}
              maxLength={LIMITS.title}
              placeholder="Discovery calls"
              className="font-display h-auto border-[#e0c088]/30 bg-[#0b1626] px-3 py-2 text-2xl text-[#f6f0e6]"
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            />
          </div>
          <div className="grid gap-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="capability-subtitle" className="text-[10px] tracking-[0.18em] text-[#e0c088] uppercase">
                Subtitle
              </Label>
              <span className="text-[11px] text-[#8ea0b5]">
                {draft.description.trim().length}/{LIMITS.description}
              </span>
            </div>
            <Input
              id="capability-subtitle"
              value={draft.description}
              maxLength={LIMITS.description}
              placeholder="The line that shows on the card"
              className="border-[#e0c088]/25 bg-[#0b1626] text-[#d5deea]"
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className="grid gap-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="capability-detail" className="text-[10px] tracking-[0.18em] text-[#e0c088] uppercase">
                Description
              </Label>
              <span className="text-[11px] text-[#8ea0b5]">
                {draft.detail.trim().length}/{LIMITS.detail}
              </span>
            </div>
            <Textarea
              id="capability-detail"
              value={draft.detail}
              maxLength={LIMITS.detail}
              rows={4}
              placeholder="The longer note the team should read before they start checking boxes."
              className="min-h-24 border-[#e0c088]/25 bg-[#0b1626] text-[#d5deea]"
              onChange={(event) => setDraft((current) => ({ ...current, detail: event.target.value }))}
            />
          </div>
          <fieldset className="grid gap-2">
            <legend className="text-[10px] font-semibold tracking-[0.18em] text-[#e0c088] uppercase">
              Proficiency
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {PROFICIENCIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={draft.proficiency === value}
                  className="tech-swatch"
                  data-selected={draft.proficiency === value ? "true" : "false"}
                  data-proficiency={value}
                  onClick={() => setDraft((current) => ({ ...current, proficiency: value }))}
                >
                  <span style={{ background: PROFICIENCY_META[value].stripe }} />
                  {PROFICIENCY_META[value].label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="text-[10px] font-semibold tracking-[0.18em] text-[#e0c088] uppercase">
              Commitment
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {COMMITMENTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={draft.commitment === value}
                  className="tech-choice"
                  data-selected={draft.commitment === value ? "true" : "false"}
                  onClick={() => setDraft((current) => ({ ...current, commitment: value }))}
                >
                  {COMMITMENT_META[value].label}
                </button>
              ))}
            </div>
          </fieldset>
          </div>

          <div className="grid gap-4">
          <section className="tech-links" data-testid="leads-to" aria-label="Leads to">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="font-display text-xl text-[#f6f0e6]">Leads to</h3>
            </div>
            {mode === "create" ? (
              <p className="text-sm text-[#9aa6b2]">
                Place this card on the tree, then open it to choose what it leads to.
              </p>
            ) : (
              <>
                {leadsTo.length === 0 ? (
                  <p className="text-sm text-[#9aa6b2]">Nothing yet. Choose the card this one leads to.</p>
                ) : (
                  <ul className="grid gap-1.5">
                    {leadsTo.map((link) => (
                      <li key={link.id} className="tech-link-row">
                        <span>{link.title}</span>
                        <button
                          type="button"
                          onClick={() => void removeLink(link.id)}
                          disabled={busyId === link.id}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex gap-2">
                  <select
                    data-testid="leads-to-picker"
                    aria-label="Choose a card this leads to"
                    value={chosenTarget}
                    onChange={(event) => setLinkTarget(event.target.value)}
                  >
                    <option value="">Choose a card</option>
                    {linkChoices.map((choice) => (
                      <option key={choice.id} value={choice.id}>
                        {choice.title}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!chosenTarget || busyId === "link"}
                    onClick={() => void addLink()}
                  >
                    Add link
                  </Button>
                </div>
              </>
            )}
          </section>

          <section className="tech-links" aria-label="Comes from">
            <h3 className="font-display mb-2 text-xl text-[#f6f0e6]">Comes from</h3>
            {mode === "create" || comesFrom.length === 0 ? (
              <p className="text-sm text-[#9aa6b2]">
                {mode === "create" ? "Incoming links show up after the card is on the tree." : "No earlier card leads here yet."}
              </p>
            ) : (
              <ul className="grid gap-1.5">
                {comesFrom.map((link) => (
                  <li key={link.id} className="tech-link-row">
                    <span>{link.title}</span>
                    <button type="button" onClick={() => void removeLink(link.id)} disabled={busyId === link.id}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="tech-milestones" aria-label="Milestones">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="font-display text-xl text-[#f6f0e6]">Milestones</h3>
              <p className="text-sm text-[#e0c088]">
                {counts.done}/{counts.total} done
              </p>
            </div>
            <ul className="grid gap-2">
              {liveMilestones.map((milestone) => (
                <li key={milestone.id} className="tech-milestone">
                  <button
                    type="button"
                    className="tech-check"
                    aria-pressed={milestone.done}
                    aria-label={milestone.done ? `Mark not done: ${milestone.name}` : `Mark done: ${milestone.name}`}
                    disabled={busyId === milestone.id}
                    onClick={() => void toggleMilestone(milestone)}
                  />
                  <input
                    value={mode === "edit" ? (nameDrafts[milestone.id] ?? milestone.name) : milestone.name}
                    maxLength={LIMITS.milestoneName}
                    aria-label={`Milestone name: ${milestone.name}`}
                    disabled={busyId === milestone.id}
                    onChange={(event) => {
                      const name = event.target.value;
                      if (mode === "create") {
                        setDraft((current) => ({
                          ...current,
                          milestones: current.milestones.map((item) =>
                            item.id === milestone.id ? { ...item, name } : item,
                          ),
                        }));
                        return;
                      }
                      setNameDrafts((current) => ({ ...current, [milestone.id]: name }));
                    }}
                    onBlur={(event) => {
                      if (mode !== "edit") return;
                      const typed = event.target.value;
                      setNameDrafts((current) => {
                        const next = { ...current };
                        delete next[milestone.id];
                        return next;
                      });
                      void renameMilestone(milestone, typed);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="tech-milestone-delete"
                    aria-label={`Delete ${milestone.name}`}
                    disabled={busyId === milestone.id}
                    onClick={() => void removeMilestone(milestone)}
                  >
                    <Trash2 />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Input
                value={nextName}
                maxLength={LIMITS.milestoneName}
                placeholder="Name the next milestone"
                aria-label="New milestone"
                className="border-[#e0c088]/25 bg-[#0b1626]"
                onChange={(event) => setNextName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addMilestone();
                  }
                }}
              />
              <Button type="button" variant="outline" disabled={busyId === "add"} onClick={() => void addMilestone()}>
                Add
              </Button>
            </div>
          </section>
          </div>
          </div>

          {shownError ? <p className="text-sm text-[#f0b2a4]">{shownError}</p> : null}
          <p className="text-xs text-[#8ea0b5]">Stamped as {author || "you"} when you save.</p>
          <DialogFooter className="sm:justify-between">
            {mode === "edit" && onDelete ? (
              <Button type="button" variant="destructive" disabled={saving} onClick={onDelete}>
                Remove card
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : mode === "create" ? "Place on the tree" : "Save card"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
