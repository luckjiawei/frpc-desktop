import { defineStore } from "pinia";

/** One-shot handoff only: never put discovered targets in URLs or storage. */
export interface DiscoveryProxyDraft {
  tunnelId: string;
  targetAddress: string;
  port: number;
  transport: "tcp" | "udp";
  name: string;
  proxyType: string;
}

export const useDiscoveryDraftStore = defineStore("discoveryDraft", {
  state: () => ({
    pending: null as DiscoveryProxyDraft | null
  }),
  actions: {
    setDraft(draft: DiscoveryProxyDraft): boolean {
      if (this.pending) return false;
      this.pending = { ...draft };
      return true;
    },
    consumeDraft(): DiscoveryProxyDraft | null {
      const draft = this.pending;
      this.pending = null;
      return draft;
    },
    clearDraft() {
      this.pending = null;
    }
  }
});
