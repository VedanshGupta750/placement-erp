import Link from "next/link";
import { poppins } from "@/lib/fonts";
import { LogoMark } from "@/components/dashboard/logo-mark";
import { PWA_CONFIG } from "@/lib/pwa/config";
import {
  Star,
  Briefcase,
  Menu,
  Search,
  Bell,
  User,
  Users,
  Building2,
  FileCheck2,
  MessageSquare,
  TrendingUp,
} from "lucide-react";

const FEATURES = [
  { icon: Briefcase, title: "Drive Management", desc: "Post, publish & track placement drives", bg: "bg-blue-100", text: "text-blue-600" },
  { icon: Users, title: "Student Roster", desc: "Eligibility, resumes & applications", bg: "bg-emerald-100", text: "text-emerald-600" },
  { icon: Building2, title: "Recruiter Portal", desc: "Companies apply, shortlist & interview", bg: "bg-violet-100", text: "text-violet-600" },
  { icon: FileCheck2, title: "Offers & Reports", desc: "Real-time placement analytics", bg: "bg-orange-100", text: "text-orange-600" },
];

const DRIVE_POINTS = [12, 18, 15, 24, 20, 28, 26];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const FUNNEL_SEGMENTS = [
  { label: "Placed", pct: 33.1, color: "#2a78d6" },
  { label: "In process", pct: 41.2, color: "#f0b429" },
  { label: "Not applied", pct: 25.7, color: "#94a3b8" },
];

function DrivesLineChart() {
  const w = 220;
  const h = 90;
  const max = 30;
  const points = DRIVE_POINTS.map((v, i) => {
    const x = (i / (DRIVE_POINTS.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full overflow-visible">
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={0} y1={(h / 3) * i} x2={w} y2={(h / 3) * i} stroke="#f0f0f3" strokeWidth={1} />
        ))}
        <polyline points={points} fill="none" stroke="#2a78d6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {DRIVE_POINTS.map((v, i) => {
          const x = (i / (DRIVE_POINTS.length - 1)) * w;
          const y = h - (v / max) * h;
          return <circle key={i} cx={x} cy={y} r={2.5} fill="#2a78d6" />;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
        {DAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
    </div>
  );
}

function FunnelDonutChart() {
  const size = 96;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="-rotate-90">
        {FUNNEL_SEGMENTS.map((seg, index) => {
          const segLength = (seg.pct / 100) * circumference;
          const dasharray = `${segLength} ${circumference - segLength}`;
          const precedingPercentage = FUNNEL_SEGMENTS
            .slice(0, index)
            .reduce((total, item) => total + item.pct, 0);
          const dashoffset = -(precedingPercentage / 100) * circumference;
          return (
            <circle
              key={seg.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
            />
          );
        })}
      </svg>
      <div className="flex flex-col gap-1.5">
        {FUNNEL_SEGMENTS.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-zinc-500">{seg.label}</span>
            <span className="font-semibold text-zinc-700">{seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendUp,
  iconBg,
  iconText,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  trend: string;
  trendUp?: boolean;
  iconBg: string;
  iconText: string;
}) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconBg} ${iconText}`}>
          <Icon className="size-4" />
        </span>
        <p className="text-xs leading-tight text-zinc-400">{label}</p>
      </div>
      <p className="text-lg leading-tight font-bold text-zinc-800">{value}</p>
      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
        {trendUp !== false && <TrendingUp className="size-3" />}
        {trend}
      </p>
    </div>
  );
}

function DashboardMockup() {
  const sidebarIcons = [Menu, Users, Briefcase, FileCheck2, MessageSquare];
  return (
    <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
      <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4">
        <Menu className="size-5 text-zinc-400" />
        <span className="text-lg font-bold text-zinc-900">Placement Console</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full bg-zinc-100 px-3 py-1.5 text-xs text-zinc-400 sm:flex">
            <Search className="size-3.5" />
            Search drives, students...
          </div>
          <span className="relative flex size-8 items-center justify-center rounded-full text-zinc-400">
            <Bell className="size-5" />
            <span className="absolute top-1 right-1.5 size-1.5 rounded-full bg-rose-500" />
          </span>
          <span className="flex size-8 items-center justify-center rounded-full bg-zinc-200 text-zinc-500">
            <User className="size-4" />
          </span>
        </div>
      </div>
      <div className="flex">
        <div className="flex w-14 shrink-0 flex-col items-center gap-3 border-r border-zinc-100 py-5">
          {sidebarIcons.map((Icon, i) => (
            <span key={i} className={i === 2 ? "flex size-9 items-center justify-center rounded-lg bg-primary text-white" : "flex size-9 items-center justify-center rounded-lg text-zinc-300"}>
              <Icon className="size-5" />
            </span>
          ))}
        </div>
        <div className="flex-1 p-5">
          <div className="mb-4 grid grid-cols-4 gap-3">
            <StatCard icon={Users} label="Students" value="1,731" trend="8,038 college-wide" iconBg="bg-blue-100" iconText="text-blue-600" />
            <StatCard icon={Briefcase} label="Active Drives" value="249" trend="51 companies" iconBg="bg-emerald-100" iconText="text-emerald-600" />
            <StatCard icon={FileCheck2} label="Offers" value="731" trend="₹22L highest" iconBg="bg-violet-100" iconText="text-violet-600" />
            <StatCard icon={TrendingUp} label="Placed" value="33.1%" trend="577 students" iconBg="bg-orange-100" iconText="text-orange-600" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-zinc-50 p-4">
              <p className="mb-2 text-sm font-semibold text-zinc-700">Drives Published</p>
              <DrivesLineChart />
            </div>
            <div className="flex flex-col justify-center rounded-lg bg-zinc-50 p-4">
              <p className="mb-3 text-sm font-semibold text-zinc-700">Placement Funnel</p>
              <FunnelDonutChart />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-1 [zoom:0.8]">
      <div className="relative hidden w-1/2 flex-col justify-center gap-7 overflow-y-auto bg-gradient-to-br from-white via-blue-50/60 to-indigo-50 p-10 lg:flex xl:p-14">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <span className="bg-primary/10 flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl p-1">
            <LogoMark className="size-full" />
          </span>
          <span>
            <span className={`${poppins.className} block text-2xl leading-tight font-bold tracking-tight text-zinc-900`}>
              {PWA_CONFIG.name}
            </span>
            <span className="block text-sm text-zinc-500">{PWA_CONFIG.description}</span>
          </span>
        </Link>

        <div className="flex flex-col gap-5">
          <span className="bg-primary/10 text-primary ring-primary/15 flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1">
            <Star className="fill-primary size-4" />
            Placement Cell + Student + Recruiter, one platform
          </span>
          <h1 className={`${poppins.className} max-w-xl text-5xl leading-[1.15] font-extrabold tracking-tight text-balance text-zinc-900`}>
            Run every placement drive from <span className="text-primary">one intelligent platform</span>
          </h1>
          <p className="max-w-lg text-lg text-zinc-500">
            Drives, students, applications, offers, interviews and analytics — all connected, for
            the TPO, the student, and the recruiter.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex flex-col gap-2">
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${f.bg} ${f.text}`}>
                <f.icon className="size-5" />
              </span>
              <p className="text-sm leading-tight font-semibold text-zinc-900">{f.title}</p>
              <p className="text-xs leading-snug text-zinc-500">{f.desc}</p>
            </div>
          ))}
        </div>

        <div>
          <DashboardMockup />
        </div>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50/40 px-6 py-10">
        <Link href="/" className="relative flex items-center gap-2 lg:hidden">
          <span className="bg-primary/10 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg p-0.5">
            <LogoMark className="size-full" />
          </span>
          <span className="text-lg leading-none font-semibold tracking-tight">{PWA_CONFIG.name}</span>
        </Link>
        <div className="relative w-full max-w-lg">{children}</div>
      </div>
    </div>
  );
}
