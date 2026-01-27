use postgres::Client as DbClient;
use postgres_types::Json;
use std::error::Error;
use tmdb_client::{
    apis::client::APIClient,
    models::{Cast, Crew, MovieDetails},
};
// use postgres_types::

pub fn fetch_movie(
    api: &APIClient,
    pg: &mut DbClient,
    _kind: &str,
    id: i32,
) -> Result<(), Box<dyn Error>> {
    let d = api.movies_api().get_movie_details(
        id, None, None, None, // Some("videos,images,keywords,credits"),
    )?;

    // let credits = api.movies_api().get_movie_credits(id)?;

    upsert_movie(pg, id, &d)?;
    Ok(())
}

pub fn upsert_movie(pg: &mut DbClient, id: i32, v: &MovieDetails) -> Result<(), Box<dyn Error>> {
    // let drop_result = pg.batch_execute("DROP TABLE IF EXISTS tmdb_movie");
    // if let Err(e) = drop_result {
    //     println!("Error dropping tmdb_movie table: {}", e);
    //     return Err(Box::new(e));
    // }

    let create_result = pg.batch_execute(
        "CREATE TABLE IF NOT EXISTS tmdb_movie (
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
    );
    if let Err(e) = create_result {
        println!("Error creating tmdb_movie table: {}", e);
        return Err(Box::new(e));
    }

    let insert_result = pg.execute(
        "INSERT INTO tmdb_movie (id, title, original_title, overview, popularity, release_date, vote_average, vote_count, homepage, backdrop_path, poster_path, status, revenue, genres, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, original_title=EXCLUDED.original_title, overview=EXCLUDED.overview,
         popularity=EXCLUDED.popularity, release_date=EXCLUDED.release_date, vote_average=EXCLUDED.vote_average, vote_count=EXCLUDED.vote_count,
         homepage=EXCLUDED.homepage, backdrop_path=EXCLUDED.backdrop_path, poster_path=EXCLUDED.poster_path, status=EXCLUDED.status, revenue=EXCLUDED.revenue, genres=EXCLUDED.genres, updated_at=EXCLUDED.updated_at",
        &[
			&id, // &v.id,
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
			// &serde_json::to_string(&v.genres.clone().unwrap_or(vec![]))?
			&Json(&v.genres.clone().unwrap_or(vec![])),
			// &v.belongs_to_collection // TODO: handle collection
		],
    );
    if let Err(e) = insert_result {
        println!("Error inserting/updating tmdb_movie id {}: {}", id, e);
        return Err(Box::new(e));
    }

    // // Upsert credits
    // if let Some(credits) = &v.credits {
    //     if let Some(cast) = &credits.cast {
    //         for person in cast {
    //             upsert_cast(pg, id, person)?;
    //         }
    //     }
    //     if let Some(crew) = &credits.crew {
    //         for person in crew {
    //             upsert_crew(pg, id, person)?;
    //         }
    //     }
    // }

    Ok(())
}

pub fn upsert_crew(pg: &mut DbClient, movie_id: i32, crew: &Crew) -> Result<(), Box<dyn Error>> {
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
