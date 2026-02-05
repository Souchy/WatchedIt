use chrono::{DateTime, Utc};
use postgres::Client as DbClient;
use std::error::Error;


pub struct SyncDates {
	table_name: String,
}

impl SyncDates {
	pub fn new() -> Self {
		Self {
			table_name: "sync_dates".to_string(),
		}
	}

	pub fn drop_table(&self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
		let drop_table_query = format!("DROP TABLE IF EXISTS {};", self.table_name);
		pg.execute(&drop_table_query, &[])?;
		Ok(())
	}
	
	pub fn create_table(&self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
		let create_table_query = format!(
			"
			CREATE TABLE IF NOT EXISTS {} (
				name TEXT PRIMARY KEY,
				last_run_start TIMESTAMPTZ NOT NULL,
				last_run_end TIMESTAMPTZ NOT NULL,
				last_successful_run_start TIMESTAMPTZ NOT NULL
			);
		",
			self.table_name
		);
		pg.execute(&create_table_query, &[])?;
		Ok(())
	}

	pub fn get_sync_date_record(
		&self,
		pg: &mut DbClient,
		name: &str,
	) -> Result<SyncDateRecord, Box<dyn Error>> {
		let select_query = format!(
			"
			SELECT name, last_run_start, last_run_end, last_successful_run_start
			FROM {}
			WHERE name = $1;
		",
			self.table_name
		);

		if let Some(row) = pg.query_opt(&select_query, &[&name])? {
			let record = SyncDateRecord {
				name: row.get("name"),
				last_run_start: row.get("last_run_start"),
				last_run_end: row.get("last_run_end"),
				last_successful_run_start: row.get("last_successful_run_start"),
			};
			Ok(record)
		} else {
			Ok(SyncDateRecord::new(name.to_string()))
		}
	}

	pub fn update_last_run_start(
		&self,
		pg: &mut DbClient,
		name: &str,
		last_run_start: &DateTime<Utc>,
	) -> Result<(), Box<dyn Error>> {
		let upsert_query = format!(
			"
			INSERT INTO {} (name, last_run_start, last_run_end, last_successful_run_start)
			VALUES ($1, $2, $3, $3)
			ON CONFLICT (name) DO UPDATE
			SET last_run_start = $2;
			",
			self.table_name
		);
		let epoch = DateTime::<Utc>::from_timestamp(0, 0).unwrap();
		pg.execute(&upsert_query, &[&name, &last_run_start, &epoch])?;
		Ok(())
	}

	pub fn update_last_run_complete(
		&self,
		pg: &mut DbClient,
		name: &str,
		last_run_end: &DateTime<Utc>,
		last_successful_run_start: &DateTime<Utc>,
	) -> Result<(), Box<dyn Error>> {
		let update_query = format!(
			"
			UPDATE {}
			SET last_run_end = $2, last_successful_run_start = $3
			WHERE name = $1;
			",
			self.table_name
		);
		pg.execute(&update_query, &[&name, &last_run_end, &last_successful_run_start])?;
		Ok(())
	}
}

pub struct SyncDateRecord {
	pub name: String,
	pub last_run_start: DateTime<Utc>,
	pub last_run_end: DateTime<Utc>,
	pub last_successful_run_start: DateTime<Utc>,
}

impl SyncDateRecord {
	pub fn new(name: String) -> Self {
		Self {
			name,
			last_run_start: DateTime::<Utc>::from_timestamp(0, 0).unwrap(),
			last_run_end: DateTime::<Utc>::from_timestamp(0, 0).unwrap(),
			last_successful_run_start: DateTime::<Utc>::from_timestamp(0, 0).unwrap(),
		}
	}
}
