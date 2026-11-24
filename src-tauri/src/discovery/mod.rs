pub mod interfaces;
mod mdns;
mod merge;
mod neighbors;
mod os;
mod probe;
mod sockets;
mod ssdp;

use crate::models::{ApiResponse, DiscoverySnapshot, DiscoverySource};
use interfaces::Scope;
use merge::Observation;
use std::{
    sync::{
        atomic::{AtomicU8, Ordering},
        Arc,
    },
    time::Duration,
};
use tauri::{AppHandle, Emitter};
use tokio::{
    sync::{mpsc, watch, Mutex},
    task::JoinSet,
};
use uuid::Uuid;

const TOTAL_WINDOW: Duration = Duration::from_secs(15);
const ACTIVATION_WINDOW: Duration = Duration::from_secs(15);
const EVENT_PERIOD: Duration = Duration::from_millis(500);
const CHANNEL_CAPACITY: usize = 2048;
const STOP_NONE: u8 = 0;
const STOP_USER: u8 = 1;
const STOP_NETWORK_CHANGED: u8 = 2;

#[derive(Clone, Debug)]
struct SourceReport {
    source: &'static str,
    available: bool,
    limited: bool,
    reason: Option<&'static str>,
}
impl SourceReport {
    fn combine(
        source: &'static str,
        a: Result<bool, &'static str>,
        b: Result<bool, &'static str>,
    ) -> Self {
        let available = a.is_ok() || b.is_ok();
        let limited =
            a.as_ref().is_ok_and(|limited| *limited) || b.as_ref().is_ok_and(|limited| *limited);
        let reason = if available {
            if limited {
                Some("sourceLimit")
            } else {
                None
            }
        } else {
            a.err().or_else(|| b.err()).or(Some("sourceUnavailable"))
        };
        Self {
            source,
            available,
            limited,
            reason,
        }
    }
}

struct ScanTask {
    snapshot: Mutex<DiscoverySnapshot>,
    scope: Scope,
    cancel: watch::Sender<bool>,
    source_cancel: watch::Sender<bool>,
    terminal: AtomicU8,
    activated: std::sync::atomic::AtomicBool,
    created: tokio::time::Instant,
    worker: Mutex<Option<tokio::task::JoinHandle<()>>>,
}
#[derive(Default)]
pub struct DiscoveryManager {
    task: Mutex<Option<Arc<ScanTask>>>,
}
impl DiscoveryManager {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn scopes(&self) -> crate::models::DiscoveryScopes {
        let mut scopes = interfaces::enumerate();
        let version = interfaces::fingerprint(&scopes);
        for scope in &mut scopes {
            scope.public.scope_id = scope_id(&scope.fingerprint);
            scope.public.network_version = version.clone();
        }
        interfaces::public(&scopes, &version)
    }
    pub async fn start(
        &self,
        request_id: &str,
        scope_id_value: &str,
        version: &str,
    ) -> Result<DiscoverySnapshot, &'static str> {
        if !valid_request_id(request_id) {
            return Err("invalidArguments");
        }
        let current = self.scopes();
        if version != current.network_version {
            return Err("networkChanged");
        }
        let selected = current
            .scopes
            .iter()
            .find(|s| s.scope_id == scope_id_value)
            .ok_or("networkChanged")?;
        let mut scopes = interfaces::enumerate();
        let scope = scopes
            .iter_mut()
            .find(|s| s.public.interface_index == selected.interface_index)
            .ok_or("networkChanged")?;
        if scope_id(&scope.fingerprint) != scope_id_value {
            return Err("networkChanged");
        }
        scope.public.scope_id = scope_id_value.into();
        scope.public.network_version = version.into();
        let scope = scope.clone();
        let mut slot = self.task.lock().await;
        if slot.as_ref().is_some_and(|task| {
            !task.activated.load(Ordering::SeqCst) && task.created.elapsed() >= ACTIVATION_WINDOW
        }) {
            if let Some(task) = slot.as_ref() {
                task.cancel.send_replace(true);
                task.source_cancel.send_replace(true);
            }
            *slot = None;
        }
        if slot.as_ref().is_some_and(|task| {
            let running = task
                .snapshot
                .try_lock()
                .map(|s| s.status == "pending" || s.status == "running")
                .unwrap_or(true);
            running
                || task
                    .worker
                    .try_lock()
                    .map(|worker| worker.as_ref().is_some_and(|h| !h.is_finished()))
                    .unwrap_or(true)
        }) {
            return Err("busy");
        }
        let mut snapshot = new_snapshot(request_id, &scope);
        let scan_id = Uuid::new_v4().to_string();
        snapshot.scan_id = scan_id;
        let (cancel, _) = watch::channel(false);
        let (source_cancel, _) = watch::channel(false);
        *slot = Some(Arc::new(ScanTask {
            snapshot: Mutex::new(snapshot.clone()),
            scope,
            cancel,
            source_cancel,
            terminal: AtomicU8::new(STOP_NONE),
            activated: std::sync::atomic::AtomicBool::new(false),
            created: tokio::time::Instant::now(),
            worker: Mutex::new(None),
        }));
        Ok(snapshot)
    }
    pub async fn activate(
        self: &Arc<Self>,
        app: AppHandle,
        scan_id: &str,
    ) -> Result<DiscoverySnapshot, &'static str> {
        let task = self.find(scan_id).await?;
        if task.created.elapsed() > ACTIVATION_WINDOW {
            task.cancel.send_replace(true);
            task.source_cancel.send_replace(true);
            let mut snapshot = task.snapshot.lock().await;
            if snapshot.status == "pending" {
                snapshot.status = "stopped".into();
                snapshot.phase = "finished".into();
                merge::warn(&mut snapshot, "activationExpired");
                touch(&mut snapshot);
            }
            return Err("activationExpired");
        }
        if task.activated.swap(true, Ordering::SeqCst) {
            let snapshot = task.snapshot.lock().await.clone();
            return Ok(snapshot);
        }
        if self.scopes().network_version != task.scope.public.network_version {
            task.terminal.store(STOP_NETWORK_CHANGED, Ordering::SeqCst);
            let mut snapshot = task.snapshot.lock().await;
            snapshot.status = "networkChanged".into();
            snapshot.phase = "finished".into();
            touch(&mut snapshot);
            self.emit(&app, &snapshot);
            return Err("networkChanged");
        }
        let weak = Arc::downgrade(self);
        let worker_task = task.clone();
        let worker_app = app.clone();
        *task.worker.lock().await = Some(tokio::spawn(async move {
            run_scan(weak, worker_app, worker_task).await;
        }));
        let snapshot = task.snapshot.lock().await.clone();
        Ok(snapshot)
    }
    /// Last finished scan, so returning to the page can show earlier results
    /// before the new round reports anything.
    pub async fn last(&self) -> Result<DiscoverySnapshot, &'static str> {
        let task = self.task.lock().await.as_ref().cloned().ok_or("notFound")?;
        let snapshot = task.snapshot.lock().await.clone();
        if matches!(snapshot.status.as_str(), "pending" | "running") {
            return Err("busy");
        }
        Ok(snapshot)
    }
    pub async fn snapshot(&self, scan_id: &str) -> Result<DiscoverySnapshot, &'static str> {
        let task = self.find(scan_id).await?;
        let mut snapshot = task.snapshot.lock().await;
        if snapshot.status == "pending"
            && !task.activated.load(Ordering::SeqCst)
            && task.created.elapsed() >= ACTIVATION_WINDOW
        {
            snapshot.status = "stopped".into();
            snapshot.phase = "finished".into();
            merge::warn(&mut snapshot, "activationExpired");
            touch(&mut snapshot);
        }
        Ok(snapshot.clone())
    }
    pub async fn stop(
        self: &Arc<Self>,
        app: AppHandle,
        scan_id: &str,
    ) -> Result<DiscoverySnapshot, &'static str> {
        let task = self.find(scan_id).await?;
        let status = task.snapshot.lock().await.status.clone();
        if status == "pending" {
            task.terminal.store(STOP_USER, Ordering::SeqCst);
            task.cancel.send_replace(true);
            task.source_cancel.send_replace(true);
            let mut snapshot = task.snapshot.lock().await;
            snapshot.status = "stopped".into();
            snapshot.phase = "finished".into();
            touch(&mut snapshot);
            self.emit(&app, &snapshot);
            return Ok(snapshot.clone());
        }
        if matches!(
            status.as_str(),
            "completed" | "stopped" | "timedOut" | "failed" | "networkChanged"
        ) {
            return Ok(task.snapshot.lock().await.clone());
        }
        task.terminal.store(STOP_USER, Ordering::SeqCst);
        task.cancel.send_replace(true);
        task.source_cancel.send_replace(true);
        if let Some(worker) = task.worker.lock().await.take() {
            let _ = worker.await;
        }
        let snapshot = task.snapshot.lock().await.clone();
        Ok(snapshot)
    }
    async fn find(&self, scan_id: &str) -> Result<Arc<ScanTask>, &'static str> {
        if Uuid::parse_str(scan_id).is_err() {
            return Err("invalidArguments");
        }
        let task = self.task.lock().await.as_ref().cloned().ok_or("notFound")?;
        if task.snapshot.lock().await.scan_id == scan_id {
            Ok(task)
        } else {
            Err("notFound")
        }
    }
    fn emit(&self, app: &AppHandle, snapshot: &DiscoverySnapshot) {
        let _ = app.emit("discovery:updated", ApiResponse::success(snapshot.clone()));
    }
    pub async fn shutdown(&self) {
        if let Some(task) = self.task.lock().await.clone() {
            task.terminal.store(STOP_USER, Ordering::SeqCst);
            task.cancel.send_replace(true);
            task.source_cancel.send_replace(true);
            if let Some(worker) = task.worker.lock().await.take() {
                let _ = worker.await;
            }
        }
    }
}
fn scope_id(fingerprint: &str) -> String {
    use sha2::Digest;
    let digest = sha2::Sha256::digest(fingerprint.as_bytes());
    format!("s-{}", &format!("{:x}", digest)[..24])
}
fn valid_request_id(value: &str) -> bool {
    (1..=128).contains(&value.len())
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
}
fn touch(snapshot: &mut DiscoverySnapshot) {
    snapshot.revision = snapshot.revision.saturating_add(1);
    snapshot.updated_at = merge::now();
}
fn new_snapshot(request_id: &str, scope: &Scope) -> DiscoverySnapshot {
    let now = merge::now();
    DiscoverySnapshot {
        scan_id: String::new(),
        request_id: request_id.into(),
        scope_id: scope.public.scope_id.clone(),
        network_version: scope.public.network_version.clone(),
        revision: 0,
        status: "pending".into(),
        phase: "pending".into(),
        started_at: now.clone(),
        updated_at: now,
        devices: vec![],
        sources: ["mdns", "ssdp", "neighbor"]
            .iter()
            .map(|source| DiscoverySource {
                source: (*source).into(),
                status: "pending".into(),
                reason: None,
            })
            .collect(),
        budget: probe::initial_budget(),
        truncated: false,
        partial: false,
        warnings: vec![],
    }
}

async fn monitor_network(task: Arc<ScanTask>) {
    let mut cancel = task.cancel.subscribe();
    let expected = task.scope.public.network_version.clone();
    loop {
        tokio::select! {_=tokio::time::sleep(Duration::from_millis(500))=>{if interfaces::fingerprint(&interfaces::enumerate())!=expected{task.terminal.store(STOP_NETWORK_CHANGED,Ordering::SeqCst);task.cancel.send_replace(true);task.source_cancel.send_replace(true);break;}},_=cancel.changed()=>break}
    }
}
async fn run_scan(manager: std::sync::Weak<DiscoveryManager>, app: AppHandle, task: Arc<ScanTask>) {
    let deadline = tokio::time::Instant::now() + TOTAL_WINDOW;
    let (tx, mut rx) = mpsc::channel::<Observation>(CHANNEL_CAPACITY);
    let mut cancel = task.cancel.subscribe();
    let monitor = tokio::spawn(monitor_network(task.clone()));
    {
        let mut snapshot = task.snapshot.lock().await;
        snapshot.status = "running".into();
        snapshot.phase = "collecting".into();
        touch(&mut snapshot);
        if let Some(manager) = manager.upgrade() {
            manager.emit(&app, &snapshot);
        }
    }
    let mut workers = JoinSet::new();
    let source_cancel = task.source_cancel.subscribe();
    workers.spawn(mdns::collect(
        task.scope.clone(),
        tx.clone(),
        source_cancel.clone(),
    ));
    workers.spawn(ssdp::collect(
        task.scope.clone(),
        tx.clone(),
        source_cancel.clone(),
    ));
    workers.spawn(neighbors::collect(
        task.scope.clone(),
        tx.clone(),
        source_cancel,
    ));
    drop(tx);
    let collect_deadline =
        (tokio::time::Instant::now() + Duration::from_millis(5500)).min(deadline);
    let mut completed = 0;
    let mut last_emit = tokio::time::Instant::now();
    let mut timed_out = false;
    let mut receiving = true;
    loop {
        tokio::select! {
         _=tokio::time::sleep_until(collect_deadline)=>break,
         _=tokio::time::sleep_until(deadline)=>{timed_out=true;break;},
         _=cancel.changed()=>break,
         result=workers.join_next(),if !workers.is_empty()=>if let Some(Ok(report))=result{completed+=1;set_source(&task,&report).await;},
         observation=rx.recv(),if receiving=>match observation{
          Some(item)=>{let mut snapshot=task.snapshot.lock().await;merge::observe(&mut snapshot,&task.scope,item);touch(&mut snapshot);if last_emit.elapsed()>=EVENT_PERIOD{if let Some(manager)=manager.upgrade(){merge::bound(&mut snapshot);manager.emit(&app,&snapshot);}last_emit=tokio::time::Instant::now();}},
          None=>receiving=false,
         },
        }
        if completed == 3 {
            break;
        }
    }
    task.source_cancel.send_replace(true);
    // Workers own every network socket / child process and must finish before this task releases the singleton.
    while let Some(result) = workers.join_next().await {
        if let Ok(report) = result {
            if !task
                .snapshot
                .lock()
                .await
                .sources
                .iter()
                .any(|s| s.source == report.source && s.status != "pending")
            {
                set_source(&task, &report).await;
            }
        }
    }
    while let Ok(item) = rx.try_recv() {
        let mut snapshot = task.snapshot.lock().await;
        merge::observe(&mut snapshot, &task.scope, item);
    }
    if task.terminal.load(Ordering::SeqCst) == STOP_NONE && tokio::time::Instant::now() < deadline {
        {
            let mut snapshot = task.snapshot.lock().await;
            snapshot.phase = "probing".into();
            touch(&mut snapshot);
            if let Some(manager) = manager.upgrade() {
                manager.emit(&app, &snapshot);
            }
        }
        let future = probe::run(task.scope.clone(), &task.snapshot, task.cancel.subscribe());
        tokio::pin!(future);
        tokio::select! {
            _ = &mut future => {}
            _ = tokio::time::sleep_until(deadline) => timed_out = true,
            _ = cancel.changed() => {}
        }
    } else if tokio::time::Instant::now() >= deadline {
        timed_out = true;
    }
    {
        let mut snapshot = task.snapshot.lock().await;
        for device in &mut snapshot.devices {
            os::finalize(device);
        }
        touch(&mut snapshot);
    }
    task.cancel.send_replace(true);
    let _ = monitor.await;
    let current = task.terminal.load(Ordering::SeqCst);
    let current_version = interfaces::fingerprint(&interfaces::enumerate());
    let status = if current == STOP_NETWORK_CHANGED
        || current_version != task.scope.public.network_version
    {
        "networkChanged"
    } else if current == STOP_USER {
        "stopped"
    } else if timed_out {
        "timedOut"
    } else if task
        .snapshot
        .lock()
        .await
        .sources
        .iter()
        .all(|s| s.status == "unavailable")
    {
        "failed"
    } else {
        "completed"
    };
    let mut snapshot = task.snapshot.lock().await;
    snapshot.status = status.into();
    snapshot.phase = "finished".into();
    touch(&mut snapshot);
    merge::bound(&mut snapshot);
    if let Some(manager) = manager.upgrade() {
        manager.emit(&app, &snapshot);
    }
}
async fn set_source(task: &ScanTask, report: &SourceReport) {
    let mut snapshot = task.snapshot.lock().await;
    if let Some(source) = snapshot
        .sources
        .iter_mut()
        .find(|s| s.source == report.source)
    {
        source.status = if report.available {
            "completed"
        } else {
            "unavailable"
        }
        .into();
        source.reason = report.reason.map(str::to_string);
    }
    if report.limited {
        merge::warn(&mut snapshot, "sourceLimit");
    }
    if !report.available {
        merge::warn(&mut snapshot, "sourceUnavailable");
    }
    touch(&mut snapshot);
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn request_ids_are_bounded_ascii_tokens() {
        assert!(valid_request_id("from_frontend-1"));
        assert!(!valid_request_id(""));
        assert!(!valid_request_id(&"x".repeat(129)));
        assert!(!valid_request_id("scope/../x"));
        assert!(!valid_request_id("全局"));
    }
    #[test]
    fn terminal_reason_distinguishes_natural_user_and_network() {
        fn status(reason: u8, timeout: bool) -> &'static str {
            if reason == STOP_NETWORK_CHANGED {
                "networkChanged"
            } else if reason == STOP_USER {
                "stopped"
            } else if timeout {
                "timedOut"
            } else {
                "completed"
            }
        }
        assert_eq!(status(STOP_NONE, false), "completed");
        assert_eq!(status(STOP_USER, false), "stopped");
        assert_eq!(status(STOP_NETWORK_CHANGED, false), "networkChanged");
    }
    #[test]
    fn task_budgets_are_bounded_and_pending_is_expirable() {
        let scope = interfaces::test_scope();
        let snapshot = new_snapshot("test", &scope);
        assert_eq!(snapshot.budget.candidate_addresses, 0);
        assert_eq!(snapshot.status, "pending");
        assert_eq!(TOTAL_WINDOW, Duration::from_secs(15));
        assert_eq!(EVENT_PERIOD, Duration::from_millis(500));
        assert_eq!(ACTIVATION_WINDOW, Duration::from_secs(15));
    }
}
