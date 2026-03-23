import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listSkillFiles,
  saveSkillFile,
  deleteSkillFile,
  createSkillDirectory,
  type SkillFileInfo,
} from "@/lib/tauri-commands";
import { invoke } from "@tauri-apps/api/core";
import { CodeMirrorEditor } from "@/components/ui/codemirror-editor";
import {
  FolderPlus,
  FilePlus,
  Trash2,
  FileText,
  Folder,
  ArrowLeft,
} from "lucide-react";

interface SkillFilesProps {
  skillId: string;
}

export function SkillFiles({ skillId }: SkillFilesProps) {
  const [files, setFiles] = useState<SkillFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For creating new files/dirs
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewDir, setShowNewDir] = useState(false);
  const [newName, setNewName] = useState("");

  // For editing a file
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listSkillFiles(skillId);
      setFiles(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [skillId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleCreateFile = async () => {
    if (!newName.trim()) return;
    try {
      await saveSkillFile(skillId, newName.trim(), "");
      setShowNewFile(false);
      setNewName("");
      await loadFiles();
    } catch (err) {
      console.error("Failed to create file:", err);
    }
  };

  const handleCreateDir = async () => {
    if (!newName.trim()) return;
    try {
      await createSkillDirectory(skillId, newName.trim());
      setShowNewDir(false);
      setNewName("");
      await loadFiles();
    } catch (err) {
      console.error("Failed to create directory:", err);
    }
  };

  const handleDelete = async (relativePath: string) => {
    try {
      await deleteSkillFile(skillId, relativePath);
      if (editingFile === relativePath) {
        setEditingFile(null);
      }
      await loadFiles();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleOpenFile = async (relativePath: string) => {
    try {
      const content = await invoke<string>("read_skill_file", {
        name: skillId,
        relativePath,
      });
      setEditContent(content);
      setEditingFile(relativePath);
    } catch (err) {
      console.error("Failed to open file:", err);
      setEditContent("");
      setEditingFile(relativePath);
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    try {
      setEditSaving(true);
      await saveSkillFile(skillId, editingFile, editContent);
    } catch (err) {
      console.error("Failed to save file:", err);
    } finally {
      setEditSaving(false);
    }
  };

  if (editingFile) {
    return (
      <div className="flex flex-col h-full gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingFile(null)}
          >
            <ArrowLeft className="mr-1 size-4" />
            Zurueck
          </Button>
          <span className="text-sm text-muted-foreground font-mono">
            {editingFile}
          </span>
          <Button size="sm" onClick={handleSaveFile} disabled={editSaving} className="ml-auto">
            {editSaving ? "Speichern..." : "Speichern"}
          </Button>
        </div>
        <CodeMirrorEditor
          value={editContent}
          onChange={setEditContent}
          className="flex-1 min-h-0"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowNewFile(true);
            setShowNewDir(false);
            setNewName("");
          }}
        >
          <FilePlus className="mr-1 size-4" />
          Datei
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowNewDir(true);
            setShowNewFile(false);
            setNewName("");
          }}
        >
          <FolderPlus className="mr-1 size-4" />
          Ordner
        </Button>
      </div>

      {/* New file input */}
      {showNewFile && (
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="z.B. references/api-docs.md"
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleCreateFile()}
          />
          <Button size="sm" onClick={handleCreateFile}>
            Erstellen
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowNewFile(false)}
          >
            Abbrechen
          </Button>
        </div>
      )}

      {/* New directory input */}
      {showNewDir && (
        <div className="flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="z.B. references"
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleCreateDir()}
          />
          <Button size="sm" onClick={handleCreateDir}>
            Erstellen
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowNewDir(false)}
          >
            Abbrechen
          </Button>
        </div>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground">Laden...</p>
      )}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {!loading && files.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Keine zusaetzlichen Dateien. Erstelle Ordner wie references/,
          scripts/ oder assets/ um den Skill zu erweitern.
        </p>
      )}

      {/* File tree */}
      {!loading && files.length > 0 && (
        <div className="space-y-1">
          {files.map((file) => (
            <div
              key={file.relativePath}
              className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 group"
              style={{
                paddingLeft: `${(file.relativePath.split("/").length - 1) * 16 + 8}px`,
              }}
            >
              {file.isDirectory ? (
                <Folder className="size-4 text-muted-foreground shrink-0" />
              ) : (
                <FileText className="size-4 text-muted-foreground shrink-0" />
              )}
              <span
                className={`text-sm flex-1 font-mono ${
                  !file.isDirectory
                    ? "cursor-pointer hover:underline"
                    : ""
                }`}
                onClick={() =>
                  !file.isDirectory && handleOpenFile(file.relativePath)
                }
              >
                {file.relativePath.split("/").pop()}
              </span>
              {!file.isDirectory && (
                <span className="text-xs text-muted-foreground">
                  {file.size < 1024
                    ? `${file.size} B`
                    : `${(file.size / 1024).toFixed(1)} KB`}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-6 opacity-0 group-hover:opacity-100"
                onClick={() => handleDelete(file.relativePath)}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
