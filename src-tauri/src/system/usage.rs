use crate::models::{SystemMemoryUsage, SystemUsage};
use std::collections::{HashMap, HashSet};
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};

pub(super) struct AppUsageSampler {
    system: System,
    root_pid: Pid,
}

impl AppUsageSampler {
    pub(super) fn new() -> Self {
        let mut sampler = Self {
            system: System::new(),
            root_pid: Pid::from_u32(std::process::id()),
        };
        // Prime CPU counters; the first emitted sample comes three seconds later.
        sampler.refresh();
        sampler
    }

    fn refresh(&mut self) {
        self.system.refresh_cpu_usage();
        self.system.refresh_memory();
        // Parent relationships are refreshed too. Avoid reading command lines,
        // environments, or disk statistics: none are needed for these metrics.
        self.system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing().with_cpu().with_memory(),
        );
    }

    pub(super) fn sample(&mut self) -> SystemUsage {
        self.refresh();
        let pids = process_tree_pids(
            self.root_pid,
            self.system
                .processes()
                .iter()
                // Linux also exposes individual threads in the process map.
                // Their CPU and memory are already accounted for by their process.
                .filter(|(_, process)| process.thread_kind().is_none())
                .map(|(&pid, process)| (pid, process.parent())),
        );
        let mut cpu = 0.0;
        let mut memory = 0;
        for pid in pids {
            if let Some(process) = self.system.process(pid) {
                cpu += process.cpu_usage();
                memory += process.memory();
            }
        }
        usage_from_totals(
            cpu,
            memory,
            self.system.cpus().len(),
            self.system.total_memory(),
        )
    }
}

fn process_tree_pids(
    root: Pid,
    parents: impl IntoIterator<Item = (Pid, Option<Pid>)>,
) -> HashSet<Pid> {
    let mut children: HashMap<Pid, Vec<Pid>> = HashMap::new();
    for (pid, parent) in parents {
        if let Some(parent) = parent {
            children.entry(parent).or_default().push(pid);
        }
    }
    let mut included = HashSet::new();
    let mut pending = vec![root];
    while let Some(pid) = pending.pop() {
        if included.insert(pid) {
            if let Some(descendants) = children.get(&pid) {
                pending.extend(descendants);
            }
        }
    }
    included
}

fn usage_from_totals(cpu: f32, memory: u64, cpu_count: usize, total_memory: u64) -> SystemUsage {
    SystemUsage {
        // sysinfo reports 100% per logical CPU. Normalize to total machine capacity.
        cpu: (cpu / cpu_count.max(1) as f32).clamp(0.0, 100.0),
        memory: SystemMemoryUsage {
            used: memory / (1024 * 1024),
            percentage: if total_memory > 0 {
                memory as f32 / total_memory as f32 * 100.0
            } else {
                0.0
            },
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn samples_the_current_process_with_initialized_cpu_counters() {
        let mut sampler = AppUsageSampler::new();
        assert!(!sampler.system.cpus().is_empty());
        let usage = sampler.sample();
        assert!(usage.memory.used > 0);
        assert!((0.0..=100.0).contains(&usage.cpu));
    }

    #[cfg(unix)]
    #[test]
    fn drops_an_exited_child_from_live_samples() {
        let mut child = std::process::Command::new("sleep")
            .arg("30")
            .spawn()
            .unwrap();
        let mut sampler = AppUsageSampler::new();
        // Restrict the root to the real child so this test can observe its
        // disappearance without counting the test runner's own memory.
        sampler.root_pid = Pid::from_u32(child.id());
        sampler.sample();
        let was_present = sampler.system.process(sampler.root_pid).is_some();
        let stopped = child.kill();
        let exited = child.wait();
        stopped.unwrap();
        exited.unwrap();
        let after_exit = sampler.sample();
        assert!(was_present);
        assert!(sampler.system.process(sampler.root_pid).is_none());
        assert_eq!(after_exit.memory.used, 0);
        assert_eq!(after_exit.cpu, 0.0);
    }

    #[test]
    fn includes_nested_children_but_excludes_ancestors_and_other_apps() {
        let pid = Pid::from_u32;
        let parents = [
            (pid(40), Some(pid(30))), // grandchild, before its parent
            (pid(10), Some(pid(1))),  // app's launcher
            (pid(20), Some(pid(10))), // app
            (pid(30), Some(pid(20))), // frpc
            (pid(50), Some(pid(20))), // cloudflared
            (pid(60), Some(pid(10))), // another app from the same launcher
            (pid(70), None),
        ];
        assert_eq!(
            process_tree_pids(pid(20), parents),
            HashSet::from([pid(20), pid(30), pid(40), pid(50)])
        );
        // Rebuild from the current snapshot: stopped processes no longer count.
        assert_eq!(
            process_tree_pids(pid(20), [(pid(20), Some(pid(10)))]),
            HashSet::from([pid(20)])
        );
    }

    #[test]
    fn visits_each_pid_once_even_with_a_parent_cycle() {
        let root = Pid::from_u32(20);
        let child = Pid::from_u32(30);
        assert_eq!(
            process_tree_pids(root, [(root, Some(child)), (child, Some(root))]),
            HashSet::from([root, child])
        );
    }

    #[test]
    fn normalizes_cpu_and_uses_process_memory_as_the_numerator() {
        let usage = usage_from_totals(200.0, 512 * 1024 * 1024, 8, 8 * 1024 * 1024 * 1024);
        assert_eq!(usage.cpu, 25.0);
        assert_eq!(usage.memory.used, 512);
        assert_eq!(usage.memory.percentage, 6.25);

        let unavailable = usage_from_totals(0.0, 0, 0, 0);
        assert_eq!(unavailable.cpu, 0.0);
        assert_eq!(unavailable.memory.percentage, 0.0);
    }
}
