//! Tunnel providers: each one knows how to turn a stored tunnel into a
//! [`LaunchSpec`] and how to interpret its log output. Adding a new tool
//! (e.g. cloudflared) means adding a provider here plus its settings table;
//! process supervision, status events and the tray stay unchanged.

pub mod frpc;

use crate::db::DbManager;
use crate::models::Tunnel;
use crate::process::{LaunchSpec, LogClassifier};
use std::path::Path;

pub struct TunnelContext<'a> {
    pub db: &'a DbManager,
    pub tunnel: &'a Tunnel,
    /// Generated configuration file for this tunnel.
    pub config_path: &'a Path,
    /// Log file shown in the logger page for this tunnel.
    pub log_path: &'a Path,
}

pub trait TunnelProvider: Sync {
    /// Validates the stored settings, writes any configuration files and
    /// returns what to execute. Errors are `(bizCode, message)`.
    fn prepare(&self, ctx: &TunnelContext) -> Result<LaunchSpec, (String, String)>;

    fn log_classifier(&self) -> LogClassifier;
}

pub fn provider_for(provider: &str) -> Option<&'static dyn TunnelProvider> {
    match provider {
        crate::db::tunnel_repo::PROVIDER_FRPC => Some(&frpc::FrpcProvider),
        _ => None,
    }
}
