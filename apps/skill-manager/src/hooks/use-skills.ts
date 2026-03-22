import { useState, useEffect, useCallback } from "react";
import {
  listSkills,
  getSkill,
  saveSkill,
  deleteSkill,
  type SkillMetadata,
  type SkillContent,
} from "@/lib/tauri-commands";

export function useSkills() {
  const [skills, setSkills] = useState<SkillMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listSkills();
      setSkills(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const loadSkill = useCallback(async (id: string): Promise<SkillContent> => {
    return getSkill(id);
  }, []);

  const createSkill = useCallback(
    async (id: string, content: string) => {
      await saveSkill(id, content);
      await loadSkills();
    },
    [loadSkills],
  );

  const updateSkill = useCallback(
    async (id: string, content: string) => {
      await saveSkill(id, content);
      await loadSkills();
    },
    [loadSkills],
  );

  const removeSkill = useCallback(
    async (id: string) => {
      await deleteSkill(id);
      await loadSkills();
    },
    [loadSkills],
  );

  return {
    skills,
    loading,
    error,
    reload: loadSkills,
    loadSkill,
    createSkill,
    updateSkill,
    removeSkill,
  };
}
