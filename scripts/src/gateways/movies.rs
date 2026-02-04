use chrono::NaiveDate;
use postgres::Client as DbClient;
use postgres_types::Json;
use std::error::Error;
use tmdb_client::{
    apis::client::APIClient,
    models::{Cast, Crew, MovieDetails},
};

use crate::Gateway;
// use postgres_types::

pub struct MovieGateway {
    pub movies: Vec<MovieDetails>,
}
impl MovieGateway {
    pub fn new() -> Self {
        MovieGateway { movies: Vec::new() }
    }
}
impl Gateway for MovieGateway {
    fn api_name(&self) -> &str {
        "movie"
    }

    fn popularity_min(&self) -> f32 {
        2.0
    }

    fn batch_size(&self) -> usize {
        1000 // Multiple of 40 for rate limiting alignment
    }

    fn fetch_dump(&self) {}

    fn fetch_details(&mut self, api: &APIClient, id: i32) -> Result<(), tmdb_client::Error> {
        let d = api.movies_api().get_movie_details(
            id, None, None, None,
            // Some("videos,images,keywords,credits"),
        )?;
        self.movies.push(d.clone());
        Ok(())
    }

    fn insert_details(&mut self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        let detail = self.movies.pop().ok_or("List of movies is empty")?;
        let id = detail.id.ok_or("Missing movie ID")?;
        self.upsert_movie(pg, id, &detail)?;
        Ok(())
    }

    fn insert_bulk_details(&mut self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        if self.movies.is_empty() {
            return Ok(());
        }
        let movie_refs: Vec<&MovieDetails> = self
            .movies
            .iter()
            .filter(|movie| movie.id.is_some())
            .collect();
        // Use generic retry helper
        crate::util::sql::batch_insert_with_retry(
            &movie_refs,
            |batch| self.try_insert_movies_batch(pg, batch),
            |m| m.id,
            self.api_name(),
            0,
        )?;
        self.movies.clear();
        Ok(())
    }

    fn create_table(&self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        let table_name = self.table_name();
        let query = format!(
            "CREATE TABLE IF NOT EXISTS {} (
                id INT4 PRIMARY KEY,
                title TEXT,
                original_title TEXT,
                overview TEXT,
                popularity REAL,
                release_date TEXT,
                vote_average REAL,
                vote_count INT4,
                homepage TEXT,
				backdrop_path TEXT,
				poster_path TEXT,
				status TEXT,
				revenue BIGINT,
				genres JSONB,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )",
            table_name
        );
        pg.batch_execute(&query)?;
        Ok(())
    }

    fn get_changes(
        &self,
        api: &APIClient,
        since: NaiveDate,
        page: i32,
    ) -> Result<tmdb_client::models::ChangesPaginated, tmdb_client::Error> {
        let changes = api.changes_api().get_movie_changes_paginated(
            Some(since.format("%Y-%m-%d").to_string()),
            None,
            Some(page),
        )?;
        Ok(changes)
    }
}

impl MovieGateway {
    fn try_insert_movies_batch(
        &self,
        pg: &mut DbClient,
        movies: &[&MovieDetails],
    ) -> Result<(), Box<dyn Error>> {
        // Start transaction
        let mut transaction = pg.transaction()?;

        // Prepare arrays for UNNEST
        let ids: Vec<i32> = movies.iter().filter_map(|v| v.id).collect();
        let titles: Vec<Option<&str>> = movies.iter().map(|v| v.title.as_deref()).collect();
        let original_titles: Vec<Option<&str>> =
            movies.iter().map(|v| v.original_title.as_deref()).collect();
        let overviews: Vec<Option<&str>> = movies.iter().map(|v| v.overview.as_deref()).collect();
        let popularities: Vec<Option<f32>> = movies.iter().map(|v| v.popularity).collect();
        let release_dates: Vec<Option<&str>> =
            movies.iter().map(|v| v.release_date.as_deref()).collect();
        let vote_averages: Vec<Option<f32>> = movies.iter().map(|v| v.vote_average).collect();
        let vote_counts: Vec<Option<i32>> = movies.iter().map(|v| v.vote_count).collect();
        let homepages: Vec<Option<&str>> = movies.iter().map(|v| v.homepage.as_deref()).collect();
        let backdrop_paths: Vec<Option<&str>> =
            movies.iter().map(|v| v.backdrop_path.as_deref()).collect();
        let poster_paths: Vec<Option<&str>> =
            movies.iter().map(|v| v.poster_path.as_deref()).collect();
        let statuses: Vec<Option<&str>> = movies.iter().map(|v| v.status.as_deref()).collect();
        let revenues: Vec<Option<i64>> = movies.iter().map(|v| v.revenue).collect();
        let genres_jsons: Vec<Json<Vec<_>>> = movies
            .iter()
            .map(|v| Json(v.genres.clone().unwrap_or(vec![])))
            .collect();

        let table_name = self.table_name();
        let query = format!(
            "INSERT INTO {} (id, title, original_title, overview, popularity, release_date, vote_average, vote_count, homepage, backdrop_path, poster_path, status, revenue, genres)
             SELECT * FROM UNNEST($1::INT4[], $2::TEXT[], $3::TEXT[], $4::TEXT[], $5::REAL[], $6::TEXT[], $7::REAL[], $8::INT4[], $9::TEXT[], $10::TEXT[], $11::TEXT[], $12::TEXT[], $13::INT8[], $14::JSONB[]) 
             AS t(id, title, original_title, overview, popularity, release_date, vote_average, vote_count, homepage, backdrop_path, poster_path, status, revenue, genres)
             ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, original_title=EXCLUDED.original_title, overview=EXCLUDED.overview,
             popularity=EXCLUDED.popularity, release_date=EXCLUDED.release_date, vote_average=EXCLUDED.vote_average, vote_count=EXCLUDED.vote_count,
             homepage=EXCLUDED.homepage, backdrop_path=EXCLUDED.backdrop_path, poster_path=EXCLUDED.poster_path, status=EXCLUDED.status, revenue=EXCLUDED.revenue, genres=EXCLUDED.genres, updated_at=now()",
            table_name
        );

        transaction.execute(
            &query,
            &[
                &ids,
                &titles,
                &original_titles,
                &overviews,
                &popularities,
                &release_dates,
                &vote_averages,
                &vote_counts,
                &homepages,
                &backdrop_paths,
                &poster_paths,
                &statuses,
                &revenues,
                &genres_jsons,
            ],
        )?;

        transaction.commit()?;
        Ok(())
    }

    fn upsert_movie(
        &self,
        pg: &mut DbClient,
        id: i32,
        v: &MovieDetails,
    ) -> Result<(), Box<dyn Error>> {
        let table_name = self.table_name();
        let query = format!(
            "INSERT INTO {} (id, title, original_title, overview, popularity, release_date, vote_average, vote_count, homepage, backdrop_path, poster_path, status, revenue, genres, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb, now())
             ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, original_title=EXCLUDED.original_title, overview=EXCLUDED.overview,
             popularity=EXCLUDED.popularity, release_date=EXCLUDED.release_date, vote_average=EXCLUDED.vote_average, vote_count=EXCLUDED.vote_count,
             homepage=EXCLUDED.homepage, backdrop_path=EXCLUDED.backdrop_path, poster_path=EXCLUDED.poster_path, status=EXCLUDED.status, revenue=EXCLUDED.revenue, genres=EXCLUDED.genres, updated_at=EXCLUDED.updated_at",
            table_name
        );

        let insert_result = pg.execute(
            &query,
            &[
                &id,
                &v.title,
                &v.original_title,
                &v.overview,
                &v.popularity,
                &v.release_date,
                &v.vote_average,
                &v.vote_count,
                &v.homepage,
                &v.backdrop_path,
                &v.poster_path,
                &v.status,
                &v.revenue,
                &Json(&v.genres.clone().unwrap_or(vec![])),
            ],
        );
        if let Err(e) = insert_result {
            println!("Error inserting/updating {} id {}: {}", table_name, id, e);
            return Err(Box::new(e));
        }

        Ok(())
    }
}

pub fn upsert_crew(_pg: &mut DbClient, _movie_id: i32, _crew: &Crew) -> Result<(), Box<dyn Error>> {
    Ok(())
}

pub fn upsert_cast(pg: &mut DbClient, movie_id: i32, cast: &Cast) -> Result<(), Box<dyn Error>> {
    pg.batch_execute(
        "
	CREATE TABLE IF NOT EXISTS tmb_cast (
		movie_id INT4,
		person_id INT4,
		character TEXT,
		cast_order INT4,
		updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
		PRIMARY KEY (movie_id, person_id)
	)",
    )?;

    pg.execute(
		"INSERT INTO tmb_cast (movie_id, person_id, character, cast_order, updated_at)
		 VALUES ($1,$2,$3,$4, now())
		 ON CONFLICT (movie_id, person_id) DO UPDATE SET character=EXCLUDED.character, cast_order=EXCLUDED.cast_order, updated_at=EXCLUDED.updated_at",
		&[
			&movie_id,
			&cast.id, // person_id, ex: 287
			&cast.credit_id, // "Credits" object id? ex: 52fe4250c3a36847f80149f7
			&cast.cast_id, // ??, ex: 5
			&cast.name, // ex: rad Pitt
			&cast.character,
			&cast.order,
			&cast.profile_path
		],
	)?;

    Ok(())
}
