import type { Dashboard } from '@support/contracts';
// Public preview fixtures, authored by hand. No customer data or live integrations.
export const preview: Dashboard = {
  synthetic: true,
  period: 'Sample week · Oct 5–11',
  metrics: { conversations: 1284, resolved: 1062, responseTime: '2m 14s', satisfaction: '96.8%' },
  volume: [
    { day: 'Mon', received: 148, resolved: 121 },
    { day: 'Tue', received: 192, resolved: 162 },
    { day: 'Wed', received: 174, resolved: 148 },
    { day: 'Thu', received: 225, resolved: 185 },
    { day: 'Fri', received: 206, resolved: 171 },
    { day: 'Sat', received: 181, resolved: 149 },
    { day: 'Sun', received: 158, resolved: 126 },
  ],
  conversations: [
    {
      id: 'sample-1',
      name: 'Thiri Mon',
      initials: 'TM',
      message: 'မင်္ဂလာပါ။ ပစ္စည်းပို့ဆောင်ချိန် သိချင်ပါတယ်။',
      channel: 'Messenger',
      status: 'Needs reply',
      time: '2 min ago',
    },
    {
      id: 'sample-2',
      name: 'Aung Khant',
      initials: 'AK',
      message: 'ဆိုင်ဖွင့်ချိန်လေး သိပါရစေ။',
      channel: 'Website',
      status: 'Assigned',
      time: '8 min ago',
    },
    {
      id: 'sample-3',
      name: 'May Thu',
      initials: 'MT',
      message: 'အကူအညီပေးလို့ ကျေးဇူးတင်ပါတယ်။',
      channel: 'Viber',
      status: 'Resolved',
      time: '15 min ago',
    },
    {
      id: 'sample-4',
      name: 'Nay Lin',
      initials: 'NL',
      message: 'ပစ္စည်းအကြောင်း အသေးစိတ် သိချင်ပါတယ်။',
      channel: 'Website',
      status: 'Needs reply',
      time: '24 min ago',
    },
  ],
};
