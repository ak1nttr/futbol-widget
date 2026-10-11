// Only the fields of Sofascore's responses that the widget uses.

export interface Team {
  id: number;
  name: string;
  shortName?: string;
  nameCode?: string;
  national?: boolean;
  gender?: string;
  teamColors?: { primary: string; secondary: string; text: string };
  country?: { name: string };
}

export interface UniqueTournament {
  id: number;
  name: string;
  category?: { name: string; flag?: string };
}

export interface Score {
  current?: number;
  display?: number;
  period1?: number;
  period2?: number;
}

export type StatusType = "notstarted" | "inprogress" | "finished" | "postponed" | "canceled" | string;

export interface MatchEvent {
  id: number;
  startTimestamp: number;
  status: { code: number; description: string; type: StatusType };
  homeTeam: Team;
  awayTeam: Team;
  homeScore: Score;
  awayScore: Score;
  winnerCode?: 1 | 2 | 3;
  tournament: { name: string; uniqueTournament?: UniqueTournament };
  season?: { id: number; name?: string; year?: string };
  roundInfo?: { round?: number; name?: string };
  time?: { currentPeriodStartTimestamp?: number; injuryTime1?: number; injuryTime2?: number };
}

export interface Player {
  id: number;
  name: string;
  shortName?: string;
  position?: "G" | "D" | "M" | "F" | string;
  jerseyNumber?: string;
  shirtNumber?: number;
  country?: { name: string; alpha2?: string };
  dateOfBirthTimestamp?: number;
}

export interface LineupPlayer {
  player: Player;
  shirtNumber?: number;
  position?: string;
  substitute: boolean;
  captain?: boolean;
  statistics?: { rating?: number; minutesPlayed?: number; goals?: number; goalAssist?: number };
}

export interface Lineups {
  confirmed: boolean;
  home: { players: LineupPlayer[]; formation?: string };
  away: { players: LineupPlayer[]; formation?: string };
}

export interface Incident {
  incidentType: "goal" | "card" | "substitution" | "period" | "injuryTime" | "varDecision" | string;
  incidentClass?: string;
  time?: number;
  addedTime?: number;
  isHome?: boolean;
  player?: Player;
  playerName?: string;
  assist1?: Player;
  homeScore?: number;
  awayScore?: number;
  text?: string;
}

export interface SeasonRating {
  player: Player;
  statistics: { rating: number; appearances?: number };
}
