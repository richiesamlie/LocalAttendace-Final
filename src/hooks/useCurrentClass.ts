import { useStore } from '../store';

export function useCurrentClassId(): string | null {
  return useStore((state) => state.currentClassId);
}

export function useCurrentClassName(): string {
  const classes = useStore((state) => state.classes);
  const currentClassId = useStore((state) => state.currentClassId);
  const currentClass = classes.find((c) => c.id === currentClassId);
  return currentClass ? currentClass.name : 'Class';
}
