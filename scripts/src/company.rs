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
        self.upsert_company(pg, id, &detail)?;
        Ok(())
    }

    fn insert_bulk_details(&mut self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        if self.companies.is_empty() {
            return Ok(());
        }
        
        let company_refs: Vec<&CompanyDetails> = self.companies.iter().filter(|company| company.id.is_some()).collect();
        crate::batch_insert_with_retry(
            &company_refs,
            |batch| self.try_insert_company_batch(pg, batch),
            |c| c.id,
            "company",
            0,
        )?;
        self.companies.clear();
        Ok(())
    }

    fn create_table(&self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        let table_name = self.table_name();
        let query = format!(
            "CREATE TABLE IF NOT EXISTS {} (
                id INT4 PRIMARY KEY,
                name TEXT,
                homepage TEXT,
                origin_country TEXT,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )",
            table_name
        );
        pg.batch_execute(&query)?;
        Ok(())
    }
}

impl CompanyGateway {
    fn try_insert_company_batch(
        &self,
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

        let table_name = self.table_name();
        let query = format!(
            "INSERT INTO {} (id, name, homepage, origin_country)
             SELECT * FROM UNNEST($1::INT4[], $2::TEXT[], $3::TEXT[], $4::TEXT[])
             AS t(id, name, homepage, origin_country)
             ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, homepage=EXCLUDED.homepage, origin_country=EXCLUDED.origin_country, updated_at=now()",
            table_name
        );

        transaction.execute(&query, &[&ids, &names, &homepages, &origin_countries])?;

        transaction.commit()?;
        Ok(())
    }

    fn upsert_company(&self, pg: &mut DbClient, id: i32, v: &CompanyDetails) -> Result<(), Box<dyn Error>> {
        let table_name = self.table_name();
        let query = format!(
            "INSERT INTO {} (id, name, homepage, origin_country, updated_at) VALUES ($1,$2,$3,$4, now())
             ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, homepage=EXCLUDED.homepage, origin_country=EXCLUDED.origin_country, updated_at=EXCLUDED.updated_at",
            table_name
        );
        pg.execute(&query, &[&id, &v.name, &v.homepage, &v.origin_country])?;
        Ok(())
    }
}
