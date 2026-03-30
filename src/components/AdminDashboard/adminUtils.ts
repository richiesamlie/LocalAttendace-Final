import type { ClassData } from '../../store';

export interface MassiveBackupPayload {
  metadata: {
    exportDate: string;
    type: string;
    version: string;
  };
  data: {
    'Semester 1 (Jul-Dec)'?: { classes: ClassData[] };
    'Semester 2 (Jan-Jun)'?: { classes: ClassData[] };
    [semester: string]: { classes: ClassData[] } | undefined;
  };
}

const isSem1 = (dateStr: string) => {
  const month = new Date(dateStr).getMonth();
  return month >= 6 && month <= 11;
};

const isSem2 = (dateStr: string) => {
  const month = new Date(dateStr).getMonth();
  return month >= 0 && month <= 5;
};

export const processClassesBySemester = (classes: ClassData[]) => {
  const filterFn = (sem: 'sem1' | 'sem2') => (dateStr: string) =>
    sem === 'sem1' ? isSem1(dateStr) : isSem2(dateStr);

  const process = (sem: 'sem1' | 'sem2') =>
    classes.map((c) => ({
      ...c,
      records: (c.records || []).filter((r) => filterFn(sem)(r.date)),
      dailyNotes: Object.fromEntries(
        Object.entries(c.dailyNotes || {}).filter(([date]) => filterFn(sem)(date))
      ),
      events: (c.events || []).filter((e) => filterFn(sem)(e.date)),
    }));

  return {
    'Semester 1 (Jul-Dec)': { classes: process('sem1') },
    'Semester 2 (Jan-Jun)': { classes: process('sem2') },
  };
};

export const buildMassiveBackup = (classes: ClassData[]): MassiveBackupPayload => ({
  metadata: {
    exportDate: new Date().toISOString(),
    type: 'Massive Semester Backup',
    version: '1.1',
  },
  data: processClassesBySemester(classes),
});

export const downloadJson = (data: object, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const mergeBackupClasses = (parsed: MassiveBackupPayload): ClassData[] => {
  const mergedClasses = new Map<string, ClassData>();

  Object.values(parsed.data).forEach((semester) => {
    if (!semester?.classes) return;
    semester.classes.forEach((c) => {
      if (mergedClasses.has(c.id)) {
        const existing = mergedClasses.get(c.id)!;
        mergedClasses.set(c.id, {
          ...existing,
          records: [...(existing.records || []), ...(c.records || [])],
          events: [...(existing.events || []), ...(c.events || [])],
          dailyNotes: { ...(existing.dailyNotes || {}), ...(c.dailyNotes || {}) },
        });
      } else {
        mergedClasses.set(c.id, c);
      }
    });
  });

  return Array.from(mergedClasses.values());
};
