use std::error::Error;
use tmdb_client::{apis::client::APIClient, models::PersonDetails};
use postgres::Client as PgClient;

pub fn fetch_person(api: &APIClient, pg: &mut PgClient, _kind: &str, id: i32) -> Result<(), Box<dyn Error>> {
    let d = api.people_api().get_person_details(id, None, None, None)?;
    upsert_person(pg, id, &d)?;
    Ok(())
}

pub fn upsert_person(pg: &mut PgClient, id: i32, v: &PersonDetails) -> Result<(), Box<dyn Error>> {
    pg.batch_execute(
        "CREATE TABLE IF NOT EXISTS tmdb_person (
            id INTEGER PRIMARY KEY,
            name TEXT,
            biography TEXT,
            popularity REAL,
            birthday TEXT,
            deathday TEXT,
            place_of_birth TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )",
    )?;

    pg.execute(
        "INSERT INTO tmdb_person (id, name, biography, popularity, birthday, deathday, place_of_birth, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now())
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, biography=EXCLUDED.biography, popularity=EXCLUDED.popularity,
         birthday=EXCLUDED.birthday, deathday=EXCLUDED.deathday, place_of_birth=EXCLUDED.place_of_birth, updated_at=EXCLUDED.updated_at",
        &[&id, &v.name, &v.biography, &v.popularity, &v.birthday, &v.deathday, &v.place_of_birth],
    )?;
    Ok(())
}
