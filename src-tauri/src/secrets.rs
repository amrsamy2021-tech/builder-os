use keyring::Entry;
use std::fs;
use std::path::PathBuf;

const KEYCHAIN_SERVICE: &str = "com.asamy.builder-os";

fn secrets_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("builder-os")
        .join("secrets")
}

fn secret_file_path(key: &str) -> PathBuf {
    secrets_dir().join(format!("{}.secret", key.replace('/', "_")))
}

pub fn save_secret(key: &str, value: &str) -> Result<(), String> {
    let value = value.trim();
    if value.is_empty() {
        return Err("Secret value cannot be empty".to_string());
    }

    // Always write to local file (reliable in dev + production fallback)
    let dir = secrets_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create secrets directory: {}", e))?;
    let path = secret_file_path(key);
    fs::write(&path, value).map_err(|e| format!("Failed to save secret file: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }

    // Also try Keychain (best-effort)
    for service in [KEYCHAIN_SERVICE, "builder-os"] {
        if let Ok(entry) = Entry::new(service, key) {
            let _ = entry.set_password(value);
        }
    }

    // Verify we can read it back
    match get_secret(key)? {
        Some(stored) if stored == value => Ok(()),
        Some(_) => Err("Secret saved but verification failed (mismatch)".to_string()),
        None => Err("Secret saved but could not be read back".to_string()),
    }
}

pub fn get_secret(key: &str) -> Result<Option<String>, String> {
    // File is primary (most reliable)
    let path = secret_file_path(key);
    if path.exists() {
        let val = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read secret file: {}", e))?;
        let val = val.trim().to_string();
        if !val.is_empty() {
            return Ok(Some(val));
        }
    }

    // Keychain fallback
    for service in [KEYCHAIN_SERVICE, "builder-os"] {
        if let Ok(entry) = Entry::new(service, key) {
            match entry.get_password() {
                Ok(val) if !val.trim().is_empty() => {
                    // Migrate to file for reliability
                    let _ = fs::create_dir_all(secrets_dir());
                    let _ = fs::write(&path, val.trim());
                    return Ok(Some(val.trim().to_string()));
                }
                Ok(_) => {}
                Err(keyring::Error::NoEntry) => {}
                Err(_) => {}
            }
        }
    }

    Ok(None)
}

pub fn has_secret(key: &str) -> Result<bool, String> {
    Ok(get_secret(key)?.is_some())
}

pub fn delete_secret(key: &str) -> Result<(), String> {
    for service in [KEYCHAIN_SERVICE, "builder-os"] {
        if let Ok(entry) = Entry::new(service, key) {
            let _ = entry.delete_credential();
        }
    }

    let path = secret_file_path(key);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn require_secret(key: &str, label: &str) -> Result<String, String> {
    get_secret(key)?.ok_or_else(|| {
        format!(
            "{} not found. Go to Settings, paste your key, and click Save & Test.",
            label
        )
    })
}
