import { useState } from "react";

const GAME_DB_KEY = "game_db_management_enabled";

function getStored(): boolean {
  try {
    return localStorage.getItem(GAME_DB_KEY) === "true";
  } catch {
    return false;
  }
}

export function useGameDbManagement() {
  const [enabled, setEnabled] = useState<boolean>(getStored);

  const toggleGameDb = () => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(GAME_DB_KEY, String(next));
      } catch {
        // localStorage indisponible
      }
      return next;
    });
  };

  return { gameDbEnabled: enabled, toggleGameDb };
}
