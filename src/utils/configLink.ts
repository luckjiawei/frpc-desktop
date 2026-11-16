import { Base64 } from "js-base64";

const LINK_PREFIX = "frp://";

/** Server settings shared through a frp:// link; proxies are not included. */
export type ConfigLinkPayload = {
  multiuser?: boolean;
  user?: string;
  serverAddr?: string;
  serverPort?: number;
  auth?: OpenSourceFrpcDesktopServer["auth"];
  transport?: OpenSourceFrpcDesktopServer["transport"];
  metadatas?: OpenSourceFrpcDesktopServer["metadatas"];
};

export const encodeConfigLink = (server: OpenSourceFrpcDesktopServer) => {
  const payload: ConfigLinkPayload = {
    multiuser: server.multiuser,
    user: server.user,
    serverAddr: server.serverAddr,
    serverPort: server.serverPort,
    auth: server.auth,
    transport: {
      ...server.transport,
      tls: {
        ...server.transport.tls,
        certFile: "",
        keyFile: "",
        trustedCaFile: ""
      }
    },
    metadatas: server.metadatas
  };
  return LINK_PREFIX + Base64.encode(JSON.stringify(payload));
};

export const decodeConfigLink = (link: string): ConfigLinkPayload => {
  const value = link.trim();
  if (!value.startsWith(LINK_PREFIX)) throw new Error("invalid-link");
  let parsed: unknown;
  try {
    parsed = JSON.parse(Base64.decode(value.slice(LINK_PREFIX.length)));
  } catch {
    throw new Error("invalid-link");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid-link");
  }
  return parsed as ConfigLinkPayload;
};
