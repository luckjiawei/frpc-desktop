interface GithubAsset {
  id: number;
  name: string;
  content_type: string;
  download_count: number;
  size: number;
  browser_download_url: string;
  created_at: string;
  updated_at: string;
}

interface GithubRelease {
  id: number;
  name: string;
  created_at: string;
  published_at: string;
  assets: GithubAsset[]
}