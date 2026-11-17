type DiscoveryTransport = "tcp" | "udp";
type DiscoverySource = "mdns" | "ssdp" | "neighbor";
type DiscoveryStatus =
  | "pending"
  | "running"
  | "completed"
  | "stopped"
  | "timedOut"
  | "failed"
  | "networkChanged";
type DiscoveryAddress = {
  address: string;
  family: "ipv4" | "ipv6";
  zoneId: number | null;
};
type DiscoveryScope = {
  scopeId: string;
  networkVersion: string;
  name: string;
  interfaceIndex: number;
  addresses: (DiscoveryAddress & { prefixLength: number })[];
  prefixes: string[];
  isDefault: boolean;
  isVirtual: boolean;
};
type DiscoveryScopes = {
  scopes: DiscoveryScope[];
  defaultScopeId: string | null;
  networkVersion: string;
};
type DiscoveredService = {
  id: string;
  name: string;
  instanceNames: string[];
  targetAddress: string;
  zoneId: number | null;
  port: number;
  transport: DiscoveryTransport;
  protocolHint: string | null;
  protocolEvidence: "announcement" | "portHint" | null;
  sources: string[];
  verification:
    | "notChecked"
    | "tcpReachable"
    | "refused"
    | "timeout"
    | "unreachable";
  lastSeenAt: string;
  expiresAt: string | null;
  expired: boolean;
  proxyDisabledReason: "ipv6LinkLocal" | "ipv6NotValidated" | "expired" | null;
};
type DiscoveredDevice = {
  id: string;
  scopeId: string;
  name: string;
  addresses: DiscoveryAddress[];
  sources: string[];
  lastSeenAt: string;
  services: DiscoveredService[];
  expiresAt: string | null;
  expired: boolean;
};
type DiscoverySnapshot = {
  scanId: string;
  requestId: string;
  scopeId: string;
  networkVersion: string;
  revision: number;
  status: DiscoveryStatus;
  phase: "pending" | "collecting" | "probing" | "finished";
  startedAt: string;
  updatedAt: string;
  devices: DiscoveredDevice[];
  sources: {
    source: DiscoverySource;
    status: "pending" | "running" | "completed" | "unavailable";
    reason: string | null;
  }[];
  budget: {
    candidateAddresses: number;
    probesStarted: number;
    probesCompleted: number;
    rejectedAddresses: number;
  };
  truncated: boolean;
  partial: boolean;
  warnings: string[];
};
