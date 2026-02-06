use serde::{Deserialize, Serialize};
use sqlx::{types::Json, FromRow};
use vercel_runtime::{run, service_fn, Error, Request, Response};
use lambdas::{get_pool, parse_json_body};

#[derive(Debug, Deserialize)]
struct GetBulkTvSeriesRequest {
    ids: Vec<i32>,
}

#[derive(Debug, Serialize, FromRow)]
struct TvSeriesItem {
    id: i32,
    name: String,
    genres: Json<serde_json::Value>,
    first_air_date: Option<String>,
    overview: Option<String>,
}

async fn handler(request: Request) -> Result<Response<String>, Error> {
    let payload: GetBulkTvSeriesRequest = parse_json_body(request).await?;

    if payload.ids.is_empty() {
        let response = Response::builder()
            .status(400)
            .header("content-type", "application/json")
            .body(serde_json::json!({"error": "ids must not be empty"}).to_string())?;
        return Ok(response);
    }

    let pool = get_pool().await?;
    let series: Vec<TvSeriesItem> = sqlx::query_as(
        r#"
        SELECT
            id,
            name,
            genres,
            first_air_date::STRING AS first_air_date,
            overview
        FROM tmdb_tv_series
        WHERE id = ANY($1)
        "#,
    )
    .bind(&payload.ids)
    .fetch_all(pool)
    .await
    .map_err(|err| Error::from(err))?;

    let response = Response::builder()
        .status(200)
        .header("content-type", "application/json")
        .body(serde_json::to_string(&series)?)?;

    Ok(response)
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}
