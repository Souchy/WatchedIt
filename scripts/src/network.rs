use postgres::Client as PgClient;
use std::error::Error;
use tmdb_client::{apis::client::APIClient, models::Network};

pub fn fetch_network(
    api: &APIClient,
    pg: &mut PgClient,
    _kind: &str,
    id: i32,
) -> Result<(), Box<dyn Error>> {
    let d = api.networks_api().get_network_details(id)?;
    upsert_network(pg, id, &d)?;
    Ok(())
}

pub fn upsert_network(pg: &mut PgClient, id: i32, v: &Network) -> Result<(), Box<dyn Error>> {
    pg.batch_execute(
        "CREATE TABLE IF NOT EXISTS tmdb_network (
			id INTEGER PRIMARY KEY,
			name TEXT,
			logopath TEXT,
			origin_country TEXT,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)",
    )?;
    pg.execute(
		"INSERT INTO tmdb_network (id, name, logopath, origin_country, updated_at) VALUES ($1,$2,$3,$4, now())
		 ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, logopath=EXCLUDED.logopath, origin_country=EXCLUDED.origin_country, updated_at=EXCLUDED.updated_at",
		&[&id, &v.name, &v.logo_path, &v.origin_country],
	)?;
    Ok(())
}
