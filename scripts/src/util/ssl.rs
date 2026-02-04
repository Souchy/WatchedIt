use std::{env, path::Path};

use openssl::{
    error::ErrorStack,
    ssl::{SslConnector, SslMethod},
};
use postgres_openssl::MakeTlsConnector;

pub fn ssl_config() -> Result<MakeTlsConnector, ErrorStack> {
    let ca_file_path = if cfg!(target_os = "windows") {
        format!(
            "{}\\postgresql\\root.crt",
            env::var("APPDATA").unwrap_or_else(|_| ".".to_string())
        )
    } else {
        format!(
            "{}/.postgresql/root.crt",
            env::var("HOME").unwrap_or_else(|_| ".".to_string())
        )
    };

    eprintln!("Using CA file path: {}", ca_file_path);

    // Verify the existence of the CA file.
    let ca_file = Path::new(&ca_file_path);
    if !ca_file.exists() {
        eprintln!("CA file {} not found!", ca_file_path);
        return Err(ErrorStack::get()); // Return explicit error.
    }

    // Configure OpenSSL with the CA file.
    let mut builder = SslConnector::builder(SslMethod::tls())?;
    builder.set_ca_file(ca_file_path)?;
    Ok(MakeTlsConnector::new(builder.build()))
}
