import type { Template } from './types';

// 20 oz is the measured template used for the Phoenix set. Confirm the others
// against your own blanks before printing — suppliers vary.
export const TEMPLATES: Template[] = [
  { id: 'skinny-20', name: '20 oz skinny straight', widthIn: 9.25, heightIn: 8.05, seamless: true },
  { id: 'skinny-30', name: '30 oz skinny straight', widthIn: 10.5, heightIn: 9.0, seamless: true },
  { id: 'skinny-15', name: '15 oz skinny straight', widthIn: 8.9, heightIn: 7.3, seamless: true },
  { id: 'kids-12', name: '12 oz kids straight', widthIn: 8.4, heightIn: 5.5, seamless: true },
  { id: 'mug-11', name: '11 oz mug (handle gap)', widthIn: 8.5, heightIn: 3.5, seamless: false },
  { id: 'custom', name: 'Custom size', widthIn: 9, heightIn: 8, seamless: true },
];

// TEMPLATES is a fixed non-empty literal, so the fallback is always defined.
export const templateById = (id: string) => TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0]!;
