/** apify_scraper_runs row — table created in recoupable/database#47
 * (not yet in generated database.types). */
export type ApifyScraperRunRow = {
  run_id: string;
  account_id: string;
  social_id: string | null;
  platform: string | null;
  batch_id: string | null;
  completed_at: string | null;
  new_post_urls: string[] | null;
  created_at?: string;
};
