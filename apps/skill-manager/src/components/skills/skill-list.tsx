import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import { useSkills } from "@/hooks/use-skills";
import { SkillForm } from "./skill-form";
import type { SkillContent } from "@/lib/tauri-commands";

export function SkillList() {
  const { skills, loadSkill, createSkill, updateSkill, removeSkill } = useSkills();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<{
    id: string;
    content: string;
  } | null>(null);
  const [viewingSkill, setViewingSkill] = useState<SkillContent | null>(null);

  const filteredSkills = useMemo(() => {
    if (!search.trim()) return skills;
    const q = search.toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [skills, search]);

  const handleEdit = async (id: string) => {
    try {
      const skill = await loadSkill(id);
      // Reconstruct the full file content with frontmatter
      const frontmatter = `---
name: "${skill.metadata.name}"
tags: [${skill.metadata.tags.map((t) => `"${t}"`).join(", ")}]
description: "${skill.metadata.description}"
version: "${skill.metadata.version}"
author: "${skill.metadata.author}"
created: "${skill.metadata.created}"
updated: "${new Date().toISOString().split("T")[0]}"
---`;
      setEditingSkill({ id, content: `${frontmatter}\n\n${skill.content}` });
      setFormOpen(true);
    } catch (err) {
      console.error("Failed to load skill:", err);
    }
  };

  const handleView = async (id: string) => {
    try {
      const skill = await loadSkill(id);
      setViewingSkill(skill);
    } catch (err) {
      console.error("Failed to load skill:", err);
    }
  };

  const handleAdd = () => {
    setEditingSkill(null);
    setFormOpen(true);
  };

  const handleSave = async (id: string, content: string) => {
    if (editingSkill) {
      await updateSkill(id, content);
    } else {
      await createSkill(id, content);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Skills</h2>
          <p className="text-muted-foreground">
            Skill-Markdown-Dateien verwalten
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 size-4" />
          Skill erstellen
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Skills durchsuchen..."
          className="pl-9"
        />
      </div>

      {/* Skills Grid */}
      {filteredSkills.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              {skills.length === 0
                ? "Noch keine Skills vorhanden"
                : "Keine Skills gefunden"}
            </p>
            {skills.length === 0 && (
              <Button variant="outline" onClick={handleAdd}>
                <Plus className="mr-2 size-4" />
                Ersten Skill erstellen
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSkills.map((skill) => (
            <Card key={skill.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base leading-tight">
                    {skill.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {skill.description || "Keine Beschreibung"}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleView(skill.id)}>
                      <Eye className="mr-2 size-4" />
                      Anzeigen
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleEdit(skill.id)}>
                      <Pencil className="mr-2 size-4" />
                      Bearbeiten
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => removeSkill(skill.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Loschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <div className="flex flex-wrap gap-1">
                  {skill.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>v{skill.version}</span>
                  <span>·</span>
                  <span>{skill.author}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Skill Form Dialog */}
      <SkillForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSave={handleSave}
        initialId={editingSkill?.id}
        initialContent={editingSkill?.content}
      />

      {/* Skill View Dialog */}
      {viewingSkill && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewingSkill(null)}
        >
          <div
            className="bg-background rounded-lg border max-w-2xl w-full max-h-[80vh] overflow-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{viewingSkill.metadata.name}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingSkill(null)}
              >
                Schliessen
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mb-4">
              {viewingSkill.metadata.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {viewingSkill.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
