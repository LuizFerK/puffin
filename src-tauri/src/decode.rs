use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Timelike, Utc};
use fallible_iterator::FallibleIterator;
use postgres_protocol::types::{array_from_sql, inet_from_sql};
use serde_json::Value;
use std::error::Error;
use std::fmt::Write;
use tokio_postgres::types::{FromSql, Kind, Type};
use tokio_postgres::Row;
use uuid::Uuid;

type DecodeResult<T> = Result<T, Box<dyn Error + Sync + Send>>;

/// The untouched binary payload of any column, so every type is decoded in one place
struct Raw<'a>(&'a [u8]);

impl<'a> FromSql<'a> for Raw<'a> {
    fn from_sql(_: &Type, raw: &'a [u8]) -> DecodeResult<Self> {
        Ok(Raw(raw))
    }

    fn accepts(_: &Type) -> bool {
        true
    }
}

#[derive(Clone, Copy)]
enum Scalar {
    Bool,
    Int2,
    Int4,
    Int8,
    Oid,
    Float4,
    Float8,
    Numeric,
    Text,
    Json,
    Uuid,
    Date,
    Time,
    Timestamp,
    Timestamptz,
    Interval,
    Inet,
    Bytea,
}

enum ColumnKind {
    Scalar(Scalar),
    Array(Scalar, Type),
}

fn scalar(ty: &Type) -> Option<Scalar> {
    // Enums travel as their label in UTF-8, same as text
    if matches!(ty.kind(), Kind::Enum(_)) || <&str as FromSql>::accepts(ty) {
        return Some(Scalar::Text);
    }

    Some(match *ty {
        Type::BOOL => Scalar::Bool,
        Type::INT2 => Scalar::Int2,
        Type::INT4 => Scalar::Int4,
        Type::INT8 => Scalar::Int8,
        Type::OID => Scalar::Oid,
        Type::FLOAT4 => Scalar::Float4,
        Type::FLOAT8 => Scalar::Float8,
        Type::NUMERIC => Scalar::Numeric,
        Type::JSON | Type::JSONB => Scalar::Json,
        Type::UUID => Scalar::Uuid,
        Type::DATE => Scalar::Date,
        Type::TIME => Scalar::Time,
        Type::TIMESTAMP => Scalar::Timestamp,
        Type::TIMESTAMPTZ => Scalar::Timestamptz,
        Type::INTERVAL => Scalar::Interval,
        Type::INET | Type::CIDR => Scalar::Inet,
        Type::BYTEA => Scalar::Bytea,
        _ => return None,
    })
}

fn column_kind(ty: &Type) -> Option<ColumnKind> {
    match ty.kind() {
        Kind::Array(elem) => scalar(elem).map(|s| ColumnKind::Array(s, elem.clone())),
        _ => scalar(ty).map(ColumnKind::Scalar),
    }
}

pub fn is_decodable(ty: &Type) -> bool {
    column_kind(ty).is_some()
}

/// Arrays can't identify a row reliably, so only scalars may be part of an edit key
pub fn is_keyable(ty: &Type) -> bool {
    matches!(column_kind(ty), Some(ColumnKind::Scalar(_)))
}

fn format_naive_datetime(v: &NaiveDateTime) -> String {
    if v.nanosecond() % 1_000_000_000 != 0 {
        v.format("%Y-%m-%d %H:%M:%S%.3f").to_string()
    } else {
        v.format("%Y-%m-%d %H:%M:%S").to_string()
    }
}

fn format_datetime_utc(v: &DateTime<Utc>) -> String {
    if v.nanosecond() % 1_000_000_000 != 0 {
        v.format("%Y-%m-%d %H:%M:%S%.3f %Z").to_string()
    } else {
        v.format("%Y-%m-%d %H:%M:%S %Z").to_string()
    }
}

fn float_value(v: f64) -> Value {
    match v {
        v if v.is_nan() => Value::String("NaN".into()),
        f64::INFINITY => Value::String("Infinity".into()),
        f64::NEG_INFINITY => Value::String("-Infinity".into()),
        v => serde_json::Number::from_f64(v).map_or(Value::Null, Value::Number),
    }
}

fn read_i16(raw: &[u8], at: usize) -> DecodeResult<i16> {
    raw.get(at..at + 2)
        .map(|b| i16::from_be_bytes([b[0], b[1]]))
        .ok_or_else(|| "truncated numeric".into())
}

const NUMERIC_NEG: u16 = 0x4000;
const NUMERIC_NAN: u16 = 0xC000;
const NUMERIC_PINF: u16 = 0xD000;
const NUMERIC_NINF: u16 = 0xF000;

// Binary numeric: base-10000 digits plus weight and display scale, so arbitrary precision survives
fn numeric_text(raw: &[u8]) -> DecodeResult<String> {
    let ndigits = read_i16(raw, 0)? as usize;
    let weight = read_i16(raw, 2)? as i32;
    let sign = read_i16(raw, 4)? as u16;
    let dscale = read_i16(raw, 6)? as u16 as usize;
    let digits = (0..ndigits)
        .map(|i| read_i16(raw, 8 + i * 2))
        .collect::<DecodeResult<Vec<i16>>>()?;

    match sign {
        NUMERIC_NAN => return Ok("NaN".into()),
        NUMERIC_PINF => return Ok("Infinity".into()),
        NUMERIC_NINF => return Ok("-Infinity".into()),
        _ => {}
    }

    let digit = |i: i32| usize::try_from(i).ok().and_then(|i| digits.get(i)).copied().unwrap_or(0);

    let mut out = String::new();
    if sign == NUMERIC_NEG {
        out.push('-');
    }

    if weight < 0 {
        out.push('0');
    } else {
        write!(out, "{}", digit(0))?;
        for i in 1..=weight {
            write!(out, "{:04}", digit(i))?;
        }
    }

    if dscale > 0 {
        let fraction: String = (1..=dscale.div_ceil(4) as i32)
            .map(|k| format!("{:04}", digit(weight + k)))
            .collect();
        out.push('.');
        out.push_str(&fraction[..dscale]);
    }

    Ok(out)
}

fn plural(n: i32, unit: &str) -> String {
    format!("{} {}{}", n, unit, if n == 1 { "" } else { "s" })
}

// Matches Postgres' default IntervalStyle output, which is also valid interval input
fn interval_text(raw: &[u8]) -> DecodeResult<String> {
    let bytes: &[u8; 16] = raw.try_into().map_err(|_| "invalid interval length")?;
    let micros = i64::from_be_bytes(bytes[0..8].try_into()?);
    let days = i32::from_be_bytes(bytes[8..12].try_into()?);
    let months = i32::from_be_bytes(bytes[12..16].try_into()?);

    let mut parts = Vec::new();
    if months / 12 != 0 {
        parts.push(plural(months / 12, "year"));
    }
    if months % 12 != 0 {
        parts.push(plural(months % 12, "mon"));
    }
    if days != 0 {
        parts.push(plural(days, "day"));
    }

    if micros != 0 || parts.is_empty() {
        let sign = if micros < 0 { "-" } else { "" };
        let abs = micros.unsigned_abs();
        let (hours, rest) = (abs / 3_600_000_000, abs % 3_600_000_000);
        let (minutes, rest) = (rest / 60_000_000, rest % 60_000_000);
        let (seconds, fraction) = (rest / 1_000_000, rest % 1_000_000);

        let mut time = format!("{sign}{hours:02}:{minutes:02}:{seconds:02}");
        if fraction != 0 {
            time.push_str(format!(".{fraction:06}").trim_end_matches('0'));
        }
        parts.push(time);
    }

    Ok(parts.join(" "))
}

// inet hides a full-length netmask, cidr always shows it
fn inet_text(ty: &Type, raw: &[u8]) -> DecodeResult<String> {
    let inet = inet_from_sql(raw)?;
    let full_mask = if inet.addr().is_ipv4() { 32 } else { 128 };
    if *ty == Type::CIDR || inet.netmask() != full_mask {
        Ok(format!("{}/{}", inet.addr(), inet.netmask()))
    } else {
        Ok(inet.addr().to_string())
    }
}

fn bytea_text(raw: &[u8]) -> String {
    raw.iter().fold(String::from("\\x"), |mut out, b| {
        let _ = write!(out, "{:02x}", b);
        out
    })
}

fn decode_scalar(kind: Scalar, ty: &Type, raw: &[u8]) -> DecodeResult<Value> {
    Ok(match kind {
        Scalar::Bool => Value::Bool(bool::from_sql(ty, raw)?),
        Scalar::Int2 => i16::from_sql(ty, raw)?.into(),
        Scalar::Int4 => i32::from_sql(ty, raw)?.into(),
        // Sent as text: JavaScript numbers lose precision above 2^53
        Scalar::Int8 => Value::String(i64::from_sql(ty, raw)?.to_string()),
        Scalar::Oid => u32::from_sql(ty, raw)?.into(),
        Scalar::Float4 => float_value(f32::from_sql(ty, raw)? as f64),
        Scalar::Float8 => float_value(f64::from_sql(ty, raw)?),
        Scalar::Numeric => Value::String(numeric_text(raw)?),
        Scalar::Text => Value::String(<&str>::from_sql(ty, raw)?.to_string()),
        Scalar::Json => Value::from_sql(ty, raw)?,
        Scalar::Uuid => Value::String(Uuid::from_sql(ty, raw)?.to_string()),
        Scalar::Date => Value::String(NaiveDate::from_sql(ty, raw)?.to_string()),
        Scalar::Time => Value::String(NaiveTime::from_sql(ty, raw)?.to_string()),
        Scalar::Timestamp => Value::String(format_naive_datetime(&NaiveDateTime::from_sql(ty, raw)?)),
        Scalar::Timestamptz => Value::String(format_datetime_utc(&DateTime::<Utc>::from_sql(ty, raw)?)),
        Scalar::Interval => Value::String(interval_text(raw)?),
        Scalar::Inet => Value::String(inet_text(ty, raw)?),
        Scalar::Bytea => Value::String(bytea_text(raw)),
    })
}

fn nest(values: &[Value], dims: &[usize]) -> Value {
    match dims {
        [] | [_] => Value::Array(values.to_vec()),
        [_, inner @ ..] => {
            let size = inner.iter().product::<usize>().max(1);
            Value::Array(values.chunks(size).map(|c| nest(c, inner)).collect())
        }
    }
}

fn decode_array(kind: Scalar, elem: &Type, raw: &[u8]) -> DecodeResult<Value> {
    let array = array_from_sql(raw)?;
    let dims: Vec<usize> = array
        .dimensions()
        .map(|d| Ok(d.len.max(0) as usize))
        .collect()?;
    let values: Vec<Value> = array
        .values()
        .map(|v| match v {
            Some(bytes) => decode_scalar(kind, elem, bytes),
            None => Ok(Value::Null),
        })
        .collect()?;
    Ok(nest(&values, &dims))
}

fn raw_cell<'a>(row: &'a Row, idx: usize) -> DecodeResult<Option<&'a [u8]>> {
    Ok(row.try_get::<_, Option<Raw>>(idx)?.map(|r| r.0))
}

fn decode_cell(row: &Row, idx: usize) -> DecodeResult<Value> {
    let ty = row.columns()[idx].type_();
    let Some(raw) = raw_cell(row, idx)? else {
        return Ok(Value::Null);
    };

    match column_kind(ty) {
        Some(ColumnKind::Scalar(kind)) => decode_scalar(kind, ty, raw),
        Some(ColumnKind::Array(kind, elem)) => decode_array(kind, &elem, raw),
        None => Err("unsupported type".into()),
    }
}

/// Display value of a cell; undecodable types become a placeholder and their column is read-only
pub fn cell_to_json(row: &Row, idx: usize) -> Value {
    decode_cell(row, idx).unwrap_or_else(|_| {
        Value::String(format!("<unsupported: {}>", row.columns()[idx].type_().name()))
    })
}

fn exact_text(kind: Scalar, ty: &Type, raw: &[u8]) -> DecodeResult<String> {
    Ok(match kind {
        Scalar::Timestamp => NaiveDateTime::from_sql(ty, raw)?.format("%Y-%m-%d %H:%M:%S%.f").to_string(),
        Scalar::Timestamptz => DateTime::<Utc>::from_sql(ty, raw)?
            .format("%Y-%m-%d %H:%M:%S%.f+00")
            .to_string(),
        _ => match decode_scalar(kind, ty, raw)? {
            Value::String(s) => s,
            other => other.to_string(),
        },
    })
}

/// Lossless Postgres input text of a key cell, sent back verbatim to identify the row
pub fn key_text(row: &Row, idx: usize) -> Option<String> {
    let ty = row.columns()[idx].type_();
    let Some(ColumnKind::Scalar(kind)) = column_kind(ty) else {
        return None;
    };
    let raw = raw_cell(row, idx).ok()??;
    exact_text(kind, ty, raw).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn numeric(ndigits: i16, weight: i16, sign: u16, dscale: u16, digits: &[i16]) -> Vec<u8> {
        [ndigits, weight, sign as i16, dscale as i16]
            .iter()
            .chain(digits)
            .flat_map(|v| v.to_be_bytes())
            .collect()
    }

    fn interval(micros: i64, days: i32, months: i32) -> Vec<u8> {
        [&micros.to_be_bytes()[..], &days.to_be_bytes(), &months.to_be_bytes()].concat()
    }

    #[test]
    fn numeric_text_keeps_scale_and_precision() {
        assert_eq!(numeric_text(&numeric(2, 0, 0, 2, &[1, 5000])).unwrap(), "1.50");
        assert_eq!(numeric_text(&numeric(3, 1, 0, 1, &[1234, 5678, 9000])).unwrap(), "12345678.9");
        assert_eq!(numeric_text(&numeric(1, -1, 0, 4, &[1])).unwrap(), "0.0001");
        assert_eq!(numeric_text(&numeric(0, 0, 0, 2, &[])).unwrap(), "0.00");
        assert_eq!(numeric_text(&numeric(1, 1, NUMERIC_NEG, 0, &[42])).unwrap(), "-420000");
        assert_eq!(
            numeric_text(&numeric(5, 4, 0, 0, &[9, 2233, 7203, 6854, 7758])).unwrap(),
            "92233720368547758"
        );
        assert_eq!(numeric_text(&numeric(0, 0, NUMERIC_NAN, 0, &[])).unwrap(), "NaN");
    }

    #[test]
    fn interval_text_matches_postgres_style() {
        assert_eq!(interval_text(&interval(0, 0, 0)).unwrap(), "00:00:00");
        assert_eq!(
            interval_text(&interval(14_706_789_000, 3, 14)).unwrap(),
            "1 year 2 mons 3 days 04:05:06.789"
        );
        assert_eq!(interval_text(&interval(0, -1, 0)).unwrap(), "-1 days");
        assert_eq!(interval_text(&interval(-90_000_000, 1, 0)).unwrap(), "1 day -00:01:30");
    }

    #[test]
    fn nest_rebuilds_multidimensional_arrays() {
        let values: Vec<Value> = (1..=6).map(Value::from).collect();
        assert_eq!(nest(&values, &[2, 3]), serde_json::json!([[1, 2, 3], [4, 5, 6]]));
        assert_eq!(nest(&values, &[6]), serde_json::json!([1, 2, 3, 4, 5, 6]));
        assert_eq!(nest(&[], &[]), serde_json::json!([]));
    }

    #[test]
    fn bytea_text_is_hex_escaped() {
        assert_eq!(bytea_text(&[0xde, 0xad, 0x01]), "\\xdead01");
    }
}
