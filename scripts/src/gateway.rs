use std::error::Error;

use chrono::{DateTime, NaiveDate, Utc};
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

    // How many days before a record is considered stale
    fn stale_window(&self) -> i32 {
        7 // Default 7 days
    }

    fn get_changes(
        &self,
        _api: &APIClient,
        _from: NaiveDate,
        _to: NaiveDate,
        _page: i32,
    ) -> Result<tmdb_client::models::ChangesPaginated, tmdb_client::Error> {
        unimplemented!()
    }

    // Get IDs from candidate list that don't exist in the database
    fn get_new_ids(
        &self,
        pg: &mut Client,
        candidate_ids: &[i32],
    ) -> Result<std::collections::HashSet<i32>, Box<dyn Error>> {
        let table_name = self.table_name();
        
        let query = format!(
            "SELECT c.id 
             FROM unnest($1::int4[]) AS c(id)
             LEFT JOIN {} m ON m.id = c.id
             WHERE m.id IS NULL",
            table_name
        );

        let mut ids = std::collections::HashSet::new();

        // Process in chunks to avoid query parameter limits
        const CHUNK_SIZE: usize = 10_000;
        for chunk in candidate_ids.chunks(CHUNK_SIZE) {
            let rows = pg.query(&query, &[&chunk])?;
            for row in rows {
                let id: i32 = row.get(0);
                ids.insert(id);
            }
        }

        Ok(ids)
    }

    // Get IDs from candidate list that exist in DB but are stale (updated_at < since)
    fn get_ids_older_than_date(
        &self,
        pg: &mut Client,
        candidate_ids: &[i32],
        since: &DateTime<Utc>,
    ) -> Result<std::collections::HashSet<i32>, Box<dyn Error>> {
        let table_name = self.table_name();
        
        let query = format!(
            "SELECT c.id 
             FROM unnest($1::int4[]) AS c(id)
             INNER JOIN {} m ON m.id = c.id
             WHERE m.updated_at < $2",
            table_name
        );

        let mut ids = std::collections::HashSet::new();

        // Process in chunks to avoid query parameter limits
        const CHUNK_SIZE: usize = 10_000;
        for chunk in candidate_ids.chunks(CHUNK_SIZE) {
            let rows = pg.query(&query, &[&chunk, &since])?;
            for row in rows {
                let id: i32 = row.get(0);
                ids.insert(id);
            }
        }

        Ok(ids)
    }

    fn get_ids_to_process(
        &self,
        pg: &mut Client,
        candidate_ids: &[i32],
        since: &DateTime<Utc>,
    ) -> Result<std::collections::HashSet<i32>, Box<dyn Error>> {
        let table_name = self.table_name();

        // For Changes API types: only check for new records (existence)
        // For dump-based types: check for new OR stale records
        let where_clause = if self.has_changes_api() {
            "WHERE m.id IS NULL".to_string()
        } else {
            "WHERE m.id IS NULL OR m.updated_at < $2".to_string()
        };

        let query = format!(
            "SELECT c.id 
             FROM unnest($1::int4[]) AS c(id)
             LEFT JOIN {} m ON m.id = c.id
             {}",
            table_name, where_clause
        );

        let mut ids = std::collections::HashSet::new();

        // Process in chunks to avoid query parameter limits
        const CHUNK_SIZE: usize = 10_000;
        for chunk in candidate_ids.chunks(CHUNK_SIZE) {
            let rows = if self.has_changes_api() {
                pg.query(&query, &[&chunk])?
            } else {
                pg.query(&query, &[&chunk, &since])?
            };
            for row in rows {
                let id: i32 = row.get(0);
                ids.insert(id);
            }
        }

        Ok(ids)
    }

}
