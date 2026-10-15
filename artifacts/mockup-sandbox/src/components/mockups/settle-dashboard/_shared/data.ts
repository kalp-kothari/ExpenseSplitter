export type Person = { name: string; initials: string; tone: string };
export type Group = {
  id: string;
  name: string;
  context: string;
  members: Person[];
  memberCount: number;
  total: number;
  tone: string;
  icon: string;
};
export type Expense = {
  id: string;
  title: string;
  group: string;
  payer: Person;
  date: string;
  amount: number;
  share: number;
  status: 'You paid' | 'You owe' | 'Owed to you';
  icon: string;
  tone: string;
};

export const groups: Group[] = [
  {
    id: 'flat-14',
    name: 'Flat 14',
    context: 'Home, sweet shared home',
    members: [
      { name: 'Aarav Mehta', initials: 'AM', tone: 'sage' },
      { name: 'Tara Iyer', initials: 'TI', tone: 'peach' },
      { name: 'Kabir Shah', initials: 'KS', tone: 'lilac' },
    ],
    memberCount: 4, total: 18460, tone: 'mint', icon: 'home',
  },
  {
    id: 'goa-weekend',
    name: 'Goa, again',
    context: 'Long weekend · February',
    members: [
      { name: 'Rhea Kapoor', initials: 'RK', tone: 'peach' },
      { name: 'Dev Nair', initials: 'DN', tone: 'blue' },
      { name: 'Aarav Mehta', initials: 'AM', tone: 'sage' },
    ],
    memberCount: 6, total: 32780, tone: 'coral', icon: 'sun',
  },
  {
    id: 'chai-club',
    name: 'Chai Club',
    context: 'The usual suspects',
    members: [
      { name: 'Tara Iyer', initials: 'TI', tone: 'peach' },
      { name: 'Aarav Mehta', initials: 'AM', tone: 'sage' },
      { name: 'Nikhil Rao', initials: 'NR', tone: 'yellow' },
    ],
    memberCount: 5, total: 4260, tone: 'butter', icon: 'cup',
  },
];

export const expenses: Expense[] = [
  {
    id: 'dinner-thursday', title: 'Thursday dinner', group: 'Flat 14',
    payer: { name: 'Tara Iyer', initials: 'TI', tone: 'peach' },
    date: 'Today, 8:42 pm', amount: 2480, share: 620, status: 'You owe', icon: 'food', tone: 'coral',
  },
  {
    id: 'airport-cab', title: 'Airport cab', group: 'Goa, again',
    payer: { name: 'You', initials: 'AM', tone: 'sage' },
    date: 'Yesterday', amount: 1860, share: 310, status: 'You paid', icon: 'cab', tone: 'blue',
  },
  {
    id: 'coffee-run', title: 'Coffee run', group: 'Chai Club',
    payer: { name: 'Nikhil Rao', initials: 'NR', tone: 'yellow' },
    date: 'Tue, 11 Jun', amount: 940, share: 188, status: 'Owed to you', icon: 'coffee', tone: 'butter',
  },
  {
    id: 'grocery-topup', title: 'Grocery top-up', group: 'Flat 14',
    payer: { name: 'You', initials: 'AM', tone: 'sage' },
    date: 'Mon, 10 Jun', amount: 3240, share: 810, status: 'You paid', icon: 'bag', tone: 'mint',
  },
];

export const balances = { total: 1280, owe: 1900, owed: 3180 };
