use std::error::Error;
use tmdb_client::{apis::client::APIClient, models::CollectionObject};
use postgres::Client as DbClient;
use crate::Gateway;

pub struct CollectionGateway {
    pub collections: Vec<CollectionObject>,
}

impl CollectionGateway {
    pub fn new() -> Self {
        CollectionGateway {
            collections: Vec::new(),
        }
    }
}

impl Gateway for CollectionGateway {
    fn api_name(&self) -> &str {
        "collection"
    }

    fn popularity_min(&self) -> f32 {
        1.0
    }

    fn batch_size(&self) -> usize {
        1000
    }

    fn fetch_dump(&self) {}

    fn fetch_details(&mut self, api: &APIClient, id: i32) -> Result<(), tmdb_client::Error> {
        let d = api.collections_api().get_collection_details(id, None)?;
        self.collections.push(d);
        Ok(())
    }

    fn insert_details(&mut self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        let detail = self.collections.pop().ok_or("List of collections is empty")?;
        let id = detail.id.ok_or("Missing collection ID")?;
        self.upsert_collection(pg, id, &detail)?;
        Ok(())
    }

    fn insert_bulk_details(&mut self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        if self.collections.is_empty() {
            return Ok(());
        }
        
        let collection_refs: Vec<&CollectionObject> = self.collections.iter().filter(|collection| collection.id.is_some()).collect();
        crate::util::sql::batch_insert_with_retry(
            &collection_refs,
            |batch| self.try_insert_collection_batch(pg, batch),
            |c| c.id,
            self.api_name(),
            0,
        )?;
        self.collections.clear();
        Ok(())
    }

    fn create_table(&self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        let table_name = self.table_name();
        let query = format!(
            "CREATE TABLE IF NOT EXISTS {} (
                id INT4 PRIMARY KEY,
                name TEXT,
                overview TEXT,
				poster_path TEXT,
				backdrop_path TEXT,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )",
            table_name
        );
        pg.batch_execute(&query)?;
        Ok(())
    }
}

impl CollectionGateway {
    fn try_insert_collection_batch(
        &self,
        pg: &mut DbClient,
        collections: &[&CollectionObject],
    ) -> Result<(), Box<dyn Error>> {
        let mut transaction = pg.transaction()?;

        let ids: Vec<i32> = collections.iter().filter_map(|c| c.id).collect();
        let names: Vec<Option<&str>> = collections.iter().map(|c| c.name.as_deref()).collect();
        let overviews: Vec<Option<&str>> = collections.iter().map(|c| c.overview.as_deref()).collect();
        let poster_paths: Vec<Option<&str>> = collections
            .iter()
            .map(|c| c.poster_path.as_deref())
            .collect();
        let backdrop_paths: Vec<Option<&str>> = collections
            .iter()
            .map(|c| c.backdrop_path.as_deref())
            .collect();

        let table_name = self.table_name();
        let query = format!(
            "INSERT INTO {} (id, name, overview, poster_path, backdrop_path)
             SELECT * FROM UNNEST($1::INT4[], $2::TEXT[], $3::TEXT[], $4::TEXT[], $5::TEXT[])
             AS t(id, name, overview, poster_path, backdrop_path)
             ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, overview=EXCLUDED.overview, poster_path=EXCLUDED.poster_path, backdrop_path=EXCLUDED.backdrop_path, updated_at=now()",
            table_name
        );

        transaction.execute(&query, &[&ids, &names, &overviews, &poster_paths, &backdrop_paths])?;

        transaction.commit()?;
        Ok(())
    }

    fn upsert_collection(&self, pg: &mut DbClient, id: i32, v: &CollectionObject) -> Result<(), Box<dyn Error>> {
        let table_name = self.table_name();
        let query = format!(
            "INSERT INTO {} (id, name, overview, poster_path, backdrop_path, updated_at) VALUES ($1,$2,$3,$4,$5, now())
             ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, overview=EXCLUDED.overview, poster_path=EXCLUDED.poster_path, backdrop_path=EXCLUDED.backdrop_path, updated_at=EXCLUDED.updated_at",
            table_name
        );
        pg.execute(&query, &[&id, &v.name, &v.overview, &v.poster_path, &v.backdrop_path])?;
        Ok(())
    }
}
