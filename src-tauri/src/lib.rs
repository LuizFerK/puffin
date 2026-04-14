use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;
use tokio_postgres::{types::Type, NoTls};
use uuid::Uuid;

// App-specific 32-byte key (AES-256). Machine-bound, not user-facing.
const APP_KEY: &[u8; 32] = b"puffin-db-manager-enc-key-v1!!!!";

#[tauri::command]
fn encrypt_password(plaintext: String) -> Result<String, String> {
    let cipher = Aes256Gcm::new(APP_KEY.into());

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Store as: base64(nonce + ciphertext)
    let mut combined = nonce_bytes.to_vec();
    combined.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(&combined))
}

#[tauri::command]
fn decrypt_password(encrypted: String) -> Result<String, String> {
    let combined = BASE64
        .decode(&encrypted)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    if combined.len() < 12 {
        return Err("Invalid encrypted data".into());
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    let cipher = Aes256Gcm::new(APP_KEY.into());

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 decode failed: {}", e))
}

#[derive(Deserialize)]
struct ConnectionParams {
    host: String,
    port: u16,
    database: String,
    username: String,
    password: Option<String>,
}

#[derive(Serialize)]
struct QueryResult {
    columns: Vec<String>,
    rows: Vec<Vec<serde_json::Value>>,
    row_count: usize,
    elapsed_ms: u128,
}

#[derive(Serialize)]
struct SchemaInfo {
    tables: HashMap<String, Vec<String>>,
}

fn pg_value_to_json(
    row: &tokio_postgres::Row,
    idx: usize,
    col_type: &Type,
) -> serde_json::Value {
    // Try to extract the value based on the column type
    macro_rules! try_type {
        ($rust_type:ty) => {
            if let Ok(val) = row.try_get::<_, Option<$rust_type>>(idx) {
                return match val {
                    Some(v) => serde_json::to_value(v).unwrap_or(serde_json::Value::Null),
                    None => serde_json::Value::Null,
                };
            }
        };
    }

    match *col_type {
        Type::BOOL => try_type!(bool),
        Type::INT2 => try_type!(i16),
        Type::INT4 => try_type!(i32),
        Type::INT8 => try_type!(i64),
        Type::FLOAT4 => try_type!(f32),
        Type::FLOAT8 => try_type!(f64),
        Type::TEXT | Type::VARCHAR | Type::NAME | Type::BPCHAR => try_type!(String),
        Type::TIMESTAMP => {
            if let Ok(val) = row.try_get::<_, Option<chrono::NaiveDateTime>>(idx) {
                return match val {
                    Some(v) => serde_json::Value::String(v.format("%Y-%m-%d %H:%M:%S").to_string()),
                    None => serde_json::Value::Null,
                };
            }
        }
        Type::TIMESTAMPTZ => {
            if let Ok(val) =
                row.try_get::<_, Option<chrono::DateTime<chrono::Utc>>>(idx)
            {
                return match val {
                    Some(v) => serde_json::Value::String(v.format("%Y-%m-%d %H:%M:%S %Z").to_string()),
                    None => serde_json::Value::Null,
                };
            }
        }
        Type::DATE => {
            if let Ok(val) = row.try_get::<_, Option<chrono::NaiveDate>>(idx) {
                return match val {
                    Some(v) => serde_json::Value::String(v.to_string()),
                    None => serde_json::Value::Null,
                };
            }
        }
        Type::JSON | Type::JSONB => try_type!(serde_json::Value),
        Type::UUID => {
            if let Ok(val) = row.try_get::<_, Option<Uuid>>(idx) {
                return match val {
                    Some(v) => serde_json::Value::String(v.to_string()),
                    None => serde_json::Value::Null,
                };
            }
        }
        Type::OID => try_type!(u32),
        _ => {}
    }

    // Fallback: try as string
    if let Ok(val) = row.try_get::<_, Option<String>>(idx) {
        return match val {
            Some(v) => serde_json::Value::String(v),
            None => serde_json::Value::Null,
        };
    }

    serde_json::Value::String(format!("<unsupported: {}>", col_type.name()))
}

#[derive(Serialize)]
struct PgError {
    detail: String,
    hint: Option<String>,
}

fn format_pg_error(e: &tokio_postgres::Error) -> PgError {
    if let Some(db_err) = e.as_db_error() {
        PgError {
            detail: db_err.message().to_string(),
            hint: db_err.hint().map(|s| s.to_string()),
        }
    } else {
        PgError {
            detail: e.to_string(),
            hint: None,
        }
    }
}

#[tauri::command]
async fn execute_query(connection: ConnectionParams, sql: String) -> Result<QueryResult, PgError> {
    let password = connection.password.unwrap_or_default();

    let conn_string = format!(
        "host={} port={} dbname={} user={} password={}",
        connection.host, connection.port, connection.database, connection.username, password
    );

    let (client, conn) = tokio_postgres::connect(&conn_string, NoTls)
        .await
        .map_err(|e| format_pg_error(&e))?;

    // Spawn the connection handler
    tokio::spawn(async move {
        if let Err(e) = conn.await {
            eprintln!("Connection error: {}", e);
        }
    });

    let start = Instant::now();

    let rows = client
        .query(&sql as &str, &[])
        .await
        .map_err(|e| format_pg_error(&e))?;

    let elapsed_ms = start.elapsed().as_millis();

    let columns: Vec<String> = if let Some(first) = rows.first() {
        first.columns().iter().map(|c| c.name().to_string()).collect()
    } else {
        Vec::new()
    };

    let json_rows: Vec<Vec<serde_json::Value>> = rows
        .iter()
        .take(500)
        .map(|row| {
            row.columns()
                .iter()
                .enumerate()
                .map(|(i, col)| pg_value_to_json(row, i, col.type_()))
                .collect()
        })
        .collect();

    let row_count = json_rows.len();

    Ok(QueryResult {
        columns,
        rows: json_rows,
        row_count,
        elapsed_ms,
    })
}

#[tauri::command]
async fn fetch_schema(connection: ConnectionParams) -> Result<SchemaInfo, PgError> {
    let password = connection.password.unwrap_or_default();

    let conn_string = format!(
        "host={} port={} dbname={} user={} password={}",
        connection.host, connection.port, connection.database, connection.username, password
    );

    let (client, conn) = tokio_postgres::connect(&conn_string, NoTls)
        .await
        .map_err(|e| format_pg_error(&e))?;

    tokio::spawn(async move {
        if let Err(e) = conn.await {
            eprintln!("Connection error: {}", e);
        }
    });

    let sql = "
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        ORDER BY table_name, ordinal_position;
    ";

    let rows = client
        .query(sql, &[])
        .await
        .map_err(|e| format_pg_error(&e))?;

    let mut tables: HashMap<String, Vec<String>> = HashMap::new();

    for row in rows {
        let table_name: String = row.get("table_name");
        let column_name: String = row.get("column_name");
        tables.entry(table_name).or_default().push(column_name);
    }

    Ok(SchemaInfo { tables })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            encrypt_password,
            decrypt_password,
            execute_query,
            fetch_schema
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
