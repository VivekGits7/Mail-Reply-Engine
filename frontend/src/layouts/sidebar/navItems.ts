import {
  Activity,
  BellRing,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  DoorOpen,
  FileText,
  Gauge,
  HeartHandshake,
  LayoutDashboard,
  ListChecks,
  MessageCircleHeart,
  MessageSquareWarning,
  Presentation,
  Radar,
  Settings,
  Settings2,
  ShieldAlert,
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
  count?: 'approvals' | 'failures';
}

export interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  count?: NavItem['count'];
}

export const ADMIN_GROUP_ID = 'admin';

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'desk',
    label: 'Desk',
    icon: BriefcaseBusiness,
    count: 'approvals',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/approvals', label: 'Approvals', icon: ClipboardCheck, count: 'approvals' },
      { to: '/joiners', label: 'Joiners', icon: UserPlus },
      { to: '/exits', label: 'Exits', icon: DoorOpen },
    ],
  },
  {
    id: 'programs',
    label: 'Programs',
    icon: HeartHandshake,
    items: [
      { to: '/reminders', label: 'Reminders', icon: BellRing },
      { to: '/feedback', label: 'Feedback', icon: MessageCircleHeart },
      { to: '/complaints', label: 'Complaints', icon: MessageSquareWarning, requires: 'complaints' },
    ],
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    icon: Radar,
    count: 'failures',
    items: [
      { to: '/admin/activity', label: 'Activity log', icon: Activity },
      { to: '/admin/failures', label: 'Failures', icon: ShieldAlert, count: 'failures' },
    ],
  },
  {
    id: ADMIN_GROUP_ID,
    label: 'Admin',
    icon: Settings,
    items: [
      { to: '/admin/controls', label: 'Controls', icon: Gauge },
      { to: '/admin/settings', label: 'Settings', icon: Settings2 },
      { to: '/admin/templates', label: 'Email templates', icon: FileText },
      { to: '/admin/checklists', label: 'Checklists', icon: ListChecks },
      { to: '/admin/induction', label: 'Induction plans', icon: Presentation },
      { to: '/admin/holidays', label: 'Holidays', icon: CalendarDays },
      { to: '/admin/users', label: 'Users', icon: Users, requires: 'admin' },
    ],
  },
];

// Every nav item now points at a section on the single dashboard page instead
// of its own route, addressed by this id (e.g. "/admin/activity" -> "admin-activity").
export function sectionId(to: string): string {
  return to === '/' ? 'overview' : to.replace(/^\//, '').replace(/\//g, '-');
}

export function sectionHref(to: string): string {
  return `/#${sectionId(to)}`;
}

// Nav highlighting follows the scroll-spied section id in redux (app.activeSection),
// not the URL: every item lives on the same "/" route, and clicking one is just
// a jump-start — scrolling is what actually drives which item stays highlighted.
export function isActiveSection(to: string, activeId: string): boolean {
  return sectionId(to) === activeId;
}

export function activeItem(activeId: string): NavItem | undefined {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((candidate) => sectionId(candidate.to) === activeId);
    if (item) return item;
  }
  return undefined;
}

export function activeGroup(activeId: string): NavGroup | undefined {
  return NAV_GROUPS.find((group) => group.items.some((item) => sectionId(item.to) === activeId));
}
