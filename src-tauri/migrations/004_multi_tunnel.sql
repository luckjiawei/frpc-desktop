-- 004_multi_tunnel.sql
-- Generic tunnel instances; t_frpcd_servers becomes the frpc-specific detail
-- table of a tunnel. Must run with PRAGMA foreign_keys = OFF inside a
-- transaction because t_frpcd_servers is rebuilt (SQLite cannot drop the
-- original CHECK (id = '1') constraint in place).

CREATE TABLE IF NOT EXISTS t_frpcd_tunnels (
  id TEXT CONSTRAINT pk_t_frpcd_tunnels PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'frpc'
    CHECK (provider IN ('frpc')),
  auto_start INTEGER NOT NULL DEFAULT 0
    CHECK (auto_start IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_t_frpcd_tunnels_sort
  ON t_frpcd_tunnels (sort_order, created_at);

-- The existing single server becomes the default tunnel "1". It keeps
-- auto_start = 1 so the global auto-connect switch behaves exactly as before.
INSERT OR IGNORE INTO t_frpcd_tunnels (id, name, provider, auto_start, sort_order)
VALUES (
  '1',
  CASE (
    SELECT config_value FROM t_frpcd_app_config
    WHERE scope_type = 'global' AND scope_id IS NULL AND namespace = 'desktop'
      AND config_key = 'language' AND deleted_at IS NULL
  )
    WHEN 'zh-CN' THEN '默认'
    ELSE 'Default'
  END,
  'frpc',
  1,
  0
);

CREATE TABLE t_frpcd_servers_new (
  id TEXT CONSTRAINT pk_t_frpcd_servers PRIMARY KEY,
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
    ),
  custom_frpc_path TEXT NOT NULL DEFAULT '',
  CONSTRAINT fk_t_frpcd_servers_tunnel
    FOREIGN KEY (id)
    REFERENCES t_frpcd_tunnels (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

INSERT INTO t_frpcd_servers_new (
  id, frpc_version, multiuser, user, server_addr, server_port,
  login_fail_exit, udp_packet_size, auth_json, log_json,
  web_server_json, transport_json, metadatas_json, custom_frpc_path
)
SELECT
  id, frpc_version, multiuser, user, server_addr, server_port,
  login_fail_exit, udp_packet_size, auth_json, log_json,
  web_server_json, transport_json, metadatas_json, custom_frpc_path
FROM t_frpcd_servers;

DROP TABLE t_frpcd_servers;

-- t_frpcd_proxies keeps referencing t_frpcd_servers by name, so its foreign
-- key points at the rebuilt table after the rename.
ALTER TABLE t_frpcd_servers_new RENAME TO t_frpcd_servers;
