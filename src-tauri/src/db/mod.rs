use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

impl DbState {
    pub fn new() -> Result<Self> {
        let db_path = get_db_path();
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let conn = Connection::open(&db_path)?;
        let schema = include_str!("schema.sql");
        conn.execute_batch(schema)?;
        run_migrations(&conn)?;
        Ok(DbState {
            conn: Mutex::new(conn),
        })
    }
}

fn get_db_path() -> PathBuf {
    let data_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    data_dir.join("builder-os").join("builder-os.db")
}

fn run_migrations(conn: &Connection) -> Result<()> {
    let mut stmt = conn.prepare("PRAGMA table_info(deliverables)")?;
    let columns: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();

    if !columns.contains(&"notion_page_id".to_string()) {
        conn.execute("ALTER TABLE deliverables ADD COLUMN notion_page_id TEXT", [])?;
    }
    if !columns.contains(&"notion_page_url".to_string()) {
        conn.execute("ALTER TABLE deliverables ADD COLUMN notion_page_url TEXT", [])?;
    }
    Ok(())
}
