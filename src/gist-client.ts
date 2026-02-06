const GITHUB_API = "https://api.github.com";

export interface GistFile {
  filename: string;
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}

export interface GistResponse {
  id: string;
  description: string;
  public: boolean;
  updated_at: string;
  files: Record<string, GistFile>;
}

export interface GitHubUser {
  login: string;
  id: number;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  token?: string;
}

export class GistClient {
  constructor(private readonly token?: string) {}

  private async request<T>(urlPath: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
    if (options.token ?? this.token) {
      headers.Authorization = `Bearer ${options.token ?? this.token}`;
    }

    const response = await fetch(`${GITHUB_API}${urlPath}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API ${response.status}: ${text}`);
    }

    return (await response.json()) as T;
  }

  getGist(gistId: string): Promise<GistResponse> {
    return this.request<GistResponse>(`/gists/${gistId}`);
  }

  getAuthenticatedUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>("/user");
  }

  createGist(input: {
    description: string;
    isPublic: boolean;
    files: Record<string, { content: string }>;
  }): Promise<GistResponse> {
    return this.request<GistResponse>("/gists", {
      method: "POST",
      body: {
        description: input.description,
        public: input.isPublic,
        files: input.files,
      },
    });
  }

  updateGist(gistId: string, input: {
    description?: string;
    files: Record<string, { content: string } | null>;
  }): Promise<GistResponse> {
    return this.request<GistResponse>(`/gists/${gistId}`, {
      method: "PATCH",
      body: input,
    });
  }
}
