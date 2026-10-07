"use client";

import { useState } from "react";
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
  normalizeText,
  validateCapability,
  validateIdentity,
} from "@/lib/board-model";
import { COMMITMENTS, PROFICIENCIES, type Commitment, type Proficiency } from "@/lib/types";

export type CapabilityDraft = {
  title: string;
  description: string;
  proficiency: Proficiency;
  commitment: Commitment;
};

export const EMPTY_DRAFT: CapabilityDraft = {
  title: "",
  description: "",
  proficiency: "neutral",
  commitment: "next",
};

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
  author,
  saving,
  error,
  onOpenChange,
  onSubmit,
  onDelete,
}: {
  open: boolean;
  mode: "create" | "edit";
  seed: CapabilityDraft;
  author: string;
  saving: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: CapabilityDraft) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<CapabilityDraft>(seed);
  const [localError, setLocalError] = useState<string | null>(null);

  function submit() {
    const message = validateCapability({ ...draft, author });
    if (message) {
      setLocalError(message);
      return;
    }
    onSubmit({
      ...draft,
      title: normalizeText(draft.title),
      description: normalizeText(draft.description),
    });
  }

  const shownError = localError ?? error;

  return (
    <Dialog open={open} onOpenChange={(next) => (saving ? undefined : onOpenChange(next))}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {mode === "create" ? "Add a capability" : "Edit capability"}
          </DialogTitle>
          <DialogDescription>
            Say what it is, whether the team is good at it, and if anyone is doing it now.
            Saving stamps this as {author || "you"}.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="capability-title">Title</Label>
              <span className="text-xs text-muted-foreground">
                {draft.title.trim().length}/{LIMITS.title}
              </span>
            </div>
            <Input
              id="capability-title"
              value={draft.title}
              maxLength={LIMITS.title}
              placeholder="Discovery calls"
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="capability-description">Short description</Label>
              <span className="text-xs text-muted-foreground">
                {draft.description.trim().length}/{LIMITS.description}
              </span>
            </div>
            <Textarea
              id="capability-description"
              value={draft.description}
              maxLength={LIMITS.description}
              placeholder="The first conversation that decides if a lead is real."
              onChange={(event) =>
                setDraft((current) => ({ ...current, description: event.target.value }))
              }
            />
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="text-sm font-medium">Proficiency</legend>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
              {PROFICIENCIES.map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={draft.proficiency === value ? "default" : "ghost"}
                  aria-pressed={draft.proficiency === value}
                  className="w-full"
                  onClick={() => setDraft((current) => ({ ...current, proficiency: value }))}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: PROFICIENCY_META[value].stripe }}
                  />
                  {PROFICIENCY_META[value].label}
                </Button>
              ))}
            </div>
          </fieldset>
          <fieldset className="grid gap-1.5">
            <legend className="text-sm font-medium">Commitment</legend>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
              {COMMITMENTS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={draft.commitment === value ? "default" : "ghost"}
                  aria-pressed={draft.commitment === value}
                  className="w-full px-1 text-xs sm:text-sm"
                  onClick={() => setDraft((current) => ({ ...current, commitment: value }))}
                >
                  {COMMITMENT_META[value].label}
                </Button>
              ))}
            </div>
          </fieldset>
          {shownError ? <p className="text-sm text-destructive">{shownError}</p> : null}
          <DialogFooter className="sm:justify-between">
            {mode === "edit" && onDelete ? (
              <Button type="button" variant="destructive" disabled={saving} onClick={onDelete}>
                Remove
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : mode === "create" ? "Add to the tree" : "Save changes"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
