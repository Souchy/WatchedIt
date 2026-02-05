use crate::Gateway;
use chrono::NaiveDate;
use postgres::Client as DbClient;
use std::error::Error;
use tmdb_client::{apis::client::APIClient, models::PersonDetails};

pub struct PersonGateway {
    pub people: Vec<PersonDetails>,
}

impl PersonGateway {
    pub fn new() -> Self {
        PersonGateway { people: Vec::new() }
    }
}

impl Gateway for PersonGateway {
    fn api_name(&self) -> &str {
        "person"
    }

    fn popularity_min(&self) -> f32 {
        1.0
    }

    fn batch_size(&self) -> usize {
        1000
    }

    fn fetch_dump(&self) {}

    fn fetch_details(&mut self, api: &APIClient, id: i32) -> Result<(), tmdb_client::Error> {
        let d = api.people_api().get_person_details(id, None, None, None)?;
        self.people.push(d.clone());
        Ok(())
    }

    fn insert_details(&mut self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        let detail = self.people.pop().ok_or("List of people is empty")?;
        let id = detail.id.ok_or("Missing person ID")?;
        self.upsert_person(pg, id, &detail)?;
        Ok(())
    }

    fn insert_bulk_details(&mut self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        if self.people.is_empty() {
            return Ok(());
        }

        let person_refs: Vec<&PersonDetails> = self
            .people
            .iter()
            .filter(|person| person.id.is_some())
            .collect();
        crate::util::sql::batch_insert_with_retry(
            &person_refs,
            |batch| self.try_insert_person_batch(pg, batch),
            |p| p.id,
            self.api_name(),
            0,
        )?;
        self.people.clear();
        Ok(())
    }

    fn create_table(&self, pg: &mut DbClient) -> Result<(), Box<dyn Error>> {
        let table_name = self.table_name();
        let query = format!(
            "CREATE TABLE IF NOT EXISTS {} (
                id INT4 PRIMARY KEY,
                name TEXT,
                biography TEXT,
                popularity REAL,
                birthday TEXT,
                deathday TEXT,
                place_of_birth TEXT,
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
        let changes = api.changes_api().get_person_changes_paginated(
            Some(from.format("%Y-%m-%d").to_string()),
            Some(to.format("%Y-%m-%d").to_string()),
            Some(page),
        )?;
        Ok(changes)
    }
}

impl PersonGateway {
    fn try_insert_person_batch(
        &self,
        pg: &mut DbClient,
        people: &[&PersonDetails],
    ) -> Result<(), Box<dyn Error>> {
        let mut transaction = pg.transaction()?;

        let ids: Vec<i32> = people.iter().filter_map(|p| p.id).collect();
        let names: Vec<Option<&str>> = people.iter().map(|p| p.name.as_deref()).collect();
        let biographies: Vec<Option<&str>> =
            people.iter().map(|p| p.biography.as_deref()).collect();
        let popularities: Vec<Option<f32>> = people.iter().map(|p| p.popularity).collect();
        let birthdays: Vec<Option<&str>> = people.iter().map(|p| p.birthday.as_deref()).collect();
        let deathdays: Vec<Option<&str>> = people.iter().map(|p| p.deathday.as_deref()).collect();
        let places_of_birth: Vec<Option<&str>> =
            people.iter().map(|p| p.place_of_birth.as_deref()).collect();

        let table_name = self.table_name();
        let query = format!(
            "INSERT INTO {} (id, name, biography, popularity, birthday, deathday, place_of_birth)
             SELECT * FROM UNNEST($1::INT4[], $2::TEXT[], $3::TEXT[], $4::REAL[], $5::TEXT[], $6::TEXT[], $7::TEXT[])
             AS t(id, name, biography, popularity, birthday, deathday, place_of_birth)
             ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, biography=EXCLUDED.biography, popularity=EXCLUDED.popularity,
             birthday=EXCLUDED.birthday, deathday=EXCLUDED.deathday, place_of_birth=EXCLUDED.place_of_birth, updated_at=now()",
            table_name
        );

        transaction.execute(
            &query,
            &[
                &ids,
                &names,
                &biographies,
                &popularities,
                &birthdays,
                &deathdays,
                &places_of_birth,
            ],
        )?;

        transaction.commit()?;
        Ok(())
    }

    fn upsert_person(
        &self,
        pg: &mut DbClient,
        id: i32,
        v: &PersonDetails,
    ) -> Result<(), Box<dyn Error>> {
        let table_name = self.table_name();
        let query = format!(
            "INSERT INTO {} (id, name, biography, popularity, birthday, deathday, place_of_birth, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7, now())
             ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, biography=EXCLUDED.biography, popularity=EXCLUDED.popularity,
             birthday=EXCLUDED.birthday, deathday=EXCLUDED.deathday, place_of_birth=EXCLUDED.place_of_birth, updated_at=EXCLUDED.updated_at",
            table_name
        );
        pg.execute(
            &query,
            &[
                &id,
                &v.name,
                &v.biography,
                &v.popularity,
                &v.birthday,
                &v.deathday,
                &v.place_of_birth,
            ],
        )?;
        Ok(())
    }
}
