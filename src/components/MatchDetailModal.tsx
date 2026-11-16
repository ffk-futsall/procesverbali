import React, { useState } from 'react';
import { Match } from '@/types';
import { useData } from '@/context/DataContext';
import { ProtocolDetailsPanel } from './ProtocolLiveMatches';
import { MatchDetailHeader, PillTabs, StatRow } from './ef/EfKit';

function formatDate(iso?: string): string {
  if (!iso) return "";
  const p = iso.split("-");
  if (p.length !== 3) return iso;
  return `${Number(p[2])}/${Number(p[1])}/${p[0]}`;
}

interface Props {
  match: Match | null;
  onClose: () => void;
}

const MatchDetailModal: React.FC<Props> = ({ match, onClose }) => {
  const { getTeamById, getGoalsByMatch, players, competitions, protocolMatches, protocolError } = useData();
  const [activeSection, setActiveSection] = useState<'goals' | 'stats' | 'officials'>('stats');

  if (!match) return null;

  const homeTeam = getTeamById(match.homeTeamId);
  const awayTeam = getTeamById(match.awayTeamId);
  const goals = getGoalsByMatch(match.id);
  const comp = competitions.find(c => c.id === match.competitionId);

  const protocol = protocolMatches.filter(p=>p.portalMatchId===match.id && p.phase!=='setup').sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''))[0];
  if (protocol && match.status !== 'cancelled') {
    const authoritative = match.status==='finished' && match.protocolResult!=='finished' && match.homeScore != null && match.awayScore != null;
    const score = authoritative ? {a:String(match.homeScore),b:String(match.awayScore)} : null;
    const report = score ? {...protocol,phase:'finished',scores:{...protocol.scores,final:score,live:score}} : protocol;
    return <div role="dialog" aria-modal="true" aria-label="Detajet e ndeshjes" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onClose}>
      <div className="relative w-full max-w-[760px] max-h-[95vh] overflow-y-auto bg-[#FAFAFA] rounded-t-[28px] sm:rounded-[28px] shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-[#FAFAFA]/95 backdrop-blur px-4 py-2"><strong className="text-[17px] font-semibold text-[#14214A]">{comp?.name||'Ndeshja'}</strong><button type="button" onClick={onClose} aria-label="Mbyll" className="h-10 w-10 rounded-lg text-2xl text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-blue-600">×</button></div>
        {authoritative && <p className="px-4 pt-2 text-xs text-slate-600">Rezultati zyrtar i portalit; ngjarjet dhe formacionet janë nga procesverbali.</p>}
        <ProtocolDetailsPanel key={protocol.id} match={report} homeLogo={homeTeam?.logo} awayLogo={awayTeam?.logo} stale={protocolError}/>
      </div>
    </div>;
  }


  const getPlayerName = (playerId: string) => {
    const p = players.find(pl => pl.id === playerId);
    return p ? `${p.firstName} ${p.lastName}` : 'I panjohur';
  };

  const isFinished = match.status === 'finished';
  const isLive = match.status === 'live';
  const isPlanned = match.status === 'planned';

  const hasScore = (isFinished || isLive) && match.homeScore != null && match.awayScore != null;
  const hasStats = hasScore || match.possession_home != null || match.shots_home != null || match.fouls_home != null;
  const hasOfficials = match.referee1 || match.referee2 || match.referee3 || match.delegate;

  const sections: { id: 'goals' | 'stats' | 'officials'; label: string }[] = [
    ...(goals.length > 0 ? [{ id: 'goals' as const, label: 'Golat' }] : []),
    ...(hasStats ? [{ id: 'stats' as const, label: 'Statistikat' }] : []),
    ...(hasOfficials ? [{ id: 'officials' as const, label: 'Zyrtarët' }] : []),
  ];
  const current = sections.find(x => x.id === activeSection)?.id ?? sections[0]?.id;
  const score = isPlanned ? (match.time || 'VS') : `${match.homeScore ?? 0} : ${match.awayScore ?? 0}`;
  const statusLabel = isLive ? 'LIVE' : isFinished ? 'Përfunduar' : [formatDate(match.date), match.venue].filter(Boolean).join(' · ');

  return (
    <div role="dialog" aria-modal="true" aria-label="Detajet e ndeshjes" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-lg max-h-[95vh] overflow-y-auto sm:rounded-[28px] rounded-t-[28px] bg-[#FAFAFA] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between bg-[#FAFAFA]/95 backdrop-blur px-4 py-3">
          <button aria-label="Mbyll" onClick={onClose} className="h-10 w-10 rounded-full text-2xl leading-none text-[#14214A] hover:bg-slate-100">←</button>
          <span className="text-[17px] font-semibold text-[#14214A]">Detajet e ndeshjes</span>
          <span className="w-10" />
        </div>
        <MatchDetailHeader competition={comp?.name} week={comp?.type === 'kupa' ? undefined : match.week} home={homeTeam} away={awayTeam} score={score} status={statusLabel} live={isLive} />
        {(match.date || match.time || match.venue) && !isPlanned && (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pb-3 text-[13px] text-[#8A94A6]">
            {match.date && <span>{formatDate(match.date)}</span>}
            {match.time && <span>{match.time}</span>}
            {match.venue && <span>{match.venue}</span>}
          </div>
        )}
        <div className="bg-white rounded-t-[28px] px-5 pt-5 pb-8 min-h-[200px]">
          {sections.length > 0 && <PillTabs tabs={sections} value={current as 'goals' | 'stats' | 'officials'} onChange={setActiveSection} label="Seksionet e ndeshjes" />}
          <div className="mt-6">
            {sections.length === 0 && <p className="py-8 text-center text-sm text-[#8A94A6]">{isPlanned ? 'Ndeshja nuk ka filluar ende.' : 'Nuk ka të dhëna shtesë për këtë ndeshje.'}</p>}

            {current === 'goals' && (
              <div className="space-y-3">
                {[...goals].sort((a, b) => (a.minute || 0) - (b.minute || 0)).map(g => {
                  const isHome = g.teamId === match.homeTeamId;
                  const team = isHome ? homeTeam : awayTeam;
                  return (
                    <div key={g.id} className={`flex items-center gap-3 rounded-2xl border border-[#E6EBF2] bg-white px-4 py-3 ${isHome ? '' : 'flex-row-reverse text-right'}`}>
                      <span className="w-11 shrink-0 text-[15px] font-semibold text-[#F28C28] tabular-nums">{g.minute}'</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-[#14214A]">{getPlayerName(g.playerId)}</p>
                        <p className={`text-[12px] ${g.isOwnGoal ? 'text-red-500' : 'text-[#8A94A6]'}`}>{g.isOwnGoal ? 'Autogol' : 'Gol'}{team?.name ? ` · ${team.name}` : ''}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {current === 'stats' && hasStats && (
              <div className="space-y-6">
                {hasScore && <StatRow label="Gola" a={match.homeScore as number} b={match.awayScore as number} />}
                {match.possession_home != null && <StatRow label="Posedimi" a={match.possession_home} b={match.possession_away ?? 0} suffix="%" fixedTotal={100} />}
                {match.shots_home != null && <StatRow label="Goditjet" a={match.shots_home} b={match.shots_away ?? 0} />}
                {match.fouls_home != null && <StatRow label="Faullet" a={match.fouls_home} b={match.fouls_away ?? 0} />}
              </div>
            )}

            {current === 'officials' && hasOfficials && (
              <div className="space-y-3">
                {[
                  { key: 'referee1', label: 'Gjyqtari 1', value: match.referee1 },
                  { key: 'referee2', label: 'Gjyqtari 2', value: match.referee2 },
                  { key: 'referee3', label: 'Gjyqtari 3', value: match.referee3 },
                  { key: 'delegate', label: 'Delegati', value: match.delegate },
                ].filter(o => o.value).map(o => (
                  <div key={o.key} className="flex items-center justify-between rounded-2xl border border-[#E6EBF2] bg-white px-4 py-3">
                    <span className="text-[13px] text-[#8A94A6]">{o.label}</span>
                    <span className="text-[15px] font-semibold text-[#14214A]">{o.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchDetailModal;
