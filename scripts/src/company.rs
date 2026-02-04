use std::error::Error;
use tmdb_client::{apis::client::APIClient, models::CompanyDetails};
use postgres::Client as DbClient;
use crate::Gateway;

pub struct CompanyGateway {
    pub companies: Vec<CompanyDetails>,
}

impl CompanyGateway {
    pub fn new() -> Self {
        CompanyGateway {
            companies: Vec::new(),
        }
    }
}

impl Gateway for CompanyGateway {
    fn api_name(&self) -> &str {
        "production_company"
    }

    fn popularity_min(&self) -> f32 {
        1.0
    }

    fn batch_size(&self) -> usize {
        5000
    }

    fn fetch_dump(&self) {}

    fn fetch_details(&mut self, api: &APIClient, id: i32) -> Result<(), tmdb_client::Error> {
        let d = api.companies_api().get_company_details(id)?;
        self.companies.push(d);
        Ok(())
    }

    fn insert_details(&mut self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        let detail = self.companies.pop().ok_or("List of companies is empty")?;
        let id = detail.id.ok_or("Missing company ID")?;
        upsert_company(pg, id, &detail)?;
        Ok(())
    }

    fn insert_bulk_details(&mut self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        if self.companies.is_empty() {
            return Ok(());
        }
        
        let company_refs: Vec<&CompanyDetails> = self.companies.iter().filter(|company| company.id.is_some()).collect();
        crate::batch_insert_with_retry(
            &company_refs,
            |batch| try_insert_company_batch(pg, batch),
            |c| c.id,
            "company",
            0,
        )?;
        self.companies.clear();
        Ok(())
    }

    fn create_table(&self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        pg.batch_execute(
            "CREATE TABLE IF NOT EXISTS tmdb_company (
                id INT4 PRIMARY KEY,
                name TEXT,
                homepage TEXT,
                origin_country TEXT,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )",
        )?;
        Ok(())
    }
}

pub fn fetch_company(api: &APIClient, pg: &mut DbClient, _kind: &str, id: i32) -> Result<(), Box<dyn Error>> {
    let d = api.companies_api().get_company_details(id)?;
    upsert_company(pg, id, &d)?;
    Ok(())
}

fn try_insert_company_batch(
    pg: &mut DbClient,
    companies: &[&CompanyDetails],
) -> Result<(), Box<dyn Error>> {
    let mut transaction = pg.transaction()?;

    let ids: Vec<i32> = companies.iter().filter_map(|c| c.id).collect();
    let names: Vec<Option<&str>> = companies.iter().map(|c| c.name.as_deref()).collect();
    let homepages: Vec<Option<&str>> = companies.iter().map(|c| c.homepage.as_deref()).collect();
    let origin_countries: Vec<Option<&str>> = companies
        .iter()
        .map(|c| c.origin_country.as_deref())
        .collect();

    transaction.execute(
        "INSERT INTO tmdb_company (id, name, homepage, origin_country)
         SELECT * FROM UNNEST($1::INT4[], $2::TEXT[], $3::TEXT[], $4::TEXT[])
         AS t(id, name, homepage, origin_country)
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, homepage=EXCLUDED.homepage, origin_country=EXCLUDED.origin_country, updated_at=now()",
        &[&ids, &names, &homepages, &origin_countries],
    )?;

    transaction.commit()?;
    Ok(())
}

pub fn upsert_company(pg: &mut DbClient, id: i32, v: &CompanyDetails) -> Result<(), Box<dyn Error>> {
    pg.batch_execute(
        "CREATE TABLE IF NOT EXISTS tmdb_company (
            id INT4 PRIMARY KEY,
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
