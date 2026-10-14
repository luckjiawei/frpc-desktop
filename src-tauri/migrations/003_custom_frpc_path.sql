-- 003_custom_frpc_path.sql
-- Add custom_frpc_path column to t_frpcd_servers
ALTER TABLE t_frpcd_servers ADD COLUMN custom_frpc_path TEXT NOT NULL DEFAULT '';
