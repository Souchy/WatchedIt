use lambda_http::{Body, Error, Request};
use serde::de::DeserializeOwned;
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::env;

pub async fn init_pool() -> Result<PgPool, Error> {
    dotenvy::dotenv().ok();

    let database_url = env::var("DATABASE_URL").map_err(|_| {
        Error::from(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "DATABASE_URL is not set",
        ))
    })?;

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .map_err(|err| Error::from(err))?;

    Ok(pool)
}

pub fn parse_json_body<T: DeserializeOwned>(request: &Request) -> Result<T, Error> {
    let body = request.body();
    let payload = match body {
        Body::Text(text) => serde_json::from_str(text),
        Body::Binary(bytes) => serde_json::from_slice(bytes),
        Body::Empty => serde_json::from_str("{}"),
        &_ => serde_json::from_str("{}"),
    }
    .map_err(|err| Error::from(err))?;

    Ok(payload)
}
