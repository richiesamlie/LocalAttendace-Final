export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WORK_DAYS = [1, 2, 3, 4, 5]; // Monday to Friday

export const parseTime = (timeStr: string) => {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM|am|pm)?/);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const modifier = match[3]?.toLowerCase();
  if (modifier === 'pm' && h < 12) h += 12;
  if (modifier === 'am' && h === 12) h = 0;
  return h * 60 + m;
};

export type SubjectColorScheme = {
  bg: string;
  text: string;
  border: string;
  solid: string;
  lightBg: string;
};

export const getSubjectColor = (subject: string): SubjectColorScheme => {
  if (!subject) return {
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    text: 'text-slate-500 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
    solid: 'bg-slate-400',
    lightBg: 'bg-slate-100 dark:bg-slate-800'
  };

  const colors: SubjectColorScheme[] = [
    { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800/50', solid: 'bg-blue-500', lightBg: 'bg-blue-100 dark:bg-blue-900/40' },
    { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/50', solid: 'bg-emerald-500', lightBg: 'bg-emerald-100 dark:bg-emerald-900/40' },
    { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800/50', solid: 'bg-violet-500', lightBg: 'bg-violet-100 dark:bg-violet-900/40' },
    { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800/50', solid: 'bg-amber-500', lightBg: 'bg-amber-100 dark:bg-amber-900/40' },
    { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800/50', solid: 'bg-rose-500', lightBg: 'bg-rose-100 dark:bg-rose-900/40' },
    { bg: 'bg-cyan-50 dark:bg-cyan-900/20', text: 'text-cyan-600 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800/50', solid: 'bg-cyan-500', lightBg: 'bg-cyan-100 dark:bg-cyan-900/40' },
    { bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20', text: 'text-fuchsia-600 dark:text-fuchsia-400', border: 'border-fuchsia-200 dark:border-fuchsia-800/50', solid: 'bg-fuchsia-500', lightBg: 'bg-fuchsia-100 dark:bg-fuchsia-900/40' },
    { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800/50', solid: 'bg-orange-500', lightBg: 'bg-orange-100 dark:bg-orange-900/40' },
    { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800/50', solid: 'bg-teal-500', lightBg: 'bg-teal-100 dark:bg-teal-900/40' },
    { bg: 'bg-pink-50 dark:bg-pink-900/20', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800/50', solid: 'bg-pink-500', lightBg: 'bg-pink-100 dark:bg-pink-900/40' }
  ];

  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = subject.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
};
