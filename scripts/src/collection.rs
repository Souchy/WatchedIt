use std::error::Error;
use tmdb_client::{apis::client::APIClient, models::CollectionObject};
use postgres::Client as PgClient;

pub fn fetch_collection(api: &APIClient, pg: &mut PgClient, _kind: &str, id: i32) -> Result<(), Box<dyn Error>> {
    let d = api.collections_api().get_collection_details(id, None)?;
    upsert_collection(pg, id, &d)?;
    Ok(())
}

pub fn upsert_collection(pg: &mut PgClient, id: i32, v: &CollectionObject) -> Result<(), Box<dyn Error>> {
    pg.batch_execute(
        "CREATE TABLE IF NOT EXISTS tmdb_collection (
            id INTEGER PRIMARY KEY,
            name TEXT,
            overview TEXT,
			poster_path TEXT,
			backdrop_path TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )",
    )?;

    pg.execute(
        "INSERT INTO tmdb_collection (id, name, overview, poster_path, backdrop_path, updated_at) VALUES ($1,$2,$3,$4,$5, now())
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, overview=EXCLUDED.overview, poster_path=EXCLUDED.poster_path, backdrop_path=EXCLUDED.backdrop_path, updated_at=EXCLUDED.updated_at",
        &[&id, &v.name, &v.overview, &v.poster_path, &v.backdrop_path],
    )?;
	// v.backdrop_path
	// v.poster_path
	// v.parts.iter().for_each(|part| {
    Ok(())
}
