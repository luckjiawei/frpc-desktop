-- tls2raw proxy plugin support (frp >= v0.60.0)
ALTER TABLE t_frpcd_proxies ADD COLUMN tls2raw INTEGER NOT NULL DEFAULT 0 CHECK (tls2raw IN (0, 1));
ALTER TABLE t_frpcd_proxies ADD COLUMN tls2raw_ca_file TEXT NOT NULL DEFAULT '';
ALTER TABLE t_frpcd_proxies ADD COLUMN tls2raw_key_file TEXT NOT NULL DEFAULT '';
