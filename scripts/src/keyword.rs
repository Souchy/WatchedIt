use std::error::Error;
use tmdb_client::{apis::client::APIClient, models::Keyword};
use postgres::Client as DbClient;
use crate::Gateway;

pub struct KeywordGateway {
    pub keywords: Vec<Keyword>,
}

impl KeywordGateway {
    pub fn new() -> Self {
        KeywordGateway {
            keywords: Vec::new(),
        }
    }
}

impl Gateway for KeywordGateway {
    fn api_name(&self) -> &str {
        "keyword"
    }

    fn popularity_min(&self) -> f32 {
        1.0
    }

    fn batch_size(&self) -> usize {
        5000
    }

    fn fetch_dump(&self) {}

    fn fetch_details(&mut self, api: &APIClient, id: i32) -> Result<(), tmdb_client::Error> {
        let d = api.keywords_api().get_keyword_details(id)?;
        self.keywords.push(d);
        Ok(())
    }

    fn insert_details(&mut self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        let detail = self.keywords.pop().ok_or("List of keywords is empty")?;
        let id = detail.id.ok_or("Missing keyword ID")?;
        upsert_keyword(pg, id, &detail)?;
        Ok(())
    }

    fn insert_bulk_details(&mut self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        if self.keywords.is_empty() {
            return Ok(());
        }
        
        let keyword_refs: Vec<&Keyword> = self.keywords.iter().filter(|keyword| keyword.id.is_some()).collect();
        crate::batch_insert_with_retry(
            &keyword_refs,
            |batch| try_insert_keyword_batch(pg, batch),
            |k| k.id,
            "keyword",
            0,
        )?;
        self.keywords.clear();
        Ok(())
    }

    fn create_table(&self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        pg.batch_execute(
            "CREATE TABLE IF NOT EXISTS tmdb_keyword (
                id INT4 PRIMARY KEY,
                name TEXT,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )",
        )?;
        Ok(())
    }
}

pub fn fetch_keyword(api: &APIClient, pg: &mut DbClient, _kind: &str, id: i32) -> Result<(), Box<dyn Error>> {
    let d = api.keywords_api().get_keyword_details(id)?;
    upsert_keyword(pg, id, &d)?;
    Ok(())
}

fn try_insert_keyword_batch(
    pg: &mut DbClient,
    keywords: &[&Keyword],
) -> Result<(), Box<dyn Error>> {
    let mut transaction = pg.transaction()?;

    let ids: Vec<i32> = keywords.iter().filter_map(|k| k.id).collect();
    let names: Vec<Option<&str>> = keywords.iter().map(|k| k.name.as_deref()).collect();

    transaction.execute(
        "INSERT INTO tmdb_keyword (id, name) SELECT * FROM UNNEST($1::INT4[], $2::TEXT[]) AS t(id, name)
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, updated_at=now()",
        &[&ids, &names],
    )?;

    transaction.commit()?;
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
