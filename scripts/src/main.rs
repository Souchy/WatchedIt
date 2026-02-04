use std::env;
use std::path::Path;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use std::{error::Error, thread::sleep};

use chrono::{Datelike, NaiveDate};
use dotenvy::dotenv;
use postgres::Client;
use serde_json::Value;
use tmdb_client::apis::client::APIClient;

use openssl::error::ErrorStack;
use openssl::ssl::{SslConnector, SslMethod};
use postgres_openssl::MakeTlsConnector;

mod collection;
mod company;
mod keyword;
mod movies;
mod network;
mod person;
mod rate_limiter;
mod tv;

use rate_limiter::RateLimiter;

// Generic retry helper for batch inserts with binary search fallback
pub fn batch_insert_with_retry<T, F, G>(
    items: &[T],
    mut try_insert: F,
    get_id: G,
    type_name: &str,
    depth: usize,
) -> Result<(), Box<dyn Error>>
where
    F: FnMut(&[T]) -> Result<(), Box<dyn Error>>,
    G: Fn(&T) -> Option<i32>,
{
    batch_insert_with_retry_impl(items, &mut try_insert, &get_id, type_name, depth)
}

fn batch_insert_with_retry_impl<T, G>(
    items: &[T],
    try_insert: &mut dyn FnMut(&[T]) -> Result<(), Box<dyn Error>>,
    get_id: &G,
    type_name: &str,
    depth: usize,
) -> Result<(), Box<dyn Error>>
where
    G: Fn(&T) -> Option<i32>,
{
    if items.is_empty() {
        return Ok(());
    }

    // If only one item, try to insert it individually and skip on error
    if items.len() == 1 {
        let result = try_insert(items);
        if let Err(e) = result {
            eprintln!(
                "Skipping {} id {} due to error: {:#?}",
                type_name,
                get_id(&items[0]).unwrap_or(-1),
                e
            );
        }
        return Ok(());
    }

    // Try to insert the whole batch
    let result = try_insert(items);
    if result.is_ok() {
        return Ok(());
    } else if let Err(ref e) = result {
        eprintln!(
            "Batch of {} {} records failed, splitting to isolate error: {:#?}",
            items.len(),
            type_name,
            e
        );
    }

    // If failed, split in half and retry each half
    if depth < 20 {
        let mid = items.len() / 2;
        let (left, right) = items.split_at(mid);
        batch_insert_with_retry_impl(left, try_insert, get_id, type_name, depth + 1)?;
        batch_insert_with_retry_impl(right, try_insert, get_id, type_name, depth + 1)?;
        Ok(())
    } else {
        Err("Max retry depth reached".into())
    }
}

pub trait Gateway {
    fn api_name(&self) -> &str;
    fn table_name(&self) -> String {
        format!("tmdb_{}", self.api_name())
    }
    fn popularity_min(&self) -> f32;
    fn batch_size(&self) -> usize;
    fn fetch_dump(&self);
    fn fetch_details(&mut self, api: &APIClient, id: i32) -> Result<(), tmdb_client::Error>;
    fn insert_details(&mut self, pg: &mut Client) -> Result<(), Box<dyn Error>>;
    fn insert_bulk_details(&mut self, pg: &mut Client) -> Result<(), Box<dyn Error>>;
    fn create_table(&self, pg: &mut Client) -> Result<(), Box<dyn Error>>;

    // Whether this entity type supports the changes API
    fn has_changes_api(&self) -> bool {
        matches!(self.api_name(), "movie" | "tv_series" | "person")
    }
    fn get_changes(
        &self,
        _api: &APIClient,
        _since: NaiveDate,
        _page: i32,
    ) -> Result<tmdb_client::models::ChangesPaginated, tmdb_client::Error> {
        unimplemented!()
    }

    fn get_ids_to_process(
        &self,
        pg: &mut Client,
        candidate_ids: &[i32],
        days_old: i32,
        day_partition: i32,
    ) -> Result<std::collections::HashSet<i32>, Box<dyn Error>> {
        let table_name = self.table_name();
        let query = format!(
            "SELECT c.id 
             FROM unnest($1::int4[]) AS c(id)
             LEFT JOIN {} m ON m.id = c.id
             WHERE m.id IS NULL
                OR (m.updated_at < NOW() - $2::integer * INTERVAL '1 day' AND m.id % 7 = $3)",
            table_name
        );

        let mut ids = std::collections::HashSet::new();

        // Process in chunks to avoid query parameter limits
        const CHUNK_SIZE: usize = 10_000;
        for chunk in candidate_ids.chunks(CHUNK_SIZE) {
            let rows = pg.query(&query, &[&chunk, &days_old, &day_partition])?;
            for row in rows {
                let id: i32 = row.get(0);
                ids.insert(id);
            }
        }

        Ok(ids)
    }
}

fn ssl_config() -> Result<MakeTlsConnector, ErrorStack> {
    let ca_file_path = if cfg!(target_os = "windows") {
        format!(
            "{}\\postgresql\\root.crt",
            env::var("APPDATA").unwrap_or_else(|_| ".".to_string())
        )
    } else {
        format!(
            "{}/.postgresql/root.crt",
            env::var("HOME").unwrap_or_else(|_| ".".to_string())
        )
    };

    eprintln!("Using CA file path: {}", ca_file_path);

    // Verify the existence of the CA file.
    let ca_file = Path::new(&ca_file_path);
    if !ca_file.exists() {
        eprintln!("CA file {} not found!", ca_file_path);
        return Err(ErrorStack::get()); // Return explicit error.
    }

    // Configure OpenSSL with the CA file.
    let mut builder = SslConnector::builder(SslMethod::tls())?;
    builder.set_ca_file(ca_file_path)?;
    Ok(MakeTlsConnector::new(builder.build()))
}

fn main() -> Result<(), Box<dyn Error>> {
    dotenv().ok();

    // date to fetch exports for: use today (UTC)
    let today = chrono::Utc::now().date_naive();

    // create tmdb_client API client (reads API key from env or use provided secret)
    let api_key = env::var("TMDB_API_KEY").ok();
    let api_client = match api_key {
        Some(k) => tmdb_client::apis::client::APIClient::new_with_api_key(k),
        None => tmdb_client::apis::client::APIClient::new_from_env(),
    };

    // connect to Postgres: read DATABASE_URL from .env or env
    // let db_url = env::var("DATABASE_URL").or_else(|_| env::var("POSTGRES_URL"))?;
    // let mut pg = Client::connect(&db_url, NoTls)?;

    // connect to CockroachDB with SSL
    let connector = ssl_config().unwrap();
    let connection_uri = env::var("DATABASE_URL")
        .expect("$DATABASE_URL is not set")
        .to_owned()
        + "&application_name=docs_simplecrud_rust";
    let mut client = Client::connect(&connection_uri, connector).unwrap();
    // let mut client = Client::connect(&connection_uri, NoTls).unwrap();

    new_code(&api_client, &mut client, &today)?;

    Ok(())
}

fn new_code(
    api_client: &APIClient,
    client: &mut Client,
    today: &NaiveDate,
) -> Result<(), Box<dyn Error>> {
    let mut gateways: Vec<Box<dyn Gateway>> = vec![
        Box::new(movies::MovieGateway::new()),
        Box::new(tv::TvGateway::new()),
        Box::new(person::PersonGateway::new()),
        Box::new(keyword::KeywordGateway::new()),
        Box::new(collection::CollectionGateway::new()),
        Box::new(network::NetworkGateway::new()),
        Box::new(company::CompanyGateway::new()),
    ];

    for gateway in &mut gateways {
        eprintln!("processing export type: {}", gateway.api_name());

        // Create table once at the start
        gateway.create_table(client)?;

        let mut candidate_ids: Vec<i32>;
        let filtered_count: usize;

        // if gateway.has_changes_api() {
        //     // Use changes API to get recently changed IDs
        //     eprintln!("Using changes API for {}", gateway.api_name());
        //     let changed_ids = fetch_changes(gateway.as_ref(), api_client)?;
        //     eprintln!("Found {} changed IDs in last week", changed_ids.len());

        //     // Cross-reference with dump for popularity filtering
        //     let dump = fetch_dump(
        //         gateway.api_name(),
        //         &today,
        //         &(gateway.popularity_min() as f64),
        //     );
        //     let dump_ids: std::collections::HashSet<i32> = dump
        //         .iter()
        //         .filter_map(|rec| rec.get("id").and_then(|v| v.as_i64()).map(|id| id as i32))
        //         .collect();

        //     // Keep only changed IDs that meet popularity criteria
        //     candidate_ids = changed_ids
        //         .into_iter()
        //         .filter(|id| dump_ids.contains(id))
        //         .collect();
        //     filtered_count = candidate_ids.len();
        //     eprintln!(
        //         "{} / {} changed IDs meet popularity criteria",
        //         filtered_count,
        //         dump_ids.len()
        //     );
        // } else {
            // Use dump-based approach with stale detection
            eprintln!("Using dump-based approach for {}", gateway.api_name());
            let filtered = fetch_dump(
                gateway.api_name(),
                &today,
                &(gateway.popularity_min() as f64),
            );
            filtered_count = filtered.len();

            candidate_ids = filtered
                .iter()
                .filter_map(|rec| rec.get("id").and_then(|v| v.as_i64()).map(|id| id as i32))
                .collect();

            // Get IDs to process: either new (not in DB) or stale (old + matching today's partition)
            let day_of_week = today.weekday().num_days_from_monday() as i32; // 0-6
            let ids_to_process =
                gateway.get_ids_to_process(client, &candidate_ids, 7, day_of_week)?;

            eprintln!(
                "Processing {}/{} records (new or stale for day {})",
                ids_to_process.len(),
                filtered_count,
                day_of_week
            );

            // Filter to only records we need to process
            candidate_ids = ids_to_process.into_iter().collect();
        // }

        let total_to_process = candidate_ids.len();
        eprintln!(
            "Processing {} records for {}",
            total_to_process,
            gateway.api_name()
        );

        let mut i = 0;
        let mut batch_start = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
        let mut rate_limit_batch_start = SystemTime::now();
        let rate_limit_batch_size = 25; // TMDB advertises 40 req/s but throttles aggressively
        let rate_limit_window = Duration::from_secs(1);
        let mut batch_slept_time = 0;

        for id in candidate_ids {
            // Make the API request
            let result = gateway.fetch_details(&api_client, id);

            if let Err(e) = result {
                eprintln!("error fetching {} id {}: {}", gateway.api_name(), id, e);
            }
            i += 1;

            // Insert every batch_size items
            if i % gateway.batch_size() == 0 {
                let fetch_end = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
                let fetch_time = (fetch_end - batch_start).as_secs_f64();

                let insert_start = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
                gateway.insert_bulk_details(client)?;
                let insert_end = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
                let insert_time = (insert_end - insert_start).as_secs_f64();

                eprintln!(
                    "processed {}/{} records for {} | fetch: {:.2}s, insert: {:.2}s, sleep: {:.2}s, total: {:.2}s",
                    i,
                    total_to_process,
                    gateway.api_name(),
                    fetch_time,
                    insert_time,
                    (batch_slept_time as f64) / 1000.0,
                    fetch_time + insert_time
                );
                batch_slept_time = 0;
            }

            // Every x requests, check if we need to sleep to maintain rate limit
            if i % rate_limit_batch_size == 0 {
                let elapsed = rate_limit_batch_start.elapsed().unwrap_or(Duration::ZERO);
                if elapsed < rate_limit_window {
                    sleep(rate_limit_window - elapsed);
                    batch_slept_time += (rate_limit_window - elapsed).as_millis();
                }
                rate_limit_batch_start = SystemTime::now();
            }

            if i % gateway.batch_size() == 0 {
                batch_start = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
            }
        }

        // Insert any remaining items
        gateway.insert_bulk_details(client)?;
        eprintln!(
            "processed {}/{} records for {}",
            total_to_process,
            total_to_process,
            gateway.api_name()
        );
    }

    Ok(())
}

fn fetch_changes(
    gateway: &dyn Gateway,
    api_client: &APIClient,
) -> Result<Vec<i32>, Box<dyn Error>> {
    // Determine the date one week ago
    let one_week_ago = chrono::Utc::now().date_naive() - chrono::Duration::days(7);

    let mut all_ids = Vec::new();
    let mut page = 1;
    let mut total_pages = None;
    let mut rate_limiter = RateLimiter::new(25, Duration::from_secs(1));

    loop {
        let progress = if let Some(tp) = total_pages {
            format!(" ({}/{})", page, tp)
        } else {
            String::new()
        };
        eprintln!(
            "Fetching changes page {}{} for {}",
            page,
            progress,
            gateway.api_name()
        );

        let response = rate_limiter.request_with_retry(gateway.api_name(), || {
            gateway.get_changes(api_client, one_week_ago, page)
        })?;

        // Store total pages from first response
        if total_pages.is_none() {
            total_pages = response.total_pages;
            if let Some(tp) = total_pages {
                eprintln!("Total pages for {}: {}", gateway.api_name(), tp);
            }
        }

        let results = response.results.unwrap_or_default();
        if results.is_empty() {
            break;
        }

        all_ids.extend(results.into_iter().filter_map(|item| item.id));

        // Check if there are more pages
        if let Some(tp) = total_pages {
            if page >= tp {
                break;
            }
        } else {
            break;
        }
        page += 1;
    }

    eprintln!(
        "Fetched {} total changed IDs for {}",
        all_ids.len(),
        gateway.api_name()
    );
    Ok(all_ids)
}

fn fetch_dump(export_type: &str, date: &NaiveDate, min_popularity: &f64) -> Vec<Value> {
    let records_res: Result<Vec<Value>, _> =
        tmdb_client::files::exports::get_ids(export_type, *date);
    let records = match records_res {
        Ok(r) => r,
        Err(e) => {
            eprintln!("failed to get ids for {}: {}", export_type, e);
            // continue;
            return vec![];
        }
    };

    eprintln!("{} records for {}", records.len(), export_type);
    let total_count = records.len();

    let filtered = records
        .iter()
        .filter(|r| {
            let pop = r.get("popularity").and_then(|v| v.as_f64());
            let adult = r.get("adult").and_then(|v| v.as_bool());
            if let Some(pop_val) = pop
                && pop_val < *min_popularity
            {
                return false;
            }
            if let Some(adult_val) = adult
                && adult_val
            {
                return false;
            }
            // return pop.unwrap() >= 1.0;
            return true;
        })
        .cloned()
        .collect::<Vec<_>>();
    let filtered_count = filtered.len();
    eprintln!(
        "{} / {} valid object records for {}",
        filtered_count, total_count, export_type
    );
    return filtered;
}
