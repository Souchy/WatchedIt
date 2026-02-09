use postgres::Client as DbClient;
use std::error::Error;
use tmdb_client::{apis::client::APIClient, models::TvDetails};
use postgres::types::Json;
use chrono::NaiveDate;
use crate::Gateway;

pub struct TvGateway {
    pub tv_shows: Vec<TvDetails>,
}

impl TvGateway {
    pub fn new() -> Self {
        TvGateway {
            tv_shows: Vec::new(),
        }
    }
}

impl Gateway for TvGateway {
    fn api_name(&self) -> &str {
        "tv_series"
    }

    fn popularity_min(&self) -> f32 {
        2.0
    }

    fn batch_size(&self) -> usize {
        1000
    }

    fn fetch_dump(&self) {}

    fn fetch_details(&mut self, api: &APIClient, id: i32) -> Result<(), tmdb_client::Error> {
        let d = api.tv_api().get_tv_details(id, None, None, None)?;
        self.tv_shows.push(d.clone());
        Ok(())
    }

    fn insert_details(&mut self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        let detail = self.tv_shows.pop().ok_or("List of TV shows is empty")?;
        let id = detail.id.ok_or("Missing TV show ID")?;
        self.upsert_tv(pg, id, &detail)?;
        Ok(())
    }

    fn insert_bulk_details(&mut self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        if self.tv_shows.is_empty() {
            return Ok(());
        }
        
        let tv_refs: Vec<&TvDetails> = self.tv_shows.iter().filter(|tv| tv.id.is_some()).collect();
        crate::util::sql::batch_insert_with_retry(
            &tv_refs,
            |batch| self.try_insert_tv_batch(pg, batch),
            |t| t.id,
            self.api_name(),
            0,
        )?;
        self.tv_shows.clear();
        Ok(())
    }

    fn create_table(&self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        let table_name = self.table_name();
        let query = format!(
            "CREATE TABLE IF NOT EXISTS {} (
                id INT4 PRIMARY KEY,
                name TEXT,
                overview TEXT,
                popularity REAL,
                first_air_date TEXT,
                number_of_seasons INT4,
                vote_average REAL,
                vote_count INT4,
                homepage TEXT,
                backdrop_path TEXT,
                poster_path TEXT,
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
        from: NaiveDate,
        to: NaiveDate,
        page: i32,
    ) -> Result<tmdb_client::models::ChangesPaginated, tmdb_client::Error> {
        let changes = api.changes_api().get_tv_changes_paginated(
            Some(from.format("%Y-%m-%d").to_string()),
            Some(to.format("%Y-%m-%d").to_string()),
            Some(page),
        )?;
        Ok(changes)
    }
}

impl TvGateway {
    fn try_insert_tv_batch(
        &self,
        pg: &mut DbClient,
        tv_shows: &[&TvDetails],
    ) -> Result<(), Box<dyn Error>> {
        let mut transaction = pg.transaction()?;

        let ids: Vec<i32> = tv_shows.iter().filter_map(|v| v.id).collect();
        let names: Vec<Option<&str>> = tv_shows.iter().map(|v| v.name.as_deref()).collect();
        let overviews: Vec<Option<&str>> = tv_shows.iter().map(|v| v.overview.as_deref()).collect();
        let popularities: Vec<Option<f32>> = tv_shows.iter().map(|v| v.popularity).collect();
        let first_air_dates: Vec<Option<&str>> = tv_shows
            .iter()
            .map(|v| v.first_air_date.as_deref())
            .collect();
        let num_seasons: Vec<Option<i32>> = tv_shows.iter().map(|v| v.number_of_seasons).collect();
        let vote_averages: Vec<Option<f32>> = tv_shows.iter().map(|v| v.vote_average).collect();
        let vote_counts: Vec<Option<i32>> = tv_shows.iter().map(|v| v.vote_count).collect();
        let homepages: Vec<Option<&str>> = tv_shows
            .iter()
            .map(|v| v.homepage.as_deref())
            .collect();
        let backdrop_paths: Vec<Option<&str>> = tv_shows
            .iter()
            .map(|v| v.backdrop_path.as_deref())
            .collect();
        let poster_paths: Vec<Option<&str>> = tv_shows
            .iter()
            .map(|v| v.poster_path.as_deref())
            .collect();
        let genres_jsons: Vec<Json<Vec<_>>> = tv_shows
            .iter()
            .map(|v| Json(v.genres.clone().unwrap_or(vec![])))
            .collect();

        let table_name = self.table_name();
        let query = format!(
            "INSERT INTO {} (id, name, overview, popularity, first_air_date, number_of_seasons, vote_average, vote_count, homepage, backdrop_path, poster_path, genres)
             SELECT * FROM UNNEST($1::INT4[], $2::TEXT[], $3::TEXT[], $4::REAL[], $5::TEXT[], $6::INT4[], $7::REAL[], $8::INT4[], $9::TEXT[], $10::TEXT[], $11::TEXT[], $12::JSONB[])
             AS t(id, name, overview, popularity, first_air_date, number_of_seasons, vote_average, vote_count, homepage, backdrop_path, poster_path, genres)
             ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, overview=EXCLUDED.overview, popularity=EXCLUDED.popularity,
             first_air_date=EXCLUDED.first_air_date, number_of_seasons=EXCLUDED.number_of_seasons, vote_average=EXCLUDED.vote_average,
             vote_count=EXCLUDED.vote_count, homepage=EXCLUDED.homepage, genres=EXCLUDED.genres, updated_at=now()",
            table_name
        );

        transaction.execute(
            &query,
            &[
                &ids,
                &names,
                &overviews,
                &popularities,
                &first_air_dates,
                &num_seasons,
                &vote_averages,
                &vote_counts,
                &homepages,
                &backdrop_paths,
                &poster_paths,
                &genres_jsons,
            ],
        )?;

        transaction.commit()?;
        Ok(())
    }

    fn upsert_tv(&self, pg: &mut DbClient, id: i32, v: &TvDetails) -> Result<(), Box<dyn Error>> {
        let table_name = self.table_name();
        let query = format!(
            "INSERT INTO {} (id, name, overview, popularity, first_air_date, number_of_seasons, vote_average, vote_count, homepage, genres, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb, now())
             ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, overview=EXCLUDED.overview, popularity=EXCLUDED.popularity,
             first_air_date=EXCLUDED.first_air_date, number_of_seasons=EXCLUDED.number_of_seasons, vote_average=EXCLUDED.vote_average,
             vote_count=EXCLUDED.vote_count, homepage=EXCLUDED.homepage, updated_at=EXCLUDED.updated_at",
            table_name
        );
        pg.execute(
            &query,
            &[
                &id,
                &v.name,
                &v.overview,
                &v.popularity,
                &v.first_air_date,
                &v.number_of_seasons,
                &v.vote_average,
                &v.vote_count,
                &v.homepage.clone().unwrap_or(String::new()),
                &Json(&v.genres.clone().unwrap_or(vec![])),
            ],
        )?;
        Ok(())
    }
}
