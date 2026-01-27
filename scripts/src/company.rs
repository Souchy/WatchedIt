use std::error::Error;
use tmdb_client::{apis::client::APIClient, models::CompanyDetails};
use postgres::Client as PgClient;

pub fn fetch_company(api: &APIClient, pg: &mut PgClient, _kind: &str, id: i32) -> Result<(), Box<dyn Error>> {
    let d = api.companies_api().get_company_details(id)?;
    upsert_company(pg, id, &d)?;
    Ok(())
}

pub fn upsert_company(pg: &mut PgClient, id: i32, v: &CompanyDetails) -> Result<(), Box<dyn Error>> {
    pg.batch_execute(
        "CREATE TABLE IF NOT EXISTS tmdb_company (
            id INTEGER PRIMARY KEY,
            name TEXT,
            homepage TEXT,
            origin_country TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )",
    )?;

    pg.execute(
        "INSERT INTO tmdb_company (id, name, homepage, origin_country, updated_at) VALUES ($1,$2,$3,$4, now())
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, homepage=EXCLUDED.homepage, origin_country=EXCLUDED.origin_country, updated_at=EXCLUDED.updated_at",
        &[&id, &v.name, &v.homepage, &v.origin_country],
		// v.description
		// v.headquarters
		// v.homepage
		// v.id
		// v.logo_path
		// v.name
		// v.origin_country
		// v.parent_company
    )?;
    Ok(())
}
