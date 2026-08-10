CREATE TABLE IF NOT EXISTS t_frpcd_schema_migrations (
  version INTEGER CONSTRAINT pk_t_frpcd_schema_migrations PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS t_frpcd_app_config (
  id TEXT CONSTRAINT pk_t_frpcd_app_config PRIMARY KEY,
  scope_type TEXT NOT NULL DEFAULT 'global'
    CHECK (scope_type IN ('global', 'user', 'project')),
  scope_id TEXT,
  namespace TEXT NOT NULL,
  config_key TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'string'
    CHECK (value_type IN ('string', 'integer', 'boolean', 'json')),
  config_value TEXT NOT NULL,
  is_secret INTEGER NOT NULL DEFAULT 0
    CHECK (is_secret IN (0, 1)),
  encryption_type TEXT,
  version INTEGER NOT NULL DEFAULT 1
    CHECK (version >= 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  CHECK (
    (scope_type = 'global' AND scope_id IS NULL)
    OR (scope_type IN ('user', 'project') AND scope_id IS NOT NULL AND scope_id <> '')
  ),
  CHECK (is_secret = 1 OR encryption_type IS NULL),
  CHECK (encryption_type IS NULL OR encryption_type = 'aes-256-gcm')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_t_frpcd_app_config_active
  ON t_frpcd_app_config (
    scope_type,
    COALESCE(scope_id, ''),
    namespace,
    config_key
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_t_frpcd_app_config_lookup
  ON t_frpcd_app_config (scope_type, scope_id, namespace, deleted_at);

CREATE TABLE IF NOT EXISTS t_frpcd_servers (
  id TEXT CONSTRAINT pk_t_frpcd_servers PRIMARY KEY
    CHECK (id = '1'),
  frpc_version INTEGER,
  multiuser INTEGER NOT NULL DEFAULT 0
    CHECK (multiuser IN (0, 1)),
  user TEXT NOT NULL DEFAULT '',
  server_addr TEXT NOT NULL DEFAULT '',
  server_port INTEGER NOT NULL DEFAULT 7000
    CHECK (server_port BETWEEN 1 AND 65535),
  login_fail_exit INTEGER NOT NULL DEFAULT 0
    CHECK (login_fail_exit IN (0, 1)),
  udp_packet_size INTEGER NOT NULL DEFAULT 1500
    CHECK (udp_packet_size > 0),
  auth_json TEXT NOT NULL
    CHECK (json_valid(auth_json) AND json_type(auth_json) = 'object'),
  log_json TEXT NOT NULL
    CHECK (json_valid(log_json) AND json_type(log_json) = 'object'),
  web_server_json TEXT NOT NULL
    CHECK (
      json_valid(web_server_json)
      AND json_type(web_server_json) = 'object'
    ),
  transport_json TEXT NOT NULL
    CHECK (
      json_valid(transport_json)
      AND json_type(transport_json) = 'object'
    ),
  metadatas_json TEXT NOT NULL DEFAULT '{}'
    CHECK (
      json_valid(metadatas_json)
      AND json_type(metadatas_json) = 'object'
    )
);

CREATE TABLE IF NOT EXISTS t_frpcd_proxies (
  id TEXT CONSTRAINT pk_t_frpcd_proxies PRIMARY KEY,
  server_id TEXT NOT NULL DEFAULT '1',
  name TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL
    CHECK (type IN ('http', 'https', 'tcp', 'udp', 'stcp', 'xtcp', 'sudp')),
  local_ip TEXT NOT NULL DEFAULT '',
  local_port TEXT NOT NULL DEFAULT '8080',
  remote_port TEXT NOT NULL DEFAULT '8080',
  custom_domains_json TEXT NOT NULL DEFAULT '[""]'
    CHECK (
      json_valid(custom_domains_json)
      AND json_type(custom_domains_json) = 'array'
    ),
  locations_json TEXT NOT NULL DEFAULT '[""]'
    CHECK (
      json_valid(locations_json)
      AND json_type(locations_json) = 'array'
    ),
  host_header_rewrite TEXT NOT NULL DEFAULT '',
  visitors_model TEXT NOT NULL DEFAULT 'visitors',
  server_user TEXT NOT NULL DEFAULT '',
  server_name TEXT NOT NULL DEFAULT '',
  secret_key TEXT NOT NULL DEFAULT '',
  bind_addr TEXT NOT NULL DEFAULT '',
  bind_port INTEGER
    CHECK (bind_port IS NULL OR bind_port BETWEEN 1 AND 65535),
  subdomain TEXT NOT NULL DEFAULT '',
  basic_auth INTEGER NOT NULL DEFAULT 0
    CHECK (basic_auth IN (0, 1)),
  http_user TEXT NOT NULL DEFAULT '',
  http_password TEXT NOT NULL DEFAULT '',
  fallback_to TEXT NOT NULL DEFAULT '',
  fallback_timeout_ms INTEGER NOT NULL DEFAULT 500
    CHECK (fallback_timeout_ms >= 0),
  https2http INTEGER NOT NULL DEFAULT 0
    CHECK (https2http IN (0, 1)),
  https2http_ca_file TEXT NOT NULL DEFAULT '',
  https2http_key_file TEXT NOT NULL DEFAULT '',
  keep_tunnel_open INTEGER NOT NULL DEFAULT 0
    CHECK (keep_tunnel_open IN (0, 1)),
  status INTEGER NOT NULL DEFAULT 1
    CHECK (status IN (0, 1)),
  transport_json TEXT NOT NULL
    CHECK (
      json_valid(transport_json)
      AND json_type(transport_json) = 'object'
    ),
  CONSTRAINT fk_t_frpcd_proxies_server
    FOREIGN KEY (server_id)
    REFERENCES t_frpcd_servers (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_t_frpcd_proxies_server_status
  ON t_frpcd_proxies (server_id, status);

CREATE TABLE IF NOT EXISTS t_frpcd_versions (
  id TEXT CONSTRAINT pk_t_frpcd_versions PRIMARY KEY,
  github_release_id INTEGER NOT NULL,
  github_asset_id INTEGER NOT NULL,
  github_created_at TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  version_download_count INTEGER NOT NULL DEFAULT 0
    CHECK (version_download_count >= 0),
  asset_download_count INTEGER NOT NULL DEFAULT 0
    CHECK (asset_download_count >= 0),
  browser_download_url TEXT NOT NULL,
  downloaded INTEGER NOT NULL DEFAULT 1
    CHECK (downloaded IN (0, 1)),
  local_path TEXT,
  size TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_t_frpcd_versions_github_release_id
  ON t_frpcd_versions (github_release_id);
