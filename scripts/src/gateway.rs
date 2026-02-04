use std::error::Error;

use chrono::NaiveDate;
use postgres::Client;
use tmdb_client::apis::client::APIClient;

pub trait Gateway {
    fn api_name(&self) -> &str;
    fn table_name(&self) -> String {
        format!("tmdb_{}", self.api_name())
    }
    fn popularity_min(&self) -> f32;
    fn batch_size(&self) -> usize;
    fn fetch_dump(&self);
    fn fetch_details(&mut self, api: &APIClient, id: i32) -> Result<(), tmdb_client::Error>;
    fn insert_details(&mut self, pg: &mut Client) -> Result<(), Box<dyn Error>>;
    fn insert_bulk_details(&mut self, pg: &mut Client) -> Result<(), Box<dyn Error>>;
    fn create_table(&self, pg: &mut Client) -> Result<(), Box<dyn Error>>;

    // Whether this entity type supports the changes API
    fn has_changes_api(&self) -> bool {
        matches!(self.api_name(), "movie" | "tv_series" | "person")
    }
    fn get_changes(
        &self,
        _api: &APIClient,
        _since: NaiveDate,
        _page: i32,
    ) -> Result<tmdb_client::models::ChangesPaginated, tmdb_client::Error> {
        unimplemented!()
    }

    fn get_ids_to_process(
        &self,
        pg: &mut Client,
        candidate_ids: &[i32],
        days_old: i32,
        day_partition: i32,
    ) -> Result<std::collections::HashSet<i32>, Box<dyn Error>> {
        let table_name = self.table_name();
        let query = format!(
            "SELECT c.id 
             FROM unnest($1::int4[]) AS c(id)
             LEFT JOIN {} m ON m.id = c.id
             WHERE m.id IS NULL
                OR (m.updated_at < NOW() - $2::integer * INTERVAL '1 day' AND m.id % 7 = $3)",
            table_name
        );

        let mut ids = std::collections::HashSet::new();

        // Process in chunks to avoid query parameter limits
        const CHUNK_SIZE: usize = 10_000;
        for chunk in candidate_ids.chunks(CHUNK_SIZE) {
            let rows = pg.query(&query, &[&chunk, &days_old, &day_partition])?;
            for row in rows {
                let id: i32 = row.get(0);
                ids.insert(id);
            }
        }

        Ok(ids)
    }
}
