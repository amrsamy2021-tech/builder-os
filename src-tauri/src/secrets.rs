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
    if value.trim().is_empty() {
        return Err("Secret value cannot be empty".to_string());
    }

    // Try macOS Keychain first
    if let Ok(entry) = Entry::new(KEYCHAIN_SERVICE, key) {
        if entry.set_password(value).is_ok() {
            return Ok(());
        }
    }

    // Fallback: local file (common for unsigned dev builds)
    let dir = secrets_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create secrets directory: {}", e))?;
    let path = secret_file_path(key);
    fs::write(&path, value).map_err(|e| format!("Failed to save secret: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }

    Ok(())
}

pub fn get_secret(key: &str) -> Result<Option<String>, String> {
    for service in [KEYCHAIN_SERVICE, "builder-os"] {
        if let Ok(entry) = Entry::new(service, key) {
            match entry.get_password() {
                Ok(val) if !val.is_empty() => {
                    // Migrate to current storage if read from legacy service
                    if service != KEYCHAIN_SERVICE {
                        let _ = save_secret(key, &val);
                    }
                    return Ok(Some(val));
                }
                Ok(_) => {}
                Err(keyring::Error::NoEntry) => {}
                Err(_) => {}
            }
        }
    }

    // File fallback
    let path = secret_file_path(key);
    if path.exists() {
        let val = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read secret: {}", e))?;
        if !val.is_empty() {
            return Ok(Some(val));
        }
    }

    Ok(None)
}

pub fn delete_secret(key: &str) -> Result<(), String> {
    if let Ok(entry) = Entry::new(KEYCHAIN_SERVICE, key) {
        let _ = entry.delete_credential();
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
            "{} not found. Enter your key in Settings or Connect Tools and click Save first.",
            label
        )
    })
}
