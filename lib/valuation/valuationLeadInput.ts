/** The band shape a valuation lead is scored on — `central` is the lead score. */
export type LeadBand = { low: number; central: number; high: number };

/** Server-side input for persisting a valuation lead to Attio (chat#1885). */
export type ValuationLeadInput = {
  email: string;
  artistName: string;
  artistId: string;
  valueBand: LeadBand;
  /** Lifetime stream total, when known. */
  lifetimeStreams?: number;
  followerCount?: number;
};
