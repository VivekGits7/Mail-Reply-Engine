import {
  Activity,
  BellRing,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Gauge,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MessageSquareWarning,
  Presentation,
  Settings2,
  ShieldAlert,
  SmilePlus,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  requires?: 'admin' | 'complaints';
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Desk',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/approvals', label: 'Approvals', icon: ClipboardCheck },
      { to: '/joiners', label: 'Joiners', icon: UserPlus },
      { to: '/exits', label: 'Exits', icon: LogOut },
    ],
  },
  {
    label: 'Programs',
    items: [
      { to: '/reminders', label: 'Reminders', icon: BellRing },
      { to: '/feedback', label: 'Feedback', icon: SmilePlus },
      { to: '/complaints', label: 'Complaints', icon: MessageSquareWarning, requires: 'complaints' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/admin/controls', label: 'Controls', icon: Gauge },
      { to: '/admin/settings', label: 'Settings', icon: Settings2 },
      { to: '/admin/templates', label: 'Email templates', icon: FileText },
      { to: '/admin/checklists', label: 'Checklists', icon: ListChecks },
      { to: '/admin/induction', label: 'Induction plans', icon: Presentation },
      { to: '/admin/holidays', label: 'Holidays', icon: CalendarDays },
      { to: '/admin/activity', label: 'Activity log', icon: Activity },
      { to: '/admin/failures', label: 'Failures', icon: ShieldAlert },
      { to: '/admin/users', label: 'Users', icon: Users, requires: 'admin' },
    ],
  },
];
