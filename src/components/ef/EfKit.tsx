import React from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/context/DataContext';
import type { Match } from '@/types';

/* Dizajni "EFootball": blu #0F4C81, portokalli #F28C28, sfond i çelët, karta të rrumbullakosura. */
export const EF = { blue: '#0F4C81', blueDark: '#0A3A66', orange: '#F28C28', ink: '#14214A', muted: '#8A94A6', track: '#DCE5F2', line: '#E6EBF2' };

export function formatEfDate(iso?: string): string {
  if (!iso) return '';
  const p = iso.split('-');
  if (p.length !== 3) return iso;
  const months = ['Jan', 'Shk', 'Mar', 'Pri', 'Maj', 'Qer', 'Kor', 'Gus', 'Sht', 'Tet', 'Nën', 'Dhj'];
  const m = months[Number(p[1]) - 1];
  return m ? `${Number(p[2])} ${m}` : iso;
}

export const TeamLogo: React.FC<{ logo?: string; name?: string; size?: number; className?: string }> = ({ logo, name, size = 44, className = '' }) => (
  <span className={`flex shrink-0 items-center justify-center overflow-hidden ${className}`} style={{ width: size, height: size }}>
    {logo ? <img src={logo} alt="" className="h-full w-full object-contain" /> : <span className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 font-bold text-slate-400" style={{ fontSize: size * 0.4 }}>{name?.charAt(0) || '?'}</span>}
  </span>
);

/* Lista e ndeshjeve (si "Matches" në foto) */
export const MatchListCard: React.FC<{ match: Match; onClick?: (m: Match) => void; showWeek?: boolean }> = ({ match, onClick, showWeek = true }) => {
  const { getTeamById } = useData();
  const home = getTeamById(match.homeTeamId);
  const away = getTeamById(match.awayTeamId);
  const live = match.status === 'live';
  const played = match.status === 'finished' || live;
  return (
    <div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={e => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(match); } }} onClick={() => onClick?.(match)}
      className={`rounded-2xl border bg-white px-3 py-4 sm:px-5 transition hover:shadow-md ${onClick ? 'cursor-pointer' : ''} ${live ? 'border-red-200' : 'border-[#E6EBF2]'}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center justify-end gap-2 text-right">
          <div className="min-w-0"><div className="truncate text-[14px] font-semibold text-[#14214A]">{home?.name || 'TBD'}</div></div>
          <TeamLogo logo={home?.logo} name={home?.name} size={40} />
        </div>
        <div className="min-w-[64px] text-center">
          {played ? (
            <div className={`text-2xl font-bold tabular-nums leading-none ${live ? 'text-red-500' : 'text-[#14214A]'}`}>{match.homeScore ?? 0}<span className="mx-1 text-[#8A94A6]">:</span>{match.awayScore ?? 0}</div>
          ) : (
            <div className="text-[19px] font-semibold leading-none text-[#F28C28]">{match.time || 'VS'}</div>
          )}
          <div className="mt-1.5 text-[12px] text-[#8A94A6]">{live ? <span className="inline-flex items-center gap-1 font-bold text-red-500"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />LIVE</span> : formatEfDate(match.date) || (match.status === 'finished' ? 'Përfunduar' : '')}</div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <TeamLogo logo={away?.logo} name={away?.name} size={40} />
          <div className="min-w-0"><div className="truncate text-[14px] font-semibold text-[#14214A]">{away?.name || 'TBD'}</div></div>
        </div>
      </div>
      {(showWeek && match.week) || match.venue ? <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-[#8A94A6]">{showWeek && match.week ? <span>Java {match.week}</span> : null}{showWeek && match.week && match.venue ? <span>·</span> : null}{match.venue ? <span className="truncate">{match.venue}</span> : null}</div> : null}
    </div>
  );
};

/* Karta live (blu, si "Live Match" në foto) */
export const LiveMatchCard: React.FC<{ match: Match; onClick?: (m: Match) => void }> = ({ match, onClick }) => {
  const { getTeamById, competitions } = useData();
  const home = getTeamById(match.homeTeamId);
  const away = getTeamById(match.awayTeamId);
  const comp = competitions.find(c => c.id === match.competitionId);
  return (
    <div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={e => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(match); } }} onClick={() => onClick?.(match)}
      className="relative overflow-hidden rounded-[22px] p-5 text-white shadow-lg shadow-[#0F4C81]/25 transition hover:-translate-y-0.5 cursor-pointer" style={{ background: 'linear-gradient(135deg,#0F4C81 0%,#0B3F73 60%,#14598F 100%)' }}>
      <div className="pointer-events-none absolute -right-10 -bottom-12 h-44 w-44 rounded-full bg-white/[0.06]" />
      <div className="pointer-events-none absolute -left-8 -top-10 h-32 w-32 rounded-full bg-white/[0.05]" />
      <div className="relative flex items-center justify-between gap-2 text-[15px] font-semibold"><span className="truncate">{comp?.name || 'Ndeshja'}</span><span className="inline-flex items-center gap-1.5 rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-bold tracking-wider"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />LIVE</span></div>
      <div className="relative mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <div className="flex flex-col items-center gap-1.5"><TeamLogo logo={home?.logo} name={home?.name} size={56} /><div className="max-w-[110px] truncate text-[15px] font-semibold">{home?.name || 'TBD'}</div></div>
        <div>{match.week ? <div className="text-[11px] text-white/80">Java {match.week}</div> : null}<div className="text-[34px] font-bold leading-tight tabular-nums tracking-wide">{match.homeScore ?? 0} : {match.awayScore ?? 0}</div></div>
        <div className="flex flex-col items-center gap-1.5"><TeamLogo logo={away?.logo} name={away?.name} size={56} /><div className="max-w-[110px] truncate text-[15px] font-semibold">{away?.name || 'TBD'}</div></div>
      </div>
    </div>
  );
};

/* Tabs si pilulla (Stats | Timeline | Line-Up) */
export function PillTabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <div role="group" aria-label={label} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {tabs.map(t => <button key={t.id} type="button" aria-pressed={value === t.id} onClick={() => onChange(t.id)} className={`shrink-0 rounded-xl px-5 py-2.5 text-[15px] font-semibold transition ${value === t.id ? 'bg-[#0F4C81] text-white shadow-md shadow-[#0F4C81]/25' : 'bg-[#F1F4F9] text-[#8A94A6] hover:text-[#14214A]'}`}>{t.label}</button>)}
    </div>
  );
}

/* Rreshti i statistikave: numri majtas, titulli në mes, numri djathtas, dy shirita (portokalli | blu) */
export const StatRow: React.FC<{ label: string; a: number; b: number; suffix?: string; fixedTotal?: number }> = ({ label, a, b, suffix = '', fixedTotal }) => {
  const max = fixedTotal ?? Math.max(a, b, 1);
  const wa = Math.min(100, (a / max) * 100), wb = Math.min(100, (b / max) * 100);
  return (
    <div>
      <div className="grid grid-cols-[3.5rem_1fr_3.5rem] items-center text-[#14214A]"><span className="text-[17px] tabular-nums">{a}{suffix}</span><span className="text-center text-[17px] font-medium">{label}</span><span className="text-right text-[17px] tabular-nums">{b}{suffix}</span></div>
      <div className="mt-2 grid grid-cols-2 gap-3" aria-hidden="true">
        <div className="flex h-2 justify-end overflow-hidden rounded-full bg-[#DCE5F2]"><span className="rounded-full" style={{ width: `${wa}%`, background: 'linear-gradient(90deg,#E8662B,#F5A623)' }} /></div>
        <div className="flex h-2 overflow-hidden rounded-full bg-[#DCE5F2]"><span className="rounded-full bg-[#0F4C81]" style={{ width: `${wb}%` }} /></div>
      </div>
    </div>
  );
};

/* Koka e detajeve të ndeshjes (si "Match detail" në foto) */
export const MatchDetailHeader: React.FC<{ competition?: string; week?: number | string; home?: { name?: string; logo?: string }; away?: { name?: string; logo?: string }; score: string; status?: string; live?: boolean }> = ({ competition, week, home, away, score, status, live }) => (
  <div className="px-4 pt-4 pb-5 text-center">
    {competition ? <div className="text-[19px] font-semibold text-[#14214A]">{competition}</div> : null}
    {week ? <div className="text-[14px] text-[#8A94A6]">Java {week}</div> : null}
    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className="flex flex-col items-center gap-2"><TeamLogo logo={home?.logo} name={home?.name} size={72} /><div className="text-[17px] font-semibold text-[#14214A] break-words">{home?.name || 'TBD'}</div></div>
      <div><div className={`text-[44px] font-semibold leading-none tabular-nums tracking-wide ${live ? 'text-red-500' : 'text-[#14214A]'}`}>{score}</div>{status ? <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#8A94A6]">{live ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> : null}{status}</div> : null}</div>
      <div className="flex flex-col items-center gap-2"><TeamLogo logo={away?.logo} name={away?.name} size={72} /><div className="text-[17px] font-semibold text-[#14214A] break-words">{away?.name || 'TBD'}</div></div>
    </div>
  </div>
);

/* Karta e lojtarit (si "Player detail" në foto) */
export type PlayerCardProps = {
  firstName: string; lastName: string; photo?: string; team?: { name?: string; logo?: string };
  badge?: string; info?: { label: string; value: React.ReactNode }[]; stats?: { value: React.ReactNode; label: string }[]; statsTitle?: string;
  to?: string; onClick?: () => void; compact?: boolean;
};
export const PlayerDetailCard: React.FC<PlayerCardProps> = ({ firstName, lastName, photo, team, badge, info = [], stats = [], statsTitle = 'Statistikat e lojtarit', to, onClick, compact }) => {
  const body = (
    <div className="overflow-hidden rounded-[24px] border border-[#E6EBF2] bg-[#FAFAFA] shadow-sm transition hover:shadow-md">
      <div className="relative overflow-hidden bg-white px-5 pt-5">
        {team?.logo ? <img src={team.logo} alt="" aria-hidden="true" className="pointer-events-none absolute -right-8 top-2 h-44 w-44 object-contain opacity-[0.12]" /> : null}
        <div className="relative flex items-end justify-between gap-3">
          <div className="min-w-0 pb-5">
            {badge ? <span className="mb-3 inline-block rounded-md bg-[#0F4C81] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">{badge}</span> : null}
            <div className="truncate text-[22px] font-light leading-tight text-[#14214A]">{firstName}</div>
            <div className="break-words text-[30px] font-extrabold uppercase leading-none text-[#14214A]">{lastName}</div>
            <div className="mt-3 flex items-center gap-2 text-[15px] text-[#8A94A6]">{team?.logo ? <img src={team.logo} alt="" className="h-5 w-5 object-contain" /> : null}<span className="truncate">{team?.name || '-'}</span></div>
          </div>
          <div className={`relative shrink-0 self-end ${compact ? 'h-36 w-32' : 'h-44 w-40'}`}>
            {photo ? <img src={photo} alt={`${firstName} ${lastName}`} className="h-full w-full object-contain object-bottom" /> : <div className="flex h-full w-full items-center justify-center rounded-t-3xl bg-[#EEF2F8] text-5xl font-bold text-[#B8C3D6]">{firstName.charAt(0)}{lastName.charAt(0)}</div>}
          </div>
        </div>
      </div>
      {info.length ? <div className="grid gap-1 px-4 pt-5" style={{ gridTemplateColumns: `repeat(${info.length}, minmax(0,1fr))` }}>{info.map(i => <div key={i.label} className="text-center"><div className="text-[14px] text-[#8A94A6]">{i.label}</div><div className="mt-1 text-[17px] font-medium text-[#14214A]">{i.value}</div></div>)}</div> : null}
      {stats.length ? <div className="px-4 pb-5 pt-5"><div className="mb-3 text-[18px] font-semibold text-[#14214A]">{statsTitle}</div><div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0,1fr))` }}>{stats.map(s => <div key={s.label} className="rounded-xl border border-[#E1E7F0] bg-white px-1 py-3 text-center"><div className="text-[26px] font-semibold leading-none text-[#14214A]">{s.value}</div><div className="mt-2 text-[13px] text-[#8A94A6]">{s.label}</div></div>)}</div></div> : <div className="pb-4" />}
    </div>
  );
  if (to) return <Link to={to} className="block">{body}</Link>;
  if (onClick) return <div role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }} className="cursor-pointer">{body}</div>;
  return body;
};

/* Gjen lojtarin në databazë për të plotësuar moshën dhe pozicionin */
export function usePlayerExtras(firstName: string, lastName: string, teamId?: string) {
  const { players } = useData();
  const p = players.find(x => x.firstName?.trim().toLowerCase() === firstName.trim().toLowerCase() && x.lastName?.trim().toLowerCase() === lastName.trim().toLowerCase() && (!teamId || x.teamId === teamId)) || players.find(x => x.firstName?.trim().toLowerCase() === firstName.trim().toLowerCase() && x.lastName?.trim().toLowerCase() === lastName.trim().toLowerCase());
  let age: string | undefined;
  if (p?.birthDate) { const d = new Date(p.birthDate); if (!isNaN(d.getTime())) { const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; if (a > 0 && a < 80) age = `${a} vjeç`; } }
  return { age, position: p?.position, photo: p?.photo };
}

/* Numri i ndeshjeve të luajtura nga skuadra në sezonin aktiv */
export function useTeamPlayed(teamId?: string) {
  const { displayMatches, matches, getActiveSeason } = useData() as any;
  const list: Match[] = displayMatches || matches || [];
  const season = getActiveSeason?.();
  return list.filter(m => m.status === 'finished' && (!season || m.seasonId === season.id) && (m.homeTeamId === teamId || m.awayTeamId === teamId)).length;
}

/* Karta e golashënuesit: përdor lojtarin nga databaza për moshë/pozicion nëse ekziston */
export const ScorerCard: React.FC<{ scorer: { firstName: string; lastName: string; photo?: string; goals: number; teamId: string }; badge?: string; onClick?: () => void; compact?: boolean }> = ({ scorer, badge, onClick, compact }) => {
  const { getTeamById } = useData();
  const team = getTeamById(scorer.teamId);
  const played = useTeamPlayed(scorer.teamId);
  const extra = usePlayerExtras(scorer.firstName, scorer.lastName, scorer.teamId);
  const info = [
    ...(extra.age ? [{ label: 'Mosha', value: extra.age }] : []),
    ...(extra.position ? [{ label: 'Pozicioni', value: extra.position }] : []),
    { label: 'Skuadra', value: team?.name || '-' },
  ];
  return <PlayerDetailCard firstName={scorer.firstName} lastName={scorer.lastName} photo={scorer.photo || extra.photo} team={team} badge={badge} info={info} onClick={onClick} compact={compact}
    stats={[{ value: played, label: 'Ndeshje' }, { value: scorer.goals, label: 'Gola' }, { value: played > 0 ? (scorer.goals / played).toFixed(1) : '0.0', label: 'Mesatare' }]} />;
};
