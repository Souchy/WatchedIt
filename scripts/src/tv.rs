use postgres::Client as DbClient;
use std::error::Error;
use tmdb_client::{apis::client::APIClient, models::TvDetails};
use postgres::types::Json;

pub fn fetch_tv(
    api: &APIClient,
    pg: &mut DbClient,
    _kind: &str,
    id: i32,
) -> Result<(), Box<dyn Error>> {
    let d = api.tv_api().get_tv_details(id, None, None, None)?;
    upsert_tv(pg, id, &d)?;
    Ok(())
}

pub fn upsert_tv(pg: &mut DbClient, id: i32, v: &TvDetails) -> Result<(), Box<dyn Error>> {
    pg.batch_execute(
        "CREATE TABLE IF NOT EXISTS tmdb_tv_series (
            id INT4 PRIMARY KEY,
            name TEXT,
            overview TEXT,
            popularity REAL,
            first_air_date TEXT,
            number_of_seasons INT4,
            vote_average REAL,
            vote_count INT4,
            homepage TEXT,
            genres JSONB,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )",
    )?;

    pg.execute(
        "INSERT INTO tmdb_tv_series (id, name, overview, popularity, first_air_date, number_of_seasons, vote_average, vote_count, homepage, genres, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, overview=EXCLUDED.overview, popularity=EXCLUDED.popularity,
         first_air_date=EXCLUDED.first_air_date, number_of_seasons=EXCLUDED.number_of_seasons, vote_average=EXCLUDED.vote_average,
         vote_count=EXCLUDED.vote_count, homepage=EXCLUDED.homepage, updated_at=EXCLUDED.updated_at",
        &[
            &id, 
            &v.name, 
            &v.overview, 
            &v.popularity, 
            &v.first_air_date, 
            &v.number_of_seasons, 
            &v.vote_average, 
            &v.vote_count, 
            &v.homepage.clone().unwrap_or(String::new()), 
            // &serde_json::to_string(&v.genres.clone().unwrap_or(vec![]))?
            &Json(&v.genres.clone().unwrap_or(vec![]))
            // &v.created_by
        ],
    )?;
    Ok(())
}
