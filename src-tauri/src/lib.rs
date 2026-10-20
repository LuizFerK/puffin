use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tokio_postgres::{types::Type, NoTls};

mod decode;

// Rows beyond this are dropped before reaching the UI
const MAX_ROWS: usize = 500;

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
    column_meta: Vec<ResultColumn>,
    tables: Vec<EditableTable>,
    rows: Vec<Vec<serde_json::Value>>,
    row_count: usize,
    elapsed_ms: u128,
}

#[derive(Serialize)]
struct ResultColumn {
    name: String,
    type_name: String,
    source: Option<ColumnSource>,
    read_only_reason: Option<String>,
}

#[derive(Serialize, Clone)]
struct ColumnSource {
    table_oid: u32,
    column: String,
    data_type: String,
    not_null: bool,
    generated: bool,
}

// A table whose rows can be identified: key_columns index into each result row and
// keys[row] holds their exact text, sent back verbatim in the UPDATE's WHERE
#[derive(Serialize)]
struct EditableTable {
    table_oid: u32,
    schema: String,
    name: String,
    key_columns: Vec<usize>,
    keys: Vec<Vec<String>>,
}

#[derive(Deserialize)]
struct ColumnValue {
    column: String,
    data_type: String,
    value: Option<String>,
}

#[derive(Deserialize)]
struct RowUpdate {
    schema: String,
    table: String,
    key: Vec<ColumnValue>,
    set: Vec<ColumnValue>,
}

#[derive(Serialize)]
struct ColumnInfo {
    name: String,
    data_type: String,
}

#[derive(Serialize)]
struct TableInfo {
    schema: String,
    name: String,
    kind: String,
    columns: Vec<ColumnInfo>,
}

#[derive(Serialize)]
struct SchemaInfo {
    tables: Vec<TableInfo>,
    search_path: Vec<String>,
}

fn relkind_name(relkind: &str) -> &'static str {
    match relkind {
        "v" => "view",
        "m" => "materialized_view",
        "f" => "foreign_table",
        _ => "table",
    }
}

fn group_tables(rows: Vec<tokio_postgres::Row>) -> Vec<TableInfo> {
    let mut tables: Vec<TableInfo> = Vec::new();

    for row in rows {
        let schema: String = row.get("schema");
        let name: String = row.get("name");
        let column = ColumnInfo {
            name: row.get("column_name"),
            data_type: row.get("data_type"),
        };

        match tables.last_mut() {
            Some(t) if t.schema == schema && t.name == name => t.columns.push(column),
            _ => {
                let relkind: String = row.get("relkind");
                tables.push(TableInfo {
                    schema,
                    name,
                    kind: relkind_name(&relkind).to_string(),
                    columns: vec![column],
                });
            }
        }
    }

    tables
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

struct CatalogColumn {
    attnum: i16,
    source: ColumnSource,
}

struct CatalogTable {
    table_oid: u32,
    schema: String,
    name: String,
    primary_key: Vec<String>,
}

// Only plain and partitioned tables are returned, so views and expressions stay read-only
async fn fetch_column_sources(
    client: &tokio_postgres::Client,
    table_oids: Vec<u32>,
) -> Result<(Vec<CatalogColumn>, Vec<CatalogTable>), tokio_postgres::Error> {
    if table_oids.is_empty() {
        return Ok((Vec::new(), Vec::new()));
    }

    let sql = "
        SELECT a.attrelid AS table_oid,
               n.nspname AS schema,
               c.relname AS table_name,
               a.attnum,
               a.attname AS column_name,
               format_type(a.atttypid, a.atttypmod) AS data_type,
               a.attnotnull AS not_null,
               a.attgenerated <> '' AS generated,
               COALESCE(a.attnum = ANY(i.indkey), false) AS is_pk
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_index i ON i.indrelid = c.oid AND i.indisprimary
        WHERE a.attrelid = ANY($1)
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND c.relkind IN ('r', 'p')
        ORDER BY a.attrelid, a.attnum;
    ";

    let rows = client.query(sql, &[&table_oids]).await?;

    let mut tables: Vec<CatalogTable> = Vec::new();
    let mut columns: Vec<CatalogColumn> = Vec::with_capacity(rows.len());

    for row in &rows {
        let table_oid: u32 = row.get("table_oid");
        let column: String = row.get("column_name");

        if tables.last().map(|t| t.table_oid) != Some(table_oid) {
            tables.push(CatalogTable {
                table_oid,
                schema: row.get("schema"),
                name: row.get("table_name"),
                primary_key: Vec::new(),
            });
        }
        if row.get::<_, bool>("is_pk") {
            tables.last_mut().unwrap().primary_key.push(column.clone());
        }

        columns.push(CatalogColumn {
            attnum: row.get("attnum"),
            source: ColumnSource {
                table_oid,
                column,
                data_type: row.get("data_type"),
                not_null: row.get("not_null"),
                generated: row.get("generated"),
            },
        });
    }

    Ok((columns, tables))
}

fn column_source(col: &tokio_postgres::Column, catalog: &[CatalogColumn]) -> Option<ColumnSource> {
    catalog
        .iter()
        .find(|c| Some(c.source.table_oid) == col.table_oid() && Some(c.attnum) == col.column_id())
        .map(|c| c.source.clone())
}

fn editable_table(
    table: &CatalogTable,
    sources: &[Option<ColumnSource>],
    columns: &[tokio_postgres::Column],
    rows: &[tokio_postgres::Row],
) -> Result<EditableTable, String> {
    if table.primary_key.is_empty() {
        return Err("Read-only: table has no primary key".into());
    }

    let key_columns = table
        .primary_key
        .iter()
        .map(|pk| {
            sources.iter().position(|s| {
                s.as_ref()
                    .is_some_and(|s| s.table_oid == table.table_oid && &s.column == pk)
            })
        })
        .collect::<Option<Vec<usize>>>()
        .ok_or("Read-only: primary key not in result")?;

    if !key_columns.iter().all(|&i| decode::is_keyable(columns[i].type_())) {
        return Err("Read-only: primary key type not supported".into());
    }

    let keys = rows
        .iter()
        .map(|row| {
            key_columns
                .iter()
                .map(|&i| decode::key_text(row, i))
                .collect::<Option<Vec<String>>>()
        })
        .collect::<Option<Vec<_>>>()
        .ok_or("Read-only: primary key could not be read")?;

    Ok(EditableTable {
        table_oid: table.table_oid,
        schema: table.schema.clone(),
        name: table.name.clone(),
        key_columns,
        keys,
    })
}

fn read_only_reason(
    col: &tokio_postgres::Column,
    source: Option<&ColumnSource>,
    tables: &[(u32, Result<EditableTable, String>)],
) -> Option<String> {
    if !decode::is_decodable(col.type_()) {
        return Some(format!("Read-only: unsupported type {}", col.type_().name()));
    }

    let Some(source) = source else {
        return Some("Read-only: not a table column".into());
    };
    if source.generated {
        return Some("Read-only: generated column".into());
    }

    match tables.iter().find(|(oid, _)| *oid == source.table_oid) {
        Some((_, Ok(_))) => None,
        Some((_, Err(reason))) => Some(reason.clone()),
        None => Some("Read-only: not a table column".into()),
    }
}

// Decides editability here, where types, catalog and raw values are all at hand
fn describe_result(
    columns: &[tokio_postgres::Column],
    catalog: &[CatalogColumn],
    catalog_tables: &[CatalogTable],
    rows: &[tokio_postgres::Row],
) -> (Vec<ResultColumn>, Vec<EditableTable>) {
    let sources: Vec<Option<ColumnSource>> =
        columns.iter().map(|c| column_source(c, catalog)).collect();

    let tables: Vec<(u32, Result<EditableTable, String>)> = catalog_tables
        .iter()
        .map(|t| (t.table_oid, editable_table(t, &sources, columns, rows)))
        .collect();

    let column_meta = columns
        .iter()
        .zip(sources)
        .map(|(col, source)| ResultColumn {
            name: col.name().to_string(),
            type_name: col.type_().name().to_string(),
            read_only_reason: read_only_reason(col, source.as_ref(), &tables),
            source,
        })
        .collect();

    let editable = tables.into_iter().filter_map(|(_, t)| t.ok()).collect();

    (column_meta, editable)
}

fn quote_ident(ident: &str) -> String {
    format!("\"{}\"", ident.replace('"', "\"\""))
}

// Values travel as text and are cast server-side, so Postgres parses every type.
// data_type comes from format_type() and is already a valid SQL type expression.
// `value` renders the text operand for each column given its 1-based parameter index.
fn render_update_sql(update: &RowUpdate, value: impl Fn(&ColumnValue, usize) -> String) -> String {
    let assign = |c: &ColumnValue, i: usize| {
        format!("{} = {}::text::{}", quote_ident(&c.column), value(c, i), c.data_type)
    };

    let assignments: Vec<String> = update
        .set
        .iter()
        .enumerate()
        .map(|(i, c)| assign(c, i + 1))
        .collect();
    let conditions: Vec<String> = update
        .key
        .iter()
        .enumerate()
        .map(|(i, c)| assign(c, update.set.len() + i + 1))
        .collect();
    let returning: Vec<String> = update.set.iter().map(|c| quote_ident(&c.column)).collect();

    format!(
        "UPDATE {}.{} SET {} WHERE {} RETURNING {}",
        quote_ident(&update.schema),
        quote_ident(&update.table),
        assignments.join(", "),
        conditions.join(" AND "),
        returning.join(", ")
    )
}

fn build_update_sql(update: &RowUpdate) -> String {
    render_update_sql(update, |_, i| format!("${}", i))
}

// Assumes standard_conforming_strings (on by default since Postgres 9.1)
fn quote_literal(value: &Option<String>) -> String {
    match value {
        Some(text) => format!("'{}'", text.replace('\'', "''")),
        None => "NULL".into(),
    }
}

// The executed statement with its parameters inlined, for the user to review
fn preview_update_sql(update: &RowUpdate) -> String {
    render_update_sql(update, |c, _| quote_literal(&c.value))
}

fn row_to_json(row: &tokio_postgres::Row) -> Vec<serde_json::Value> {
    row.columns()
        .iter()
        .enumerate()
        .map(|(i, _)| decode::cell_to_json(row, i))
        .collect()
}

async fn connect(connection: ConnectionParams) -> Result<tokio_postgres::Client, PgError> {
    // Built field by field so empty passwords and values with spaces need no escaping
    let mut config = tokio_postgres::Config::new();
    config
        .host(&connection.host)
        .port(connection.port)
        .dbname(&connection.database)
        .user(&connection.username);
    if let Some(password) = connection.password.filter(|p| !p.is_empty()) {
        config.password(password);
    }

    let (client, conn) = config
        .connect(NoTls)
        .await
        .map_err(|e| format_pg_error(&e))?;

    // Spawn the connection handler
    tokio::spawn(async move {
        if let Err(e) = conn.await {
            eprintln!("Connection error: {}", e);
        }
    });

    Ok(client)
}

#[tauri::command]
async fn execute_query(connection: ConnectionParams, sql: String) -> Result<QueryResult, PgError> {
    let client = connect(connection).await?;

    let start = Instant::now();

    let statement = client
        .prepare(&sql)
        .await
        .map_err(|e| format_pg_error(&e))?;

    let mut table_oids: Vec<u32> = statement
        .columns()
        .iter()
        .filter_map(|c| c.table_oid())
        .collect();
    table_oids.sort_unstable();
    table_oids.dedup();

    // tokio-postgres pipelines both queries, so the catalog lookup adds no round trip
    let (rows, (catalog, catalog_tables)) = tokio::try_join!(
        client.query(&statement, &[]),
        fetch_column_sources(&client, table_oids),
    )
    .map_err(|e| format_pg_error(&e))?;

    let elapsed_ms = start.elapsed().as_millis();

    let columns: Vec<String> = statement
        .columns()
        .iter()
        .map(|c| c.name().to_string())
        .collect();

    let rows = &rows[..rows.len().min(MAX_ROWS)];
    let (column_meta, tables) = describe_result(statement.columns(), &catalog, &catalog_tables, rows);

    Ok(QueryResult {
        columns,
        column_meta,
        tables,
        rows: rows.iter().map(row_to_json).collect(),
        row_count: rows.len(),
        elapsed_ms,
    })
}

#[tauri::command]
async fn apply_cell_edits(
    connection: ConnectionParams,
    edits: Vec<RowUpdate>,
) -> Result<Vec<Vec<serde_json::Value>>, PgError> {
    let mut client = connect(connection).await?;
    let tx = client.transaction().await.map_err(|e| format_pg_error(&e))?;

    let mut updated = Vec::with_capacity(edits.len());
    for edit in &edits {
        // Typed params skip the implicit prepare round trip; every value is sent as text
        let params: Vec<(&(dyn tokio_postgres::types::ToSql + Sync), Type)> = edit
            .set
            .iter()
            .chain(edit.key.iter())
            .map(|c| (&c.value as &(dyn tokio_postgres::types::ToSql + Sync), Type::TEXT))
            .collect();

        let rows = tx
            .query_typed(&build_update_sql(edit), &params)
            .await
            .map_err(|e| format_pg_error(&e))?;

        // Dropping the transaction on early return rolls back every update in the batch
        if rows.len() != 1 {
            return Err(PgError {
                detail: format!(
                    "Expected to update 1 row in {}.{}, but matched {}",
                    edit.schema,
                    edit.table,
                    rows.len()
                ),
                hint: Some("The row may have been changed or deleted. Re-run the query.".into()),
            });
        }

        updated.push(row_to_json(&rows[0]));
    }

    tx.commit().await.map_err(|e| format_pg_error(&e))?;

    Ok(updated)
}

#[tauri::command]
fn preview_cell_edits(edits: Vec<RowUpdate>) -> Vec<String> {
    edits.iter().map(preview_update_sql).collect()
}

#[tauri::command]
async fn fetch_schema(connection: ConnectionParams) -> Result<SchemaInfo, PgError> {
    let client = connect(connection).await?;

    // pg_catalog instead of information_schema so materialized views are included
    let sql = "
        SELECT n.nspname AS schema,
               c.relname AS name,
               c.relkind::text AS relkind,
               a.attname AS column_name,
               format_type(a.atttypid, a.atttypmod) AS data_type
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND n.nspname NOT LIKE 'pg_toast%'
          AND n.nspname NOT LIKE 'pg_temp%'
          AND has_schema_privilege(n.oid, 'USAGE')
        ORDER BY n.nspname, c.relname, a.attnum;
    ";

    // tokio-postgres pipelines both queries over the same connection
    let (rows, path_row) = tokio::try_join!(
        client.query(sql, &[]),
        client.query_one("SELECT current_schemas(false)::text[] AS path", &[]),
    )
    .map_err(|e| format_pg_error(&e))?;

    Ok(SchemaInfo {
        tables: group_tables(rows),
        search_path: path_row.get("path"),
    })
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
            apply_cell_edits,
            preview_cell_edits,
            fetch_schema
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn value(column: &str, data_type: &str, value: Option<&str>) -> ColumnValue {
        ColumnValue {
            column: column.into(),
            data_type: data_type.into(),
            value: value.map(String::from),
        }
    }

    #[test]
    fn quote_ident_escapes_double_quotes() {
        assert_eq!(quote_ident("name"), "\"name\"");
        assert_eq!(quote_ident("we\"ird"), "\"we\"\"ird\"");
    }

    #[test]
    fn build_update_sql_numbers_set_before_key() {
        let update = RowUpdate {
            schema: "public".into(),
            table: "users".into(),
            key: vec![value("id", "integer", Some("1"))],
            set: vec![
                value("name", "text", Some("Ana")),
                value("price", "numeric(10,2)", None),
            ],
        };

        assert_eq!(
            build_update_sql(&update),
            "UPDATE \"public\".\"users\" SET \"name\" = $1::text::text, \"price\" = $2::text::numeric(10,2) WHERE \"id\" = $3::text::integer RETURNING \"name\", \"price\""
        );
    }

    #[test]
    fn preview_update_sql_inlines_quoted_literals() {
        let update = RowUpdate {
            schema: "public".into(),
            table: "users".into(),
            key: vec![value("id", "integer", Some("1"))],
            set: vec![
                value("name", "text", Some("O'Brien")),
                value("price", "numeric(10,2)", None),
            ],
        };

        assert_eq!(
            preview_update_sql(&update),
            "UPDATE \"public\".\"users\" SET \"name\" = 'O''Brien'::text::text, \"price\" = NULL::text::numeric(10,2) WHERE \"id\" = '1'::text::integer RETURNING \"name\", \"price\""
        );
    }
}
