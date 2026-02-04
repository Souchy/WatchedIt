use std::error::Error;
use std::thread::sleep;
use std::time::{Duration, SystemTime};

pub struct RateLimiter {
    batch_start: SystemTime,
    batch_size: usize,
    window: Duration,
    request_count: usize,
}

impl RateLimiter {
    pub fn new(batch_size: usize, window: Duration) -> Self {
        Self {
            batch_start: SystemTime::now(),
            batch_size,
            window,
            request_count: 0,
        }
    }

    fn tick(&mut self) {
        self.request_count += 1;
        if self.request_count % self.batch_size == 0 {
            let elapsed = self.batch_start.elapsed().unwrap_or(Duration::ZERO);
            if elapsed < self.window {
                sleep(self.window - elapsed);
            }
            self.batch_start = SystemTime::now();
        }
    }

    pub fn request_with_retry<T, F>(
        &mut self,
        name: &str,
        mut request: F,
    ) -> Result<T, Box<dyn Error>>
    where
        F: FnMut() -> Result<T, tmdb_client::Error>,
    {
        let mut attempts = 0usize;
        loop {
            attempts += 1;
            let result = request();
            self.tick();

            let error = match result {
                Ok(r) => return Ok(r),
                Err(e) => e,
            };

            let msg = error.to_string();
            let is_rate_limited = msg.contains("429") || msg.contains("Too Many Requests");

            if !is_rate_limited {
                eprintln!("Error fetching changes for {}: {}", name, error);
                return Err(error.into());
            }

            if attempts >= 5 {
                eprintln!("Max retries (5) reached for {}. Giving up.", name);
                return Err(error.into());
            }

            let backoff_secs = 2u64.saturating_pow(attempts.min(5) as u32);
            eprintln!(
                "Rate limited (429) for {}. Backing off {}s (attempt {}).",
                name, backoff_secs, attempts
            );
            sleep(Duration::from_secs(backoff_secs));
        }
    }
}
