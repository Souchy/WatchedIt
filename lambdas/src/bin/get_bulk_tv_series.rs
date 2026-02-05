use lambda_http::{run, service_fn, Body, Error, Request, Response};
use serde::{Deserialize, Serialize};
use sqlx::{types::Json, FromRow, PgPool};
use lambdas::{init_pool, parse_json_body};

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

async fn handler(pool: &PgPool, request: Request) -> Result<Response<Body>, Error> {
    let payload: GetBulkTvSeriesRequest = parse_json_body(&request)?;

    if payload.ids.is_empty() {
        let response = Response::builder()
            .status(400)
            .header("content-type", "application/json")
            .body(Body::Text(
                serde_json::json!({"error": "ids must not be empty"}).to_string(),
            ))?;
        return Ok(response);
    }

    let series: Vec<TvSeriesItem> = sqlx::query_as(
        r#"
        SELECT
            id,
            name,
            genres,
            first_air_date::STRING AS first_air_date,
            overview
        FROM tv_series
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
        .body(Body::Text(serde_json::to_string(&series)?))?;

    Ok(response)
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let pool = init_pool().await?;
    let pool_ref = &pool;
    run(service_fn(move |request| handler(pool_ref, request))).await
}
