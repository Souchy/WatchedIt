use std::env;
use std::time::Duration;
use std::{error::Error, thread::sleep};

use dotenvy::dotenv;
use postgres::{Client as PgClient, NoTls};
use serde_json::Value;
use tmdb_client::apis::client::APIClient;

type FetchFn = fn(&APIClient, &mut PgClient, &str, i32) -> Result<(), Box<dyn Error>>;
mod collection;
mod company;
mod keyword;
mod movies;
mod network;
mod person;
mod tv;

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
    let db_url = env::var("DATABASE_URL").or_else(|_| env::var("POSTGRES_URL"))?;
    let mut pg = PgClient::connect(&db_url, NoTls)?;

    // exports with associated fetch function to call directly
    let exports: &[(&str, FetchFn, f64)] = &[
        ("movie", movies::fetch_movie, 2.0),
        ("tv_series", tv::fetch_tv, 2.0),
        ("person", person::fetch_person, 1.0),
        ("keyword", keyword::fetch_keyword, 1.0),
        ("collection", collection::fetch_collection, 1.0),
        ("tv_network", network::fetch_network, 1.0),
        // ("production_company", company::fetch_company, 1.0),
    ];

    for (export_type, fetch_fn, min_popularity) in exports {
        eprintln!("processing export type: {}", export_type);

        let records_res: Result<Vec<Value>, _> =
            tmdb_client::files::exports::get_ids(export_type, today);
        let records = match records_res {
            Ok(r) => r,
            Err(e) => {
                eprintln!("failed to get ids for {}: {}", export_type, e);
                continue;
            }
        };

        eprintln!("{} records for {}", records.len(), export_type);
        let mut i = 0;
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
            .collect::<Vec<_>>();
        let filtered_count = filtered.len();
        eprintln!(
            "{} / {} valid object records for {}",
            filtered_count, total_count, export_type
        );

        for rec in filtered {
            let result = fetch_fn(
                &api_client,
                &mut pg,
                export_type,
                rec.get("id").and_then(|v| v.as_i64()).unwrap() as i32,
            );
            if let Err(e) = result {
                eprintln!(
                    "error fetching {} id {}: {}",
                    export_type,
                    rec.get("id").unwrap(),
                    e
                );
            }
            sleep(Duration::from_millis(21)); // rate limit to 50/sec
            i += 1;
            if i % 100 == 0 {
                eprintln!(
                    "processed {}/{} records for {}",
                    i, filtered_count, export_type
                );
            }
        }
    }

    Ok(())
}
