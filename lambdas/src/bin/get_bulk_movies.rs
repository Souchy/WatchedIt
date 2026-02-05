use lambda_http::{run, service_fn, Body, Error, Request, Response};
use serde::{Deserialize, Serialize};
use sqlx::{types::Json, FromRow, PgPool};
use lambdas::{init_pool, parse_json_body};

#[derive(Debug, Deserialize)]
struct GetBulkMoviesRequest {
    ids: Vec<i32>,
}

#[derive(Debug, Serialize, FromRow)]
struct MovieItem {
    id: i32,
    title: String,
    genres: Json<serde_json::Value>,
    release_date: Option<String>,
    overview: Option<String>,
}

async fn handler(pool: &PgPool, request: Request) -> Result<Response<Body>, Error> {
    let payload: GetBulkMoviesRequest = parse_json_body(&request)?;

    if payload.ids.is_empty() {
        let response = Response::builder()
            .status(400)
            .header("content-type", "application/json")
            .body(Body::Text(
                serde_json::json!({"error": "ids must not be empty"}).to_string(),
            ))?;
        return Ok(response);
    }

    let movies: Vec<MovieItem> = sqlx::query_as(
        r#"
        SELECT
            id,
            title,
            genres,
            release_date::STRING AS release_date,
            overview
        FROM movies
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
        .body(Body::Text(serde_json::to_string(&movies)?))?;

    Ok(response)
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let pool = init_pool().await?;
    let pool_ref = &pool;
    run(service_fn(move |request| handler(pool_ref, request))).await
}
