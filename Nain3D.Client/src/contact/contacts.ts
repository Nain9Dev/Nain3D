// Single source for the call to action shown on the recording end card and in the page footer.
// The public contact address is contact@naindev.com on every public surface.
export interface Contact {
  id: 'site' | 'email' | 'linkedin' | 'github';
  /** Short name of the channel; brand names and "Email" are the same in both languages. */
  label: string;
  /** Readable text; kept short enough for one line on a 1080 px wide card. */
  value: string;
  href: string;
}

export const IDENTITY = { name: 'Aitor Nain', brand: 'NainDev' } as const;

export const CONTACTS: readonly Contact[] = [
  { id: 'site', label: 'Web', value: 'naindev.com', href: 'https://naindev.com' },
  { id: 'email', label: 'Email', value: 'contact@naindev.com', href: 'mailto:contact@naindev.com' },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    value: 'in/aitor-nain-mendoza-vallejo',
    href: 'https://www.linkedin.com/in/aitor-nain-mendoza-vallejo',
  },
  { id: 'github', label: 'GitHub', value: 'github.com/Nain9Dev/Nain3D', href: 'https://github.com/Nain9Dev/Nain3D' },
];
