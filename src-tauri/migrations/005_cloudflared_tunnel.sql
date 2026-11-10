-- 005_cloudflared_tunnel.sql
-- Adds cloudflared (Cloudflare Tunnel) as a second tunnel provider. Must run
-- with PRAGMA foreign_keys = OFF inside a transaction because
-- t_frpcd_tunnels is rebuilt to widen its provider CHECK constraint.

CREATE TABLE t_frpcd_tunnels_new (
  id TEXT CONSTRAINT pk_t_frpcd_tunnels PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'frpc'
    CHECK (provider IN ('frpc', 'cloudflared')),
  auto_start INTEGER NOT NULL DEFAULT 0
    CHECK (auto_start IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO t_frpcd_tunnels_new (
  id, name, provider, auto_start, sort_order, created_at, updated_at
)
SELECT id, name, provider, auto_start, sort_order, created_at, updated_at
FROM t_frpcd_tunnels;

DROP TABLE t_frpcd_tunnels;

-- t_frpcd_servers references t_frpcd_tunnels by name, so its foreign key
-- points at the rebuilt table after the rename.
ALTER TABLE t_frpcd_tunnels_new RENAME TO t_frpcd_tunnels;

CREATE INDEX IF NOT EXISTS idx_t_frpcd_tunnels_sort
  ON t_frpcd_tunnels (sort_order, created_at);

-- cloudflared settings of a tunnel (id = t_frpcd_tunnels.id). The tunnel is
-- managed remotely ("token" mode): ingress rules live in the Cloudflare
-- dashboard, only the connector token is stored locally.
CREATE TABLE IF NOT EXISTS t_frpcd_cloudflared_tunnels (
  id TEXT CONSTRAINT pk_t_frpcd_cloudflared_tunnels PRIMARY KEY,
  cloudflared_version INTEGER,
  custom_cloudflared_path TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL DEFAULT '',
  protocol TEXT NOT NULL DEFAULT 'auto'
    CHECK (protocol IN ('auto', 'quic', 'http2')),
  edge_ip_version TEXT NOT NULL DEFAULT 'auto'
    CHECK (edge_ip_version IN ('auto', '4', '6')),
  log_level TEXT NOT NULL DEFAULT 'info'
    CHECK (log_level IN ('debug', 'info', 'warn', 'error')),
  CONSTRAINT fk_t_frpcd_cloudflared_tunnels_tunnel
    FOREIGN KEY (id)
    REFERENCES t_frpcd_tunnels (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

-- Downloaded binaries now belong to a provider; existing rows are frpc.
ALTER TABLE t_frpcd_versions
  ADD COLUMN provider TEXT NOT NULL DEFAULT 'frpc'
    CHECK (provider IN ('frpc', 'cloudflared'));
