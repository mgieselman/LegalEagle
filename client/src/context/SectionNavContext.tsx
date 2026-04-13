import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface SectionNavTarget {
  key: string;
  counter: number;
}

interface SectionNavContextValue {
  target: SectionNavTarget | null;
  navigateToSection: (key: string) => void;
}

const SectionNavContext = createContext<SectionNavContextValue>({
  target: null,
  navigateToSection: () => {},
});

export function SectionNavProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<SectionNavTarget | null>(null);

  const navigateToSection = useCallback((key: string) => {
    setTarget((prev) => ({ key, counter: (prev?.counter ?? 0) + 1 }));
  }, []);

  return (
    <SectionNavContext.Provider value={{ target, navigateToSection }}>
      {children}
    </SectionNavContext.Provider>
  );
}

export function useSectionNav() {
  return useContext(SectionNavContext);
}
