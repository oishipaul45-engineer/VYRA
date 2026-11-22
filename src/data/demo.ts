export type Transaction = { id: string; name: string; category: string; amount: number; date: string; note?: string };
export type Vault = { id: string; name: string; goal: number; saved: number; icon: string };
export type Circle = { id: string; name: string; members: number; expenses: number; balance: number };
export type State = { name: string; transactions: Transaction[]; vaults: Vault[]; circles: Circle[]; reducedMotion: boolean; hideAmounts: boolean };
export const money = (value: number) => `${value < 0 ? '-' : ''}${String.fromCharCode(8377)}${Math.abs(value).toLocaleString('en-IN', {maximumFractionDigits:2, minimumFractionDigits:0})}`;
export const starter: State = {
  name:'', reducedMotion:false, hideAmounts:false,
  transactions:[
    {id:'t1',name:'Coffee & Co.',category:'Food',amount:-320,date:'2026-11-21'},
    {id:'t2',name:'Metro card',category:'Travel',amount:-150,date:'2026-11-20'},
    {id:'t3',name:'Project supplies',category:'Shopping',amount:-840,date:'2026-11-19'},
    {id:'t4',name:'Demo credit',category:'Income',amount:12000,date:'2026-11-18'},
    {id:'t5',name:'Streaming',category:'Subscriptions',amount:-299,date:'2026-11-17'},
    {id:'t6',name:'Lunch',category:'Food',amount:-240,date:'2026-11-15'},
  ],
  vaults:[{id:'v1',name:'New laptop',goal:45000,saved:12800,icon:'💻'},{id:'v2',name:'Weekend trip',goal:8000,saved:3200,icon:'✈️'}],
  circles:[{id:'c1',name:'Weekend crew',members:4,expenses:3680,balance:540},{id:'c2',name:'Flatmates',members:3,expenses:8200,balance:-1200}]
};
