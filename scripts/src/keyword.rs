use std::error::Error;
use tmdb_client::{apis::client::APIClient, models::Keyword};
use postgres::Client as DbClient;

pub fn fetch_keyword(api: &APIClient, pg: &mut DbClient, _kind: &str, id: i32) -> Result<(), Box<dyn Error>> {
    let d = api.keywords_api().get_keyword_details(id)?;
    upsert_keyword(pg, id, &d)?;
    Ok(())
}

pub fn upsert_keyword(pg: &mut DbClient, id: i32, v: &Keyword) -> Result<(), Box<dyn Error>> {
    pg.batch_execute(
        "CREATE TABLE IF NOT EXISTS tmdb_keyword (
            id INT4 PRIMARY KEY,
            name TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )",
    )?;

    pg.execute(
        "INSERT INTO tmdb_keyword (id, name, updated_at) VALUES ($1,$2, now()) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, updated_at=EXCLUDED.updated_at",
        &[&id, &v.name],
    )?;
    Ok(())
}
