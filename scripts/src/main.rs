use std::env;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use std::{error::Error, thread::sleep};

use chrono::{DateTime, NaiveDate, Timelike, Utc};
use dotenvy::dotenv;
use postgres::Client;
use serde_json::Value;
use tmdb_client::apis::client::APIClient;

use gateway::Gateway;
use rate_limiter::RateLimiter;

pub mod gateway;
pub mod gateways;
pub mod rate_limiter;
pub mod sync_dates;
pub mod util;

const FILTER_ADULT_CONTENT: bool = true;

fn main() -> Result<(), Box<dyn Error>> {
    dotenv().ok();

    // TMDB exports are generated at 8:00 AM UTC
    // Use yesterday's dump if before 8 AM, otherwise use today's
    let now_utc = chrono::Utc::now();
    let now = now_utc;

    let dump_date = if now_utc.hour() < 8 {
        (now_utc - chrono::Duration::days(1)).date_naive()
    } else {
        now_utc.date_naive()
    };

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
    let connector = util::ssl::ssl_config().unwrap();
    let connection_uri = env::var("DATABASE_URL")
        .expect("$DATABASE_URL is not set")
        .to_owned()
        + "&application_name=docs_simplecrud_rust";
    let mut client = Client::connect(&connection_uri, connector).unwrap();
    // let mut client = Client::connect(&connection_uri, NoTls).unwrap();

    new_code(&api_client, &mut client, &now, &dump_date)?;

    Ok(())
}

fn new_code(
    api_client: &APIClient,
    client: &mut Client,
    now: &DateTime<Utc>,
    dump_date: &NaiveDate,
) -> Result<(), Box<dyn Error>> {
    let mut gateways: Vec<Box<dyn Gateway>> = vec![
        Box::new(gateways::movies::MovieGateway::new()),
        Box::new(gateways::tv_series::TvGateway::new()),
        Box::new(gateways::person::PersonGateway::new()),
        Box::new(gateways::keyword::KeywordGateway::new()),
        Box::new(gateways::collection::CollectionGateway::new()),
        Box::new(gateways::tv_network::NetworkGateway::new()),
        Box::new(gateways::company::CompanyGateway::new()),
    ];

    let sync_dates = sync_dates::SyncDates::new();
    // sync_dates.drop_table(client)?;
    sync_dates.create_table(client)?;

    for gateway in &mut gateways {
        eprintln!("================================");
        eprintln!("Processing export type: {}", gateway.api_name());

        // Create table once at the start
        gateway.create_table(client)?;

        let dump_ids = fetch_dump(
            gateway.api_name(),
            dump_date,
            &(gateway.popularity_min() as f64),
        );

        let sync_dates_record = sync_dates.get_sync_date_record(client, gateway.api_name())?;
        let dates = vec![
            sync_dates_record.last_run_start,
            sync_dates_record.last_run_end,
            sync_dates_record.last_successful_run_start,
        ];
        let oldest_date = dates.iter().min().unwrap();
        let youngest_date = dates.iter().max().unwrap();
        let time_since_last_run = chrono::Utc::now() - sync_dates_record.last_successful_run_start;

        // Update last run start time
        sync_dates.update_last_run_start(client, gateway.api_name(), now)?;

        eprintln!("Last run start: {}", sync_dates_record.last_run_start);
        eprintln!("Last run end: {}", sync_dates_record.last_run_end);
        eprintln!(
            "Last successful run start: {}",
            sync_dates_record.last_successful_run_start
        );
        eprintln!("Current time: {}", now);
        eprintln!(
            "Time since last successful run: {} days",
            time_since_last_run.num_days()
        );
        eprintln!("Dump date used: {}", dump_date);

        let new_ids = gateway.get_new_ids(client, &dump_ids)?;
        eprintln!("{} new IDs from dump", new_ids.len());
        let mut ids = new_ids;

        // The maximum change window on TMDB is 14 days.
        // If the last successful run was before that, we update all stale records.
        if gateway.has_changes_api() && time_since_last_run.num_days() < 14 {
            /*
            If last run failed:
                period_a = last_successful_run_start -> last_run_start  (Process the failed period again to cover missed changes)
                period_b = last_run_start -> now  (Process the new period)
            else
                period_a = last_run_start -> last_run_end  (Process the changes during the last run, small window of 6 hours on github actions)
                period_b = last_run_end -> now  (Process the new period)
             */

            // minus 1 day to avoid overlapping the exact timestamp
            let youngest_date_excluded = youngest_date.clone() - chrono::Duration::days(1);
            if oldest_date.date_naive() <= youngest_date_excluded.date_naive() {
                let period_a_ids =
                    fetch_all_changes(gateway.as_ref(), api_client, oldest_date, youngest_date)?;
                let period_a_ids =
                    gateway.get_ids_older_than_date(client, &period_a_ids, youngest_date)?;
                eprintln!(
                    "{} total stale IDs from changes API period A",
                    period_a_ids.len()
                );
                ids.extend(period_a_ids);
            }
            if youngest_date.date_naive() <= now.date_naive() {
                let period_b_ids =
                    fetch_all_changes(gateway.as_ref(), api_client, youngest_date, now)?;
                // need to process all until now because last run couldve updated records yesterday, but if it changed today again, we need to get that too
                let period_b_ids = gateway.get_ids_older_than_date(client, &period_b_ids, now)?;
                eprintln!(
                    "{} total stale IDs from changes API period B",
                    period_b_ids.len()
                );
                ids.extend(period_b_ids);
            }
        } else {
            let stale_since = *now - chrono::Duration::days(gateway.stale_window() as i64);
            let stale_ids = gateway.get_ids_older_than_date(client, &dump_ids, &stale_since)?;
            eprintln!("{} total stale IDs from dump stale check", stale_ids.len());
            ids.extend(stale_ids);
        }

        let ids_list = ids.into_iter().collect::<Vec<_>>();
        let total_to_process = ids_list.len();
        eprintln!(
            "Processing {} records for {}",
            total_to_process,
            gateway.api_name()
        );

        process_ids(gateway.as_mut(), api_client, client, ids_list)?;

        sync_dates.update_last_run_complete(
            client,
            gateway.api_name(),
            &chrono::Utc::now(),
            now,
        )?;
    }

    Ok(())
}

fn process_ids(
    gateway: &mut dyn Gateway,
    api_client: &APIClient,
    client: &mut Client,
    ids: Vec<i32>,
) -> Result<(), Box<dyn Error>> {
    let total_to_process = ids.len();
    let mut i = 0;
    let mut batch_start = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    let mut rate_limit_batch_start = SystemTime::now();
    let rate_limit_batch_size = 25; // TMDB advertises 40 req/s but throttles aggressively
    let rate_limit_window = Duration::from_secs(1);
    let mut batch_slept_time = 0;

    for id in ids {
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
    Ok(())
}

fn fetch_all_changes(
    gateway: &dyn Gateway,
    api_client: &APIClient,
    from: &DateTime<Utc>,
    to: &DateTime<Utc>,
    // since_days: i64,
) -> Result<Vec<i32>, Box<dyn Error>> {
    if gateway.has_changes_api() == false {
        return Ok(vec![]);
    }
    // Determine the date one week ago
    // let from = chrono::Utc::now().date_naive() - chrono::Duration::days(since_days);
    // let to = chrono::Utc::now().date_naive();

    let mut all_ids = Vec::new();
    let mut page = 1;
    let mut total_pages = None;
    let mut rate_limiter = RateLimiter::new(25, Duration::from_secs(1));

    loop {
        let response = rate_limiter.request_with_retry(gateway.api_name(), || {
            gateway.get_changes(api_client, from.date_naive(), to.date_naive(), page)
        })?;

        // Store total pages from first response
        if total_pages.is_none() {
            total_pages = response.total_pages;
            if let Some(tp) = total_pages {
                eprintln!(
                    "Fetching changes for {} between {} and {}. Total pages: {}",
                    gateway.api_name(),
                    from,
                    to,
                    tp
                );
            }
        }

        let results = response.results.unwrap_or_default();
        if results.is_empty() {
            break;
        }

        all_ids.extend(results.into_iter().filter_map(|item| {
            // Filter out adult content
            if FILTER_ADULT_CONTENT && item.adult == Some(true) {
                return None;
            }
            item.id
        }));

        // Check if there are more pages
        if page >= total_pages.unwrap_or(0) {
            break;
        }
        page += 1;
    }

    eprintln!(
        "Fetched {} total changed IDs ({} pages) for {}",
        all_ids.len(),
        total_pages.unwrap_or(0),
        gateway.api_name()
    );
    Ok(all_ids)
}

fn fetch_dump(export_type: &str, date: &NaiveDate, min_popularity: &f64) -> Vec<i32> {
    let records_res: Result<Vec<Value>, _> =
        tmdb_client::files::exports::get_ids(export_type, *date);
    let records = match records_res {
        Ok(r) => r,
        Err(e) => {
            eprintln!("failed to get ids for {}: {}", export_type, e);
            return Vec::new();
        }
    };

    eprintln!("{} dump records for {}", records.len(), export_type);
    let total_count = records.len();

    let filtered: Vec<i32> = records
        .iter()
        .filter_map(|r| {
            let pop = r.get("popularity").and_then(|v| v.as_f64());
            let adult = r.get("adult").and_then(|v| v.as_bool());
            if let Some(pop_val) = pop
                && pop_val < *min_popularity
            {
                return None;
            }
            if FILTER_ADULT_CONTENT
                && let Some(adult_val) = adult
                && adult_val
            {
                return None;
            }
            r.get("id").and_then(|v| v.as_i64()).map(|id| id as i32)
        })
        .collect();

    let filtered_count = filtered.len();
    eprintln!(
        "{} / {} filtered dump records for {} (popularity >= {}, adult = false)",
        filtered_count, total_count, export_type, min_popularity
    );
    filtered
}
