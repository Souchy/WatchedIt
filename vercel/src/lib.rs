use sqlx::{postgres::PgPoolOptions, PgPool};
use std::env;
use tokio::sync::OnceCell;
use vercel_runtime::{Error, Request};
use http_body_util::BodyExt;

static POOL: OnceCell<PgPool> = OnceCell::const_new();

pub async fn get_pool() -> Result<&'static PgPool, Error> {
    POOL.get_or_try_init(|| async {
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
    })
    .await
}

pub async fn parse_json_body<T: serde::de::DeserializeOwned>(request: Request) -> Result<T, Error> {
    // Optional: Validate Content-Type
    if let Some(content_type) = request.headers().get("content-type") {
        if !content_type.to_str()?.contains("application/json") {
            return Err(Error::from("Expected application/json"));
        }
    }
    let body_bytes = request.into_body().collect().await?.to_bytes();
    let payload: T = serde_json::from_slice(&body_bytes)?;
    Ok(payload)
}
