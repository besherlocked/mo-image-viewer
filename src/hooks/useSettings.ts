import { useEffect } from "react";
import { useAppStore } from "../store/appStore";

export function useSettings() {
  const loadSettings = useAppStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);
}
