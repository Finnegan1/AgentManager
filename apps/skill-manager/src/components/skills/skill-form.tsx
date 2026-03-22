import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SkillFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, content: string) => Promise<void>;
  initialId?: string;
  initialContent?: string;
}

const TEMPLATE = `---
name: ""
tags: []
description: ""
version: "1.0"
author: ""
created: "${new Date().toISOString().split("T")[0]}"
updated: "${new Date().toISOString().split("T")[0]}"
---

# Skill Title

Beschreibe den Skill hier...
`;

export function SkillForm({
  open,
  onOpenChange,
  onSave,
  initialId,
  initialContent,
}: SkillFormProps) {
  const [skillId, setSkillId] = useState(initialId ?? "");
  const [content, setContent] = useState(initialContent ?? TEMPLATE);
  const [saving, setSaving] = useState(false);

  const isEditing = !!initialId;

  const handleSave = async () => {
    if (!skillId.trim()) return;
    try {
      setSaving(true);
      await onSave(skillId.trim(), content);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save skill:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Skill bearbeiten" : "Skill erstellen"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="space-y-2">
            <Label htmlFor="skillId">Skill-ID (Dateiname ohne .md)</Label>
            <Input
              id="skillId"
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
              placeholder="z.B. typescript-best-practices"
              disabled={isEditing}
            />
          </div>

          <div className="space-y-2 flex-1 flex flex-col min-h-0">
            <Label htmlFor="content">
              Inhalt (Markdown mit YAML-Frontmatter)
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 font-mono text-sm min-h-[300px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving || !skillId.trim()}>
            {saving ? "Speichern..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
