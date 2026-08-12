import Database from "better-sqlite3";
import Datastore from "nedb";
import { chmodSync, existsSync, renameSync } from "node:fs";
import path from "node:path";
import Logger from "../core/Logger";
import AppConfigRepository from "../repository/AppConfigRepository";
import ProxyRepository from "../repository/ProxyRepository";
import ServerRepository from "../repository/ServerRepository";
import VersionRepository from "../repository/VersionRepository";
import IdUtils from "../utils/IdUtils";
import PathUtils from "../utils/PathUtils";

interface NedbFiles {
  server: string;
  proxy: string;
  version: string;
}

class NedbMigrationService {
  private readonly files: NedbFiles;

  constructor(
    private readonly database: Database.Database,
    private readonly appConfigRepository: AppConfigRepository,
    private readonly serverRepository: ServerRepository,
    private readonly proxyRepository: ProxyRepository,
    private readonly versionRepository: VersionRepository,
    databaseDirectory = PathUtils.getDataBaseStoragePath()
  ) {
    this.files = {
      server: path.join(databaseDirectory, "server-v2.db"),
      proxy: path.join(databaseDirectory, "proxy-v2.db"),
      version: path.join(databaseDirectory, "version-v2.db")
    };
  }

  public async migrate(): Promise<void> {
    if (this.appConfigRepository.hasNedbMigrationMarker()) {
      return;
    }

    const existingFiles = Object.values(this.files).filter(existsSync);
    if (existingFiles.length === 0) {
      return;
    }

    const [serverDocuments, proxyDocuments, versionDocuments] =
      await Promise.all([
        this.loadDocuments(this.files.server),
        this.loadDocuments(this.files.proxy),
        this.loadDocuments(this.files.version)
      ]);
    if (serverDocuments.length > 1) {
      throw new Error(
        "NeDB migration failed: multiple server configurations were found."
      );
    }

    const proxies = proxyDocuments.map((document, index) =>
      this.normalizeProxy(document, index)
    );
    const versions = versionDocuments.map((document, index) =>
      this.normalizeVersion(document, index)
    );
    const server = serverDocuments[0]
      ? this.normalizeServer(serverDocuments[0])
      : proxies.length > 0
        ? this.createDefaultServer()
        : undefined;

    this.assertUnique(
      proxies.map(proxy => proxy._id),
      "proxy id"
    );
    this.assertUnique(
      versions.map(version => version._id),
      "version id"
    );
    this.assertUnique(
      versions.map(version => String(version.githubReleaseId)),
      "GitHub release id"
    );

    this.database.transaction(() => {
      if (server) {
        this.serverRepository.upsertForMigration(server);
      } else {
        this.appConfigRepository.saveSystemConfig();
      }
      proxies.forEach(proxy => this.proxyRepository.upsertForMigration(proxy));
      versions.forEach(version =>
        this.versionRepository.upsertForMigration(version)
      );
      this.verifyImportedIds(
        "t_frpcd_proxies",
        proxies.map(item => item._id)
      );
      this.verifyImportedIds(
        "t_frpcd_versions",
        versions.map(item => item._id)
      );
      this.appConfigRepository.saveNedbMigrationMarker();

      const foreignKeyErrors = this.database.pragma(
        "foreign_key_check"
      ) as unknown[];
      if (foreignKeyErrors.length > 0) {
        throw new Error(
          "NeDB migration failed: SQLite foreign key validation failed."
        );
      }
    })();

    this.backupFiles(existingFiles);
    Logger.info(
      this.constructor.name,
      `NeDB migration completed: servers=${serverDocuments.length}, proxies=${proxies.length}, versions=${versions.length}.`
    );
  }

  private async loadDocuments(
    filename: string
  ): Promise<Record<string, any>[]> {
    if (!existsSync(filename)) {
      return [];
    }
    const datastore = new Datastore({ filename });
    try {
      await new Promise<void>((resolve, reject) => {
        datastore.loadDatabase(error => (error ? reject(error) : resolve()));
      });
      return await new Promise((resolve, reject) => {
        datastore.find({}, (error, documents) =>
          error ? reject(error) : resolve(documents)
        );
      });
    } catch {
      throw new Error(
        `NeDB migration failed while reading ${path.basename(filename)}.`
      );
    }
  }

  private normalizeServer(
    source: Record<string, any>
  ): OpenSourceFrpcDesktopServer {
    const defaults = this.createDefaultServer();
    return {
      _id: "1",
      frpcVersion:
        source.frpcVersion === null || source.frpcVersion === undefined
          ? null
          : this.integer(source.frpcVersion, "server.frpcVersion"),
      multiuser: this.boolean(
        source.multiuser,
        defaults.multiuser,
        "server.multiuser"
      ),
      user: this.string(source.user, defaults.user),
      serverAddr: this.string(source.serverAddr, defaults.serverAddr),
      serverPort: this.integer(
        source.serverPort ?? defaults.serverPort,
        "server.serverPort",
        1,
        65535
      ),
      loginFailExit: this.boolean(
        source.loginFailExit,
        defaults.loginFailExit,
        "server.loginFailExit"
      ),
      udpPacketSize: this.integer(
        source.udpPacketSize ?? defaults.udpPacketSize,
        "server.udpPacketSize",
        1
      ),
      auth: this.object(source.auth, defaults.auth, "server.auth"),
      log: this.object(source.log, defaults.log, "server.log"),
      webServer: this.object(
        source.webServer,
        defaults.webServer,
        "server.webServer"
      ),
      transport: this.mergeTransport(source.transport, defaults.transport),
      metadatas: this.object(
        source.metadatas,
        defaults.metadatas,
        "server.metadatas"
      ),
      system: this.normalizeSystem(source.system)
    };
  }

  private normalizeProxy(
    source: Record<string, any>,
    index: number
  ): FrpcProxy {
    const label = `proxy[${index}]`;
    const type = this.string(source.type, "http");
    if (
      !["http", "https", "tcp", "udp", "stcp", "xtcp", "sudp"].includes(type)
    ) {
      throw new Error(`NeDB migration failed: unsupported type at ${label}.`);
    }
    return {
      _id: this.identifier(source._id),
      name: this.string(source.name, ""),
      type,
      localIP: this.string(source.localIP, ""),
      localPort: String(source.localPort ?? "8080"),
      remotePort: String(source.remotePort ?? "8080"),
      customDomains: this.stringArray(
        source.customDomains,
        [""],
        `${label}.customDomains`
      ),
      locations: this.stringArray(source.locations, [""], `${label}.locations`),
      hostHeaderRewrite: this.string(source.hostHeaderRewrite, ""),
      visitorsModel: this.string(source.visitorsModel, "visitors"),
      serverUser: this.string(source.serverUser, ""),
      serverName: this.string(source.serverName, ""),
      secretKey: this.string(source.secretKey, ""),
      bindAddr: this.string(source.bindAddr, ""),
      bindPort:
        source.bindPort === null || source.bindPort === undefined
          ? null
          : this.integer(source.bindPort, `${label}.bindPort`, 1, 65535),
      subdomain: this.string(source.subdomain, ""),
      basicAuth: this.boolean(source.basicAuth, false, `${label}.basicAuth`),
      httpUser: this.string(source.httpUser, ""),
      httpPassword: this.string(source.httpPassword, ""),
      fallbackTo: this.string(source.fallbackTo, ""),
      fallbackTimeoutMs: this.integer(
        source.fallbackTimeoutMs ?? 500,
        `${label}.fallbackTimeoutMs`,
        0
      ),
      https2http: this.boolean(source.https2http, false, `${label}.https2http`),
      https2httpCaFile: this.string(source.https2httpCaFile, ""),
      https2httpKeyFile: this.string(source.https2httpKeyFile, ""),
      keepTunnelOpen: this.boolean(
        source.keepTunnelOpen,
        false,
        `${label}.keepTunnelOpen`
      ),
      status: this.integer(source.status ?? 1, `${label}.status`, 0, 1),
      transport: this.object(
        source.transport,
        {
          useEncryption: false,
          useCompression: false,
          proxyProtocolVersion: ""
        },
        `${label}.transport`
      )
    };
  }

  private normalizeVersion(
    source: Record<string, any>,
    index: number
  ): FrpcVersion {
    const label = `version[${index}]`;
    return {
      _id: this.identifier(source._id),
      githubReleaseId: this.integer(
        source.githubReleaseId,
        `${label}.githubReleaseId`
      ),
      githubAssetId: this.integer(
        source.githubAssetId,
        `${label}.githubAssetId`
      ),
      githubCreatedAt: this.string(source.githubCreatedAt, ""),
      name: this.string(source.name, ""),
      assetName: this.string(source.assetName, ""),
      versionDownloadCount: this.integer(
        source.versionDownloadCount ?? 0,
        `${label}.versionDownloadCount`,
        0
      ),
      assetDownloadCount: this.integer(
        source.assetDownloadCount ?? 0,
        `${label}.assetDownloadCount`,
        0
      ),
      browserDownloadUrl: this.string(source.browserDownloadUrl, ""),
      downloaded: this.boolean(source.downloaded, true, `${label}.downloaded`),
      localPath:
        source.localPath === null || source.localPath === undefined
          ? null
          : this.string(source.localPath, ""),
      size: this.string(source.size, "")
    };
  }

  private createDefaultServer(): OpenSourceFrpcDesktopServer {
    return {
      _id: "1",
      multiuser: false,
      frpcVersion: null,
      loginFailExit: false,
      udpPacketSize: 1500,
      serverAddr: "",
      serverPort: 7000,
      auth: { method: "", token: "" },
      log: { to: "", level: "info", maxDays: 3, disablePrintColor: false },
      transport: {
        dialServerTimeout: 10,
        dialServerKeepalive: 7200,
        poolCount: 0,
        tcpMux: true,
        tcpMuxKeepaliveInterval: 30,
        protocol: "tcp",
        connectServerLocalIP: "",
        proxyURL: "",
        tls: {
          enable: true,
          certFile: "",
          keyFile: "",
          trustedCaFile: "",
          serverName: "",
          disableCustomTLSFirstByte: true
        },
        heartbeatInterval: 30,
        heartbeatTimeout: 90
      },
      metadatas: { token: "" },
      webServer: {
        addr: "127.0.0.1",
        port: 57400,
        user: "",
        password: "",
        pprofEnable: false
      },
      system: {
        launchAtStartup: false,
        silentStartup: false,
        autoConnectOnStartup: false,
        notifyUpdates: true,
        language: "en-US"
      },
      user: ""
    };
  }

  private normalizeSystem(source: unknown): FrpcSystemConfiguration {
    const system = this.object<Record<string, any>>(
      source,
      {},
      "server.system"
    );
    return {
      launchAtStartup: this.boolean(
        system.launchAtStartup,
        false,
        "server.system.launchAtStartup"
      ),
      silentStartup: this.boolean(
        system.silentStartup,
        false,
        "server.system.silentStartup"
      ),
      autoConnectOnStartup: this.boolean(
        system.autoConnectOnStartup,
        false,
        "server.system.autoConnectOnStartup"
      ),
      notifyUpdates: this.boolean(
        system.notifyUpdates,
        true,
        "server.system.notifyUpdates"
      ),
      language: this.string(system.language, "en-US")
    };
  }

  private mergeTransport(
    source: unknown,
    fallback: TransportConfig
  ): TransportConfig {
    const transport = this.object(source, fallback, "server.transport");
    const tls = this.object(
      transport.tls,
      fallback.tls,
      "server.transport.tls"
    );
    return { ...fallback, ...transport, tls: { ...fallback.tls, ...tls } };
  }

  private object<T extends Record<string, any>>(
    value: unknown,
    fallback: T,
    label: string
  ): T {
    if (value === undefined || value === null) {
      return { ...fallback };
    }
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`NeDB migration failed: ${label} must be an object.`);
    }
    return { ...fallback, ...(value as T) };
  }

  private stringArray(
    value: unknown,
    fallback: string[],
    label: string
  ): string[] {
    if (value === undefined || value === null) {
      return [...fallback];
    }
    if (!Array.isArray(value) || value.some(item => typeof item !== "string")) {
      throw new Error(
        `NeDB migration failed: ${label} must be a string array.`
      );
    }
    return value;
  }

  private boolean(value: unknown, fallback: boolean, label: string): boolean {
    if (value === undefined || value === null) {
      return fallback;
    }
    if (value === true || value === 1) {
      return true;
    }
    if (value === false || value === 0) {
      return false;
    }
    throw new Error(`NeDB migration failed: ${label} must be boolean.`);
  }

  private integer(
    value: unknown,
    label: string,
    minimum?: number,
    maximum?: number
  ): number {
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string" && /^-?\d+$/.test(value)
          ? Number(value)
          : Number.NaN;
    if (
      !Number.isSafeInteger(parsed) ||
      (minimum !== undefined && parsed < minimum) ||
      (maximum !== undefined && parsed > maximum)
    ) {
      throw new Error(`NeDB migration failed: ${label} is invalid.`);
    }
    return parsed;
  }

  private string(value: unknown, fallback: string): string {
    return value === undefined || value === null ? fallback : String(value);
  }

  private identifier(value: unknown): string {
    const id = this.string(value, "").trim();
    return id || IdUtils.genUUID();
  }

  private assertUnique(values: string[], label: string): void {
    if (new Set(values).size !== values.length) {
      throw new Error(`NeDB migration failed: duplicate ${label}.`);
    }
  }

  private verifyImportedIds(tableName: string, expectedIds: string[]): void {
    if (expectedIds.length === 0) {
      return;
    }
    const actualIds = new Set(
      (
        this.database.prepare(`SELECT id FROM ${tableName}`).all() as {
          id: string;
        }[]
      ).map(row => row.id)
    );
    if (expectedIds.some(id => !actualIds.has(id))) {
      throw new Error(
        `NeDB migration failed: ${tableName} id validation failed.`
      );
    }
  }

  private backupFiles(files: string[]): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    files.forEach(filename => {
      const backupFilename = `${filename}.migrated-${timestamp}.bak`;
      try {
        renameSync(filename, backupFilename);
        chmodSync(backupFilename, 0o444);
      } catch (error) {
        const errorName = error instanceof Error ? error.name : "UnknownError";
        Logger.warn(
          this.constructor.name,
          `Could not archive migrated NeDB file ${path.basename(filename)} (${errorName}).`
        );
      }
    });
  }
}

export default NedbMigrationService;
