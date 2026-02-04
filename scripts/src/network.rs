use postgres::Client as DbClient;
use std::error::Error;
use tmdb_client::{apis::client::APIClient, models::Network};
use crate::Gateway;

pub struct NetworkGateway {
    pub networks: Vec<Network>,
}

impl NetworkGateway {
    pub fn new() -> Self {
        NetworkGateway {
            networks: Vec::new(),
        }
    }
}

impl Gateway for NetworkGateway {
    fn api_name(&self) -> &str {
        "tv_network"
    }

    fn popularity_min(&self) -> f32 {
        1.0
    }

    fn batch_size(&self) -> usize {
        5000
    }

    fn fetch_dump(&self) {}

    fn fetch_details(&mut self, api: &APIClient, id: i32) -> Result<(), tmdb_client::Error> {
        let d = api.networks_api().get_network_details(id)?;
        self.networks.push(d);
        Ok(())
    }

    fn insert_details(&mut self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        let detail = self.networks.pop().ok_or("List of networks is empty")?;
        let id = detail.id.ok_or("Missing network ID")?;
        upsert_network(pg, id, &detail)?;
        Ok(())
    }

    fn insert_bulk_details(&mut self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        if self.networks.is_empty() {
            return Ok(());
        }
        
        let network_refs: Vec<&Network> = self.networks.iter().filter(|network| network.id.is_some()).collect();
        crate::batch_insert_with_retry(
            &network_refs,
            |batch| try_insert_network_batch(pg, batch),
            |n| n.id,
            "network",
            0,
        )?;
        self.networks.clear();
        Ok(())
    }

    fn create_table(&self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        pg.batch_execute(
            "CREATE TABLE IF NOT EXISTS tmdb_network (
				id INT4 PRIMARY KEY,
				name TEXT,
				logopath TEXT,
				origin_country TEXT,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
			)",
        )?;
        Ok(())
    }
}

pub fn fetch_network(
    api: &APIClient,
    pg: &mut DbClient,
    _kind: &str,
    id: i32,
) -> Result<(), Box<dyn Error>> {
    let d = api.networks_api().get_network_details(id)?;
    upsert_network(pg, id, &d)?;
    Ok(())
}

fn try_insert_network_batch(
    pg: &mut DbClient,
    networks: &[&Network],
) -> Result<(), Box<dyn Error>> {
    let mut transaction = pg.transaction()?;

    let ids: Vec<i32> = networks.iter().filter_map(|n| n.id).collect();
    let names: Vec<Option<&str>> = networks.iter().map(|n| n.name.as_deref()).collect();
    let logo_paths: Vec<Option<&str>> = networks
        .iter()
        .map(|n| n.logo_path.as_deref())
        .collect();
    let origin_countries: Vec<Option<&str>> = networks
        .iter()
        .map(|n| n.origin_country.as_deref())
        .collect();

    transaction.execute(
        "INSERT INTO tmdb_network (id, name, logopath, origin_country)
         SELECT * FROM UNNEST($1::INT4[], $2::TEXT[], $3::TEXT[], $4::TEXT[])
         AS t(id, name, logopath, origin_country)
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, logopath=EXCLUDED.logopath, origin_country=EXCLUDED.origin_country, updated_at=now()",
        &[&ids, &names, &logo_paths, &origin_countries],
    )?;

    transaction.commit()?;
    Ok(())
}

pub fn upsert_network(pg: &mut DbClient, id: i32, v: &Network) -> Result<(), Box<dyn Error>> {
    pg.batch_execute(
        "CREATE TABLE IF NOT EXISTS tmdb_network (
			id INT4 PRIMARY KEY,
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
